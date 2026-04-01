# Tham chiếu field cho các loại linh kiện

Tài liệu này liệt kê các field chung mà các tài liệu đã trích xuất thường có, rồi mô tả các field đặc thù cho từng loại linh kiện cùng 3–4 ví dụ giá trị cho mỗi field.

---

## 1) Fields chung (áp dụng cho hầu hết các loại linh kiện)
- `_id` : (ObjectId hoặc chuỗi) id document
- `categoryID` : id category (ví dụ: `69ac61dba931fab39af1232e`)
- `name` : tên hiển thị / tiêu đề sản phẩm
- `model` : model chính thức (ví dụ `Intel® Core™ i5-12400F`)
- `price` : giá (số nguyên, VND hoặc đơn vị tương ứng)
- `url` : link nguồn sản phẩm
- `image` : link ảnh đại diện
- `specs_raw` : object/ dict chứa bảng thông số thô (key/value theo site)
- `description_html` : mô tả/ bảng thông số dạng HTML
- `embedding_text` : chuỗi tóm tắt nhân bản để sinh embedding (human-readable)
- `embedding_vector` : mảng số (embedding) — thường float32, kích thước tùy model

Gợi ý index metadata (khuyến nghị): index `_id` (auto), `categoryID`, có thể index `model` hoặc `price` nếu hay filter theo chúng. Không index `embedding_vector`.

---

## 2) CPU
Các field đặc thù CPU và ví dụ giá trị:
- `socket`: socket / chân cắm
  - Ví dụ (theo dữ liệu trích xuất): `1700`, `1851`, `AM4`, `AM5`
- `cores` / `threads`: số nhân / số luồng
  - Ví dụ: `4` cores / `8` threads; `6` / `12`; `8` / `16`
- `base_clock_ghz`, `boost_clock_ghz`: xung nhịp cơ bản / boost
  - Ví dụ: `2.5` (GHz), `4.4` (GHz)
- `cache` / `cache_mb`: dung lượng cache
  - Ví dụ: `12MB`, `18MB`, `32MB`
- `tdp_w`: TDP (W)
  - Ví dụ: `65`, `95`, `125`
- `has_igpu` / `igpu_name`: có iGPU hay không + tên
  - Ví dụ: `false`, `true` / `Intel UHD Graphics 770`

Index hữu ích: `socket`, `cores`, `tdp_w` (nếu bạn lọc nhiều theo socket hoặc hiệu năng).

Lưu ý: trong `specs_raw` hoặc trên trang nguồn giá trị socket đôi khi có tiền tố (ví dụ `LGA1700`), nhưng trong trường `socket` đã trích xuất file của bạn thường lưu mã như `1700` hoặc `1851`. Tôi sẽ không tự ý thay đổi hoặc bịa giá trị — nếu bạn muốn chuẩn hoá (ví dụ thêm tiền tố `LGA` cho Intel), tôi có thể thêm bước chuẩn hoá riêng.

### Ví dụ thực tế (lấy từ `extracted/CPU_extracted.json`)
- Intel Core i5-12400F — model: `Intel® Core™ i5-12400F`, socket: `1700`, cores/threads: `6/12`, tdp_w: `65`, boost: `4.4` GHz
- Intel Core Ultra 7-265K — model: `Intel® Core™ Ultra 7-265K`, socket: `1851`, cores/threads: `20/20`, tdp_w: `250` (turbo), boost: `5.5` GHz
- Intel Core i9-14900K — model: `Intel® Core™ i9-14900K`, socket: `1700`, cores/threads: `24/32`, tdp_w: `253`, boost: `6.0` GHz

---

## 3) GPU (VGA)
- `vendor` / `brand`: nhà sản xuất GPU (card)
  - Ví dụ: `NVIDIA`, `AMD`, `ASUS` (brand card)
- `chipset` / `gpu_model`: tên GPU / chipset
  - Ví dụ: `GeForce RTX 4070`, `Radeon RX 7600`
- `vram_gb`: dung lượng VRAM (GB)
  - Ví dụ: `6`, `8`, `12`, `24`
- `memory_type`: loại bộ nhớ
  - Ví dụ: `GDDR6`, `GDDR6X`, `HBM2`
- `memory_bus_bit`: bus width
  - Ví dụ: `128-bit`, `192-bit`, `256-bit`
- `tdp_w` / `power_connector`: TDP và cổng nguồn
  - Ví dụ: `200W`, `300W`, connector `8-pin`, `2x8-pin`

Index hữu ích: `vendor`, `vram_gb` (nếu lọc theo VRAM).

### Ví dụ thực tế (lấy từ `extracted/GPU_extracted.json`)
- ASUS Dual Radeon RX 6500 XT OC Edition — `vram_gb`: 4, `vram_type`: GDDR6, `recommended_psu_w`: 500, power_connectors: `6-pin`
- ASUS DUAL GeForce RTX 3060 OC 12G — `vram_gb`: 12, `vram_type`: GDDR6, `recommended_psu_w`: 650, power_connectors: `8-pin`
- ASUS ROG Astral GeForce RTX 5090 32GB — `vram_gb`: 32, `vram_type`: GDDR7, `recommended_psu_w`: 1000, power_connectors: `16-pin`

---

## 4) RAM
- `capacity_gb`: dung lượng mỗi bộ nhớ hoặc tổng kit
  - Ví dụ: `8`, `16`, `32`, `64`
- `type`: DDR phiên bản
  - Ví dụ: `DDR4`, `DDR5`
- `speed_mhz`: tốc độ (MHz)
  - Ví dụ: `2400`, `3200`, `3600`, `5200`
- `modules`: số module trong kit
  - Ví dụ: `1x16`, `2x8`, `4x8`
- `timings` / `cas_latency`: thông số timing
  - Ví dụ: `CL16`, `CL18`

Index hữu ích: `type`, `capacity_gb` (nếu lọc/gom theo dung lượng).

### Ví dụ thực tế (lấy từ `extracted/RAM_extracted.json`)
- ADATA XPG D50 DDR4 16GB (1x16GB) 3200 — `ram_type`: DDR4, `capacity_gb`: 16, `speed_mhz`: 3200
- Kingston Fury Beast 16GB (1x16GB) DDR4 3200 — `ram_type`: DDR4, `capacity_gb`: 16, `speed_mhz`: 3200
- Corsair Dominator Platinum RGB 64GB (2x32GB) DDR5 5600 — `ram_type`: DDR5, `capacity_gb`: 64, `speed_mhz`: 5600

---

## 5) MAINBOARD (Bo mạch chủ)
- `socket`: socket CPU tương thích
  - Ví dụ (theo dữ liệu trích xuất): `1700`, `1851`, `AM4`, `AM5`
- `chipset`: chipset dòng bo mạch
  - Ví dụ: `Z690`, `B660`, `X570`, `B550`
- `form_factor`: kích thước bo mạch
  - Ví dụ: `ATX`, `Micro-ATX`, `Mini-ITX` 
- `memory_slots`: số khe RAM
  - Ví dụ: `2`, `4`
- `max_memory_gb`: hỗ trợ tối đa RAM
  - Ví dụ: `64`, `128`
- `pcie_slots`: số khe PCIe (thông tin tổng quát)

Index hữu ích: `socket`, `chipset`, `form_factor`.

### Ví dụ thực tế (lấy từ `extracted/MAINBOARD_extracted.json`)
- Asus Prime H610M-K D4-CSM — `chipset`: H610, `socket`: `1700`, `form_factor`: Micro-ATX, `ram_slots`: 2
- ASUS PRIME B760M-A D4-CSM — `chipset`: B760, `socket`: `1700`, `form_factor`: Micro-ATX, `ram_slots`: 4
- Asus B760M-AYW WIFI DDR5 — `chipset`: B760, `socket`: `1700`, `ram_type`: DDR5, `ram_slots`: 2

---

## 6) PSU (Nguồn máy tính)
- `wattage_w`: công suất
  - Ví dụ: `450W`, `550W`, `650W`, `850W`
- `modularity`: mô-đun (loại dây rời)
  - Ví dụ: `Non-modular`, `Semi-modular`, `Fully modular`
- `efficiency_rating`: chứng nhận hiệu suất
  - Ví dụ: `80 PLUS Bronze`, `80 PLUS Gold`, `80 PLUS Platinum`
- `connectors`: danh sách cổng (ATX 24-pin, EPS 8-pin, PCIe 8-pin...)

Index hữu ích: `wattage_w`, `efficiency_rating`.

### Ví dụ thực tế (lấy từ `extracted/PSU_extracted.json`)
- Asus Prime 80Plus Bronze 650W — `wattage_w`: 650, `efficiency`: "80 Plus Bronze", `form_factor`: ATX
- Asus Prime 80Plus Bronze 750W — `wattage_w`: 750, `efficiency`: "80 Plus Bronze", `form_factor`: ATX
- CoolerMaster V Platinum 1600 V2 — `wattage_w`: 1600, `efficiency`: "80 Plus Platinum", `modularity`: "Full Modular"

---

## 7) CASE (Vỏ máy)
- `supported_form_factors`: các kích thước bo mạch hỗ trợ
  - Ví dụ: `ATX, Micro-ATX, Mini-ITX`, `E-ATX, ATX`
- `drive_bays`: số bay ổ cứng / SSD
  - Ví dụ: `2 x 3.5" + 2 x 2.5"`, `1 x 2.5"`
- `front_io`: cổng mặt trước (USB type, audio)
  - Ví dụ: `USB-C + USB3.0 + Audio`, `2x USB 3.0`
- `max_gpu_length_mm` / `max_cooler_height_mm`: giới hạn kích thước
  - Ví dụ: `370 mm`, `165 mm`
- `cooling_support`: hỗ trợ tản/ radiator (kích thước)
  - Ví dụ: `360mm radiator front`, `240mm top`

Index hữu ích: `supported_form_factors` nếu bạn lọc theo loại bo mạch.

### Ví dụ thực tế (lấy từ `extracted/CASE_extracted.json`)
- CASE ASUS A31 ATX BLACK 4FA — `case_type`: Mid Tower, `dimensions_mm`: [238, 511, 435], `max_cpu_cooler_height_mm`: 165, `drive_support`: 3.5:6 / 2.5:6
- Xigmatek MYX Air 3F (EN45967) — `case_type`: Mid Tower, `dimensions_mm`: [330, 195, 423], `max_cpu_cooler_height_mm`: 158, `drive_support`: 3.5:1 / 2.5:1

---

## 8) FAN (Quạt)
- `size_mm`: kích thước quạt
  - Ví dụ: `120`, `140`, `80`
- `rpm_range`: dải RPM hoặc max RPM
  - Ví dụ: `800-2000 RPM`, `3500 RPM`
- `bearing`: loại vòng bi
  - Ví dụ: `Fluid Dynamic Bearing`, `Sleeve Bearing`, `Ball Bearing`
- `rgb`: có RGB hay không
  - Ví dụ: `true`, `false`

Index hữu ích: `size_mm`, `rgb` (nếu filter theo RGB).

### Ví dụ thực tế (lấy từ `extracted/FAN_extracted.json`)
- Cooler ASUS ROG RYUO IV SLC 360 ARGB — `cooler_type`: liquid, `fan_sizes`: {120:3}, `supported_sockets`: ["AMD AM5","AMD AM4","Intel LGA 1851","Intel LGA 1700"], `fan_rpm`: 800-2650
- COOLER ASUS PRIME LC 240 ARGB — `cooler_type`: liquid, `fan_sizes`: {120:2}, `supported_sockets`: includes `Intel LGA 1851`, `Intel LGA 1700`
- ID-COOLING FROZN A620 PRO SE — `cooler_type`: air, `fan_sizes`: {120:2}, `supported_sockets`: includes `Intel LGA 1851`, `Intel LGA 1700`

---

## 9) HARDDISK / SSD
- `type`: `HDD`, `SATA SSD`, `NVMe SSD`
  - Ví dụ: `HDD`, `SATA`, `NVMe`
- `capacity_gb` / `capacity_tb`
  - Ví dụ: `256GB`, `512GB`, `1TB`, `2TB`
- `interface`: giao tiếp
  - Ví dụ: `SATA III`, `PCIe NVMe`, `M.2 NVMe`
- `form_factor`: `2.5"`, `3.5"`, `M.2`

Index hữu ích: `type`, `capacity_gb`.

### Ví dụ thực tế (lấy từ `extracted/HARDDISK_extracted.json`)
- Kingston NV3 M.2 2280 PCIe Gen4 NVMe 500G — `type`: SSD, `capacity_gb`: 500, `interface`: NVMe, `read_mbps`:`5000`, `write_mbps`:`3000`
- WD GREEN SN350 1TB NVMe — `type`: SSD, `capacity_gb`: 1024, `interface`: NVMe, `read_mbps`:`3200`, `write_mbps`:`2500`
- Samsung 870 EVO 500GB SATA III — `type`: SSD, `capacity_gb`: 500, `interface`: SATA, `form_factor`: 2.5, `read_mbps`:`560`, `write_mbps`:`530`

---

## Ghi chú cuối
- Một số giá trị (ví dụ `specs_raw`) có cấu trúc tự do giữa các site — `embedding_text` được tạo để chuẩn hoá trước khi sinh embedding.
- Khi bạn lưu `embedding_vector`, nên dùng `float32` để giảm bộ nhớ. Để tìm kiếm semantically, dùng ANN (FAISS/HNSW/Milvus) và fetch metadata từ Mongo bằng `_id`.

---

Nếu bạn muốn, tôi có thể:
- chuyển file này thành JSON hoặc CSV; hoặc
- mở rộng bằng ví dụ giá trị thực lấy từ một số file trong `extracted/` (lấy 3 ví dụ cho mỗi loại). 

Chọn: "JSON", "CSV", "thêm ví dụ thực" hay "ok" để kết thúc.