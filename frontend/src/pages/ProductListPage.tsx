import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SlidersHorizontal, ChevronDown, ChevronRight } from "lucide-react";
import { products } from "@/data/products";
import { categories } from "@/data/categories";
import { CategoryType, SortOption } from "@/types/product.types";
import ProductCard from "@/components/shared/ProductCard";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { formatPrice } from "@/lib/format";

const ITEMS_PER_PAGE = 16;

const priceRanges = [
  { label: "Dưới 1 triệu", min: 0, max: 1000000 },
  { label: "1 triệu - 2 triệu", min: 1000000, max: 2000000 },
  { label: "2 triệu - 5 triệu", min: 2000000, max: 5000000 },
  { label: "5 triệu - 10 triệu", min: 5000000, max: 10000000 },
  { label: "10 triệu - 20 triệu", min: 10000000, max: 20000000 },
  { label: "20 triệu - 30 triệu", min: 20000000, max: 30000000 },
  { label: "30 triệu - 50 triệu", min: 30000000, max: 50000000 },
  { label: "Trên 50 triệu", min: 50000000, max: Infinity },
];

// Category-specific spec filter config: specKey → display label
const categorySpecFilters: Record<string, { key: string; label: string; extractFn?: (p: { name: string; specs: Record<string, string> }) => string | null }[]> = {
  cpu: [
    {
      key: "_cpuLine", label: "Dòng CPU",
      extractFn: (p) => {
        const n = p.name.toLowerCase();
        if (n.includes("threadripper")) return "AMD Threadripper";
        if (n.includes("ryzen 9")) return "AMD Ryzen 9";
        if (n.includes("ryzen 7")) return "AMD Ryzen 7";
        if (n.includes("ryzen 5")) return "AMD Ryzen 5";
        if (n.includes("ryzen 3")) return "AMD Ryzen 3";
        if (n.includes("core i9")) return "Intel Core i9";
        if (n.includes("core i7")) return "Intel Core i7";
        if (n.includes("core i5")) return "Intel Core i5";
        if (n.includes("core i3")) return "Intel Core i3";
        return null;
      },
    },
    { key: "Socket", label: "Socket" },
  ],
  mainboard: [
    { key: "Socket", label: "Socket" },
    { key: "Chipset", label: "Chipset" },
    { key: "FormFactor", label: "Form Factor" },
  ],
  vga: [
    { key: "VRAM", label: "Bộ nhớ VRAM" },
  ],
  ram: [
    { key: "Type", label: "Loại RAM" },
    { key: "Capacity", label: "Dung lượng" },
    { key: "Speed", label: "Bus" },
  ],
  ssd: [
    { key: "Capacity", label: "Dung lượng" },
    { key: "Interface", label: "Chuẩn kết nối" },
  ],
  psu: [
    { key: "Wattage", label: "Công suất" },
    { key: "Efficiency", label: "Hiệu suất" },
    { key: "Modular", label: "Kiểu dây cáp" },
  ],
  case: [
    { key: "Form Factor", label: "Kích thước" },
  ],
  cooler: [
    {
      key: "_coolerType", label: "Loại tản nhiệt",
      extractFn: (p) => {
        const t = (p.specs["Type"] || "").toLowerCase();
        if (t.includes("aio")) return "Tản nước AIO";
        if (t.includes("air") || t.includes("tower")) return "Tản khí (Air)";
        return p.specs["Type"] || null;
      },
    },
  ],
};

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category") as CategoryType | null;
  const searchQuery = searchParams.get("search") || searchParams.get("q") || "";
  const brandParam = searchParams.get("brand") || "";
  const [sort, setSort] = useState<SortOption>("name-asc");
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<number[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string[]>>({});
  const [page, setPage] = useState(1);

  // Sync brand from URL into selectedBrands, and reset filters when category/brand/q changes
  useEffect(() => {
    if (brandParam) {
      setSelectedBrands([brandParam]);
    } else {
      setSelectedBrands([]);
    }
    setSelectedSpecs({});
    setSelectedPriceRanges([]);
    setPage(1);
  }, [categoryParam, brandParam, searchQuery]);

  document.title = searchQuery
    ? `Tìm kiếm "${searchQuery}" - PCShop`
    : categoryParam
      ? `${categories.find((c) => c.id === categoryParam)?.name || "Sản phẩm"} - PCShop`
      : "Tất cả sản phẩm - PCShop";

  const allBrands = useMemo(() => {
    const filtered = categoryParam ? products.filter((p) => p.category === categoryParam) : products;
    return [...new Set(filtered.map((p) => p.brand))].sort();
  }, [categoryParam]);

  // Count products per brand
  const brandCounts = useMemo(() => {
    const base = categoryParam ? products.filter((p) => p.category === categoryParam) : products;
    const counts: Record<string, number> = {};
    base.forEach((p) => { counts[p.brand] = (counts[p.brand] || 0) + 1; });
    return counts;
  }, [categoryParam]);

  // Count products per price range
  const priceRangeCounts = useMemo(() => {
    const base = categoryParam ? products.filter((p) => p.category === categoryParam) : products;
    return priceRanges.map((r) => base.filter((p) => p.price >= r.min && p.price < (r.max === Infinity ? Infinity : r.max)).length);
  }, [categoryParam]);

  // Helper to extract spec value for a filter config from a product
  const getSpecValue = useCallback((p: { name: string; specs: Record<string, string> }, filterCfg: { key: string; extractFn?: (p: { name: string; specs: Record<string, string> }) => string | null }) => {
    if (filterCfg.extractFn) return filterCfg.extractFn(p);
    return p.specs[filterCfg.key] || null;
  }, []);

  // Spec filter options with counts (only when a category is selected)
  const specFilterGroups = useMemo(() => {
    if (!categoryParam || !categorySpecFilters[categoryParam]) return [];
    const base = products.filter((p) => p.category === categoryParam);

    // Parse size strings like "1TB", "500GB", "850W" to a numeric value for sorting
    const parseSize = (s: string): number | null => {
      const m = s.match(/^([\d.]+)\s*(TB|GB|MB|W|MHz)$/i);
      if (!m) return null;
      const num = parseFloat(m[1]);
      const unit = m[2].toUpperCase();
      if (unit === "TB") return num * 1024;
      if (unit === "GB") return num;
      if (unit === "MB") return num / 1024;
      if (unit === "W") return num;
      if (unit === "MHZ") return num;
      return num;
    };

    return categorySpecFilters[categoryParam].map((filterCfg) => {
      const map = new Map<string, number>();
      base.forEach((p) => {
        const val = getSpecValue(p, filterCfg);
        if (val) map.set(val, (map.get(val) || 0) + 1);
      });
      const options = Array.from(map.entries()).sort((a, b) => {
        const na = parseSize(a[0]);
        const nb = parseSize(b[0]);
        if (na !== null && nb !== null) return na - nb;
        return a[0].localeCompare(b[0]);
      });
      return { key: filterCfg.key, label: filterCfg.label, options, extractFn: filterCfg.extractFn };
    }).filter((g) => g.options.length > 0);
  }, [categoryParam, getSpecValue]);

  const toggleSpec = (specKey: string, val: string) => {
    setSelectedSpecs((prev) => {
      const current = prev[specKey] || [];
      const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
      return { ...prev, [specKey]: next };
    });
    setPage(1);
  };

  const filtered = useMemo(() => {
    let result = [...products];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          Object.values(p.specs).some((v) => v.toLowerCase().includes(q))
      );
    }
    if (categoryParam) result = result.filter((p) => p.category === categoryParam);
    if (selectedPriceRanges.length > 0) {
      result = result.filter((p) =>
        selectedPriceRanges.some((idx) => {
          const r = priceRanges[idx];
          return p.price >= r.min && p.price < (r.max === Infinity ? Infinity : r.max);
        })
      );
    }
    if (selectedBrands.length > 0) result = result.filter((p) => selectedBrands.includes(p.brand));

    // Apply category-specific spec filters
    if (categoryParam && categorySpecFilters[categoryParam]) {
      for (const filterCfg of categorySpecFilters[categoryParam]) {
        const selected = selectedSpecs[filterCfg.key];
        if (selected && selected.length > 0) {
          result = result.filter((p) => {
            const val = getSpecValue(p, filterCfg);
            return val ? selected.includes(val) : false;
          });
        }
      }
    }

    switch (sort) {
      case "price-asc": result.sort((a, b) => a.price - b.price); break;
      case "price-desc": result.sort((a, b) => b.price - a.price); break;
      case "name-asc": result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "name-desc": result.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "rating": result.sort((a, b) => b.rating - a.rating); break;
    }
    return result;
  }, [categoryParam, searchQuery, sort, selectedPriceRanges, selectedBrands, selectedSpecs, getSpecValue]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
    setPage(1);
  };

  const togglePriceRange = (idx: number) => {
    setSelectedPriceRanges((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
    setPage(1);
  };

  const FilterPanel = () => (
    <div className="space-y-0">
      {/* Header */}
      <div className="border border-border bg-card px-4 py-3 text-center text-sm font-bold uppercase tracking-wider text-card-foreground">
        Lọc sản phẩm
      </div>

      {/* Categories */}
      <div className="border border-t-0 border-border bg-card px-4 py-4">
        <h3 className="mb-3 text-sm font-bold text-foreground">Linh kiện máy tính</h3>
        <div className="flex flex-col gap-0.5">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                const newParams = new URLSearchParams();
                newParams.set("category", c.id);
                setSearchParams(newParams);
                setPage(1);
              }}
              className={`flex items-center gap-1.5 rounded px-1 py-1.5 text-left text-sm transition-colors ${
                categoryParam === c.id
                  ? "font-semibold text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              <ChevronRight className="h-3 w-3 shrink-0" />
              <ChevronRight className="-ml-2.5 h-3 w-3 shrink-0" />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="border border-t-0 border-border bg-card px-4 py-4">
        <h3 className="mb-3 text-sm font-bold uppercase text-foreground">Khoảng giá</h3>
        <div className="space-y-1.5">
          {priceRanges.map((r, idx) => (
            <label key={idx} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Checkbox
                checked={selectedPriceRanges.includes(idx)}
                onCheckedChange={() => togglePriceRange(idx)}
              />
              <span>{r.label}</span>
              <span className="text-xs text-muted-foreground">({priceRangeCounts[idx]})</span>
            </label>
          ))}
        </div>
      </div>

      {/* Brands */}
      <div className="border border-t-0 border-border bg-card px-4 py-4">
        <h3 className="mb-3 text-sm font-bold uppercase text-foreground">Thương hiệu</h3>
        <div className="space-y-1.5">
          {allBrands.map((brand) => (
            <label key={brand} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Checkbox
                checked={selectedBrands.includes(brand)}
                onCheckedChange={() => toggleBrand(brand)}
              />
              <span>{brand}</span>
              <span className="text-xs text-muted-foreground">({brandCounts[brand] || 0})</span>
            </label>
          ))}
        </div>
      </div>

      {/* Category-specific spec filters */}
      {specFilterGroups.map((group) => (
        <div key={group.key} className="border border-t-0 border-border bg-card px-4 py-4">
          <h3 className="mb-3 text-sm font-bold uppercase text-foreground">{group.label}</h3>
          <div className="space-y-1.5">
            {group.options.map(([val, count]) => (
              <label key={val} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Checkbox
                  checked={(selectedSpecs[group.key] || []).includes(val)}
                  onCheckedChange={() => toggleSpec(group.key, val)}
                />
                <span>{val}</span>
                <span className="text-xs text-muted-foreground">({count})</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">Trang chủ</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">
          {searchQuery
            ? `Tìm kiếm "${searchQuery}"`
            : categoryParam
              ? categories.find((c) => c.id === categoryParam)?.name
              : "Tất cả sản phẩm"}
        </span>
      </nav>

      <div className="flex gap-6">
        {/* Desktop filter sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <FilterPanel />
        </aside>

        <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/30 p-4">
          {/* Top bar */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-bold">Tìm thấy {filtered.length} sản phẩm</p>
            <div className="flex items-center gap-2">
              {/* Mobile filter */}
              <Sheet>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal className="mr-2 h-4 w-4" /> Bộ lọc
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 overflow-y-auto bg-background">
                  <div className="mt-6"><FilterPanel /></div>
                </SheetContent>
              </Sheet>
              <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Tên A-Z</SelectItem>
                  <SelectItem value="name-desc">Tên Z-A</SelectItem>
                  <SelectItem value="price-asc">Giá tăng dần</SelectItem>
                  <SelectItem value="price-desc">Giá giảm dần</SelectItem>
                  <SelectItem value="rating">Đánh giá cao</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Products grid */}
          {paged.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4">
                {paged.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    &laquo;
                  </Button>

                  {(() => {
                    const pages: (number | string)[] = [];
                    if (totalPages <= 9) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i);
                    } else {
                      // Always show first 3
                      for (let i = 1; i <= 3; i++) pages.push(i);
                      if (page > 5) pages.push("...");
                      // Middle pages around current
                      const start = Math.max(4, page - 1);
                      const end = Math.min(totalPages - 3, page + 1);
                      for (let i = start; i <= end; i++) pages.push(i);
                      if (page < totalPages - 4) pages.push("...");
                      // Always show last 3
                      for (let i = totalPages - 2; i <= totalPages; i++) pages.push(i);
                    }
                    return pages.map((p, idx) =>
                      typeof p === "string" ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">…</span>
                      ) : (
                        <Button
                          key={p}
                          size="sm"
                          variant={page === p ? "default" : "outline"}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </Button>
                      )
                    );
                  })()}

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    &raquo;
                  </Button>
                </div>
              )}
            </>
          ) : (
            <EmptyState title="Không tìm thấy sản phẩm" description="Thử thay đổi bộ lọc để xem thêm sản phẩm." />
          )}
        </div>
      </div>
    </div>
  );
}
