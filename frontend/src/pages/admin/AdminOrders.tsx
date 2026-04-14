import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useAdminOrders,
  useUpdateOrderStatus,
  AdminOrder,
  AdminOrderStatus,
} from "@/hooks/admin/useAdminOrders";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof Clock; next?: AdminOrderStatus; nextLabel?: string }
> = {
  pending: {
    label: "Chờ xử lý",
    color: "bg-yellow-100 text-yellow-700",
    icon: Clock,
    next: "confirmed",
    nextLabel: "Xác nhận",
  },
  confirmed: {
    label: "Đã xác nhận",
    color: "bg-blue-100 text-blue-700",
    icon: Package,
    next: "shipping",
    nextLabel: "Giao hàng",
  },
  shipping: {
    label: "Đang giao",
    color: "bg-purple-100 text-purple-700",
    icon: Truck,
    next: "delivered",
    nextLabel: "Hoàn thành",
  },
  delivered: {
    label: "Hoàn thành",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  cancelled: {
    label: "Đã hủy",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
};

type SortField = "customer" | null;
type SortOrder = "asc" | "desc";

export default function AdminOrders() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const { data, isLoading, refetch } = useAdminOrders({
    page,
    size: 10,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const updateStatus = useUpdateOrderStatus();

  const orders = data?.content || [];
  const totalPages = data?.totalPages || 1;
  const totalElements = data?.totalElements || 0;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (searchTerm) {
      result = result.filter(
        (o: AdminOrder) =>
          o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.shippingAddress?.fullName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    if (sortField === "customer") {
      result = [...result].sort((a: AdminOrder, b: AdminOrder) => {
        const nameA = (a.shippingAddress?.fullName || "").toLowerCase();
        const nameB = (b.shippingAddress?.fullName || "").toLowerCase();
        if (sortOrder === "asc") return nameA.localeCompare(nameB);
        return nameB.localeCompare(nameA);
      });
    }

    return result;
  }, [orders, searchTerm, sortField, sortOrder]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("vi-VN");
    } catch {
      return dateStr;
    }
  };

  const getPaymentLabel = (method: string) => {
    const map: Record<string, string> = {
      COD: "COD",
      MOMO: "MoMo",
      VNPAY: "VNPay",
      BANK_TRANSFER: "Chuyển khoản",
    };
    return map[method] || method;
  };

  const handleConfirm = async (order: AdminOrder) => {
    const config = statusConfig[order.status];
    if (!config?.next) return;
    const noteMap: Record<string, string> = {
      confirmed: "Đã xác nhận đơn hàng",
      shipping: "Đang giao hàng",
      delivered: "Đã giao hàng thành công",
    };
    try {
      await updateStatus.mutateAsync({
        id: order.id,
        data: { status: config.next, note: noteMap[config.next] || `Chuyển sang ${config.nextLabel}` },
      });
      toast({ title: "Thành công", description: `Đã chuyển sang "${config.nextLabel}"` });
      refetch();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.message || "Không thể cập nhật",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async (order: AdminOrder) => {
    if (!confirm("Bạn có chắc muốn hủy đơn hàng này?")) return;
    try {
      await updateStatus.mutateAsync({
        id: order.id,
        data: { status: "cancelled" },
      });
      toast({ title: "Thành công", description: "Đã hủy đơn hàng" });
      refetch();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.message || "Không thể hủy",
        variant: "destructive",
      });
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-gray-400" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quản lý đơn hàng</h1>
        <p className="text-gray-500">{totalElements} đơn hàng trong hệ thống</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(statusConfig).map(([key, config]) => {
          const isActive = statusFilter === key;
          return (
            <Card
              key={key}
              className={`cursor-pointer transition-all ${
                isActive ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => {
                setStatusFilter(isActive ? "all" : key);
                setPage(0);
              }}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-lg p-2 ${config.color}`}>
                  <config.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{config.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Danh sách đơn hàng</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Tìm theo mã, tên KH..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-gray-500">
                      <th className="pb-3 font-medium w-[180px]">Mã đơn</th>
                      <th
                        className="pb-3 font-medium cursor-pointer select-none hover:text-gray-700"
                        onClick={() => handleSort("customer")}
                      >
                        <span className="flex items-center">
                          Khách hàng
                          <SortIcon field="customer" />
                        </span>
                      </th>
                      <th className="pb-3 font-medium">Ngày đặt</th>
                      <th className="pb-3 font-medium">Tổng tiền</th>
                      <th className="pb-3 font-medium">Thanh toán</th>
                      <th className="pb-3 font-medium">Trạng thái</th>
                      <th className="pb-3 font-medium text-right w-[180px]">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-gray-500"
                        >
                          Không có đơn hàng nào
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order: AdminOrder) => {
                        const config = statusConfig[order.status] || statusConfig.pending;
                        const canConfirm = !!config.next && order.status !== "cancelled";
                        const canCancel = order.status !== "delivered" && order.status !== "cancelled";
                        return (
                          <tr key={order.id} className="border-b last:border-0">
                            <td className="py-4 font-medium text-xs">
                              {order.id}
                            </td>
                            <td className="py-4">
                              <div>
                                <p className="font-medium">
                                  {order.shippingAddress?.fullName || "-"}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {order.shippingAddress?.phone || ""}
                                </p>
                              </div>
                            </td>
                            <td className="py-4 text-gray-500">
                              {formatDate(order.createdAt)}
                            </td>
                            <td className="py-4 font-medium text-blue-600">
                              {formatPrice(order.total || order.totalPrice || 0)}
                            </td>
                            <td className="py-4">
                              <Badge variant="outline">
                                {getPaymentLabel(order.paymentMethod)}
                              </Badge>
                            </td>
                            <td className="py-4">
                              <Badge className={config.color}>
                                {config.label}
                              </Badge>
                            </td>
                            <td className="py-4">
                              <div className="flex items-center justify-end gap-1">
                                {canConfirm && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-green-600 hover:bg-green-50 hover:text-green-700"
                                    onClick={() => handleConfirm(order)}
                                    disabled={updateStatus.isPending}
                                  >
                                    <Check className="mr-1 h-3 w-3" />
                                    {config.nextLabel}
                                  </Button>
                                )}
                                {canCancel && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() => handleCancel(order)}
                                    disabled={updateStatus.isPending}
                                  >
                                    <XCircle className="mr-1 h-3 w-3" />
                                    Hủy
                                  </Button>
                                )}
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => setSelectedOrder(order)}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>
                                        Chi tiết đơn hàng
                                      </DialogTitle>
                                    </DialogHeader>
                                    {selectedOrder && (
                                      <div className="space-y-6">
                                        <div className="grid gap-4 md:grid-cols-2">
                                          <div className="rounded-lg bg-gray-50 p-4">
                                            <h4 className="mb-3 font-semibold text-gray-700">
                                              Thông tin giao hàng
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                              <div>
                                                <span className="text-gray-500">Tên:</span>{" "}
                                                {selectedOrder.shippingAddress?.fullName || "-"}
                                              </div>
                                              <div>
                                                <span className="text-gray-500">SĐT:</span>{" "}
                                                {selectedOrder.shippingAddress?.phone || "-"}
                                              </div>
                                              {selectedOrder.shippingAddress?.email && (
                                                <div>
                                                  <span className="text-gray-500">Email:</span>{" "}
                                                  {selectedOrder.shippingAddress.email}
                                                </div>
                                              )}
                                              <div>
                                                <span className="text-gray-500">Địa chỉ:</span>{" "}
                                                {selectedOrder.shippingAddress?.address || "-"}
                                                {selectedOrder.shippingAddress?.ward
                                                  ? `, ${selectedOrder.shippingAddress.ward}`
                                                  : ""}
                                                {selectedOrder.shippingAddress?.district
                                                  ? `, ${selectedOrder.shippingAddress.district}`
                                                  : ""}
                                                {selectedOrder.shippingAddress?.province
                                                  ? `, ${selectedOrder.shippingAddress.province}`
                                                  : ""}
                                              </div>
                                              {selectedOrder.note && (
                                                <div>
                                                  <span className="text-gray-500">Ghi chú:</span>{" "}
                                                  {selectedOrder.note}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          <div className="rounded-lg bg-gray-50 p-4">
                                            <h4 className="mb-3 font-semibold text-gray-700">
                                              Thông tin đơn hàng
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                              <div>
                                                <span className="text-gray-500">Mã đơn:</span>{" "}
                                                <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">
                                                  {selectedOrder.id}
                                                </code>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Ngày đặt:</span>{" "}
                                                {formatDate(selectedOrder.createdAt)}
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Thanh toán:</span>{" "}
                                                <Badge variant="outline">
                                                  {getPaymentLabel(selectedOrder.paymentMethod)}
                                                </Badge>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Trạng thái TT:</span>{" "}
                                                <Badge
                                                  variant={
                                                    selectedOrder.paymentStatus === "paid"
                                                      ? "default"
                                                      : selectedOrder.paymentStatus === "refunded"
                                                      ? "secondary"
                                                      : "outline"
                                                  }
                                                >
                                                  {selectedOrder.paymentStatus === "paid"
                                                    ? "Đã thanh toán"
                                                    : selectedOrder.paymentStatus === "refunded"
                                                    ? "Đã hoàn tiền"
                                                    : "Chưa thanh toán"}
                                                </Badge>
                                              </div>
                                              {selectedOrder.cancelReason && (
                                                <div>
                                                  <span className="text-gray-500">Lý do hủy:</span>{" "}
                                                  {selectedOrder.cancelReason}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div>
                                          <h4 className="mb-3 font-semibold text-gray-700">
                                            Sản phẩm ({selectedOrder.items?.length || 0})
                                          </h4>
                                          <div className="space-y-3">
                                            {selectedOrder.items?.map((item, idx) => (
                                              <div
                                                key={idx}
                                                className="flex items-center gap-4 rounded-lg border p-3"
                                              >
                                                <img
                                                  src={item.productImage || "https://placehold.co/80x80?text=No+Image"}
                                                  alt={item.productName}
                                                  className="h-16 w-16 rounded-lg object-cover border"
                                                  onError={(e) => {
                                                    (e.target as HTMLImageElement).src =
                                                      "https://placehold.co/80x80?text=No+Image";
                                                  }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-sm font-medium truncate">
                                                    {item.productName}
                                                  </p>
                                                  <p className="text-xs text-gray-500">
                                                    SL: {item.quantity} x{" "}
                                                    {formatPrice(item.productPrice)}
                                                  </p>
                                                </div>
                                                <p className="font-semibold text-blue-600 shrink-0">
                                                  {formatPrice(
                                                    item.totalPrice ||
                                                      item.quantity * item.productPrice
                                                  )}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4">
                                          <span className="font-semibold text-gray-700">
                                            Tổng cộng:
                                          </span>
                                          <span className="text-xl font-bold text-blue-600">
                                            {formatPrice(
                                              selectedOrder.total ||
                                                selectedOrder.totalPrice ||
                                                0
                                            )}
                                          </span>
                                        </div>

                                        {selectedOrder.historyStatus && selectedOrder.historyStatus.length > 0 && (
                                          <div>
                                            <h4 className="mb-3 font-semibold text-gray-700">
                                              Lịch sử trạng thái
                                            </h4>
                                            <div className="space-y-0">
                                              {selectedOrder.historyStatus.map((h: any, idx: number) => {
                                                const isPaymentStatus = h.status?.startsWith("payment_");
                                                const actualStatus = isPaymentStatus ? h.status.replace("payment_", "") : h.status;
                                                const paymentStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
                                                  paid: { label: "Đã thanh toán", color: "text-blue-700", bg: "bg-blue-100" },
                                                  unpaid: { label: "Chưa thanh toán", color: "text-gray-700", bg: "bg-gray-100" },
                                                  refunded: { label: "Đã hoàn tiền", color: "text-orange-700", bg: "bg-orange-100" },
                                                };
                                                const config = isPaymentStatus
                                                  ? (paymentStatusConfig[actualStatus] || { label: h.status, color: "text-gray-700", bg: "bg-gray-100" })
                                                  : (statusConfig[h.status] || { label: h.status, color: "text-gray-700", bg: "bg-gray-100" });
                                                const isLast = idx === selectedOrder.historyStatus.length - 1;
                                                return (
                                                  <div key={idx} className="flex gap-3">
                                                    <div className="flex flex-col items-center">
                                                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${config.bg} ${config.color}`}>
                                                        {idx + 1}
                                                      </div>
                                                      {!isLast && (
                                                        <div className="h-full w-px bg-gray-200" />
                                                      )}
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
                                    )}
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Trang {page + 1}/{totalPages} - {totalElements} đơn hàng
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page >= totalPages - 1}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
