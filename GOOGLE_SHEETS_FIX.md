# Sửa lỗi lưu Google Sheets

## Kết quả kiểm tra ngày 30/10/2026

- Repository gốc: giahuy692/gcode-pricing-sparkx, commit cdf592522d145f166592cd05fe6365674085074f.
- Webhook mặc định trả HTTP 302 sang accounts.google.com/ServiceLogin trong yêu cầu không đăng nhập. Đây là bằng chứng endpoint chưa cho phép ứng dụng web hiện tại gọi ẩn danh; không đủ dữ liệu để biết cấu hình quyền chính xác trong tài khoản chủ sở hữu.
- Client cũ dùng no-cors và luôn báo thành công sau fetch, dù phản hồi opaque không xác nhận được việc ghi dữ liệu.
- Kiểm tra GET cũ chấp nhận cả phản hồi JSON lỗi/null và gán mọi lỗi mạng cho quyền Only myself.

## Thay đổi

- POST text/plain ở chế độ CORS, chỉ báo lưu thành công sau HTTP thành công và JSON status=success.
- Timeout 30 giây; không tự gửi lại vì thao tác có thể đã ghi nhưng mất phản hồi.
- Kiểm tra URL /exec và response health của CostMaster; trạng thái có URL chỉ là đã cấu hình.
- Đồng bộ tự động báo lỗi, batch hiển thị số đơn được xác nhận trên tổng số đơn.
- Apps Script kiểm tra payload, dùng ScriptLock tránh xung đột tạo tab/header và flush trước khi xác nhận.
- Chỉ ghi tab QuanLyGCodeIn3D; không xóa dữ liệu hoặc các tab khác.

## Triển khai hai phía

1. Website: đưa mã đã sửa lên nhánh main của repository gốc. Dự án là HTML/JS tĩnh, không cần npm build. Giữ nguyên cấu hình GitHub Pages hiện có; kiểm tra lần triển khai Pages thành công trong GitHub. Không chuyển nhà cung cấp hosting.
2. Apps Script: mở Google Sheet đích → Tiện ích mở rộng → Apps Script. Sao lưu mã cũ. Cập nhật phần webhook bằng mã google-apps-script/Code.gs; giữ lại các hàm riêng của bảng tính nếu có. Từ Triển khai → Quản lý các bản triển khai → chỉnh sửa Web app hiện tại → Phiên bản mới; thực thi dưới tài khoản chủ sở hữu và cho phép Bất kỳ ai (Anyone). Nếu tạo deployment mới, thay URL /exec trong cài đặt website.
3. Mở URL /exec trong cửa sổ ẩn danh: phải trả JSON có status online và targetSheet QuanLyGCodeIn3D, không chuyển sang trang đăng nhập.
4. Trong website, Google Sheets → nhập URL /exec → Gửi 1 Dòng Thử Nghiệm. Kiểm tra dòng thực tế trong tab QuanLyGCodeIn3D, sau đó thử một đơn thật.

Không cần và không nên gửi mật khẩu hoặc token qua cuộc trò chuyện. Endpoint Anyone cho phép người có URL gửi dữ liệu; URL không phải cơ chế xác thực riêng cho chủ sở hữu.

## Kiểm thử

Chạy: node --test tests/googlesheets.test.js

9/9 kiểm thử tự động đạt; kiểm tra cú pháp app.js và googlesheets.js đạt.
Tests mô phỏng fetch và Google Apps Script services. Chưa kiểm thử trình duyệt/CORS thực tế hoặc ghi vào Google Sheet vì endpoint hiện yêu cầu đăng nhập. Chưa đẩy commit hoặc deploy do không có quyền ghi GitHub trong phiên làm việc.
