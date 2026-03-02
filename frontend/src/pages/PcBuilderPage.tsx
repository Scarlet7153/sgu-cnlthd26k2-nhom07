import { useState, useMemo, useEffect } from "react";
import { Plus, X, AlertTriangle, Check, Zap, Search, ChevronRight, Filter, Minus, Pencil, Trash2, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { products } from "@/data/products";
import { Product, CategoryType, PcBuildSlot } from "@/types/product.types";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

const categoryEmoji: Record<string, string> = {
  cpu: "🔲", vga: "🎮", mainboard: "🔌", ram: "💾", ssd: "💿", psu: "⚡", case: "🖥", cooler: "❄️",
};

// Spec keys to use as filter groups per category
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

const BUILD_SLOTS: PcBuildSlot[] = [
  { category: "cpu", label: "CPU - Bộ vi xử lý", required: true, product: null },
  { category: "mainboard", label: "Mainboard - Bo mạch chủ", required: true, product: null },
  { category: "vga", label: "VGA - Card đồ họa", required: true, product: null },
  { category: "ram", label: "RAM - Bộ nhớ", required: true, product: null },
  { category: "ssd", label: "SSD - Ổ cứng", required: true, product: null },
  { category: "psu", label: "PSU - Nguồn", required: true, product: null },
  { category: "case", label: "Case - Vỏ máy tính", required: false, product: null },
  { category: "cooler", label: "Tản nhiệt", required: false, product: null },
];

const STORAGE_KEY = "pc-builder-config";

function loadSavedConfig(): { slots: PcBuildSlot[]; quantities: Record<string, number> } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return { slots: BUILD_SLOTS, quantities: {} };
    const restoredSlots = BUILD_SLOTS.map(slot => {
      const savedId = saved.products?.[slot.category];
      const product = savedId ? products.find(p => p.id === savedId) || null : null;
      return { ...slot, product };
    });
    return { slots: restoredSlots, quantities: saved.quantities || {} };
  } catch {
    return { slots: BUILD_SLOTS, quantities: {} };
  }
}

export default function PcBuilderPage() {
  document.title = "PC Builder - TechPC";
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [slots, setSlots] = useState<PcBuildSlot[]>(() => loadSavedConfig().slots);
  const [openCategory, setOpenCategory] = useState<CategoryType | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => loadSavedConfig().quantities);

  // Persist to localStorage
  useEffect(() => {
    const data = {
      products: Object.fromEntries(slots.map(s => [s.category, s.product?.id || null])),
      quantities,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [slots, quantities]);

  const getQty = (cat: string) => quantities[cat] || 1;
  const setQty = (cat: string, val: number) => setQuantities(prev => ({ ...prev, [cat]: Math.max(1, val) }));

  const selectProduct = (category: CategoryType, product: Product) => {
    setSlots((prev) => prev.map((s) => (s.category === category ? { ...s, product } : s)));
    if (!quantities[category]) setQuantities(prev => ({ ...prev, [category]: 1 }));
    setOpenCategory(null);
  };

  const removeProduct = (category: CategoryType) => {
    setSlots((prev) => prev.map((s) => (s.category === category ? { ...s, product: null } : s)));
  };

  const totalPrice = useMemo(() => slots.reduce((sum, s) => sum + (s.product?.price ?? 0) * getQty(s.category), 0), [slots, quantities]);

  // Compatibility checks
  const warnings = useMemo(() => {
    const w: string[] = [];
    const cpu = slots.find((s) => s.category === "cpu")?.product;
    const mb = slots.find((s) => s.category === "mainboard")?.product;
    const psu = slots.find((s) => s.category === "psu")?.product;
    const vga = slots.find((s) => s.category === "vga")?.product;

    if (cpu && mb && "socket" in cpu && "socket" in mb) {
      if ((cpu as { socket: string }).socket !== (mb as { socket: string }).socket) {
        w.push(`⚠ CPU socket (${(cpu as { socket: string }).socket}) không tương thích với Mainboard (${(mb as { socket: string }).socket})`);
      }
    }

    if (psu && "wattage" in psu) {
      let totalTdp = 0;
      if (cpu && "tdp" in cpu) totalTdp += (cpu as { tdp: number }).tdp;
      if (vga && "tdp" in vga) totalTdp += (vga as { tdp: number }).tdp;
      if (totalTdp > 0 && totalTdp > (psu as { wattage: number }).wattage * 0.8) {
        w.push(`⚡ Tổng TDP ước tính (~${totalTdp}W) có thể vượt công suất an toàn của PSU (${(psu as { wattage: number }).wattage}W × 80%)`);
      }
    }

    return w;
  }, [slots]);

  const filledSlots = slots.filter((s) => s.product !== null).length;

  const handleAddAllToCart = () => {
    slots.forEach((s) => {
      if (s.product) {
        for (let i = 0; i < getQty(s.category); i++) addToCart(s.product);
      }
    });
    toast({ title: "Đã thêm cấu hình vào giỏ hàng!", description: `${filledSlots} linh kiện` });
  };

  const handleReset = () => {
    setSlots(BUILD_SLOTS);
    setQuantities({});
    localStorage.removeItem(STORAGE_KEY);
    toast({ title: "Đã làm mới cấu hình!" });
  };

  const [searchFilter, setSearchFilter] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string[]>>({});
  const [stockOnly, setStockOnly] = useState(false);

  // Socket compatibility constraint
  const compatibilityConstraint = useMemo(() => {
    if (!openCategory) return null;
    const cpuSlot = slots.find(s => s.category === "cpu")?.product;
    const mbSlot = slots.find(s => s.category === "mainboard")?.product;

    if (openCategory === "mainboard" && cpuSlot?.specs["Socket"]) {
      const socket = cpuSlot.specs["Socket"];
      return { message: `Chỉ hiện mainboard tương thích socket ${socket}`, filterFn: (p: Product) => p.specs["Socket"] === socket };
    }
    if (openCategory === "cpu" && mbSlot?.specs["Socket"]) {
      const socket = mbSlot.specs["Socket"];
      return { message: `Chỉ hiện CPU tương thích socket ${socket}`, filterFn: (p: Product) => p.specs["Socket"] === socket };
    }
    return null;
  }, [openCategory, slots]);

  // All products in the open category (with compatibility pre-filter)
  const allCategoryProducts = useMemo(
    () => {
      if (!openCategory) return [];
      let base = products.filter((p) => p.category === openCategory);
      if (compatibilityConstraint) base = base.filter(compatibilityConstraint.filterFn);
      return base;
    },
    [openCategory, compatibilityConstraint]
  );

  // Brands with counts
  const brandOptions = useMemo(() => {
    const map = new Map<string, number>();
    allCategoryProducts.forEach(p => map.set(p.brand, (map.get(p.brand) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allCategoryProducts]);

  // Spec filter options with counts
  const specFilterOptions = useMemo(() => {
    if (!openCategory) return {};
    const specKeys = categoryFilterSpecs[openCategory] || [];
    const result: Record<string, [string, number][]> = {};
    for (const key of specKeys) {
      const map = new Map<string, number>();
      allCategoryProducts.forEach(p => {
        const val = p.specs[key];
        if (val) map.set(String(val), (map.get(String(val)) || 0) + 1);
      });
      if (map.size > 1) {
        result[key] = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      }
    }
    return result;
  }, [allCategoryProducts, openCategory]);

  const categoryProducts = useMemo(
    () => {
      if (!openCategory) return [];
      let filtered = allCategoryProducts;
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
    },
    [openCategory, searchFilter, selectedBrands, selectedSpecs, stockOnly, allCategoryProducts]
  );

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

  const clearAllFilters = () => {
    setSelectedBrands([]);
    setSelectedSpecs({});
    setStockOnly(false);
    setSearchFilter("");
  };

  const hasActiveFilters = selectedBrands.length > 0 || Object.values(selectedSpecs).some(v => v.length > 0) || stockOnly;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">PC Builder</h1>
          <p className="text-muted-foreground">Xây dựng cấu hình PC của riêng bạn</p>
        </div>
        {filledSlots > 0 && (
          <Button variant="outline" size="sm" onClick={handleReset} className="text-destructive border-destructive/30 hover:bg-destructive/10">
            <RotateCcw className="mr-1.5 h-4 w-4" /> Làm mới
          </Button>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-6 space-y-2">
          {warnings.map((w, i) => (
            <Alert key={i} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{w}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Slots */}
        <div className="lg:col-span-2 space-y-0 divide-y divide-border rounded-lg border border-border bg-card">
          {slots.map((slot) => (
            <div key={slot.category} className="p-4">
              {slot.product ? (
                <div className="flex items-start gap-4">
                  {/* Product icon */}
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-border bg-muted/30 text-2xl">
                    {categoryEmoji[slot.category] || "📦"}
                  </div>

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${slot.product.id}`} target="_blank" className="hover:text-primary hover:underline">
                      <h3 className="text-sm font-bold uppercase leading-snug text-foreground transition-colors hover:text-primary">{slot.product.name}</h3>
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      - Kho hàng: {slot.product.stock > 0 ? (
                        <span className="font-semibold text-green-600 dark:text-green-400">Còn hàng</span>
                      ) : (
                        <span className="font-semibold text-red-500">Hết hàng</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">- Bảo hành: <span className="font-semibold text-foreground">36 Tháng</span></p>
                  </div>

                  {/* Price × Qty = Subtotal */}
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-bold text-primary whitespace-nowrap">{formatPrice(slot.product.price)}</span>
                    <span className="text-xs text-muted-foreground">x</span>

                    {/* Quantity selector */}
                    <div className="flex items-center rounded border border-border">
                      <button
                        onClick={() => setQty(slot.category, getQty(slot.category) - 1)}
                        className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="flex h-7 w-8 items-center justify-center border-x border-border text-xs font-medium">
                        {getQty(slot.category)}
                      </span>
                      <button
                        onClick={() => setQty(slot.category, getQty(slot.category) + 1)}
                        className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <span className="text-xs text-muted-foreground">=</span>
                    <span className="text-sm font-bold text-primary whitespace-nowrap w-28 text-right">
                      {formatPrice(slot.product.price * getQty(slot.category))}
                    </span>

                    {/* Edit & Delete */}
                    <button
                      onClick={() => setOpenCategory(slot.category)}
                      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-primary transition-colors"
                      title="Đổi linh kiện"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeProduct(slot.category)}
                      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-500 transition-colors"
                      title="Xóa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    {slot.label} {slot.required && <span className="text-destructive">*</span>}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setOpenCategory(slot.category)}>
                    <Plus className="mr-1 h-3 w-3" /> Chọn
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="h-fit rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">Tóm tắt cấu hình</h2>
          <div className="space-y-2 text-sm">
            {slots.filter((s) => s.product).map((s) => (
              <div key={s.category} className="flex justify-between text-muted-foreground">
                <span className="line-clamp-1 flex-1">{s.label} {getQty(s.category) > 1 && `x${getQty(s.category)}`}</span>
                <span className="ml-2 shrink-0 text-foreground">{formatPrice(s.product!.price * getQty(s.category))}</span>
              </div>
            ))}
            {filledSlots === 0 && <p className="text-muted-foreground text-center py-4">Chưa chọn linh kiện nào</p>}
            <div className="border-t border-border pt-3">
              <div className="flex justify-between text-base font-bold">
                <span className="text-foreground">Tổng cộng</span>
                <span className="text-primary">{formatPrice(totalPrice)}</span>
              </div>
            </div>
          </div>
          {filledSlots > 0 && (
            <Button onClick={handleAddAllToCart} className="mt-6 w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-primary-sm" disabled={warnings.length > 0}>
              Thêm tất cả vào giỏ hàng
            </Button>
          )}
          {warnings.length > 0 && filledSlots > 0 && (
            <p className="mt-2 text-xs text-center text-destructive">Hãy sửa lỗi tương thích trước khi thêm vào giỏ</p>
          )}
        </div>
      </div>

      {/* Product selection dialog */}
      <Dialog open={!!openCategory} onOpenChange={() => { setOpenCategory(null); clearAllFilters(); }}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-6xl p-0">
          {/* Header */}
          <div className="border-b border-border bg-primary px-6 py-3">
            <DialogHeader>
              <DialogTitle className="text-primary-foreground">
                Chọn {slots.find((s) => s.category === openCategory)?.label}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Compatibility notice */}
          {compatibilityConstraint && (
            <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 dark:border-amber-800/50 dark:bg-amber-950/40">
              <span className="text-sm">🔗</span>
              <span className="text-sm font-medium text-amber-800 dark:text-amber-300">{compatibilityConstraint.message}</span>
            </div>
          )}

          {/* Search & sort bar */}
          <div className="flex items-center gap-3 border-b border-border px-6 py-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Bạn cần tìm linh kiện gì?"
                className="pl-10"
              />
            </div>
            {hasActiveFilters && (
              <Button variant="destructive" size="sm" onClick={clearAllFilters}>
                Xóa bộ lọc
              </Button>
            )}
            <span className="text-sm text-muted-foreground whitespace-nowrap">{categoryProducts.length} sản phẩm</span>
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
                    ({allCategoryProducts.filter(p => p.stock > 0).length})
                  </span>
                </label>
              </div>
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="divide-y divide-border">
              {categoryProducts.map((p) => {
                const specsStr = Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join(", ");
                const isSelected = slots.find(s => s.category === openCategory)?.product?.id === p.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-start gap-4 py-4 ${isSelected ? "bg-primary/5 -mx-2 px-2 rounded-lg" : ""}`}
                  >
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
                      {isSelected ? (
                        <Button variant="outline" size="sm" className="border-green-500 text-green-600" disabled>
                          <Check className="mr-1.5 h-4 w-4" /> Đã chọn
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => selectProduct(openCategory!, p)}
                          disabled={p.stock === 0}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap"
                        >
                          THÊM VÀO CẤU HÌNH <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {categoryProducts.length === 0 && (
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
      </Dialog>
    </div>
  );
}
