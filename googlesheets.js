/**
 * Google Sheets Integration Module for G-Code CostMaster 3D
 * Sử dụng Google Apps Script Web App để đồng bộ dữ liệu trực tiếp vào 1 file Google Sheets duy nhất.
 */

const GoogleSheetsSync = {
  STORAGE_KEY: 'gcode_costmaster_gsheet_url',
  AUTO_SYNC_KEY: 'gcode_costmaster_gsheet_autosync',
  // URL Webhook mặc định được thiết lập sẵn cho bạn
  DEFAULT_WEBHOOK_URL: 'https://script.google.com/macros/s/AKfycbyX9Xgk1G3h7JHkyy7OIByOYswhJfV6ezGxF0NTQpJd63JFjuV9QyMw3JUgRXgbIAaC/exec',

  /**
   * Lấy URL Webhook Google Sheet (mặc định lấy URL đã tích hợp sẵn của bạn)
   */
  getWebhookUrl() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved && saved.trim()) {
        return saved.trim();
      }
    } catch (e) {}
    return this.DEFAULT_WEBHOOK_URL;
  },

  /**
   * Lưu URL Webhook
   */
  setWebhookUrl(url) {
    try {
      localStorage.setItem(this.STORAGE_KEY, (url || '').trim());
    } catch (e) {}
  },

  /**
   * Kiểm tra xem tính năng tự động đồng bộ có bật không
   */
  isAutoSyncEnabled() {
    try {
      return localStorage.getItem(this.AUTO_SYNC_KEY) === 'true';
    } catch (e) {
      return false;
    }
  },

  /**
   * Bật/tắt tự động đồng bộ
   */
  setAutoSync(enabled) {
    try {
      localStorage.setItem(this.AUTO_SYNC_KEY, enabled ? 'true' : 'false');
    } catch (e) {}
  },

  validateWebhookUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' && parsed.hostname === 'script.google.com' &&
          /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(parsed.pathname) && !parsed.search && !parsed.hash) return url;
    } catch (e) {}
    throw new Error('Hãy nhập URL triển khai Google Apps Script dạng https://script.google.com/macros/s/.../exec.');
  },

  async request(url, options = {}) {
    this.validateWebhookUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, { ...options, mode: 'cors', credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new Error('Google trả về HTTP ' + response.status);
      let data;
      try { data = await response.json(); }
      catch (e) { throw new Error('Webhook không trả về JSON hợp lệ. Kiểm tra URL /exec, quyền truy cập và phiên bản triển khai Apps Script.'); }
      if (!data || !['online', 'success'].includes(data.status)) {
        throw new Error((data && data.message) || 'Google Sheets chưa xác nhận thao tác thành công.');
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Google Sheets phản hồi quá 30 giây. Chưa xác nhận đã lưu; kiểm tra bảng tính trước khi gửi lại.');
      if (error instanceof TypeError) throw new Error('Không truy cập được webhook. Kiểm tra mạng, URL /exec và quyền Bất kỳ ai (Anyone); lỗi mạng/CORS không xác định được chính xác quyền triển khai.');
      throw error;
    } finally { clearTimeout(timeout); }
  },

  async checkWebhookStatus(url) {
    try {
      const data = await this.request((url || this.getWebhookUrl() || '').trim());
      if (data.status !== 'online' || data.targetSheet !== 'QuanLyGCodeIn3D') throw new Error('Webhook chưa dùng đúng mã CostMaster. Hãy cập nhật Apps Script và triển khai phiên bản mới.');
      return { ok: true, data };
    } catch (error) { return { ok: false, message: error.message }; }
  },

  /**
   * Gửi 1 đơn hàng lên Google Sheet
   * @param {Object} orderItem - Đối tượng đơn hàng
   * @returns {Promise<boolean>}
   */
  async syncOrder(orderItem) {
    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) {
      throw new Error('Chưa thiết lập URL Webhook Google Sheet!');
    }

    const calc = orderItem.calculation || {};
    const gcode = calc.gcode || {};

    const payload = {
      action: 'add_row',
      createdAt: orderItem.createdAt ? new Date(orderItem.createdAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'),
      filename: orderItem.filename || gcode.filename || 'Chưa đặt tên',
      printerModel: gcode.printerModel || 'SparkX i7',
      materialType: gcode.materialType || 'PLA',
      timeFormatted: calc.timeFormatted || '',
      timeHours: calc.timeHours || 0,
      weightGrams: calc.weightGrams || 0,
      layerCount: gcode.layerCount || 0,
      costFilament: calc.costFilament || 0,
      costElectricity: calc.costElectricity || 0,
      costDepreciation: calc.costDepreciation || 0,
      costLabor: calc.costLabor || 0,
      costFailRisk: calc.costFailRisk || 0,
      costAccessories: calc.costAccessories || 0,
      accessoriesDetail: calc.accessoriesDetail || '',
      totalBaseCost: calc.totalBaseCost || 0,
      priceWholesale: calc.priceWholesale || 0,
      priceRetail: calc.priceRetail || 0,
      netProfitRetail: calc.netProfitRetail || 0,
      profitMarginRetailPercent: calc.profitMarginRetailPercent || 0,
      status: orderItem.status || 'Đã tính giá',
      printProcess: (gcode.printProcess && gcode.printProcess.summaryText) || '',
      notes: orderItem.notes || ''
    };

    try {
      const result = await this.request(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      if (result.status !== 'success') throw new Error('Webhook chưa xác nhận ghi dòng dữ liệu.');
      return true;
    } catch (error) {
      console.error('Lỗi khi gửi lên Google Sheet:', error);
      throw error;
    }
  },

  /**
   * Đồng bộ toàn bộ danh sách đơn hàng lên Google Sheet
   */
  async syncBatch(orderList) {
    if (!orderList || orderList.length === 0) {
      throw new Error('Danh sách đơn hàng rỗng!');
    }

    let successCount = 0;
    for (const order of orderList) {
      try {
        await this.syncOrder(order);
        successCount++;
        // Chờ 300ms giữa các dòng để Google Sheet xử lý mượt mà
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.warn(`Lỗi đồng bộ đơn ${order.filename}:`, e);
      }
    }
    return successCount;
  },

  /**
   * Mã Google Apps Script chuẩn sẵn sàng để người dùng copy
   */
  getAppsScriptTemplate() {
    return `// ========================================================
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
  
  SpreadsheetApp.getUi().alert('🎉 CHÚC MỪNG!\\nĐã tạo thành công tab "QuanLyGCodeIn3D" với dữ liệu mẫu!\\nHãy quay lại bảng tính Google Sheets của bạn để kiểm tra.');
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
}`;
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleSheetsSync;
}
