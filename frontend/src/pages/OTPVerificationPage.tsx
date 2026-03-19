import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "@/assets/logo.png";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { translateErrorMessage } from "@/lib/errorMessageTranslation";
import { OTPInput } from "@/components/OTPInput";

export default function OTPVerificationPage() {
  document.title = "Xác thực OTP - PCShop";
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { verifyOtp, resendOtp } = useAuth();
  
  // Get email from route state
  const email = (location.state as any)?.email || "";
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState(900); // 15 minutes - OTP expiry
  const [resendCooldown, setResendCooldown] = useState(60); // 60 seconds - resend cooldown

  // Redirect if no email provided
  useEffect(() => {
    if (!email) {
      navigate("/signup");
    }
  }, [email, navigate]);

  // Countdown timer for OTP expiry (15 minutes)
  useEffect(() => {
    if (otpExpiresIn <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setOtpExpiresIn((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [otpExpiresIn]);

  // Countdown timer for resend cooldown (60 seconds)
  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      toast({ 
        title: "Mã OTP không hợp lệ", 
        description: "Vui lòng nhập đúng 6 ký tự", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    const { error } = await verifyOtp(email, otp);
    setLoading(false);

    if (error) {
      toast({ 
        title: "Xác thực thất bại", 
        description: translateErrorMessage(error), 
        variant: "destructive" 
      });
    } else {
      toast({ title: "Xác thực thành công!" });
      navigate("/", { replace: true });
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    const { error, otpExpiresIn } = await resendOtp(email);
    setResending(false);

    if (error) {
      toast({ 
        title: "Gửi lại thất bại", 
        description: translateErrorMessage(error), 
        variant: "destructive" 
      });
    } else {
      toast({ title: "Mã OTP mới đã được gửi!" });
      setOtpExpiresIn(otpExpiresIn || 900); // Reset OTP expiry
      setResendCooldown(60); // Reset resend cooldown to 60 seconds
      setOtp("");
    }
  };

  if (!email) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-primary-foreground"></div>
          <p className="mt-4 text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-xl font-bold">
            <img src={logo} alt="PCShop Logo" className="w-auto object-contain transition-all duration-300" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-foreground">Xác thực OTP</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Mã xác thực đã được gửi đến email
          </p>
          <p className="text-sm font-semibold text-foreground">{email}</p>
        </div>

        <form onSubmit={handleVerifyOtp} className="space-y-6">
          <div>
            <Label htmlFor="otp">Mã OTP (6 ký tự)</Label>
            <div className="mt-2">
              <OTPInput
                value={otp}
                onChange={setOtp}
                length={6}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Hết hạn trong: <span className="font-semibold text-foreground">{formatTime(otpExpiresIn)}</span>
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || otp.length !== 6}
          >
            {loading ? "Đang xác thực..." : "Xác thực"}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">Không nhận được mã?</p>
          <Button
            type="button"
            variant="link"
            onClick={handleResendOtp}
            disabled={resendCooldown > 0 || resending}
            className="text-primary hover:underline"
          >
            {resending ? "Đang gửi..." : resendCooldown > 0 ? `Gửi lại trong ${formatTime(resendCooldown)}` : "Gửi lại OTP"}
          </Button>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Lỗi? <a href="/signup" className="text-primary hover:underline">Quay lại đăng ký</a>
          </p>
        </div>
      </div>
    </div>
  );
}
