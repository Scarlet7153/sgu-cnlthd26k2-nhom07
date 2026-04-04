import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";

import AdvisorNav from "@/components/shared/AdvisorNav";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { advisorClient, getAdvisorSessionId } from "@/lib/advisorClient";
import { getApiErrorMessage, unwrapApiData } from "@/lib/axiosClient";
import { formatPrice } from "@/lib/format";

const FALLBACK_IMAGE = "https://placehold.co/120x120/png?text=No+Image";
const REQUIRED_SLOTS = ["CPU", "MAINBOARD", "RAM", "SSD", "PSU", "CASE", "COOLER"] as const;

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

type BuildCheckoutValidateResponse = {
  sessionId: string;
  ready: boolean;
  missingSlots: string[];
  totalPrice: number;
};

type BuildRow =
  | { kind: "item"; item: BuildSessionComponentResponse }
  | { kind: "placeholder"; slot: string };

function formatSlotLabel(slot: string): string {
  const normalized = slot.trim().toUpperCase();
  const labels: Record<string, string> = {
    CPU: "CPU",
    MAINBOARD: "Mainboard",
    RAM: "RAM",
    GPU: "GPU",
    SSD: "SSD",
    PSU: "Nguồn PSU",
    CASE: "Vỏ case",
    COOLER: "Tản nhiệt",
  };
  return labels[normalized] || normalized;
}

export default function AdvisorBuildPage() {
  const { toast } = useToast();
  const [sessionId] = useState<string>(() => getAdvisorSessionId());
  const [components, setComponents] = useState<BuildSessionComponentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [checkoutValidation, setCheckoutValidation] = useState<BuildCheckoutValidateResponse | null>(null);

  const totalPrice = useMemo(
    () => components.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0),
    [components]
  );

  const buildRows = useMemo<BuildRow[]>(() => {
    const normalized = new Map(
      components.map((item) => [item.slot.trim().toUpperCase(), item])
    );
    const rows: BuildRow[] = REQUIRED_SLOTS.map((slot) => {
      const found = normalized.get(slot);
      if (found) {
        return { kind: "item", item: found };
      }
      return { kind: "placeholder", slot };
    });

    const extras = components.filter(
      (item) => !REQUIRED_SLOTS.includes(item.slot.trim().toUpperCase() as (typeof REQUIRED_SLOTS)[number])
    );
    extras.forEach((item) => rows.push({ kind: "item", item }));
    return rows;
  }, [components]);

  const loadBuildSession = async () => {
    setIsLoading(true);
    try {
      const raw = await advisorClient.get(`/build-sessions/${encodeURIComponent(sessionId)}`);
      const data = unwrapApiData<BuildSessionResponse>(raw);
      setComponents(data.selectedComponents || []);
    } catch (error: unknown) {
      toast({
        title: "Không thể tải bảng cấu hình",
        description: getApiErrorMessage(error, "Vui lòng thử lại sau."),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateCheckout = async () => {
    setIsValidating(true);
    try {
      const raw = await advisorClient.post(`/build-sessions/${encodeURIComponent(sessionId)}/checkout-validate`);
      const data = unwrapApiData<BuildCheckoutValidateResponse>(raw);
      setCheckoutValidation(data);
    } catch (error: unknown) {
      toast({
        title: "Không thể kiểm tra checkout",
        description: getApiErrorMessage(error, "Vui lòng thử lại."),
      });
    } finally {
      setIsValidating(false);
    }
  };

  const removeComponent = async (slot: string) => {
    const target = components.find((item) => item.slot === slot);
    try {
      const raw = await advisorClient.delete(
        `/build-sessions/${encodeURIComponent(sessionId)}/components/${encodeURIComponent(slot)}`
      );
      const data = unwrapApiData<BuildSessionResponse>(raw);
      setComponents(data.selectedComponents || []);
      setCheckoutValidation(null);
      toast({
        title: "Đã xóa linh kiện",
        description: target
          ? `${target.name} (${formatSlotLabel(slot)}) đã được bỏ khỏi bảng cấu hình.`
          : `Slot ${formatSlotLabel(slot)} đã được cập nhật.`,
      });
    } catch (error: unknown) {
      toast({
        title: "Không thể xóa linh kiện",
        description: getApiErrorMessage(error, "Vui lòng thử lại."),
      });
    }
  };

  useEffect(() => {
    void loadBuildSession();
  }, [sessionId]);

  return (
    <section className="gradient-hero min-h-[calc(100vh-12rem)] py-4 sm:py-6 lg:py-8">
      <div className="container mx-auto px-3 sm:px-4">
        <AdvisorNav />

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-foreground">Bảng cấu hình PC</h2>
                <p className="text-xs text-muted-foreground">Session: {sessionId}</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadBuildSession} disabled={isLoading}>
                {isLoading ? "Đang tải..." : "Tải lại"}
              </Button>
            </div>

            {components.length === 0 && !isLoading ? (
              <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-background p-6 text-center">
                <p className="text-sm text-muted-foreground">Chưa có linh kiện nào được chọn từ khung chat.</p>
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background">
                <div className="hidden grid-cols-[2.2fr_0.9fr_0.6fr_0.9fr_0.9fr_0.6fr] bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                  <span>Linh kiện</span>
                  <span>Danh mục</span>
                  <span>SL</span>
                  <span>Đơn giá</span>
                  <span>Tạm tính</span>
                  <span className="text-right">Thao tác</span>
                </div>
                <div className="divide-y divide-border/70">
                  {buildRows.map((row, index) => {
                    if (row.kind === "placeholder") {
                      return (
                        <div
                          key={`placeholder-${row.slot}-${index}`}
                          className="grid gap-3 px-3 py-3 md:grid-cols-[2.2fr_0.9fr_0.6fr_0.9fr_0.9fr_0.6fr]"
                        >
                          <div className="flex gap-3">
                            <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/30">
                              <span className="text-[10px] font-semibold text-muted-foreground">Chưa chọn</span>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground md:hidden">Linh kiện</p>
                              <p className="text-sm font-semibold text-foreground">{formatSlotLabel(row.slot)}</p>
                              <p className="text-xs text-muted-foreground">Chưa có linh kiện trong cấu hình.</p>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <p className="md:hidden">Danh mục</p>
                            <p className="text-sm font-medium text-muted-foreground">{formatSlotLabel(row.slot)}</p>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <p className="md:hidden">Số lượng</p>
                            <p className="text-sm font-medium text-muted-foreground">-</p>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <p className="md:hidden">Đơn giá</p>
                            <p className="text-sm font-medium text-muted-foreground">-</p>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <p className="md:hidden">Tạm tính</p>
                            <p className="text-sm font-medium text-muted-foreground">-</p>
                          </div>
                          <div className="flex items-start justify-end">
                            <Button variant="outline" size="sm" disabled>
                              Chưa có
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    const item = row.item;
                    const lineTotal = (item.price || 0) * (item.quantity || 1);
                    return (
                      <div
                        key={item.productId}
                        className="grid gap-3 px-3 py-3 md:grid-cols-[2.2fr_0.9fr_0.6fr_0.9fr_0.9fr_0.6fr]"
                      >
                        <div className="flex gap-3">
                          <img
                            src={item.image || FALLBACK_IMAGE}
                            alt={item.name}
                            className="h-20 w-20 rounded-lg object-cover"
                            loading="lazy"
                          />
                          <div>
                            <p className="text-xs text-muted-foreground md:hidden">Linh kiện</p>
                            <p className="text-sm font-semibold text-foreground">{item.name}</p>
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                Xem sản phẩm <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p className="md:hidden">Danh mục</p>
                          <p className="text-sm font-medium text-foreground">{formatSlotLabel(item.slot)}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p className="md:hidden">Số lượng</p>
                          <p className="text-sm font-medium text-foreground">x{item.quantity}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p className="md:hidden">Đơn giá</p>
                          <p className="text-sm font-semibold text-foreground">{formatPrice(item.price)}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p className="md:hidden">Tạm tính</p>
                          <p className="text-sm font-semibold text-foreground">{formatPrice(lineTotal)}</p>
                        </div>
                        <div className="flex items-start justify-end">
                          <Button variant="destructive" size="sm" onClick={() => removeComponent(item.slot)}>
                            <Trash2 className="h-4 w-4" />
                            Xóa
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Tổng quan</h3>
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">Tổng tạm tính</p>
              <p className="text-lg font-bold text-primary">{formatPrice(totalPrice)}</p>
            </div>

            <Button
              className="mt-3 w-full"
              variant="secondary"
              onClick={validateCheckout}
              disabled={isValidating}
            >
              {isValidating ? "Đang kiểm tra..." : "Kiểm tra sẵn sàng checkout"}
            </Button>

            {checkoutValidation && (
              <div className="mt-3 rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-semibold text-foreground">
                  Trạng thái: {checkoutValidation.ready ? "Sẵn sàng" : "Chưa sẵn sàng"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tổng xác nhận: {formatPrice(checkoutValidation.totalPrice)}
                </p>
                {!checkoutValidation.ready && checkoutValidation.missingSlots.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {checkoutValidation.missingSlots.map((slot) => (
                      <span
                        key={`missing-${slot}`}
                        className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"
                      >
                        Thiếu {formatSlotLabel(slot)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Mục tiêu</p>
              <p className="text-sm font-semibold text-foreground">Mở sản phẩm ở trang thanh toán</p>
              <Button className="mt-2 w-full" asChild>
                <a href="/checkout">Thanh toán</a>
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
