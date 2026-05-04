import { Product } from "@/types/product.types";

export type FilterSpecConfig = {
  key: string;
  label: string;
  extractFn?: (p: Product) => string | null;
};

export const GPU_SERIES_OPTIONS = [
  "RTX 3000 Series", "RTX 4000 Series", "RTX 5000 Series",
  "RX 9000 Series", "RX 7000 Series", "RX 6000 Series", "RX 5000 Series",
];

export const PSU_80_PLUS_OPTIONS = [
  "80 Plus", "80 Plus White", "80 Plus Bronze", "80 Plus Silver",
  "80 Plus Gold", "80 Plus Platinum", "80 Plus Titanium", "Khác",
];

export const PSU_WATTAGE_SEGMENTS = [
  "Dưới 550W", "550W - 650W", "650W - 750W", "750W - 850W", "850W - 1000W", "Trên 1000W",
];

export const CASE_SIZE_OPTIONS = ["Cỡ siêu nhỏ", "Cỡ nhỏ", "Cỡ vừa", "Cỡ lớn", "Cỡ siêu lớn"];

export const mapPsuWattageToSegment = (wattage: number): string => {
  if (wattage < 550) return "Dưới 550W";
  if (wattage <= 650) return "550W - 650W";
  if (wattage <= 750) return "650W - 750W";
  if (wattage <= 850) return "750W - 850W";
  if (wattage <= 1000) return "850W - 1000W";
  return "Trên 1000W";
};

export const extractPsuWattage = (value: unknown): number | null => {
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

export const categoryFilterSpecs: Record<string, FilterSpecConfig[]> = {
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
        if (p.specs && typeof p.specs === "object") {
          const tryKeys = ["Socket", "Socket Type", "Khe cắm", "Khe cắm CPU", "Socket/CPU"];
          for (const k of tryKeys) {
            if (p.specs[k]) return String(p.specs[k]);
          }
          for (const [k, v] of Object.entries(p.specs)) {
            const nk = String(k).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
            if (nk.includes("socket") || nk.includes("khecam") || nk.includes("khecamcpu") || nk.includes("sockettype")) {
              return String(v);
            }
          }
        }
        const m = p.name.match(/(LGA\d+|AM\d+|AM4|LGA1700|LGA1200|s1700|s1151|TRX4)/i);
        return m ? m[0] : null;
      },
    },
    {
      key: "Kích thước", label: "Form Factor",
      extractFn: (p) => p.specs["Kích thước"] || p.specs["Ki╠üch th╞░╞í╠üc"] || p.specs["Form Factor"] || null,
    },
  ],
  vga: [
    {
      key: "_gpuSeries", label: "Series",
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
    { key: "Dung lượng", label: "Bộ nhớ VRAM", extractFn: (p) => p.specs["Dung lượng"] || p.specs["Dung l╞░╞í╠úng"] || null },
  ],
  ram: [
    { key: "Thế hệ", label: "Loại RAM", extractFn: (p) => p.specs["Thế hệ"] || p.specs["Th├¬╠ü h├¬╠ú"] || null },
    {
      key: "_ramCapacity", label: "Dung lượng RAM", extractFn: (p) => {
        const topCap = (p as any).capacity_gb ?? (p as any).capacity;
        const specCap = p.specs["capacity_gb"] ?? p.specs["capacity"] ?? p.specs["Dung lượng"] ?? p.specs["Dung l╞░╞í╠úng"] ?? p.specs["Dung lượng (GB)"] ?? p.specs["Capacity"];
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
  ssd: [
    {
      key: "_storageCapacity", label: "Dung lượng",
      extractFn: (p) => {
        let raw: unknown = p.specs["Dung lượng"] ?? p.specs["Dung l╞░╞í╠úng"];
        if (raw === undefined || raw === null) {
          for (const [k, v] of Object.entries(p.specs || {})) {
            const nk = String(k).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
            if (nk.includes("dungluong") || nk.includes("capacity")) { raw = v; break; }
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
    { key: "Kết nối", label: "Chuẩn kết nối", extractFn: (p) => p.specs["Kết nối"] || p.specs["K├¬╠üt n├┤╠üi"] || null },
  ],
  psu: [
    {
      key: "_psuWattage", label: "Công suất (W)", extractFn: (p) => {
        const candidates: unknown[] = [];
        candidates.push((p as any).wattage, (p as any).tdpW, (p as any).power);
        candidates.push(p.specs["Công suất"], p.specs["C├┤ng su├ó╠üt"], p.specs["Wattage"], p.specs["Power"], p.specs["Công suất danh định"], p.specs["Rated Power"]);
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
        if (source.includes("basic") || source.includes("standard")) return "80 Plus";
        if (source.includes("80 plus") || source.includes("80+")) return "80 Plus";
        return "Khác";
      },
    },
  ],
  case: [
    {
      key: "_caseSize", label: "Kích cỡ case", extractFn: (p) => {
        const vals: string[] = [p.name];
        const specKeys = ["Kích thước", "Form Factor", "Case Size", "Loại case"];
        for (const k of specKeys) { const v = p.specs[k]; if (typeof v === "string") vals.push(v); }
        const s = vals.join(" ").toLowerCase();
        if (s.includes("full tower")) return "Cỡ lớn";
        if (s.includes("mid tower")) return "Cỡ vừa";
        if (s.includes("mini tower")) return "Cỡ nhỏ";
        if (s.includes("micro tower")) return "Cỡ siêu nhỏ";
        if (s.includes("super tower")) return "Cỡ siêu lớn";
        return null;
      },
    },
    { key: "Hỗ trợ Mainboard", label: "Hỗ trợ Mainboard", extractFn: (p) => p.specs["Hỗ trợ Mainboard"] || p.specs["H├┤╠â tr╞í╠ú Mainboard"] || null },
  ],
  cooler: [
    {
      key: "_coolerType", label: "Loại tản nhiệt",
      extractFn: (p) => {
        const t = String(p.specs["Loại tản nhiệt"] || p.specs["Loß║íi tß║ún nhiß╗çt"] || p.name).toLowerCase();
        if (t.includes("aio") || t.includes("nước")) return "Tản nước AIO";
        if (t.includes("air") || t.includes("khí")) return "Tản khí (Air)";
        return p.specs["Loại tản nhiệt"] || p.specs["Loß║íi tß║ún nhiß╗çt"] || null;
      },
    },
  ],
};

// ─── Compatibility helpers ────────────────────────────────────────────────────

export const normalizeSocket = (value: string | null | undefined): string | null => {
  if (!value || typeof value !== "string") return null;
  const normalized = value.toUpperCase().replace(/[\s_-]+/g, "").trim();
  return normalized || null;
};

const isSocketKey = (key: string): boolean => {
  const normalized = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return normalized.includes("socket") || normalized.includes("khecam");
};

export const normalizeRamType = (value: string | null | undefined): string | null => {
  if (!value || typeof value !== "string") return null;
  const upper = value.toUpperCase();
  const match = upper.match(/DDR\s*([345])/);
  if (!match?.[1]) return null;
  return `DDR${match[1]}`;
};

const isRamTypeKey = (key: string): boolean => {
  const normalized = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return normalized.includes("ramtype") || normalized.includes("loairam") || normalized.includes("thehe") || normalized.includes("memorytype");
};

export const getProductSocket = (product: Product | null | undefined): string | null => {
  if (!product) return null;
  const directCandidates = [(product as any).socket, (product as any).socketType, (product as any).cpuSocket];
  for (const candidate of directCandidates) {
    const normalized = normalizeSocket(typeof candidate === "string" ? candidate : null);
    if (normalized) return normalized;
  }
  const socketKeys = ["Socket", "socket", "Khe cắm", "khe cắm", "Socket Type", "CPU Socket"];
  for (const key of socketKeys) {
    const val = product.specs[key];
    const normalized = normalizeSocket(typeof val === "string" ? val : null);
    if (normalized) return normalized;
  }
  for (const [key, value] of Object.entries(product.specs || {})) {
    if (!isSocketKey(key) || typeof value !== "string") continue;
    const normalized = normalizeSocket(value);
    if (normalized) return normalized;
  }
  return null;
};

export const getProductRamType = (product: Product | null | undefined): string | null => {
  if (!product) return null;
  const directCandidates = [(product as any).ramType, (product as any).memoryType, (product as any).type];
  for (const candidate of directCandidates) {
    const normalized = normalizeRamType(typeof candidate === "string" ? candidate : null);
    if (normalized) return normalized;
  }
  const ramKeys = ["RAM Type", "Loại RAM", "Thế hệ", "Memory Type", "Type"];
  for (const key of ramKeys) {
    const val = product.specs[key];
    const normalized = normalizeRamType(typeof val === "string" ? val : null);
    if (normalized) return normalized;
  }
  for (const [key, value] of Object.entries(product.specs || {})) {
    if (!isRamTypeKey(key) || typeof value !== "string") continue;
    const normalized = normalizeRamType(value);
    if (normalized) return normalized;
  }
  for (const value of Object.values(product.specs || {})) {
    if (typeof value !== "string") continue;
    const normalized = normalizeRamType(value);
    if (normalized) return normalized;
  }
  return normalizeRamType(product.name);
};

export const getSpecValue = (p: Product, filterCfg: FilterSpecConfig): string | null => {
  if (filterCfg.extractFn) return filterCfg.extractFn(p);
  return p.specs[filterCfg.key] || null;
};
