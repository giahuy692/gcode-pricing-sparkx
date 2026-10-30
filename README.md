# 🖨️ G-Code CostMaster 3D - SparkX i7 Edition

> **Ứng Dụng Tự Động Tính Giá In 3D Từ File G-Code, Bảo Lưu Profile & Đồng Bộ Google Sheets**  
> Tối ưu hóa đặc thù cho máy in công nghiệp **SparkX i7** • Định giá không bao giờ lỗ • Chống mất cài đặt khi Creality Print cập nhật.

🌐 **Trang Web Trực Tuyến (GitHub Pages):**  
👉 **[https://giahuy692.github.io/gcode-pricing-sparkx/](https://giahuy692.github.io/gcode-pricing-sparkx/)**

---

## 🌟 Tính Năng Nổi Bật

1. **Phân Tích Tự Động G-Code:**
   - Hỗ trợ đầy đủ **Creality Print**, **UltiMaker Cura**, **Bambu Studio**, **OrcaSlicer**, **PrusaSlicer**.
   - Tự động trích xuất: Thời gian in, trọng lượng nhựa ($g$), chiều dài sợi ($m$), số lớp, độ cao lớp (layer height).
   - Nhận diện máy in **SparkX i7** làm tiêu chuẩn.

2. **Bảo Lưu Cài Đặt In (Print Process Keeper):**
   - Tự động trích xuất 6 cụm thông số in quan trọng từ file G-code: Nhiệt độ Nozzle/Bed, Infill %, Tốc độ in, Rút nhựa (Retraction), Lớp thành (Wall), Hỗ trợ (Support).
   - Nút **"Tải File Profile (.ini)"** giúp bạn luôn có bản sao lưu cấu hình in dự phòng, không bao giờ lo Creality Print cập nhật làm mất cài đặt.

3. **Thuật Toán Tính Giá Toàn Diện (Không Bao Giờ Lỗ):**
   - Đầy đủ 5 thành phần chi phí: **Tiền nhựa + Tiền điện (380W) + Khấu hao máy SparkX i7 (28tr/8000h) + Tiền công + Quỹ rủi ro**.
   - Tự động đề xuất: **Giá vốn hòa vốn**, **Giá sỉ** và **Giá bán lẻ đề xuất**.

4. **Đồng Bộ Tập Trung Vào 1 File Google Sheets Duy Nhất:**
   - Dữ liệu mọi lần in đều được đẩy tự động vào đúng **1 bảng tính Google Sheets** trên Google Drive, không bị phân tán ở nhiều file rời rạc.
   - Hỗ trợ xuất file **Excel (.xlsx)** chuyên nghiệp 2 trang tính với công thức tổng cộng.

---

## 🚀 Cách Sử Dụng

### Cách 1: Sử dụng trực tiếp trên Web (Mọi lúc, mọi nơi)
Truy cập: **[https://giahuy692.github.io/gcode-pricing-sparkx/](https://giahuy692.github.io/gcode-pricing-sparkx/)**

### Cách 2: Chạy ngoại tuyến trên máy tính (Không cần mạng)
1. Mở thư mục dự án trên máy của bạn.
2. Nhấp đúp chuột vào file `index.html` để mở ngay trên trình duyệt (Chrome, Edge, Cốc Cốc).

## Tự động lưu đơn vào DGH AquaLab

Đích: [DGH AquaLab](https://docs.google.com/spreadsheets/d/1In-uUOEvUZmSfK7kQEOSgVUi_Cjaoeowi32k7pbBXFs/edit), tab `QuanLyGCodeIn3D`.

- Chỉ đơn đã bấm **Lưu Vào Đơn Hàng** được tự động gửi. Nạp G-code, chạy mẫu và chỉnh báo giá không tự tạo đơn trên Google Sheets. Nút **Lưu Đơn & Đồng Bộ** lưu đơn vào lịch sử trước khi gửi.
- Lưu 24 cột: thông số file, máy, nhựa, thời gian, khối lượng, chi phí, phụ kiện, giá bán, lợi nhuận, trạng thái, tóm tắt profile, ghi chú và mã đơn. Không tải toàn bộ nội dung file G-code lên Drive.
- Mỗi đơn mới có UUID. Gửi lại cùng mã sẽ cập nhật cùng dòng, kể cả khi lần trước đã ghi nhưng mất phản hồi. Các dòng cũ chưa có mã đơn không được tự suy đoán để gộp.
- Đơn chờ và lỗi gần nhất lưu trong lịch sử trình duyệt. Tự gửi lại khi mở trang, có mạng trở lại hoặc mỗi 60 giây khi trang đang mở. Chỉ đánh dấu thành công khi nhận xác nhận đúng mã đơn và đúng bảng tính.
- Tự đồng bộ mặc định bật; lựa chọn tắt đã lưu trước đó vẫn được giữ. Mỗi thiết bị cần cấu hình URL và khóa riêng một lần. Chỉ ghi một chiều lên Sheets; không tự tải lịch sử từ Sheets về máy khác.
- Xóa lịch sử trên máy không xóa dòng đã lưu trên Sheets. Xóa dữ liệu trình duyệt cũng xóa các đơn còn chờ, nên cần kiểm tra trạng thái hoặc xuất Excel trước. Tải lại file Excel giữ nguyên mã đơn nếu file có cột `Mã Đơn Hàng`; file thiếu mã sẽ tạo mã mới cho mỗi lần nhập, không tự gộp theo tên file hoặc số dòng.

### Thiết lập một lần

1. Trong DGH AquaLab, mở **Tiện ích → Apps Script**. Sao lưu mã cũ, cập nhật phần webhook bằng [google-apps-script/Code.gs](google-apps-script/Code.gs). Giữ các hàm riêng khác nếu có. Nút **Copy Mã Apps Script** trên website cung cấp cùng mã này.
2. **Cài đặt dự án → Thuộc tính của tập lệnh**: thêm `COSTMASTER_SYNC_TOKEN` với một khóa ngẫu nhiên ít nhất 32 ký tự. Giữ khóa ngoài repository; không chia sẻ khóa qua issue hoặc commit.
3. Triển khai Web app, thực thi dưới tài khoản chủ sở hữu và truy cập **Anyone**. Nếu đã có deployment, chỉnh sửa và chọn **Phiên bản mới**. Website tĩnh cần gọi được endpoint không yêu cầu đăng nhập Google; endpoint chỉ chấp nhận ghi khi khóa đúng.
4. Trên website, mở **Google Sheets**, nhập URL `/exec` và cùng khóa, bật tự đồng bộ, lưu cấu hình. Bấm **Gửi 1 Dòng Thử Nghiệm**, rồi kiểm tra dòng thật trong `QuanLyGCodeIn3D`.
5. Lưu một đơn thật và kiểm tra trạng thái **Đã lưu Sheet**. Nếu hiện **Chờ gửi lại**, đọc lỗi bên trên bảng lịch sử; không coi có URL cấu hình là đã kết nối.

Mã chỉ ghi tab `QuanLyGCodeIn3D`, kiểm tra cấu trúc cột trước khi cập nhật và không đổi tên tab đang chọn. Khóa được lưu trong trình duyệt đã cấu hình; người có khóa có thể thêm hoặc cập nhật đơn, nên chỉ cấu hình trên thiết bị tin cậy. Bảng tính vẫn có thể giữ riêng tư.

### Kiểm thử

```sh
node --check app.js
node --check googlesheets.js
node --test tests/googlesheets.test.js tests/excel.test.js
```

Kiểm thử tự động mô phỏng mạng và Google services. Chúng không thay thế kiểm tra deployment, CORS và dòng dữ liệu trên bảng tính thật.
