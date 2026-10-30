/**
 * Google Sheets Integration Module for G-Code CostMaster 3D
 * Sử dụng Google Apps Script Web App để đồng bộ dữ liệu trực tiếp vào 1 file Google Sheets duy nhất.
 */

const GoogleSheetsSync = {
  STORAGE_KEY: 'gcode_costmaster_gsheet_url',
  AUTO_SYNC_KEY: 'gcode_costmaster_gsheet_autosync',
  TOKEN_KEY: 'gcode_costmaster_gsheet_token',
  SPREADSHEET_ID: '1In-uUOEvUZmSfK7kQEOSgVUi_Cjaoeowi32k7pbBXFs',
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
    localStorage.setItem(this.STORAGE_KEY, (url || '').trim());
  },

  getToken() {
    try { return localStorage.getItem(this.TOKEN_KEY) || ''; }
    catch (e) { return ''; }
  },

  setToken(token) {
    if (token.trim() && token.trim().length < 32) throw new Error('Khóa ghi phải có ít nhất 32 ký tự.');
    localStorage.setItem(this.TOKEN_KEY, token.trim());
  },

  /**
   * Kiểm tra xem tính năng tự động đồng bộ có bật không
   */
  isAutoSyncEnabled() {
    try {
      return localStorage.getItem(this.AUTO_SYNC_KEY) !== 'false';
    } catch (e) {
      return false;
    }
  },

  /**
   * Bật/tắt tự động đồng bộ
   */
  setAutoSync(enabled) {
    localStorage.setItem(this.AUTO_SYNC_KEY, enabled ? 'true' : 'false');
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
      if (error.name === 'AbortError') throw new Error('Google Sheets phản hồi quá 30 giây. Đơn vẫn chờ đồng bộ và sẽ được gửi lại với cùng mã đơn.');
      if (error instanceof TypeError) throw new Error('Không truy cập được webhook. Kiểm tra mạng, URL /exec và quyền Bất kỳ ai (Anyone); lỗi mạng/CORS không xác định được chính xác quyền triển khai.');
      throw error;
    } finally { clearTimeout(timeout); }
  },

  async checkWebhookStatus(url) {
    try {
      const data = await this.request((url || this.getWebhookUrl() || '').trim());
      if (data.status !== 'online' || data.targetSheet !== 'QuanLyGCodeIn3D' ||
          data.protocolVersion !== 2 || data.spreadsheetId !== this.SPREADSHEET_ID || !data.authRequired) {
        throw new Error('Webhook chưa dùng đúng bản CostMaster có chống trùng và khóa ghi cho DGH AquaLab. Hãy cập nhật Apps Script và triển khai phiên bản mới.');
      }
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
    const token = this.getToken();
    if (!token) throw new Error('Chưa thiết lập khóa ghi Google Sheets trong cài đặt.');
    if (!orderItem.id) throw new Error('Đơn hàng thiếu mã định danh; hãy lưu vào đơn hàng trước.');
    const health = await this.checkWebhookStatus(webhookUrl);
    if (!health.ok) throw new Error(health.message);

    const calc = orderItem.calculation || {};
    const gcode = calc.gcode || {};

    const payload = {
      action: 'add_row',
      orderId: orderItem.id,
      spreadsheetId: this.SPREADSHEET_ID,
      token,
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
      if (result.status !== 'success' || result.orderId !== orderItem.id ||
          result.spreadsheetId !== this.SPREADSHEET_ID) throw new Error('Webhook chưa xác nhận đúng mã đơn và bảng tính đích.');
      return true;
    } catch (error) {
      console.error('Lỗi khi gửi lên Google Sheet:', error);
      throw error;
    }
  },

  // Dùng lịch sử đã lưu làm hàng đợi để vẫn gửi lại được sau khi tải lại trang.
  syncPendingOrders(orders, onUpdate = () => {}) {
    if (this.pendingSync) return this.pendingSync;
    this.pendingSync = (async () => {
      const url = this.getWebhookUrl();
      let count = 0;
      if (!url || !this.getToken() || !this.isAutoSyncEnabled()) return count;
      for (const order of [...orders].reverse()) {
        if (!this.isAutoSyncEnabled() || this.getWebhookUrl() !== url) break;
        if (order.googleSheetsSyncedUrl === url) continue;
        try {
          await this.syncOrder(order);
          order.googleSheetsSyncedUrl = url;
          delete order.googleSheetsSyncError;
          count++;
        } catch (error) {
          order.googleSheetsSyncError = error.message;
          onUpdate();
          break;
        }
        onUpdate();
      }
      return count;
    })().finally(() => { this.pendingSync = null; });
    return this.pendingSync;
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
      const url = this.getWebhookUrl();
      try {
        await this.syncOrder(order);
        order.googleSheetsSyncedUrl = url;
        delete order.googleSheetsSyncError;
        successCount++;
        // Chờ 300ms giữa các dòng để Google Sheet xử lý mượt mà
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        order.googleSheetsSyncError = e.message;
        console.warn(`Lỗi đồng bộ đơn ${order.filename}:`, e);
      }
    }
    return successCount;
  },

  /**
   * Mã Google Apps Script chuẩn sẵn sàng để người dùng copy
   */
  getAppsScriptTemplate() {
    return String.raw`// G-Code CostMaster: chỉ ghi tab QuanLyGCodeIn3D trong DGH AquaLab.
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
}`;
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleSheetsSync;
}
