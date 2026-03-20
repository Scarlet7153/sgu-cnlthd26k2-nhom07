import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import logo from "@/assets/logo.png";
import cpuIcon from "@/assets/CPU.png";
import mainboardIcon from "@/assets/MAINBOARD.png";
import gpuIcon from "@/assets/GPU.png";
import ramIcon from "@/assets/RAM.png";
import ssdIcon from "@/assets/SSD.png";
import psuIcon from "@/assets/PSU.png";
import caseIcon from "@/assets/CASE.png";
import fanIcon from "@/assets/FAN.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShoppingCart, Menu, Sun, Moon, Search, User, LogOut, Cpu, CircuitBoard, MonitorPlay, MemoryStick, HardDrive, PlugZap, Computer, Fan, Package, UserCircle, List, ChevronRight, ChevronDown } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatPrice } from "@/lib/format";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";

const navLinks = [
  { label: "Trang chủ", to: "/" },
  { label: "Sản phẩm", to: "/products" },
  { label: "Build PC", to: "/pc-builder" },
  { label: "So sánh", to: "/compare" },
];

const iconImgMap: Record<string, string> = {
  Cpu: cpuIcon,
  CircuitBoard: mainboardIcon,
  Monitor: gpuIcon,
  MemoryStick: ramIcon,
  HardDrive: ssdIcon,
  Zap: psuIcon,
  Box: caseIcon,
  Fan: fanIcon,
};

const SCROLL_THRESHOLD = 80;

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export default function Header() {
  const { totalItems } = useCart();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [catOpen, setCatOpen] = useState(false);
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);
  const catRef = useRef<HTMLDivElement>(null);
  const closeMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const shouldSearch = debouncedSearchQuery.trim().length >= 2;
  const { data: categoriesData } = useCategories();
  const menuCategories = categoriesData || [];
  const categoryLinks = useMemo(
    () => menuCategories.map((c) => ({
      label: c.name,
      to: `/products?category=${c.id}`,
      img: iconImgMap[c.icon],
    })),
    [menuCategories]
  );

  const { data: searchData, isLoading: isSearchLoading } = useProducts({
    keyword: shouldSearch ? debouncedSearchQuery.trim() : undefined,
    size: 5,
    enabled: shouldSearch,
  });

  // Filter to show only relevant products
  const searchSuggestions = (searchData?.content || []).filter((p) => {
    const query = debouncedSearchQuery.toLowerCase();
    const name = p.name.toLowerCase();
    const brand = p.brand.toLowerCase();
    
    // Show if product name contains most search keywords or exact brand match
    const keywords = query.split(' ').filter(k => k.length > 2);
    const matchCount = keywords.filter(k => name.includes(k) || brand.includes(k)).length;
    
    return matchCount >= Math.max(1, keywords.length - 1); // At least 1 keyword match
  }).slice(0, 5);

  // Scroll detection for header compact mode
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > SCROLL_THRESHOLD);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close suggestions on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeMenuTimeoutRef.current) {
        clearTimeout(closeMenuTimeoutRef.current);
      }
    };
  }, []);

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  // Safe menu close with delay to prevent flicker
  const scheduleMenuClose = useCallback(() => {
    closeMenuTimeoutRef.current = setTimeout(() => {
      setCatOpen(false);
      setHoveredCat(null);
    }, 150);
  }, []);

  // Cancel pending menu close
  const cancelMenuClose = useCallback(() => {
    if (closeMenuTimeoutRef.current) {
      clearTimeout(closeMenuTimeoutRef.current);
      closeMenuTimeoutRef.current = null;
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchFocused(false);
    }
  };

  const categoryEmoji: Record<string, string> = {
    cpu: "🔲", vga: "🎮", mainboard: "🔌", ram: "💾",
    harddisk: "💿", ssd: "💿", psu: "⚡", case: "🖥", cooler: "❄️",
  };

  // Mega menu content (shared between both modes)
  const megaMenuContent = (
    <>
      {catOpen && (
        <div className="absolute left-0 top-full z-50 flex shadow-xl">
          {/* Category list */}
          <div className="w-[260px] border border-border bg-card">
            {menuCategories.map((cat) => {
              const catImg = iconImgMap[cat.icon];
              const hasSub = cat.subcategories && cat.subcategories.length > 0;
              return (
                <div
                  key={cat.id}
                  onMouseEnter={() => setHoveredCat(cat.id)}
                >
                  <Link
                    to={`/products?category=${cat.id}`}
                    onClick={() => setCatOpen(false)}
                    className={`flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-primary hover:text-primary-foreground ${hoveredCat === cat.id ? "bg-primary text-primary-foreground" : "text-card-foreground"
                      }`}
                  >
                    <span className="flex items-center gap-2.5 font-semibold">
                      {catImg ? (
                        <img src={catImg} alt={cat.name} className={`h-5 w-5 object-contain dark:invert ${hoveredCat === cat.id ? "brightness-0 invert" : ""}`} />
                      ) : (
                        <Package className="h-5 w-5" />
                      )}
                      {cat.name}
                    </span>
                    {hasSub && <ChevronRight className="h-3.5 w-3.5" />}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Flyout subcategory panel */}
          {hoveredCat && (() => {
            const cat = menuCategories.find(c => c.id === hoveredCat);
            if (!cat?.subcategories?.length) return null;
            return (
              <div className="w-[520px] border border-l-0 border-border bg-card p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat.name}
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {cat.subcategories.map((sub) => (
                    <Link
                      key={sub.name}
                      to={sub.to}
                      onClick={() => setCatOpen(false)}
                      className="rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-primary/10 hover:text-primary hover:underline"
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </>
  );

  return (
    <header className={`sticky top-0 z-50 bg-background transition-shadow duration-300 ${scrolled ? "shadow-md" : ""}`}>
      {/* Main header */}
      <div className="border-b border-border bg-background">
        <div className="container mx-auto flex items-center gap-4 px-4 py-2.5">
          {/* Mobile menu (left side) */}
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-background">
              {/* Mobile search */}
              <form onSubmit={handleSearch} className="relative mt-6">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm kiếm..." className="pl-10" />
              </form>
              <nav className="mt-4 flex flex-col gap-1">
                {navLinks.map((l) => (
                  <Link key={l.to} to={l.to} className={`rounded-md px-4 py-3 text-sm font-medium transition-colors ${isActive(l.to) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
                    {l.label}
                  </Link>
                ))}
                <div className="my-2 border-t border-border" />
                <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Danh mục</p>
                {categoryLinks.map((c) => (
                  <Link key={c.to} to={c.to} className="flex items-center gap-2 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                    {c.img ? (
                      <img src={c.img} alt={c.label} className="h-4 w-4 object-contain dark:invert" />
                    ) : (
                      <Computer className="h-4 w-4" />
                    )}
                    {c.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link to="/" className="flex shrink-0 items-center">
            <img src={logo} alt="PCShop Logo" className="w-auto object-contain h-9" />
          </Link>

          {/* Inline category button - always visible */}
          <div
            ref={catRef}
            className="relative hidden transition-all duration-300 lg:block"
            onMouseEnter={() => {
              cancelMenuClose();
              setCatOpen(true);
            }}
            onMouseLeave={() => {
              scheduleMenuClose();
            }}
          >
            <button className="flex items-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              <List className="h-4 w-4" />
              DANH MỤC
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${catOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Mega dropdown with safe hover zone */}
            <>
              {/* Invisible safe zone between button and menu */}
              {catOpen && <div className="absolute left-0 top-full h-2 w-full" />}
              
              <div
                onMouseEnter={() => {
                  cancelMenuClose();
                  setCatOpen(true);
                }}
                onMouseLeave={() => scheduleMenuClose()}
              >
                {megaMenuContent}
              </div>
            </>
          </div>

          {/* Search bar */}
          <div ref={searchRef} className="relative hidden flex-1 md:block">
            <form onSubmit={handleSearch}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder="Tìm kiếm linh kiện..."
                className="w-full rounded-full border-border bg-muted/50 pl-10 pr-4 text-sm focus-visible:ring-primary h-9"
              />
            </form>

            {/* Search suggestions dropdown */}
            {searchFocused && searchSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[360px] overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
                {searchSuggestions.map((p) => (
                  <Link
                    key={p.id}
                    to={`/product/${p.id}`}
                    onClick={() => { setSearchFocused(false); setSearchQuery(""); }}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/50 text-lg">
                      <img
                        src={p.images?.[0]}
                        alt={p.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = "none";
                          const fallback = target.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                      <span className="hidden h-full w-full items-center justify-center">{categoryEmoji[p.category] || "📦"}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.brand}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-primary">{formatPrice(p.price)}</span>
                  </Link>
                ))}
                <Link
                  to={`/products?search=${encodeURIComponent(searchQuery.trim())}`}
                  onClick={() => { setSearchFocused(false); }}
                  className="flex items-center justify-center border-t border-border px-4 py-2.5 text-sm font-medium text-primary hover:bg-muted/50"
                >
                  Xem tất cả kết quả cho "{searchQuery.trim()}"
                </Link>
              </div>
            )}
          </div>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive(l.to)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} className="text-muted-foreground">
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <Link to="/cart">
              <Button variant="ghost" size="icon" className="relative text-muted-foreground">
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary p-0 text-[10px] text-primary-foreground">
                    {totalItems}
                  </Badge>
                )}
              </Button>
            </Link>

            {/* Auth */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-xs text-muted-foreground">{user.email}</DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link to="/account" className="flex items-center"><UserCircle className="mr-2 h-4 w-4" /> Tài khoản</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link to="/orders" className="flex items-center"><Package className="mr-2 h-4 w-4" /> Đơn hàng</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/login">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <User className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">Đăng nhập</span>
                </Button>
              </Link>
            )}

          </div>
        </div>
      </div>


    </header>
  );
}
