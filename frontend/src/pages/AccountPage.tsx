import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useOrders } from "@/context/OrderContext";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { User, Package, LogOut, Eye, EyeOff, ShoppingCart, MapPin, Phone, Mail, Shield, ChevronRight, Settings, Pencil, Trash2, Camera } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AccountPage() {
  document.title = "Tài khoản - TechPC";
  const { user, signOut, updateProfile } = useAuth();
  const { orders } = useOrders();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

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

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ name, phone, address });
    setEditingProfile(false);
    toast({ title: "Cập nhật thành công!" });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Mật khẩu mới phải có ít nhất 6 ký tự", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mật khẩu xác nhận không khớp", variant: "destructive" });
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem("auth-users") || "[]");
      const idx = stored.findIndex((u: any) => u.id === user.id);
      if (idx === -1) return;
      if (stored[idx].password !== currentPassword) {
        toast({ title: "Mật khẩu hiện tại không đúng", variant: "destructive" });
        return;
      }
      stored[idx].password = newPassword;
      localStorage.setItem("auth-users", JSON.stringify(stored));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Đổi mật khẩu thành công!" });
    } catch {
      toast({ title: "Lỗi", variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const recentOrders = orders.slice(0, 5);

  const statusLabel: Record<string, string> = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy",
  };

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    shipping: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const initials = (user.name || user.email).slice(0, 2).toUpperCase();
  const totalSpent = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.totalPrice, 0);
  const deliveredCount = orders.filter(o => o.status === "delivered").length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">Trang chủ</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Tài khoản</span>
      </div>

      {/* Profile Header Card */}
      <div className="mb-8 overflow-hidden rounded-xl border border-border bg-card">
        <div className="h-28 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <div className="relative px-6 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            {/* Avatar */}
            <div className="-mt-12 flex h-24 w-24 items-center justify-center rounded-full border-4 border-card bg-primary text-2xl font-bold text-primary-foreground shadow-lg">
              {initials}
            </div>
            <div className="flex-1 sm:pb-1">
              <h1 className="text-xl font-bold text-foreground">{user.name || "Chưa đặt tên"}</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)} className="self-start sm:self-end">
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Chỉnh sửa
            </Button>
          </div>

          {/* Stats row */}
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

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-4 w-4" /> <span className="hidden sm:inline">Thông tin</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <Package className="h-4 w-4" /> <span className="hidden sm:inline">Đơn hàng</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Shield className="h-4 w-4" /> <span className="hidden sm:inline">Bảo mật</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Personal Info */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-card-foreground">Thông tin cá nhân</h2>
                {!editingProfile && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingProfile(true)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Sửa
                  </Button>
                )}
              </div>

              {editingProfile ? (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Họ tên</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập họ tên" />
                  </div>
                  <div>
                    <Label htmlFor="phone">Số điện thoại</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912345678" />
                  </div>
                  <div>
                    <Label htmlFor="address">Địa chỉ</Label>
                    <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" rows={3} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">Lưu thay đổi</Button>
                    <Button type="button" variant="outline" onClick={() => {
                      setEditingProfile(false);
                      setName(user.name || "");
                      setPhone(user.phone || "");
                      setAddress(user.address || "");
                    }}>
                      Hủy
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Họ tên</p>
                      <p className="text-sm font-medium text-foreground">{user.name || "Chưa cập nhật"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium text-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Số điện thoại</p>
                      <p className="text-sm font-medium text-foreground">{user.phone || "Chưa cập nhật"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Địa chỉ</p>
                      <p className="text-sm font-medium text-foreground">{user.address || "Chưa cập nhật"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold text-card-foreground">Truy cập nhanh</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/orders" className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/30 hover:bg-muted/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Đơn hàng</p>
                      <p className="text-xs text-muted-foreground">{orders.length} đơn</p>
                    </div>
                  </Link>
                  <Link to="/cart" className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/30 hover:bg-muted/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                      <ShoppingCart className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Giỏ hàng</p>
                      <p className="text-xs text-muted-foreground">Xem giỏ hàng</p>
                    </div>
                  </Link>
                  <Link to="/pc-builder" className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/30 hover:bg-muted/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Settings className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Build PC</p>
                      <p className="text-xs text-muted-foreground">Tạo cấu hình</p>
                    </div>
                  </Link>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-3 text-lg font-semibold text-card-foreground">Tài khoản</h2>
                <Button variant="destructive" className="w-full" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-card-foreground">Đơn hàng gần đây</h2>
              <Link to="/orders" className="text-sm text-primary hover:underline">
                Xem tất cả →
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="mx-auto h-16 w-16 text-muted-foreground" />
                <p className="mt-3 text-lg font-medium text-foreground">Bạn chưa có đơn hàng nào</p>
                <p className="mt-1 text-sm text-muted-foreground">Hãy khám phá sản phẩm và đặt đơn hàng đầu tiên!</p>
                <Link to="/products">
                  <Button className="mt-4">Mua sắm ngay</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/order/${order.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                        {order.items.length}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Đơn #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })} · {order.items.length} sản phẩm
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">{formatPrice(order.totalPrice)}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[order.status]}`}>
                        {statusLabel[order.status]}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-1 text-lg font-semibold text-card-foreground">Đổi mật khẩu</h2>
              <p className="mb-4 text-sm text-muted-foreground">Đảm bảo tài khoản luôn an toàn bằng mật khẩu mạnh.</p>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="newPassword">Mật khẩu mới</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Ít nhất 6 ký tự"
                      required
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                  />
                </div>
                <Button type="submit">Đổi mật khẩu</Button>
              </form>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-1 text-lg font-semibold text-card-foreground">Thông tin bảo mật</h2>
                <p className="mb-4 text-sm text-muted-foreground">Thông tin tài khoản của bạn.</p>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Email</span>
                    </div>
                    <span className="font-medium text-foreground">{user.email}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Mật khẩu</span>
                    </div>
                    <span className="font-medium text-foreground">••••••••</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">ID tài khoản</span>
                    </div>
                    <span className="font-mono text-xs text-foreground">{user.id.slice(0, 8)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-destructive/30 bg-card p-6">
                <h2 className="mb-1 text-lg font-semibold text-destructive">Vùng nguy hiểm</h2>
                <p className="mb-4 text-sm text-muted-foreground">Đăng xuất khỏi tài khoản trên thiết bị này.</p>
                <Button variant="destructive" className="w-full" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
