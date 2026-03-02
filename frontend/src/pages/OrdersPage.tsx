import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useOrders } from "@/context/OrderContext";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Package, User, ChevronRight } from "lucide-react";

export default function OrdersPage() {
  document.title = "Lịch sử đơn hàng - TechPC";
  const { user } = useAuth();
  const { orders } = useOrders();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <User className="mx-auto h-16 w-16 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-bold text-foreground">Bạn chưa đăng nhập</h2>
        <p className="mt-2 text-muted-foreground">Vui lòng đăng nhập để xem đơn hàng.</p>
        <Link to="/login">
          <Button className="mt-6">Đăng nhập</Button>
        </Link>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy",
  };

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    shipping: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">Trang chủ</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Đơn hàng của tôi</span>
      </div>

      <h1 className="mb-8 text-2xl font-bold text-foreground">Đơn hàng của tôi</h1>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <Package className="mx-auto h-16 w-16 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-bold text-foreground">Chưa có đơn hàng</h2>
          <p className="mt-2 text-muted-foreground">Bạn chưa đặt đơn hàng nào.</p>
          <Link to="/products">
            <Button className="mt-6">Mua sắm ngay</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/order/${order.id}`}
              className="block rounded-lg border border-border bg-card transition-colors hover:border-primary/30"
            >
              <div className="flex items-center justify-between border-b border-border px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    Đơn #{order.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[order.status]}`}>
                    {statusLabel[order.status]}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString("vi-VN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <div className="px-6 py-4">
                <div className="space-y-2">
                  {order.items.slice(0, 3).map(({ product, quantity }) => (
                    <div key={product.id} className="flex items-center justify-between text-sm">
                      <span className="line-clamp-1 flex-1 text-muted-foreground">
                        {product.name} × {quantity}
                      </span>
                      <span className="ml-4 shrink-0 text-foreground">{formatPrice(product.price * quantity)}</span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      ... và {order.items.length - 3} sản phẩm khác
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">{order.items.length} sản phẩm</span>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">Tổng: </span>
                    <span className="text-base font-bold text-primary">{formatPrice(order.totalPrice)}</span>
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
