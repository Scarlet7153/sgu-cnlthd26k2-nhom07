import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdminProducts } from "@/hooks/admin/useAdminProducts";
import { useAdminOrders } from "@/hooks/admin/useAdminOrders";
import { useAdminUsers } from "@/hooks/admin/useAdminUsers";
import { useAdminCategories } from "@/hooks/admin/useAdminCategories";
import {
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ xử lý", color: "bg-yellow-100 text-yellow-700" },
  confirmed: { label: "Đã xác nhận", color: "bg-blue-100 text-blue-700" },
  shipping: { label: "Đang giao", color: "bg-purple-100 text-purple-700" },
  delivered: { label: "Hoàn thành", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Đã hủy", color: "bg-red-100 text-red-700" },
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

export default function AdminDashboard() {
  const { data: productsData, isLoading: loadingProducts } = useAdminProducts({
    size: 5,
  });
  const { data: ordersData, isLoading: loadingOrders } = useAdminOrders({
    size: 5,
  });
  const { data: usersData, isLoading: loadingUsers } = useAdminUsers({
    size: 1,
  });
  const { data: categories = [], isLoading: loadingCategories } =
    useAdminCategories();

  const products = productsData?.content || [];
  const totalProducts = productsData?.totalElements || 0;
  const orders = ordersData?.content || [];
  const totalOrders = ordersData?.totalElements || 0;
  const totalUsers = usersData?.totalElements || 0;
  const totalCategories = categories.length;

  const totalRevenue = orders.reduce(
    (sum: number, o: any) => sum + (o.total || o.totalPrice || 0),
    0
  );

  const isLoading =
    loadingProducts || loadingOrders || loadingUsers || loadingCategories;

  // Group orders by status for chart
  const ordersByStatus = orders.reduce(
    (acc: Record<string, number>, o: any) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const statusChartData = Object.entries(ordersByStatus).map(
    ([status, count]) => ({
      name: statusConfig[status]?.label || status,
      value: count,
    })
  );

  // Group products by category for chart
  const productsByCategory = products.reduce(
    (acc: Record<string, number>, p: any) => {
      const catName =
        p.categoryName ||
        p.category?.name ||
        categories.find(
          (c: any) => c.id === p.categoryId || c._id === p.categoryID
        )?.name ||
        "Khác";
      acc[catName] = (acc[catName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const categoryChartData = Object.entries(productsByCategory)
    .map(([name, count]) => ({ name, sales: count }))
    .slice(0, 6);

  const stats = [
    {
      title: "Tổng doanh thu",
      value: formatPrice(totalRevenue),
      icon: DollarSign,
      color: "bg-green-500",
    },
    {
      title: "Đơn hàng",
      value: totalOrders.toLocaleString(),
      icon: ShoppingCart,
      color: "bg-blue-500",
    },
    {
      title: "Sản phẩm",
      value: totalProducts.toLocaleString(),
      icon: Package,
      color: "bg-purple-500",
    },
    {
      title: "Khách hàng",
      value: totalUsers.toLocaleString(),
      icon: Users,
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">
          Tổng quan về cửa hàng linh kiện máy tính
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
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

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Đơn hàng theo trạng thái</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {statusChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar
                          dataKey="value"
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                        />
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
                <CardTitle>Sản phẩm theo danh mục</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {categoryChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar
                          dataKey="sales"
                          fill="#8b5cf6"
                          radius={[4, 4, 0, 0]}
                        />
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
                    {orders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-gray-400"
                        >
                          Chưa có đơn hàng nào
                        </td>
                      </tr>
                    ) : (
                      orders.slice(0, 5).map((order: any) => (
                        <tr
                          key={order.id}
                          className="border-b last:border-0"
                        >
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
