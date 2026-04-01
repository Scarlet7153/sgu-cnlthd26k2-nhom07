import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useOrders, Order } from "@/hooks/useOrders";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CheckCircle, Package, ArrowRight, Loader2 } from "lucide-react";

export default function OrderSuccessPage() {
  document.title = "Đặt hàng thành công - PCShop";

  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("id");
  const { getOrder } = useOrders();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    
    getOrder(orderId).then((data) => {
      setOrder(data);
      setLoading(false);
    });
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>

        <h1 className="mt-6 text-2xl font-bold text-foreground">Đặt hàng thành công!</h1>
        <p className="mt-2 text-muted-foreground">
          Cảm ơn bạn đã mua hàng tại PCShop. Đơn hàng của bạn đã được tiếp nhận và đang được xử lý.
        </p>

        {loading ? (
          <div className="mt-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Đang tải thông tin đơn hàng...</span>
          </div>
        ) : order ? (
          <div className="mt-6 rounded-lg border border-border bg-card p-6 text-left shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <span className="text-sm text-muted-foreground">Mã đơn hàng</span>
              <span className="font-mono text-sm font-bold text-foreground">
                #{order.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Số sản phẩm</span>
                <span className="text-sm font-medium text-foreground">{order.items.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tổng thanh toán</span>
                <span className="text-base font-bold text-primary">{formatPrice(order.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Phương thức thanh toán</span>
                <span className="text-sm font-medium text-foreground">
                  {order.paymentMethod === "COD" ? "Thanh toán khi nhận hàng (COD)" 
                    : order.paymentMethod === "BANK_TRANSFER" ? "Chuyển khoản ngân hàng"
                    : order.paymentMethod === "MOMO" ? "Ví MoMo"
                    : order.paymentMethod === "VNPAY" ? "VNPay"
                    : order.paymentMethod}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 pt-2 border-t border-border mt-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Giao đến</span>
                <span className="text-sm font-medium text-foreground text-right">
                  {order.shippingAddress?.fullName}
                  <br />
                  <span className="text-xs text-muted-foreground font-normal">{order.shippingAddress?.phone}</span>
                </span>
              </div>
            </div>
          </div>
        ) : null}

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
