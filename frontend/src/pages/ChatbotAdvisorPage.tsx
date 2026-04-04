import { useEffect, useMemo, useState } from "react";
import { Bot, CircleDollarSign, Cpu, Gamepad2, User2 } from "lucide-react";
import AdvisorNav from "@/components/shared/AdvisorNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { advisorClient, getAdvisorSessionId } from "@/lib/advisorClient";
import { getApiErrorMessage, unwrapApiData } from "@/lib/axiosClient";
import { formatPrice } from "@/lib/format";

type ChatRole = "assistant" | "user";

type ProductCard = {
  id: string;
  slot: string;
  categoryId?: string;
  category: string;
  name: string;
  price: number;
  summary?: string;
  image?: string;
  url?: string;
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  contentType: "text" | "products" | "actions";
  content: string;
  products?: ProductCard[];
  citations?: AdvisorCitation[];
  actions?: FilterActionGroup[];
};

type SelectedComponent = {
  id: string;
  slot: string;
  categoryId?: string;
  category: string;
  name: string;
  price: number;
  image?: string;
  url?: string;
};

type HiddenContext = {
  budget: string | null;
  purpose: string | null;
  brand: string | null;
  socket: string | null;
  ramDdr: string | null;
  ramBus: string | null;
};

type FilterActionGroup = {
  field: keyof HiddenContext;
  label: string;
  options: string[];
};

type InferredFilterPatch = Partial<HiddenContext>;

type AdvisorProductSuggestion = {
  productId: string;
  categoryId?: string | null;
  slot?: string | null;
  name: string;
  price?: number | null;
  image?: string | null;
  url?: string | null;
};

type AdvisorChatResponse = {
  answer: string;
  products: AdvisorProductSuggestion[];
  citations?: AdvisorCitation[];
};

type AdvisorCitation = {
  source: "db" | "web";
  title: string;
  url?: string | null;
  score?: number;
  snippet?: string | null;
};

type BuildSessionComponentResponse = {
  slot: string;
  productId: string;
  categoryId?: string | null;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
  url?: string | null;
};

type BuildSessionResponse = {
  sessionId: string;
  selectedComponents: BuildSessionComponentResponse[];
};


const budgetOptions = [
  "Dưới 10 triệu",
  "10 - 15 triệu",
  "15 - 20 triệu",
  "20 - 30 triệu",
  "Trên 30 triệu",
];

const usageOptions = ["Văn phòng", "Gaming", "Đồ họa 3D", "Stream"];

const brandOptions = ["Intel", "AMD", "NVIDIA", "ASUS", "MSI"];
const socketOptions = ["LGA 1700", "AM4", "AM5"];
const ramDdrOptions = ["DDR4", "DDR5"];
const ramBusOptions = ["3200 MHz", "3600 MHz", "5200 MHz", "5600 MHz", "6000 MHz"];

const FALLBACK_IMAGE = "https://placehold.co/96x96/png?text=No+Image";
const ADVISOR_CHAT_STATE_STORAGE_PREFIX = "advisor-chat-state";
const MAX_PERSISTED_CHAT_MESSAGES = 120;
const DEFAULT_VISIBLE_PRODUCTS_PER_MESSAGE = 4;
const EMPTY_FILTERS: HiddenContext = {
  budget: null,
  purpose: null,
  brand: null,
  socket: null,
  ramDdr: null,
  ramBus: null,
};

const initialMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "assistant",
    contentType: "text",
    content:
      "Xin chào, tôi là PC Advisor AI. Bạn có thể chọn nhanh tiêu chí ở cột trái rồi đặt câu hỏi ở khung chat. Tôi sẽ tự động nhận ngữ cảnh bộ lọc hiện tại khi bạn bấm Gửi.",
  },
];

type PersistedAdvisorChatState = {
  currentFilters: HiddenContext;
  messages: ChatMessage[];
  input: string;
};

function getAdvisorChatStateStorageKey(sessionId: string): string {
  return `${ADVISOR_CHAT_STATE_STORAGE_PREFIX}:${sessionId}`;
}

function sanitizeFilters(filters: unknown): HiddenContext {
  if (!filters || typeof filters !== "object") {
    return { budget: null, purpose: null, brand: null, socket: null, ramDdr: null, ramBus: null };
  }
  const value = filters as Partial<HiddenContext>;
  return {
    budget: typeof value.budget === "string" ? value.budget : null,
    purpose: typeof value.purpose === "string" ? value.purpose : null,
    brand: typeof value.brand === "string" ? value.brand : null,
    socket: typeof value.socket === "string" ? value.socket : null,
    ramDdr: typeof value.ramDdr === "string" ? value.ramDdr : null,
    ramBus: typeof value.ramBus === "string" ? value.ramBus : null,
  };
}

function sanitizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) {
    return initialMessages;
  }
  const sanitized = messages.filter((item): item is ChatMessage => {
    if (!item || typeof item !== "object") return false;
    const message = item as Partial<ChatMessage>;
    const isValidRole = message.role === "assistant" || message.role === "user";
    const isValidType =
      message.contentType === "text" ||
      message.contentType === "products" ||
      message.contentType === "actions";
    return typeof message.id === "string" && isValidRole && isValidType && typeof message.content === "string";
  });

  if (sanitized.length === 0) {
    return initialMessages;
  }

  return sanitized.slice(-MAX_PERSISTED_CHAT_MESSAGES);
}

function loadPersistedChatState(sessionId: string): PersistedAdvisorChatState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(getAdvisorChatStateStorageKey(sessionId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedAdvisorChatState>;
    return {
      currentFilters: sanitizeFilters(parsed.currentFilters),
      messages: sanitizeMessages(parsed.messages),
      input: typeof parsed.input === "string" ? parsed.input : "",
    };
  } catch {
    return null;
  }
}

function persistChatState(sessionId: string, state: PersistedAdvisorChatState): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload: PersistedAdvisorChatState = {
    currentFilters: state.currentFilters,
    messages: state.messages.slice(-MAX_PERSISTED_CHAT_MESSAGES),
    input: state.input,
  };

  try {
    localStorage.setItem(getAdvisorChatStateStorageKey(sessionId), JSON.stringify(payload));
  } catch {
    // Ignore storage quota or serialization issues.
  }
}


function inferSlot(categoryLike: string): string {
  const normalized = categoryLike.trim().toUpperCase();
  if (!normalized) return "OTHER";

  const map: Record<string, string> = {
    CPU: "CPU",
    GPU: "GPU",
    VGA: "GPU",
    MAINBOARD: "MAINBOARD",
    MOTHERBOARD: "MAINBOARD",
    RAM: "RAM",
    SSD: "SSD",
    HDD: "SSD",
    PSU: "PSU",
    CASE: "CASE",
    COOLER: "COOLER",
  };

  return map[normalized] || normalized;
}


function toProductCard(item: AdvisorProductSuggestion): ProductCard {
  const slot = inferSlot(item.slot || item.categoryId || "OTHER");
  return {
    id: item.productId,
    slot,
    categoryId: item.categoryId || undefined,
    category: slot,
    name: item.name,
    price: item.price || 0,
    summary: buildProductSummary(item.name, slot),
    image: item.image || undefined,
    url: item.url || undefined,
  };
}

function extractFirst(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[1] || match[0] : null;
}

function buildProductSummary(name: string, slot: string): string | undefined {
  const upper = name.toUpperCase();

  if (slot === "CPU") {
    const socket = extractFirst(upper, /(LGA\s?\d{3,4}|AM\d|S?TR\d+)/);
    const cores = extractFirst(upper, /(\d+)C\/(\d+)T/);
    const baseClock = extractFirst(upper, /(\d+(?:[\.,]\d+)?)\s*GHZ/);
    const parts = [cores, socket, baseClock ? `${baseClock}GHz` : null].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : undefined;
  }

  if (slot === "MAINBOARD") {
    const chipset = extractFirst(upper, /\b([A-Z]\d{3}[A-Z]?)\b/);
    const socket = extractFirst(upper, /(LGA\s?\d{3,4}|AM\d)/);
    const ddr = extractFirst(upper, /(DDR\d)/);
    const parts = [chipset, socket, ddr].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : undefined;
  }

  if (slot === "RAM") {
    const capacity = extractFirst(upper, /(\d+\s?GB)/);
    const ddr = extractFirst(upper, /(DDR\d)/);
    const mhz = extractFirst(upper, /(\d{4,5})\s?MHZ/);
    const parts = [capacity, ddr, mhz ? `${mhz}MHz` : null].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : undefined;
  }

  if (slot === "SSD") {
    const capacity = extractFirst(upper, /(\d+\s?(?:TB|GB))/);
    const protocol = upper.includes("NVME") ? "NVMe" : upper.includes("SATA") ? "SATA" : null;
    const form = upper.includes("M.2") ? "M.2" : null;
    const parts = [capacity, protocol, form].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : undefined;
  }

  if (slot === "GPU") {
    const model = extractFirst(upper, /((?:RTX|GTX|RX)\s?\d{3,4}(?:\s?TI|\s?SUPER)?)/);
    const vram = extractFirst(upper, /(\d+\s?GB)/);
    const parts = [model, vram].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : undefined;
  }

  if (slot === "PSU") {
    const watt = extractFirst(upper, /(\d{3,4})\s?W/);
    const rating = extractFirst(upper, /(80\+\s?(?:BRONZE|SILVER|GOLD|PLATINUM|TITANIUM))/);
    const parts = [watt ? `${watt}W` : null, rating].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : undefined;
  }

  if (slot === "CASE") {
    const form = extractFirst(upper, /(ATX|M-ATX|MATX|ITX|E-ATX)/);
    const fan = extractFirst(upper, /(\d+)\s?FAN/);
    const parts = [form, fan ? `${fan} fan` : null].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : undefined;
  }

  if (slot === "COOLER") {
    const type = upper.includes("AIO") || upper.includes("LIQUID") ? "Tản nước" : "Tản khí";
    const size = extractFirst(upper, /(120|240|280|360)\s?MM/);
    const parts = [type, size ? `${size}mm` : null].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : undefined;
  }

  const genericParts = name
    .split(/[(),\-|]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)
    .slice(1, 3);
  if (genericParts.length > 0) {
    return genericParts.join(" | ");
  }

  return "Thông số cơ bản";
}

function toSelectedComponent(item: BuildSessionComponentResponse): SelectedComponent {
  const slot = inferSlot(item.slot);
  return {
    id: item.productId,
    slot,
    categoryId: item.categoryId || undefined,
    category: slot,
    name: item.name,
    price: item.price,
    image: item.image || undefined,
    url: item.url || undefined,
  };
}

function buildFilterActions(filters: HiddenContext): FilterActionGroup[] {
  const actions: FilterActionGroup[] = [];
  if (!filters.budget) {
    actions.push({ field: "budget", label: "Ngân sách", options: budgetOptions });
  }
  if (!filters.purpose) {
    actions.push({ field: "purpose", label: "Nhu cầu sử dụng", options: usageOptions });
  }
  if (!filters.brand) {
    actions.push({ field: "brand", label: "Hãng", options: brandOptions });
  }
  if (!filters.socket) {
    actions.push({ field: "socket", label: "Socket", options: socketOptions });
  }
  if (!filters.ramDdr) {
    actions.push({ field: "ramDdr", label: "RAM DDR", options: ramDdrOptions });
  }
  return actions;
}

const filterFieldLabels: Record<keyof HiddenContext, string> = {
  budget: "Ngân sách",
  purpose: "Nhu cầu",
  brand: "Hãng",
  socket: "Socket",
  ramDdr: "RAM DDR",
  ramBus: "RAM bus",
};

function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferFiltersFromMessage(message: string, current: HiddenContext): InferredFilterPatch {
  const normalized = normalizeForSearch(message);
  const patch: InferredFilterPatch = {};

  if (!current.budget) {
    if (/duoi\s*10|<\s*10|10\s*trieu\s*do\s*lai/.test(normalized)) {
      patch.budget = "Dưới 10 triệu";
    } else if (/10\s*(-|den|toi|~)\s*15|10\s*15\s*trieu/.test(normalized)) {
      patch.budget = "10 - 15 triệu";
    } else if (/15\s*(-|den|toi|~)\s*20|15\s*20\s*trieu/.test(normalized)) {
      patch.budget = "15 - 20 triệu";
    } else if (/20\s*(-|den|toi|~)\s*30|20\s*30\s*trieu/.test(normalized)) {
      patch.budget = "20 - 30 triệu";
    } else if (/tren\s*30|>\s*30|30\s*trieu\s*tro\s*len/.test(normalized)) {
      patch.budget = "Trên 30 triệu";
    }
  }

  if (!current.purpose) {
    if (/gaming|choi\s*game|fps|valorant|lol|dota|esport/.test(normalized)) {
      patch.purpose = "Gaming";
    } else if (/van\s*phong|office|word|excel|hoc\s*tap/.test(normalized)) {
      patch.purpose = "Văn phòng";
    } else if (/do\s*hoa|3d|render|design|premiere|after\s*effects/.test(normalized)) {
      patch.purpose = "Đồ họa 3D";
    } else if (/stream|livestream|obs/.test(normalized)) {
      patch.purpose = "Stream";
    }
  }

  if (!current.brand) {
    if (/\bintel\b/.test(normalized)) {
      patch.brand = "Intel";
    } else if (/\bamd\b|ryzen/.test(normalized)) {
      patch.brand = "AMD";
    } else if (/nvidia|geforce|rtx|gtx/.test(normalized)) {
      patch.brand = "NVIDIA";
    } else if (/\basus\b/.test(normalized)) {
      patch.brand = "ASUS";
    } else if (/\bmsi\b/.test(normalized)) {
      patch.brand = "MSI";
    }
  }

  if (!current.socket) {
    if (/lga\s*1700|1700/.test(normalized)) {
      patch.socket = "LGA 1700";
    } else if (/\bam5\b/.test(normalized)) {
      patch.socket = "AM5";
    } else if (/\bam4\b/.test(normalized)) {
      patch.socket = "AM4";
    }
  }

  if (!current.ramDdr) {
    if (/ddr\s*5|\bddr5\b/.test(normalized)) {
      patch.ramDdr = "DDR5";
    } else if (/ddr\s*4|\bddr4\b/.test(normalized)) {
      patch.ramDdr = "DDR4";
    }
  }

  if (!current.ramBus) {
    const busMatch = normalized.match(/\b(3200|3600|5200|5600|6000)\s*(mhz)?\b/);
    if (busMatch) {
      patch.ramBus = `${busMatch[1]} MHz`;
    }
  }

  return patch;
}

function FilterGroup({
  title,
  icon,
  options,
  value,
  onSelect,
}: {
  title: string;
  icon: React.ReactNode;
  options: string[];
  value: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-2.5 sm:p-3">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground sm:text-sm">
        {icon}
        {title}
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`rounded-full border px-2 py-1 text-[10px] font-medium transition sm:px-2.5 sm:text-[11px] ${
              value === opt
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductCardInChat({
  product,
  onAdd,
}: {
  product: ProductCard;
  onAdd: (product: ProductCard) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-start gap-3">
        <img
          src={product.image || FALLBACK_IMAGE}
          alt={product.name}
          className="h-14 w-14 rounded-lg object-cover"
          loading="lazy"
        />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{product.category}</p>
          <p className="line-clamp-2 text-sm font-medium text-foreground">{product.name}</p>
          {product.summary && (
            <p className="mt-1 text-[11px] text-foreground/80">
              <span className="font-semibold text-foreground/90">Thông số:</span> {product.summary}
            </p>
          )}
          {product.url && (
            <a
              href={product.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-[11px] text-primary hover:underline"
            >
              Xem sản phẩm
            </a>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-primary">{formatPrice(product.price)}</p>
            <Button size="sm" onClick={() => onAdd(product)}>
              Thêm vào cấu hình
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[94%] rounded-2xl border border-border bg-card px-3 py-2 text-sm text-card-foreground sm:max-w-[90%] md:max-w-[85%]">
        <div className="mb-1 flex items-center gap-1 text-[11px] opacity-75">
          <Bot className="h-3 w-3" />
          <span>Advisor</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Đang suy nghĩ</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "120ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "240ms" }} />
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ChatbotAdvisorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessionId] = useState<string>(() => getAdvisorSessionId());
  const persistedState = useMemo(() => loadPersistedChatState(sessionId), [sessionId]);
  const [currentFilters, setCurrentFilters] = useState<HiddenContext>(
    () => persistedState?.currentFilters ?? EMPTY_FILTERS
  );
  const [selectedComponents, setSelectedComponents] = useState<SelectedComponent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => persistedState?.messages ?? initialMessages);
  const [input, setInput] = useState(() => persistedState?.input ?? "");
  const [isSending, setIsSending] = useState(false);
  const [isSyncingBuild, setIsSyncingBuild] = useState(false);
  const [expandedProductMessages, setExpandedProductMessages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    persistChatState(sessionId, {
      currentFilters,
      messages,
      input,
    });
  }, [sessionId, currentFilters, messages, input]);

  const addTextMessage = (role: ChatRole, content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        role,
        contentType: "text",
        content,
      },
    ]);
  };

  const addAssistantResponse = (content: string, products: ProductCard[], citations: AdvisorCitation[]) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        role: "assistant",
        contentType: products.length > 0 ? "products" : "text",
        content,
        products: products.length > 0 ? products : undefined,
        citations: citations.length > 0 ? citations : undefined,
      },
    ]);
  };

  const addFilterPrompt = (actions: FilterActionGroup[], content?: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        role: "assistant",
        contentType: "actions",
        content: content || "Bạn muốn chọn nhanh một vài tiêu chí trước khi tư vấn tiếp không?",
        actions,
      },
    ]);
  };

  const hasAnyFilter = (filters: HiddenContext) =>
    Boolean(filters.budget || filters.purpose || filters.brand || filters.socket || filters.ramDdr || filters.ramBus);

  const promptForFilters = (isReminder: boolean) => {
    const actions = buildFilterActions(currentFilters);
    if (actions.length === 0) return;
    if (isReminder) {
      addFilterPrompt(actions, "Bạn chưa chọn tiêu chí nào. Vui lòng chọn trước khi tiếp tục.");
    } else {
      addFilterPrompt(actions, "Bạn vui lòng chọn tiêu chí trước khi bắt đầu.");
    }
  };

  useEffect(() => {
    let isActive = true;

    const loadBuildSession = async () => {
      setIsSyncingBuild(true);
      try {
        const raw = await advisorClient.get(`/build-sessions/${encodeURIComponent(sessionId)}`);
        const data = unwrapApiData<BuildSessionResponse>(raw);
        if (!isActive) return;
        setSelectedComponents((data.selectedComponents || []).map(toSelectedComponent));
      } catch (error: unknown) {
        if (!isActive) return;
        addTextMessage("assistant", getApiErrorMessage(error, "Không thể tải phiên build hiện tại."));
      } finally {
        if (isActive) {
          setIsSyncingBuild(false);
        }
      }
    };

    void loadBuildSession();

    return () => {
      isActive = false;
    };
  }, [sessionId]);

  const updateFilter = (field: keyof HiddenContext, value: string) => {
    // Hidden state: chỉ cập nhật ngữ cảnh, không ghi gì vào khung chat.
    setCurrentFilters((prev) => ({ ...prev, [field]: value }));
  };

  const persistContextUpdate = async (filters: HiddenContext) => {
    try {
      await advisorClient.post("/chat/context", {
        sessionId,
        accountId: user?.id,
        context: {
          budget: filters.budget,
          purpose: filters.purpose,
          brand: filters.brand,
          socket: filters.socket,
          ramDdr: filters.ramDdr,
          ramBus: filters.ramBus,
        },
      });
    } catch (error: unknown) {
      toast({
        title: "Không thể lưu tiêu chí",
        description: getApiErrorMessage(error, "Vui lòng thử lại."),
      });
    }
  };

  const handleChatFilterSelect = async (field: keyof HiddenContext, value: string) => {
    const next = { ...currentFilters, [field]: value };
    setCurrentFilters(next);
    await persistContextUpdate(next);
    toast({
      title: "Đã cập nhật tiêu chí",
      description: `${filterFieldLabels[field]}: ${value}`,
    });
  };

  const clearAllFilters = async () => {
    setCurrentFilters(EMPTY_FILTERS);
    await persistContextUpdate(EMPTY_FILTERS);
    toast({
      title: "Đã xóa tiêu chí",
      description: "Bộ lọc đã được đặt lại.",
    });
  };

  const maybeAutoFillFiltersFromMessage = async (chatMessage: string): Promise<HiddenContext> => {
    const patch = inferFiltersFromMessage(chatMessage, currentFilters);
    const hasPatch = Boolean(
      patch.budget || patch.purpose || patch.brand || patch.socket || patch.ramDdr || patch.ramBus
    );
    if (!hasPatch) {
      return currentFilters;
    }

    const next: HiddenContext = {
      budget: patch.budget ?? currentFilters.budget,
      purpose: patch.purpose ?? currentFilters.purpose,
      brand: patch.brand ?? currentFilters.brand,
      socket: patch.socket ?? currentFilters.socket,
      ramDdr: patch.ramDdr ?? currentFilters.ramDdr,
      ramBus: patch.ramBus ?? currentFilters.ramBus,
    };
    setCurrentFilters(next);
    await persistContextUpdate(next);

    const filledParts = (["budget", "purpose", "brand", "socket", "ramDdr", "ramBus"] as const)
      .filter((key) => patch[key])
      .map((key) => `${filterFieldLabels[key]}: ${patch[key]}`);
    if (filledParts.length > 0) {
      toast({
        title: "Đã nhận diện tiêu chí từ tin nhắn",
        description: filledParts.join(" | "),
      });
    }

    return next;
  };

  const addSelectedPart = async (product: ProductCard) => {
    setIsSyncingBuild(true);
    try {
      const payload = {
        slot: product.slot,
        productId: product.id,
        categoryId: product.categoryId,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image,
        url: product.url,
      };
      const raw = await advisorClient.post(`/build-sessions/${encodeURIComponent(sessionId)}/components`, payload);
      const data = unwrapApiData<BuildSessionResponse>(raw);
      setSelectedComponents((data.selectedComponents || []).map(toSelectedComponent));
      toast({
        title: "Đã thêm vào cấu hình",
        description: `${product.name} (${product.category})`,
      });
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Không thể thêm linh kiện vào cấu hình.");
      const normalized = normalizeForSearch(message);
      const isCompatibilityIssue =
        normalized.includes("khong tuong thich") ||
        normalized.includes("khong phu hop") ||
        normalized.includes("socket");

      toast({
        title: isCompatibilityIssue ? "Linh kiện không tương thích" : "Không thể thêm linh kiện",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSyncingBuild(false);
    }
  };

  const requestAdvisor = async (chatMessage: string, appendUserMessage: boolean) => {
    if (isSending) return;

    let effectiveFilters = currentFilters;
    if (!hasAnyFilter(effectiveFilters)) {
      effectiveFilters = await maybeAutoFillFiltersFromMessage(chatMessage);
    }

    if (!hasAnyFilter(effectiveFilters)) {
      promptForFilters(true);
      return;
    }

    setIsSending(true);

    if (appendUserMessage) {
      addTextMessage("user", chatMessage);
    }

    try {
      const raw = await advisorClient.post(`/chat`, {
        sessionId,
        accountId: user?.id,
        query: chatMessage,
        context: {
          budget: effectiveFilters.budget,
          purpose: effectiveFilters.purpose,
          brand: effectiveFilters.brand,
          socket: effectiveFilters.socket,
          ramDdr: effectiveFilters.ramDdr,
          ramBus: effectiveFilters.ramBus,
          selectedComponents: selectedComponents.map((item) => ({
            slot: item.slot,
            productId: item.id,
            categoryId: item.categoryId,
            name: item.name,
            price: item.price,
          })),
        },
        options: {
          enableWebFallback: true,
        },
      });

      const response = unwrapApiData<AdvisorChatResponse>(raw);
      const assistantText = response.answer?.trim() || "Tạm thời chưa có gợi ý phù hợp, bạn thử thêm yêu cầu cụ thể hơn.";
      const products = (response.products || []).map(toProductCard);
      const citations = (response.citations || []).map((item) => ({
        source: item.source,
        title: item.title,
        url: item.url,
        score: item.score,
        snippet: item.snippet,
      }));
      addAssistantResponse(assistantText, products, citations);
    } catch (error: unknown) {
      addTextMessage("assistant", getApiErrorMessage(error, "Không thể kết nối tới AI advisor."));
    } finally {
      setIsSending(false);
    }
  };

  const requestQuickAdvice = async () => {
    if (!hasAnyFilter(currentFilters)) {
      promptForFilters(true);
      return;
    }

    await requestAdvisor("Hãy tư vấn cấu hình nhanh theo bộ lọc hiện tại.", false);
  };

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || isSending) return;
    setInput("");
    await requestAdvisor(question, true);
  };

  return (
    <section className="gradient-hero min-h-[calc(100vh-12rem)] py-4 sm:py-6 lg:py-8">
      <div className="container mx-auto px-3 sm:px-4">
        <AdvisorNav />

        <div className="mt-4 grid gap-4 lg:gap-6 lg:grid-cols-[32%_68%]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Tiêu chí tư vấn</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  disabled={!hasAnyFilter(currentFilters)}
                >
                  Xóa tiêu chí
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <FilterGroup
                  title="Ngân sách"
                  icon={<CircleDollarSign className="h-4 w-4 text-primary" />}
                  options={budgetOptions}
                  value={currentFilters.budget}
                  onSelect={(value) => updateFilter("budget", value)}
                />
                <FilterGroup
                  title="Nhu cầu sử dụng"
                  icon={<Gamepad2 className="h-4 w-4 text-primary" />}
                  options={usageOptions}
                  value={currentFilters.purpose}
                  onSelect={(value) => updateFilter("purpose", value)}
                />
              </div>

              <div className="mt-3 grid gap-3">
                <FilterGroup
                  title="Hãng"
                  icon={<Cpu className="h-4 w-4 text-primary" />}
                  options={brandOptions}
                  value={currentFilters.brand}
                  onSelect={(value) => updateFilter("brand", value)}
                />
                <FilterGroup
                  title="Socket"
                  icon={<Cpu className="h-4 w-4 text-primary" />}
                  options={socketOptions}
                  value={currentFilters.socket}
                  onSelect={(value) => updateFilter("socket", value)}
                />
                <FilterGroup
                  title="RAM DDR (ưu tiên)"
                  icon={<Cpu className="h-4 w-4 text-primary" />}
                  options={ramDdrOptions}
                  value={currentFilters.ramDdr}
                  onSelect={(value) => updateFilter("ramDdr", value)}
                />
                <FilterGroup
                  title="RAM bus MHz (nâng cao)"
                  icon={<Cpu className="h-4 w-4 text-primary" />}
                  options={ramBusOptions}
                  value={currentFilters.ramBus}
                  onSelect={(value) => updateFilter("ramBus", value)}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">
                  Bấm nút bên dưới để nhận gợi ý nhanh từ AI.
                </p>
                <Button className="mt-3 w-full" onClick={requestQuickAdvice} disabled={isSending || isSyncingBuild}>
                  {isSending ? "Đang tư vấn..." : "AI tư vấn ngay"}
                </Button>
              </div>
            </div>
          </aside>

          <section className="flex min-h-[620px] flex-col rounded-2xl border border-border bg-card p-3 sm:p-4 md:p-5 lg:h-[calc(100vh-12rem)] lg:min-h-0">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">PC Advisor AI</p>
                  <p className="text-xs text-muted-foreground">
                    Trạng thái: {isSending ? "Đang phân tích" : isSyncingBuild ? "Đang đồng bộ cấu hình" : "Sẵn sàng tư vấn"}
                  </p>
                </div>
              </div>
            </div>

            <div className="h-[60vh] space-y-3 overflow-y-auto rounded-xl border border-border bg-background p-3 sm:h-[64vh] lg:h-auto lg:flex-1">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[94%] rounded-2xl px-3 py-2 text-sm sm:max-w-[90%] md:max-w-[85%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-card-foreground"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-1 text-[11px] opacity-75">
                      {msg.role === "user" ? <User2 className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                      <span>{msg.role === "user" ? "Bạn" : "Advisor"}</span>
                    </div>
                    <p>{msg.content}</p>
                    {msg.contentType === "products" && msg.products && msg.products.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="rounded-md border border-border/70 bg-background px-2 py-1 text-[11px] text-muted-foreground">
                          Danh sach nay la cac lua chon thay the theo tung nhom linh kien. Ban chi can chon 1 san pham phu hop cho moi nhom.
                        </p>
                        {(expandedProductMessages[msg.id]
                          ? msg.products
                          : msg.products.slice(0, DEFAULT_VISIBLE_PRODUCTS_PER_MESSAGE)
                        ).map((product) => (
                          <ProductCardInChat
                            key={`chat-product-${msg.id}-${product.id}`}
                            product={product}
                            onAdd={addSelectedPart}
                          />
                        ))}
                        {msg.products.length > DEFAULT_VISIBLE_PRODUCTS_PER_MESSAGE && (
                          <div className="pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setExpandedProductMessages((prev) => ({
                                  ...prev,
                                  [msg.id]: !prev[msg.id],
                                }))
                              }
                            >
                              {expandedProductMessages[msg.id]
                                ? "Thu gọn"
                                : `Xem thêm ${msg.products.length - DEFAULT_VISIBLE_PRODUCTS_PER_MESSAGE} sản phẩm`}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    {msg.contentType === "actions" && msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {msg.actions.map((group) => (
                          <div key={`${msg.id}-${group.field}`}>
                            <p className="text-xs font-semibold text-muted-foreground">{group.label}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {group.options.map((option) => {
                                const isActive = currentFilters[group.field] === option;
                                return (
                                  <button
                                    key={`${msg.id}-${group.field}-${option}`}
                                    onClick={() => handleChatFilterSelect(group.field, option)}
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                                      isActive
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                    }`}
                                  >
                                    {option}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isSending && <ThinkingBubble />}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Nhập yêu cầu build PC của bạn..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
              />
              <Button className="w-full sm:w-auto" onClick={sendMessage} disabled={isSending || isSyncingBuild}>
                {isSending ? "Đang gửi..." : "Gửi"}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
