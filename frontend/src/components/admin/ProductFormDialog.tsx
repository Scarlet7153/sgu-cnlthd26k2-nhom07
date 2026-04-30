import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, X, Loader2 } from "lucide-react";

interface SpecEntry { key: string; value: string; }

interface ProductFormData {
  name?: string; model?: string; url?: string; price?: number;
  image?: string; categoryId?: string; socket?: string;
  ram_type?: string[]; has_igpu?: boolean; igpu_name?: string;
  tdp_w?: number; cores?: number; threads?: number;
  base_clock_ghz?: number; boost_clock_ghz?: number;
}

interface ProductFormDialogProps {
  editingProduct: any;
  formData: ProductFormData;
  setFormData: (data: ProductFormData) => void;
  specsEntries: SpecEntry[];
  onAddSpec: () => void;
  onRemoveSpec: (index: number) => void;
  onSpecChange: (index: number, field: "key" | "value", value: string) => void;
  descriptionText: string;
  setDescriptionText: (text: string) => void;
  categories: any[];
  onSubmit: () => void;
  onClose: () => void;
  isPending: boolean;
}

export default function ProductFormDialog({
  editingProduct, formData, setFormData,
  specsEntries, onAddSpec, onRemoveSpec, onSpecChange,
  descriptionText, setDescriptionText,
  categories, onSubmit, onClose, isPending,
}: ProductFormDialogProps) {
  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {editingProduct ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới"}
        </DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2">
          <Label>Tên sản phẩm *</Label>
          <Input placeholder="Nhập tên sản phẩm" value={formData.name || ""}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Model *</Label>
            <Input placeholder="Nhập model" value={formData.model || ""}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Danh mục *</Label>
            <Select value={formData.categoryId || ""}
              onValueChange={(v) => setFormData({ ...formData, categoryId: v })}>
              <SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
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
            <Input type="number" placeholder="Nhập giá" value={formData.price ?? ""}
              onChange={(e) => setFormData({ ...formData, price: e.target.value ? Number(e.target.value) : 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Socket *</Label>
            <Input placeholder="Nhập socket" value={formData.socket || ""}
              onChange={(e) => setFormData({ ...formData, socket: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Hình ảnh URL *</Label>
          <Input placeholder="https://..." value={formData.image || ""}
            onChange={(e) => setFormData({ ...formData, image: e.target.value })} />
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Số nhân *</Label>
            <Input type="number" placeholder="Nhập số nhân" value={formData.cores ?? ""}
              onChange={(e) => setFormData({ ...formData, cores: e.target.value ? Number(e.target.value) : 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Số luồng *</Label>
            <Input type="number" placeholder="Nhập số luồng" value={formData.threads ?? ""}
              onChange={(e) => setFormData({ ...formData, threads: e.target.value ? Number(e.target.value) : 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Xung cơ bản (GHz) *</Label>
            <Input type="number" step="0.1" placeholder="Nhập xung cơ bản" value={formData.base_clock_ghz ?? ""}
              onChange={(e) => setFormData({ ...formData, base_clock_ghz: e.target.value ? Number(e.target.value) : 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Xung boost (GHz) *</Label>
            <Input type="number" step="0.1" placeholder="Nhập xung boost" value={formData.boost_clock_ghz ?? ""}
              onChange={(e) => setFormData({ ...formData, boost_clock_ghz: e.target.value ? Number(e.target.value) : 0 })} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>TDP (W) *</Label>
            <Input type="number" placeholder="Nhập TDP" value={formData.tdp_w ?? ""}
              onChange={(e) => setFormData({ ...formData, tdp_w: e.target.value ? Number(e.target.value) : 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Có iGPU</Label>
            <Select value={formData.has_igpu ? "true" : "false"}
              onValueChange={(v) => setFormData({ ...formData, has_igpu: v === "true", igpu_name: v === "true" ? formData.igpu_name : "" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Có</SelectItem>
                <SelectItem value="false">Không</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formData.has_igpu && (
            <div className="space-y-2">
              <Label>Tên iGPU *</Label>
              <Input placeholder="Nhập tên iGPU" value={formData.igpu_name || ""}
                onChange={(e) => setFormData({ ...formData, igpu_name: e.target.value })} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Thông số kỹ thuật (specs_raw)</Label>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onAddSpec}>
              <Plus className="mr-1 h-3 w-3" /> Thêm
            </Button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {specsEntries.map((spec, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input placeholder="Tên thông số" value={spec.key}
                  onChange={(e) => onSpecChange(index, "key", e.target.value)} className="flex-1" />
                <Input placeholder="Giá trị" value={spec.value}
                  onChange={(e) => onSpecChange(index, "value", e.target.value)} className="flex-[2]" />
                <Button type="button" variant="ghost" size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700 shrink-0"
                  onClick={() => onRemoveSpec(index)}>
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
            value={descriptionText} onChange={(e) => setDescriptionText(e.target.value)}
            rows={8} className="text-sm font-mono" />
          <p className="text-xs text-gray-400">
            Mỗi dòng: tên thông số + Tab + giá trị. Sẽ tự động chuyển sang HTML bảng.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Hủy</Button>
        <Button onClick={onSubmit} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editingProduct ? "Cập nhật" : "Thêm sản phẩm"}
        </Button>
      </div>
    </DialogContent>
  );
}
