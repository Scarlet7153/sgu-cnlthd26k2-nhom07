import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SlidersHorizontal, ChevronDown, ChevronRight } from "lucide-react";
import { CategoryType, SortOption } from "@/types/product.types";
import ProductCard from "@/components/shared/ProductCard";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { formatPrice } from "@/lib/format";
import { useProducts } from "@/hooks/useProducts";
import { useBrands } from "@/hooks/useBrands";
import { useCategories } from "@/hooks/useCategories";

const ITEMS_PER_PAGE = 16;

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

  // Prefer explicit wattage token, e.g. "700W" or "700 W"
  const wattMatch = raw.match(/(\d{2,4}(?:\.\d+)?)\s*W\b/i);
  if (wattMatch?.[1]) return Number(wattMatch[1]);

  // Then accept plain numeric fields if they look like PSU wattage
  if (/^\d{2,4}(?:\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (n >= 200 && n <= 2500) return n;
  }

  return null;
};

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
      { key: "Socket", label: "Socket", extractFn: (p) => {
        if (!p) return null;
        // Prefer explicit top-level `socket` field
        const topSocket = (p as any).socket;
        if (topSocket) return topSocket;

        // Then check common spec keys
        if (p.specs && typeof p.specs === 'object') {
          const tryKeys = ["Socket", "Socket Type", "Khe cắm", "Khe cắm CPU", "Socket/CPU", "Socket Type"];
          for (const k of tryKeys) {
            if (p.specs[k]) return p.specs[k];
          }
          for (const [k, v] of Object.entries(p.specs)) {
            if (typeof k !== 'string') continue;
            const nk = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if (nk.includes('socket') || nk.includes('khecam') || nk.includes('khecamcpu') || nk.includes('sockettype')) return v as any;
          }
        }

        // Fallback: infer common socket tokens from product name
        const name = String(p.name || '');
        const m = name.match(/(LGA\d+|AM\d+|AM4|LGA1700|LGA1200|s1700|s1151|TRX4)/i);
        return m ? m[0] : null;
      } },
    { key: "Ki╠üch th╞░╞í╠üc", label: "Form Factor", extractFn: (p) => p.specs["Ki╠üch th╞░╞í╠üc"] || p.specs["Kích thước"] || null },
  ],
  vga: [
    {
      key: "_gpuSeries",
      label: "Series",
      extractFn: (p) => {
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
    { key: "Dung l╞░╞í╠úng", label: "Bộ nhớ VRAM", extractFn: (p) => p.specs["Dung l╞░╞í╠úng"] || p.specs["Dung lượng"] || null },
  ],
  ram: [
    { key: "Th├¬╠ü h├¬╠ú", label: "Loại RAM", extractFn: (p) => p.specs["Th├¬╠ü h├¬╠ú"] || p.specs["Thế hệ"] || null },
    { key: "_ramCapacity", label: "Dung lượng RAM", extractFn: (p) => {
      if (!p) return null;
      // prefer top-level DB field capacity_gb then specs
      const topCap = (p as any)['capacity_gb'] ?? (p as any)['capacity'];
      const specCap = p.specs && typeof p.specs === 'object'
        ? p.specs['capacity_gb'] ?? p.specs['capacity'] ?? p.specs['Dung l╞░╞í╠úng'] ?? p.specs['Dung lượng'] ?? p.specs['Dung lượng (GB)'] ?? p.specs['Capacity']
        : undefined;
      const nameCap = typeof p.name === 'string' ? p.name.match(/(\d+)\s*GB/i)?.[1] : null;
      const cap = topCap ?? specCap ?? nameCap;
      if (cap === null || cap === undefined) return null;
      const asStr = String(cap).trim();
      // If numeric, append GB; if already contains GB, return normalized
      if (/^\d+$/.test(asStr)) return `${asStr} GB`;
      if (/^\d+\s*gb$/i.test(asStr)) return asStr.replace(/\s+/g, ' ').toUpperCase();
      // Try to extract numeric portion
      const m = asStr.match(/(\d+(?:\.\d+)?)/);
      if (m) return `${m[1]} GB`;
      return asStr;
    } },
    { key: "Bus", label: "Bus" },
  ],
  harddisk: [
    { key: "_storageCapacity", label: "Dung lượng", extractFn: (p) => {
      if (!p) return null;
      let raw: unknown = undefined;
      if (p.specs && typeof p.specs === 'object') {
        // Prefer exact key from specs_raw: "Dung lượng"
        raw = p.specs['Dung lượng'] ?? p.specs['Dung l╞░╞í╠úng'];

        // Fallback for mojibake / extra spaces in key names
        if (raw === undefined || raw === null) {
          for (const [k, v] of Object.entries(p.specs)) {
            const nk = String(k)
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-zA-Z0-9]/g, '')
              .toLowerCase();
            if (nk.includes('dungluong') || nk.includes('capacity')) {
              raw = v;
              break;
            }
          }
        }
      }
      if (raw === null || raw === undefined) return null;

      const asStr = String(raw).trim();
      if (/^\d+(?:\.\d+)?\s*(TB|GB)$/i.test(asStr)) {
        const m = asStr.match(/^(\d+(?:\.\d+)?)\s*(TB|GB)$/i)!;
        return `${m[1]} ${m[2].toUpperCase()}`;
      }
      return asStr || null;
    } },
    { key: "Dung l╞░╞í╠úng", label: "Dung lượng", extractFn: (p) => p.specs["Dung l╞░╞í╠úng"] || p.specs["Dung lượng"] || null },
    { key: "K├¬╠üt n├┤╠üi", label: "Chuẩn kết nối", extractFn: (p) => p.specs["K├¬╠üt n├┤╠üi"] || p.specs["Kết nối"] || null },
  ],
  psu: [
    { key: "_psuWattage", label: "Công suất (W)", extractFn: (p) => {
      if (!p) return null;
      const candidates: unknown[] = [];

      candidates.push((p as any).wattage, (p as any).tdpW, (p as any).power);

      if (p.specs && typeof p.specs === 'object') {
        candidates.push(
          p.specs["C├┤ng su├ó╠üt"],
          p.specs["Công suất"],
          p.specs["Wattage"],
          p.specs["Power"],
          p.specs["Công suất danh định"],
          p.specs["Rated Power"]
        );

        for (const val of Object.values(p.specs)) candidates.push(val);
      }

      candidates.push(p.name);

      for (const candidate of candidates) {
        const wattage = extractPsuWattage(candidate);
        if (wattage !== null) return mapPsuWattageToSegment(wattage);
      }

      return null;
    } },
    { key: "_psuEfficiencyTier", label: "Chuẩn 80 Plus", extractFn: (p) => {
      if (!p) return null;
      const candidates: string[] = [];
      if (typeof p.name === 'string') candidates.push(p.name);
      if (p.specs && typeof p.specs === 'object') {
        for (const [k, v] of Object.entries(p.specs)) {
          if (typeof v !== 'string') continue;
          const nk = String(k)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase();
          if (nk.includes('hieusuat') || nk.includes('efficiency') || nk.includes('80plus')) {
            candidates.push(v);
          }
        }
      }

      const source = candidates.join(' ').toLowerCase();
      if (!source.includes('80')) return 'Khác';
      if (source.includes('titanium')) return '80 Plus Titanium';
      if (source.includes('platinum')) return '80 Plus Platinum';
      if (source.includes('gold')) return '80 Plus Gold';
      if (source.includes('silver')) return '80 Plus Silver';
      if (source.includes('bronze')) return '80 Plus Bronze';
      if (source.includes('white')) return '80 Plus White';
      if (source.includes('basic') || source.includes('standard')) return '80 Plus';
      if (source.includes('80 plus') || source.includes('80+')) return '80 Plus';
      return 'Khác';
    } },
    { key: "C├┤ng su├ó╠üt", label: "Công suất", extractFn: (p) => p.specs["C├┤ng su├ó╠üt"] || p.specs["Công suất"] || null },
    { key: "Hiß╗çu su├ó╠üt", label: "Hiệu suất", extractFn: (p) => p.specs["Hiß╗çu su├ó╠üt"] || p.specs["Hiệu suất"] || null },
  ],
  case: [
    { key: "_caseSize", label: "Kích cỡ case", extractFn: (p) => {
      if (!p) return null;
      const vals: string[] = [];
      if (typeof p.name === 'string') vals.push(p.name);
      if (p.specs && typeof p.specs === 'object') {
        const specKeys = ["Kích thước", "Form Factor", "Case Size", "Loại case"];
        for (const k of specKeys) {
          const v = p.specs[k];
          if (typeof v === 'string') vals.push(v);
        }
      }
      const s = vals.join(' ').toLowerCase();
      if (s.includes('full tower')) return 'Cỡ lớn';
      if (s.includes('mid tower')) return 'Cỡ vừa';
      if (s.includes('mini tower')) return 'Cỡ nhỏ';
      if (s.includes('micro tower')) return 'Cỡ siêu nhỏ';
      if (s.includes('super tower')) return 'Cỡ siêu lớn';
      return null;
    } },
    { key: "H├┤╠â tr╞í╠ú Mainboard", label: "Hỗ trợ Mainboard", extractFn: (p) => p.specs["H├┤╠â tr╞í╠ú Mainboard"] || p.specs["Hỗ trợ Mainboard"] || null },
  ],
  cooler: [
    {
      key: "_coolerType", label: "Loại tản nhiệt",
      extractFn: (p) => {
        const t = (p.specs["Loß║íi tß║ún nhiß╗çt"] || p.specs["Loại tản nhiệt"] || p.name).toLowerCase();
        if (t.includes("aio") || t.includes("nước")) return "Tản nước AIO";
        if (t.includes("air") || t.includes("khí")) return "Tản khí (Air)";
        return p.specs["Loß║íi tß║ún nhiß╗çt"] || null;
      },
    },
  ],
};

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category") as CategoryType | null;
  // Chỉ dùng `search` hoặc `q` cho keyword search (substring)
  const searchQuery = searchParams.get("search") || searchParams.get("q") || "";
  const brandParam = searchParams.get("brand") || "";
  const RESERVED_QUERY_KEYS = useMemo(
    () => new Set(["category", "search", "q", "brand", "page", "sort"]),
    []
  );

  // Parse spec[KEY]=VALUE từ URL → exact match (không phải keyword)
  // Ví dụ: ?spec[Efficiency]=80+Plus sẽ chỉ lấy đúng sản phẩm có Efficiency === "80 Plus"
  const urlSpecParams = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      const m = key.match(/^spec\[(.+)\]$/);
      if (m) result[m[1]] = value; // e.g. { "Efficiency": "80 Plus" }
    }
    return result;
  }, [searchParams]);

  // Parse generic query params (e.g. ?efficiency=80+Plus+Gold, ?cooler_type=liquid)
  const urlAttributeFilters = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const [key, value] of searchParams.entries()) {
      if (RESERVED_QUERY_KEYS.has(key)) continue;
      if (/^spec\[(.+)\]$/.test(key)) continue;
      if (!value?.trim()) continue;

      if (!result[key]) result[key] = [];
      result[key].push(value);
    }
    return result;
  }, [searchParams, RESERVED_QUERY_KEYS]);

  const [sort, setSort] = useState<SortOption>("name-asc");
  const { data: menuCategories = [] } = useCategories();

  const currentCategoryName = useMemo(() => {
    if (!categoryParam) return "";
    return menuCategories.find((c) => c.id === categoryParam)?.name || categoryParam.toUpperCase();
  }, [menuCategories, categoryParam]);

  // Nếu có categoryParam/searchQuery hoặc đang chọn sort khác mặc định,
  // ta tải nhiều sản phẩm hơn và xử lý sắp xếp/lọc phía client để đảm bảo sort hoạt động đúng.
  const isClientProcessing = Boolean(categoryParam || searchQuery || sort !== "name-asc");

  const [page, setPage] = useState(1);
  const { data: productsData, isLoading } = useProducts({
    page: isClientProcessing ? 0 : Math.max(0, page - 1),
    size: isClientProcessing ? 1000 : ITEMS_PER_PAGE,
    categoryId: categoryParam || undefined,
    keyword: searchQuery || undefined,
  });
  const products = productsData?.content || [];

  // Sidebar facets (brand/price/spec) must use the full scope, not only current paged items.
  const { data: filterProductsData, isLoading: isFilterProductsLoading } = useProducts({
    page: 0,
    size: 1000,
    categoryId: categoryParam || undefined,
    keyword: searchQuery || undefined,
    enabled: !isClientProcessing,
  });
  const filterProducts = useMemo(
    () => (isClientProcessing ? products : (filterProductsData?.content || [])),
    [isClientProcessing, products, filterProductsData]
  );

  const [selectedPriceRanges, setSelectedPriceRanges] = useState<number[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string[]>>({});

  // Fetch brands from DB
  const { brands: dbBrands, loading: brandsLoading } = useBrands();

  // Sync brand từ URL + spec params từ URL vào state; reset filters khi URL thay đổi
  useEffect(() => {
    if (brandParam) {
      setSelectedBrands([brandParam]);
    } else {
      setSelectedBrands([]);
    }
    // Merge spec params từ URL vào selectedSpecs
    const specsFromUrl: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(urlSpecParams)) {
      specsFromUrl[key] = [val];
    }
    setSelectedSpecs(specsFromUrl);
    setSelectedPriceRanges([]);
    setPage(1);
  }, [categoryParam, brandParam, searchQuery, JSON.stringify(urlSpecParams)]);

  document.title = searchQuery
    ? `Tìm kiếm "${searchQuery}" - PCShop`
    : categoryParam
      ? `${currentCategoryName || "Sản phẩm"} - PCShop`
      : "Tất cả sản phẩm - PCShop";

  // Use brands from DB API, fallback to filter products if DB brands not ready
  const allBrands: string[] = useMemo(() => {
    if (dbBrands && dbBrands.length > 0) {
      return dbBrands;
    }
    if (!isClientProcessing && isFilterProductsLoading) {
      return [];
    }
    // Fallback: calculate from filterProducts (in case DB fetch fails)
    const filtered = categoryParam ? filterProducts.filter((p) => p.category === categoryParam) : filterProducts;
    return Array.from(new Set<string>(filtered.map((p) => String(p.brand)))).sort();
  }, [dbBrands, categoryParam, filterProducts, isClientProcessing, isFilterProductsLoading]);

  // Count products per brand
  const brandCounts = useMemo(() => {
    const base = categoryParam ? filterProducts.filter((p) => p.category === categoryParam) : filterProducts;
    const counts: Record<string, number> = {};
    base.forEach((p) => { counts[String(p.brand)] = (counts[String(p.brand)] || 0) + 1; });
    return counts;
  }, [categoryParam, filterProducts]);

  // Count products per price range
  const priceRangeCounts = useMemo(() => {
    const base = categoryParam ? filterProducts.filter((p) => p.category === categoryParam) : filterProducts;
    return priceRanges.map((r) => base.filter((p) => p.price >= r.min && p.price < (r.max === Infinity ? Infinity : r.max)).length);
  }, [categoryParam, filterProducts]);

  // Helper to extract spec value for a filter config from a product
  const getSpecValue = useCallback((p: { name: string; specs: Record<string, string> }, filterCfg: { key: string; extractFn?: (p: { name: string; specs: Record<string, string> }) => string | null }) => {
    if (filterCfg.extractFn) return filterCfg.extractFn(p);
    return p.specs[filterCfg.key] || null;
  }, []);

  // Spec filter options with counts (only when a category is selected)
  const specFilterGroups = useMemo(() => {
    if (!categoryParam || !categorySpecFilters[categoryParam]) return [];
    const base = filterProducts.filter((p) => p.category === categoryParam);

    // Parse size strings like "1TB", "500GB", "850W" to a numeric value for sorting
    const parseSize = (s: any): number | null => {
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

    return categorySpecFilters[categoryParam].map((filterCfg) => {
      const map = new Map<string, number>();
      base.forEach((p) => {
        const val = getSpecValue(p, filterCfg);
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

      if (filterCfg.key === "_gpuSeries") {
        options = GPU_SERIES_OPTIONS.map((series) => [series, map.get(series) || 0] as [string, number]);
      }

      if (filterCfg.key === "_psuWattage") {
        options = PSU_WATTAGE_SEGMENTS
          .map((segment) => [segment, map.get(segment) || 0] as [string, number]);
      }

      if (filterCfg.key === "_psuEfficiencyTier") {
        options = PSU_80_PLUS_OPTIONS.map((tier) => [tier, map.get(tier) || 0] as [string, number]);
      }

      if (filterCfg.key === "_caseSize") {
        options = CASE_SIZE_OPTIONS.map((size) => [size, map.get(size) || 0] as [string, number]);
      }

      return { key: filterCfg.key, label: filterCfg.label, options, extractFn: filterCfg.extractFn };
    }).filter((g) => g.options.length > 0);
  }, [categoryParam, filterProducts, getSpecValue]);

  const toggleSpec = (specKey: string, val: string) => {
    setSelectedSpecs((prev) => {
      const current = prev[specKey] || [];
      const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
      return { ...prev, [specKey]: next };
    });
    setPage(1);
  };

  const filtered = useMemo(() => {
    const normalize = (v: unknown) =>
      String(v ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const normalizeKey = (k: string) =>
      normalize(k).replace(/[_-]+/g, " ");

    let result = [...products];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const keywords = q.split(/\s+/).filter(k => k.length > 2);
      
      result = result.filter((p) => {
        const name = p.name.toLowerCase();
        const brand = p.brand.toLowerCase();
        const description = p.description.toLowerCase();
        const specs = Object.values(p.specs || {}).map(v => String(v).toLowerCase()).join(" ");
        
        // If no keywords (all < 3 chars), fall back to substring search
        if (keywords.length === 0) {
          return name.includes(q) || brand.includes(q) || description.includes(q) || specs.includes(q);
        }
        
        // For keyword-based search, at least 1 keyword must match
        const matchCount = keywords.filter(k =>
          name.includes(k) || brand.includes(k) || description.includes(k) || specs.includes(k)
        ).length;
        
        return matchCount >= Math.max(1, keywords.length - 1);
      });
    }
    if (categoryParam) result = result.filter((p) => p.category === categoryParam);

    // Apply generic URL attribute filters from query params
    if (Object.keys(urlAttributeFilters).length > 0) {
      result = result.filter((p) => {
        const specsEntries = Object.entries(p.specs || {});
        const normalizedSpecs = specsEntries.map(([k, v]) => ({
          key: normalizeKey(k),
          value: normalize(v),
        }));

        return Object.entries(urlAttributeFilters).every(([rawKey, values]) => {
          const keyNorm = normalizeKey(rawKey);
          const valueNorms = values.map((v) => normalize(v)).filter(Boolean);
          if (valueNorms.length === 0) return true;

          const topLevelCandidateKeys = [rawKey, rawKey.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
          const topLevelValue = topLevelCandidateKeys
            .map((k) => (p as any)[k])
            .find((v) => v !== undefined && v !== null);
          const topLevelNorm = normalize(topLevelValue);

          const hasSpecKeyMatch = normalizedSpecs.some((s) =>
            s.key.includes(keyNorm) || keyNorm.includes(s.key)
          );

          return valueNorms.some((valNorm) => {
            if (topLevelNorm && topLevelNorm.includes(valNorm)) return true;

            if (hasSpecKeyMatch) {
              return normalizedSpecs
                .filter((s) => s.key.includes(keyNorm) || keyNorm.includes(s.key))
                .some((s) => s.value.includes(valNorm));
            }

            // Fallback: broad match against name/description/brand/spec values
            return (
              normalize(p.name).includes(valNorm) ||
              normalize(p.description).includes(valNorm) ||
              normalize(p.brand).includes(valNorm) ||
              normalizedSpecs.some((s) => s.value.includes(valNorm))
            );
          });
        });
      });
    }

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
            return val !== null && val !== undefined ? selected.includes(String(val)) : false;
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
  }, [products, categoryParam, searchQuery, sort, selectedPriceRanges, selectedBrands, selectedSpecs, urlAttributeFilters, getSpecValue]);

  const hasClientSideFilters = selectedSpecs && (
    Object.values(selectedSpecs).some(v => v.length > 0) ||
    selectedBrands.length > 0 ||
    selectedPriceRanges.length > 0 ||
    Object.keys(urlSpecParams).length > 0 ||
    Object.keys(urlAttributeFilters).length > 0
  );

  // Áp dụng chia trang nội bộ nếu ta đang kéo 1000 SP (isClientProcessing) hoặc người dùng dùng bộ lọc Sidebar
  const useClientFiltering = Boolean(isClientProcessing || hasClientSideFilters);

  const totalPages = useClientFiltering
    ? Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
    : (productsData?.totalPages ?? Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE)));
  const paged = useClientFiltering
    ? filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
    : products;

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
          {menuCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                const newParams = new URLSearchParams();
                newParams.set("category", c.id as string);
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
          {(brandsLoading || (!isClientProcessing && isFilterProductsLoading)) ? (
            // Loading skeleton
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-4 w-4 animate-pulse rounded bg-muted"></div>
                <div className="h-4 flex-1 animate-pulse rounded bg-muted"></div>
              </div>
            ))
          ) : allBrands.length === 0 ? (
            <span className="text-xs text-muted-foreground">Không có thương hiệu</span>
          ) : (
            allBrands.map((brand) => (
              <label key={brand} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Checkbox
                  checked={selectedBrands.includes(brand)}
                  onCheckedChange={() => toggleBrand(brand)}
                />
                <span>{brand}</span>
                <span className="text-xs text-muted-foreground">({brandCounts[brand] || 0})</span>
              </label>
            ))
          )}
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
              ? currentCategoryName
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
            <p className="text-sm text-muted-foreground font-bold">Tìm thấy {useClientFiltering ? filtered.length : (productsData?.totalElements ?? filtered.length)} sản phẩm</p>
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
          {isLoading ? (
            <LoadingSkeleton count={8} />
          ) : paged.length > 0 ? (
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
