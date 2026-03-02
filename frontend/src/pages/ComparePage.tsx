import { useState, useMemo } from "react";
import { X, Plus, RotateCcw, Search, ChevronRight, Check } from "lucide-react";
import { products } from "@/data/products";
import { categories } from "@/data/categories";
import { Product } from "@/types/product.types";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import EmptyState from "@/components/shared/EmptyState";

const categoryEmoji: Record<string, string> = {
  cpu: "🔲", vga: "🎮", mainboard: "🔌", ram: "💾", ssd: "💿", psu: "⚡", case: "🖥", cooler: "❄️",
};

const categoryFilterSpecs: Record<string, string[]> = {
  cpu: ["Socket", "Cores"],
  mainboard: ["Socket", "Chipset", "Form Factor"],
  vga: [],
  ram: [],
  ssd: [],
  psu: [],
  case: ["Form Factor"],
  cooler: [],
};

export default function ComparePage() {
  document.title = "So sánh sản phẩm - PCShop";
  const [compareIds, setCompareIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("pc-store-compare");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string[]>>({});
  const [stockOnly, setStockOnly] = useState(false);

  const compareProducts = useMemo(() => compareIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[], [compareIds]);

  // Auto-detect locked category from first selected product
  const lockedCategory = useMemo(() => {
    if (compareProducts.length === 0) return null;
    return compareProducts[0].category;
  }, [compareProducts]);

  const lockedCategoryName = useMemo(() => {
    if (!lockedCategory) return "";
    const cat = categories.find((c) => c.id === lockedCategory);
    return cat ? cat.name : lockedCategory;
  }, [lockedCategory]);

  const addToCompare = (id: string) => {
    if (compareIds.length >= 4) return;
    const next = [...compareIds, id];
    setCompareIds(next);
    localStorage.setItem("pc-store-compare", JSON.stringify(next));
    setDialogOpen(false);
    clearAllFilters();
  };

  const removeFromCompare = (id: string) => {
    const next = compareIds.filter((i) => i !== id);
    setCompareIds(next);
    localStorage.setItem("pc-store-compare", JSON.stringify(next));
  };

  const handleReset = () => {
    setCompareIds([]);
    localStorage.removeItem("pc-store-compare");
    clearAllFilters();
  };

  const clearAllFilters = () => {
    setSearchFilter("");
    setSelectedBrands([]);
    setSelectedSpecs({});
    setStockOnly(false);
  };

  const hasActiveFilters = selectedBrands.length > 0 || Object.values(selectedSpecs).some(v => v.length > 0) || stockOnly;

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev => prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]);
  };

  const toggleSpec = (specKey: string, val: string) => {
    setSelectedSpecs(prev => {
      const current = prev[specKey] || [];
      const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
      return { ...prev, [specKey]: next };
    });
  };

  const allSpecKeys = useMemo(() => {
    const keys = new Set<string>();
    compareProducts.forEach((p) => Object.keys(p.specs).forEach((k) => keys.add(k)));
    return [...keys];
  }, [compareProducts]);

  // All products available for the dialog (same category or all)
  const allDialogProducts = useMemo(() => {
    let filtered = products.filter((p) => !compareIds.includes(p.id));
    if (lockedCategory) filtered = filtered.filter((p) => p.category === lockedCategory);
    return filtered;
  }, [compareIds, lockedCategory]);

  // Brands with counts
  const brandOptions = useMemo(() => {
    const map = new Map<string, number>();
    allDialogProducts.forEach(p => map.set(p.brand, (map.get(p.brand) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allDialogProducts]);

  // Spec filter options with counts
  const specFilterOptions = useMemo(() => {
    const catKey = lockedCategory || "";
    const specKeys = categoryFilterSpecs[catKey] || [];
    const result: Record<string, [string, number][]> = {};
    for (const key of specKeys) {
      const map = new Map<string, number>();
      allDialogProducts.forEach(p => {
        const val = p.specs[key];
        if (val) map.set(String(val), (map.get(String(val)) || 0) + 1);
      });
      if (map.size > 1) {
        result[key] = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      }
    }
    return result;
  }, [allDialogProducts, lockedCategory]);

  // Filtered products for dialog display
  const availableProducts = useMemo(() => {
    let filtered = allDialogProducts;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) ||
        Object.values(p.specs).some(v => String(v).toLowerCase().includes(q))
      );
    }
    if (selectedBrands.length > 0) {
      filtered = filtered.filter(p => selectedBrands.includes(p.brand));
    }
    for (const [specKey, specVals] of Object.entries(selectedSpecs)) {
      if (specVals.length > 0) {
        filtered = filtered.filter(p => specVals.includes(String(p.specs[specKey] || "")));
      }
    }
    if (stockOnly) {
      filtered = filtered.filter(p => p.stock > 0);
    }
    return filtered;
  }, [allDialogProducts, searchFilter, selectedBrands, selectedSpecs, stockOnly]);

  // Shared dialog content (used in both empty state and main view)
  const renderDialogContent = () => (
    <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-6xl p-0">
      {/* Header */}
      <div className="border-b border-border bg-primary px-6 py-3">
        <DialogHeader>
          <DialogTitle className="text-primary-foreground">
            {lockedCategory ? `Chọn sản phẩm — ${lockedCategoryName}` : "Chọn sản phẩm so sánh"}
          </DialogTitle>
        </DialogHeader>
      </div>

      {/* Search & sort bar */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Bạn cần tìm sản phẩm gì?"
            className="pl-10"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="destructive" size="sm" onClick={clearAllFilters}>
            Xóa bộ lọc
          </Button>
        )}
        <span className="text-sm text-muted-foreground whitespace-nowrap">{availableProducts.length} sản phẩm</span>
      </div>

      {/* Content: Filter sidebar + Product list */}
      <div className="flex" style={{ maxHeight: "calc(85vh - 140px)" }}>
        {/* Filter sidebar */}
        <div className="w-[220px] shrink-0 overflow-y-auto border-r border-border p-4 space-y-5">
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">Hãng sản xuất</h4>
            <div className="space-y-1.5">
              {brandOptions.map(([brand, count]) => (
                <label key={brand} className="flex cursor-pointer items-center gap-2 text-sm text-foreground hover:text-primary">
                  <Checkbox
                    checked={selectedBrands.includes(brand)}
                    onCheckedChange={() => toggleBrand(brand)}
                    className="h-3.5 w-3.5"
                  />
                  <span>{brand}</span>
                  <span className="ml-auto text-xs text-muted-foreground">({count})</span>
                </label>
              ))}
            </div>
          </div>

          {Object.entries(specFilterOptions).map(([specKey, options]) => (
            <div key={specKey}>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">{specKey}</h4>
              <div className="space-y-1.5">
                {options.map(([val, count]) => (
                  <label key={val} className="flex cursor-pointer items-center gap-2 text-sm text-foreground hover:text-primary">
                    <Checkbox
                      checked={(selectedSpecs[specKey] || []).includes(val)}
                      onCheckedChange={() => toggleSpec(specKey, val)}
                      className="h-3.5 w-3.5"
                    />
                    <span>{val}</span>
                    <span className="ml-auto text-xs text-muted-foreground">({count})</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">Tình trạng</h4>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground hover:text-primary">
              <Checkbox
                checked={stockOnly}
                onCheckedChange={(v) => setStockOnly(!!v)}
                className="h-3.5 w-3.5"
              />
              <span>Còn hàng</span>
              <span className="ml-auto text-xs text-muted-foreground">
                ({allDialogProducts.filter(p => p.stock > 0).length})
              </span>
            </label>
          </div>
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          <div className="divide-y divide-border">
            {availableProducts.map((p) => {
              const specsStr = Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join(", ");
              return (
                <div key={p.id} className="flex items-start gap-4 py-4">
                  {/* Product image/icon */}
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-3xl">
                    {categoryEmoji[p.category] || "📦"}
                  </div>

                  {/* Product details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold uppercase leading-snug text-foreground">
                      {p.name}
                      {p.specs["Socket"] && ` - SOCKET ${p.specs["Socket"]}`}
                    </h3>
                    <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">Mã SP:</span> {p.id.toUpperCase()}
                      </p>
                      <p className="line-clamp-1">
                        <span className="font-medium text-foreground">Thông số:</span> {specsStr}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Bảo hành:</span> 36 Tháng
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Kho hàng:</span>{" "}
                        {p.stock > 0 ? (
                          <span className="font-semibold text-green-600 dark:text-green-400">Còn hàng ({p.stock})</span>
                        ) : (
                          <span className="font-semibold text-red-500">Liên hệ</span>
                        )}
                      </p>
                    </div>
                    <p className="mt-1.5 text-base font-bold text-primary">
                      {formatPrice(p.price)}
                      {p.originalPrice && p.originalPrice > p.price && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground line-through">
                          {formatPrice(p.originalPrice)}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Action button */}
                  <div className="shrink-0 pt-2">
                    <Button
                      size="sm"
                      onClick={() => addToCompare(p.id)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap"
                    >
                      THÊM SO SÁNH <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {availableProducts.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">Không tìm thấy sản phẩm phù hợp</p>
                {hasActiveFilters && (
                  <Button variant="link" className="mt-2" onClick={clearAllFilters}>Xóa bộ lọc</Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DialogContent>
  );

  if (compareProducts.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <EmptyState
          title="Chưa có sản phẩm so sánh"
          description="Thêm sản phẩm để so sánh thông số kỹ thuật. Các sản phẩm so sánh phải cùng danh mục."
          action={
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) clearAllFilters(); }}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> Thêm sản phẩm</Button>
              </DialogTrigger>
              {renderDialogContent()}
            </Dialog>
          }
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">So sánh sản phẩm</h1>
          {lockedCategory && (
            <p className="text-sm text-muted-foreground mt-1">Danh mục: <span className="font-medium text-primary">{lockedCategoryName}</span></p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" /> Làm mới
          </Button>
          {compareIds.length < 4 && (
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) clearAllFilters(); }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> Thêm</Button>
              </DialogTrigger>
              {renderDialogContent()}
            </Dialog>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr>
              <th className="w-40 p-3 text-left text-sm font-medium text-muted-foreground">Thông số</th>
              {compareProducts.map((p) => (
                <th key={p.id} className="p-3">
                  <div className="flex flex-col items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6 self-end text-muted-foreground" onClick={() => removeFromCompare(p.id)}><X className="h-3 w-3" /></Button>
                    <p className="text-sm font-semibold text-foreground text-center">{p.name}</p>
                    <p className="text-sm font-bold text-primary">{formatPrice(p.price)}</p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allSpecKeys.map((key, i) => (
              <tr key={key} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                <td className="p-3 text-sm font-medium text-muted-foreground">{key}</td>
                {compareProducts.map((p) => (
                  <td key={p.id} className="p-3 text-center text-sm text-foreground">{p.specs[key] || "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
