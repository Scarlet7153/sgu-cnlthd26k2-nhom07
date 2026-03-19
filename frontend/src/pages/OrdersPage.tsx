import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useOrders, Order } from "@/hooks/useOrders";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Package, User, ChevronRight, Loader2, RefreshCw } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  pending:   "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping:  "Đang giao",
  delivered: "Đã giao",
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
  COD:           "COD",
  MOMO:          "MoMo",
  VNPAY:         "VNPay",
  BANK_TRANSFER: "Chuyển khoản",
};

export default function OrdersPage() {
  document.title = "Lịch sử đơn hàng - PCShop";

  const { user } = useAuth();
  const { orders, loading, error, fetchOrders } = useOrders();
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (user?.id) fetchOrders();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <User className="mx-auto h-16 w-16 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-bold text-foreground">Bạn chưa đăng nhập</h2>
        <p className="mt-2 text-muted-foreground">Vui lòng đăng nhập để xem đơn hàng.</p>
        <Link to="/login"><Button className="mt-6">Đăng nhập</Button></Link>
      </div>
    );
  }

  const tabs = [
    { key: "all", label: "Tất cả" },
    { key: "unpaid", label: "Chưa thanh toán" },
    { key: "pending", label: "Chờ xác nhận" },
    { key: "confirmed", label: "Đã xác nhận" },
    { key: "shipping", label: "Đang giao" },
    { key: "delivered", label: "Đã giao" },
    { key: "cancelled", label: "Đã hủy" },
  ];

  const getUnpaidOrders = () => orders.filter((o) => 
    o.paymentStatus === "unpaid" && 
    o.status !== "cancelled" && 
    ["MOMO", "VNPAY", "BANK_TRANSFER", "momo", "banking"].includes(o.paymentMethod)
  );

  const filtered: Order[] = filter === "all"
    ? orders
    : filter === "unpaid"
    ? getUnpaidOrders()
    : orders.filter((o) => o.status === filter);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">Trang chủ</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Đơn hàng của tôi</span>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Đơn hàng của tôi</h1>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t.label}
            {t.key !== "all" && (
              <span className="ml-1.5 text-xs opacity-75">
                ({t.key === "unpaid" 
                  ? getUnpaidOrders().length 
                  : orders.filter((o) => o.status === t.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Đang tải đơn hàng...</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchOrders}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <Package className="mx-auto h-16 w-16 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-bold text-foreground">
            {filter === "all" ? "Chưa có đơn hàng" : `Không có đơn hàng "${STATUS_LABEL[filter]}"`}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {filter === "all" ? "Bạn chưa đặt đơn hàng nào." : "Không tìm thấy đơn hàng nào trong mục này."}
          </p>
          {filter === "all" && (
            <Link to="/products"><Button className="mt-6">Mua sắm ngay</Button></Link>
          )}
        </div>
      )}

      {/* Orders list */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((order) => (
            <Link
              key={order.id}
              to={`/order/${order.id}`}
              className="block rounded-lg border border-border bg-card transition-colors hover:border-primary/30 hover:shadow-sm"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    Đơn #{order.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[order.status] ?? STATUS_COLOR.pending}`}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                  {order.paymentStatus === "unpaid" && order.status !== "cancelled" && ["MOMO", "VNPAY", "BANK_TRANSFER", "momo", "banking"].includes(order.paymentMethod) && (
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                      Chưa thanh toán
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString("vi-VN", {
                    year: "numeric", month: "long", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Items preview */}
              <div className="px-6 py-4">
                <div className="space-y-2">
                  {order.items.slice(0, 3).map((item, i) => (
                    <div key={`${item.productId}-${i}`} className="flex items-center justify-between text-sm">
                      <span className="line-clamp-1 flex-1 text-muted-foreground">
                        {item.productName} × {item.quantity}
                      </span>
                      <span className="ml-4 shrink-0 text-foreground">
                        {formatPrice(item.totalPrice ?? item.productPrice * item.quantity)}
                      </span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <p className="text-xs text-muted-foreground">... và {order.items.length - 3} sản phẩm khác</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{order.items.length} sản phẩm</span>
                    <span>·</span>
                    <span>{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">Tổng: </span>
                    <span className="text-base font-bold text-primary">{formatPrice(order.total)}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
