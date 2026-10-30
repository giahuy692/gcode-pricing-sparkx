/**
 * Excel Export Module for G-Code 3D CostMaster
 * Sử dụng thư viện SheetJS (XLSX) để tạo file Excel (.xlsx) chuẩn nghiệp vụ
 */

const ExcelExporter = {
  /**
   * Tạo workbook chứa toàn bộ lịch sử báo giá và cấu hình
   * @param {Array} historyItems - Danh sách các đơn/mục báo giá đã lưu
   * @param {Object} currentConfig - Cấu hình chi phí hiện tại
   * @param {string} [customFileName] - Tên file tải về
   */
  exportHistory(historyItems, currentConfig, customFileName = null) {
    if (!window.XLSX) {
      alert('Lỗi: Thư viện XLSX chưa sẵn sàng. Vui lòng thử lại!');
      return false;
    }

    if (!historyItems || historyItems.length === 0) {
      alert('Chưa có dữ liệu nào trong lịch sử để xuất file Excel!');
      return false;
    }

    const wb = XLSX.utils.book_new();

    // 1. Tạo Sheet "Lịch Sử Báo Giá In 3D"
    const dataRows = [];

    // Header bảng
    const headers = [
      'STT',
      'Ngày Tạo',
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

    historyItems.forEach((item, index) => {
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
        item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '',
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
        item.status || 'Đã báo giá',
        (gcode.printProcess && gcode.printProcess.summaryText) || '',
        item.notes || ''
      ]);
    });

    // Hàng tổng cộng
    dataRows.push([
      'TỔNG',
      `${historyItems.length} file`,
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

    const wsOrders = XLSX.utils.aoa_to_sheet(dataRows);

    // Cài đặt độ rộng các cột tự động (Column Widths)
    wsOrders['!cols'] = [
      { wch: 6 },   // STT
      { wch: 19 },  // Ngày
      { wch: 28 },  // Tên file
      { wch: 16 },  // Máy in
      { wch: 10 },  // Loại nhựa
      { wch: 16 },  // Thời gian
      { wch: 10 },  // Giờ
      { wch: 14 },  // Khối lượng
      { wch: 10 },  // Lớp
      { wch: 14 },  // Tiền nhựa
      { wch: 14 },  // Tiền điện
      { wch: 16 },  // Khấu hao
      { wch: 14 },  // Tiền công
      { wch: 14 },  // Rủi ro
      { wch: 16 },  // Tiền phụ kiện
      { wch: 24 },  // Chi tiết phụ kiện
      { wch: 16 },  // Quỹ rủi ro
      { wch: 20 },  // Giá vốn
      { wch: 16 },  // Giá sỉ
      { wch: 18 },  // Giá lẻ
      { wch: 18 },  // Lợi nhuận
      { wch: 14 },  // Tỷ suất
      { wch: 14 },  // Trạng thái
      { wch: 35 },  // Cài đặt in
      { wch: 25 }   // Ghi chú
    ];

    XLSX.utils.book_append_sheet(wb, wsOrders, 'Danh Sách Báo Giá');

    // 2. Tạo Sheet "Cấu Hình Chi Phí Định Giá"
    const cfg = currentConfig || {};
    const configRows = [
      ['THÔNG SỐ CẤU HÌNH ĐỊNH GIÁ IN 3D', ''],
      ['Ngày xuất file:', new Date().toLocaleString('vi-VN')],
      ['', ''],
      ['Thông Số', 'Giá Trị Áp Dụng'],
      ['Giá nhựa cuộn (1kg):', `${(cfg.filamentCostPerKg || 0).toLocaleString('vi-VN')} đ/kg`],
      ['Tỷ lệ hao hụt / hỗ trợ in:', `${cfg.wastagePercent || 0} %`],
      ['Công suất máy in trung bình:', `${cfg.machinePowerWatt || 0} W`],
      ['Đơn giá điện:', `${(cfg.electricityPricePerKwh || 0).toLocaleString('vi-VN')} đ/kWh`],
      ['Giá mua máy in ban đầu:', `${(cfg.machinePrice || 0).toLocaleString('vi-VN')} đ`],
      ['Tuổi thọ khấu hao máy:', `${cfg.machineLifespanHours || 0} giờ in`],
      ['Phí bảo dưỡng máy/giờ:', `${(cfg.maintenancePerHour || 0).toLocaleString('vi-VN')} đ/giờ`],
      ['Tiền công theo giờ:', `${(cfg.laborRatePerHour || 0).toLocaleString('vi-VN')} đ/giờ`],
      ['Thời gian công việc/đơn (setup + gỡ support):', `${cfg.laborTimeMinutes || 0} phút`],
      ['Quỹ dự phòng in hỏng/lỗi:', `${cfg.failRiskPercent || 0} %`],
      ['Hệ số giá sỉ (Wholesale Markup):', `x${cfg.markupWholesale || 1.5}`],
      ['Hệ số giá bán lẻ (Retail Markup):', `x${cfg.markupRetail || 2.2}`],
      ['Chiết khấu số lượng:', `${cfg.discountPercent || 0} %`],
      ['', ''],
      ['* Nguyên tắc tính toán:', 'Giá Vốn = Nhựa + Điện + Khấu Hao + Tiền Công + Quỹ Rủi Ro'],
      ['* Cam kết:', 'Không bao giờ lỗ vốn, đảm bảo biên lợi nhuận lành mạnh.']
    ];

    const wsConfig = XLSX.utils.aoa_to_sheet(configRows);
    wsConfig['!cols'] = [{ wch: 36 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsConfig, 'Cấu Hình Chi Phí');

    // 3. Tải file về máy tính
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = customFileName || `Bao_Gia_In_3D_${dateStr}.xlsx`;

    XLSX.writeFile(wb, filename);
    return true;
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExcelExporter;
}
