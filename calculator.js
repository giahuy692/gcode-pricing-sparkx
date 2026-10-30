/**
 * 3D Printing Cost & Pricing Calculation Engine
 * Công thức định giá toàn diện đảm bảo không lỗ và có lợi nhuận tối ưu
 */

const PricingCalculator = {
  // Cấu hình chuẩn mặc định cho dòng máy in SparkX i7 (Dòng FDM khổ lớn công nghiệp)
  DEFAULT_CONFIG: {
    printerName: 'SparkX i7',       // Tên dòng máy in đang sử dụng
    // Giá vật liệu
    filamentCostPerKg: 220000,      // Giá 1 cuộn nhựa 1kg (220.000đ cho PLA/PETG)
    wastagePercent: 5,              // Hao hụt / hỗ trợ in / purge line (5%)

    // Chi phí điện năng của SparkX i7 (Bàn nhiệt khổ lớn 300x300mm)
    machinePowerWatt: 380,          // Công suất tiêu thụ trung bình (~350W - 450W)
    electricityPricePerKwh: 2600,   // Giá điện kinh doanh/sinh hoạt (2.600đ/kWh)

    // Khấu hao máy & Bảo dưỡng dòng máy SparkX i7
    machinePrice: 28000000,         // Giá mua máy SparkX i7 (~28.000.000đ)
    machineLifespanHours: 8000,     // Tuổi thọ ray trượt & khung máy công nghiệp (8.000 giờ ~ 3.500đ/giờ)
    maintenancePerHour: 1500,       // Phí bảo dưỡng/giờ (búp sen high-flow, mỡ bôi trơn ray trượt: 1.500đ/giờ)

    // Chi phí nhân công (Setup & Hậu kỳ)
    laborRatePerHour: 50000,        // Mức lương theo giờ của bạn (50.000đ/giờ)
    laborTimeMinutes: 15,           // Thời gian setup file, gỡ bàn in, bóc support, đóng gói (15 phút)

    // Rủi ro in hỏng / đền bù
    failRiskPercent: 5,             // Tỷ lệ dự phòng rủi ro in lỗi/hỏng (5%)

    // Phụ kiện mua ngoài & Vật tư lắp ráp (Đèn LED, mica tản sáng, ốc vít, nam châm...)
    accessoryMarkup: 1.25,          // Hệ số giá bán lẻ phụ kiện (x1.25 bù công hàn dây, test điện, dán lắp ráp)

    // Hệ số định giá bán
    markupWholesale: 1.5,           // Hệ số giá sỉ / đại lý (x1.5 = Lời ~33% trên giá bán)
    markupRetail: 2.2,              // Hệ số giá bán lẻ (x2.2 = Lời ~55% trên giá bán)
    discountPercent: 0              // Chiết khấu đơn hàng nếu có (0%)
  },

  /**
   * Tải cấu hình từ localStorage hoặc dùng mặc định
   */
  getConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('gcode_costmaster_config');
        if (saved) {
          return { ...this.DEFAULT_CONFIG, ...JSON.parse(saved) };
        }
      }
    } catch (e) {
      console.warn('Không thể đọc cấu hình:', e);
    }
    return { ...this.DEFAULT_CONFIG };
  },

  /**
   * Lưu cấu hình mới
   */
  saveConfig(newConfig) {
    try {
      const merged = { ...this.DEFAULT_CONFIG, ...newConfig };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('gcode_costmaster_config', JSON.stringify(merged));
      }
      return merged;
    } catch (e) {
      console.error('Không thể lưu cấu hình:', e);
      return newConfig;
    }
  },

  /**
   * Khôi phục cấu hình mặc định
   */
  resetConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('gcode_costmaster_config');
      }
    } catch (e) {}
    return { ...this.DEFAULT_CONFIG };
  },

  /**
   * Tính toán toàn bộ chi phí và báo giá từ dữ liệu G-code
   * @param {Object} gcodeData - Dữ liệu trích xuất từ GCodeParser
   * @param {Object} [customConfig] - Cấu hình ghi đè nếu có (bao gồm costAccessories, accessoriesDetail...)
   * @returns {Object} Báo cáo chi phí chi tiết
   */
  calculate(gcodeData, customConfig = null) {
    const cfg = customConfig ? { ...this.getConfig(), ...customConfig } : this.getConfig();

    const weightGrams = Math.max(0, parseFloat(gcodeData.filamentWeightGrams) || 0);
    const timeHours = Math.max(0, parseFloat(gcodeData.timeHours) || 0);

    // 1. Chi phí nhựa (Filament Cost)
    const costFilamentBase = (weightGrams / 1000) * cfg.filamentCostPerKg;
    const costFilamentWastage = costFilamentBase * (cfg.wastagePercent / 100);
    const costFilament = Math.round(costFilamentBase + costFilamentWastage);

    // 2. Chi phí điện năng (Power Cost)
    // kWh = (Watt / 1000) * giờ in
    const kwhUsed = (cfg.machinePowerWatt / 1000) * timeHours;
    const costElectricity = Math.round(kwhUsed * cfg.electricityPricePerKwh);

    // 3. Khấu hao máy & Bảo trì (Depreciation & Maintenance)
    const depPerHour = (cfg.machinePrice / cfg.machineLifespanHours) + cfg.maintenancePerHour;
    const costDepreciation = Math.round(timeHours * depPerHour);

    // 4. Chi phí nhân công & Xử lý (Labor & Post-processing)
    const laborHours = (cfg.laborTimeMinutes / 60);
    const costLabor = Math.round(laborHours * cfg.laborRatePerHour);

    // 5. Chi phí mua phụ kiện & vật tư ngoài (Đèn LED, mica, ốc, nam châm...)
    const costAccessories = Math.max(0, parseFloat(customConfig?.costAccessories ?? cfg.costAccessories ?? 0));
    const accessoriesDetail = (customConfig?.accessoriesDetail ?? cfg.accessoriesDetail ?? '').trim();
    const accessoryMarkup = parseFloat(customConfig?.accessoryMarkup ?? cfg.accessoryMarkup ?? 1.25);

    // 6. Tổng chi phí in cơ bản (Filament + Điện + Khấu hao + Công in)
    const subtotalPrintCost = costFilament + costElectricity + costDepreciation + costLabor;

    // 7. Quỹ dự phòng rủi ro in lỗi (chỉ tính trên phần in 3D, không phạt lên tiền mua linh kiện ngoài)
    const costFailRisk = Math.round(subtotalPrintCost * (cfg.failRiskPercent / 100));

    // 8. GIÁ VỐN TOÀN DIỆN (Đã gồm in + rủi ro + tiền mua phụ kiện)
    const totalBaseCost = Math.round(subtotalPrintCost + costFailRisk + costAccessories);

    // 9. GIÁ BÁN SỈ ĐỀ XUẤT (Wholesale Price)
    // In 3D sỉ theo markupWholesale, phụ kiện sỉ tính giá vốn + 10%
    const wholesalePrint = (subtotalPrintCost + costFailRisk) * cfg.markupWholesale;
    const wholesaleAcc = costAccessories * 1.1;
    const priceWholesaleRaw = wholesalePrint + wholesaleAcc;
    const priceWholesale = Math.round(priceWholesaleRaw / 1000) * 1000; // Làm tròn đến nghìn đồng

    // 10. GIÁ BÁN LẺ ĐỀ XUẤT (Retail Price)
    // In 3D lẻ theo markupRetail, phụ kiện lẻ theo accessoryMarkup (mặc định x1.25 bù công hàn dán lắp ráp)
    const retailPrint = (subtotalPrintCost + costFailRisk) * cfg.markupRetail;
    const retailAcc = costAccessories * accessoryMarkup;
    const baseRetail = retailPrint + retailAcc;
    const discountedRetail = baseRetail * (1 - (cfg.discountPercent / 100));
    const priceRetail = Math.round(discountedRetail / 1000) * 1000; // Làm tròn đến nghìn đồng

    // 11. Lợi nhuận ròng & Tỷ suất lợi nhuận (Net Profit)
    const netProfitRetail = Math.max(0, priceRetail - totalBaseCost);
    const profitMarginRetailPercent = priceRetail > 0 ? Number(((netProfitRetail / priceRetail) * 100).toFixed(1)) : 0;

    const netProfitWholesale = Math.max(0, priceWholesale - totalBaseCost);
    const profitMarginWholesalePercent = priceWholesale > 0 ? Number(((netProfitWholesale / priceWholesale) * 100).toFixed(1)) : 0;

    // 12. Các chỉ số tham chiếu thị trường (Market Benchmarks)
    const pricePerGram = weightGrams > 0 ? Math.round(priceRetail / weightGrams) : 0;
    const pricePerHour = timeHours > 0 ? Math.round(priceRetail / timeHours) : 0;

    // 13. Tỷ trọng các thành phần trong giá vốn (để vẽ biểu đồ)
    const baseTotalSafe = totalBaseCost || 1;
    const breakdownPercentages = {
      filament: Number(((costFilament / baseTotalSafe) * 100).toFixed(1)),
      electricity: Number(((costElectricity / baseTotalSafe) * 100).toFixed(1)),
      depreciation: Number(((costDepreciation / baseTotalSafe) * 100).toFixed(1)),
      labor: Number(((costLabor / baseTotalSafe) * 100).toFixed(1)),
      risk: Number(((costFailRisk / baseTotalSafe) * 100).toFixed(1)),
      accessories: Number(((costAccessories / baseTotalSafe) * 100).toFixed(1))
    };

    return {
      // Dữ liệu gốc
      gcode: gcodeData,
      weightGrams,
      timeHours,
      timeFormatted: gcodeData.timeFormatted,

      // Chi phí chi tiết
      costFilament,
      costElectricity,
      costDepreciation,
      costLabor,
      costFailRisk,
      costAccessories,
      accessoriesDetail,
      accessoryMarkup,
      totalBaseCost,

      // Giá đề xuất
      priceWholesale,
      priceRetail,
      netProfitRetail,
      profitMarginRetailPercent,
      netProfitWholesale,
      profitMarginWholesalePercent,

      // Tham chiếu
      pricePerGram,
      pricePerHour,
      kwhUsed: Number(kwhUsed.toFixed(2)),

      // Tỷ trọng
      breakdownPercentages,
      configUsed: cfg
    };
  },

  /**
   * Định dạng số tiền sang định dạng tiền tệ VNĐ (ví dụ: 125.000 đ)
   */
  formatCurrency(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) return '0 đ';
    return Math.round(amount).toLocaleString('vi-VN') + ' đ';
  }
};

// Export cho môi trường module hoặc node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PricingCalculator;
}
