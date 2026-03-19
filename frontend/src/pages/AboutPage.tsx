import { Link } from "react-router-dom";
import { Cpu, Users, Award, Truck, Shield, Headphones, MapPin, Phone, Mail, Clock } from "lucide-react";

export default function AboutPage() {
  document.title = "Giới thiệu - PCShop";

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container mx-auto px-4 py-16 text-center md:py-24">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Cpu className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-foreground md:text-4xl">
            Về <span className="text-gradient-primary">PCShop</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground md:text-lg">
            Chuyên cung cấp linh kiện PC chính hãng, giá tốt nhất thị trường. 
            Với hơn 5 năm kinh nghiệm, chúng tôi tự hào là đối tác tin cậy của hàng ngàn khách hàng trên cả nước.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card">
        <div className="container mx-auto grid grid-cols-2 gap-6 px-4 py-8 md:grid-cols-4">
          {[
            { value: "5+", label: "Năm kinh nghiệm" },
            { value: "10,000+", label: "Khách hàng" },
            { value: "2,000+", label: "Sản phẩm" },
            { value: "99%", label: "Hài lòng" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-primary">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="mb-8 text-center text-2xl font-bold text-foreground">Tại sao chọn PCShop?</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Award, title: "Hàng chính hãng 100%", desc: "Tất cả sản phẩm đều được nhập khẩu chính hãng với đầy đủ giấy tờ, tem bảo hành." },
            { icon: Truck, title: "Giao hàng toàn quốc", desc: "Miễn phí vận chuyển cho đơn hàng trên 2 triệu. Giao nhanh trong 24h tại TP.HCM." },
            { icon: Shield, title: "Bảo hành tận nơi", desc: "Chính sách bảo hành linh hoạt, đổi trả trong 7 ngày, bảo hành tại hãng lên tới 5 năm." },
            { icon: Headphones, title: "Hỗ trợ 24/7", desc: "Đội ngũ kỹ thuật viên chuyên nghiệp sẵn sàng tư vấn và hỗ trợ bạn mọi lúc." },
            { icon: Users, title: "Cộng đồng lớn", desc: "Tham gia cộng đồng hàng ngàn người dùng để chia sẻ kinh nghiệm build PC." },
            { icon: Cpu, title: "PC Builder thông minh", desc: "Công cụ build PC giúp bạn chọn linh kiện tương thích và tối ưu chi phí." },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/30">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Store info */}
      <section className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <h2 className="mb-8 text-center text-2xl font-bold text-foreground">Thông tin cửa hàng</h2>
          <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
            {[
              { icon: MapPin, label: "Địa chỉ", value: "123 Nguyễn Văn Linh, Quận 7, TP.HCM" },
              { icon: Phone, label: "Hotline", value: "1900 1234 | 0123 456 789" },
              { icon: Mail, label: "Email", value: "support@techpc.vn" },
              { icon: Clock, label: "Giờ mở cửa", value: "8:00 - 21:00 (T2 - CN)" },
            ].map((info) => (
              <div key={info.label} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <info.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{info.label}</p>
                  <p className="text-sm text-muted-foreground">{info.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold text-foreground">Bắt đầu mua sắm ngay!</h2>
        <p className="mt-2 text-muted-foreground">Khám phá hàng ngàn linh kiện PC chính hãng với giá tốt nhất.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/products">
            <button className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Mua sắm ngay
            </button>
          </Link>
          <Link to="/contact">
            <button className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
              Liên hệ
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
