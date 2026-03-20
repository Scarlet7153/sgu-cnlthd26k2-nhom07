import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAdminCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  CategoryRequest,
  AdminCategory,
  AdminCategorySubcategory,
} from "@/hooks/admin/useAdminCategories";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Cpu,
  Monitor,
  HardDrive,
  MemoryStick,
  CircuitBoard,
  Zap,
  Fan,
  Box,
  X,
} from "lucide-react";

const iconMap: Record<string, typeof Cpu> = {
  CPU: Cpu,
  VGA: Monitor,
  GPU: Monitor,
  HARDDISK: HardDrive,
  SSD: HardDrive,
  HDD: HardDrive,
  RAM: MemoryStick,
  MAINBOARD: CircuitBoard,
  MB: CircuitBoard,
  PSU: Zap,
  CASE: Box,
  COOLER: Fan,
};

const getCatId = (cat: AdminCategory): string => {
  if (cat.id) return cat.id;
  if (cat._id?.$oid) return cat._id.$oid;
  if (typeof cat._id === "string") return cat._id;
  return "";
};

const getIsActive = (cat: AdminCategory): boolean => {
  if (cat.is_active !== undefined) return cat.is_active;
  if (cat.isActive !== undefined) return cat.isActive;
  return true;
};

export default function AdminCategories() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(
    null
  );
  const [formData, setFormData] = useState<CategoryRequest>({
    code: "",
    name: "",
    is_active: true,
    subcategory: [],
  });

  const { data: categories = [], isLoading, refetch } = useAdminCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const filteredCategories = categories.filter((cat: AdminCategory) =>
    (cat.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (cat?: AdminCategory) => {
    if (cat) {
      setEditingCategory(cat);
      setFormData({
        code: cat.code,
        name: cat.name,
        is_active: getIsActive(cat),
        subcategory: cat.subcategory
          ? cat.subcategory.map((s) => ({
              name: s.name,
              filter_query: s.filter_query || "",
            }))
          : [],
      });
    } else {
      setEditingCategory(null);
      setFormData({
        code: "",
        name: "",
        is_active: true,
        subcategory: [],
      });
    }
    setIsDialogOpen(true);
  };

  const handleAddSubcategory = () => {
    setFormData({
      ...formData,
      subcategory: [
        ...(formData.subcategory || []),
        { name: "", filter_query: "" },
      ],
    });
  };

  const handleRemoveSubcategory = (index: number) => {
    const subs = [...(formData.subcategory || [])];
    subs.splice(index, 1);
    setFormData({ ...formData, subcategory: subs });
  };

  const handleSubcategoryChange = (
    index: number,
    field: "name" | "filter_query",
    value: string
  ) => {
    const subs = [...(formData.subcategory || [])];
    subs[index] = { ...subs[index], [field]: value };
    setFormData({ ...formData, subcategory: subs });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.code) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền tên và mã danh mục",
        variant: "destructive",
      });
      return;
    }

    const payload: CategoryRequest = {
      code: formData.code.toUpperCase(),
      name: formData.name,
      is_active: formData.is_active,
      subcategory: (formData.subcategory || []).filter((s) => s.name.trim()),
    };

    try {
      if (editingCategory) {
        const id = getCatId(editingCategory);
        if (id) {
          await updateCategory.mutateAsync({ id, data: payload });
          toast({ title: "Thành công", description: "Đã cập nhật danh mục" });
        }
      } else {
        await createCategory.mutateAsync(payload);
        toast({ title: "Thành công", description: "Đã thêm danh mục mới" });
      }
      setIsDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.message || "Có lỗi xảy ra",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (cat: AdminCategory) => {
    const id = getCatId(cat);
    if (!id) return;
    if (!confirm(`Bạn có chắc muốn xóa danh mục "${cat.name}"?`)) return;
    try {
      await deleteCategory.mutateAsync(id);
      toast({ title: "Thành công", description: "Đã xóa danh mục" });
      refetch();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.message || "Không thể xóa danh mục",
        variant: "destructive",
      });
    }
  };

  const getIcon = (code: string) => {
    return iconMap[code?.toUpperCase()] || Cpu;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý danh mục</h1>
          <p className="text-gray-500">{categories.length} danh mục sản phẩm</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm danh mục
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Cập nhật danh mục" : "Thêm danh mục mới"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mã danh mục *</Label>
                  <Input
                    placeholder="VD: CPU, VGA, RAM"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tên danh mục *</Label>
                  <Input
                    placeholder="VD: RAM"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select
                  value={formData.is_active ? "true" : "false"}
                  onValueChange={(v) =>
                    setFormData({ ...formData, is_active: v === "true" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Hoạt động</SelectItem>
                    <SelectItem value="false">Ẩn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Danh mục con</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleAddSubcategory}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Thêm
                  </Button>
                </div>
                <div className="space-y-2">
                  {(formData.subcategory || []).map((sub, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="Tên (VD: Ram DDR5)"
                        value={sub.name}
                        onChange={(e) =>
                          handleSubcategoryChange(index, "name", e.target.value)
                        }
                        className="flex-1"
                      />
                      <Input
                        placeholder="Filter (VD: type:DDR5)"
                        value={sub.filter_query || ""}
                        onChange={(e) =>
                          handleSubcategoryChange(
                            index,
                            "filter_query",
                            e.target.value
                          )
                        }
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 shrink-0"
                        onClick={() => handleRemoveSubcategory(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {(formData.subcategory || []).length === 0 && (
                    <p className="text-xs text-gray-400 py-2">
                      Chưa có danh mục con. Nhấn "Thêm" để thêm mới.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Hủy
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  createCategory.isPending || updateCategory.isPending
                }
              >
                {(createCategory.isPending || updateCategory.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingCategory ? "Cập nhật" : "Thêm danh mục"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Tất cả danh mục</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Tìm kiếm danh mục..."
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Danh mục</th>
                    <th className="pb-3 font-medium w-[100px]">Mã</th>
                    <th className="pb-3 font-medium">Danh mục con</th>
                    <th className="pb-3 font-medium w-[120px]">Trạng thái</th>
                    <th className="pb-3 font-medium text-right w-[100px]">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-gray-500"
                      >
                        Không có danh mục nào
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((cat: AdminCategory) => {
                      const Icon = getIcon(cat.code);
                      const isActive = getIsActive(cat);
                      return (
                        <tr
                          key={getCatId(cat)}
                          className="border-b last:border-0"
                        >
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="rounded-md bg-gray-100 p-1.5">
                                <Icon className="h-4 w-4 text-gray-600" />
                              </div>
                              <span className="text-sm font-medium">
                                {cat.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3">
                            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                              {cat.code}
                            </code>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1">
                              {cat.subcategory?.length ? (
                                cat.subcategory.map((sub, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs text-gray-600"
                                    title={sub.filter_query || ""}
                                  >
                                    {sub.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-400">
                                  Không có
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                isActive
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {isActive ? "Hoạt động" : "Ẩn"}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleOpenDialog(cat)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700"
                                onClick={() => handleDelete(cat)}
                                disabled={deleteCategory.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
