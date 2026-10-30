# Tự động lưu Google Sheets — 30/10/2026

Hướng dẫn cấu hình hiện hành nằm trong [README](README.md#tự-động-lưu-đơn-vào-dgh-aqualab). Phải triển khai cả website và Apps Script; chỉ thay source website chưa kích hoạt lưu thật.

## Phạm vi đã xác nhận

- Chỉ tự gửi đơn đã lưu vào lịch sử. Nạp G-code hoặc chỉnh giá không tự gửi báo giá nháp.
- Bảng tính đích là DGH AquaLab, ID `1In-uUOEvUZmSfK7kQEOSgVUi_Cjaoeowi32k7pbBXFs`, tab riêng `QuanLyGCodeIn3D`.
- Giữ xuất Excel, file Excel liên kết và các tab Google Sheets khác.

## Kết quả kiểm tra trực tiếp

- Local và GitHub main cùng commit nền `35f89789f45a6cd60b6206f60384853e36605cea`.
- Apps Script liên kết với bảng tính vẫn dùng mã cũ ghi vào tab đang chọn, thiếu cột phụ kiện.
- Deployment phiên bản 1 lúc 13:14 ngày 30/10/2026 đặt quyền `Chỉ mình tôi` và thực thi bằng `Người dùng truy cập vào ứng dụng web`. Cấu hình này chưa phục vụ được website GitHub Pages gọi không đăng nhập.

## Thay đổi

- Giữ đơn chờ trong lịch sử trình duyệt; gửi lại khi mở trang, có mạng trở lại và mỗi 60 giây lúc trang đang mở.
- UUID cho đơn mới; thêm cột X `Mã Đơn Hàng`, cùng mã sẽ cập nhật cùng dòng. ScriptLock bảo vệ kiểm tra mã và ghi dòng; flush trước phản hồi thành công.
- Client chỉ gửi vào webhook phiên bản 2 xác nhận đúng bảng tính đích; chỉ đánh dấu đã lưu sau khi response khớp mã đơn và ID bảng tính. Lỗi mạng/CORS hoặc response không đọc được vẫn là chưa xác nhận.
- Khóa ghi `COSTMASTER_SYNC_TOKEN` lưu trong Script Properties và cấu hình trình duyệt, không hardcode vào source. POST text/plain để tránh CORS preflight không cần thiết.
- Kiểm tra dữ liệu số, giới hạn văn bản, vô hiệu hóa công thức từ tên file/ghi chú; dừng ghi nếu cấu trúc cột khác. Các tab khác không được đổi tên hoặc ghi đè.
- Hiển thị trạng thái từng đơn và tổng số chờ. Chặn HTML từ tên file, ghi chú và phụ kiện trong các vùng hiển thị liên quan đến khóa trình duyệt.
- Excel thiếu mã đơn nhận UUID để các file khác nhau không cập nhật nhầm cùng dòng trên Sheets. Các dòng Sheets cũ không có mã không được tự gộp với đơn mới.

## Kiểm chứng

`node --check app.js`, `node --check googlesheets.js`, `node --check excel.js` và `node --test tests/googlesheets.test.js tests/excel.test.js`.

26 kiểm thử tự động đạt, gồm mất phản hồi sau khi đã ghi, gửi lại không trùng, sai khóa, sai bảng tính, sai cấu trúc cột, công thức từ dữ liệu và Excel thiếu mã.

Đã kiểm tra giao diện trình duyệt: nạp mẫu không tạo đơn; lưu đơn tạo trạng thái chờ; tải lại trang vẫn giữ đơn chờ. Chưa xác nhận ghi thật qua CORS vào Google Sheets tại thời điểm ghi tài liệu này. Chưa đưa bản website mới lên GitHub Pages.

## Giới hạn

Đây là lưu một chiều; không tự lấy lịch sử từ Sheets về thiết bị khác. Trang đã đóng không gửi nền; mở lại để tiếp tục. Không xóa dữ liệu trình duyệt khi còn đơn chờ. Giữ kín khóa ghi; quyền Anyone áp dụng cho endpoint, không yêu cầu công khai bảng tính.
