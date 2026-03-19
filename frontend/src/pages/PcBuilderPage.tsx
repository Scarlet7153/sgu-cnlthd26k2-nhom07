import { useState, useMemo, useEffect } from "react";
import { Plus, X, AlertTriangle, Check, Search, ChevronRight, Minus, Pencil, Trash2, RotateCcw, FileSpreadsheet, Printer } from "lucide-react";
import { Link } from "react-router-dom";

import { Product, CategoryType, PcBuildSlot } from "@/types/product.types";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { useProducts } from "@/hooks/useProducts";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import logo from "@/assets/logo.png";

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
      key: "Kích thước",
      label: "Form Factor",
      extractFn: (p) => p.specs["Kích thước"] || p.specs["Ki╠üch th╞░╞í╠üc"] || p.specs["Form Factor"] || null,
    },
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
      key: "_storageCapacity",
      label: "Dung lượng",
      extractFn: (p) => {
        let raw: unknown = p.specs["Dung lượng"] ?? p.specs["Dung l╞░╞í╠úng"];
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
    { key: "Kết nối", label: "Chuẩn kết nối", extractFn: (p) => p.specs["Kết nối"] || p.specs["K├¬╠üt n├┤╠üi"] || null },
  ],
  psu: [
    {
      key: "_psuWattage", label: "Công suất (W)", extractFn: (p) => {
        const candidates: unknown[] = [];

        candidates.push((p as any).wattage, (p as any).tdpW, (p as any).power);
        candidates.push(
          p.specs["Công suất"],
          p.specs["C├┤ng su├ó╠üt"],
          p.specs["Wattage"],
          p.specs["Power"],
          p.specs["Công suất danh định"],
          p.specs["Rated Power"]
        );
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
          if (nk.includes("hieusuat") || nk.includes("efficiency") || nk.includes("80plus")) {
            candidates.push(v);
          }
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

const isStorageCategory = (category: string): boolean => {
  return category === "ssd" || category === "hdd" || category === "harddisk";
};

const categoryMatches = (productCategory: string, selectedCategory: CategoryType): boolean => {
  if (selectedCategory === "ssd") return isStorageCategory(productCategory);
  return productCategory === selectedCategory;
};

const getProductImage = (product: Product | null | undefined): string => {
  const src = product?.images?.[0];
  if (typeof src === "string" && src.trim()) return src;
  return "https://placehold.co/120x120/png?text=No+Image";
};

function loadSavedConfig(): {
  productIds: Record<string, string | null>;
  quantities: Record<string, number>;
  selectedProducts: Record<string, Product | null>;
} {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return { productIds: {}, quantities: {}, selectedProducts: {} };
    return {
      productIds: saved.products || {},
      quantities: saved.quantities || {},
      selectedProducts: saved.selectedProducts || {},
    };
  } catch {
    return { productIds: {}, quantities: {}, selectedProducts: {} };
  }
}

export default function PcBuilderPage() {
  document.title = "PC Builder - PCShop";
  const { addToCart } = useCart();
  const { toast } = useToast();

  const [savedConfig, setSavedConfig] = useState(loadSavedConfig);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => loadSavedConfig().quantities);
  const [selectedProducts, setSelectedProducts] = useState<Record<string, Product | null>>(() => loadSavedConfig().selectedProducts);
  const [openCategory, setOpenCategory] = useState<CategoryType | null>(null);

  const { data: categoryProductsData, isLoading: isCategoryLoading } = useProducts({
    size: 500,
    categoryId: openCategory || undefined,
    enabled: Boolean(openCategory),
  });
  const categoryProductsFromApi = categoryProductsData?.content || [];

  const slots = useMemo(() => {
    return BUILD_SLOTS.map(slot => {
        const id = savedConfig.productIds[slot.category];
        const product = id ? (selectedProducts[slot.category] || null) : null;
        return { ...slot, product } as PcBuildSlot;
    });
  }, [savedConfig, selectedProducts]);

  // Persist to localStorage
  useEffect(() => {
    const data = {
      products: savedConfig.productIds,
      quantities,
      selectedProducts,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [savedConfig.productIds, quantities, selectedProducts]);

  const getQty = (cat: string) => quantities[cat] || 1;
  const setQty = (cat: string, val: number) => setQuantities(prev => ({ ...prev, [cat]: Math.max(1, val) }));

  const selectProduct = (category: CategoryType, product: Product) => {
    setSavedConfig(prev => ({ ...prev, productIds: { ...prev.productIds, [category]: product.id }}));
    setSelectedProducts(prev => ({ ...prev, [category]: product }));
    if (!quantities[category]) setQuantities(prev => ({ ...prev, [category]: 1 }));
    setOpenCategory(null);
  };

  const removeProduct = (category: CategoryType) => {
    setSavedConfig(prev => ({ ...prev, productIds: { ...prev.productIds, [category]: null }}));
    setSelectedProducts(prev => ({ ...prev, [category]: null }));
  };

  const totalPrice = useMemo(() => slots.reduce((sum, s) => sum + (s.product?.price ?? 0) * getQty(s.category), 0), [slots, quantities]);

  // Compatibility checks
  const warnings = useMemo(() => {
    const w: string[] = [];
    const cpu = slots.find((s) => s.category === "cpu")?.product;
    const mb = slots.find((s) => s.category === "mainboard")?.product;
    const ram = slots.find((s) => s.category === "ram")?.product;
    const psu = slots.find((s) => s.category === "psu")?.product;
    const vga = slots.find((s) => s.category === "vga")?.product;

    const getRamGen = (product: Product | null | undefined): string | null => {
      if (!product) return null;
      const candidates = [
        (product as any).ramType,
        product.specs?.["RAM Type"],
        product.specs?.["Loại RAM"],
        product.specs?.["Thế hệ"],
      ];
      for (const c of candidates) {
        const v = typeof c === "string" ? c.toUpperCase() : "";
        const m = v.match(/DDR\s*([345])/);
        if (m?.[1]) return `DDR${m[1]}`;
      }
      return null;
    };

    if (cpu && mb && "socket" in cpu && "socket" in mb) {
      if ((cpu as { socket: string }).socket !== (mb as { socket: string }).socket) {
        w.push(`⚠ CPU socket (${(cpu as { socket: string }).socket}) không tương thích với Mainboard (${(mb as { socket: string }).socket})`);
      }
    }

    const mbRam = getRamGen(mb);
    const ramGen = getRamGen(ram);
    if (mbRam && ramGen && mbRam !== ramGen) {
      w.push(`⚠ RAM ${ramGen} không tương thích với Mainboard yêu cầu ${mbRam}`);
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

  const selectedSlotRows = useMemo(() => {
    return slots
      .filter((s) => s.product)
      .map((s) => {
        const product = s.product!;
        const qty = getQty(s.category);
        return {
          productName: product.name,
          warranty: "36 Tháng",
          quantity: qty,
          unitPrice: product.price,
          subtotal: product.price * qty,
        };
      });
  }, [slots, quantities]);

  const escapeHtml = (value: string): string => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const formatVndReport = (value: number): string => `${Math.round(value).toLocaleString("vi-VN")} đ`;
  const formatMoneyExcel = (value: number): string => Math.round(value).toLocaleString("vi-VN");

  const buildQuoteHtml = (mode: "print" | "excel" = "print") => {
    const quoteDate = new Date().toLocaleDateString("vi-VN");
    const siteHost = window.location.host || "localhost";
    const isPrintMode = mode === "print";
    const quoteRows = selectedSlotRows
      .map(
        (r, idx) => `
          <tr>
            <td class="center">${idx + 1}</td>
            <td class="left">${escapeHtml(r.productName)}</td>
            <td class="center">${r.warranty}</td>
            <td class="center">${r.quantity}</td>
            <td class="right">${formatVndReport(r.unitPrice)}</td>
            <td class="right">${formatVndReport(r.subtotal)}</td>
          </tr>`
      )
      .join("");

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Báo giá thiết bị</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; background: #f3f4f6; color: #111827; }
    .page {
      width: ${isPrintMode ? "210mm" : "980px"};
      min-height: ${isPrintMode ? "297mm" : "auto"};
      margin: 0 auto;
      background: #fff;
      padding: ${isPrintMode ? "10mm" : "16px"};
    }
    .top-link { text-align: right; font-size: ${isPrintMode ? "11px" : "10px"}; color: #1d4ed8; margin-bottom: 4px; }
    .rule { border-top: 1px solid #d1d5db; margin-bottom: 8px; }
    .title { text-align: center; font-size: ${isPrintMode ? "23px" : "20px"}; font-weight: 700; letter-spacing: 0.3px; margin: 6px 0 8px; }
    .meta { text-align: right; font-size: ${isPrintMode ? "12px" : "11px"}; line-height: 1.3; margin-bottom: 8px; }
    .meta .italic { font-style: italic; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #000; font-size: ${isPrintMode ? "11px" : "10.5px"}; padding: 4px 5px; vertical-align: middle; }
    thead th { background: #0288c8; color: #fff; font-weight: 700; text-align: center; }
    .center { text-align: center; }
    .left { text-align: left; }
    .right { text-align: right; }
    .summary-empty, .summary-label, .summary-value { border: none !important; }
    .summary-empty { background: transparent; }
    .summary-label { background: #dbeafe; }
    .summary-value { background: #dbeafe; text-align: right; }
    .note { margin-top: 12px; font-size: ${isPrintMode ? "11px" : "10px"}; text-align: center; line-height: 1.4; }
    .note strong { font-weight: 700; }
    .no-print button { border: 1px solid #9ca3af; background: #fff; border-radius: 6px; cursor: pointer; }
    tr { page-break-inside: avoid; }
    @media print {
      body { background: #fff; }
      .page { width: 100%; min-height: auto; margin: 0; padding: 0; }
      th, td { font-size: 10.5px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="top-link">Website: ${escapeHtml(siteHost)}</div>
    <div class="rule"></div>
    <div class="title">BÁO GIÁ THIẾT BỊ</div>
    <div class="meta">
      <div>Ngày báo giá: ${quoteDate}</div>
      <div class="italic">Đơn vị tính: VNĐ</div>
    </div>
    <table>
      <colgroup>
        <col style="width: 8%;" />
        <col style="width: 45%;" />
        <col style="width: 11%;" />
        <col style="width: 9%;" />
        <col style="width: 13%;" />
        <col style="width: 14%;" />
      </colgroup>
      <thead>
        <tr>
          <th>STT</th>
          <th>Tên sản phẩm</th>
          <th>Bảo hành</th>
          <th>Số lượng</th>
          <th>Đơn giá</th>
          <th>Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${quoteRows}
        <tr>
          <td colspan="4" class="summary-empty"></td>
          <td class="summary-label">Phí vận chuyển</td>
          <td class="summary-value">0</td>
        </tr>
        <tr>
          <td colspan="4" class="summary-empty"></td>
          <td class="summary-label">Chi phí khác</td>
          <td class="summary-value">0</td>
        </tr>
        <tr>
          <td colspan="4" class="summary-empty"></td>
          <td class="summary-label"><strong>Tổng tiền đơn hàng</strong></td>
          <td class="summary-value"><strong>${formatVndReport(totalPrice)}</strong></td>
        </tr>
      </tbody>
    </table>
    <div class="note">
      <strong>Quý khách lưu ý</strong> : Giá bán, khuyến mãi của sản phẩm và tình trạng còn hàng<br />
      có thể bị thay đổi bất cứ lúc nào mà không kịp báo trước.<br /><br />
      Để biết thêm chi tiết, Quý khách vui<br />
      lòng liên hệ
    </div>
    <div class="no-print" style="margin-top: 16px; text-align: center;">
      <button onclick="window.print()" style="padding: 8px 14px;">In ngay</button>
      <button onclick="window.close()" style="padding: 8px 14px; margin-left: 8px;">Đóng</button>
    </div>
  </div>
</body>
</html>`;
  };

  const exportConfigurationExcel = async () => {
    if (selectedSlotRows.length === 0) {
      toast({ title: "Chưa có cấu hình để xuất" });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PCShop";
    workbook.created = new Date();
    const webUrl = window.location.origin;

    const toDataUrl = (blob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    const ws = workbook.addWorksheet("BaoGia", {
      pageSetup: {
        paperSize: 9,
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      },
      views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
    });

    ws.columns = [
      { key: "spacer", width: 4 },
      { key: "stt", width: 8 },
      { key: "name", width: 50 },
      { key: "warranty", width: 13 },
      { key: "qty", width: 11 },
      { key: "price", width: 16 },
      { key: "subtotal", width: 16 },
    ];

    // Keep row 1 completely blank with no border.
    const row1 = ws.getRow(1);
    row1.height = 14;
    for (let c = 1; c <= 7; c++) {
      const cell = ws.getCell(1, c);
      cell.value = "";
      cell.border = {};
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    }

    ws.mergeCells("B2:B3");
    ws.getCell("B2").value = "";
    ws.getCell("B2").alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 28;
    ws.getRow(3).height = 28;

    try {
      const logoBlob = await fetch(logo).then((res) => res.blob());
      const logoBase64 = await toDataUrl(logoBlob);
      const logoImageId = workbook.addImage({ base64: logoBase64, extension: "png" });

      // Make the image itself clickable.
      ws.addImage(logoImageId, {
        // Fill exactly merged cell B2:B3.
        tl: { col: 1, row: 1 },
        br: { col: 2, row: 3 },
        hyperlinks: {
          hyperlink: webUrl,
          tooltip: "Mở website",
        },
      } as any);
    } catch {
      // Fallback if logo fetch fails.
      ws.getCell("B2").value = { text: "PCShop", hyperlink: webUrl };
      ws.getCell("B2").font = { name: "Calibri", size: 11, color: { argb: "FF1D4ED8" }, underline: true };
    }

    ws.mergeCells("C2:G3");
    ws.getCell("C2").value = "BÁO GIÁ THIẾT BỊ";
    ws.getCell("C2").font = { name: "Calibri", size: 20, bold: true, color: { argb: "FF000000" } };
    ws.getCell("C2").alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell("C2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1DA6D6" } };

    ws.mergeCells("B4:G4");
    ws.getCell("B4").value = `Ngày báo giá: ${new Date().toLocaleDateString("vi-VN")}   |   Đơn vị tính: VNĐ`;
    ws.getCell("B4").alignment = { horizontal: "right", vertical: "middle" };
    ws.getCell("B4").font = { name: "Calibri", size: 12, italic: true };

    const headerRow = ws.getRow(5);
    headerRow.values = ["", "STT", "Tên sản phẩm", "Bảo hành", "Số lượng", "Đơn giá", "Thành tiền"];
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0288C8" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    });

    let currentRow = 6;
    for (let i = 0; i < selectedSlotRows.length; i++) {
      const r = selectedSlotRows[i];
      const row = ws.getRow(currentRow++);
      row.values = ["", i + 1, r.productName, r.warranty, r.quantity, formatMoneyExcel(r.unitPrice), formatMoneyExcel(r.subtotal)];
    }

    const shippingRow = ws.getRow(currentRow++);
    shippingRow.values = ["", "", "", "", "", "Phí vận chuyển", formatMoneyExcel(0)];
    const extraRow = ws.getRow(currentRow++);
    extraRow.values = ["", "", "", "", "", "Chi phí khác", formatMoneyExcel(0)];
    const totalRow = ws.getRow(currentRow++);
    totalRow.values = ["", "", "", "", "", "Tổng tiền đơn hàng", formatMoneyExcel(totalPrice)];

    ws.mergeCells(`B${shippingRow.number}:E${shippingRow.number}`);
    ws.mergeCells(`B${extraRow.number}:E${extraRow.number}`);
    ws.mergeCells(`B${totalRow.number}:E${totalRow.number}`);

    for (let r = 6; r < currentRow; r++) {
      const row = ws.getRow(r);
      row.eachCell((cell, col) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };

        if (col === 3) {
          cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        } else if (col === 6 || col === 7) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });

    }

    [shippingRow, extraRow, totalRow].forEach((row) => {
      // Left side is a single merged spacer cell without border.
      row.getCell(2).border = {};
      row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

      row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
      row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
      row.getCell(6).alignment = { horizontal: "left", vertical: "middle" };
      row.getCell(7).alignment = { horizontal: "right", vertical: "middle" };

      // Remove borders for summary area as requested.
      row.getCell(6).border = {};
      row.getCell(7).border = {};
    });
    totalRow.getCell(6).font = { name: "Calibri", size: 11, bold: true };
    totalRow.getCell(7).font = { name: "Calibri", size: 11, bold: true };

    const noteRowStart = currentRow + 1;
    ws.mergeCells(`B${noteRowStart}:G${noteRowStart}`);
    ws.getCell(`B${noteRowStart}`).value = "Quý khách lưu ý: Giá bán, khuyến mãi của sản phẩm và tình trạng còn hàng có thể thay đổi mà không kịp báo trước.";
    ws.getCell(`B${noteRowStart}`).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getCell(`B${noteRowStart}`).font = { name: "Calibri", size: 10, italic: true };

    // Auto-fit columns based on max text length in each column.
    ws.columns.forEach((column, idx) => {
      const columnIndex = idx + 1;
      if (columnIndex === 1) {
        column.width = 4;
        return;
      }
      let maxLength = 10;
      ws.eachRow({ includeEmpty: true }, (row) => {
        const cell = row.getCell(columnIndex);
        const value = cell.value;
        const text = value === null || value === undefined
          ? ""
          : typeof value === "object" && value !== null && "richText" in value
            ? (value as any).richText.map((r: any) => r.text).join("")
            : String(value);
        if (text.length > maxLength) maxLength = text.length;
      });

      const capped = Math.min(maxLength + 2, columnIndex === 3 ? 80 : 25);
      column.width = Math.max(capped, columnIndex === 3 ? 35 : 10);
    });

    const getCellText = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      if (typeof value === "object" && value !== null && "richText" in value) {
        return (value as any).richText.map((r: any) => r.text).join("");
      }
      return String(value);
    };

    const estimateLines = (text: string, charsPerLine: number): number => {
      if (!text) return 1;
      const safeWidth = Math.max(1, charsPerLine);
      return text
        .split("\n")
        .reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / safeWidth)), 0);
    };

    const approxCharsPerCol = (colIndex: number): number => {
      const w = Number(ws.getColumn(colIndex).width || 10);
      return Math.max(4, Math.floor(w - 1));
    };

    for (let r = 6; r < currentRow; r++) {
      const row = ws.getRow(r);
      let maxLines = 1;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const text = getCellText(cell.value);
        const lines = estimateLines(text, approxCharsPerCol(colNumber));
        if (lines > maxLines) maxLines = lines;
      });
      row.height = Math.max(18, maxLines * 14);
    }

    const mergedWidthChars = [2, 3, 4, 5, 6, 7]
      .map((col) => approxCharsPerCol(col))
      .reduce((sum, n) => sum + n, 0);
    const noteLines = estimateLines(getCellText(ws.getCell(`B${noteRowStart}`).value), mergedWidthChars);
    ws.getRow(noteRowStart).height = Math.max(20, noteLines * 14);

    const frameTop = 2;
    const frameBottom = noteRowStart;

    // Force spacer column A to remain completely blank (no border/fill artifacts).
    for (let r = 1; r <= frameBottom; r++) {
      const spacerCell = ws.getCell(r, 1);
      spacerCell.value = "";
      spacerCell.border = {};
      spacerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    }

    for (let r = frameTop; r <= frameBottom; r++) {
      for (let c = 2; c <= 7; c++) {
        if (r !== frameTop && r !== frameBottom && c !== 2 && c !== 7) continue;
        const cell = ws.getCell(r, c);
        const current = cell.border || {};
        cell.border = {
          ...current,
          top: r === frameTop ? { style: "thin", color: { argb: "FF000000" } } : current.top,
          bottom: r === frameBottom ? { style: "thin", color: { argb: "FF000000" } } : current.bottom,
          left: c === 2 ? { style: "thin", color: { argb: "FF000000" } } : current.left,
          right: c === 7 ? { style: "thin", color: { argb: "FF000000" } } : current.right,
        };
      }
    }

    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `bao-gia-thiet-bi-${stamp}.xlsx`);

    toast({ title: "Đã xuất báo giá Excel", description: "Đã áp dụng layout mới, auto-fit cột và auto-fit chiều cao hàng" });
  };

  const printConfiguration = () => {
    if (selectedSlotRows.length === 0) {
      toast({ title: "Chưa có cấu hình để in" });
      return;
    }

    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) {
      toast({ title: "Không thể mở cửa sổ in", description: "Hãy cho phép popup rồi thử lại" });
      return;
    }

    const html = buildQuoteHtml("print");

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleAddAllToCart = () => {
    slots.forEach((s) => {
      if (s.product) {
        for (let i = 0; i < getQty(s.category); i++) addToCart(s.product);
      }
    });
    toast({ title: "Đã thêm cấu hình vào giỏ hàng!", description: `${filledSlots} linh kiện` });
  };

  const handleReset = () => {
    setSavedConfig({ productIds: {}, quantities: {}, selectedProducts: {} });
    setQuantities({});
    setSelectedProducts({});
    localStorage.removeItem(STORAGE_KEY);
    toast({ title: "Đã làm mới cấu hình!" });
  };

  const [searchFilter, setSearchFilter] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string[]>>({});
  const [stockOnly, setStockOnly] = useState(false);
  const [sortOption, setSortOption] = useState<"price-asc" | "price-desc" | "name-asc" | "name-desc">("price-asc");

  const normalizeSocket = (value: string | null | undefined): string | null => {
    if (!value || typeof value !== "string") return null;
    const normalized = value
      .toUpperCase()
      .replace(/[\s_-]+/g, "")
      .trim();
    return normalized || null;
  };

  const isSocketKey = (key: string): boolean => {
    const normalized = key
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
    return normalized.includes("socket") || normalized.includes("khecam");
  };

  const normalizeRamType = (value: string | null | undefined): string | null => {
    if (!value || typeof value !== "string") return null;
    const upper = value.toUpperCase();
    const match = upper.match(/DDR\s*([345])/);
    if (!match?.[1]) return null;
    return `DDR${match[1]}`;
  };

  const isRamTypeKey = (key: string): boolean => {
    const normalized = key
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
    return (
      normalized.includes("ramtype") ||
      normalized.includes("loairam") ||
      normalized.includes("thehe") ||
      normalized.includes("memorytype")
    );
  };

  // Helper to extract and normalize socket from product
  const getProductSocket = (product: Product | null | undefined): string | null => {
    if (!product) return null;

    const directCandidates = [
      (product as any).socket,
      (product as any).socketType,
      (product as any).cpuSocket,
    ];

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

  const getProductRamType = (product: Product | null | undefined): string | null => {
    if (!product) return null;

    const directCandidates = [
      (product as any).ramType,
      (product as any).memoryType,
      (product as any).type,
    ];
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

    // Fallback: infer from any spec string and product name (many items include DDR4/DDR5 there).
    for (const value of Object.values(product.specs || {})) {
      if (typeof value !== "string") continue;
      const normalized = normalizeRamType(value);
      if (normalized) return normalized;
    }

    return normalizeRamType(product.name);
  };

  // Socket compatibility constraint
  const compatibilityConstraint = useMemo(() => {
    if (!openCategory) return null;
    const cpuSlot = slots.find(s => s.category === "cpu")?.product;
    const mbSlot = slots.find(s => s.category === "mainboard")?.product;
    const hasMainboardSelected = Boolean(mbSlot);

    const cpuSocket = getProductSocket(cpuSlot);
    const mbSocket = getProductSocket(mbSlot);
    const mbRamType = getProductRamType(mbSlot);

    if (openCategory === "mainboard" && cpuSocket) {
      return { 
        message: `Chỉ hiện mainboard tương thích socket ${cpuSocket}`, 
        filterFn: (p: Product) => normalizeSocket(getProductSocket(p)) === normalizeSocket(cpuSocket)
      };
    }
    if (openCategory === "mainboard" && !cpuSocket) {
      return {
        message: "Chưa chọn CPU - Hiển thị toàn bộ Mainboard",
        filterFn: () => true // Pass all through
      };
    }
    if (openCategory === "cpu" && mbSocket) {
      return { 
        message: `Chỉ hiện CPU tương thích socket ${mbSocket}`, 
        filterFn: (p: Product) => normalizeSocket(getProductSocket(p)) === normalizeSocket(mbSocket)
      };
    }
    if (openCategory === "cpu" && !mbSocket) {
      return {
        message: "Chưa chọn Mainboard - Hiển thị toàn bộ CPU",
        filterFn: () => true
      };
    }
    if (openCategory === "ram" && mbRamType) {
      return {
        message: `Chỉ hiện RAM tương thích ${mbRamType}`,
        filterFn: (p: Product) => getProductRamType(p) === mbRamType,
      };
    }
    if (openCategory === "ram" && !hasMainboardSelected) {
      return {
        message: "Chưa chọn Mainboard - Hiển thị toàn bộ RAM",
        filterFn: () => true,
      };
    }
    if (openCategory === "ram" && hasMainboardSelected && !mbRamType) {
      return {
        message: "Đã chọn Mainboard nhưng không đọc được chuẩn DDR - Hiển thị toàn bộ RAM",
        filterFn: () => true,
      };
    }
    return null;
  }, [openCategory, slots]);

  // All products in the open category (with compatibility pre-filter)
  const allCategoryProducts = useMemo(
    () => {
      if (!openCategory) return [];
      let base = categoryProductsFromApi.filter((p) => categoryMatches(p.category, openCategory));
      if (compatibilityConstraint) base = base.filter(compatibilityConstraint.filterFn);
      return base;
    },
    [openCategory, compatibilityConstraint, categoryProductsFromApi]
  );

  // Brands with counts
  const brandOptions = useMemo(() => {
    const brands = Array.from(new Set<string>(allCategoryProducts.map(p => p.brand))).sort();
    
    // Count products per brand in current category
    const map = new Map<string, number>();
    allCategoryProducts.forEach(p => map.set(p.brand, (map.get(p.brand) || 0) + 1));
    
    return brands.map(brand => [brand, map.get(brand) || 0] as [string, number]);
  }, [allCategoryProducts]);

  const getSpecValue = (p: Product, filterCfg: FilterSpecConfig): string | null => {
    if (filterCfg.extractFn) return filterCfg.extractFn(p);
    return p.specs[filterCfg.key] || null;
  };

  // Spec filter options with counts
  const specFilterOptions = useMemo(() => {
    if (!openCategory) return {} as Record<string, { label: string; options: [string, number][] }>;

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

    const filterCfgs = categoryFilterSpecs[openCategory] || [];
    const result: Record<string, { label: string; options: [string, number][] }> = {};
    for (const cfg of filterCfgs) {
      const map = new Map<string, number>();
      allCategoryProducts.forEach(p => {
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

      if (options.length > 0) {
        result[cfg.key] = { label: cfg.label, options };
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

      const filterCfgs = openCategory ? (categoryFilterSpecs[openCategory] || []) : [];
      for (const [specKey, specVals] of Object.entries(selectedSpecs)) {
        if (specVals.length > 0) {
          const cfg = filterCfgs.find((f) => f.key === specKey);
          if (!cfg) continue;
          filtered = filtered.filter((p) => {
            const val = getSpecValue(p, cfg);
            return val !== null && specVals.includes(String(val));
          });
        }
      }
      if (stockOnly) {
        filtered = filtered.filter(p => p.stock > 0);
      }

      const sorted = [...filtered].sort((a, b) => {
        if (sortOption === "price-asc") return a.price - b.price;
        if (sortOption === "price-desc") return b.price - a.price;
        if (sortOption === "name-asc") return a.name.localeCompare(b.name, "vi");
        return b.name.localeCompare(a.name, "vi");
      });

      return sorted;
    },
    [openCategory, searchFilter, selectedBrands, selectedSpecs, stockOnly, allCategoryProducts, sortOption]
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
    setSortOption("price-asc");
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
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted/30">
                    <img
                      src={getProductImage(slot.product)}
                      alt={slot.product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = "https://placehold.co/120x120/png?text=No+Image";
                      }}
                    />
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
          {filledSlots > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={exportConfigurationExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Xuất Excel
              </Button>
              <Button variant="outline" onClick={printConfiguration}>
                <Printer className="mr-2 h-4 w-4" /> Xuất in
              </Button>
            </div>
          )}
          {warnings.length > 0 && filledSlots > 0 && (
            <p className="mt-2 text-xs text-center text-destructive">Hãy sửa lỗi tương thích trước khi thêm vào giỏ</p>
          )}
        </div>
      </div>

      {/* Product selection dialog */}
      <Dialog open={!!openCategory} onOpenChange={() => { setOpenCategory(null); clearAllFilters(); }}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-6xl">
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
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as "price-asc" | "price-desc" | "name-asc" | "name-desc")}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              aria-label="Sắp xếp sản phẩm"
            >
              <option value="price-asc">Giá tăng dần</option>
              <option value="price-desc">Giá giảm dần</option>
              <option value="name-asc">Tên A-Z</option>
              <option value="name-desc">Tên Z-A</option>
            </select>
            {hasActiveFilters && (
              <Button variant="destructive" size="sm" onClick={clearAllFilters}>
                Xóa bộ lọc
              </Button>
            )}
            <span className="text-sm text-muted-foreground whitespace-nowrap">{categoryProducts.length} sản phẩm</span>
          </div>

          {/* Content: Filter sidebar + Product list */}
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {/* Filter sidebar */}
            <div className="max-h-56 w-full shrink-0 overflow-y-auto border-b border-border p-4 space-y-5 md:max-h-none md:w-[220px] md:border-b-0 md:border-r">
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

              {Object.entries(specFilterOptions).map(([specKey, group]) => (
                <div key={specKey}>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">{group.label}</h4>
                  <div className="space-y-1.5">
                    {group.options.map(([val, count]) => (
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
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
            <div className="divide-y divide-border">
              {isCategoryLoading && (
                <div className="py-4">
                  <LoadingSkeleton count={3} />
                </div>
              )}
              {categoryProducts.map((p) => {
                const specsStr = Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join(", ");
                const isSelected = slots.find(s => s.category === openCategory)?.product?.id === p.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-start gap-4 py-4 ${isSelected ? "bg-primary/5 -mx-2 px-2 rounded-lg" : ""}`}
                  >
                    {/* Product image/icon */}
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
                      <img
                        src={getProductImage(p)}
                        alt={p.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = "https://placehold.co/120x120/png?text=No+Image";
                        }}
                      />
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
