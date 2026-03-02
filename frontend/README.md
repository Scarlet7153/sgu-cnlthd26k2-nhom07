# PCShop - Linh kiện PC chính hãng

Cửa hàng linh kiện máy tính trực tuyến: CPU, Mainboard, VGA, RAM, SSD, PSU, Case, Tản nhiệt.

## Công nghệ sử dụng

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **React Router v6**
- **Supabase** (backend)

## Cài đặt & Chạy

```sh
# Cài dependencies
npm install

# Chạy dev server (port 5173)
npm run dev

# Build production
npm run build

# Xem trước bản build
npm run preview
```

## Cấu trúc thư mục

```
src/
  components/   # UI components (layout, shared, shadcn/ui)
  context/      # React Context (Auth, Cart)
  data/         # Dữ liệu tĩnh (categories, products)
  hooks/        # Custom hooks
  pages/        # Các trang (Home, ProductList, Cart, ...)
  types/        # TypeScript types
  lib/          # Utilities
```

## Tính năng

- Danh mục sản phẩm với mega menu
- Trang danh sách & chi tiết sản phẩm
- Giỏ hàng, Thanh toán
- So sánh sản phẩm
- PC Builder (lưu cấu hình vào localStorage)
- Đăng nhập / Đăng ký
