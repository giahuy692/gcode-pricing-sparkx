// G-Code CostMaster: chỉ ghi tab QuanLyGCodeIn3D trong DGH AquaLab.
// Cài đặt dự án > Thuộc tính tập lệnh: thêm COSTMASTER_SYNC_TOKEN (ít nhất 32 ký tự).
// Triển khai Web app: thực thi bằng tài khoản chủ sở hữu, truy cập Anyone.
// Khóa ghi chỉ lưu trong Thuộc tính tập lệnh và cài đặt trình duyệt, không đưa lên GitHub.
var COSTMASTER_SPREADSHEET_ID = '1In-uUOEvUZmSfK7kQEOSgVUi_Cjaoeowi32k7pbBXFs';
var COSTMASTER_SHEET = 'QuanLyGCodeIn3D';
var COSTMASTER_HEADERS = [
  'Thời Gian', 'Tên File G-Code', 'Máy In', 'Loại Nhựa', 'Thời Gian In',
  'Số Giờ (h)', 'Khối Lượng (g)', 'Số Lớp', 'Tiền Nhựa (đ)', 'Tiền Điện (đ)',
  'Khấu Hao Máy (đ)', 'Tiền Công (đ)', 'Dự Phòng Rủi Ro (đ)', 'Tiền Phụ Kiện (đ)',
  'Chi Tiết Phụ Kiện', 'GIÁ VỐN TOÀN DIỆN (đ)', 'GIÁ SỈ (đ)', 'GIÁ BÁN LẺ (đ)',
  'LỢI NHUẬN RÒNG (đ)', 'Tỷ Suất LN', 'Trạng Thái', 'Cài Đặt In (Profile)',
  'Ghi Chú', 'Mã Đơn Hàng'
];

function costmasterJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  try {
    var ss = SpreadsheetApp.openById(COSTMASTER_SPREADSHEET_ID);
    return costmasterJson({
      status: 'online', protocolVersion: 2, authRequired: true,
      spreadsheetId: ss.getId(), targetSheet: COSTMASTER_SHEET,
      spreadsheetUrl: ss.getUrl()
    });
  } catch (error) {
    return costmasterJson({ status: 'error', message: error.message });
  }
}

function costmasterText(value) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > 10000) throw new Error('Trường văn bản không hợp lệ');
  // Không thực thi tên file, ghi chú hoặc cấu hình in như công thức bảng tính.
  return /^\s*[=+@-]/.test(value) ? "'" + value : value;
}

function costmasterNumber(data, key, allowNegative) {
  var value = data[key] == null ? 0 : data[key];
  if (typeof value !== 'number' || !isFinite(value) || (!allowNegative && value < 0)) {
    throw new Error('Giá trị số không hợp lệ: ' + key);
  }
  return value;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 100000) {
      throw new Error('Thiếu dữ liệu POST hoặc dữ liệu quá lớn');
    }
    var data = JSON.parse(e.postData.contents);
    var token = PropertiesService.getScriptProperties().getProperty('COSTMASTER_SYNC_TOKEN');
    if (!token || token.length < 32 || !data || data.token !== token) throw new Error('Khóa ghi không hợp lệ');
    if (data.action !== 'add_row' || data.spreadsheetId !== COSTMASTER_SPREADSHEET_ID ||
        typeof data.orderId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(data.orderId) ||
        typeof data.filename !== 'string' || !data.filename.trim()) throw new Error('Dữ liệu đơn hàng không hợp lệ');

    var row = [
      costmasterText(data.createdAt || Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss')),
      costmasterText(data.filename), costmasterText(data.printerModel || 'SparkX i7'),
      costmasterText(data.materialType), costmasterText(data.timeFormatted),
      costmasterNumber(data, 'timeHours'), costmasterNumber(data, 'weightGrams'), costmasterNumber(data, 'layerCount'),
      costmasterNumber(data, 'costFilament'), costmasterNumber(data, 'costElectricity'),
      costmasterNumber(data, 'costDepreciation'), costmasterNumber(data, 'costLabor'), costmasterNumber(data, 'costFailRisk'),
      costmasterNumber(data, 'costAccessories'), costmasterText(data.accessoriesDetail),
      costmasterNumber(data, 'totalBaseCost'), costmasterNumber(data, 'priceWholesale'), costmasterNumber(data, 'priceRetail'),
      costmasterNumber(data, 'netProfitRetail', true), costmasterNumber(data, 'profitMarginRetailPercent', true) + '%',
      costmasterText(data.status || 'Đã tính giá'), costmasterText(data.printProcess), costmasterText(data.notes), data.orderId
    ];

    lock.waitLock(30000);
    locked = true;
    var ss = SpreadsheetApp.openById(COSTMASTER_SPREADSHEET_ID);
    var sheet = ss.getSheetByName(COSTMASTER_SHEET) || ss.insertSheet(COSTMASTER_SHEET);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, COSTMASTER_HEADERS.length).setValues([COSTMASTER_HEADERS]);
      sheet.getRange(1, 1, 1, COSTMASTER_HEADERS.length)
        .setBackground('#0f172a').setFontColor('#38bdf8').setFontWeight('bold');
      sheet.setFrozenRows(1);
    } else {
      var headers = sheet.getRange(1, 1, 1, COSTMASTER_HEADERS.length).getValues()[0];
      for (var i = 0; i < COSTMASTER_HEADERS.length - 1; i++) {
        if (headers[i] !== COSTMASTER_HEADERS[i]) throw new Error('Tab đích có cấu trúc cột khác; chưa ghi để tránh lệch dữ liệu');
      }
      if (headers[23] && headers[23] !== COSTMASTER_HEADERS[23]) throw new Error('Cột X đã được sử dụng; chưa ghi để tránh mất dữ liệu');
      if (!headers[23]) sheet.getRange(1, 24).setValue(COSTMASTER_HEADERS[23]);
    }

    var lastRow = sheet.getLastRow();
    var match = lastRow > 1 ? sheet.getRange(2, 24, lastRow - 1, 1)
      .createTextFinder(data.orderId).matchEntireCell(true).matchCase(true).useRegularExpression(false).findNext() : null;
    // Gửi lại sau mất phản hồi vẫn cập nhật đúng một dòng, giữ nguyên các dòng cũ chưa có mã đơn.
    var rowNumber = match ? match.getRow() : lastRow + 1;
    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    SpreadsheetApp.flush();
    return costmasterJson({ status: 'success', orderId: data.orderId, spreadsheetId: ss.getId(), row: rowNumber });
  } catch (error) {
    return costmasterJson({ status: 'error', message: error.message });
  } finally {
    if (locked) lock.releaseLock();
  }
}
