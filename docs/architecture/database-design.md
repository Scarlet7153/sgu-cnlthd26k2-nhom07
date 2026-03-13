## 2. Data base

Phần này mô tả schema MongoDB chính cho hệ thống theo dữ liệu bạn cung cấp. Mỗi microservice giữ database riêng.

### 2.1 user_db

Collection: `accounts`

| Trường | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `_id` | `ObjectId` | Khóa chính | Mã định danh duy nhất của tài khoản. |
| `username` | `String` | NOT NULL, UNIQUE | Tên đăng nhập (duy nhất). |
| `password` | `String` | NOT NULL | Mật khẩu đã được băm (hash) — không lưu plain text. |
| `name` | `String` | NOT NULL | Họ và tên đầy đủ của người dùng. |
| `email` | `String` | NOT NULL, UNIQUE | Địa chỉ email (duy nhất). |
| `address_details` | `Object` |  | Đối tượng chứa thông tin địa chỉ chi tiết. |
| `address_details.house_number` | `String` |  | Số nhà. |
| `address_details.street` | `String` |  | Tên đường. |
| `address_details.ward` | `String` |  | Phường/xã. |
| `address_details.province` | `String` |  | Tỉnh/thành phố. |
| `phone` | `String` | UNIQUE (gợi ý) | Số điện thoại (có thể duy nhất). |
| `role` | `String` | NOT NULL (ví dụ: `USER`, `ADMIN`) | Vai trò / quyền hạn của tài khoản. |
| `status` | `String` | NOT NULL (ví dụ: `active`, `inactive`, `banned`) | Trạng thái hoạt động của tài khoản. |
| `created_at` | `Date` | NOT NULL | Thời điểm tạo tài khoản. |
| `updated_at` | `Date` | NOT NULL | Thời điểm cập nhật thông tin gần nhất. |

Collection: `refresh_tokens`

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `_id` | `ObjectId` | Khóa chính |
| `account_id` | `ObjectId` | Tham chiếu → `accounts._id` |
| `token` | `String` | Refresh token (unique)
| `expires_at` | `Date` | Thời hạn (tạo TTL index)
| `created_at` | `Date` | Thời điểm tạo |

---

### 2.2 product_db

Collection: `categories`

| Trường | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `_id` | `ObjectId` | Khóa chính | Mã định danh duy nhất của danh mục. |
| `code` | `String` | NOT NULL, UNIQUE | Mã code ngắn gọn của danh mục (ví dụ: `CPU`). |
| `name` | `String` | NOT NULL | Tên hiển thị của danh mục. |
| `is_active` | `Boolean` |  | Trạng thái kích hoạt của danh mục. |
| `subcategory` | `Array<Object>` |  | Danh sách phân loại con. |
| `subcategory[].name` | `String` |  | Tên phân loại con. |
| `subcategory[].filter_query` | `String` |  | Chuỗi truy vấn dùng để lọc sản phẩm. |
| `create_at` | `Date` | NOT NULL | Thời điểm tạo bản ghi. |
| `update_at` | `Date` | NOT NULL | Thời điểm cập nhật. |

Collection: `products`

| Trường | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `_id` | `ObjectId` | Khóa chính | Mã định danh sản phẩm. |
| `categoryID` | `String` | Khóa ngoại | ID danh mục sản phẩm. |
| `name` | `String` | NOT NULL | Tên đầy đủ sản phẩm. |
| `model` | `String` |  | Model cụ thể. |
| `url` | `String` |  | URL trang sản phẩm. |
| `price` | `Number` | NOT NULL | Giá niêm yết (VNĐ, integer). |
| `image` | `String` |  | URL ảnh đại diện. |
| `socket` | `Number` |  | Loại socket CPU. |
| `ram_type` | `Array<String>` |  | Loại RAM hỗ trợ. |
| `has_igpu` | `Boolean` |  | Có iGPU hay không. |
| `igpu_name` | `String` |  | Tên iGPU. |
| `tdp_w` | `Number` |  | Công suất tiêu thụ (W). |
| `cores` | `Number` |  | Số nhân vật lý. |
| `threads` | `Number` |  | Số luồng. |
| `base_clock_ghz` | `Number` |  | Xung nhịp cơ bản (GHz). |
| `boost_clock_ghz` | `Number` |  | Xung nhịp tối đa (GHz). |
| `specs_raw` | `Object` |  | Thông số kỹ thuật chi tiết. |

Các trường tiêu biểu trong `specs_raw` (mapping từ tiếng Việt đã cho):

| Trường | Mô tả |
|---|---|
| `Trademark` | Tên hãng sản xuất |
| `Bao_hanh` | Thời gian bảo hành (ví dụ: `36 tháng`) |
| `Thuong_hieu_CPU` | Thương hiệu CPU |
| `Nhu_cau` | Mục đích sử dụng |
| `Series` | Dòng CPU |
| `The_he` | Thế hệ |
| `CPU` | Tên chi tiết |
| `Ra_mat` | Thời điểm ra mắt |
| `So_nhan_xu_ly` | Số nhân |
| `So_luong_luong` | Số luồng |
| `Toc_do_xu_ly` | Mô tả xung nhịp |
| `Tieu_thu_dien_nang` | Ví dụ: `65W` |
| `Nhiet_do_toi_da` | Nhiệt độ tối đa |
| `Cache` | Dung lượng cache |
| `Socket` | Loại socket |
| `RAM_ho_tro` | Thông tin RAM |
| `Do_hoa_tich_hop` | Tên iGPU |
| `So_cong_PCIE` | Số cổng PCIe |
| `PCIE_version` | Phiên bản PCIe |

| `description_html` | `String` | Mô tả dạng HTML |
| `embedding_text` | `String` | Văn bản tổng hợp để tạo embedding |
| `embedding_vector` | `Array<Number>` | Vector embedding |

Collection: `reviews`

| Trường | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `_id` | `ObjectId` | Khóa chính | ID đánh giá. |
| `product_id` | `ObjectId` | NOT NULL | Ref → `products._id`. |
| `account_id` | `ObjectId` | NOT NULL | Ref → `accounts._id`. |
| `order_id` | `ObjectId` |  | Ref → `orders._id` (có thể NULL). |
| `rating` | `Number` | NOT NULL (1–5) | Điểm đánh giá. |
| `content` | `String` |  | Nội dung đánh giá. |
| `created_at` | `Date` | NOT NULL | Thời điểm tạo. |
| `updated_at` | `Date` | NOT NULL | Thời điểm cập nhật. |

---

### 2.3 order_db

Collection: `orders`

| Trường | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `_id` | `ObjectId` | Khóa chính | ID đơn hàng. |
| `account_id` | `ObjectId` | NOT NULL | Ref → `accounts._id`. |
| `status` | `String` | NOT NULL | Ví dụ: `pending`,`confirmed`,`shipping`,`delivered`,`cancelled`. |
| `payment_method` | `String` | NOT NULL | Ví dụ: `VNPAY`,`MOMO`,`COD`,`BANK_TRANSFER`. |
| `payment_status` | `String` | NOT NULL | Ví dụ: `unpaid`,`paid`,`refunded`. |
| `items` | `Array` | NOT NULL (>=1) | Danh sách sản phẩm (embedded snapshot). |

Embedded `items[]` (mỗi phần tử):

- `product_id` — `ObjectId` — Ref → `products._id`.
- `product_name` — `String` — NOT NULL — Snapshot tên sản phẩm.
- `product_price` — `Number` — NOT NULL — Đơn giá tại thời điểm đặt.
- `quantity` — `Number` — NOT NULL (>=1).
- `total_price` — `Number` — NOT NULL — product_price × quantity.
- `warranty_months` — `Number` — (nếu có).

| `total` | `Number` | NOT NULL | Tổng giá trị đơn hàng (VNĐ). |
| `note` | `String` |  | Ghi chú khách. |
| `history_status` | `Array` |  | Lịch sử thay đổi trạng thái. |

Fields trong `history_status[]`:
- `status` — `String` — NOT NULL.
- `note` — `String`.
- `change_by` — `String` — NOT NULL (ví dụ: `system`,`admin_id`,`user_id`).
- `create_at` — `Date` — NOT NULL.

| `cancel_reason` | `String` |  | Lý do hủy. |
| `created_at` | `Date` | NOT NULL | Thời điểm tạo. |
| `updated_at` | `Date` | NOT NULL | Thời điểm cập nhật. |

Cart (sử dụng Redis): key `cart:{account_id}` lưu JSON với `items`, `updated_at`.

Coupons: lưu riêng nếu triển khai.

---

### 2.4 payment_db

Collection: `payments`

| Trường | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `_id` | `ObjectId` | Khóa chính | ID giao dịch thanh toán. |
| `order_id` | `ObjectId` | NOT NULL | Ref → `orders._id`. |
| `account_id` | `ObjectId` | NOT NULL | Ref → `accounts._id`. |
| `amount` | `Number` | NOT NULL (>0) | Số tiền giao dịch. |
| `currency` | `String` | NOT NULL | Ví dụ: `VND`. |
| `method` | `String` | NOT NULL | Ví dụ: `VNPAY`,`MOMO`,`COD`,`BANK_TRANSFER`. |
| `status` | `String` | NOT NULL | Ví dụ: `pending`,`success`,`failed`,`refunded`. |
| `provider_transaction_id` | `String` |  | Mã giao dịch do cổng cung cấp. |
| `provider_response` | `String` |  | Phản hồi gốc (JSON string). |
| `logs` | `Array` |  | Danh sách bước/sự kiện xử lý. |

`logs[]` fields:
- `action` — `String` — NOT NULL (ví dụ: `create_payment_url`,`verify_payment`,`refund`).
- `status` — `String` — NOT NULL (`success`,`failed`).
- `request_data` — `String` — JSON string.
- `response_data` — `String` — JSON string.
- `created_at` — `Date` — NOT NULL.

| `paid_at` | `Date` |  | Thời điểm thanh toán thành công. |
| `refunded_at` | `Date` |  | Thời điểm hoàn tiền. |
| `created_at` | `Date` | NOT NULL | Thời điểm tạo. |

---

### Ghi chú chung
- Chỉ mục gợi ý: `accounts.username` (unique), `accounts.email` (unique), `refresh_tokens.expires_at` (TTL), `products.slug` (unique), `products.categoryID`, `orders.account_id`.
- Lưu tiền tệ bằng số nguyên (VNĐ).  
- TTL cho `refresh_tokens` và `chat_sessions` nếu cần.  
- Snapshot: `orders.items[]` lưu tên, giá, ảnh SP tại thời điểm đặt.

Tôi đã format lại nội dung thành tài liệu rõ ràng hơn. Nếu muốn tôi sẽ thêm phần Index scripts (mongo shell) hoặc JSON Schema cho từng collection.
---

### 2.3. order_db

Collection: `orders`

Trường | Kiểu | Ràng buộc | Mô tả
:---|:---:|:---|:---
_id | ObjectId | Khóa chính | ID đơn hàng.
account_id | ObjectId | NOT NULL | Ref → `accounts._id`.
status | String | NOT NULL | Ví dụ: 'pending','confirmed','shipping','delivered','cancelled'.
payment_method | String | NOT NULL | Ví dụ: 'VNPAY','MOMO','COD','BANK_TRANSFER'.
payment_status | String | NOT NULL | Ví dụ: 'unpaid','paid','refunded'.
items | Array | NOT NULL (>=1) | Danh sách sản phẩm trong đơn.

Embedded items[] fields:
- items[].product_id — ObjectId — Ref → `products._id`.
- items[].product_name — String — NOT NULL — Snapshot tên sản phẩm.
- items[].product_price — Number — NOT NULL — Đơn giá tại thời điểm đặt.
- items[].quantity — Number — NOT NULL (>=1).
- items[].total_price — Number — NOT NULL — product_price * quantity.
- items[].warranty_months — Number — (nếu có).

total | Number | NOT NULL | Tổng giá trị đơn hàng (VNĐ).
note | String |  | Ghi chú khách.
history_status | Array |  | Lịch sử thay đổi trạng thái.

history_status[] fields:
- status — String — NOT NULL.
- note — String.
- change_by — String — NOT NULL (ví dụ: 'system','admin_id','user_id').
- create_at — Date (ISO) — NOT NULL.

cancel_reason | String |  | Lý do hủy.
created_at | Date (ISO) | NOT NULL | Thời điểm tạo.
updated_at | Date (ISO) | NOT NULL | Thời điểm cập nhật.

Carts (sử dụng Redis)

- items
- items[].product_id
- items[].product_name
- items[].price
- items[].quantity
- updated_at

Coupons (nếu làm): cấu trúc lưu riêng nếu cần.

---

### 2.4. payment_db

Collection: `payments`

Trường | Kiểu | Ràng buộc | Mô tả
:---|:---:|:---|:---
_id | ObjectId | Khóa chính | ID giao dịch thanh toán.
order_id | ObjectId | NOT NULL | Ref → `orders._id`.
account_id | ObjectId | NOT NULL | Ref → `accounts._id`.
amount | Number | NOT NULL (>0) | Số tiền giao dịch.
currency | String | NOT NULL | Ví dụ: 'VND'.
method | String | NOT NULL | Ví dụ: 'VNPAY','MOMO','COD','BANK_TRANSFER'.
status | String | NOT NULL | Ví dụ: 'pending','success','failed','refunded'.
provider_transaction_id | String |  | Mã giao dịch do cổng cung cấp.
provider_response | String |  | Phản hồi gốc (JSON string).
logs | Array |  | Danh sách bước/sự kiện xử lý.

logs[] fields:
- action — String — NOT NULL (ví dụ: 'create_payment_url','verify_payment','refund').
- status — String — NOT NULL ('success','failed').
- request_data — String — (JSON string).
- response_data — String — (JSON string).
- created_at — Date (ISO) — NOT NULL.

paid_at | Date (ISO) |  | Thời điểm thanh toán thành công.
refunded_at | Date (ISO) |  | Thời điểm hoàn tiền.
created_at | Date (ISO) | NOT NULL | Thời điểm tạo bản ghi.

---

Ghi chú: đã sửa lại `database-design` theo nội dung bạn cung cấp.

