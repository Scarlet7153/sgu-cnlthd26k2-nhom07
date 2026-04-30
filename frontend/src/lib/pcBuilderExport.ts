import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import logo from "@/assets/logo.png";

interface SlotRow {
  productName: string;
  warranty: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const formatVndReport = (value: number): string => `${Math.round(value).toLocaleString("vi-VN")} đ`;
const formatMoneyExcel = (value: number): string => Math.round(value).toLocaleString("vi-VN");

export function buildQuoteHtml(
  selectedSlotRows: SlotRow[],
  totalPrice: number,
  mode: "print" | "excel" = "print"
): string {
  const quoteDate = new Date().toLocaleDateString("vi-VN");
  const siteHost = window.location.host || "localhost";
  const isPrintMode = mode === "print";
  const quoteRows = selectedSlotRows
    .map(
      (r, idx) => `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="left">${escapeHtml(r.productName)}</td>
          <td class="center">${r.warranty}</td>
          <td class="center">${r.quantity}</td>
          <td class="right">${formatVndReport(r.unitPrice)}</td>
          <td class="right">${formatVndReport(r.subtotal)}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Báo giá thiết bị</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; background: #f3f4f6; color: #111827; }
    .page {
      width: ${isPrintMode ? "210mm" : "980px"};
      min-height: ${isPrintMode ? "297mm" : "auto"};
      margin: 0 auto;
      background: #fff;
      padding: ${isPrintMode ? "10mm" : "16px"};
    }
    .top-link { text-align: right; font-size: ${isPrintMode ? "11px" : "10px"}; color: #1d4ed8; margin-bottom: 4px; }
    .rule { border-top: 1px solid #d1d5db; margin-bottom: 8px; }
    .title { text-align: center; font-size: ${isPrintMode ? "23px" : "20px"}; font-weight: 700; letter-spacing: 0.3px; margin: 6px 0 8px; }
    .meta { text-align: right; font-size: ${isPrintMode ? "12px" : "11px"}; line-height: 1.3; margin-bottom: 8px; }
    .meta .italic { font-style: italic; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #000; font-size: ${isPrintMode ? "11px" : "10.5px"}; padding: 4px 5px; vertical-align: middle; }
    thead th { background: #0288c8; color: #fff; font-weight: 700; text-align: center; }
    .center { text-align: center; }
    .left { text-align: left; }
    .right { text-align: right; }
    .summary-empty, .summary-label, .summary-value { border: none !important; }
    .summary-empty { background: transparent; }
    .summary-label { background: #dbeafe; }
    .summary-value { background: #dbeafe; text-align: right; }
    .note { margin-top: 12px; font-size: ${isPrintMode ? "11px" : "10px"}; text-align: center; line-height: 1.4; }
    .note strong { font-weight: 700; }
    .no-print button { border: 1px solid #9ca3af; background: #fff; border-radius: 6px; cursor: pointer; }
    tr { page-break-inside: avoid; }
    @media print {
      body { background: #fff; }
      .page { width: 100%; min-height: auto; margin: 0; padding: 0; }
      th, td { font-size: 10.5px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="top-link">Website: ${escapeHtml(siteHost)}</div>
    <div class="rule"></div>
    <div class="title">BÁO GIÁ THIẾT BỊ</div>
    <div class="meta">
      <div>Ngày báo giá: ${quoteDate}</div>
      <div class="italic">Đơn vị tính: VNĐ</div>
    </div>
    <table>
      <colgroup>
        <col style="width: 8%;" />
        <col style="width: 45%;" />
        <col style="width: 11%;" />
        <col style="width: 9%;" />
        <col style="width: 13%;" />
        <col style="width: 14%;" />
      </colgroup>
      <thead>
        <tr>
          <th>STT</th>
          <th>Tên sản phẩm</th>
          <th>Bảo hành</th>
          <th>Số lượng</th>
          <th>Đơn giá</th>
          <th>Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${quoteRows}
        <tr>
          <td colspan="4" class="summary-empty"></td>
          <td class="summary-label">Phí vận chuyển</td>
          <td class="summary-value">0</td>
        </tr>
        <tr>
          <td colspan="4" class="summary-empty"></td>
          <td class="summary-label">Chi phí khác</td>
          <td class="summary-value">0</td>
        </tr>
        <tr>
          <td colspan="4" class="summary-empty"></td>
          <td class="summary-label"><strong>Tổng tiền đơn hàng</strong></td>
          <td class="summary-value"><strong>${formatVndReport(totalPrice)}</strong></td>
        </tr>
      </tbody>
    </table>
    <div class="note">
      <strong>Quý khách lưu ý</strong> : Giá bán, khuyến mãi của sản phẩm và tình trạng còn hàng<br />
      có thể bị thay đổi bất cứ lúc nào mà không kịp báo trước.<br /><br />
      Để biết thêm chi tiết, Quý khách vui<br />
      lòng liên hệ
    </div>
    <div class="no-print" style="margin-top: 16px; text-align: center;">
      <button onclick="window.print()" style="padding: 8px 14px;">In ngay</button>
      <button onclick="window.close()" style="padding: 8px 14px; margin-left: 8px;">Đóng</button>
    </div>
  </div>
</body>
</html>`;
}

export async function exportConfigurationExcel(
  selectedSlotRows: SlotRow[],
  totalPrice: number,
  onSuccess: () => void
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PCShop";
  workbook.created = new Date();
  const webUrl = window.location.origin;

  const toDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const ws = workbook.addWorksheet("BaoGia", {
    pageSetup: {
      paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
  });

  ws.columns = [
    { key: "spacer", width: 4 }, { key: "stt", width: 8 }, { key: "name", width: 50 },
    { key: "warranty", width: 13 }, { key: "qty", width: 11 }, { key: "price", width: 16 }, { key: "subtotal", width: 16 },
  ];

  const row1 = ws.getRow(1);
  row1.height = 14;
  for (let c = 1; c <= 7; c++) {
    const cell = ws.getCell(1, c);
    cell.value = ""; cell.border = {};
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
  }

  ws.mergeCells("B2:B3");
  ws.getCell("B2").value = "";
  ws.getCell("B2").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 28;
  ws.getRow(3).height = 28;

  try {
    const logoBlob = await fetch(logo).then((res) => res.blob());
    const logoBase64 = await toDataUrl(logoBlob);
    const logoImageId = workbook.addImage({ base64: logoBase64, extension: "png" });
    ws.addImage(logoImageId, {
      tl: { col: 1, row: 1 }, br: { col: 2, row: 3 },
      hyperlinks: { hyperlink: webUrl, tooltip: "Mở website" },
    } as any);
  } catch {
    ws.getCell("B2").value = { text: "PCShop", hyperlink: webUrl };
    ws.getCell("B2").font = { name: "Calibri", size: 11, color: { argb: "FF1D4ED8" }, underline: true };
  }

  ws.mergeCells("C2:G3");
  ws.getCell("C2").value = "BÁO GIÁ THIẾT BỊ";
  ws.getCell("C2").font = { name: "Calibri", size: 20, bold: true, color: { argb: "FF000000" } };
  ws.getCell("C2").alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell("C2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1DA6D6" } };

  ws.mergeCells("B4:G4");
  ws.getCell("B4").value = `Ngày báo giá: ${new Date().toLocaleDateString("vi-VN")}   |   Đơn vị tính: VNĐ`;
  ws.getCell("B4").alignment = { horizontal: "right", vertical: "middle" };
  ws.getCell("B4").font = { name: "Calibri", size: 12, italic: true };

  const headerRow = ws.getRow(5);
  headerRow.values = ["", "STT", "Tên sản phẩm", "Bảo hành", "Số lượng", "Đơn giá", "Thành tiền"];
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0288C8" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } }, left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } }, right: { style: "thin", color: { argb: "FF000000" } },
    };
  });

  let currentRow = 6;
  for (let i = 0; i < selectedSlotRows.length; i++) {
    const r = selectedSlotRows[i];
    const row = ws.getRow(currentRow++);
    row.values = ["", i + 1, r.productName, r.warranty, r.quantity, formatMoneyExcel(r.unitPrice), formatMoneyExcel(r.subtotal)];
  }

  const shippingRow = ws.getRow(currentRow++);
  shippingRow.values = ["", "", "", "", "", "Phí vận chuyển", formatMoneyExcel(0)];
  const extraRow = ws.getRow(currentRow++);
  extraRow.values = ["", "", "", "", "", "Chi phí khác", formatMoneyExcel(0)];
  const totalRow = ws.getRow(currentRow++);
  totalRow.values = ["", "", "", "", "", "Tổng tiền đơn hàng", formatMoneyExcel(totalPrice)];

  ws.mergeCells(`B${shippingRow.number}:E${shippingRow.number}`);
  ws.mergeCells(`B${extraRow.number}:E${extraRow.number}`);
  ws.mergeCells(`B${totalRow.number}:E${totalRow.number}`);

  for (let r = 6; r < currentRow; r++) {
    const row = ws.getRow(r);
    row.eachCell((cell, col) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } }, left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } }, right: { style: "thin", color: { argb: "FF000000" } },
      };
      if (col === 3) cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      else if (col === 6 || col === 7) cell.alignment = { horizontal: "right", vertical: "middle" };
      else cell.alignment = { horizontal: "center", vertical: "middle" };
    });
  }

  [shippingRow, extraRow, totalRow].forEach((row) => {
    row.getCell(2).border = {};
    row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    row.getCell(6).alignment = { horizontal: "left", vertical: "middle" };
    row.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(6).border = {};
    row.getCell(7).border = {};
  });
  totalRow.getCell(6).font = { name: "Calibri", size: 11, bold: true };
  totalRow.getCell(7).font = { name: "Calibri", size: 11, bold: true };

  const noteRowStart = currentRow + 1;
  ws.mergeCells(`B${noteRowStart}:G${noteRowStart}`);
  ws.getCell(`B${noteRowStart}`).value = "Quý khách lưu ý: Giá bán, khuyến mãi của sản phẩm và tình trạng còn hàng có thể thay đổi mà không kịp báo trước.";
  ws.getCell(`B${noteRowStart}`).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getCell(`B${noteRowStart}`).font = { name: "Calibri", size: 10, italic: true };

  // Auto-fit columns
  const approxCharsPerCol = (colIndex: number): number => {
    const w = Number(ws.getColumn(colIndex).width || 10);
    return Math.max(4, Math.floor(w - 1));
  };
  const getCellText = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object" && value !== null && "richText" in value) return (value as any).richText.map((r: any) => r.text).join("");
    return String(value);
  };
  const estimateLines = (text: string, charsPerLine: number): number => {
    if (!text) return 1;
    const safeWidth = Math.max(1, charsPerLine);
    return text.split("\n").reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / safeWidth)), 0);
  };

  ws.columns.forEach((column, idx) => {
    const columnIndex = idx + 1;
    if (columnIndex === 1) { column.width = 4; return; }
    let maxLength = 10;
    ws.eachRow({ includeEmpty: true }, (row) => {
      const text = getCellText(row.getCell(columnIndex).value);
      if (text.length > maxLength) maxLength = text.length;
    });
    const capped = Math.min(maxLength + 2, columnIndex === 3 ? 80 : 25);
    column.width = Math.max(capped, columnIndex === 3 ? 35 : 10);
  });

  for (let r = 6; r < currentRow; r++) {
    const row = ws.getRow(r);
    let maxLines = 1;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const lines = estimateLines(getCellText(cell.value), approxCharsPerCol(colNumber));
      if (lines > maxLines) maxLines = lines;
    });
    row.height = Math.max(18, maxLines * 14);
  }

  const mergedWidthChars = [2, 3, 4, 5, 6, 7].map((col) => approxCharsPerCol(col)).reduce((sum, n) => sum + n, 0);
  const noteLines = estimateLines(getCellText(ws.getCell(`B${noteRowStart}`).value), mergedWidthChars);
  ws.getRow(noteRowStart).height = Math.max(20, noteLines * 14);

  const frameTop = 2;
  const frameBottom = noteRowStart;

  for (let r = 1; r <= frameBottom; r++) {
    const spacerCell = ws.getCell(r, 1);
    spacerCell.value = ""; spacerCell.border = {};
    spacerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
  }

  for (let r = frameTop; r <= frameBottom; r++) {
    for (let c = 2; c <= 7; c++) {
      if (r !== frameTop && r !== frameBottom && c !== 2 && c !== 7) continue;
      const cell = ws.getCell(r, c);
      const current = cell.border || {};
      cell.border = {
        ...current,
        top: r === frameTop ? { style: "thin", color: { argb: "FF000000" } } : current.top,
        bottom: r === frameBottom ? { style: "thin", color: { argb: "FF000000" } } : current.bottom,
        left: c === 2 ? { style: "thin", color: { argb: "FF000000" } } : current.left,
        right: c === 7 ? { style: "thin", color: { argb: "FF000000" } } : current.right,
      };
    }
  }

  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `bao-gia-thiet-bi-${stamp}.xlsx`);
  onSuccess();
}

export function printConfiguration(selectedSlotRows: SlotRow[], totalPrice: number, onError: () => void): void {
  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) { onError(); return; }
  const html = buildQuoteHtml(selectedSlotRows, totalPrice, "print");
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
