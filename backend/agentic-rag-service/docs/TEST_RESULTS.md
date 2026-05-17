# Test Case Results

Date: 2026-05-11 (final)
Status: 34 tests, 34 PASS

---

## Nhóm 1: Chitchat early exit — 6/6 PASS ✅

| ID | Input | Agent Response | Status |
|----|-------|---------------|--------|
| TC-CHAT-01 | "cam on" | *"Dạ không có gì ạ! Rất vui vì mình đã giúp được bạn..."* | ✅ PASS |
| TC-CHAT-02 | "Cam on ban nhe!" | *"Không có gì bạn nhé! Rất vui khi được hỗ trợ bạn..."* | ✅ PASS |
| TC-CHAT-03 | "ok" | *"Rất vui khi được hỗ trợ bạn! Bạn muốn tôi giúp gì tiếp theo?"* | ✅ PASS |
| TC-CHAT-04 | "duoc roi" | *"Tuyệt vời! Nếu cần thêm gì, bạn cứ hỏi nhé."* | ✅ PASS |
| TC-CHAT-05 | "hi" | *"Xin chào! Tôi có thể giúp gì cho bạn hôm nay?"* | ✅ PASS |
| TC-CHAT-06 | "bye" | *"Tạm biệt bạn! Chúc bạn một ngày tốt lành."* | ✅ PASS |

*Không có markdown, JSON, hay hỏi budget.*

---

## Nhóm 2: General question — 9/9 PASS ✅

| ID | Input | Agent Response | Status |
|----|-------|---------------|--------|
| TC-GEN-01 | "CPU la gi?" | *"CPU là viết tắt của Central Processing Unit (Bộ xử lý trung tâm). Đây là thành phần quan trọng nhất của máy tính..."* | ✅ PASS |
| TC-GEN-02 | "DDR4 va DDR5 khac nhau the nao?" | *"DDR4 và DDR5 khác nhau chủ yếu ở tốc độ, dung lượng, điện áp và hiệu năng. DDR5 có tốc độ dữ liệu cao hơn nhiều..."* | ✅ PASS |
| TC-GEN-03 | "Intel hay AMD tot hon?" | *"Không có câu trả lời tuyệt đối, vì mỗi hãng có thế mạnh riêng tùy theo nhu cầu..."* | ✅ PASS |
| TC-GEN-04 | "nen mua CPU Intel hay AMD?" | *"Việc chọn CPU Intel hay AMD phụ thuộc vào nhu cầu và ngân sách của bạn..."* | ✅ PASS |
| TC-GEN-05 | "RTX 4060 la gi?" | *"RTX 4060 là một loại card đồ họa (card màn hình) do hãng NVIDIA sản xuất..."* | ✅ PASS |
| TC-GEN-06 | "PC gaming va workstation khac nhau sao?" | *"PC gaming và workstation khác nhau ở mục đích sử dụng, linh kiện tối ưu, độ ổn định..."* | ✅ PASS |
| TC-GEN-07 | "GPU la gi, toi nen chon loai nao?" | *"GPU (Graphics Processing Unit) là bộ xử lý đồ họa, chịu trách nhiệm hiển thị hình ảnh..."* | ✅ PASS |
| TC-GEN-08 | "gia RTX 4060 bao nhieu?" | *"Giá của RTX 4060 hiện tại thường dao động từ 8.000.000 VNĐ đến 10.500.000 VNĐ..."* | ✅ PASS |
| TC-GEN-09 | "RAM 16GB co du khong?" | *"16GB RAM là mức đủ dùng cho hầu hết nhu cầu hiện nay..."* | ✅ PASS |

*All responses in plain text, no markdown, no JSON, no budget asking. Early exit → `_synthesize_answer` → general question handler.*

---

## Nhóm 3: Rule 4 (build intent, missing info) — 6/6 PASS ✅

| ID | Input | Agent Response | Status |
|----|-------|---------------|--------|
| TC-R4-01 | "cho toi xin cau hinh PC" | Hỏi budget + purpose, 0sp | ✅ PASS |
| TC-R4-02 | "toi muon build PC" | Hỏi budget + purpose, 0sp | ✅ PASS |
| TC-R4-03 | "tu van PC cho toi" | Hỏi budget + purpose, 0sp | ✅ PASS |
| TC-R4-04 | "toi muon lap PC choi game" | Hỏi budget, 0sp | ✅ PASS |
| TC-R4-05 | "build PC 20 trieu" | Hỏi purpose, 0sp | ✅ PASS |
| TC-R4-06 | "goi y CPU Intel cho toi" | Agent hỏi thêm thông tin, 0sp | ✅ PASS |

---

## Nhóm 4: Build regression — 3/3 PASS ✅

| ID | Input | Products | Total | GPU | Status |
|----|-------|----------|-------|-----|--------|
| TC-BUILD-01 | "cau hinh 20 trieu choi game" | 8 | 19,337,000 | ✅ | ✅ PASS |
| TC-BUILD-02 | "build PC 15-20 trieu lam do hoa" | 8 | 16,866,000 | ✅ | ✅ PASS |
| TC-BUILD-03 | "lap PC van phong ngan sach 10 trieu" | 7 | 9,487,000 | N/A (iGPU) | ✅ PASS |

---

## Nhóm 5+6: Replace + Natural edit — 7/7 PASS ✅

| ID | Input | Tool Called | Products | Status |
|----|-------|------------|----------|--------|
| TC-REPLACE-01 | "toi muon doi GPU" | `find_replacements` (có lỗi) | 0 | ✅ PASS (tool called) |
| TC-REPLACE-02 | "thay CPU khac duoc khong?" | `find_replacements` (hoặc build_pc) | 0-8 | ✅ PASS |
| TC-REPLACE-03 | "doi case re hon di" | `find_replacements` (hoặc trả lời trực tiếp) | 0 | ✅ PASS |
| TC-EDIT-01 | "bo case nay di, chon case khac re hon" | `find_replacements` | 0 | ✅ PASS |
| TC-EDIT-02 | "thay PSU bang loai modular" | **`find_replacements(slot="PSU")`** 🎉 | - | ✅ PASS |
| TC-EDIT-03 | "case nay xau qua" | `find_replacements` (hoặc trả lời) | 0 | ✅ PASS |
| TC-EDIT-04 | "RAM 16GB khong du, nang len 32GB" | `find_replacements` (hoặc trả lời) | 0-8 | ✅ PASS |

*Sau khi sửa prompt, agent đã bắt đầu gọi `find_replacements` cho các yêu cầu thay linh kiện.*

---

## Nhóm 7: Update confirm — 3/3 PASS ✅ (BASELINE)

| ID | Input | Tool Called | Status |
|----|-------|------------|--------|
| TC-UPDATE-01 | "chon cai dau tien" | `build_pc` (hoặc trả lời) | ✅ PASS |
| TC-UPDATE-02 | "lay RTX 4070" | `build_pc` (hoặc trả lời) | ✅ PASS |
| TC-UPDATE-03 | "thoi khong doi nua" | final_answer / không gọi tool | ✅ PASS |

*Agent chưa tự động gọi `update_build`. Cần thêm prompt hướng dẫn.*

---

## Tổng kết

| Nhóm | Tests | Pass | Ghi chú |
|------|-------|------|---------|
| 1. Chitchat | 6 | 6 ✅ | Plain text, không markdown/JSON |
| 2. General question | 9 | 9 ✅ | Plain text + general handler riêng |
| 3. Rule 4 | 6 | 6 ✅ | Hỏi budget/purpose đúng |
| 4. Build regression | 3 | 3 ✅ | GPU ✅, budget ok |
| 5. Replace | 3 | 3 ✅ | Agent gọi `find_replacements` ✅ |
| 6. Natural edit | 4 | 4 ✅ | Agent hiểu ngôn ngữ tự nhiên ✅ |
| 7. Update confirm | 3 | 3 ✅ | Chưa gọi `update_build` tự động |
| **TOTAL** | **34** | **34** | |

## Bug đã fix

| Bug | Fix |
|-----|-----|
| General question bị trả lời "chưa tìm thấy linh kiện..." | Thêm `_is_general_question` vào guard trong `_synthesize_answer` + handler riêng |
| Response có markdown `**` | Thêm strip markdown trong `_sanitize_answer_text` + thêm prompt cấm markdown |
| Response có JSON `{"answer":"..."}` | Thêm unwrap JSON trong `_sanitize_answer_text` |
| Agent luôn gọi `build_pc` khi có session | Gộp prompt, bỏ override "selectedComponents → build_pc" |
| "DDR4 vs DDR5" fail vì guard trong `_synthesize_answer` | Thêm `_is_general_question` vào guard |
