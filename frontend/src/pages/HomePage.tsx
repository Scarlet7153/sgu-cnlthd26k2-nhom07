import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/shared/ProductCard";
import { products } from "@/data/products";
import heroBanner from "@/assets/hero-banner.png";

/* ─── Infinite Carousel Hook ─── */
function useInfiniteCarousel(totalItems: number, autoPlayMs = 5000) {
  const [index, setIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => {
    setIsTransitioning(true);
    setIndex((i) => i + 1);
  }, []);

  const prev = useCallback(() => {
    setIsTransitioning(true);
    setIndex((i) => i - 1);
  }, []);

  // When index goes out of [0, totalItems-1] after transition ends, snap back
  const handleTransitionEnd = useCallback(() => {
    if (index >= totalItems) {
      setIsTransitioning(false);
      setIndex(0);
    } else if (index < 0) {
      setIsTransitioning(false);
      setIndex(totalItems - 1);
    }
  }, [index, totalItems]);

  // Re-enable transition after snap-back
  useEffect(() => {
    if (!isTransitioning) {
      const frame = requestAnimationFrame(() => setIsTransitioning(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [isTransitioning]);

  useEffect(() => {
    if (paused || totalItems <= 1) return;
    timerRef.current = setInterval(next, autoPlayMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, next, autoPlayMs, totalItems]);

  // Normalize index for dot indicators
  const displayIndex = ((index % totalItems) + totalItems) % totalItems;

  return { index, displayIndex, totalItems, next, prev, setPaused, isTransitioning, handleTransitionEnd };
}

export default function HomePage() {
  document.title = "PCShop - Linh kiện PC chính hãng giá tốt";

  const featuredProducts = products.filter((p) => p.featured).slice(0, 10);
  const bestSellers = products.filter((p) => p.bestSeller).slice(0, 10);

  // Responsive items per page
  const [itemsPerPage, setItemsPerPage] = useState(4);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 640) setItemsPerPage(2);
      else if (w < 1024) setItemsPerPage(3);
      else if (w < 1280) setItemsPerPage(4);
      else setItemsPerPage(5);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const featured = useInfiniteCarousel(featuredProducts.length, 5000);

  // Build extended list: [clone last N] + [originals] + [clone first N]
  const cloneCount = itemsPerPage;
  const extendedProducts = [
    ...featuredProducts.slice(-cloneCount),
    ...featuredProducts,
    ...featuredProducts.slice(0, cloneCount),
  ];
  // Offset to account for the prepended clones
  const translateIndex = featured.index + cloneCount;
  const itemWidth = 100 / itemsPerPage;

  return (
    <div className="flex flex-col">
      {/* Hero Banner */}
      <section className="container mx-auto px-4 pt-4 pb-2">
        <div className="relative overflow-hidden rounded-lg">
          <img
            src={heroBanner}
            alt="Gaming PC setup with RGB lighting"
            className="h-full min-h-[300px] w-full object-cover md:min-h-[400px]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex items-center px-8 md:px-12">
            <div className="max-w-lg">
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-white md:text-3xl lg:text-4xl">
                Linh kiện PC
                <br />
                <span className="text-primary">Chính hãng, Giá tốt</span>
              </h1>
              <p className="mt-3 text-sm text-white/80 md:text-base">
                Hàng ngàn sản phẩm từ các thương hiệu hàng đầu.
                <br />
                Build PC trong mơ với giá không thể tốt hơn.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/products">
                  <Button size="lg" className="rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90">
                    Mua sắm ngay <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/pc-builder">
                  <Button size="lg" className="rounded-full border border-white/40 bg-white/10 px-6 text-white backdrop-blur-sm hover:bg-white/20">
                    <Sparkles className="mr-2 h-4 w-4" /> Build PC
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured products — Carousel */}
      <section className="container mx-auto px-4 py-8">
        <div className="mb-5 flex items-center justify-between border-b border-border pb-0">
          <div className="flex items-center">
            <div className="relative flex items-center bg-primary px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white"
              style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)" }}>
              Sản phẩm nổi bật
            </div>
          </div>
          <Link to="/products" className="text-sm font-medium text-primary hover:underline">
            Xem tất cả »
          </Link>
        </div>

        {/* Carousel container */}
        <div
          className="group relative"
          onMouseEnter={() => featured.setPaused(true)}
          onMouseLeave={() => featured.setPaused(false)}
        >
          {/* Left arrow */}
          <button
            onClick={featured.prev}
            className="absolute -left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-lg border border-border text-foreground opacity-0 transition-all hover:bg-primary hover:text-white group-hover:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Slides */}
          <div className="overflow-hidden">
            <div
              className={`flex ${featured.isTransitioning ? "transition-transform duration-500 ease-in-out" : ""}`}
              style={{ transform: `translateX(-${translateIndex * itemWidth}%)` }}
              onTransitionEnd={featured.handleTransitionEnd}
            >
              {extendedProducts.map((p, i) => (
                <div
                  key={`${p.id}-${i}`}
                  className="shrink-0 px-2"
                  style={{ width: `${itemWidth}%` }}
                >
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>

          {/* Right arrow */}
          <button
            onClick={featured.next}
            className="absolute -right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-lg border border-border text-foreground opacity-0 transition-all hover:bg-primary hover:text-white group-hover:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Dot indicators */}
        {featuredProducts.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {featuredProducts.map((_, i) => (
              <button
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${featured.displayIndex === i ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Best sellers */}
      <section className="bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-5 flex items-center justify-between border-b border-border pb-0">
            <div className="flex items-center">
              <div className="relative flex items-center bg-primary px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white"
                style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)" }}>
                Bán chạy nhất
              </div>
            </div>
            <Link to="/products" className="text-sm font-medium text-primary hover:underline">
              Xem tất cả »
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {bestSellers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

