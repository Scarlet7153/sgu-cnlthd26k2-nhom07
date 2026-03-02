import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Cpu } from "lucide-react";

export default function ForgotPasswordPage() {
  document.title = "Quên mật khẩu - TechPC";
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Mock password reset - just show success message
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 1000);
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold">
            <Cpu className="h-8 w-8 text-primary" />
            <span className="text-gradient-primary">TechPC</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-foreground">Quên mật khẩu</h1>
        </div>

        {sent ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-foreground font-medium">Email đã được gửi!</p>
            <p className="mt-2 text-sm text-muted-foreground">Kiểm tra hộp thư để đặt lại mật khẩu.</p>
            <Link to="/login"><Button variant="outline" className="mt-4">Quay lại đăng nhập</Button></Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" required />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
              {loading ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
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
