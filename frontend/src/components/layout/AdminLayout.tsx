import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  FolderTree,
  Menu,
  LogOut,
  Bell,
} from "lucide-react";

const sidebarItems = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Sản phẩm", href: "/admin/products", icon: Package },
  { title: "Đơn hàng", href: "/admin/orders", icon: ShoppingCart },
  { title: "Ngườii dùng", href: "/admin/users", icon: Users },
  { title: "Danh mục", href: "/admin/categories", icon: FolderTree },
];

function Sidebar({ className }: { className?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className={cn("flex h-full flex-col bg-slate-900", className)}>
      <div className="flex h-14 items-center border-b border-slate-700 px-4">
        <Link to="/admin" className="flex items-center gap-2">
          <Package className="h-6 w-6 text-blue-500" />
          <span className="text-lg font-bold text-white">Admin</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {sidebarItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-700 p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </Button>
      </div>
    </div>
  );
}

function AdminHeader() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login");
  };

  const initial = (user?.name || user?.email || "A").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-white px-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-52 p-0">
            <Sidebar className="w-full" />
          </SheetContent>
        </Sheet>
        <h2 className="text-sm font-semibold text-gray-700 hidden md:block">
          Quản trị hệ thống
        </h2>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white">
            3
          </span>
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold">
            {initial}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-medium leading-tight">
              {user?.name || "Admin"}
            </p>
            <p className="text-[10px] text-gray-500">
              {user?.email || ""}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-52 md:block">
        <Sidebar className="fixed h-screen w-52" />
      </aside>
      <div className="flex flex-1 flex-col md:ml-4">
        <AdminHeader />
        <main className="flex-1 bg-gray-50 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
