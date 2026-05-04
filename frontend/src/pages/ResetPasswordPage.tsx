import { useState, useEffect } from "react";
import logo from "@/assets/logo.png";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  document.title = "Đặt lại mật khẩu - PCShop";
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, resetPassword, forgotPassword } = useAuth();

  const emailFromState = (location.state as any)?.email || "";

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const [email, setEmail] = useState(emailFromState);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: "Mật khẩu phải có ít nhất 6 ký tự", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Mật khẩu xác nhận không khớp", variant: "destructive" });
      return;
    }

    if (!otp || otp.length !== 6) {
      toast({ title: "Vui lòng nhập mã OTP 6 chữ số", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email, otp, password);
    setLoading(false);

    if (error) {
      toast({ title: "Đặt lại mật khẩu thất bại", description: error, variant: "destructive" });
      return;
    }

    setSuccess(true);
    toast({ title: "Đặt lại mật khẩu thành công!" });
  };

  const handleResendOtp = async () => {
    if (!email) {
      toast({ title: "Vui lòng nhập email", variant: "destructive" });
      return;
    }
    setResendLoading(true);
    const { error } = await forgotPassword(email);
    setResendLoading(false);

    if (error) {
      toast({ title: "Lỗi", description: error, variant: "destructive" });
    } else {
      toast({ title: "Đã gửi lại mã OTP", description: "Kiểm tra email của bạn." });
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          <h1 className="text-2xl font-bold text-foreground">Đặt lại mật khẩu thành công!</h1>
          <p className="text-muted-foreground">Bạn có thể đăng nhập bằng mật khẩu mới.</p>
          <Button onClick={() => navigate("/login")} className="w-full">
            Đăng nhập ngay
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/">
            <img src={logo} alt="PCShop Logo" className="mx-auto h-10 w-auto object-contain transition-all duration-300" />
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-foreground">Đặt mật khẩu mới</h1>
          {emailFromState && (
            <p className="mt-2 text-sm text-muted-foreground">
              Nhập mã OTP đã gửi đến <strong>{emailFromState}</strong>
            </p>
          )}
        </div>
        <form onSubmit={handleReset} className="space-y-4">
          {/* Email field — editable if not from state */}
          {!emailFromState && (
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
              />
            </div>
          )}

          {/* OTP */}
          <div>
            <Label htmlFor="otp">Mã OTP (6 chữ số)</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              required
              className="text-center tracking-[0.5em] text-lg font-mono"
            />
          </div>

          {/* New password */}
          <div>
            <Label htmlFor="password">Mật khẩu mới</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ít nhất 6 ký tự"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              required
            />
          </div>

          <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
            {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendLoading}
              className="text-primary hover:underline disabled:opacity-50"
            >
              {resendLoading ? "Đang gửi..." : "Gửi lại mã OTP"}
            </button>
            <Link to="/login" className="text-primary hover:underline">
              ← Đăng nhập
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
