import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Star, Truck, Shield, ChevronRight, Package, RotateCcw, Minus, Plus, Check, Share2, Copy, Tag, GitCompareArrows } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import EmptyState from "@/components/shared/EmptyState";
import ProductCard from "@/components/shared/ProductCard";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { useProductDetail, useProducts } from "@/hooks/useProducts";

const categoryLabel: Record<string, string> = {
  cpu: "CPU - Bộ vi xử lý",
  mainboard: "Mainboard",
  vga: "Card đồ họa",
  ram: "RAM",
  ssd: "Ổ cứng SSD",
  psu: "Nguồn máy tính",
  case: "Vỏ Case",
  cooler: "Tản nhiệt",
};

const categoryEmoji: Record<string, string> = {
  cpu: "🔲",
  vga: "🎮",
  mainboard: "🔌",
  ram: "💾",
  ssd: "💿",
  psu: "⚡",
  case: "🖥",
  cooler: "❄️",
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toast } = useToast();

  const { data: product, isLoading } = useProductDetail(id);
  const { data: relatedData } = useProducts({ 
    categoryId: product?.category, 
    keyword: product?.brand && product.brand !== "Unknown" ? product.brand : undefined,
    size: 10 
  });

  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSkeleton count={1} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16">
        <EmptyState title="Sản phẩm không tồn tại" description="Sản phẩm bạn tìm không có hoặc đã bị xóa." action={
          <Link to="/products"><Button variant="outline">← Quay lại danh sách</Button></Link>
        } />
      </div>
    );
  }

  document.title = `${product.name} - PCShop`;

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) addToCart(product);
    toast({ title: "Đã thêm vào giỏ hàng!", description: `${product.name} x${quantity}` });
  };

  const handleBuyNow = () => {
    for (let i = 0; i < quantity; i++) addToCart(product);
    navigate("/cart");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Đã sao chép link sản phẩm!" });
  };

  const handleCompare = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("pc-store-compare") || "[]");
      if (saved.includes(product.id)) {
        toast({ title: "Sản phẩm đã có trong danh sách so sánh" });
        navigate("/compare");
        return;
      }
      if (saved.length >= 3) {
        toast({ title: "Tối đa 3 sản phẩm so sánh", description: "Vui lòng xóa bớt sản phẩm trước khi thêm mới.", variant: "destructive" });
        return;
      }
      const next = [...saved, product.id];
      localStorage.setItem("pc-store-compare", JSON.stringify(next));
      toast({ title: "Đã thêm vào so sánh!", description: product.name });
      navigate("/compare");
    } catch {
      const next = [product.id];
      localStorage.setItem("pc-store-compare", JSON.stringify(next));
      navigate("/compare");
    }
  };

  const relatedProducts = (relatedData?.content || [])
    .filter((p) => p.id !== product.id)
    .filter((p) => !product.brand || product.brand === "Unknown" || p.brand === product.brand)
    .slice(0, 5);

  const specEntries = Object.entries(product.specs || {});
  const formatSpecValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    const raw = String(value).trim();
    if (!raw) return "—";
    return raw
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/&lt;br\s*\/?\s*&gt;/gi, "\n");
  };
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  // Highlight specs for quick view
  const highlightSpecs = specEntries.slice(0, 4);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">Trang chủ</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/products" className="hover:text-primary">Sản phẩm</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to={`/products?category=${product.category}`} className="hover:text-primary">
          {categoryLabel[product.category] || product.category}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="line-clamp-1 text-foreground">{product.name}</span>
      </nav>

      {/* Main Product Section */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Images Column */}
        <div className="lg:col-span-5">
          {/* Main Image */}
          <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-card">
            {discount > 0 && (
              <Badge className="absolute left-3 top-3 z-10 bg-red-500 text-white">
                -{discount}%
              </Badge>
            )}
            <img
              src={product.images?.[selectedImage] || product.images?.[0]}
              alt={product.name}
              className="h-full w-full object-contain p-4"
              onError={(e) => {
                e.currentTarget.src = "https://placehold.co/800x800/png?text=No+Image";
              }}
            />
          </div>

          {/* Thumbnail row (placeholder slots) */}
          <div className="mt-3 grid grid-cols-5 gap-2">
            {(product.images && product.images.length > 0 ? product.images : ["https://placehold.co/150x150/png?text=No+Image"]).slice(0, 5).map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(i)}
                className={`aspect-square rounded-lg border-2 bg-card transition-colors ${selectedImage === i
                  ? "border-primary"
                  : "border-border hover:border-muted-foreground/50"
                  }`}
              >
                <img
                  src={img}
                  alt={`${product.name} ${i + 1}`}
                  className="h-full w-full object-contain p-1"
                  onError={(e) => {
                    e.currentTarget.src = "https://placehold.co/150x150/png?text=No+Image";
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Product Info Column */}
        <div className="lg:col-span-4">
          {/* Brand & SKU */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">{product.brand}</span>
            <span className="text-xs text-muted-foreground">| SKU: {product.id.toUpperCase()}</span>
          </div>

          <h1 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">{product.name}</h1>

          {/* Rating & Reviews */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < Math.floor(product.rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : i < product.rating
                      ? "fill-yellow-400/50 text-yellow-400"
                      : "text-muted-foreground/30"
                    }`}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-foreground">{product.rating}</span>
            <span className="text-sm text-muted-foreground">({product.reviewCount} đánh giá)</span>
          </div>

          <Separator className="my-4" />

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-primary">{formatPrice(product.price)}</span>
            {product.originalPrice && (
              <span className="text-base text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
            )}
            {discount > 0 && (
              <Badge variant="outline" className="border-red-500/30 text-red-500">
                Tiết kiệm {formatPrice(product.originalPrice! - product.price)}
              </Badge>
            )}
          </div>

          <Separator className="my-4" />

          {/* Quick Specs */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Thông số nổi bật</p>
            <div className="grid grid-cols-2 gap-2">
              {highlightSpecs.map(([key, value]) => (
                <div key={key} className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{key}</p>
                  <p className="whitespace-pre-line text-sm font-medium text-foreground">{formatSpecValue(value)}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Description */}
          <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>

          {/* Stock */}
          <div className="mt-4 flex items-center gap-2 text-sm">
            {product.stock > 0 ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-green-600 dark:text-green-400">Còn hàng</span>
                <span className="text-muted-foreground">({product.stock} sản phẩm)</span>
              </>
            ) : (
              <span className="text-destructive">Hết hàng</span>
            )}
          </div>

          {/* Quantity + Actions */}
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-foreground">Số lượng:</p>
              <div className="flex items-center rounded-lg border border-border">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="flex h-9 w-12 items-center justify-center text-sm font-medium text-foreground border-x border-border">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={handleAddToCart} disabled={product.stock === 0} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                <ShoppingCart className="mr-2 h-5 w-5" /> Thêm vào giỏ
              </Button>
              <Button size="lg" onClick={handleBuyNow} disabled={product.stock === 0} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
                Mua ngay
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCompare}>
                <GitCompareArrows className="mr-1.5 h-4 w-4" /> So sánh
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <Share2 className="mr-1.5 h-4 w-4" /> Chia sẻ
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar - Policies */}
        <div className="lg:col-span-3">
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-card-foreground">Chính sách mua hàng</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Giao hàng miễn phí</p>
                  <p className="text-xs text-muted-foreground">Miễn phí ship cho đơn trên 2 triệu</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Bảo hành chính hãng</p>
                  <p className="text-xs text-muted-foreground">Bảo hành lên tới 36 tháng</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <RotateCcw className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Đổi trả dễ dàng</p>
                  <p className="text-xs text-muted-foreground">Đổi trả miễn phí trong 7 ngày</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Sản phẩm chính hãng</p>
                  <p className="text-xs text-muted-foreground">100% hàng chính hãng, nguyên seal</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Promotional tags */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-card-foreground">Ưu đãi</h3>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-2.5">
                  <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="text-xs text-foreground">Giảm thêm 5% khi thanh toán qua VNPAY</p>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-2.5">
                  <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="text-xs text-foreground">Tặng kèm bộ vệ sinh PC trị giá 200K</p>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-2.5">
                  <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="text-xs text-foreground">Trả góp 0% qua thẻ tín dụng</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Specs, Description, Reviews */}
      <Tabs defaultValue="specs" className="mt-12">
        <TabsList className="bg-muted">
          <TabsTrigger value="specs">Thông số kỹ thuật</TabsTrigger>
          <TabsTrigger value="desc">Mô tả sản phẩm</TabsTrigger>
          <TabsTrigger value="reviews">Đánh giá ({product.reviewCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="specs" className="mt-6">
          <h3 className="mb-4 text-lg font-bold uppercase tracking-wide text-foreground">Thông số kỹ thuật</h3>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full">
              <tbody>
                {specEntries.map(([key, value], i) => (
                  <tr key={key} className="border-b border-border last:border-b-0">
                    <td className="w-1/3 bg-muted/40 px-5 py-3.5 text-sm font-medium text-primary">{key}</td>
                    <td className="whitespace-pre-line px-5 py-3.5 text-sm text-foreground">{formatSpecValue(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="desc" className="mt-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 text-lg font-bold text-card-foreground">{product.name}</h3>
            <p className="leading-relaxed text-muted-foreground">{product.description}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-semibold text-foreground">Thương hiệu</p>
                <p className="mt-1 text-sm text-muted-foreground">{product.brand}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-semibold text-foreground">Danh mục</p>
                <p className="mt-1 text-sm text-muted-foreground">{categoryLabel[product.category] || product.category}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          <div className="rounded-lg border border-border bg-card p-6">
            {/* Rating summary */}
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="text-center">
                <p className="text-5xl font-extrabold text-foreground">{product.rating}</p>
                <div className="mt-2 flex items-center justify-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${i < Math.floor(product.rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                        }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{product.reviewCount} đánh giá</p>
              </div>
              <Separator orientation="vertical" className="hidden h-24 sm:block" />
              <div className="flex-1 space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const pct = star === 5 ? 68 : star === 4 ? 22 : star === 3 ? 7 : star === 2 ? 2 : 1;
                  return (
                    <div key={star} className="flex items-center gap-2 text-sm">
                      <span className="w-3 text-right text-muted-foreground">{star}</span>
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-xs text-muted-foreground">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator className="my-6" />

            {/* Sample reviews */}
            <div className="space-y-6">
              {[
                { name: "Nguyễn Văn A", rating: 5, date: "15/02/2026", comment: "Sản phẩm rất tốt, hiệu năng vượt mong đợi. Đóng gói cẩn thận, giao hàng nhanh." },
                { name: "Trần Thị B", rating: 4, date: "10/02/2026", comment: "Chất lượng ổn, giá cả hợp lý. Tuy nhiên cần cải thiện thêm phần hướng dẫn sử dụng." },
                { name: "Lê Minh C", rating: 5, date: "05/02/2026", comment: "Đã mua lần thứ 2 rồi. Luôn hài lòng với sản phẩm và dịch vụ của shop!" },
              ].map((review, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {review.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{review.name}</p>
                      <span className="text-xs text-muted-foreground">{review.date}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star
                          key={j}
                          className={`h-3.5 w-3.5 ${j < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
                            }`}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Sản phẩm liên quan</h2>
            <Link to={`/products?category=${product.category}`} className="text-sm text-primary hover:underline">
              Xem tất cả
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
