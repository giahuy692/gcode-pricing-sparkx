// ========================================================
// MÃ GOOGLE APPS SCRIPT CHO G-CODE COSTMASTER 3D (SPARKX i7)
// Hướng dẫn:
// 1. Mở file Google Sheet "DGH AquaLab" của bạn trên trình duyệt
// 2. Vào menu: Tiện ích mở rộng (Extensions) -> Apps Script
// 3. Xóa hết mã cũ trong đó, dán toàn bộ đoạn mã này vào rồi bấm Lưu (Ctrl+S)
// 4. Bấm "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment)
// 5. Chọn loại: "Ứng dụng web" (Web app)
//    - Người thực thi: "Tôi" (Me)
//    - Ai có quyền truy cập: "Bất kỳ ai" (Anyone)  <--- BẮT BUỘC CHỌN "BẤT KỲ AI"
// 6. Bấm "Triển khai" và sao chép URL Ứng dụng web dán vào G-Code CostMaster!
// ========================================================

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Không tìm thấy bảng tính. Tạo Apps Script từ Tiện ích mở rộng của Google Sheet đích.'})).setMimeType(ContentService.MimeType.JSON);
  ss.getName();
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    message: 'G-Code CostMaster Webhook is LIVE! (Sẵn sàng nhận dữ liệu)',
    targetSheet: 'QuanLyGCodeIn3D',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ========================================================
// HÀM CHẠY TRỰC TIẾP TẠO TAB & DỮ LIỆU MẪU NGAY LẬP TỨC:
// Trong Apps Script, chọn hàm "testTaoTabQuanLyGCode" và bấm nút "▷ Chạy" (Run)
// để tab "QuanLyGCodeIn3D" xuất hiện ngay trong Google Sheet của bạn!
// ========================================================
function testTaoTabQuanLyGCode() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targetSheetName = 'QuanLyGCodeIn3D';
  var sheet = ss.getSheetByName(targetSheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(targetSheetName);
    sheet.setTabColor('#0284c7');
  }
  
  if (sheet.getLastRow() === 0) {
    var headers = [
      'Thời Gian',
      'Tên File G-Code',
      'Máy In',
      'Loại Nhựa',
      'Thời Gian In',
      'Số Giờ (h)',
      'Khối Lượng (g)',
      'Số Lớp',
      'Tiền Nhựa (đ)',
      'Tiền Điện (đ)',
      'Khấu Hao Máy (đ)',
      'Tiền Công (đ)',
      'Dự Phòng Rủi Ro (đ)',
      'Tiền Phụ Kiện (đ)',
      'Chi Tiết Phụ Kiện',
      'GIÁ VỐN TOÀN DIỆN (đ)',
      'GIÁ SỈ (đ)',
      'GIÁ BÁN LẺ (đ)',
      'LỢI NHUẬN RÒNG (đ)',
      'Tỷ Suất LN',
      'Trạng Thái',
      'Cài Đặt In (Profile)',
      'Ghi Chú'
    ];
    sheet.appendRow(headers);
    
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0f172a');
    headerRange.setFontColor('#38bdf8');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
  
  sheet.appendRow([
    Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm:ss'),
    'test_sparkx_i7_model.gcode',
    'SparkX i7',
    'PETG',
    '3 giờ 15 phút',
    3.25,
    85,
    320,
    19500,
    2000,
    10000,
    11000,
    2500,
    40000,
    'Bộ LED USB 5V Lightbox',
    85000,
    115000,
    165000,
    80000,
    '48.5%',
    'Thử nghiệm thành công',
    'SparkX i7: 210°C / 60°C • Infill 20% • 80mm/s',
    'Kích hoạt tab thành công từ Google Apps Script!'
  ]);
  
  SpreadsheetApp.getUi().alert('🎉 CHÚC MỪNG!\nĐã tạo thành công tab "QuanLyGCodeIn3D" với dữ liệu mẫu!\nHãy quay lại bảng tính Google Sheets của bạn để kiểm tra.');
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!e || !e.postData || !e.postData.contents) throw new Error('Thiếu dữ liệu POST');
    var data = JSON.parse(e.postData.contents);
    if (data.action !== 'add_row' || !data.filename) throw new Error('Dữ liệu đơn hàng không hợp lệ');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Luôn ghi dữ liệu vào tab chuyên biệt riêng 'QuanLyGCodeIn3D'
    // Giữ nguyên vẹn 100% các tab hiện có (1_CONG_CU_CHINH, 2_KHO,...)
    var targetSheetName = 'QuanLyGCodeIn3D';
    var sheet = ss.getSheetByName(targetSheetName);
    
    // Nếu chưa có tab 'QuanLyGCodeIn3D', tự động tạo tab mới!
    if (!sheet) {
      sheet = ss.insertSheet(targetSheetName);
    }
    
    // Nếu bảng tính mới hoàn toàn, tự động tạo Tiêu đề cột đẹp mắt
    if (sheet.getLastRow() === 0) {
      var headers = [
        'Thời Gian',
        'Tên File G-Code',
        'Máy In',
        'Loại Nhựa',
        'Thời Gian In',
        'Số Giờ (h)',
        'Khối Lượng (g)',
        'Số Lớp',
        'Tiền Nhựa (đ)',
        'Tiền Điện (đ)',
        'Khấu Hao Máy (đ)',
        'Tiền Công (đ)',
        'Dự Phòng Rủi Ro (đ)',
        'Tiền Phụ Kiện (đ)',
        'Chi Tiết Phụ Kiện',
        'GIÁ VỐN TOÀN DIỆN (đ)',
        'GIÁ SỈ (đ)',
        'GIÁ BÁN LẺ (đ)',
        'LỢI NHUẬN RÒNG (đ)',
        'Tỷ Suất LN',
        'Trạng Thái',
        'Cài Đặt In (Profile)',
        'Ghi Chú'
      ];
      sheet.appendRow(headers);
      
      // Định dạng dòng tiêu đề
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#0f172a');
      headerRange.setFontColor('#38bdf8');
      headerRange.setFontWeight('bold');
      headerRange.setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    }
    
    // Thêm dòng dữ liệu mới
    sheet.appendRow([
      data.createdAt || Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm:ss'),
      data.filename || '',
      data.printerModel || 'SparkX i7',
      data.materialType || '',
      data.timeFormatted || '',
      data.timeHours || 0,
      data.weightGrams || 0,
      data.layerCount || 0,
      data.costFilament || 0,
      data.costElectricity || 0,
      data.costDepreciation || 0,
      data.costLabor || 0,
      data.costFailRisk || 0,
      data.costAccessories || 0,
      data.accessoriesDetail || '',
      data.totalBaseCost || 0,
      data.priceWholesale || 0,
      data.priceRetail || 0,
      data.netProfitRetail || 0,
      (data.profitMarginRetailPercent || 0) + '%',
      data.status || 'Đã tính giá',
      data.printProcess || '',
      data.notes || ''
    ]);
    
    SpreadsheetApp.flush();
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Row added' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
