/**
 * Translate English backend error messages to Vietnamese
 */
export function translateErrorMessage(englishMessage: string): string {
  const translations: Record<string, string> = {
    "Email already in use": "Email đã tồn tại",
    "Email already exists": "Email đã tồn tại",
    "Phone already in use": "Số điện thoại đã tồn tại",
    "Phone already exists": "Số điện thoại đã tồn tại",
    "Account not found": "Tài khoản không tồn tại",
    "Account not verified": "Tài khoản chưa được xác thực. Vui lòng kiểm tra email",
    "Invalid email or password": "Email hoặc mật khẩu không đúng",
    "Password is incorrect": "Mật khẩu không đúng",
    "Current password is incorrect": "Mật khẩu hiện tại không đúng",
    "Account is inactive": "Tài khoản không hoạt động",
    "Account is banned": "Tài khoản bị khóa",
    "Invalid status": "Trạng thái không hợp lệ",
    "Validation failed": "Dữ liệu không hợp lệ",
    "Dữ liệu gửi lên không hợp lệ": "Dữ liệu gửi lên không hợp lệ",
    "Phiên đăng nhập không hợp lệ hoặc đã hết hạn": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
    "Bạn không có quyền thực hiện thao tác này": "Bạn không có quyền thực hiện thao tác này",
    "Không tìm thấy tài nguyên yêu cầu": "Không tìm thấy tài nguyên yêu cầu",
    "Dữ liệu bị xung đột": "Dữ liệu bị xung đột",
    "Backend đang gặp lỗi. Vui lòng thử lại sau": "Backend đang gặp lỗi. Vui lòng thử lại sau",
    "Không thể kết nối tới backend. Vui lòng kiểm tra server": "Không thể kết nối tới backend. Vui lòng kiểm tra server",
    "Lỗi khi lấy thông tin profile": "Lỗi khi lấy thông tin profile",
    "Lỗi khi cập nhật profile": "Lỗi khi cập nhật profile",
    "Lỗi khi đổi mật khẩu": "Lỗi khi đổi mật khẩu",
    "Email hoặc mật khẩu không đúng": "Email hoặc mật khẩu không đúng",
  };

  // Return translation if exists, otherwise return original message
  return translations[englishMessage] || englishMessage;
}
