import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useCart } from "@/hooks/useCart";
import { useOrders } from "@/context/OrderContext";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import EmptyState from "@/components/shared/EmptyState";

interface CheckoutForm {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  note: string;
}

export default function CheckoutPage() {
  document.title = "Thanh toán - TechPC";
  const { items, totalPrice, clearCart } = useCart();
  const { addOrder } = useOrders();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "banking">("cod");
  const { register, handleSubmit, formState: { errors } } = useForm<CheckoutForm>();

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <EmptyState title="Giỏ hàng trống" description="Hãy thêm sản phẩm trước khi thanh toán." />
      </div>
    );
  }

  const onSubmit = (data: CheckoutForm) => {
    const orderId = addOrder({
      items,
      address: data,
      paymentMethod,
      totalPrice,
    });
    clearCart();
    toast({ title: "🎉 Đặt hàng thành công!", description: "Cảm ơn bạn đã mua hàng tại TechPC." });
    navigate(`/order-success?id=${orderId}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-foreground">Thanh toán</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer info */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-card-foreground">Thông tin giao hàng</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="fullName">Họ tên *</Label>
                <Input id="fullName" {...register("fullName", { required: "Vui lòng nhập họ tên" })} placeholder="Nguyễn Văn A" />
                {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName.message}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Số điện thoại *</Label>
                <Input id="phone" {...register("phone", { required: "Vui lòng nhập SĐT", pattern: { value: /^0\d{9}$/, message: "SĐT không hợp lệ" } })} placeholder="0912345678" />
                {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} placeholder="email@example.com" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Địa chỉ *</Label>
                <Input id="address" {...register("address", { required: "Vui lòng nhập địa chỉ" })} placeholder="Số nhà, đường, phường/xã..." />
                {errors.address && <p className="mt-1 text-xs text-destructive">{errors.address.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="note">Ghi chú</Label>
                <Input id="note" {...register("note")} placeholder="Ghi chú cho đơn hàng..." />
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-card-foreground">Phương thức thanh toán</h2>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/50">
                <RadioGroupItem value="cod" />
                <div>
                  <p className="text-sm font-medium text-foreground">Thanh toán khi nhận hàng (COD)</p>
                  <p className="text-xs text-muted-foreground">Trả tiền mặt khi nhận hàng</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/50">
                <RadioGroupItem value="banking" />
                <div>
                  <p className="text-sm font-medium text-foreground">Chuyển khoản ngân hàng</p>
                  <p className="text-xs text-muted-foreground">Chuyển khoản trước khi giao hàng</p>
                </div>
              </label>
            </RadioGroup>
          </div>
        </div>

        {/* Order summary */}
        <div className="h-fit rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">Đơn hàng</h2>
          <div className="space-y-3">
            {items.map(({ product, quantity }) => (
              <div key={product.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground line-clamp-1 flex-1">{product.name} × {quantity}</span>
                <span className="ml-2 shrink-0 text-foreground">{formatPrice(product.price * quantity)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-3">
              <div className="flex justify-between font-bold text-foreground">
                <span>Tổng cộng</span>
                <span className="text-primary">{formatPrice(totalPrice)}</span>
              </div>
            </div>
          </div>
          <Button type="submit" className="mt-6 w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-primary-sm">
            Đặt hàng
          </Button>
        </div>
      </form>
    </div>
  );
}
