import { useState, useEffect } from "react";
import logo from "@/assets/logo.png";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  document.title = "Quên mật khẩu - PCShop";
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, forgotPassword } = useAuth();

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await forgotPassword(email);
    setLoading(false);

    if (error) {
      toast({ title: "Lỗi", description: error, variant: "destructive" });
      return;
    }

    setSent(true);
    toast({
      title: "Đã gửi mã OTP",
      description: "Kiểm tra email để lấy mã OTP đặt lại mật khẩu.",
    });
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-xl font-bold">
            <img src={logo} alt="PCShop Logo" className="h-10 w-auto object-contain transition-all duration-300" />
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-foreground">Quên mật khẩu</h1>
        </div>

        {sent ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-foreground font-medium">Mã OTP đã được gửi!</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Kiểm tra hộp thư <strong>{email}</strong> để lấy mã OTP.
            </p>
            <Button
              variant="default"
              className="mt-4 w-full"
              onClick={() => navigate("/reset-password", { state: { email } })}
            >
              Nhập mã OTP để đặt lại mật khẩu
            </Button>
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => { setSent(false); }}
            >
              Gửi lại mã
            </Button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" required />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
              {loading ? "Đang gửi..." : "Gửi mã OTP đặt lại mật khẩu"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="text-primary hover:underline">← Quay lại đăng nhập</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
