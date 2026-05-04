import { useState, useMemo } from "react";
import OrderDetailDialog from "@/components/admin/OrderDetailDialog";
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
                                  {selectedOrder && selectedOrder.id === order.id && (
                                    <OrderDetailDialog order={selectedOrder} />
                                  )}
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
