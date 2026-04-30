import { Link } from "react-router-dom";
import { useWishlist } from "@/hooks/useWishlist";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingCart, Trash2, ArrowRight } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";

export default function WishlistPage() {
  document.title = "Sản phẩm yêu thích - PCShop";

  const { items, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { toast } = useToast();

  const handleAddToCart = (product: any) => {
    addToCart(product);
    toast({ title: "Đã thêm vào giỏ hàng", description: product.name });
  };

  const handleRemove = (productId: string, productName: string) => {
    removeFromWishlist(productId);
    toast({ title: "Đã xóa khỏi yêu thích", description: productName });
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <EmptyState
          title="Danh sách yêu thích trống"
          description="Hãy thêm sản phẩm yêu thích để xem lại sau!"
        />
        <div className="mt-6 flex justify-center">
          <Link to="/products">
            <Button variant="outline" className="gap-2">
              Khám phá sản phẩm <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500 fill-red-500" /> Sản phẩm yêu thích
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{items.length} sản phẩm</p>
        </div>
        <Button variant="outline" size="sm" onClick={clearWishlist} className="gap-1.5 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> Xóa tất cả
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((product) => (
          <div
            key={product.id}
            className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-md"
          >
            {/* Remove button */}
            <button
              onClick={() => handleRemove(product.id, product.name)}
              className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            {/* Image */}
            <Link to={`/product/${product.id}`} className="aspect-[4/3] bg-muted/30 p-3">
              <img
                src={product.images?.[0]}
                alt={product.name}
                className="h-full w-full object-contain transition-opacity duration-300"
                loading="lazy"
                decoding="async"
                onLoad={(e) => { e.currentTarget.style.opacity = "1"; }}
                onError={(e) => {
                  e.currentTarget.src = "https://placehold.co/400x300/png?text=No+Image";
                  e.currentTarget.style.opacity = "1";
                }}
                style={{ opacity: 0 }}
              />
            </Link>

            {/* Info */}
            <div className="flex flex-1 flex-col gap-1.5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{product.brand}</p>
              <Link to={`/product/${product.id}`}>
                <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-card-foreground group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
              </Link>
              <div className="mt-auto flex items-end justify-between pt-3">
                <p className="text-lg font-bold text-primary">{formatPrice(product.price)}</p>
                <Button
                  size="sm"
                  onClick={() => handleAddToCart(product)}
                  className="gap-1.5"
                >
                  <ShoppingCart className="h-4 w-4" /> Thêm vào giỏ
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
