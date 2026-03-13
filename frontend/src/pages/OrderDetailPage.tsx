import { useParams, Link } from "react-router-dom";
import { useOrders } from "@/context/OrderContext";
import { formatPrice } from "@/lib/format";
import { ChevronRight, Package, MapPin, CreditCard, Phone, Mail, StickyNote } from "lucide-react";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getOrder } = useOrders();
  const order = id ? getOrder(id) : undefined;

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="mx-auto h-16 w-16 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-bold text-foreground">Không tìm thấy đơn hàng</h2>
        <p className="mt-2 text-muted-foreground">Đơn hàng không tồn tại hoặc đã bị xóa.</p>
        <Link to="/orders" className="mt-6 inline-block text-primary hover:underline">
          ← Quay lại danh sách đơn hàng
        </Link>
      </div>
    );
  }

  document.title = `Đơn #${order.id.slice(0, 8).toUpperCase()} - TechPC`;

  const statusLabel: Record<string, string> = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao hàng",
    delivered: "Đã giao hàng",
    cancelled: "Đã hủy",
  };

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    shipping: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const steps = ["pending", "confirmed", "shipping", "delivered"];
  const currentStep = steps.indexOf(order.status);
  const isCancelled = order.status === "cancelled";

  const paymentLabel = order.paymentMethod === "cod" ? "Thanh toán khi nhận hàng (COD)" : "Chuyển khoản ngân hàng";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">Trang chủ</Link>
        <ChevronRight className="h-4 w-4" />
        <Link to="/orders" className="hover:text-primary">Đơn hàng</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Đơn hàng #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Đặt lúc {new Date(order.createdAt).toLocaleDateString("vi-VN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <span className={`rounded-full px-4 py-1.5 text-sm font-medium ${statusColor[order.status]}`}>
          {statusLabel[order.status]}
        </span>
      </div>

      {/* Order Progress */}
      {!isCancelled && (
        <div className="mb-8 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-card-foreground">Trạng thái đơn hàng</h2>
          <div className="flex items-center justify-between">
            {steps.map((step, i) => (
              <div key={step} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      i <= currentStep
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className={`mt-2 text-xs ${i <= currentStep ? "font-medium text-primary" : "text-muted-foreground"}`}>
                    {statusLabel[step]}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`mx-2 h-0.5 flex-1 ${i < currentStep ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order Items */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-card-foreground">Sản phẩm đã đặt</h2>
            <div className="space-y-4">
              {order.items.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center gap-4 rounded-lg border border-border p-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    <img
                      src={product.images?.[0]}
                      alt={product.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = "https://placehold.co/128x128/png?text=No+Image";
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <Link to={`/product/${product.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {product.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">Số lượng: {quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatPrice(product.price * quantity)}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(product.price)} / sp</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tạm tính</span>
                <span>{formatPrice(order.totalPrice)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm text-muted-foreground">
                <span>Phí vận chuyển</span>
                <span className="text-green-600">Miễn phí</span>
              </div>
              <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-bold">
                <span className="text-foreground">Tổng cộng</span>
                <span className="text-primary">{formatPrice(order.totalPrice)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Info Sidebar */}
        <div className="space-y-4">
          {/* Shipping Address */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-card-foreground">
              <MapPin className="h-4 w-4 text-primary" /> Địa chỉ giao hàng
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{order.address.fullName}</p>
              <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {order.address.phone}</p>
              {order.address.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {order.address.email}</p>}
              <p>{order.address.address}</p>
              {order.address.note && (
                <p className="flex items-start gap-2 rounded bg-muted p-2 text-xs">
                  <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {order.address.note}
                </p>
              )}
            </div>
          </div>

          {/* Payment Method */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-card-foreground">
              <CreditCard className="h-4 w-4 text-primary" /> Phương thức thanh toán
            </h3>
            <p className="text-sm text-muted-foreground">{paymentLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
