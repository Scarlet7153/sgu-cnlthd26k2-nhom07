import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAdminProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/hooks/admin/useAdminProducts";
import { useAdminCategories } from "@/hooks/admin/useAdminCategories";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Eye,
} from "lucide-react";

interface SpecEntry {
  key: string;
  value: string;
}

interface ProductFormData {
  name?: string;
  model?: string;
  url?: string;
  price?: number;
  image?: string;
  categoryId?: string;
  socket?: string;
  ram_type?: string[];
  has_igpu?: boolean;
  igpu_name?: string;
  tdp_w?: number;
  cores?: number;
  threads?: number;
  base_clock_ghz?: number;
  boost_clock_ghz?: number;
  specs_raw?: Record<string, any>;
}

export default function AdminProducts() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [page, setPage] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState<ProductFormData>({});
  const [specsEntries, setSpecsEntries] = useState<SpecEntry[]>([]);
  const [viewProduct, setViewProduct] = useState<any>(null);
  const [descriptionText, setDescriptionText] = useState("");

  const { data, isLoading, refetch } = useAdminProducts({
    page,
    size: 10,
    keyword: searchTerm || undefined,
    categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
  });

  const { data: categories = [] } = useAdminCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const products = data?.content || [];
  const totalPages = data?.totalPages || 1;
  const totalElements = data?.totalElements || 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const specsToEntries = (specs: Record<string, any> | undefined): SpecEntry[] => {
    if (!specs || typeof specs !== "object") return [];
    return Object.entries(specs).map(([key, value]) => ({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
    }));
  };

  const entriesToSpecs = (entries: SpecEntry[]): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const e of entries) {
      if (e.key.trim()) {
        result[e.key.trim()] = e.value;
      }
    }
    return result;
  };

  const textToDescriptionHtml = (text: string): string => {
    if (!text.trim()) return "";
    const lines = text.split("\n").filter((l) => l.trim());
    const rows: string[] = [];
    for (const line of lines) {
      const tabIdx = line.indexOf("\t");
      if (tabIdx === -1) continue;
      const key = line.substring(0, tabIdx).trim();
      const value = line.substring(tabIdx + 1).trim();
      if (!key) continue;
      const formattedValue = value.replace(/\n/g, "<br/>");
      rows.push(
        `<tr><th style="text-align:left;padding:6px 8px;">${key}</th><td style="padding:6px 8px;">${formattedValue}</td></tr>`
      );
    }
    if (rows.length === 0) return "";
    return `<table class="specs-table" style="border-collapse:collapse">${rows.join("")}</table>`;
  };

  const htmlToDescriptionText = (html: string | undefined): string => {
    if (!html) return "";
    const parser = new DOMParser();

    // Decode once in case DB stores escaped HTML like &lt;table&gt;...&lt;/table&gt;.
    const decoded = (() => {
      const doc = parser.parseFromString(html, "text/html");
      return doc.documentElement.textContent || html;
    })();

    const parseToLines = (source: string): string[] => {
      const doc = parser.parseFromString(source, "text/html");
      const rows = Array.from(doc.querySelectorAll("tr"));
      const lines: string[] = [];

      for (const row of rows) {
        const headerCell = row.querySelector("th");
        const dataCells = row.querySelectorAll("td");

        if (headerCell && dataCells[0]) {
          const key = headerCell.textContent?.trim() || "";
          const value = dataCells[0].textContent?.trim() || "";
          if (key) lines.push(`${key}\t${value}`);
          continue;
        }

        if (dataCells.length >= 2) {
          const key = dataCells[0].textContent?.trim() || "";
          const value = dataCells[1].textContent?.trim() || "";
          if (key) lines.push(`${key}\t${value}`);
        }
      }

      return lines;
    };

    const directLines = parseToLines(html);
    if (directLines.length > 0) return directLines.join("\n");

    const decodedLines = parseToLines(decoded);
    if (decodedLines.length > 0) return decodedLines.join("\n");

    // Fallback for non-table HTML/text to avoid showing blank in edit form.
    const fallbackDoc = parser.parseFromString(decoded, "text/html");
    return fallbackDoc.body.textContent?.trim() || "";
  };

  const getProductId = (product: any): string => {
    if (product.id) return product.id;
    if (product._id?.$oid) return product._id.$oid;
    if (typeof product._id === "string") return product._id;
    return "";
  };

  const handleOpenDialog = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      // Extract categoryId from various possible formats
      const catId = product.categoryId?.$oid || product.categoryId?.$id || product.categoryId;
      const resolvedCatId = typeof catId === "string" ? catId : (catId && typeof catId === "object" && "$oid" in catId) ? catId.$oid : "";

      setFormData({
        name: product.name ?? "",
        model: product.model ?? "",
        url: product.url ?? "",
        price: product.price ?? 0,
        image: product.image ?? "",
        categoryId: resolvedCatId,
        socket: product.socket != null ? String(product.socket) : "",
        ram_type: Array.isArray(product.ramType) ? product.ramType : Array.isArray(product.ram_type) ? product.ram_type : [],
        has_igpu: Boolean(product.hasIgpu ?? product.has_igpu ?? false),
        igpu_name: product.igpuName ?? product.igpu_name ?? "",
        tdp_w: product.tdpW ?? product.tdp_w ?? 0,
        cores: product.cores ?? 0,
        threads: product.threads ?? 0,
        base_clock_ghz: product.baseClockGhz ?? product.base_clock_ghz ?? 0,
        boost_clock_ghz: product.boostClockGhz ?? product.boost_clock_ghz ?? 0,
      });

      const specsRaw = product.specsRaw ?? product.specs_raw ?? {};
      setSpecsEntries(specsToEntries(specsRaw));

      // Try both camelCase and snake_case
      const descriptionHtml = product.descriptionHtml ?? product.description_html ?? "";
      setDescriptionText(htmlToDescriptionText(descriptionHtml));
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        model: "",
        url: "",
        price: "",
        image: "",
        categoryId: "",
        socket: "",
        ram_type: [],
        has_igpu: false,
        igpu_name: "",
        tdp_w: "",
        cores: "",
        threads: "",
        base_clock_ghz: "",
        boost_clock_ghz: "",
      });
      setSpecsEntries([]);
      setDescriptionText("");
    }
    setIsDialogOpen(true);
  };

  const handleAddSpec = () => {
    setSpecsEntries([...specsEntries, { key: "", value: "" }]);
  };

  const handleRemoveSpec = (index: number) => {
    const entries = [...specsEntries];
    entries.splice(index, 1);
    setSpecsEntries(entries);
  };

  const handleSpecChange = (index: number, field: "key" | "value", value: string) => {
    const entries = [...specsEntries];
    entries[index] = { ...entries[index], [field]: value };
    setSpecsEntries(entries);
  };

  const handleSubmit = async () => {
    // Validation: check required fields (use != null for numbers to allow 0)
    if (
      !formData.name ||
      formData.price == null ||
      !formData.categoryId ||
      !formData.model ||
      !formData.socket ||
      !formData.image ||
      formData.cores == null ||
      formData.threads == null ||
      formData.base_clock_ghz == null ||
      formData.boost_clock_ghz == null ||
      formData.tdp_w == null ||
      (formData.has_igpu && !formData.igpu_name)
    ) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ tất cả thông tin bắt buộc",
        variant: "destructive",
      });
      return;
    }

    const payload: any = {
      name: formData.name,
      model: formData.model,
      url: formData.url,
      price: Number(formData.price),
      image: formData.image,
      categoryId: formData.categoryId,
      socket: formData.socket || "",
      ramType: formData.ram_type?.length ? formData.ram_type : undefined,
      hasIgpu: formData.has_igpu,
      igpuName: formData.has_igpu ? formData.igpu_name : undefined,
      tdpW: Number(formData.tdp_w),
      cores: Number(formData.cores),
      threads: Number(formData.threads),
      baseClockGhz: Number(formData.base_clock_ghz),
      boostClockGhz: Number(formData.boost_clock_ghz),
      specsRaw: entriesToSpecs(specsEntries),
      descriptionHtml: textToDescriptionHtml(descriptionText),
    };

    try {
      if (editingProduct) {
        const productId = getProductId(editingProduct);
        await updateProduct.mutateAsync({ id: productId, data: payload });
        toast({ title: "Thành công", description: "Đã cập nhật sản phẩm" });
      } else {
        await createProduct.mutateAsync(payload);
        toast({ title: "Thành công", description: "Đã thêm sản phẩm mới" });
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

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa sản phẩm này?")) return;
    try {
      await deleteProduct.mutateAsync(id);
      toast({ title: "Thành công", description: "Đã xóa sản phẩm" });
      refetch();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.message || "Không thể xóa sản phẩm",
        variant: "destructive",
      });
    }
  };

  const getCategoryName = (product: any) => {
    const catId = product.categoryId?.$oid || product.categoryId;
    const cat = categories.find((c: any) => c.id === catId || c._id?.$oid === catId || c._id === catId);
    return cat?.name || catId || "-";
  };

  const getImageUrl = (product: any) => {
    return product.image || product.imageUrl || "https://placehold.co/60x60";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý sản phẩm</h1>
          <p className="text-gray-500">{totalElements} sản phẩm trong hệ thống</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm sản phẩm
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Tên sản phẩm *</Label>
                <Input
                  placeholder="Nhập tên sản phẩm"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Model *</Label>
                  <Input
                    placeholder="Nhập model"
                    value={formData.model || ""}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Danh mục *</Label>
                  <Select
                    value={formData.categoryId || ""}
                    onValueChange={(v) => setFormData({ ...formData, categoryId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn danh mục" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat: any) => (
                        <SelectItem key={cat._id?.$oid || cat.id || cat._id} value={cat._id?.$oid || cat.id || cat._id}>
                          {cat.name} ({cat.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Giá bán (VNĐ) *</Label>
                  <Input
                    type="number"
                    placeholder="Nhập giá"
                    value={formData.price ?? ""}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value ? Number(e.target.value) : 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Socket *</Label>
                  <Input
                    placeholder="Nhập socket"
                    value={formData.socket || ""}
                    onChange={(e) => setFormData({ ...formData, socket: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Hình ảnh URL *</Label>
                <Input
                  placeholder="https://..."
                  value={formData.image || ""}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Số nhân *</Label>
                  <Input
                    type="number"
                    placeholder="Nhập số nhân"
                    value={formData.cores ?? ""}
                    onChange={(e) => setFormData({ ...formData, cores: e.target.value ? Number(e.target.value) : 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Số luồng *</Label>
                  <Input
                    type="number"
                    placeholder="Nhập số luồng"
                    value={formData.threads ?? ""}
                    onChange={(e) => setFormData({ ...formData, threads: e.target.value ? Number(e.target.value) : 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Xung cơ bản (GHz) *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Nhập xung cơ bản"
                    value={formData.base_clock_ghz ?? ""}
                    onChange={(e) => setFormData({ ...formData, base_clock_ghz: e.target.value ? Number(e.target.value) : 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Xung boost (GHz) *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Nhập xung boost"
                    value={formData.boost_clock_ghz ?? ""}
                    onChange={(e) => setFormData({ ...formData, boost_clock_ghz: e.target.value ? Number(e.target.value) : 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>TDP (W) *</Label>
                  <Input
                    type="number"
                    placeholder="Nhập TDP"
                    value={formData.tdp_w ?? ""}
                    onChange={(e) => setFormData({ ...formData, tdp_w: e.target.value ? Number(e.target.value) : 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Có iGPU</Label>
                  <Select
                    value={formData.has_igpu ? "true" : "false"}
                    onValueChange={(v) => setFormData({ ...formData, has_igpu: v === "true", igpu_name: v === "true" ? formData.igpu_name : "" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Có</SelectItem>
                      <SelectItem value="false">Không</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.has_igpu && (
                  <div className="space-y-2">
                    <Label>Tên iGPU *</Label>
                    <Input
                      placeholder="Nhập tên iGPU"
                      value={formData.igpu_name || ""}
                      onChange={(e) => setFormData({ ...formData, igpu_name: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Thông số kỹ thuật (specs_raw)</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleAddSpec}>
                    <Plus className="mr-1 h-3 w-3" />
                    Thêm
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {specsEntries.map((spec, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="Tên thông số"
                        value={spec.key}
                        onChange={(e) => handleSpecChange(index, "key", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Giá trị"
                        value={spec.value}
                        onChange={(e) => handleSpecChange(index, "value", e.target.value)}
                        className="flex-[2]"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 shrink-0"
                        onClick={() => handleRemoveSpec(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {specsEntries.length === 0 && (
                    <p className="text-xs text-gray-400 py-2">Chưa có thông số. Nhấn "Thêm" để thêm mới.</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mô tả chi tiết (description_html)</Label>
                <Textarea
                  placeholder="Nhập mô tả theo định dạng: Tên\tGiá trị (mỗi dòng một cặp, ngăn cách bằng Tab)"
                  value={descriptionText}
                  onChange={(e) => setDescriptionText(e.target.value)}
                  rows={8}
                  className="text-sm font-mono"
                />
                <p className="text-xs text-gray-400">
                  Mỗi dòng: tên thông số + Tab + giá trị. Sẽ tự động chuyển sang HTML bảng.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Hủy</Button>
              <Button onClick={handleSubmit} disabled={createProduct.isPending || updateProduct.isPending}>
                {(createProduct.isPending || updateProduct.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingProduct ? "Cập nhật" : "Thêm sản phẩm"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Tìm kiếm sản phẩm..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                className="pl-10"
              />
            </div>
            <Select
              value={selectedCategory}
              onValueChange={(v) => { setSelectedCategory(v); setPage(0); }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tất cả danh mục" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả danh mục</SelectItem>
                {categories.map((cat: any) => (
                  <SelectItem key={cat._id?.$oid || cat.id || cat._id} value={cat.code?.toLowerCase() || cat._id?.$oid || cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                      <th className="pb-3 font-medium">Sản phẩm</th>
                      <th className="pb-3 font-medium">Danh mục</th>
                      <th className="pb-3 font-medium">Giá bán</th>
                      <th className="pb-3 font-medium text-right w-[120px]">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-500">
                          Không có sản phẩm nào
                        </td>
                      </tr>
                    ) : (
                      products.map((product: any) => (
                        <tr key={product.id} className="border-b last:border-0">
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={getImageUrl(product)}
                                alt={product.name}
                                className="h-10 w-10 rounded object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/60x60"; }}
                              />
                              <div>
                                <p className="text-sm font-medium line-clamp-1 max-w-md">{product.name}</p>
                                {product.model && <p className="text-xs text-gray-500">{product.model}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <Badge variant="secondary" className="text-xs">{getCategoryName(product)}</Badge>
                          </td>
                          <td className="py-3 font-medium text-sm text-blue-600">
                            {formatPrice(product.price || 0)}
                          </td>
                          <td className="py-3">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewProduct(product)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenDialog(product)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700"
                                onClick={() => handleDelete(product.id)}
                                disabled={deleteProduct.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Trang {page + 1}/{totalPages} - {totalElements} sản phẩm
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{page + 1} / {totalPages}</span>
                  <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewProduct} onOpenChange={(open) => !open && setViewProduct(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết sản phẩm</DialogTitle>
          </DialogHeader>
          {viewProduct && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <img
                  src={getImageUrl(viewProduct)}
                  alt={viewProduct.name}
                  className="h-32 w-32 rounded object-cover border"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/128x128"; }}
                />
                <div className="flex-1">
                  <h3 className="font-semibold">{viewProduct.name}</h3>
                  {viewProduct.model && <p className="text-sm text-gray-500">{viewProduct.model}</p>}
                  <p className="mt-2 text-lg font-bold text-blue-600">{formatPrice(viewProduct.price || 0)}</p>
                  <Badge variant="secondary" className="mt-1">{getCategoryName(viewProduct)}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {viewProduct.socket && <div><span className="text-gray-500">Socket:</span> {viewProduct.socket}</div>}
                {viewProduct.cores != null && <div><span className="text-gray-500">Nhân:</span> {viewProduct.cores}</div>}
                {viewProduct.threads != null && <div><span className="text-gray-500">Luồng:</span> {viewProduct.threads}</div>}
                {viewProduct.base_clock_ghz != null && <div><span className="text-gray-500">Xung cơ bản:</span> {viewProduct.base_clock_ghz} GHz</div>}
                {viewProduct.boost_clock_ghz != null && <div><span className="text-gray-500">Xung boost:</span> {viewProduct.boost_clock_ghz} GHz</div>}
                {viewProduct.tdp_w != null && <div><span className="text-gray-500">TDP:</span> {viewProduct.tdp_w}W</div>}
                {viewProduct.ram_type?.length > 0 && <div><span className="text-gray-500">RAM:</span> {viewProduct.ram_type.join(", ")}</div>}
                {(viewProduct.igpu_name || viewProduct.hasIgpu || viewProduct.has_igpu) && <div><span className="text-gray-500">iGPU:</span> {viewProduct.igpu_name || "Có"}</div>}
              </div>

              {viewProduct.specs_raw && Object.keys(viewProduct.specs_raw).length > 0 && (
                <div>
                  <h4 className="mb-2 font-medium">Thông số kỹ thuật</h4>
                  <div className="rounded border">
                    {Object.entries(viewProduct.specs_raw).map(([key, value]) => (
                      <div key={key} className="flex border-b last:border-0">
                        <div className="w-1/3 bg-gray-50 px-3 py-2 text-sm font-medium">{key}</div>
                        <div className="flex-1 px-3 py-2 text-sm">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
