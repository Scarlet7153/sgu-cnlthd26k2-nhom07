import jsPDF from "jspdf";
import type { Order } from "@/hooks/useOrders";

const STATUS_LABEL: Record<string, string> = {
  pending: "Cho xac nhan",
  confirmed: "Da xac nhan",
  shipping: "Dang giao hang",
  delivered: "Da giao hang",
  cancelled: "Da huy",
};

const PAYMENT_LABEL: Record<string, string> = {
  COD: "Thanh toan khi nhan hang (COD)",
  MOMO: "Vi MoMo",
  VNPAY: "VNPay",
  BANK_TRANSFER: "Chuyen khoan ngan hang",
  cod: "Thanh toan khi nhan hang (COD)",
  banking: "Chuyen khoan ngan hang",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: "Chua thanh toan",
  paid: "Da thanh toan",
  refunded: "Da hoan tien",
};

/**
 * Remove Vietnamese diacritical marks for jsPDF compatibility
 * (jsPDF default fonts don't support Unicode Vietnamese characters)
 */
function removeDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function fmtPrice(price: number): string {
  return new Intl.NumberFormat("vi-VN").format(price) + " VND";
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateOrderInvoicePDF(order: Order): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 20;

  // ---- Header ----
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175); // primary blue
  doc.text("PCSHOP", marginL, y);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("www.pcshop.vn", pageW - marginR, y, { align: "right" });
  y += 4;
  doc.text("Hotline: 1900 1234", pageW - marginR, y, { align: "right" });

  y += 10;

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("HOA DON BAN HANG", pageW / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`(Invoice)`, pageW / 2, y, { align: "center" });
  y += 10;

  // ---- Order info row ----
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  const orderId = order.id.slice(0, 8).toUpperCase();
  doc.text(`Ma don hang: #${orderId}`, marginL, y);
  doc.text(`Ngay dat: ${fmtDate(order.createdAt)}`, pageW - marginR, y, { align: "right" });
  y += 5;
  doc.text(`Trang thai: ${STATUS_LABEL[order.status] || order.status}`, marginL, y);
  doc.text(`Thanh toan: ${PAYMENT_STATUS_LABEL[order.paymentStatus || "unpaid"]}`, pageW - marginR, y, { align: "right" });
  y += 8;

  // ---- Divider ----
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  // ---- Customer info ----
  const addr = order.shippingAddress;
  if (addr) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Thong tin khach hang", marginL, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(`Ho ten: ${removeDiacritics(addr.fullName)}`, marginL, y);
    y += 5;
    doc.text(`SDT: ${addr.phone}`, marginL, y);
    if (addr.email) {
      doc.text(`Email: ${addr.email}`, marginL + 60, y);
    }
    y += 5;
    doc.text(`Dia chi: ${removeDiacritics(addr.address)}`, marginL, y);
    y += 8;
  }

  // ---- Payment method ----
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Phuong thuc thanh toan: ${PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod}`, marginL, y);
  y += 8;

  // ---- Divider ----
  doc.line(marginL, y, pageW - marginR, y);
  y += 6;

  // ---- Items table header ----
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(30, 64, 175);
  doc.rect(marginL, y - 4, contentW, 7, "F");

  const colX = {
    stt: marginL + 2,
    name: marginL + 12,
    qty: marginL + contentW - 55,
    price: marginL + contentW - 35,
    total: marginL + contentW - 5,
  };

  doc.text("STT", colX.stt, y);
  doc.text("San pham", colX.name, y);
  doc.text("SL", colX.qty, y, { align: "right" });
  doc.text("Don gia", colX.price, y, { align: "right" });
  doc.text("T.Tien", colX.total, y, { align: "right" });
  y += 6;

  // ---- Items rows ----
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);

  order.items.forEach((item, i) => {
    // Check page overflow
    if (y > 265) {
      doc.addPage();
      y = 20;
    }

    const isOdd = i % 2 === 0;
    if (isOdd) {
      doc.setFillColor(245, 247, 250);
      doc.rect(marginL, y - 4, contentW, 7, "F");
    }

    const itemTotal = item.totalPrice ?? item.productPrice * item.quantity;
    const nameClean = removeDiacritics(item.productName);
    // Truncate long names
    const maxNameLen = 50;
    const displayName = nameClean.length > maxNameLen ? nameClean.slice(0, maxNameLen) + "..." : nameClean;

    doc.text(`${i + 1}`, colX.stt, y);
    doc.text(displayName, colX.name, y);
    doc.text(`${item.quantity}`, colX.qty, y, { align: "right" });
    doc.text(fmtPrice(item.productPrice), colX.price, y, { align: "right" });
    doc.text(fmtPrice(itemTotal), colX.total, y, { align: "right" });
    y += 7;
  });

  y += 2;

  // ---- Divider ----
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  // ---- Totals ----
  const totalsX = pageW - marginR;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Tam tinh (${order.items.length} san pham):`, totalsX - 55, y);
  doc.text(fmtPrice(order.total), totalsX, y, { align: "right" });
  y += 5;
  doc.text("Phi van chuyen:", totalsX - 55, y);
  doc.setTextColor(22, 163, 74);
  doc.text("Mien phi", totalsX, y, { align: "right" });
  y += 7;

  // Total bold
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("TONG CONG:", totalsX - 55, y);
  doc.text(fmtPrice(order.total), totalsX, y, { align: "right" });
  y += 15;

  // ---- Footer ----
  doc.setDrawColor(200, 200, 200);
  doc.line(marginL, y, pageW - marginR, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(140, 140, 140);
  doc.text("Cam on quy khach da mua hang tai PCShop!", pageW / 2, y, { align: "center" });
  y += 4;
  doc.text("Moi thac mac xin lien he: support@pcshop.vn | 1900 1234", pageW / 2, y, { align: "center" });
  y += 4;
  doc.text(`Xuat hoa don: ${new Date().toLocaleString("vi-VN")}`, pageW / 2, y, { align: "center" });

  // Save
  doc.save(`PCShop_HoaDon_${orderId}.pdf`);
}
