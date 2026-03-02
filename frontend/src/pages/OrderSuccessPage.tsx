import { Link, useSearchParams } from "react-router-dom";
import { useOrders } from "@/context/OrderContext";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CheckCircle, Package, ArrowRight } from "lucide-react";

export default function OrderSuccessPage() {
  document.title = "Đặt hàng thành công - TechPC";
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("id");
  const { getOrder } = useOrders();
  const order = orderId ? getOrder(orderId) : undefined;

  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>

        <h1 className="mt-6 text-2xl font-bold text-foreground">Đặt hàng thành công!</h1>
        <p className="mt-2 text-muted-foreground">
          Cảm ơn bạn đã mua hàng tại TechPC. Đơn hàng của bạn đã được tiếp nhận và đang được xử lý.
        </p>

        {order && (
          <div className="mt-6 rounded-lg border border-border bg-card p-6 text-left">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mã đơn hàng</span>
              <span className="font-mono text-sm font-bold text-foreground">
                #{order.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Số sản phẩm</span>
              <span className="text-sm text-foreground">{order.items.length}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tổng tiền</span>
              <span className="text-base font-bold text-primary">{formatPrice(order.totalPrice)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Thanh toán</span>
              <span className="text-sm text-foreground">
                {order.paymentMethod === "cod" ? "COD" : "Chuyển khoản"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Giao đến</span>
              <span className="text-sm text-foreground">{order.address.fullName}</span>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {order && (
            <Link to={`/order/${order.id}`}>
              <Button variant="outline" className="w-full sm:w-auto">
                <Package className="mr-2 h-4 w-4" /> Xem chi tiết đơn hàng
              </Button>
            </Link>
          )}
          <Link to="/products">
            <Button className="w-full sm:w-auto">
              Tiếp tục mua sắm <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
