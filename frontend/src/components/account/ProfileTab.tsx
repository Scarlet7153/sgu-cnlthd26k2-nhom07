import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, MapPin, Phone, Mail, Pencil, Loader2 } from "lucide-react";

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

interface ProfileTabProps {
  user: { id: string; email: string; name?: string; phone?: string; address?: string };
}

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

const formatAddress = (
  addr?: { houseNumber?: string; street?: string; ward?: string; province?: string } | null
): string => {
  if (!addr) return "";
  return [addr.houseNumber, addr.street, addr.ward, addr.province]
    .filter(Boolean)
    .join(", ");
};

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

export default function ProfileTab({ user }: ProfileTabProps) {
  const { updateProfile: updateLocalProfile } = useAuth();
  const { getProfile, updateProfile } = useUser();
  const { toast } = useToast();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [street, setStreet] = useState("");
  const [ward, setWard] = useState("");
  const [province, setProvince] = useState("");
  const pendingWard = useRef("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [provinces, setProvinces] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [addrError, setAddrError] = useState<string | null>(null);

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

  useEffect(() => {
    fetch("https://vietnamlabs.com/api/vietnamprovince")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.data || data.c || []);
        setProvinces(Array.isArray(list) ? list : []);
      })
      .catch(() => setProvinces([]));
  }, []);

  useEffect(() => {
    if (!province) { setWards([]); return; }
    setAddrError(null);
    fetch(`https://vietnamlabs.com/api/vietnamprovince?province=${encodeURIComponent(province)}`)
      .then((r) => r.json())
      .then((data) => {
        const list = data?.data?.wards || data?.wards || [];
        const arr: any[] = Array.isArray(list) ? list : [];
        setWards(arr);
        if (pendingWard.current) {
          const saved = pendingWard.current;
          pendingWard.current = "";
          const match = arr.find((w) => getLabel(w) === saved);
          setWard(match ? getLabel(match) : saved);
        }
      })
      .catch((err) => {
        setAddrError(err instanceof Error ? err.message : "Lỗi");
        setWards([]);
      });
  }, [province]);

  const handleStartEdit = () => {
    const savedProvince = profile?.addressDetails?.province || "";
    const savedWard = profile?.addressDetails?.ward || "";
    setName(profile?.fullName || user?.name || "");
    setPhone(profile?.phone || user?.phone || "");
    setHouseNumber(profile?.addressDetails?.houseNumber || "");
    setStreet(profile?.addressDetails?.street || "");
    setNameError("");
    setPhoneError("");
    if (savedWard) {
      pendingWard.current = savedWard;
      setWard("");
    } else {
      setWard("");
    }
    setProvince(savedProvince);
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

  const displayName = profile?.fullName || user.name || "Chưa đặt tên";
  const displayEmail = profile?.email || user.email;
  const displayPhone = profile?.phone || user.phone || "";
  const displayAddress = formatAddress(profile?.addressDetails) || user.address || "";

  return (
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
            <div>
              <Label htmlFor="name">Họ tên <span className="text-destructive">*</span></Label>
              <Input
                id="name" value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(validateName(e.target.value)); }}
                placeholder="Nhập họ tên" className={nameError ? "border-destructive" : ""}
              />
              {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input
                id="phone" value={phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                  setPhone(val);
                  if (phoneError) setPhoneError(validatePhone(val));
                }}
                placeholder="0912345678" maxLength={10} className={phoneError ? "border-destructive" : ""}
              />
              {phoneError && <p className="mt-1 text-xs text-destructive">{phoneError}</p>}
            </div>
            <div>
              <Label>Địa chỉ</Label>
              <div className="mt-2 space-y-3">
                <select
                  value={province}
                  onChange={(e) => { setProvince(e.target.value); setWard(""); }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">-- Chọn tỉnh/thành phố --</option>
                  {provinces.map((p, i) => {
                    const lbl = getLabel(p);
                    return <option key={i} value={lbl}>{lbl}</option>;
                  })}
                </select>
                <select
                  value={ward} onChange={(e) => setWard(e.target.value)} disabled={!province}
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
                  { Icon: User, label: "Họ tên", value: displayName },
                  { Icon: Mail, label: "Email", value: displayEmail },
                  { Icon: Phone, label: "Số điện thoại", value: displayPhone || "Chưa cập nhật" },
                  { Icon: MapPin, label: "Địa chỉ", value: displayAddress || "Chưa cập nhật" },
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

      {/* Quick Actions — kept inline since it's small */}
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">Truy cập nhanh</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: "/orders", icon: "📦", label: "Đơn hàng", sub: "Xem đơn hàng" },
              { to: "/cart", icon: "🛒", label: "Giỏ hàng", sub: "Xem giỏ hàng" },
              { to: "/pc-builder", icon: "⚙️", label: "Build PC", sub: "Tạo cấu hình" },
              { to: "/wishlist", icon: "❤️", label: "Yêu thích", sub: "Danh sách yêu thích" },
            ].map(({ to, icon, label, sub }) => (
              <a key={to} href={to} className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/30 hover:bg-muted/50">
                <span className="text-xl">{icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
