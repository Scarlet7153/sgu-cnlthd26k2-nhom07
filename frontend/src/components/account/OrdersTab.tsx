import { Link } from "react-router-dom";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import type { Order } from "@/hooks/useOrders";

interface OrdersTabProps {
  orders: Order[];
}

const statusLabel: Record<string, string> = {
  pending: "Chờ xác nhận", confirmed: "Đã xác nhận", shipping: "Đang giao",
  delivered: "Đã giao", cancelled: "Đã hủy",
};

const statusColor: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  shipping:  "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function OrdersTab({ orders }: OrdersTabProps) {
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-card-foreground">Đơn hàng gần đây</h2>
        <Link to="/orders" className="text-sm text-primary hover:underline">Xem tất cả →</Link>
      </div>
      {recentOrders.length === 0 ? (
        <div className="py-12 text-center">
          <Package className="mx-auto h-16 w-16 text-muted-foreground" />
          <p className="mt-3 text-lg font-medium text-foreground">Bạn chưa có đơn hàng nào</p>
          <p className="mt-1 text-sm text-muted-foreground">Hãy khám phá sản phẩm và đặt đơn hàng đầu tiên!</p>
          <Link to="/products"><Button className="mt-4">Mua sắm ngay</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {recentOrders.map((order) => (
            <Link
              key={order.id}
              to={`/order/${order.id}`}
              className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  {order.items.length}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Đơn #{order.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    {" · "}{order.items.length} sản phẩm
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-primary">{formatPrice(order.total)}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[order.status] ?? statusColor.pending}`}>
                  {statusLabel[order.status] ?? order.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
