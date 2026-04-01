import { Link } from "react-router-dom";
import { Cpu } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2 text-lg font-bold">
              <Cpu className="h-6 w-6 text-primary" />
              <span className="text-gradient-primary">PCShop</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Chuyên cung cấp linh kiện PC chính hãng, giá tốt nhất thị trường.
            </p>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-foreground">Sản phẩm</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/products?category=cpu" className="hover:text-primary transition-colors">CPU</Link></li>
              <li><Link to="/products?category=vga" className="hover:text-primary transition-colors">VGA</Link></li>
              <li><Link to="/products?category=mainboard" className="hover:text-primary transition-colors">Mainboard</Link></li>
              <li><Link to="/products?category=ram" className="hover:text-primary transition-colors">RAM</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-foreground">Dịch vụ</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/pc-builder" className="hover:text-primary transition-colors">PC Builder</Link></li>
              <li><Link to="/compare" className="hover:text-primary transition-colors">So sánh sản phẩm</Link></li>
              <li><Link to="/about" className="hover:text-primary transition-colors">Giới thiệu</Link></li>
              <li><Link to="/contact" className="hover:text-primary transition-colors">Liên hệ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-foreground">Liên hệ</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>📍 123 Nguyễn Văn Linh, TP.HCM</li>
              <li>📞 0123 456 789</li>
              <li>✉️ support@techpc.vn</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          © 2026 PCShop. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
