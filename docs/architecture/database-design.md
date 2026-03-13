

## Database Design

Phần này mô tả cấu trúc các collection trong MongoDB cho từng microservice. Mỗi microservice quản lý database riêng biệt.

### 1 user_db

Database chứa thông tin tài khoản người dùng và các dữ liệu liên quan đến xác thực.

#### Collection: `accounts`

| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Khóa chính | Mã định danh duy nhất của tài khoản. |
| `username` | `String` | NOT NULL, UNIQUE | Tên đăng nhập, duy nhất trong hệ thống. |
| `password` | `String` | NOT NULL | Mật khẩu đã được băm (hash) – không lưu plain text. |
| `name` | `String` | NOT NULL | Họ và tên đầy đủ của người dùng. |
| `email` | `String` | NOT NULL, UNIQUE | Địa chỉ email, duy nhất. |
| `address_details` | `Object` |  | Đối tượng chứa thông tin địa chỉ chi tiết. |
| &nbsp;&nbsp; `house_number` | `String` |  | Số nhà. |
| &nbsp;&nbsp; `street` | `String` |  | Tên đường. |
| &nbsp;&nbsp; `ward` | `String` |  | Phường / xã. |
| &nbsp;&nbsp; `province` | `String` |  | Tỉnh / thành phố. |
| `phone` | `String` | UNIQUE (nên có) | Số điện thoại, có thể được đánh chỉ mục unique. |
| `role` | `String` | NOT NULL | Vai trò / quyền hạn, ví dụ: `USER`, `ADMIN`. |
| `status` | `String` | NOT NULL | Trạng thái tài khoản, ví dụ: `active`, `inactive`, `banned`. |
| `created_at` | `Date` | NOT NULL | Thời điểm tạo tài khoản. |
| `updated_at` | `Date` | NOT NULL | Thời điểm cập nhật thông tin gần nhất. |

#### Collection: `refresh_tokens`

| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Khóa chính | Mã định danh của bản ghi refresh token. |
| `account_id` | `ObjectId` | NOT NULL, reference → `accounts._id` | Tài khoản sở hữu token. |
| `token` | `String` | NOT NULL, UNIQUE | Giá trị refresh token (duy nhất). |
| `expires_at` | `Date` | NOT NULL | Thời điểm hết hạn (nên tạo TTL index để tự động xóa). |
| `created_at` | `Date` | NOT NULL | Thời điểm tạo token. |

---

### 2 product_db

Database quản lý danh mục và thông tin sản phẩm.

#### Collection: `categories`

| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Khóa chính | Mã định danh danh mục. |
| `code` | `String` | NOT NULL, UNIQUE | Mã code ngắn gọn, ví dụ: `CPU`, `VGA`. |
| `name` | `String` | NOT NULL | Tên hiển thị của danh mục. |
| `is_active` | `Boolean` |  | Trạng thái kích hoạt (true/false). |
| `subcategory` | `Array<Object>` |  | Danh sách các phân loại con. |
| &nbsp;&nbsp; `name` | `String` |  | Tên phân loại con. |
| &nbsp;&nbsp; `filter_query` | `String` |  | Chuỗi truy vấn dùng để lọc sản phẩm. |
| `created_at` | `Date` | NOT NULL | Thời điểm tạo bản ghi. |
| `updated_at` | `Date` | NOT NULL | Thời điểm cập nhật gần nhất. |

#### Collection: `products`

| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Khóa chính | Mã định danh sản phẩm. |
| `categoryID` | `ObjectId` | NOT NULL, reference → `categories._id` | ID của danh mục chứa sản phẩm. |
| `name` | `String` | NOT NULL | Tên đầy đủ của sản phẩm. |
| `model` | `String` |  | Model cụ thể (nếu có). |
| `url` | `String` |  | URL trang chi tiết sản phẩm. |
| `price` | `Number` | NOT NULL | Giá niêm yết (VNĐ, kiểu số nguyên). |
| `image` | `String` |  | URL ảnh đại diện. |
| `socket` | `String` |  | Loại socket CPU (ví dụ: `AM4`, `LGA1700`). |
| `ram_type` | `Array<String>` |  | Các loại RAM hỗ trợ (ví dụ: `DDR4`, `DDR5`). |
| `has_igpu` | `Boolean` |  | Có iGPU hay không. |
| `igpu_name` | `String` |  | Tên iGPU nếu có. |
| `tdp_w` | `Number` |  | Công suất tiêu thụ (W). |
| `cores` | `Number` |  | Số nhân vật lý. |
| `threads` | `Number` |  | Số luồng. |
| `base_clock_ghz` | `Number` |  | Xung nhịp cơ bản (GHz). |
| `boost_clock_ghz` | `Number` |  | Xung nhịp tối đa (GHz). |
| `specs_raw` | `Object` |  | Đối tượng chứa các thông số kỹ thuật chi tiết khác (mapping từ nguồn dữ liệu gốc). |

**Các trường thường gặp trong `specs_raw`** (tham khảo từ mô tả gốc):

| Trường | Mô tả |
| :--- | :--- |
| `Trademark` | Hãng sản xuất |
| `Bao_hanh` | Thời gian bảo hành (ví dụ: `36 tháng`) |
| `Thuong_hieu_CPU` | Thương hiệu CPU |
| `Nhu_cau` | Mục đích sử dụng |
| `Series` | Dòng CPU |
| `The_he` | Thế hệ |
| `CPU` | Tên chi tiết CPU |
| `Ra_mat` | Thời điểm ra mắt |
| `So_nhan_xu_ly` | Số nhân |
| `So_luong_luong` | Số luồng |
| `Toc_do_xu_ly` | Mô tả xung nhịp |
| `Tieu_thu_dien_nang` | Công suất tiêu thụ (ví dụ: `65W`) |
| `Nhiet_do_toi_da` | Nhiệt độ tối đa |
| `Cache` | Dung lượng cache |
| `Socket` | Loại socket |
| `RAM_ho_tro` | Thông tin RAM hỗ trợ |
| `Do_hoa_tich_hop` | Tên iGPU |

---

### 3 order_db

Database quản lý đơn hàng và giỏ hàng (giỏ hàng sử dụng Redis).

#### Collection: `orders`

| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Khóa chính | Mã đơn hàng. |
| `account_id` | `ObjectId` | NOT NULL, reference → `accounts._id` | Tài khoản đặt hàng. |
| `status` | `String` | NOT NULL | Trạng thái đơn hàng: `pending`, `confirmed`, `shipping`, `delivered`, `cancelled`. |
| `payment_method` | `String` | NOT NULL | Phương thức thanh toán: `VNPAY`, `MOMO`, `COD`, `BANK_TRANSFER`. |
| `payment_status` | `String` | NOT NULL | Trạng thái thanh toán: `unpaid`, `paid`, `refunded`. |
| `items` | `Array<Object>` | NOT NULL (tối thiểu 1) | Danh sách sản phẩm trong đơn (embedded snapshot). |
| &nbsp;&nbsp; `product_id` | `ObjectId` | NOT NULL | ID sản phẩm (tham chiếu). |
| &nbsp;&nbsp; `product_name` | `String` | NOT NULL | Tên sản phẩm tại thời điểm đặt. |
| &nbsp;&nbsp; `product_price` | `Number` | NOT NULL | Đơn giá tại thời điểm đặt. |
| &nbsp;&nbsp; `quantity` | `Number` | NOT NULL (≥1) | Số lượng mua. |
| &nbsp;&nbsp; `total_price` | `Number` | NOT NULL | Thành tiền = `product_price * quantity`. |
| &nbsp;&nbsp; `warranty_months` | `Number` |  | Số tháng bảo hành (nếu có). |
| `total` | `Number` | NOT NULL | Tổng giá trị đơn hàng (VNĐ). |
| `note` | `String` |  | Ghi chú của khách hàng. |
| `history_status` | `Array<Object>` |  | Lịch sử thay đổi trạng thái đơn hàng. |
| &nbsp;&nbsp; `status` | `String` | NOT NULL | Trạng thái tại thời điểm ghi nhận. |
| &nbsp;&nbsp; `note` | `String` |  | Ghi chú kèm theo. |
| &nbsp;&nbsp; `change_by` | `String` | NOT NULL | Ai thay đổi: `system`, `admin_id`, `user_id`. |
| &nbsp;&nbsp; `created_at` | `Date` | NOT NULL | Thời điểm thay đổi. |
| `cancel_reason` | `String` |  | Lý do hủy đơn (nếu có). |
| `created_at` | `Date` | NOT NULL | Thời điểm tạo đơn. |
| `updated_at` | `Date` | NOT NULL | Thời điểm cập nhật gần nhất. |

#### Giỏ hàng (Cart) – Redis

- Key: `cart:{account_id}`
- Value: JSON object chứa:
  - `items`: mảng các sản phẩm, mỗi item gồm `product_id`, `product_name`, `price`, `quantity`
  - `updated_at`: thời điểm cập nhật cuối

#### Coupons (nếu có)

Có thể thiết kế collection riêng nếu hệ thống hỗ trợ mã giảm giá.

---

### 4 payment_db

Database lưu trữ các giao dịch thanh toán và log xử lý.

#### Collection: `payments`

| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Khóa chính | Mã giao dịch thanh toán. |
| `order_id` | `ObjectId` | NOT NULL, reference → `orders._id` | Đơn hàng liên quan. |
| `account_id` | `ObjectId` | NOT NULL, reference → `accounts._id` | Tài khoản thực hiện thanh toán. |
| `amount` | `Number` | NOT NULL (>0) | Số tiền giao dịch. |
| `currency` | `String` | NOT NULL | Đơn vị tiền tệ, ví dụ: `VND`. |
| `method` | `String` | NOT NULL | Phương thức thanh toán: `VNPAY`, `MOMO`, `COD`, `BANK_TRANSFER`. |
| `status` | `String` | NOT NULL | Trạng thái giao dịch: `pending`, `success`, `failed`, `refunded`. |
| `provider_transaction_id` | `String` |  | Mã giao dịch do cổng thanh toán cung cấp. |
| `provider_response` | `String` |  | Phản hồi gốc từ cổng thanh toán (dạng JSON string). |
| `logs` | `Array<Object>` |  | Danh sách các bước xử lý giao dịch. |
| &nbsp;&nbsp; `action` | `String` | NOT NULL | Hành động: `create_payment_url`, `verify_payment`, `refund`. |
| &nbsp;&nbsp; `status` | `String` | NOT NULL | Kết quả: `success`, `failed`. |
| &nbsp;&nbsp; `request_data` | `String` |  | Dữ liệu gửi đi (JSON string). |
| &nbsp;&nbsp; `response_data` | `String` |  | Dữ liệu nhận về (JSON string). |
| &nbsp;&nbsp; `created_at` | `Date` | NOT NULL | Thời điểm ghi log. |
| `paid_at` | `Date` |  | Thời điểm thanh toán thành công. |
| `refunded_at` | `Date` |  | Thời điểm hoàn tiền (nếu có). |
| `created_at` | `Date` | NOT NULL | Thời điểm tạo bản ghi thanh toán. |

---

### Ghi chú chung

- **Chỉ mục (Indexes) gợi ý:**
  - `accounts.username` (unique), `accounts.email` (unique)
  - `refresh_tokens.token` (unique), `refresh_tokens.expires_at` (TTL)
  - `products.categoryID`, `products.name` (text index nếu cần tìm kiếm)
  - `orders.account_id`, `orders.status`, `orders.created_at`
  - `payments.order_id`, `payments.account_id`, `payments.status`

- **Kiểu dữ liệu số:** Giá tiền luôn được lưu dưới dạng số nguyên (VNĐ) để tránh lỗi làm tròn.

- **TTL (Time-To-Live):** Nên tạo TTL index trên trường `expires_at` của `refresh_tokens` để tự động xóa các token hết hạn.

- **Snapshot trong đơn hàng:** Các thông tin sản phẩm trong `orders.items` được lưu dưới dạng snapshot (embedded) nhằm giữ nguyên giá trị tại thời điểm đặt hàng, ngay cả khi sản phẩm sau đó thay đổi.

- **Redis cho giỏ hàng:** Giỏ hàng tạm thời được lưu trên Redis với thời gian hết hạn phù hợp để giảm tải cho database chính.

--- 
