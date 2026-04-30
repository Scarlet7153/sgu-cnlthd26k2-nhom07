import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Shield, User, LogOut, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SecurityTabProps {
  user: { id: string; email: string };
}

export default function SecurityTab({ user }: SecurityTabProps) {
  const { signOut } = useAuth();
  const { changePassword, error: userError } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string; new?: string; confirm?: string;
  }>({});

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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Change Password */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold text-card-foreground">Đổi mật khẩu</h2>
        <p className="mb-4 text-sm text-muted-foreground">Đảm bảo tài khoản luôn an toàn bằng mật khẩu mạnh.</p>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">Mật khẩu hiện tại <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                id="currentPassword" type={showCurrent ? "text" : "password"}
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
          <div>
            <Label htmlFor="newPassword">Mật khẩu mới <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                id="newPassword" type={showNew ? "text" : "password"}
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
          <div>
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới <span className="text-destructive">*</span></Label>
            <Input
              id="confirmPassword" type="password" value={confirmPassword}
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
              { Icon: Mail, label: "Email", value: user.email },
              { Icon: Shield, label: "Mật khẩu", value: "••••••••" },
              { Icon: User, label: "ID tài khoản", value: user.id.slice(0, 8), mono: true },
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
  );
}
