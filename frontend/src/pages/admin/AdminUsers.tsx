import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAdminUsers,
  useUpdateUserStatus,
  AdminUser,
} from "@/hooks/admin/useAdminUsers";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const roleConfig: Record<string, { label: string; color: string }> = {
  ADMIN: { label: "Quản trị viên", color: "bg-red-100 text-red-700" },
  admin: { label: "Quản trị viên", color: "bg-red-100 text-red-700" },
  USER: { label: "Khách hàng", color: "bg-gray-100 text-gray-700" },
  user: { label: "Khách hàng", color: "bg-gray-100 text-gray-700" },
};

export default function AdminUsers() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [newStatus, setNewStatus] = useState("");

  const { data, isLoading, refetch } = useAdminUsers({ page, size: 10 });
  const updateStatus = useUpdateUserStatus();

  const users = data?.content || [];
  const totalPages = data?.totalPages || 1;
  const totalElements = data?.totalElements || 0;

  const filteredUsers = searchTerm
    ? users.filter(
        (u: AdminUser) =>
          u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : users;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("vi-VN");
    } catch {
      return dateStr;
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedUser || !newStatus) return;
    try {
      await updateStatus.mutateAsync({
        id: selectedUser.id,
        status: newStatus,
      });
      toast({ title: "Thành công", description: "Đã cập nhật trạng thái" });
      setSelectedUser(null);
      refetch();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.message || "Không thể cập nhật",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quản lý người dùng</h1>
        <p className="text-gray-500">{totalElements} người dùng trong hệ thống</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Danh sách người dùng</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Tìm theo tên, email..."
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
                      <th className="pb-3 font-medium">Người dùng</th>
                      <th className="pb-3 font-medium">Liên hệ</th>
                      <th className="pb-3 font-medium">Vai trò</th>
                      <th className="pb-3 font-medium">Ngày tham gia</th>
                      <th className="pb-3 font-medium">Trạng thái</th>
                      <th className="pb-3 font-medium text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-gray-500"
                        >
                          Không có người dùng nào
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user: AdminUser) => {
                        const config = roleConfig[user.role] || roleConfig.USER;
                        return (
                          <tr key={user.id} className="border-b last:border-0">
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white font-semibold">
                                  {(user.fullName || user.email || "?")
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium">
                                    {user.fullName || "-"}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    ID: {user.id?.slice(0, 8)}...
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4">
                              <p className="text-sm">{user.email}</p>
                              <p className="text-sm text-gray-500">
                                {user.phone || "-"}
                              </p>
                            </td>
                            <td className="py-4">
                              <Badge className={config.color}>
                                {config.label}
                              </Badge>
                            </td>
                            <td className="py-4 text-sm text-gray-500">
                              {formatDate(user.createdAt)}
                            </td>
                            <td className="py-4">
                              <Badge
                                variant={
                                  user.status === "ACTIVE" ||
                                  user.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {user.status === "ACTIVE" ||
                                user.status === "active"
                                  ? "Hoạt động"
                                  : "Khóa"}
                              </Badge>
                            </td>
                            <td className="py-4 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setNewStatus(user.status);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Trang {page + 1}/{totalPages} - {totalElements} người dùng
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
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cập nhật trạng thái người dùng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>
              Người dùng: <strong>{selectedUser?.fullName}</strong>
            </p>
            <p className="text-sm text-gray-500">{selectedUser?.email}</p>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Hoạt động</SelectItem>
                <SelectItem value="INACTIVE">Khóa</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setSelectedUser(null)}
              >
                Hủy
              </Button>
              <Button
                onClick={handleUpdateStatus}
                disabled={updateStatus.isPending}
              >
                {updateStatus.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Cập nhật
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
