import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useCart } from "@/hooks/useCart";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/context/AuthContext";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShoppingCart, Tag, X } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";

interface CheckoutForm {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  note: string;
}

// Demo coupon codes — replace with backend API validation when ready
const DEMO_COUPONS: Record<string, { type: "percent" | "fixed"; value: number; minOrder?: number; label: string }> = {
  PCSHOP10: { type: "percent", value: 10, minOrder: 5000000, label: "Giảm 10% (đơn từ 5 triệu)" },
  GIAM50K: { type: "fixed", value: 50000, minOrder: 1000000, label: "Giảm 50.000đ (đơn từ 1 triệu)" },
  FREESHIP: { type: "fixed", value: 0, label: "Miễn phí vận chuyển" },
};

export default function CheckoutPage() {
  document.title = "Thanh toán - PCShop";

  const { items, totalPrice, clearCart } = useCart();
  const { createOrder, loading, retryPayment } = useOrders();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "momo">("cod");

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CheckoutForm>();

  // Pre-fill form with user profile data
  useEffect(() => {
    if (user) {
      if (user.name) setValue("fullName", user.name);
      if (user.phone) setValue("phone", user.phone);
      if (user.email) setValue("email", user.email);
      if (user.address) setValue("address", user.address);
    }
  }, [user, setValue]);

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <EmptyState title="Giỏ hàng trống" description="Hãy thêm sản phẩm trước khi thanh toán." />
      </div>
    );
  }

  const handleApplyCoupon = () => {
    setCouponError(null);
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponError("Vui lòng nhập mã giảm giá");
      return;
    }
    const coupon = DEMO_COUPONS[code];
    if (!coupon) {
      setCouponError("Mã giảm giá không hợp lệ");
      return;
    }
    if (coupon.minOrder && totalPrice < coupon.minOrder) {
      setCouponError(`Đơn hàng tối thiểu ${formatPrice(coupon.minOrder)} để dùng mã này`);
      return;
    }
    const discountAmount = coupon.type === "percent"
      ? Math.round(totalPrice * coupon.value / 100)
      : coupon.value;
    setDiscount(discountAmount);
    setAppliedCoupon(code);
    toast({ title: "🎉 Áp dụng mã thành công!", description: coupon.label });
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscount(0);
    setCouponCode("");
    setCouponError(null);
  };

  const finalTotal = Math.max(0, totalPrice - discount);

  const onSubmit = async (data: CheckoutForm) => {
    const shippingAddress = {
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      address: data.address,
      note: data.note,
    };

    const order = await createOrder({
      items,
      shippingAddress,
      paymentMethod,
      totalPrice: finalTotal,
      note: data.note + (appliedCoupon ? ` [Coupon: ${appliedCoupon}]` : ""),
    });

    if (!order) {
      toast({
        title: "Đặt hàng thất bại",
        description: "Không thể tạo đơn hàng. Vui lòng thử lại.",
        variant: "destructive",
      });
      return;
    }

    clearCart();

    if (paymentMethod === "momo") {
      try {
        toast({ title: "Đang chuyển hướng...", description: "Vui lòng đợi giây lát để chuyển sang trang thanh toán MoMo." });
        const payUrl = await retryPayment(order.id, order.total);
        if (payUrl) {
          window.location.href = payUrl;
          return;
        }
      } catch (err) {
        toast({ title: "Lỗi khởi tạo thanh toán", description: "Vui lòng thanh toán tiếp trong chi tiết đơn hàng.", variant: "destructive" });
      }
    }

    toast({
      title: "🎉 Đặt hàng thành công!",
      description: "Cảm ơn bạn đã mua hàng tại PCShop.",
    });
    navigate(`/order-success?id=${order.id}`);
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
                <Label htmlFor="fullName">Họ tên <span className="text-destructive">*</span></Label>
                <Input
                  id="fullName"
                  {...register("fullName", { required: "Vui lòng nhập họ tên" })}
                  placeholder="Nguyễn Văn A"
                  className={errors.fullName ? "border-destructive" : ""}
                />
                {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName.message}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Số điện thoại <span className="text-destructive">*</span></Label>
                <Input
                  id="phone"
                  {...register("phone", {
                    required: "Vui lòng nhập số điện thoại",
                    pattern: { value: /^0\d{9}$/, message: "Số điện thoại không hợp lệ (VD: 0912345678)" },
                  })}
                  placeholder="0912345678"
                  className={errors.phone ? "border-destructive" : ""}
                />
                {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email", {
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Email không hợp lệ" },
                  })}
                  placeholder="email@example.com"
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Địa chỉ giao hàng <span className="text-destructive">*</span></Label>
                <Input
                  id="address"
                  {...register("address", { required: "Vui lòng nhập địa chỉ giao hàng" })}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố..."
                  className={errors.address ? "border-destructive" : ""}
                />
                {errors.address && <p className="mt-1 text-xs text-destructive">{errors.address.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="note">Ghi chú</Label>
                <Input
                  id="note"
                  {...register("note")}
                  placeholder="Ghi chú cho đơn hàng (tùy chọn)..."
                />
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-card-foreground">Phương thức thanh toán</h2>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as "cod" | "momo")}
              className="space-y-3"
            >
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/50">
                <RadioGroupItem value="cod" />
                <div>
                  <p className="text-sm font-medium text-foreground">Thanh toán khi nhận hàng (COD)</p>
                  <p className="text-xs text-muted-foreground">Trả tiền mặt khi nhận hàng</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/50">
                <RadioGroupItem value="momo" />
                <div>
                  <p className="text-sm font-medium text-foreground">Thanh toán qua MoMo</p>
                  <p className="text-xs text-muted-foreground">Thanh toán qua ví MoMo (nhanh, an toàn)</p>
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

            {/* Coupon Input */}
            <div className="border-t border-border pt-3">
              <Label className="mb-1.5 flex items-center gap-1.5 text-sm">
                <Tag className="h-3.5 w-3.5 text-primary" /> Mã giảm giá
              </Label>
              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">{appliedCoupon}</span>
                    <span className="ml-2 text-xs text-green-600 dark:text-green-500">-{formatPrice(discount)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="rounded-full p-0.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nhập mã giảm giá..."
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponError(null);
                    }}
                    className={`flex-1 text-sm ${couponError ? "border-destructive" : ""}`}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleApplyCoupon} className="shrink-0">
                    Áp dụng
                  </Button>
                </div>
              )}
              {couponError && <p className="mt-1 text-xs text-destructive">{couponError}</p>}
            </div>

            <div className="border-t border-border pt-3 space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tạm tính</span>
                <span>{formatPrice(totalPrice)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Giảm giá</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Phí vận chuyển</span>
                <span className="text-green-600">Miễn phí</span>
              </div>
              <div className="flex justify-between font-bold text-foreground border-t border-border pt-2 mt-2">
                <span>Tổng cộng</span>
                <span className="text-primary">{formatPrice(finalTotal)}</span>
              </div>
            </div>
          </div>
          <Button
            type="submit"
            className="mt-6 w-full"
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang xử lý...</>
            ) : (
              <><ShoppingCart className="mr-2 h-4 w-4" /> Đặt hàng ({formatPrice(finalTotal)})</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
