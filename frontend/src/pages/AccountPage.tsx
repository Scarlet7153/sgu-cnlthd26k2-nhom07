import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useOrders } from "@/hooks/useOrders";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { User, Package, Shield, ChevronRight, Pencil, LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileTab from "@/components/account/ProfileTab";
import OrdersTab from "@/components/account/OrdersTab";
import SecurityTab from "@/components/account/SecurityTab";

export default function AccountPage() {
  document.title = "Tài khoản - PCShop";

  const { user, signOut } = useAuth();
  const { orders } = useOrders();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <User className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">Bạn chưa đăng nhập</h2>
        <p className="mt-2 text-muted-foreground">Vui lòng đăng nhập để xem thông tin tài khoản.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/login"><Button>Đăng nhập</Button></Link>
          <Link to="/signup"><Button variant="outline">Đăng ký</Button></Link>
        </div>
      </div>
    );
  }

  const displayName = user.name || "Chưa đặt tên";
  const displayEmail = user.email;
  const deliveredCount = orders.filter(o => o.status === "delivered").length;
  const totalSpent = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + (o.total ?? 0), 0);
  const initials = (displayName || displayEmail).slice(0, 2).toUpperCase();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">Trang chủ</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Tài khoản</span>
      </div>

      {/* Profile Header */}
      <div className="mb-8 overflow-hidden rounded-xl border border-border bg-card">
        <div className="h-28 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <div className="relative px-6 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="-mt-12 flex h-24 w-24 items-center justify-center rounded-full border-4 border-card bg-primary text-2xl font-bold text-primary-foreground shadow-lg">
              {initials}
            </div>
            <div className="flex-1 sm:pb-1">
              <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
              <p className="text-sm text-muted-foreground">{displayEmail}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold text-primary">{orders.length}</p>
              <p className="text-xs text-muted-foreground">Đơn hàng</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{deliveredCount}</p>
              <p className="text-xs text-muted-foreground">Đã hoàn thành</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{formatPrice(totalSpent)}</p>
              <p className="text-xs text-muted-foreground">Tổng chi tiêu</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-4 w-4" /><span className="hidden sm:inline">Thông tin</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <Package className="h-4 w-4" /><span className="hidden sm:inline">Đơn hàng</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Shield className="h-4 w-4" /><span className="hidden sm:inline">Bảo mật</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab user={user} />
        </TabsContent>

        <TabsContent value="orders">
          <OrdersTab orders={orders} />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
