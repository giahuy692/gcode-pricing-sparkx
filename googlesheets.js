/**
 * Google Sheets Integration Module for G-Code CostMaster 3D
 * Sử dụng Google Apps Script Web App để đồng bộ dữ liệu trực tiếp vào 1 file Google Sheets duy nhất.
 */

const GoogleSheetsSync = {
  STORAGE_KEY: 'gcode_costmaster_gsheet_url',
  AUTO_SYNC_KEY: 'gcode_costmaster_gsheet_autosync',

  /**
   * Lấy URL Webhook Google Sheet đã lưu
   */
  getWebhookUrl() {
    try {
      return localStorage.getItem(this.STORAGE_KEY) || '';
    } catch (e) {
      return '';
    }
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
      // Gửi bằng mode no-cors để vượt qua chính sách CORS của Google Apps Script Redirect
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
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
// 1. Mở file Google Sheet của bạn trên trình duyệt
// 2. Vào menu: Tiện ích mở rộng (Extensions) -> Apps Script
// 3. Xóa hết mã cũ, dán toàn bộ đoạn mã này vào rồi bấm Lưu (Ctrl+S)
// 4. Bấm "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment)
// 5. Chọn loại: "Ứng dụng web" (Web app)
//    - Người thực thi: "Tôi" (Me)
//    - Ai có quyền truy cập: "Bất kỳ ai" (Anyone)
// 6. Bấm "Triển khai" và sao chép URL Ứng dụng web dán vào G-Code CostMaster!
// ========================================================

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    
    // Tự động đặt tên sheet nếu muốn
    if (sheet.getName() === 'Trang tính1' || sheet.getName() === 'Sheet1') {
      sheet.setName('QuanLyGCodeIn3D');
    }
    
    var data = JSON.parse(e.postData.contents);
    
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
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Row added' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleSheetsSync;
}
