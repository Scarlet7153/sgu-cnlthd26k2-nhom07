import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useOrders } from "@/hooks/useOrders";
import { useUser } from "@/hooks/useUser";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  User, Package, LogOut, Eye, EyeOff, ShoppingCart, MapPin,
  Phone, Mail, Shield, ChevronRight, Settings, Pencil, Loader2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProfileData {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  addressDetails?: {
    houseNumber?: string;
    street?: string;
    ward?: string;
    province?: string;
  };
}

export default function AccountPage() {
  document.title = "Tài khoản - PCShop";

  const { user, signOut, updateProfile: updateLocalProfile } = useAuth();
  const { orders } = useOrders();
  const { getProfile, updateProfile, changePassword, error: userError } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Profile loaded from API
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Edit form state
  const [editingProfile, setEditingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [street, setStreet] = useState("");
  const [ward, setWard] = useState("");
  const [province, setProvince] = useState("");
  // Used to restore ward after wards list loads asynchronously
  const pendingWard = useRef("");

  // Validation errors
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string; new?: string; confirm?: string;
  }>({});

  // Province/ward
  const [provinces, setProvinces] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [addrError, setAddrError] = useState<string | null>(null);

  // ─── helpers ─────────────────────────────────────────────────────────────────
  const getLabel = (item: any): string => {
    if (!item) return "";
    const base = item.p ?? item;
    return (
      item.lbl || base.province || base.province_name || base.ProvinceName ||
      base.name || base.Name || base.title || base.label ||
      base.name_with_type || base.ten ||
      (typeof item === "string" ? item : JSON.stringify(item))
    );
  };

  const getCode = (item: any): string | undefined => {
    if (!item) return undefined;
    const base = item.p ?? item;
    const v = item.cd ?? base.id ?? base.code ?? base.value ?? base.C ?? base.c;
    return v !== undefined ? String(v) : undefined;
  };

  const getSelectValue = (item: any): string =>
    getCode(item) || getLabel(item) || "";

  const formatAddress = (
    addr?: { houseNumber?: string; street?: string; ward?: string; province?: string } | null
  ): string => {
    if (!addr) return "";
    return [addr.houseNumber, addr.street, addr.ward, addr.province]
      .filter(Boolean)
      .join(", ");
  };

  // ─── load profile from backend ───────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const data = await getProfile();
      if (data) {
        const p: ProfileData = {
          id: data.id,
          fullName: (data as any).fullName || (data as any).name || "",
          email: data.email,
          phone: data.phone || "",
          addressDetails: (data as any).addressDetails,
        };
        setProfile(p);
        updateLocalProfile({
          name: p.fullName,
          phone: p.phone,
          address: formatAddress(p.addressDetails),
        });
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setProfileLoading(false);
    }
  }, [getProfile, updateLocalProfile]);

  useEffect(() => {
    if (user?.id) loadProfile();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── load provinces on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch("https://vietnamlabs.com/api/vietnamprovince")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.data || data.c || []);
        setProvinces(Array.isArray(list) ? list : []);
      })
      .catch(() => setProvinces([]));
  }, []);

  // ─── load wards when province changes + restore pending ward ──────────────────
  useEffect(() => {
    if (!province) { setWards([]); return; }
    setAddrError(null);
    fetch(`https://vietnamlabs.com/api/vietnamprovince?province=${encodeURIComponent(province)}`)
      .then((r) => r.json())
      .then((data) => {
        const list = data?.data?.wards || data?.wards || [];
        const arr: any[] = Array.isArray(list) ? list : [];
        setWards(arr);
        // Restore ward after wards load (e.g. when entering edit mode)
        if (pendingWard.current) {
          const saved = pendingWard.current;
          pendingWard.current = "";
          // Find ward that matches by name
          const match = arr.find((w) => getLabel(w) === saved);
          setWard(match ? getLabel(match) : saved);
        }
      })
      .catch((err) => {
        setAddrError(err instanceof Error ? err.message : "Lỗi");
        setWards([]);
      });
  }, [province]);

  // ─── validation ──────────────────────────────────────────────────────────────
  const validateName = (v: string): string => {
    if (!v.trim()) return "Họ tên không được để trống";
    if (v.trim().length < 2) return "Họ tên phải có ít nhất 2 ký tự";
    if (v.trim().length > 100) return "Họ tên quá dài (tối đa 100 ký tự)";
    return "";
  };

  const validatePhone = (v: string): string => {
    if (!v.trim()) return "";
    const re = /^(0[3|5|7|8|9])[0-9]{8}$/;
    if (!re.test(v.trim())) return "Số điện thoại không hợp lệ (VD: 0912345678)";
    return "";
  };

  const validatePassword = () => {
    const errors: { current?: string; new?: string; confirm?: string } = {};
    if (!currentPassword) errors.current = "Vui lòng nhập mật khẩu hiện tại";
    if (!newPassword) {
      errors.new = "Vui lòng nhập mật khẩu mới";
    } else if (newPassword.length < 6) {
      errors.new = "Mật khẩu mới phải có ít nhất 6 ký tự";
    } else if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      errors.new = "Mật khẩu phải chứa cả chữ cái và số";
    }
    if (!confirmPassword) {
      errors.confirm = "Vui lòng xác nhận mật khẩu mới";
    } else if (newPassword !== confirmPassword) {
      errors.confirm = "Mật khẩu xác nhận không khớp";
    }
    return errors;
  };

  // ─── handlers ────────────────────────────────────────────────────────────────
  const handleStartEdit = () => {
    const savedProvince = profile?.addressDetails?.province || "";
    const savedWard     = profile?.addressDetails?.ward     || "";

    setName(profile?.fullName || user?.name || "");
    setPhone(profile?.phone   || user?.phone || "");
    setHouseNumber(profile?.addressDetails?.houseNumber || "");
    setStreet(profile?.addressDetails?.street || "");
    setNameError("");
    setPhoneError("");

    if (savedWard) {
      // Ward must be restored after wards list loads — store it for the effect
      pendingWard.current = savedWard;
      setWard("");           // clear first so select doesn't show wrong value
    } else {
      setWard("");
    }
    setProvince(savedProvince); // triggers wards useEffect → loads wards → restores ward
    setEditingProfile(true);
  };

  const handleCancelEdit = () => {
    setEditingProfile(false);
    setNameError("");
    setPhoneError("");
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const nErr = validateName(name);
    const pErr = validatePhone(phone);
    setNameError(nErr);
    setPhoneError(pErr);
    if (nErr || pErr) return;

    setSaving(true);
    try {
      const result = await updateProfile({
        fullName: name.trim(),
        phone: phone.trim() || undefined,
        houseNumber: houseNumber.trim() || undefined,
        street: street.trim() || undefined,
        ward: ward.trim() || undefined,
        province: province.trim() || undefined,
      });

      if (result?.error) {
        toast({ title: "Lỗi cập nhật", description: result.error, variant: "destructive" });
        return;
      }

      const addrStr = [houseNumber, street, ward, province].filter(Boolean).join(", ");
      updateLocalProfile({ name: name.trim(), phone: phone.trim(), address: addrStr });

      await loadProfile();
      setEditingProfile(false);
      toast({ title: "Cập nhật thành công!", description: "Thông tin cá nhân đã được lưu." });
    } catch {
      toast({ title: "Lỗi", description: "Không thể cập nhật. Vui lòng thử lại.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validatePassword();
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPasswordSaving(true);
    try {
      const success = await changePassword(currentPassword, newPassword);
      if (success) {
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        setPasswordErrors({});
        toast({ title: "Đổi mật khẩu thành công!", description: "Mật khẩu đã được cập nhật." });
      } else {
        toast({
          title: "Đổi mật khẩu thất bại",
          description: userError || "Mật khẩu hiện tại không đúng.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Lỗi", description: "Không thể đổi mật khẩu. Vui lòng thử lại.", variant: "destructive" });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  // ─── guard ───────────────────────────────────────────────────────────────────
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

  // ─── display values ───────────────────────────────────────────────────────────
  const displayName    = profile?.fullName || user.name || "Chưa đặt tên";
  const displayEmail   = profile?.email    || user.email;
  const displayPhone   = profile?.phone    || user.phone || "";
  const displayAddress = formatAddress(profile?.addressDetails) || user.address || "";

  const recentOrders   = orders.slice(0, 5);
  const totalSpent     = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + (o.total ?? 0), 0);
  const deliveredCount = orders.filter(o => o.status === "delivered").length;
  const initials       = (displayName || displayEmail).slice(0, 2).toUpperCase();

  const statusLabel: Record<string, string> = {
    pending: "Chờ xác nhận", confirmed: "Đã xác nhận", shipping: "Đang giao",
    delivered: "Đã giao", cancelled: "Đã hủy",
  };
  const statusColor: Record<string, string> = {
    pending:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    shipping:  "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  // ─── render ───────────────────────────────────────────────────────────────────
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
              <h1 className="text-xl font-bold text-foreground">
                {profileLoading ? <span className="animate-pulse text-muted-foreground">Đang tải...</span> : displayName}
              </h1>
              <p className="text-sm text-muted-foreground">{displayEmail}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleStartEdit} className="self-start sm:self-end">
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Chỉnh sửa
            </Button>
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

        {/* ── Profile Tab ── */}
        <TabsContent value="profile">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Personal Info Card */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-card-foreground">Thông tin cá nhân</h2>
                {!editingProfile && (
                  <Button variant="ghost" size="sm" onClick={handleStartEdit}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Sửa
                  </Button>
                )}
              </div>

              {editingProfile ? (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  {/* Name */}
                  <div>
                    <Label htmlFor="name">Họ tên <span className="text-destructive">*</span></Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => { setName(e.target.value); if (nameError) setNameError(validateName(e.target.value)); }}
                      placeholder="Nhập họ tên"
                      className={nameError ? "border-destructive" : ""}
                    />
                    {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <Label htmlFor="phone">Số điện thoại</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                        setPhone(val);
                        if (phoneError) setPhoneError(validatePhone(val));
                      }}
                      placeholder="0912345678"
                      maxLength={10}
                      className={phoneError ? "border-destructive" : ""}
                    />
                    {phoneError && <p className="mt-1 text-xs text-destructive">{phoneError}</p>}
                  </div>

                  {/* Address */}
                  <div>
                    <Label>Địa chỉ</Label>
                    <div className="mt-2 space-y-3">
                      <select
                        value={province}
                        onChange={(e) => {
                          setProvince(e.target.value);
                          setWard("");
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">-- Chọn tỉnh/thành phố --</option>
                        {provinces.map((p, i) => {
                          const lbl = getLabel(p);
                          return <option key={i} value={lbl}>{lbl}</option>;
                        })}
                      </select>

                      <select
                        value={ward}
                        onChange={(e) => setWard(e.target.value)}
                        disabled={!province}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                      >
                        <option value="">-- Chọn phường/xã --</option>
                        {wards.map((w, i) => {
                          const lbl = getLabel(w);
                          return <option key={i} value={lbl}>{lbl}</option>;
                        })}
                      </select>

                      <Input placeholder="Nhập tên đường" value={street} onChange={(e) => setStreet(e.target.value)} />
                      <Input placeholder="Nhập số nhà" value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
                    </div>
                    {addrError && <p className="mt-2 text-sm text-destructive">{addrError}</p>}
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {saving ? "Đang lưu..." : "Lưu thay đổi"}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={saving}>Hủy</Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {profileLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="ml-2 text-sm text-muted-foreground">Đang tải thông tin...</span>
                    </div>
                  ) : (
                    <>
                      {[
                        { Icon: User,   label: "Họ tên",          value: displayName },
                        { Icon: Mail,   label: "Email",            value: displayEmail },
                        { Icon: Phone,  label: "Số điện thoại",   value: displayPhone  || "Chưa cập nhật" },
                        { Icon: MapPin, label: "Địa chỉ",         value: displayAddress || "Chưa cập nhật" },
                      ].map(({ Icon, label, value }) => (
                        <div key={label} className="flex items-start gap-3">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-sm font-medium text-foreground">{value}</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold text-card-foreground">Truy cập nhanh</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { to: "/orders",     icon: <Package className="h-5 w-5 text-blue-600"   />, bg: "bg-blue-100 dark:bg-blue-900/30",   label: "Đơn hàng",  sub: `${orders.length} đơn` },
                    { to: "/cart",       icon: <ShoppingCart className="h-5 w-5 text-green-600" />, bg: "bg-green-100 dark:bg-green-900/30", label: "Giỏ hàng",  sub: "Xem giỏ hàng" },
                    { to: "/pc-builder", icon: <Settings className="h-5 w-5 text-purple-600" />, bg: "bg-purple-100 dark:bg-purple-900/30", label: "Build PC",   sub: "Tạo cấu hình" },
                  ].map(({ to, icon, bg, label, sub }) => (
                    <Link key={to} to={to} className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/30 hover:bg-muted/50">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>{icon}</div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                    </Link>
                  ))}
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

        {/* ── Orders Tab ── */}
        <TabsContent value="orders">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-card-foreground">Đơn hàng gần đây</h2>
              <Link to="/orders" className="text-sm text-primary hover:underline">Xem tất cả →</Link>
            </div>
            {recentOrders.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="mx-auto h-16 w-16 text-muted-foreground" />
                <p className="mt-3 text-lg font-medium text-foreground">Bạn chưa có đơn hàng nào</p>
                <p className="mt-1 text-sm text-muted-foreground">Hãy khám phá sản phẩm và đặt đơn hàng đầu tiên!</p>
                <Link to="/products"><Button className="mt-4">Mua sắm ngay</Button></Link>
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
                        <p className="text-sm font-medium text-foreground">Đơn #{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          {" · "}{order.items.length} sản phẩm
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">{formatPrice(order.total)}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[order.status] ?? statusColor.pending}`}>
                        {statusLabel[order.status] ?? order.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Security Tab ── */}
        <TabsContent value="security">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Change Password */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-1 text-lg font-semibold text-card-foreground">Đổi mật khẩu</h2>
              <p className="mb-4 text-sm text-muted-foreground">Đảm bảo tài khoản luôn an toàn bằng mật khẩu mạnh.</p>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* Current password */}
                <div>
                  <Label htmlFor="currentPassword">Mật khẩu hiện tại <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => { setCurrentPassword(e.target.value); if (passwordErrors.current) setPasswordErrors(p => ({ ...p, current: undefined })); }}
                      className={passwordErrors.current ? "border-destructive" : ""}
                    />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordErrors.current && <p className="mt-1 text-xs text-destructive">{passwordErrors.current}</p>}
                </div>

                {/* New password */}
                <div>
                  <Label htmlFor="newPassword">Mật khẩu mới <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); if (passwordErrors.new) setPasswordErrors(p => ({ ...p, new: undefined })); }}
                      placeholder="Ít nhất 6 ký tự, chứa chữ và số"
                      className={passwordErrors.new ? "border-destructive" : ""}
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordErrors.new && <p className="mt-1 text-xs text-destructive">{passwordErrors.new}</p>}
                </div>

                {/* Confirm password */}
                <div>
                  <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới <span className="text-destructive">*</span></Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); if (passwordErrors.confirm) setPasswordErrors(p => ({ ...p, confirm: undefined })); }}
                    placeholder="Nhập lại mật khẩu mới"
                    className={passwordErrors.confirm ? "border-destructive" : ""}
                  />
                  {passwordErrors.confirm && <p className="mt-1 text-xs text-destructive">{passwordErrors.confirm}</p>}
                </div>

                <Button type="submit" disabled={passwordSaving}>
                  {passwordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {passwordSaving ? "Đang xử lý..." : "Đổi mật khẩu"}
                </Button>
              </form>
            </div>

            {/* Security Info */}
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-1 text-lg font-semibold text-card-foreground">Thông tin bảo mật</h2>
                <p className="mb-4 text-sm text-muted-foreground">Thông tin tài khoản của bạn.</p>
                <div className="space-y-3 text-sm">
                  {[
                    { Icon: Mail,   label: "Email",        value: displayEmail },
                    { Icon: Shield, label: "Mật khẩu",    value: "••••••••" },
                    { Icon: User,   label: "ID tài khoản", value: user.id.slice(0, 8), mono: true },
                  ].map(({ Icon, label, value, mono }) => (
                    <div key={label} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{label}</span>
                      </div>
                      <span className={`font-medium text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
                    </div>
                  ))}
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
