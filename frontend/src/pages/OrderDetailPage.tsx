import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useOrders, Order } from "@/hooks/useOrders";
import { formatPrice } from "@/lib/format";
import {
  ChevronRight, Package, MapPin, CreditCard, Phone, Mail,
  StickyNote, Loader2, XCircle, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABEL: Record<string, string> = {
  pending:   "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping:  "Đang giao hàng",
  delivered: "Đã giao hàng",
  cancelled: "Đã hủy",
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  shipping:  "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const PAYMENT_LABEL: Record<string, string> = {
  COD:           "Thanh toán khi nhận hàng (COD)",
  MOMO:          "Ví MoMo",
  VNPAY:         "VNPay",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  cod:           "Thanh toán khi nhận hàng (COD)",
  banking:       "Chuyển khoản ngân hàng",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getOrder, cancelOrder, retryPayment, loading } = useOrders();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [fetching, setFetching] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!id) return;
    setFetching(true);
    getOrder(id).then((data) => {
      setOrder(data);
      setFetching(false);
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (fetching) {
    return (
      <div className="container mx-auto flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Đang tải đơn hàng...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="mx-auto h-16 w-16 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-bold text-foreground">Không tìm thấy đơn hàng</h2>
        <p className="mt-2 text-muted-foreground">Đơn hàng không tồn tại hoặc bạn không có quyền xem.</p>
        <Link to="/orders" className="mt-6 inline-block text-primary hover:underline">
          ← Quay lại danh sách đơn hàng
        </Link>
      </div>
    );
  }

  document.title = `Đơn #${order.id.slice(0, 8).toUpperCase()} - PCShop`;

  const steps = ["pending", "confirmed", "shipping", "delivered"];
  const currentStep = steps.indexOf(order.status);
  const isCancelled = order.status === "cancelled";
  const canCancel = order.status === "pending";

  const handleCancel = async () => {
    if (!window.confirm("Bạn có chắc muốn hủy đơn hàng này không?")) return;
    setCancelling(true);
    const ok = await cancelOrder(order.id);
    setCancelling(false);
    if (ok) {
      setOrder((prev) => prev ? { ...prev, status: "cancelled" } : prev);
      toast({ title: "Đã hủy đơn hàng", description: `Đơn #${order.id.slice(0, 8).toUpperCase()} đã được hủy.` });
    } else {
      toast({ title: "Không thể hủy đơn hàng", variant: "destructive" });
    }
  };

  const handleRetryPayment = async () => {
    try {
      setRetrying(true);
      toast({ title: "Đang chuyển hướng...", description: "Đang mở cổng thanh toán MoMo." });
      const payUrl = await retryPayment(order.id, order.total);
      if (payUrl) {
        window.location.href = payUrl;
      }
    } catch (err: any) {
      toast({ title: "Lỗi khởi tạo thanh toán", description: err.message || "Vui lòng thử lại sau.", variant: "destructive" });
    } finally {
      setRetrying(false);
    }
  };

  const addr = order.shippingAddress;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">Trang chủ</Link>
        <ChevronRight className="h-4 w-4" />
        <Link to="/orders" className="hover:text-primary">Đơn hàng</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
      </div>

      {/* Title row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Đơn hàng #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Đặt lúc{" "}
            {new Date(order.createdAt).toLocaleDateString("vi-VN", {
              year: "numeric", month: "long", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-4 py-1.5 text-sm font-medium ${STATUS_COLOR[order.status] ?? STATUS_COLOR.pending}`}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
          {canCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Hủy đơn hàng
            </Button>
          )}
        </div>
      </div>

      {/* Progress tracker */}
      {!isCancelled && (
        <div className="mb-8 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-5 text-sm font-semibold text-card-foreground">Trạng thái đơn hàng</h2>
          <div className="flex items-center justify-between">
            {steps.map((step, i) => (
              <div key={step} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                      i < currentStep
                        ? "bg-primary text-primary-foreground"
                        : i === currentStep
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < currentStep ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                  </div>
                  <span
                    className={`mt-2 text-center text-xs ${
                      i <= currentStep ? "font-medium text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {STATUS_LABEL[step]}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 flex-1 transition-colors ${
                      i < currentStep ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="mb-8 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <XCircle className="h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">Đơn hàng đã bị hủy</p>
            {order.cancelReason && (
              <p className="text-xs text-destructive/80">Lý do: {order.cancelReason}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order items */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-card-foreground">Sản phẩm đã đặt</h2>
            <div className="space-y-4">
              {order.items.map((item, i) => (
                <div key={`${item.productId}-${i}`} className="flex items-center gap-4 rounded-lg border border-border p-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {(item as any).productImage ? (
                      <img
                        src={(item as any).productImage}
                        alt={item.productName}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = "https://placehold.co/128x128/png?text=PC"; }}
                      />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2">{item.productName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Số lượng: {item.quantity} · {formatPrice(item.productPrice)} / sp
                    </p>
                    {item.warrantyMonths && (
                      <p className="text-xs text-muted-foreground">Bảo hành: {item.warrantyMonths} tháng</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      {formatPrice(item.totalPrice ?? item.productPrice * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-4 border-t border-border pt-4 space-y-1.5">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tạm tính ({order.items.length} sản phẩm)</span>
                <span>{formatPrice(order.total)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Phí vận chuyển</span>
                <span className="text-green-600">Miễn phí</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span className="text-foreground">Tổng cộng</span>
                <span className="text-primary">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Shipping address */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-card-foreground">
              <MapPin className="h-4 w-4 text-primary" /> Địa chỉ giao hàng
            </h3>
            {addr ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{addr.fullName}</p>
                <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {addr.phone}</p>
                {addr.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {addr.email}</p>}
                <p>{addr.address}</p>
                {addr.note && (
                  <p className="flex items-start gap-2 rounded bg-muted p-2 text-xs">
                    <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {addr.note}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có thông tin địa chỉ.</p>
            )}
          </div>

          {/* Payment */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-card-foreground">
              <CreditCard className="h-4 w-4 text-primary" /> Thanh toán
            </h3>
            <p className="text-sm text-muted-foreground">
              {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
            </p>
            {order.paymentStatus && (
              <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                order.paymentStatus === "paid"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : order.paymentStatus === "refunded"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
              }`}>
                {order.paymentStatus === "paid" ? "Đã thanh toán"
                  : order.paymentStatus === "refunded" ? "Đã hoàn tiền"
                  : "Chưa thanh toán"}
              </span>
            )}

            {!isCancelled && order.paymentMethod === "MOMO" && order.paymentStatus !== "paid" && (
              <Button
                size="sm"
                variant="outline"
                className="mt-4 w-full border-pink-500 text-pink-600 hover:bg-pink-50"
                onClick={handleRetryPayment}
                disabled={retrying}
              >
                {retrying && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Thanh toán lại bằng MoMo
              </Button>
            )}
          </div>

          {/* Note */}
          {order.note && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-card-foreground">
                <StickyNote className="h-4 w-4 text-primary" /> Ghi chú
              </h3>
              <p className="text-sm text-muted-foreground">{order.note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
