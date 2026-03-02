import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/shared/ProductCard";
import { products } from "@/data/products";
import heroBanner from "@/assets/hero-banner.png";

const VISIBLE_COUNT = 5;
const AUTO_SCROLL_MS = 5000;

export default function HomePage() {
  document.title = "PCShop - Linh kiện PC chính hãng giá tốt";

  const featuredProducts = products.filter((p) => p.featured).slice(0, 10);
  const bestSellers = products.filter((p) => p.bestSeller).slice(0, 10);

  const maxIndex = Math.max(0, featuredProducts.length - VISIBLE_COUNT);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
  }, [maxIndex]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
  }, [maxIndex]);

  // Auto-scroll every 5s, pause on hover
  useEffect(() => {
    if (isPaused || maxIndex === 0) return;
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    }, AUTO_SCROLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, maxIndex]);

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
            <div
              className="relative flex items-center bg-primary px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white"
              style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)" }}
            >
              Sản phẩm nổi bật
            </div>
          </div>
          <Link to="/products" className="text-sm font-medium text-primary hover:underline">
            Xem tất cả »
          </Link>
        </div>

        {/* Carousel wrapper */}
        <div
          className="group relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Left arrow */}
          <button
            onClick={handlePrev}
            className="absolute -left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-all duration-300 hover:bg-primary hover:text-white opacity-0 group-hover:opacity-100"
            aria-label="Trượt trái"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Right arrow */}
          <button
            onClick={handleNext}
            className="absolute -right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-all duration-300 hover:bg-primary hover:text-white opacity-0 group-hover:opacity-100"
            aria-label="Trượt phải"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Sliding track */}
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${currentIndex * (100 / VISIBLE_COUNT)}%)`,
              }}
            >
              {featuredProducts.map((p) => (
                <div
                  key={p.id}
                  className="shrink-0 px-2"
                  style={{ width: `${100 / VISIBLE_COUNT}%` }}
                >
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>

          {/* Progress dots */}
          {maxIndex > 0 && (
            <div className="mt-4 flex justify-center gap-1.5">
              {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/50"
                    }`}
                  aria-label={`Vị trí ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Best sellers */}
      <section className="bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-5 flex items-center justify-between border-b border-border pb-0">
            <div className="flex items-center">
              <div
                className="relative flex items-center bg-primary px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white"
                style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)" }}
              >
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
