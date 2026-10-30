/**
 * Excel Database & Exporter Module for G-Code 3D CostMaster (SparkX i7)
 * Sử dụng thư viện SheetJS (XLSX) và File System Access API
 * Cho phép dùng trực tiếp 1 file Excel (.xlsx) làm Cơ sở dữ liệu (Database) thực thụ:
 * - Đọc & ghi trực tiếp lên file Excel trên ổ cứng máy tính (không cần tải file rời rạc)
 * - Mở xem và chỉnh sửa bằng Microsoft Excel bất kỳ lúc nào
 * - Hỗ trợ nạp (Import) file Excel cũ và xuất (Export) file mới
 */

const ExcelDatabase = {
  fileHandle: null,
  fileName: null,

  /**
   * Kiểm tra trình duyệt có hỗ trợ File System Access API (ghi trực tiếp vào file trên ổ cứng) không
   */
  isFileSystemSupported() {
    return typeof window !== 'undefined' && 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
  },

  /**
   * Lấy thông tin file Excel DB đang được liên kết
   */
  getConnectedFileName() {
    return this.fileName || localStorage.getItem('gcode_costmaster_excel_db_name') || null;
  },

  /**
   * 1. CHỌN 1 FILE EXCEL CÓ SẴN TRÊN MÁY TÍNH LÀM DATABASE
   * Đọc toàn bộ dữ liệu từ file Excel đó lên bảng quản lý
   */
  async connectExistingExcelFile() {
    if (!this.isFileSystemSupported()) {
      throw new Error('Trình duyệt của bạn không hỗ trợ ghi file trực tiếp. Hãy sử dụng Chrome hoặc Edge trên máy tính!');
    }

    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Bảng tính Excel (*.xlsx)',
          accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
          }
        }],
        multiple: false
      });

      this.fileHandle = handle;
      this.fileName = handle.name;
      localStorage.setItem('gcode_costmaster_excel_db_name', handle.name);

      // Đọc dữ liệu từ file
      const file = await handle.getFile();
      const orders = await this.readOrdersFromBlob(file);
      return { success: true, fileName: handle.name, orders };
    } catch (err) {
      if (err.name === 'AbortError') return { cancelled: true };
      throw err;
    }
  },

  /**
   * 2. TẠO 1 FILE EXCEL MỚI TRÊN Ổ CỨNG LÀM DATABASE
   */
  async createNewExcelDatabase(orders = [], config = {}) {
    if (!this.isFileSystemSupported()) {
      throw new Error('Trình duyệt của bạn không hỗ trợ tạo file trực tiếp. Vui lòng dùng Chrome hoặc Edge!');
    }

    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'QuanLyDonHangIn3D.xlsx',
        types: [{
          description: 'Bảng tính Excel (*.xlsx)',
          accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
          }
        }]
      });

      this.fileHandle = handle;
      this.fileName = handle.name;
      localStorage.setItem('gcode_costmaster_excel_db_name', handle.name);

      // Ghi dữ liệu ban đầu vào file
      await this.saveToConnectedFile(orders, config);
      return { success: true, fileName: handle.name };
    } catch (err) {
      if (err.name === 'AbortError') return { cancelled: true };
      throw err;
    }
  },

  /**
   * 3. GHI ĐÈ TRỰC TIẾP LÊN FILE EXCEL ĐÃ LIÊN KẾT TRÊN Ổ CỨNG
   * Được gọi tự động mỗi khi người dùng bấm "Lưu Vào Đơn Hàng" hoặc xóa/sửa đơn
   */
  async saveToConnectedFile(orders = [], config = {}) {
    if (!this.fileHandle) {
      return false; // Chưa liên kết file
    }

    try {
      // Yêu cầu quyền ghi nếu cần
      if (this.fileHandle.queryPermission) {
        const perm = await this.fileHandle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          const req = await this.fileHandle.requestPermission({ mode: 'readwrite' });
          if (req !== 'granted') throw new Error('Chưa cấp quyền ghi vào file Excel!');
        }
      }

      const wb = this.buildWorkbook(orders, config);
      const outputBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      const writable = await this.fileHandle.createWritable();
      await writable.write(outputBuffer);
      await writable.close();

      return true;
    } catch (err) {
      console.error('Lỗi khi ghi vào file Excel DB:', err);
      throw err;
    }
  },

  /**
   * 4. ĐỌC DỮ LIỆU TỪ 1 FILE EXCEL (FILE OBJECT HOẶC BLOB)
   */
  async readOrdersFromBlob(fileBlob) {
    if (!window.XLSX) throw new Error('Thư viện XLSX chưa sẵn sàng!');

    const buffer = await fileBlob.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    // Tìm sheet chứa danh sách đơn hàng
    let sheetName = wb.SheetNames.find(name => 
      name.includes('Đơn Hàng') || name.includes('Báo Giá') || name.includes('QuanLy')
    ) || wb.SheetNames[0];

    const ws = wb.Sheets[sheetName];
    if (!ws) return [];

    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rawRows || rawRows.length === 0) return [];

    const parsedOrders = [];

    rawRows.forEach((row, idx) => {
      // Bỏ qua dòng TỔNG CỘNG
      const sttVal = String(row['STT'] || '').toUpperCase();
      if (sttVal === 'TỔNG' || sttVal === 'TOTAL') return;

      const filename = row['Tên File G-Code'] || row['Tên File'] || row['Filename'] || `File_In_${idx + 1}`;
      const timeHours = parseFloat(row['Số Giờ (h)'] || row['Thời Gian (h)']) || 0;
      const weightGrams = parseFloat(row['Khối Lượng (g)'] || row['Khối Lượng']) || 0;
      const costFilament = parseFloat(row['Tiền Nhựa (đ)'] || row['Tiền Nhựa']) || 0;
      const costElectricity = parseFloat(row['Tiền Điện (đ)'] || row['Tiền Điện']) || 0;
      const costDepreciation = parseFloat(row['Khấu Hao Máy (đ)'] || row['Khấu Hao']) || 0;
      const costLabor = parseFloat(row['Tiền Công (đ)'] || row['Tiền Công']) || 0;
      const costFailRisk = parseFloat(row['Dự Phòng Rủi Ro (đ)'] || row['Rủi Ro']) || 0;
      const costAccessories = parseFloat(row['Tiền Phụ Kiện (đ)'] || row['Phụ Kiện']) || 0;
      const accessoriesDetail = row['Chi Tiết Phụ Kiện'] || '';
      const totalBaseCost = parseFloat(row['GIÁ VỐN TOÀN DIỆN (đ)'] || row['Giá Vốn (đ)'] || row['Giá Vốn']) || 0;
      const priceWholesale = parseFloat(row['GIÁ SỈ (đ)'] || row['Giá Sỉ']) || 0;
      const priceRetail = parseFloat(row['GIÁ BÁN LẺ (đ)'] || row['Giá Bán Lẻ'] || row['Giá Bán']) || 0;
      const netProfitRetail = parseFloat(row['LỢI NHUẬN RÒNG (đ)'] || row['Lợi Nhuận']) || 0;

      let marginPct = row['Tỷ Suất LN (%)'] || row['Tỷ Suất LN'] || 0;
      if (typeof marginPct === 'string') marginPct = parseFloat(marginPct.replace('%', '')) || 0;

      const orderItem = {
        id: String(row['Mã Đơn Hàng'] || ('ORD-EXCEL-' + crypto.randomUUID())),
        createdAt: row['Thời Gian'] || row['Ngày Tạo'] || new Date().toISOString(),
        filename: filename,
        status: row['Trạng Thái'] || 'Đã tính giá',
        notes: row['Ghi Chú'] || '',
        accessories: [],
        calculation: {
          weightGrams: weightGrams,
          timeFormatted: row['Thời Gian In'] || `${timeHours} giờ`,
          timeHours: timeHours,
          costFilament: costFilament,
          costElectricity: costElectricity,
          costDepreciation: costDepreciation,
          costLabor: costLabor,
          costFailRisk: costFailRisk,
          costAccessories: costAccessories,
          accessoriesDetail: accessoriesDetail,
          totalBaseCost: totalBaseCost,
          priceWholesale: priceWholesale,
          priceRetail: priceRetail,
          netProfitRetail: netProfitRetail,
          profitMarginRetailPercent: marginPct,
          gcode: {
            filename: filename,
            printerModel: row['Dòng Máy In'] || row['Máy In'] || 'SparkX i7',
            materialType: row['Loại Nhựa'] || 'PLA',
            layerCount: parseInt(row['Số Lớp (Layers)'] || row['Số Lớp']) || 0,
            printProcess: { summaryText: row['Cài Đặt In (Profile)'] || '' }
          }
        }
      };

      parsedOrders.push(orderItem);
    });

    return parsedOrders;
  },

  /**
   * 5. TẠO WORKBOOK CHUẨN ĐỂ GHI RA FILE EXCEL (.xlsx)
   */
  buildWorkbook(orders = [], config = {}) {
    if (!window.XLSX) throw new Error('Thư viện XLSX chưa sẵn sàng!');

    const wb = XLSX.utils.book_new();

    // Sheet 1: Quản Lý Đơn Hàng In 3D
    const dataRows = [];
    const headers = [
      'STT',
      'Mã Đơn Hàng',
      'Thời Gian',
      'Tên File G-Code',
      'Dòng Máy In',
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
      'Tỷ Suất LN (%)',
      'Trạng Thái',
      'Cài Đặt In (Profile)',
      'Ghi Chú'
    ];
    dataRows.push(headers);

    let totalWeight = 0;
    let totalFilamentCost = 0;
    let totalElectricityCost = 0;
    let totalDepreciation = 0;
    let totalLaborCost = 0;
    let totalAccessoriesCost = 0;
    let totalBaseCost = 0;
    let totalRetailRevenue = 0;
    let totalNetProfit = 0;

    orders.forEach((item, index) => {
      const calc = item.calculation || {};
      const gcode = calc.gcode || {};

      totalWeight += calc.weightGrams || 0;
      totalFilamentCost += calc.costFilament || 0;
      totalElectricityCost += calc.costElectricity || 0;
      totalDepreciation += calc.costDepreciation || 0;
      totalLaborCost += calc.costLabor || 0;
      totalAccessoriesCost += calc.costAccessories || 0;
      totalBaseCost += calc.totalBaseCost || 0;
      totalRetailRevenue += calc.priceRetail || 0;
      totalNetProfit += calc.netProfitRetail || 0;

      dataRows.push([
        index + 1,
        item.id || ('ORD-' + (index + 1)),
        item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'),
        item.filename || gcode.filename || 'Chưa đặt tên',
        gcode.printerModel || 'SparkX i7',
        gcode.materialType || 'PLA',
        calc.timeFormatted || '',
        calc.timeHours || 0,
        calc.weightGrams || 0,
        gcode.layerCount || 0,
        calc.costFilament || 0,
        calc.costElectricity || 0,
        calc.costDepreciation || 0,
        calc.costLabor || 0,
        calc.costFailRisk || 0,
        calc.costAccessories || 0,
        calc.accessoriesDetail || '',
        calc.totalBaseCost || 0,
        calc.priceWholesale || 0,
        calc.priceRetail || 0,
        calc.netProfitRetail || 0,
        `${calc.profitMarginRetailPercent || 0}%`,
        item.status || 'Đã tính giá',
        (gcode.printProcess && gcode.printProcess.summaryText) || '',
        item.notes || ''
      ]);
    });

    // Dòng tổng kết
    if (orders.length > 0) {
      dataRows.push([
        'TỔNG',
        `${orders.length} đơn`,
        '', '', '', '', '',
        Math.round(totalWeight),
        '',
        Math.round(totalFilamentCost),
        Math.round(totalElectricityCost),
        Math.round(totalDepreciation),
        Math.round(totalLaborCost),
        '',
        Math.round(totalAccessoriesCost),
        '',
        Math.round(totalBaseCost),
        '',
        Math.round(totalRetailRevenue),
        Math.round(totalNetProfit),
        totalRetailRevenue > 0 ? `${((totalNetProfit / totalRetailRevenue) * 100).toFixed(1)}%` : '0%',
        '', '', ''
      ]);
    }

    const wsOrders = XLSX.utils.aoa_to_sheet(dataRows);
    wsOrders['!cols'] = [
      { wch: 6 },   // STT
      { wch: 14 },  // Mã đơn
      { wch: 20 },  // Ngày
      { wch: 28 },  // Tên file
      { wch: 18 },  // Máy in
      { wch: 12 },  // Loại nhựa
      { wch: 16 },  // Thời gian in
      { wch: 10 },  // Giờ
      { wch: 14 },  // Khối lượng
      { wch: 10 },  // Lớp
      { wch: 14 },  // Tiền nhựa
      { wch: 14 },  // Tiền điện
      { wch: 16 },  // Khấu hao
      { wch: 14 },  // Tiền công
      { wch: 14 },  // Rủi ro
      { wch: 16 },  // Phụ kiện
      { wch: 24 },  // Chi tiết phụ kiện
      { wch: 20 },  // Giá vốn
      { wch: 16 },  // Giá sỉ
      { wch: 18 },  // Giá lẻ
      { wch: 18 },  // Lợi nhuận
      { wch: 14 },  // Tỷ suất
      { wch: 16 },  // Trạng thái
      { wch: 35 },  // Cài đặt in
      { wch: 25 }   // Ghi chú
    ];

    XLSX.utils.book_append_sheet(wb, wsOrders, 'QuanLyDonHangIn3D');

    // Sheet 2: Cấu Hình Chi Phí Máy In SparkX i7
    const cfg = config || {};
    const configRows = [
      ['BẢNG CẤU HÌNH CHI PHÍ VẬN HÀNH MÁY IN 3D (SPARKX i7)', ''],
      ['Thời điểm lưu:', new Date().toLocaleString('vi-VN')],
      ['', ''],
      ['Thông Số Định Giá', 'Giá Trị Áp Dụng'],
      ['Giá nhựa (1kg):', `${(cfg.filamentCostPerKg || 0).toLocaleString('vi-VN')} đ/kg`],
      ['Tỷ lệ hao hụt / support:', `${cfg.wastagePercent || 0} %`],
      ['Công suất máy in:', `${cfg.machinePowerWatt || 0} W`],
      ['Giá điện:', `${(cfg.electricityPricePerKwh || 0).toLocaleString('vi-VN')} đ/kWh`],
      ['Giá mua máy in:', `${(cfg.machinePrice || 0).toLocaleString('vi-VN')} đ`],
      ['Tuổi thọ máy (giờ in):', `${cfg.machineLifespanHours || 0} giờ`],
      ['Phí bảo dưỡng máy/giờ:', `${(cfg.maintenancePerHour || 0).toLocaleString('vi-VN')} đ/giờ`],
      ['Tiền công thợ/giờ:', `${(cfg.laborRatePerHour || 0).toLocaleString('vi-VN')} đ/giờ`],
      ['Thời gian công/đơn:', `${cfg.laborTimeMinutes || 0} phút`],
      ['Dự phòng rủi ro in hỏng:', `${cfg.failRiskPercent || 0} %`],
      ['Hệ số in sỉ:', `x${cfg.markupWholesale || 1.5}`],
      ['Hệ số in lẻ:', `x${cfg.markupRetail || 2.2}`],
      ['Hệ số bán lẻ phụ kiện:', `x${cfg.accessoryMarkup || 1.25}`]
    ];
    const wsConfig = XLSX.utils.aoa_to_sheet(configRows);
    wsConfig['!cols'] = [{ wch: 36 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsConfig, 'CauHinhChiPhi');

    return wb;
  },

  /**
   * 6. TẢI FILE EXCEL VỀ MÁY TÍNH (FALLBACK)
   */
  exportAndDownload(orders = [], config = {}, customFileName = null) {
    if (!orders || orders.length === 0) {
      alert('Chưa có đơn hàng nào để xuất file Excel!');
      return false;
    }

    const wb = this.buildWorkbook(orders, config);
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = customFileName || `QuanLyDonHangIn3D_${dateStr}.xlsx`;

    XLSX.writeFile(wb, filename);
    return true;
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExcelDatabase;
}
