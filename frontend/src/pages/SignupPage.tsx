import { useState } from "react";
import logo from "@/assets/logo.png";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Cpu, Eye, EyeOff } from "lucide-react";

export default function SignupPage() {
  document.title = "Đăng ký - PCShop";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const translateAuthError = (msg?: string) => {
    if (!msg) return "Có lỗi xảy ra";
    const lower = msg.toLowerCase();
    if (lower.includes("phone") && lower.includes("already")) return "Số điện thoại đã tồn tại";
    if (lower.includes("email") && lower.includes("already")) return "Email đã tồn tại";
    if (lower.includes("username") && lower.includes("already")) return "Tên đăng nhập đã tồn tại";
    if (lower.includes("already exists")) return "Đã tồn tại";
    return msg;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Mật khẩu phải có ít nhất 6 ký tự", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Mật khẩu xác nhận không khớp", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error, requiresOtp } = await signUp(email, password, name, phone);
    setLoading(false);
    if (error) {
      toast({ title: "Đăng ký thất bại", description: translateAuthError(error), variant: "destructive" });
    } else if (requiresOtp) {
      toast({
        title: "Đăng ký thành công",
        description: "Vui lòng nhập mã OTP đã gửi về email để hoàn tất tài khoản.",
      });
      navigate("/verify-otp", { state: { email } });
    } else {
      toast({ title: "Đăng ký thành công!" });
      navigate("/");
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-xl font-bold">
            <img src={logo} alt="PCShop Logo" className="h-10 w-auto object-contain transition-all duration-300" />
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-foreground">Tạo tài khoản</h1>
          <p className="mt-2 text-sm text-muted-foreground">Đăng ký để mua sắm dễ dàng hơn</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <Label htmlFor="name">Họ tên</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" required />
          </div>
          <div>
            <Label htmlFor="phone">Số điện thoại (Tùy chọn)</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0123456789" />
          </div>
          <div>
            <Label htmlFor="password">Mật khẩu</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ít nhất 6 ký tự" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu" required />
          </div>
          <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
            {loading ? "Đang xử lý..." : "Đăng ký"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Đã có tài khoản?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
