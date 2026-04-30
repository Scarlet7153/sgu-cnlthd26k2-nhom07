import { Badge } from "@/components/ui/badge";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminOrder } from "@/hooks/admin/useAdminOrders";
import { Clock, Package, Truck, CheckCircle, XCircle } from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Chờ xử lý",    color: "text-yellow-700", bg: "bg-yellow-100" },
  confirmed: { label: "Đã xác nhận",  color: "text-blue-700",   bg: "bg-blue-100" },
  shipping:  { label: "Đang giao",    color: "text-purple-700", bg: "bg-purple-100" },
  delivered: { label: "Hoàn thành",   color: "text-green-700",  bg: "bg-green-100" },
  cancelled: { label: "Đã hủy",      color: "text-red-700",    bg: "bg-red-100" },
};

const paymentStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  paid:     { label: "Đã thanh toán",   color: "text-blue-700",   bg: "bg-blue-100" },
  unpaid:   { label: "Chưa thanh toán", color: "text-gray-700",   bg: "bg-gray-100" },
  refunded: { label: "Đã hoàn tiền",   color: "text-orange-700", bg: "bg-orange-100" },
};

interface OrderDetailDialogProps {
  order: AdminOrder;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  try { return new Date(dateStr).toLocaleDateString("vi-VN"); }
  catch { return dateStr; }
};

const getPaymentLabel = (method: string) => {
  const map: Record<string, string> = {
    COD: "COD", MOMO: "MoMo", VNPAY: "VNPay", BANK_TRANSFER: "Chuyển khoản",
  };
  return map[method] || method;
};

export default function OrderDetailDialog({ order }: OrderDetailDialogProps) {
  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Chi tiết đơn hàng</DialogTitle>
      </DialogHeader>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-4">
            <h4 className="mb-3 font-semibold text-gray-700">Thông tin giao hàng</h4>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-500">Tên:</span> {order.shippingAddress?.fullName || "-"}</div>
              <div><span className="text-gray-500">SĐT:</span> {order.shippingAddress?.phone || "-"}</div>
              {order.shippingAddress?.email && (
                <div><span className="text-gray-500">Email:</span> {order.shippingAddress.email}</div>
              )}
              <div>
                <span className="text-gray-500">Địa chỉ:</span>{" "}
                {order.shippingAddress?.address || "-"}
                {order.shippingAddress?.ward ? `, ${order.shippingAddress.ward}` : ""}
                {order.shippingAddress?.district ? `, ${order.shippingAddress.district}` : ""}
                {order.shippingAddress?.province ? `, ${order.shippingAddress.province}` : ""}
              </div>
              {order.note && (
                <div><span className="text-gray-500">Ghi chú:</span> {order.note}</div>
              )}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <h4 className="mb-3 font-semibold text-gray-700">Thông tin đơn hàng</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Mã đơn:</span>{" "}
                <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">{order.id}</code>
              </div>
              <div><span className="text-gray-500">Ngày đặt:</span> {formatDate(order.createdAt)}</div>
              <div>
                <span className="text-gray-500">Thanh toán:</span>{" "}
                <Badge variant="outline">{getPaymentLabel(order.paymentMethod)}</Badge>
              </div>
              <div>
                <span className="text-gray-500">Trạng thái TT:</span>{" "}
                <Badge variant={order.paymentStatus === "paid" ? "default" : order.paymentStatus === "refunded" ? "secondary" : "outline"}>
                  {order.paymentStatus === "paid" ? "Đã thanh toán" : order.paymentStatus === "refunded" ? "Đã hoàn tiền" : "Chưa thanh toán"}
                </Badge>
              </div>
              {order.cancelReason && (
                <div><span className="text-gray-500">Lý do hủy:</span> {order.cancelReason}</div>
              )}
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-gray-700">Sản phẩm ({order.items?.length || 0})</h4>
          <div className="space-y-3">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 rounded-lg border p-3">
                <img src={item.productImage || "https://placehold.co/80x80?text=No+Image"}
                  alt={item.productName} className="h-16 w-16 rounded-lg object-cover border"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/80x80?text=No+Image"; }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.productName}</p>
                  <p className="text-xs text-gray-500">SL: {item.quantity} x {formatPrice(item.productPrice)}</p>
                </div>
                <p className="font-semibold text-blue-600 shrink-0">
                  {formatPrice(item.totalPrice || item.quantity * item.productPrice)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4">
          <span className="font-semibold text-gray-700">Tổng cộng:</span>
          <span className="text-xl font-bold text-blue-600">
            {formatPrice(order.total || order.totalPrice || 0)}
          </span>
        </div>

        {order.historyStatus && order.historyStatus.length > 0 && (
          <div>
            <h4 className="mb-3 font-semibold text-gray-700">Lịch sử trạng thái</h4>
            <div className="space-y-0">
              {order.historyStatus.map((h: any, idx: number) => {
                const isPaymentStatus = h.status?.startsWith("payment_");
                const actualStatus = isPaymentStatus ? h.status.replace("payment_", "") : h.status;
                const config = isPaymentStatus
                  ? (paymentStatusConfig[actualStatus] || { label: h.status, color: "text-gray-700", bg: "bg-gray-100" })
                  : (statusConfig[h.status] || { label: h.status, color: "text-gray-700", bg: "bg-gray-100" });
                const isLast = idx === order.historyStatus.length - 1;
                return (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${config.bg} ${config.color}`}>
                        {idx + 1}
                      </div>
                      {!isLast && <div className="h-full w-px bg-gray-200" />}
                    </div>
                    <div className={`flex-1 ${isLast ? "pb-0" : "pb-4"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-sm text-gray-600">{h.note}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {h.createdAt ? new Date(h.createdAt).toLocaleString("vi-VN") : "-"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );
}
