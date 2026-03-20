import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/shared/ProductCard";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import banner1 from "@/assets/banner/1.png";
import banner2 from "@/assets/banner/2.png";
import banner3 from "@/assets/banner/3.png";
import { useProducts } from "@/hooks/useProducts";

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

  const { data: productsData, isLoading } = useProducts({ page: 0, size: 20 });
  const allProducts = productsData?.content || [];

  const featuredProducts = allProducts.filter((p) => p.featured).slice(0, 10);
  const bestSellers = allProducts.filter((p) => p.bestSeller).slice(0, 10);

  // Banner carousel
  const banners = [banner1, banner2, banner3];
  const bannerCarousel = useInfiniteCarousel(banners.length, 5000);
  const bannerResumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [previousBannerIndex, setPreviousBannerIndex] = useState(0);
  const [bannerDirection, setBannerDirection] = useState<'left' | 'right' | 'initial'>('initial');
  const [animationKey, setAnimationKey] = useState(0);
  const bannerImgRef = useRef<HTMLImageElement>(null);
  const isFirstBannerLoad = useRef(true);
  
  useEffect(() => {
    if (isFirstBannerLoad.current) {
      isFirstBannerLoad.current = false;
      setBannerDirection('initial');
      return;
    }
    
    // Determine direction of slide
    const currentIdx = bannerCarousel.displayIndex;
    const prevIdx = previousBannerIndex;
    
    let newDirection: 'left' | 'right' = 'left';
    
    if (currentIdx > prevIdx) {
      newDirection = 'left';
    } else if (currentIdx < prevIdx) {
      // Going backwards or wrapping from 0 to last
      if (prevIdx === banners.length - 1 && currentIdx === 0) {
        newDirection = 'left'; // Wrap forward
      } else {
        newDirection = 'right';
      }
    }
    
    setBannerDirection(newDirection);
    setPreviousBannerIndex(currentIdx);
    
    // Force animation restart via class toggle
    if (bannerImgRef.current) {
      const img = bannerImgRef.current;
      // Remove animation classes
      img.classList.remove('slide-in-left', 'slide-in-right');
      // Trigger reflow
      void img.offsetWidth;
      // Re-add animation class
      img.classList.add(newDirection === 'left' ? 'slide-in-left' : 'slide-in-right');
    }
  }, [bannerCarousel.displayIndex, banners.length, previousBannerIndex]);
  
  // Force animation restart via reflow
  useEffect(() => {
    if (bannerImgRef.current && animationKey > 0) {
      // Trigger reflow to restart animation
      void bannerImgRef.current.offsetWidth;
    }
  }, [animationKey]);
  
  const handleBannerUserAction = () => {
    bannerCarousel.setPaused(true);
    // Clear existing timeout if any
    if (bannerResumeTimeoutRef.current) clearTimeout(bannerResumeTimeoutRef.current);
    // Resume autoplay after 5 seconds
    bannerResumeTimeoutRef.current = setTimeout(() => {
      bannerCarousel.setPaused(false);
    }, 5000);
  };

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

  // Cleanup banner timeout on unmount
  useEffect(() => {
    return () => {
      if (bannerResumeTimeoutRef.current) {
        clearTimeout(bannerResumeTimeoutRef.current);
      }
    };
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSkeleton count={10} />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Hero Banner Carousel */}
      <section className="container mx-auto px-4 pt-4 pb-2">
        <style>{`
          @keyframes bannerFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes bannerZoom {
            from { transform: scale(1.05); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
          @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-30px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse-glow {
            0%, 100% { text-shadow: 0 0 10px rgba(var(--primary-rgb), 0.5); }
            50% { text-shadow: 0 0 20px rgba(var(--primary-rgb), 0.8); }
          }
          @keyframes slideChangeLeft {
            from { opacity: 0; transform: translateX(50px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideChangeRight {
            from { opacity: 0; transform: translateX(-50px); }
            to { opacity: 1; transform: translateX(0); }
          }
          
          .banner-carousel-container {
            perspective: 1000px;
          }
          
          .banner-slide {
            opacity: 1;
            transform: translateX(0);
            transition: opacity 0.6s ease-in-out;
            display: block;
            width: 100%;
            height: 100%;
          }
          
          .banner-carousel-container:hover .banner-slide {
            filter: brightness(0.9);
          }
          
          .banner-slide.initial {
            animation: bannerZoom 0.8s ease-out forwards;
          }
          
          .banner-slide.slide-in-left {
            animation: slideChangeLeft 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          }
          
          .banner-slide.slide-in-right {
            animation: slideChangeRight 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          }
          
          .banner-preload {
            display: none;
          }
          
          .banner-dots {
            display: flex;
            gap: 8px;
            justify-content: center;
            padding: 12px 0;
          }
          
          .banner-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.4);
            cursor: pointer;
            transition: all 0.3s ease;
          }
          
          .banner-dot.active {
            background: white;
            transform: scale(1.3);
          }
          
          .banner-nav-btn {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            z-index: 10;
            background: rgba(0, 0, 0, 0.4);
            color: white;
            border: none;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            opacity: 0;
          }
          
          .banner-carousel-container:hover .banner-nav-btn {
            opacity: 1;
          }
          
          .banner-nav-btn:hover {
            background: rgba(0, 0, 0, 0.7);
            transform: translateY(-50%) scale(1.1);
          }
          
          .banner-nav-btn.left {
            left: 16px;
          }
          
          .banner-nav-btn.right {
            right: 16px;
          }
        `}</style>
        
        <div className="banner-carousel-container relative overflow-hidden rounded-lg group bg-gray-900 cursor-pointer" onClick={() => navigate('/products')}>
          {/* Banner image with fade transition */}
          <div className="relative overflow-hidden rounded-lg w-full bg-gray-900">
            <img
              ref={bannerImgRef}
              src={banners[bannerCarousel.displayIndex]}
              alt={`Banner ${bannerCarousel.displayIndex + 1}`}
              className={`banner-slide ${bannerDirection === 'initial' ? 'initial' : bannerDirection === 'left' ? 'slide-in-left' : 'slide-in-right'} h-full min-h-[300px] w-full object-cover md:min-h-[400px]`}
              loading="eager"
              decoding="async"
              onTransitionEnd={bannerCarousel.handleTransitionEnd}
            />
            
            {/* Preload next banner */}
            <img
              src={banners[(bannerCarousel.displayIndex + 1) % banners.length]}
              alt="preload"
              className="banner-preload"
            />
          </div>
          
          {/* Navigation buttons */}
          <button 
            className="banner-nav-btn left"
            onClick={(e) => { e.stopPropagation(); handleBannerUserAction(); bannerCarousel.prev(); }}
            aria-label="Previous banner"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button 
            className="banner-nav-btn right"
            onClick={(e) => { e.stopPropagation(); handleBannerUserAction(); bannerCarousel.next(); }}
            aria-label="Next banner"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          
          {/* Dot indicators */}
          <div className="banner-dots absolute bottom-0 left-0 right-0 pb-4">
            {banners.map((_, idx) => (
              <button
                key={idx}
                className={`banner-dot ${idx === bannerCarousel.displayIndex ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleBannerUserAction();
                  // Calculate how many steps to reach target index
                  const diff = idx - bannerCarousel.displayIndex;
                  if (diff > 0) {
                    for (let i = 0; i < diff; i++) bannerCarousel.next();
                  } else {
                    for (let i = 0; i < -diff; i++) bannerCarousel.prev();
                  }
                }}
                aria-label={`Go to banner ${idx + 1}`}
              />
            ))}
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

