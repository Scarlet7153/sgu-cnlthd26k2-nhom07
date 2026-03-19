import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import axiosClient from "@/lib/axiosClient";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader, AlertCircle } from "lucide-react";

interface PaymentStatus {
  orderId: string;
  status: "success" | "failed" | "pending";
  message: string;
}

export default function PaymentResultPage() {
  document.title = "Kết quả thanh toán - TechPC";
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);

  useEffect(() => {
    const rawOrderId = searchParams.get("orderId");
    const orderId = rawOrderId ? rawOrderId.split("_")[0] : null;
    const resultCode = searchParams.get("resultCode");

    if (!orderId) {
      setPaymentStatus({
        orderId: "",
        status: "failed",
        message: "Không tìm thấy thông tin đơn hàng",
      });
      setLoading(false);
      return;
    }

    // Query payment status from backend
    const checkPaymentStatus = async () => {
      try {
        const response = await axiosClient.get(`/payments/order/${orderId}`);
        
        // axiosClient unwraps to response.data (ApiResponse object)
        // response = { success, message, data: Payment }
        const payment = response?.data;
        
        console.log("Payment status response:", response);
        console.log("Payment object:", payment);

        setPaymentStatus({
          orderId,
          status: payment?.status === "success" ? "success" : payment?.status === "failed" ? "failed" : "pending",
          message:
            payment?.status === "success"
              ? "Thanh toán thành công! Đơn hàng của bạn sẽ được xác nhận."
              : payment?.status === "failed"
                ? "Thanh toán thất bại. Vui lòng thử lại."
                : "Đang xử lý thanh toán...",
        });
      } catch (err) {
        console.error("Failed to check payment status:", err);
        // If query fails, use resultCode from URL (may not be reliable)
        const isSuccess = resultCode === "0";
        setPaymentStatus({
          orderId,
          status: isSuccess ? "success" : "failed",
          message: isSuccess
            ? "Thanh toán thành công! Đơn hàng của bạn sẽ được xác nhận."
            : "Thanh toán thất bại. Vui lòng thử lại.",
        });
      } finally {
        setLoading(false);
      }
    };

    // If resultCode=0 (success), auto-confirm payment
    if (resultCode === "0") {
      console.log("Auto-confirming payment for provider order:", rawOrderId, "internal order:", orderId);
      const autoConfirm = async () => {
        try {
          const confirmResponse = await axiosClient.post(`/payments/${rawOrderId}/confirm-dev`);
          const payment = confirmResponse?.data;
          console.log("Auto-confirmed payment:", payment);
          
          setPaymentStatus({
            orderId,
            status: "success",
            message: "Thanh toán thành công! Đơn hàng của bạn sẽ được xác nhận.",
          });
          setLoading(false);
        } catch (err) {
          console.error("Auto-confirm failed, will fetch status:", err);
          checkPaymentStatus();
        }
      };
      autoConfirm();
    } else {
      checkPaymentStatus();
      
      // DEV: Auto-retry polling every 2 seconds for 10 seconds if pending
      // (for testing when MoMo IPN callback cannot reach localhost)
      let retryCount = 0;
      const maxRetries = 5;
      const pollInterval = setInterval(() => {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Polling payment status... attempt ${retryCount}/${maxRetries}`);
          checkPaymentStatus();
        } else {
          clearInterval(pollInterval);
        }
      }, 2000);

      return () => clearInterval(pollInterval);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Loader className="mx-auto h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Đang xử lý kết quả thanh toán...</p>
      </div>
    );
  }

  const isSuccess = paymentStatus?.status === "success";
  const isPending = paymentStatus?.status === "pending";

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 text-center">
        {isSuccess ? (
          <>
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">Thanh toán thành công!</h1>
            <p className="mt-2 text-muted-foreground">{paymentStatus?.message}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Mã đơn hàng: <span className="font-mono font-semibold text-foreground">{paymentStatus?.orderId}</span>
            </p>
            <div className="mt-6 space-y-3">
              <Link to={`/order/${paymentStatus?.orderId}`} className="block">
                <Button className="w-full">Xem chi tiết đơn hàng</Button>
              </Link>
              <Link to="/orders" className="block">
                <Button variant="outline" className="w-full">
                  Quay lại danh sách đơn hàng
                </Button>
              </Link>
            </div>
          </>
        ) : isPending ? (
          <>
            <AlertCircle className="mx-auto h-16 w-16 text-yellow-500" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">Chờ xác nhận thanh toán</h1>
            <p className="mt-2 text-muted-foreground">{paymentStatus?.message}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Mã đơn hàng: <span className="font-mono font-semibold text-foreground">{paymentStatus?.orderId}</span>
            </p>
            <div className="mt-6 space-y-3">
              <Link to={`/order/${paymentStatus?.orderId}`} className="block">
                <Button className="w-full">
                  Xem chi tiết đơn hàng
                </Button>
              </Link>
              <Link to="/cart" className="block">
                <Button variant="outline" className="w-full">
                  Quay lại giỏ hàng
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-16 w-16 text-red-500" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">Thanh toán thất bại</h1>
            <p className="mt-2 text-muted-foreground">{paymentStatus?.message}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Mã đơn hàng: <span className="font-mono font-semibold text-foreground">{paymentStatus?.orderId}</span>
            </p>
            <div className="mt-6 space-y-3">
              <Link to={`/order/${paymentStatus?.orderId}`} className="block">
                <Button className="w-full">Xem chi tiết đơn hàng</Button>
              </Link>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/cart")}
              >
                Quay lại giỏ hàng
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
