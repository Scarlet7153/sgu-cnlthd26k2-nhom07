import { useState } from "react";
import logo from "@/assets/logo.png";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Cpu, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  document.title = "Đặt lại mật khẩu - PCShop";
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Mật khẩu phải có ít nhất 6 ký tự", variant: "destructive" });
      return;
    }
    setLoading(true);
    // Mock password reset
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Đặt lại mật khẩu thành công!" });
      navigate("/login");
    }, 1000);
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <img src={logo} alt="PCShop Logo" className="mx-auto h-10 w-auto object-contain transition-all duration-300" />
          <h1 className="mt-6 text-2xl font-bold text-foreground">Đặt mật khẩu mới</h1>
        </div>
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <Label htmlFor="password">Mật khẩu mới</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ít nhất 6 ký tự" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
            {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
          </Button>
        </form>
      </div>
    </div>
  );
}
