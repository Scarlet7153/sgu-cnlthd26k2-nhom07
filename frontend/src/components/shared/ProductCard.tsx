import { Link } from "react-router-dom";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { Product } from "@/types/product.types";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface ProductCardProps {
  product: Product;
}

function getShortSpecs(product: Product): string {
  const specs = Object.values(product.specs);
  return specs.slice(0, 2).join(", ");
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { toast } = useToast();
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.originalPrice!) * 100)
    : 0;
  const wishlisted = isInWishlist(product.id);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    toast({ title: "Đã thêm vào giỏ hàng", description: product.name });
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
    toast({
      title: wishlisted ? "Đã bỏ yêu thích" : "Đã thêm vào yêu thích",
      description: product.name,
    });
  };

  return (
    <Link
      to={`/product/${product.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-md"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-muted/30 p-3">
        <img
          src={product.images?.[0]}
          alt={product.name}
          className="h-full w-full object-contain transition-opacity duration-300"
          loading="lazy"
          decoding="async"
          onLoad={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onError={(e) => {
            e.currentTarget.src = "https://placehold.co/400x300/png?text=No+Image";
            e.currentTarget.style.opacity = "1";
          }}
          style={{ opacity: 0 }}
        />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {product.featured && (
            <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5">Mới</Badge>
          )}
          {hasDiscount && (
            <Badge className="bg-destructive text-destructive-foreground text-[10px] px-2 py-0.5">
              -{discountPercent}%
            </Badge>
          )}
        </div>
        {/* Wishlist button */}
        <button
          onClick={handleToggleWishlist}
          className={`absolute right-2 top-2 z-10 rounded-full p-1.5 backdrop-blur-sm transition-colors ${
            wishlisted
              ? "bg-red-50 text-red-500 dark:bg-red-950/50"
              : "bg-background/70 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50"
          }`}
        >
          <Heart className={`h-4 w-4 ${wishlisted ? "fill-red-500" : ""}`} />
        </button>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{product.brand}</p>
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-card-foreground group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        <p className="line-clamp-1 min-h-[1rem] text-xs text-muted-foreground">{getShortSpecs(product)}</p>

        {/* Rating */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          <span className="font-medium">{product.rating}</span>
          <span>({product.reviewCount})</span>
        </div>

        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <p className="text-base font-bold text-primary">{formatPrice(product.price)}</p>
            {hasDiscount && (
              <p className="text-[11px] text-muted-foreground line-through">{formatPrice(product.originalPrice!)}</p>
            )}
          </div>
          <Button
            size="icon"
            variant="outline"
            className="h-10 w-10 rounded-lg border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground dark:border-primary/40 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground"
            onClick={handleAdd}
          >
            <ShoppingCart className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Link>
  );
}
