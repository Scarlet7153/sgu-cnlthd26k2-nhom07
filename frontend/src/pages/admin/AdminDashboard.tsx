import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdminOrders } from "@/hooks/admin/useAdminOrders";
import { useAdminUsers } from "@/hooks/admin/useAdminUsers";
import { useAdminProducts } from "@/hooks/admin/useAdminProducts";
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  TrendingDown,
  Loader2,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  CreditCard,
  Wallet,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useMemo } from "react";

const statusConfig: Record<string, { label: string; color: string; icon: any; chartColor: string }> = {
  pending: { label: "Chờ xử lý", color: "bg-yellow-100 text-yellow-700", icon: Clock, chartColor: "#eab308" },
  confirmed: { label: "Đã xác nhận", color: "bg-blue-100 text-blue-700", icon: CheckCircle2, chartColor: "#3b82f6" },
  shipping: { label: "Đang giao", color: "bg-purple-100 text-purple-700", icon: Truck, chartColor: "#a855f7" },
  delivered: { label: "Hoàn thành", color: "bg-green-100 text-green-700", icon: CheckCircle2, chartColor: "#22c55e" },
  cancelled: { label: "Đã hủy", color: "bg-red-100 text-red-700", icon: XCircle, chartColor: "#ef4444" },
};

const paymentMethodConfig: Record<string, { label: string; icon: any; color: string }> = {
  MOMO: { label: "MoMo", icon: Wallet, color: "#a855f7" },
  COD: { label: "COD", icon: CreditCard, color: "#f59e0b" },
};

function getStatusBadge(status: string) {
  const config = statusConfig[status] || statusConfig.pending;
  return <Badge className={config.color}>{config.label}</Badge>;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
};

const formatCompactPrice = (price: number) => {
  if (price >= 1_000_000_000) return `${(price / 1_000_000_000).toFixed(1)} tỷ`;
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(0)} tr`;
  if (price >= 1_000) return `${(price / 1_000).toFixed(0)}k`;
  return price.toString();
};

export default function AdminDashboard() {
  const { data: ordersData, isLoading: loadingOrders } = useAdminOrders({
    size: 1000,
  });
  const { data: usersData, isLoading: loadingUsers } = useAdminUsers({
    size: 1,
  });
  const { data: productsData, isLoading: loadingProducts } = useAdminProducts({
    size: 1,
  });

  const orders = ordersData?.content || [];
  const totalOrders = ordersData?.totalElements || 0;
  const totalUsers = usersData?.totalElements || 0;
  const totalProducts = productsData?.totalElements || 0;

  const stats = useMemo(() => {
    const allOrders = orders;
    const nonCancelled = allOrders.filter((o: any) => o.status !== "cancelled");

    const totalRevenue = nonCancelled.reduce(
      (sum: number, o: any) => sum + (o.total || o.totalPrice || 0),
      0
    );

    const ordersByStatus: Record<string, number> = {};
    const revenueByStatus: Record<string, number> = {};
    const ordersByPayment: Record<string, number> = {};

    allOrders.forEach((o: any) => {
      const status = o.status || "unknown";
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;

      if (status !== "cancelled") {
        const total = o.total || o.totalPrice || 0;
        revenueByStatus[status] = (revenueByStatus[status] || 0) + total;
      }

      const payment = o.paymentMethod || "UNKNOWN";
      ordersByPayment[payment] = (ordersByPayment[payment] || 0) + 1;
    });

    const averageOrderValue = allOrders.length > 0 ? totalRevenue / allOrders.length : 0;
    const cancelledCount = ordersByStatus["cancelled"] || 0;
    const cancelRate = allOrders.length > 0 ? (cancelledCount / allOrders.length) * 100 : 0;

    const deliveredCount = ordersByStatus["delivered"] || 0;
    const successRate = allOrders.length > 0 ? (deliveredCount / allOrders.length) * 100 : 0;

    const allStatuses = ["pending", "confirmed", "shipping", "delivered", "cancelled"];
    const statusChartData = allStatuses.map((status) => ({
      name: statusConfig[status]?.label || status,
      value: ordersByStatus[status] || 0,
      fill: statusConfig[status]?.chartColor || "#94a3b8",
    }));

    const revenueChartData = allStatuses
      .filter((s) => s !== "cancelled")
      .map((status) => ({
        name: statusConfig[status]?.label || status,
        revenue: revenueByStatus[status] || 0,
        fill: statusConfig[status]?.chartColor || "#94a3b8",
      }));

    const allPaymentMethods = ["MOMO", "COD"];
    const paymentChartData = allPaymentMethods.map((method) => ({
      name: paymentMethodConfig[method]?.label || method,
      value: ordersByPayment[method] || 0,
      fill: paymentMethodConfig[method]?.color || "#94a3b8",
    }));

    const dailyRevenue: { date: string; revenue: number; orderCount: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}`;
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const dayOrders = allOrders.filter((o: any) => {
        if (!o.createdAt) return false;
        const orderTime = new Date(o.createdAt).getTime();
        return orderTime >= dayStart && orderTime < dayEnd && o.status !== "cancelled";
      });

      const dayRevenue = dayOrders.reduce(
        (sum: number, o: any) => sum + (o.total || o.totalPrice || 0),
        0
      );

      dailyRevenue.push({
        date: dateStr,
        revenue: dayRevenue,
        orderCount: dayOrders.length,
      });
    }

    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    allOrders.forEach((o: any) => {
      if (o.status === "cancelled" || !o.items) return;
      o.items.forEach((item: any) => {
        const key = item.productId || "unknown";
        if (!productSales[key]) {
          productSales[key] = { name: item.productName || "Unknown", quantity: 0, revenue: 0 };
        }
        productSales[key].quantity += item.quantity || 1;
        productSales[key].revenue += item.totalPrice || 0;
      });
    });

    const topProducts = Object.entries(productSales)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const recentOrders = allOrders
      .sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);

    return {
      totalRevenue,
      totalOrders,
      totalUsers,
      totalProducts,
      averageOrderValue,
      cancelRate,
      successRate,
      ordersByStatus,
      revenueByStatus,
      ordersByPayment,
      statusChartData,
      revenueChartData,
      paymentChartData,
      dailyRevenue,
      topProducts,
      recentOrders,
    };
  }, [orders, totalOrders, totalUsers, totalProducts]);

  const isLoading = loadingOrders || loadingUsers || loadingProducts;

  const statCards = [
    {
      title: "Tổng doanh thu",
      value: formatPrice(stats.totalRevenue),
      icon: DollarSign,
      color: "bg-green-500",
      textColor: "text-green-600",
    },
    {
      title: "Tổng đơn hàng",
      value: stats.totalOrders.toLocaleString(),
      icon: ShoppingCart,
      color: "bg-blue-500",
      textColor: "text-blue-600",
    },
    {
      title: "Khách hàng",
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      color: "bg-orange-500",
      textColor: "text-orange-600",
    },
    {
      title: "Sản phẩm",
      value: stats.totalProducts.toLocaleString(),
      icon: Package,
      color: "bg-purple-500",
      textColor: "text-purple-600",
    },
  ];

  const secondaryStats = [
    {
      title: "Giá trị TB / đơn",
      value: formatPrice(stats.averageOrderValue),
      icon: TrendingUp,
      color: "text-emerald-600",
    },
    {
      title: "Tỷ lệ thành công",
      value: `${stats.successRate.toFixed(1)}%`,
      icon: CheckCircle2,
      color: "text-green-600",
    },
    {
      title: "Tỷ lệ hủy",
      value: `${stats.cancelRate.toFixed(1)}%`,
      icon: stats.cancelRate > 20 ? TrendingDown : TrendingUp,
      color: stats.cancelRate > 20 ? "text-red-600" : "text-green-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Tổng quan về cửa hàng linh kiện máy tính</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    {stat.title}
                  </CardTitle>
                  <div className={`rounded-lg p-2 ${stat.color}`}>
                    <stat.icon className="h-4 w-4 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {secondaryStats.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Doanh thu 7 ngày gần đây</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {stats.dailyRevenue.some((d) => d.revenue > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.dailyRevenue}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis
                          tickFormatter={(v) => formatCompactPrice(v)}
                        />
                        <Tooltip
                          formatter={(value: number) => formatPrice(value)}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={{ fill: "#22c55e" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      Chưa có dữ liệu
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Đơn hàng theo trạng thái</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {stats.statusChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.statusChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {stats.statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      Chưa có dữ liệu
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Doanh thu theo trạng thái</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {stats.revenueChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.revenueChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(v) => formatCompactPrice(v)} />
                        <Tooltip
                          formatter={(value: number) => formatPrice(value)}
                        />
                        <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                          {stats.revenueChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      Chưa có dữ liệu
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Phương thức thanh toán</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {stats.paymentChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.paymentChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {stats.paymentChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      Chưa có dữ liệu
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {stats.topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top 5 sản phẩm bán chạy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-gray-500">
                        <th className="pb-3 font-medium">#</th>
                        <th className="pb-3 font-medium">Sản phẩm</th>
                        <th className="pb-3 font-medium">Số lượng đã bán</th>
                        <th className="pb-3 font-medium">Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topProducts.map((product, index) => (
                        <tr key={product.id} className="border-b last:border-0">
                          <td className="py-3 font-medium text-gray-500">
                            {index + 1}
                          </td>
                          <td className="py-3 font-medium">{product.name}</td>
                          <td className="py-3">
                            <Badge variant="secondary">
                              {product.quantity} đã bán
                            </Badge>
                          </td>
                          <td className="py-3 font-medium text-green-600">
                            {formatPrice(product.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Đơn hàng gần đây</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-gray-500">
                      <th className="pb-3 font-medium">Mã đơn</th>
                      <th className="pb-3 font-medium">Khách hàng</th>
                      <th className="pb-3 font-medium">Sản phẩm</th>
                      <th className="pb-3 font-medium">Giá trị</th>
                      <th className="pb-3 font-medium">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400">
                          Chưa có đơn hàng nào
                        </td>
                      </tr>
                    ) : (
                      stats.recentOrders.map((order: any) => (
                        <tr key={order.id} className="border-b last:border-0">
                          <td className="py-3 font-medium">
                            {order.id?.slice(0, 8)}...
                          </td>
                          <td className="py-3">
                            {order.shippingAddress?.fullName || "-"}
                          </td>
                          <td className="py-3">
                            {order.items?.[0]?.productName || "-"}
                            {order.items?.length > 1 &&
                              ` +${order.items.length - 1} sp`}
                          </td>
                          <td className="py-3 font-medium text-blue-600">
                            {formatPrice(order.total || order.totalPrice || 0)}
                          </td>
                          <td className="py-3">
                            {getStatusBadge(order.status)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
