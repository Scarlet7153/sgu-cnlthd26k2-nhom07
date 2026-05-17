# Bộ Test Case — PC Advisor AI Agent

| Tổng | 38 cases | 7 nhóm |
|------|----------|--------|
| Đã pass | ? | |
| Đã fail | ? | |
| Chưa test | 38 | |

---

## Nhóm 1: Greeting / Chitchat early exit (6 cases)

| ID | Input | Expected | Result | Note |
|----|-------|----------|--------|------|
| TC-01 | "hi" | Chào lại, không hỏi budget | | |
| TC-02 | "cảm ơn" | Phản hồi lịch sự, không hỏi budget | | |
| TC-03 | "Cảm ơn bạn nhé!" | Phản hồi lịch sự, không hỏi budget | | |
| TC-04 | "ok được rồi" | Phản hồi ngắn, không hỏi budget | | |
| TC-05 | "bye" | Tạm biệt, không hỏi budget | | |
| TC-06 | "thanks" | Phản hồi lịch sự, không hỏi budget | | |

---

## Nhóm 2: General question early exit (8 cases)

| ID | Input | Expected | Result | Note |
|----|-------|----------|--------|------|
| TC-07 | "CPU là gì?" | Giải thích CPU, không hỏi budget | | |
| TC-08 | "DDR4 và DDR5 khác nhau thế nào?" | Giải thích sự khác biệt | | |
| TC-09 | "Intel hay AMD tốt hơn?" | Phân tích chung, không hỏi budget | | |
| TC-10 | "nên mua CPU Intel hay AMD?" | Phân tích chung, không hỏi budget | | |
| TC-11 | "RTX 4060 là gì?" | Giải thích RTX 4060 | | |
| TC-12 | "PC gaming và workstation khác nhau sao?" | Giải thích sự khác biệt | | |
| ⚠️ TC-13 | "GPU là gì, tôi nên chọn loại nào?" | General question | | Boundary: "chọn" trong BUILD_INTENT |
| ⚠️ TC-14 | "giá RTX 4060 bao nhiêu?" | General / search_products | | Boundary: "giá" trong BUILD_INTENT |

---

## Nhóm 3: Build intent nhưng thiếu thông tin (5 cases)

| ID | Input | Expected | Result | Note |
|----|-------|----------|--------|------|
| TC-15 | "cho tôi xin cấu hình PC" | Hỏi cả budget lẫn purpose | | |
| TC-16 | "tôi muốn build PC" | Hỏi cả budget lẫn purpose | | |
| TC-17 | "tôi muốn lắp PC chơi game" | Chỉ hỏi budget | | |
| TC-18 | "build PC 20 triệu" | Chỉ hỏi purpose | | |
| TC-19 | "tư vấn PC cho tôi" | Hỏi cả budget lẫn purpose | | |

---

## Nhóm 4: Build PC đầy đủ (6 cases)

| ID | Input | Expected | Result | Note |
|----|-------|----------|--------|------|
| TC-20 | "cấu hình 20 triệu chơi game" | 8 slot, 85-95% budget, GPU đúng | | |
| TC-21 | "build PC 15-20 triệu làm đồ họa" | Midpoint ~17.5M, GPU ưu tiên | | |
| TC-22 | "lắp PC văn phòng ngân sách 10 triệu" | Không GPU rời, iGPU CPU | | |
| TC-23 | (có session từ TC-20) "nâng lên 32GB RAM" | Giữ slot khác, chỉ đổi RAM | | Cần build TC-20 trước |
| TC-24 | "PC streaming 30 triệu" | CPU + GPU cân bằng cho stream | | |
| TC-25 | "build PC 50 triệu chơi game" | Tổng ≤ 50M, không có APU trong GPU | | |

---

## Nhóm 5: Find replacements (7 cases)

| ID | Input | Expected | Result | Note |
|----|-------|----------|--------|------|
| TC-26 | "tôi muốn đổi GPU" (có session) | find_replacements(slot=GPU), danh sách GPU | | |
| TC-27 | "thay CPU khác được không?" (có session) | find_replacements(slot=CPU) | | |
| TC-28 | "đổi case rẻ hơn đi" (có session) | find_replacements(slot=CASE), giá thấp hơn | | |
| TC-29 | "thay GPU lên RTX 4070" (có session) | find_replacements, ưu tiên RTX 4070 | | |
| TC-30 | "RAM 16GB không đủ, nâng lên 32GB" (có session) | find_replacements(slot=RAM), 32GB | | |
| TC-31 | "tôi muốn đổi GPU" (không session) | Hỏi lại "đang có build nào?" hoặc hỏi budget | | |
| ⚠️ TC-32 | "case này xấu quá" (có session) | find_replacements(slot=CASE) | | Ngôn ngữ tự nhiên, không có "thay/đổi" |

---

## Nhóm 6: UI sync → chat context (3 cases)

| ID | Input | Expected | Result | Note |
|----|-------|----------|--------|------|
| TC-33 | Chọn GPU từ UI → chat "build tiếp" | Agent biết GPU mới, rebuild xung quanh nó | | Test thủ công FE |
| TC-34 | Xóa RAM từ UI → chat "đề xuất RAM khác" | Agent biết RAM đã bị xóa | | Test thủ công FE |
| TC-35 | Chọn 3 component từ UI → chat "còn thiếu gì?" | Agent liệt kê đúng các slot chưa có | | Test thủ công FE |

---

## Nhóm 7: Edge cases & boundary (3 cases)

| ID | Input | Expected | Result | Note |
|----|-------|----------|--------|------|
| TC-36 | "Intel + AMD tương thích không?" | Early exit: báo chưa hỗ trợ kiểm tra | | |
| ⚠️ TC-37 | "gợi ý CPU Intel cho tôi" | search_products hoặc hỏi thêm | | Boundary: "gợi ý" là build hay search? |
| ⚠️ TC-38 | "build PC cho tôi" (không budget, purpose) | Hỏi cả hai — không hallucinate | | Agent không được tự đoán |

---

## Ghi chú

- **⚠️**: Boundary case — dễ bị classify sai, cần test kỹ
- **Có session**: Cần build sẵn 1 PC trước khi test (dùng TC-20)
- **Nhóm 6**: Test thủ công qua FE, không tự động được
- **TC-23**: Phụ thuộc session từ TC-20, chạy sau TC-20
