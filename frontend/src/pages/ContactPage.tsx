import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Phone, Mail, Clock, Send, ChevronRight, MessageSquare } from "lucide-react";

export default function ContactPage() {
  document.title = "Liên hệ - PCShop";
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Mock submit
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Gửi thành công!", description: "Chúng tôi sẽ phản hồi trong thời gian sớm nhất." });
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    }, 1000);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">Trang chủ</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Liên hệ</span>
      </div>

      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">Liên hệ với chúng tôi</h1>
        <p className="mt-2 text-muted-foreground">Bạn có câu hỏi hoặc cần hỗ trợ? Hãy liên hệ ngay!</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Contact Info */}
        <div className="space-y-4">
          {[
            { icon: MapPin, title: "Địa chỉ", lines: ["123 Nguyễn Văn Linh", "Quận 7, TP. Hồ Chí Minh"] },
            { icon: Phone, title: "Điện thoại", lines: ["Hotline: 1900 1234", "Di động: 0123 456 789"] },
            { icon: Mail, title: "Email", lines: ["support@techpc.vn", "sales@techpc.vn"] },
            { icon: Clock, title: "Giờ làm việc", lines: ["Thứ 2 - Chủ nhật", "8:00 - 21:00"] },
          ].map((info) => (
            <div key={info.title} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <info.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{info.title}</p>
                {info.lines.map((line) => (
                  <p key={line} className="text-sm text-muted-foreground">{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-card-foreground">
              <MessageSquare className="h-5 w-5 text-primary" /> Gửi tin nhắn
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">Điền thông tin bên dưới, chúng tôi sẽ phản hồi sớm nhất.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Họ tên *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@example.com"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Số điện thoại</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="0912345678"
                  />
                </div>
                <div>
                  <Label htmlFor="subject">Chủ đề *</Label>
                  <Input
                    id="subject"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Tư vấn sản phẩm, bảo hành..."
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="message">Nội dung *</Label>
                <Textarea
                  id="message"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Nhập nội dung tin nhắn..."
                  rows={5}
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? "Đang gửi..." : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Gửi tin nhắn
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
