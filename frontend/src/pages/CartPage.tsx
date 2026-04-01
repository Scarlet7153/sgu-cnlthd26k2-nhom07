import { Link } from "react-router-dom";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/shared/EmptyState";

export default function CartPage() {
  document.title = "Giỏ hàng - PCShop";
  const { items, totalPrice, removeFromCart, updateQuantity } = useCart();

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <EmptyState
          title="Giỏ hàng trống"
          description="Bạn chưa thêm sản phẩm nào vào giỏ hàng."
          icon={<ShoppingBag className="h-8 w-8" />}
          action={<Link to="/products"><Button className="bg-primary text-primary-foreground">Mua sắm ngay</Button></Link>}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-foreground">Giỏ hàng ({items.length} sản phẩm)</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="flex gap-4 rounded-lg border border-border bg-card p-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                <img
                  src={product.images?.[0]}
                  alt={product.name}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = "https://placehold.co/160x160/png?text=No+Image";
                  }}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Link to={`/product/${product.id}`} className="text-sm font-semibold text-card-foreground hover:text-primary line-clamp-2">{product.name}</Link>
                <p className="text-xs text-muted-foreground">{product.brand}</p>
                <p className="text-sm font-bold text-primary">{formatPrice(product.price)}</p>
              </div>
              <div className="flex flex-col items-end justify-between">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeFromCart(product.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 rounded-md border border-border">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(product.id, quantity - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium text-foreground">{quantity}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(product.id, quantity + 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="h-fit rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">Tóm tắt đơn hàng</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Tạm tính</span>
              <span>{formatPrice(totalPrice)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Vận chuyển</span>
              <span className="text-green-500">Miễn phí</span>
            </div>
            <div className="my-3 border-t border-border" />
            <div className="flex justify-between text-base font-bold text-foreground">
              <span>Tổng cộng</span>
              <span className="text-primary">{formatPrice(totalPrice)}</span>
            </div>
          </div>
          <Link to="/checkout">
            <Button className="mt-6 w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-primary-sm">
              Tiến hành thanh toán
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
