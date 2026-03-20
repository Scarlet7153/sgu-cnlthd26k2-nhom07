import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Package, Eye, EyeOff, Lock } from "lucide-react";

export default function AdminLoginPage() {
  document.title = "Admin Login - PCShop";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast({
        title: "Đăng nhập thất bại",
        description: error,
        variant: "destructive",
      });
      return;
    }

    const stored = localStorage.getItem("auth-user");
    if (stored) {
      try {
        const user = JSON.parse(stored);
        if (user.role?.toUpperCase() !== "ADMIN") {
          toast({
            title: "Không có quyền truy cập",
            description: "Tài khoản này không phải quản trị viên",
            variant: "destructive",
          });
          localStorage.removeItem("auth-user");
          return;
        }
      } catch {
        toast({
          title: "Lỗi",
          description: "Dữ liệu đăng nhập không hợp lệ",
          variant: "destructive",
        });
        return;
      }
    }

    toast({ title: "Đăng nhập admin thành công!" });
    navigate("/admin");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 shadow-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600">
              <Package className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Admin Panel</h1>
            <p className="mt-1 text-sm text-slate-400">
              Đăng nhập bằng tài khoản quản trị
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@techstore.vn"
                required
                className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-400 focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                Mật khẩu
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-400 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Đang xử lý...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Đăng nhập
                </span>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Chỉ dành cho quản trị viên hệ thống
        </p>
      </div>
    </div>
  );
}
