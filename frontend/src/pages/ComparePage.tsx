import { useState, useMemo } from "react";
import { X, Plus, RotateCcw, Search, ChevronRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { CategoryType, Product } from "@/types/product.types";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";

const categoryEmoji: Record<string, string> = {
  cpu: "🔲", vga: "🎮", mainboard: "🔌", ram: "💾", ssd: "💿", psu: "⚡", case: "🖥", cooler: "❄️",
};

type FilterSpecConfig = {
  key: string;
  label: string;
  extractFn?: (p: Product) => string | null;
};

const GPU_SERIES_OPTIONS = [
  "RTX 3000 Series",
  "RTX 4000 Series",
  "RTX 5000 Series",
  "RX 9000 Series",
  "RX 7000 Series",
  "RX 6000 Series",
  "RX 5000 Series",
];

const PSU_80_PLUS_OPTIONS = [
  "80 Plus",
  "80 Plus White",
  "80 Plus Bronze",
  "80 Plus Silver",
  "80 Plus Gold",
  "80 Plus Platinum",
  "80 Plus Titanium",
  "Khác",
];

const PSU_WATTAGE_SEGMENTS = [
  "Dưới 550W",
  "550W - 650W",
  "650W - 750W",
  "750W - 850W",
  "850W - 1000W",
  "Trên 1000W",
];

const CASE_SIZE_OPTIONS = [
  "Cỡ siêu nhỏ",
  "Cỡ nhỏ",
  "Cỡ vừa",
  "Cỡ lớn",
  "Cỡ siêu lớn",
];

const mapPsuWattageToSegment = (wattage: number): string => {
  if (wattage < 550) return "Dưới 550W";
  if (wattage <= 650) return "550W - 650W";
  if (wattage <= 750) return "650W - 750W";
  if (wattage <= 850) return "750W - 850W";
  if (wattage <= 1000) return "850W - 1000W";
  return "Trên 1000W";
};

const extractPsuWattage = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const wattMatch = raw.match(/(\d{2,4}(?:\.\d+)?)\s*W\b/i);
  if (wattMatch?.[1]) return Number(wattMatch[1]);
  if (/^\d{2,4}(?:\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (n >= 200 && n <= 2500) return n;
  }
  return null;
};

const categoryFilterSpecs: Record<string, FilterSpecConfig[]> = {
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
    {
      key: "Socket", label: "Socket", extractFn: (p) => {
        const topSocket = (p as any).socket;
        if (topSocket) return String(topSocket);
        const tryKeys = ["Socket", "Socket Type", "Khe cắm", "Khe cắm CPU", "Socket/CPU"];
        for (const k of tryKeys) if (p.specs[k]) return String(p.specs[k]);
        for (const [k, v] of Object.entries(p.specs || {})) {
          const nk = String(k).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
          if (nk.includes("socket") || nk.includes("khecam") || nk.includes("sockettype")) return String(v);
        }
        return null;
      },
    },
    { key: "Kích thước", label: "Form Factor", extractFn: (p) => p.specs["Kích thước"] || p.specs["Form Factor"] || null },
  ],
  vga: [
    {
      key: "_gpuSeries", label: "Series", extractFn: (p) => {
        const n = p.name.toUpperCase();
        if (n.includes("RTX 30")) return "RTX 3000 Series";
        if (n.includes("RTX 40")) return "RTX 4000 Series";
        if (n.includes("RTX 50")) return "RTX 5000 Series";
        if (n.includes("RX 9")) return "RX 9000 Series";
        if (n.includes("RX 7")) return "RX 7000 Series";
        if (n.includes("RX 6")) return "RX 6000 Series";
        if (n.includes("RX 5")) return "RX 5000 Series";
        return null;
      },
    },
    { key: "Dung lượng", label: "Bộ nhớ VRAM", extractFn: (p) => p.specs["Dung lượng"] || null },
  ],
  ram: [
    { key: "Thế hệ", label: "Loại RAM", extractFn: (p) => p.specs["Thế hệ"] || null },
    {
      key: "_ramCapacity", label: "Dung lượng RAM", extractFn: (p) => {
        const topCap = (p as any).capacity_gb ?? (p as any).capacity;
        const specCap = p.specs["capacity_gb"] ?? p.specs["capacity"] ?? p.specs["Dung lượng"] ?? p.specs["Capacity"];
        const nameCap = p.name.match(/(\d+)\s*GB/i)?.[1] ?? null;
        const cap = topCap ?? specCap ?? nameCap;
        if (cap === null || cap === undefined) return null;
        const asStr = String(cap).trim();
        if (/^\d+$/.test(asStr)) return `${asStr} GB`;
        if (/^\d+\s*gb$/i.test(asStr)) return asStr.replace(/\s+/g, " ").toUpperCase();
        const m = asStr.match(/(\d+(?:\.\d+)?)/);
        if (m) return `${m[1]} GB`;
        return asStr || null;
      },
    },
    { key: "Bus", label: "Bus" },
  ],
  harddisk: [
    {
      key: "_storageCapacity", label: "Dung lượng", extractFn: (p) => {
        let raw: unknown = p.specs["Dung lượng"];
        if (raw === undefined || raw === null) {
          for (const [k, v] of Object.entries(p.specs || {})) {
            const nk = String(k).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
            if (nk.includes("dungluong") || nk.includes("capacity")) {
              raw = v;
              break;
            }
          }
        }
        if (raw === null || raw === undefined) return null;
        const asStr = String(raw).trim();
        if (/^\d+(?:\.\d+)?\s*(TB|GB)$/i.test(asStr)) {
          const m = asStr.match(/^(\d+(?:\.\d+)?)\s*(TB|GB)$/i);
          if (m) return `${m[1]} ${m[2].toUpperCase()}`;
        }
        return asStr || null;
      },
    },
    { key: "Kết nối", label: "Chuẩn kết nối", extractFn: (p) => p.specs["Kết nối"] || null },
  ],
  psu: [
    {
      key: "_psuWattage", label: "Công suất (W)", extractFn: (p) => {
        const candidates: unknown[] = [];
        candidates.push((p as any).wattage, (p as any).tdpW, (p as any).power);
        candidates.push(p.specs["Công suất"], p.specs["Wattage"], p.specs["Power"], p.specs["Công suất danh định"], p.specs["Rated Power"]);
        for (const val of Object.values(p.specs || {})) candidates.push(val);
        candidates.push(p.name);
        for (const candidate of candidates) {
          const wattage = extractPsuWattage(candidate);
          if (wattage !== null) return mapPsuWattageToSegment(wattage);
        }
        return null;
      },
    },
    {
      key: "_psuEfficiencyTier", label: "Chuẩn 80 Plus", extractFn: (p) => {
        const candidates: string[] = [p.name];
        for (const [k, v] of Object.entries(p.specs || {})) {
          if (typeof v !== "string") continue;
          const nk = String(k).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
          if (nk.includes("hieusuat") || nk.includes("efficiency") || nk.includes("80plus")) candidates.push(v);
        }
        const source = candidates.join(" ").toLowerCase();
        if (!source.includes("80")) return "Khác";
        if (source.includes("titanium")) return "80 Plus Titanium";
        if (source.includes("platinum")) return "80 Plus Platinum";
        if (source.includes("gold")) return "80 Plus Gold";
        if (source.includes("silver")) return "80 Plus Silver";
        if (source.includes("bronze")) return "80 Plus Bronze";
        if (source.includes("white")) return "80 Plus White";
        if (source.includes("basic") || source.includes("standard") || source.includes("80 plus") || source.includes("80+")) return "80 Plus";
        return "Khác";
      },
    },
  ],
  case: [
    {
      key: "_caseSize", label: "Kích cỡ case", extractFn: (p) => {
        const vals: string[] = [p.name];
        const specKeys = ["Kích thước", "Form Factor", "Case Size", "Loại case"];
        for (const k of specKeys) {
          const v = p.specs[k];
          if (typeof v === "string") vals.push(v);
        }
        const s = vals.join(" ").toLowerCase();
        if (s.includes("full tower")) return "Cỡ lớn";
        if (s.includes("mid tower")) return "Cỡ vừa";
        if (s.includes("mini tower")) return "Cỡ nhỏ";
        if (s.includes("micro tower")) return "Cỡ siêu nhỏ";
        if (s.includes("super tower")) return "Cỡ siêu lớn";
        return null;
      },
    },
    { key: "Hỗ trợ Mainboard", label: "Hỗ trợ Mainboard", extractFn: (p) => p.specs["Hỗ trợ Mainboard"] || null },
  ],
  cooler: [
    {
      key: "_coolerType", label: "Loại tản nhiệt", extractFn: (p) => {
        const t = String(p.specs["Loại tản nhiệt"] || p.name).toLowerCase();
        if (t.includes("aio") || t.includes("nước")) return "Tản nước AIO";
        if (t.includes("air") || t.includes("khí")) return "Tản khí (Air)";
        return p.specs["Loại tản nhiệt"] || null;
      },
    },
  ],
};

export default function ComparePage() {
  document.title = "So sánh sản phẩm - PCShop";
  const { data: productsData, isLoading } = useProducts({ size: 500, fetchAll: true });
  const { data: menuCategories = [] } = useCategories();
  const products = productsData?.content || [];

  const [compareIds, setCompareIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("pc-store-compare");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedDialogCategory, setSelectedDialogCategory] = useState<CategoryType | "all">("all");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string[]>>({});
  const [stockOnly, setStockOnly] = useState(false);

  const compareProducts = useMemo(() => compareIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[], [compareIds, products]);

  // Auto-detect locked category from first selected product
  const lockedCategory = useMemo(() => {
    if (compareProducts.length === 0) return null;
    return compareProducts[0].category;
  }, [compareProducts]);

  const lockedCategoryName = useMemo(() => {
    if (!lockedCategory) return "";
    const cat = menuCategories.find((c) => c.id === lockedCategory);
    return cat ? cat.name : lockedCategory;
  }, [lockedCategory, menuCategories]);

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
    setSelectedDialogCategory("all");
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

  const formatSpecValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    const raw = String(value).trim();
    if (!raw) return "—";

    return raw
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/&lt;br\s*\/?\s*&gt;/gi, "\n");
  };

  const effectiveDialogCategory = lockedCategory || (selectedDialogCategory === "all" ? null : selectedDialogCategory);

  const categoryOptions = useMemo(() => {
    const base = products.filter((p) => !compareIds.includes(p.id));
    return menuCategories
      .map((c) => ({ id: c.id, name: c.name, count: base.filter((p) => p.category === c.id).length }));
  }, [products, compareIds, menuCategories]);

  // All products available for the dialog (same category or all)
  const allDialogProducts = useMemo(() => {
    let filtered = products.filter((p) => !compareIds.includes(p.id));
    if (effectiveDialogCategory) filtered = filtered.filter((p) => p.category === effectiveDialogCategory);
    return filtered;
  }, [compareIds, effectiveDialogCategory, products]);

  // Brands with counts
  const brandOptions = useMemo(() => {
    const map = new Map<string, number>();
    allDialogProducts.forEach(p => map.set(p.brand, (map.get(p.brand) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allDialogProducts]);

  const getSpecValue = (p: Product, filterCfg: FilterSpecConfig): string | null => {
    if (filterCfg.extractFn) return filterCfg.extractFn(p);
    return p.specs[filterCfg.key] || null;
  };

  // Spec filter options with counts
  const specFilterGroups = useMemo(() => {
    const catKey = effectiveDialogCategory || "";
    if (!catKey || !categoryFilterSpecs[catKey]) return [] as { key: string; label: string; options: [string, number][]; extractFn?: (p: Product) => string | null }[];

    const parseSize = (s: unknown): number | null => {
      if (s === null || s === undefined) return null;
      const m = String(s).match(/^([\d.]+)\s*(TB|GB|MB|W|MHz)$/i);
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

    return categoryFilterSpecs[catKey].map((cfg) => {
      const map = new Map<string, number>();
      allDialogProducts.forEach(p => {
        const val = getSpecValue(p, cfg);
        if (val !== null && val !== undefined) {
          const strVal = String(val);
          map.set(strVal, (map.get(strVal) || 0) + 1);
        }
      });

      let options = Array.from(map.entries()).sort((a, b) => {
        const na = parseSize(a[0]);
        const nb = parseSize(b[0]);
        if (na !== null && nb !== null) return na - nb;
        return String(a[0]).localeCompare(String(b[0]));
      });

      if (cfg.key === "_gpuSeries") {
        options = GPU_SERIES_OPTIONS.map((series) => [series, map.get(series) || 0] as [string, number]);
      }
      if (cfg.key === "_psuWattage") {
        options = PSU_WATTAGE_SEGMENTS.map((segment) => [segment, map.get(segment) || 0] as [string, number]);
      }
      if (cfg.key === "_psuEfficiencyTier") {
        options = PSU_80_PLUS_OPTIONS.map((tier) => [tier, map.get(tier) || 0] as [string, number]);
      }
      if (cfg.key === "_caseSize") {
        options = CASE_SIZE_OPTIONS.map((size) => [size, map.get(size) || 0] as [string, number]);
      }

      return { key: cfg.key, label: cfg.label, options, extractFn: cfg.extractFn };
    }).filter((g) => g.options.length > 0);
  }, [allDialogProducts, effectiveDialogCategory]);

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
    const cfgs = effectiveDialogCategory ? (categoryFilterSpecs[effectiveDialogCategory] || []) : [];
    for (const [specKey, specVals] of Object.entries(selectedSpecs)) {
      if (specVals.length === 0) continue;
      const cfg = cfgs.find((c) => c.key === specKey);
      if (!cfg) continue;
      filtered = filtered.filter((p) => {
        const val = getSpecValue(p, cfg);
        return val !== null && specVals.includes(String(val));
      });
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

      {!lockedCategory && (
        <div className="border-b border-border px-6 py-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">Danh mục</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categoryOptions.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedDialogCategory(cat.id as CategoryType)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selectedDialogCategory === cat.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary hover:text-primary"
                }`}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>
        </div>
      )}

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

          {specFilterGroups.map((group) => (
            <div key={group.key}>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">{group.label}</h4>
              <div className="space-y-1.5">
                {group.options.map(([val, count]) => (
                  <label key={val} className="flex cursor-pointer items-center gap-2 text-sm text-foreground hover:text-primary">
                    <Checkbox
                      checked={(selectedSpecs[group.key] || []).includes(val)}
                      onCheckedChange={() => toggleSpec(group.key, val)}
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
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
                    <img
                      src={p.images?.[0]}
                      alt={p.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = "https://placehold.co/160x160/png?text=No+Image";
                      }}
                    />
                  </div>

                  {/* Product details */}
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${p.id}`} target="_blank" className="hover:text-primary hover:underline">
                      <h3 className="text-sm font-bold uppercase leading-snug text-foreground transition-colors hover:text-primary">
                        {p.name}
                        {p.specs["Socket"] && ` - SOCKET ${p.specs["Socket"]}`}
                      </h3>
                    </Link>
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

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
                    <div className="relative mx-auto flex h-36 w-full max-w-[360px] flex-col items-center justify-between px-6 pt-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-6 w-6 text-muted-foreground"
                        onClick={() => removeFromCompare(p.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <Link to={`/product/${p.id}`} target="_blank" className="hover:text-primary hover:underline">
                        <p className="line-clamp-3 min-h-[72px] pt-5 text-center text-sm font-semibold leading-6 text-foreground transition-colors hover:text-primary">
                          {p.name}
                        </p>
                      </Link>
                      <p className="pb-1 text-sm font-bold text-primary">{formatPrice(p.price)}</p>
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
                  <td key={p.id} className="whitespace-pre-line break-words p-3 text-center text-sm text-foreground">
                    {formatSpecValue(p.specs[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
