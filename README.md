# 🖨️ G-Code CostMaster 3D

> **Phần Mềm Tự Động Định Giá In 3D Từ File G-Code & Quản Lý Xuất Excel**  
> Giải pháp tính giá toàn diện giúp **không bao giờ lỗ**, **bảo đảm biên lợi nhuận lành mạnh** và **khách hàng cảm thấy hoàn toàn xứng đáng**.

---

## 🌟 Tính Năng Nổi Bật

1. **Phân Tích Tự Động G-Code:**
   - Hỗ trợ đầy đủ **UltiMaker Cura**, **Creality Print**, **Bambu Studio**, **OrcaSlicer**, **PrusaSlicer**.
   - Tự động trích xuất: Thời gian in, trọng lượng nhựa (g), chiều dài sợi (m), máy in, độ cao lớp (layer height), số lớp in.
   - Hỗ trợ thuật toán quét dòng dự phòng (Fallback Stream Scan) nếu file G-code bị xóa mất comment tiêu đề.

2. **Công Thức Tính Giá Toàn Diện (Không Bao Giờ Lỗ):**
   - **Tiền nhựa:** Giá nhựa/kg $\times$ khối lượng thực tế $+$ hao hụt/support (mặc định 5%).
   - **Tiền điện:** Công suất máy (W) $\times$ thời gian in $\times$ giá điện (kWh).
   - **Khấu hao & Bảo trì:** Khấu hao theo giờ in của máy $+$ phụ phí búp sen/dây đai/bàn nhiệt PEI.
   - **Tiền công setup & xử lý nguội:** Thời gian chuẩn bị file + bóc tách support $\times$ lương theo giờ.
   - **Quỹ dự phòng in hỏng (Fail Buffer):** Dự phòng 5-8% phòng ngừa lỗi cong vênh, bung bàn, nghẹt nhựa.
   - **Hệ số định giá:** Tự động đề xuất **Giá Vốn Hòa Vốn**, **Giá Sỉ (Wholesale)** và **Giá Bán Lẻ (Retail)**.

3. **Xuất Báo Cáo Excel (.xlsx) Chuẩn Doanh Nghiệp:**
   - Xuất file `.xlsx` 2 trang tính (Sheets):
     - **Sheet 1:** Danh sách đơn hàng chi tiết từng chi phí, doanh thu, lợi nhuận ròng và hàng Tổng cộng.
     - **Sheet 2:** Bảng thông số cấu hình định giá để lưu trữ và đối soát.
   - Hoạt động 100% offline với thư viện SheetJS tích hợp sẵn.

4. **Nút Copy Báo Giá Nhanh Cho Khách (Zalo/Facebook):**
   - Tạo sẵn văn bản báo giá chỉn chu, nêu bật các quyền lợi (miễn phí xử lý support, bảo hành in lại nếu lỗi kỹ thuật) để khách hàng thấy giá trị nhận được vượt trội so với số tiền bỏ ra.

---

## 🚀 Cách Mở & Sử Dụng Ứng Dụng

Ứng dụng là một trang Web hoàn chỉnh, không cần cài đặt phần mềm phức tạp:

### Cách 1: Mở Trực Tiếp Bằng Trình Duyệt
1. Mở thư mục: `C:\Users\dghuy\.gemini\antigravity-ide\scratch\gcode-pricing-app`
2. Nhấp đúp chuột vào file `index.html` để mở ngay trên trình duyệt (Chrome, Edge, Cốc Cốc).

### Cách 2: Chạy Qua Server Cục Bộ
Nếu bạn muốn chạy qua địa chỉ local:
```powershell
cd C:\Users\dghuy\.gemini\antigravity-ide\scratch\gcode-pricing-app
python -m http.server 8085
```
Sau đó truy cập: [http://localhost:8085](http://localhost:8085)
