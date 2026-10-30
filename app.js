/**
 * Main Application Controller for G-Code CostMaster 3D
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    currentParsedData: null,
    currentCalculation: null,
    orders: [],
    config: PricingCalculator.getConfig()
  };

  // DOM Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const btnLoadCuraDemo = document.getElementById('btnLoadCuraDemo');
  const btnLoadCrealityDemo = document.getElementById('btnLoadCrealityDemo');
  const detectedSlicerBadge = document.getElementById('detectedSlicerBadge');

  // Metrics Display
  const valPrintTime = document.getElementById('valPrintTime');
  const valTimeHours = document.getElementById('valTimeHours');
  const valFilamentGrams = document.getElementById('valFilamentGrams');
  const valFilamentMeters = document.getElementById('valFilamentMeters');
  const valPrinterModel = document.getElementById('valPrinterModel');
  const valSlicerName = document.getElementById('valSlicerName');
  const valLayers = document.getElementById('valLayers');
  const valLayerHeight = document.getElementById('valLayerHeight');

  // Pricing Display
  const dispRetailPrice = document.getElementById('dispRetailPrice');
  const dispRetailProfit = document.getElementById('dispRetailProfit');
  const dispRetailMargin = document.getElementById('dispRetailMargin');
  const dispBaseCost = document.getElementById('dispBaseCost');
  const dispWholesalePrice = document.getElementById('dispWholesalePrice');
  const dispWholesaleProfit = document.getElementById('dispWholesaleProfit');

  // Breakdown Elements
  const costFilamentText = document.getElementById('costFilamentText');
  const pctFilamentText = document.getElementById('pctFilamentText');
  const costElectricityText = document.getElementById('costElectricityText');
  const pctElectricityText = document.getElementById('pctElectricityText');
  const costDepreciationText = document.getElementById('costDepreciationText');
  const pctDepreciationText = document.getElementById('pctDepreciationText');
  const costLaborText = document.getElementById('costLaborText');
  const pctLaborText = document.getElementById('pctLaborText');
  const costRiskText = document.getElementById('costRiskText');
  const pctRiskText = document.getElementById('pctRiskText');
  const costAccessoriesText = document.getElementById('costAccessoriesText');
  const pctAccessoriesText = document.getElementById('pctAccessoriesText');

  // Stacked Bars
  const barFilament = document.getElementById('barFilament');
  const barDepreciation = document.getElementById('barDepreciation');
  const barLabor = document.getElementById('barLabor');
  const barElectricity = document.getElementById('barElectricity');
  const barRisk = document.getElementById('barRisk');
  const barAccessories = document.getElementById('barAccessories');

  // Tuning Inputs
  const quickFilamentCost = document.getElementById('quickFilamentCost');
  const liveFilamentPrice = document.getElementById('liveFilamentPrice');
  const quickRetailMarkup = document.getElementById('quickRetailMarkup');
  const liveMarkup = document.getElementById('liveMarkup');

  // Accessories Elements
  const inputAccessoryCost = document.getElementById('inputAccessoryCost');
  const inputAccessoryDetail = document.getElementById('inputAccessoryDetail');
  const badgeAccessoryCost = document.getElementById('badgeAccessoryCost');
  const btnClearAccessories = document.getElementById('btnClearAccessories');
  const accQuickChips = document.querySelectorAll('.acc-quick-chip');

  // Order Inputs
  const selectOrderStatus = document.getElementById('selectOrderStatus');
  const inputOrderNotes = document.getElementById('inputOrderNotes');
  const btnSaveToHistory = document.getElementById('btnSaveToHistory');
  const btnCopyQuote = document.getElementById('btnCopyQuote');

  // History & Table
  const ordersTableBody = document.getElementById('ordersTableBody');
  const emptyOrdersState = document.getElementById('emptyOrdersState');
  const searchOrdersInput = document.getElementById('searchOrdersInput');
  const btnExportAllExcel = document.getElementById('btnExportAllExcel');
  const btnClearHistory = document.getElementById('btnClearHistory');

  // Settings Modal Elements
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const settingsModal = document.getElementById('settingsModal');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnResetDefaultSettings = document.getElementById('btnResetDefaultSettings');

  // Settings Form Inputs
  const cfgFilamentCost = document.getElementById('cfgFilamentCost');
  const cfgWastagePercent = document.getElementById('cfgWastagePercent');
  const cfgMachinePower = document.getElementById('cfgMachinePower');
  const cfgElectricityPrice = document.getElementById('cfgElectricityPrice');
  const cfgMachinePrice = document.getElementById('cfgMachinePrice');
  const cfgMachineLifespan = document.getElementById('cfgMachineLifespan');
  const cfgMaintenancePerHour = document.getElementById('cfgMaintenancePerHour');
  const cfgLaborRate = document.getElementById('cfgLaborRate');
  const cfgLaborTime = document.getElementById('cfgLaborTime');
  const cfgFailRisk = document.getElementById('cfgFailRisk');
  const cfgMarkupWholesale = document.getElementById('cfgMarkupWholesale');
  const cfgMarkupRetail = document.getElementById('cfgMarkupRetail');
  const cfgAccessoryMarkup = document.getElementById('cfgAccessoryMarkup');

  // Google Sheets Elements
  const btnOpenGSheetModal = document.getElementById('btnOpenGSheetModal');
  const gsheetStatusDot = document.getElementById('gsheetStatusDot');
  const gsheetModal = document.getElementById('gsheetModal');
  const btnCloseGSheetModal = document.getElementById('btnCloseGSheetModal');
  const inputGSheetWebhook = document.getElementById('inputGSheetWebhook');
  const gsheetConnectionLabel = document.getElementById('gsheetConnectionLabel');
  const chkAutoSyncGSheet = document.getElementById('chkAutoSyncGSheet');
  const btnCopyScriptCode = document.getElementById('btnCopyScriptCode');
  const btnTestGSheet = document.getElementById('btnTestGSheet');
  const btnSaveGSheetConfig = document.getElementById('btnSaveGSheetConfig');
  const btnSyncCurrentToGSheet = document.getElementById('btnSyncCurrentToGSheet');
  const btnSyncAllToGSheet = document.getElementById('btnSyncAllToGSheet');

  // --- Utility: Show Toast Notification ---
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // --- Load Orders from LocalStorage ---
  function loadOrders() {
    try {
      const stored = localStorage.getItem('gcode_costmaster_orders');
      if (stored) {
        state.orders = JSON.parse(stored);
      } else {
        state.orders = [];
      }
    } catch (e) {
      console.warn('Không thể nạp danh sách đơn hàng:', e);
      state.orders = [];
    }
    renderOrdersTable();
  }

  function saveOrdersToStorage() {
    try {
      localStorage.setItem('gcode_costmaster_orders', JSON.stringify(state.orders));
    } catch (e) {
      console.error('Lỗi khi lưu đơn hàng:', e);
    }
  }

  // --- Update Pricing Calculation & UI ---
  function recalculateAndRender() {
    if (!state.currentParsedData) return;

    // Lấy giá trị trực tiếp từ quick tuning sliders & accessory inputs
    const currentQuickFilament = Math.max(0, parseInt(quickFilamentCost.value, 10) || 0);
    const currentQuickMarkup = parseFloat(quickRetailMarkup.value);
    const currentAccessoryCost = Math.max(0, parseInt(inputAccessoryCost?.value || '0', 10) || 0);
    const currentAccessoryDetail = (inputAccessoryDetail?.value || '').trim();

    const overrides = {
      filamentCostPerKg: currentQuickFilament,
      markupRetail: currentQuickMarkup,
      costAccessories: currentAccessoryCost,
      accessoriesDetail: currentAccessoryDetail,
      accessoryMarkup: state.config?.accessoryMarkup || 1.25
    };

    state.currentCalculation = PricingCalculator.calculate(state.currentParsedData, overrides);
    const calc = state.currentCalculation;

    // Cập nhật chỉ số G-code
    valPrintTime.textContent = calc.timeFormatted;
    valTimeHours.textContent = `${calc.timeHours} giờ in`;
    valFilamentGrams.textContent = `${calc.weightGrams} g`;
    valFilamentMeters.textContent = `${calc.gcode.filamentLengthMeters} mét sợi`;
    valPrinterModel.textContent = calc.gcode.printerModel || 'Máy in FDM';
    valSlicerName.textContent = calc.gcode.slicer || 'Slicer chuẩn';
    valLayers.textContent = `${calc.gcode.layerCount || '--'} lớp`;
    valLayerHeight.textContent = `Cao ${calc.gcode.layerHeight || 0.2} mm`;

    detectedSlicerBadge.textContent = calc.gcode.slicer || 'G-Code';
    detectedSlicerBadge.style.display = 'inline-block';

    // Cập nhật thẻ giá nổi bật
    dispRetailPrice.textContent = PricingCalculator.formatCurrency(calc.priceRetail);
    dispRetailProfit.textContent = `+${PricingCalculator.formatCurrency(calc.netProfitRetail)}`;
    dispRetailMargin.textContent = `${calc.profitMarginRetailPercent}%`;

    dispBaseCost.textContent = PricingCalculator.formatCurrency(calc.totalBaseCost);
    dispWholesalePrice.textContent = PricingCalculator.formatCurrency(calc.priceWholesale);
    dispWholesaleProfit.textContent = `+${PricingCalculator.formatCurrency(calc.netProfitWholesale)}`;

    // Cập nhật chi phí chi tiết
    costFilamentText.textContent = PricingCalculator.formatCurrency(calc.costFilament);
    pctFilamentText.textContent = `${calc.breakdownPercentages.filament}%`;

    costElectricityText.textContent = PricingCalculator.formatCurrency(calc.costElectricity);
    pctElectricityText.textContent = `${calc.breakdownPercentages.electricity}%`;

    costDepreciationText.textContent = PricingCalculator.formatCurrency(calc.costDepreciation);
    pctDepreciationText.textContent = `${calc.breakdownPercentages.depreciation}%`;

    costLaborText.textContent = PricingCalculator.formatCurrency(calc.costLabor);
    pctLaborText.textContent = `${calc.breakdownPercentages.labor}%`;

    costRiskText.textContent = PricingCalculator.formatCurrency(calc.costFailRisk);
    pctRiskText.textContent = `${calc.breakdownPercentages.risk}%`;

    // Cập nhật phụ kiện ngoài
    if (costAccessoriesText) {
      costAccessoriesText.textContent = PricingCalculator.formatCurrency(calc.costAccessories);
    }
    if (pctAccessoriesText) {
      pctAccessoriesText.textContent = `${calc.breakdownPercentages.accessories || 0}%`;
    }
    if (badgeAccessoryCost) {
      badgeAccessoryCost.textContent = PricingCalculator.formatCurrency(calc.costAccessories);
    }

    // Cập nhật thanh tỷ trọng (stacked bar)
    barFilament.style.width = `${calc.breakdownPercentages.filament}%`;
    barDepreciation.style.width = `${calc.breakdownPercentages.depreciation}%`;
    barLabor.style.width = `${calc.breakdownPercentages.labor}%`;
    barElectricity.style.width = `${calc.breakdownPercentages.electricity}%`;
    barRisk.style.width = `${calc.breakdownPercentages.risk}%`;
    if (barAccessories) {
      barAccessories.style.width = `${calc.breakdownPercentages.accessories || 0}%`;
    }

    // Cập nhật nhãn slider
    liveFilamentPrice.textContent = PricingCalculator.formatCurrency(currentQuickFilament);
    liveMarkup.textContent = `x${currentQuickMarkup.toFixed(1)}`;

    // Cập nhật thẻ Bảo Lưu Cài Đặt In (Print Process Keeper)
    const proc = (state.currentParsedData && state.currentParsedData.printProcess) || {};
    const procTempDisplay = document.getElementById('procTempDisplay');
    const procInfillDisplay = document.getElementById('procInfillDisplay');
    const procSpeedDisplay = document.getElementById('procSpeedDisplay');
    const procRetractDisplay = document.getElementById('procRetractDisplay');
    const procWallDisplay = document.getElementById('procWallDisplay');
    const procSupportDisplay = document.getElementById('procSupportDisplay');

    if (procTempDisplay) {
      const n = proc.nozzleTemp ? `${proc.nozzleTemp}°C` : '210°C';
      const b = proc.bedTemp ? `${proc.bedTemp}°C` : '60°C';
      procTempDisplay.textContent = `${n} / ${b}`;
    }
    if (procInfillDisplay) {
      const inf = proc.infillPercent !== null ? `${proc.infillPercent}%` : '20%';
      const pat = proc.infillPattern ? ` (${proc.infillPattern})` : '';
      procInfillDisplay.textContent = `${inf}${pat}`;
    }
    if (procSpeedDisplay) {
      procSpeedDisplay.textContent = proc.printSpeed ? `${proc.printSpeed} mm/s` : '80 mm/s';
    }
    if (procRetractDisplay) {
      const rDist = proc.retractDistance ? `${proc.retractDistance}mm` : '1.2mm';
      const rSpd = proc.retractSpeed ? ` @ ${proc.retractSpeed}mm/s` : ' @ 45mm/s';
      procRetractDisplay.textContent = `${rDist}${rSpd}`;
    }
    if (procWallDisplay) {
      const wL = proc.wallCount ? `${proc.wallCount} lớp` : '3 lớp';
      const wT = proc.wallThickness ? ` (${proc.wallThickness}mm)` : '';
      procWallDisplay.textContent = `${wL}${wT}`;
    }
    if (procSupportDisplay) {
      procSupportDisplay.textContent = proc.supportEnabled ? `Bật (${proc.supportType || 'Tree'})` : 'Tắt';
    }
  }

  // --- Process G-code Text Content ---
  function processGCodeContent(content, filename) {
    try {
      const parsed = GCodeParser.parse(content, filename);
      state.currentParsedData = parsed;
      recalculateAndRender();
      showToast(`Đã phân tích thành công: ${filename}`);
    } catch (err) {
      console.error('Lỗi phân tích file G-code:', err);
      alert('Không thể phân tích file G-code. Vui lòng kiểm tra lại định dạng file!');
    }
  }

  // --- File Upload & Drag-and-Drop Handlers ---
  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      processGCodeContent(event.target.result, file.name);
    };
    reader.readAsText(file);
    fileInput.value = ''; // Reset
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      processGCodeContent(event.target.result, file.name);
    };
    reader.readAsText(file);
  });

  // --- Quick Tuning Controls (Nhập giá nhựa & Hệ số) ---
  quickFilamentCost.addEventListener('input', () => {
    const val = Math.max(0, parseInt(quickFilamentCost.value, 10) || 0);
    liveFilamentPrice.textContent = PricingCalculator.formatCurrency(val);
    recalculateAndRender();
  });

  document.querySelectorAll('.mat-quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cost = parseInt(chip.getAttribute('data-cost'), 10);
      quickFilamentCost.value = cost;
      liveFilamentPrice.textContent = PricingCalculator.formatCurrency(cost);
      recalculateAndRender();
      showToast(`Đã chọn giá nhựa: ${PricingCalculator.formatCurrency(cost)}/kg`);
    });
  });

  quickRetailMarkup.addEventListener('input', () => {
    liveMarkup.textContent = `x${parseFloat(quickRetailMarkup.value).toFixed(1)}`;
    recalculateAndRender();
  });

  // --- Accessories Event Listeners ---
  if (inputAccessoryCost) {
    inputAccessoryCost.addEventListener('input', () => {
      recalculateAndRender();
    });
  }

  if (inputAccessoryDetail) {
    inputAccessoryDetail.addEventListener('input', () => {
      if (state.currentCalculation) {
        state.currentCalculation.accessoriesDetail = inputAccessoryDetail.value.trim();
      }
    });
  }

  if (btnClearAccessories) {
    btnClearAccessories.addEventListener('click', () => {
      if (inputAccessoryCost) inputAccessoryCost.value = 0;
      if (inputAccessoryDetail) inputAccessoryDetail.value = '';
      recalculateAndRender();
      showToast('Đã đặt lại phụ kiện về 0đ');
    });
  }

  accQuickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const addCost = parseInt(chip.getAttribute('data-cost') || '0', 10);
      const name = chip.getAttribute('data-name') || '';
      
      const currentVal = parseInt(inputAccessoryCost.value || '0', 10) || 0;
      inputAccessoryCost.value = currentVal + addCost;

      const currentDetail = inputAccessoryDetail.value.trim();
      if (!currentDetail) {
        inputAccessoryDetail.value = name;
      } else if (!currentDetail.includes(name)) {
        inputAccessoryDetail.value = `${currentDetail} + ${name}`;
      }
      recalculateAndRender();
      showToast(`+${PricingCalculator.formatCurrency(addCost)}: ${name}`);
    });
  });

  // --- Demo Buttons Handlers ---
  btnLoadCuraDemo.addEventListener('click', async () => {
    try {
      const response = await fetch('samples/cura_dragon_toy.gcode');
      const text = await response.text();
      processGCodeContent(text, 'cura_dragon_toy.gcode');
      inputOrderNotes.value = 'Mẫu Rồng khớp nối, nhựa Silk Gold';
    } catch (e) {
      console.error('Không thể nạp file mẫu Cura:', e);
      alert('Không tìm thấy file mẫu Cura.');
    }
  });

  btnLoadCrealityDemo.addEventListener('click', async () => {
    try {
      const response = await fetch('samples/creality_phone_stand.gcode');
      const text = await response.text();
      processGCodeContent(text, 'creality_phone_stand.gcode');
      inputOrderNotes.value = 'Mẫu Giá đỡ điện thoại, nhựa PETG chịu lực';
    } catch (e) {
      console.error('Không thể nạp file mẫu Creality:', e);
      alert('Không tìm thấy file mẫu Creality.');
    }
  });

  // --- Save to History / Orders ---
  btnSaveToHistory.addEventListener('click', () => {
    if (!state.currentCalculation) {
      alert('Vui lòng nạp và phân tích file G-code trước khi lưu vào danh sách đơn hàng!');
      return;
    }

    const newOrder = {
      id: 'ORD-' + Date.now().toString(36).toUpperCase(),
      createdAt: new Date().toISOString(),
      filename: state.currentParsedData.filename,
      status: selectOrderStatus.value,
      notes: inputOrderNotes.value.trim(),
      calculation: { ...state.currentCalculation }
    };

    state.orders.unshift(newOrder);
    saveOrdersToStorage();
    renderOrdersTable();
    showToast(`Đã lưu đơn "${newOrder.filename}" vào bảng quản lý!`);

    // Tự động đẩy lên Google Sheet nếu người dùng bật tùy chọn Auto-sync
    if (GoogleSheetsSync.isAutoSyncEnabled() && GoogleSheetsSync.getWebhookUrl()) {
      GoogleSheetsSync.syncOrder(newOrder).then(() => {
        showToast('☁️ Đã đồng bộ lên Google Sheet!', 'info');
      }).catch(err => {
        console.warn('Lỗi auto-sync Google Sheet:', err);
      });
    }
  });

  // --- Copy Quote to Clipboard (Customer-ready text) ---
  btnCopyQuote.addEventListener('click', () => {
    if (!state.currentCalculation) {
      alert('Vui lòng nạp file G-code để tính giá trước khi sao chép!');
      return;
    }

    const calc = state.currentCalculation;
    const gcode = calc.gcode;

    let accessoryLine = '';
    if (calc.costAccessories > 0) {
      accessoryLine = `\n💡 Phụ kiện đi kèm: ${calc.accessoriesDetail || 'Vật tư mua ngoài'} (+${PricingCalculator.formatCurrency(calc.costAccessories)})`;
    }

    const quoteText = 
`📦 THÔNG SỐ & BÁO GIÁ IN 3D
───────────────────────────
📄 File mô hình: ${gcode.filename}
⚙️ Máy in công nghiệp: ${gcode.printerModel || 'SparkX i7'} (Khổ lớn, ray trượt chuẩn xác, lớp ${gcode.layerHeight || 0.2}mm)
⚖️ Khối lượng nhựa: ${calc.weightGrams}g (${gcode.materialType || 'PLA'})
⏱️ Thời gian in: ${calc.timeFormatted}${accessoryLine}

💰 GIÁ BÁN LẺ ĐỀ XUẤT: ${PricingCalculator.formatCurrency(calc.priceRetail)}
🏷️ GIÁ SỈ / ĐẠI LÝ: ${PricingCalculator.formatCurrency(calc.priceWholesale)}
🛡️ GIÁ VỐN TOÀN DIỆN: ${PricingCalculator.formatCurrency(calc.totalBaseCost)}

✨ CÀI ĐẶT IN BẢO LƯU (SPARKX i7):
• ${(gcode.printProcess && gcode.printProcess.summaryText) || 'Chuẩn SparkX i7'}
• Cam kết đúng kích thước tiêu chuẩn, không cong vênh
• Đã gồm chi phí điện + khấu hao máy + nhân công hoàn thiện
───────────────────────────`;

    navigator.clipboard.writeText(quoteText).then(() => {
      showToast('Đã sao chép nội dung báo giá chuyên nghiệp (Zalo/FB)!');
    }).catch(err => {
      console.warn('Clipboard write error:', err);
      // Fallback
      prompt('Sao chép báo giá dưới đây:', quoteText);
    });
  });

  // --- Export to Excel (.xlsx) ---
  btnExportAllExcel.addEventListener('click', () => {
    if (state.orders.length === 0) {
      if (state.currentCalculation) {
        // Nếu chưa lưu vào history nhưng có đơn hiện tại, tự động tạo tạm 1 đơn để xuất
        const tempOrder = {
          id: 'ORD-TEMP',
          createdAt: new Date().toISOString(),
          filename: state.currentParsedData.filename,
          customerName: inputCustomerName.value.trim() || 'Khách vãng lai',
          customerPhone: inputCustomerPhone.value.trim() || '',
          status: selectOrderStatus.value,
          notes: inputOrderNotes.value.trim(),
          calculation: state.currentCalculation
        };
        ExcelExporter.exportHistory([tempOrder], state.config);
        showToast('Đã xuất báo giá file G-code hiện tại ra Excel!');
      } else {
        alert('Chưa có dữ liệu báo giá nào để xuất file Excel. Vui lòng nạp file G-code trước!');
      }
      return;
    }

    ExcelExporter.exportHistory(state.orders, state.config);
    showToast(`Đã xuất ${state.orders.length} đơn hàng ra file Excel (.xlsx)!`);
  });

  // --- Render Orders Table ---
  function renderOrdersTable() {
    ordersTableBody.innerHTML = '';
    const query = (searchOrdersInput.value || '').toLowerCase().trim();

    const filtered = state.orders.filter(order => {
      if (!query) return true;
      return (
        (order.filename && order.filename.toLowerCase().includes(query)) ||
        (order.notes && order.notes.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      emptyOrdersState.style.display = 'block';
    } else {
      emptyOrdersState.style.display = 'none';
    }

    filtered.forEach((order, index) => {
      const calc = order.calculation || {};
      const tr = document.createElement('tr');

      let statusClass = 'status-quoted';
      if (order.status === 'Đang in') statusClass = 'status-printing';
      if (order.status === 'Hoàn thành' || order.status === 'Đã hoàn thành' || order.status === 'Đã giao hàng') statusClass = 'status-done';

      const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';

      const accTag = (calc.costAccessories > 0)
        ? `<div style="font-size: 11px; color: #facc15; margin-top: 2px;">💡 Phụ kiện: +${PricingCalculator.formatCurrency(calc.costAccessories)} (${calc.accessoriesDetail || 'Linh kiện ngoài'})</div>`
        : '';

      tr.innerHTML = `
        <td style="font-family: var(--font-mono);">${index + 1}</td>
        <td style="color: var(--text-dim); font-size: 11px;">${dateStr}</td>
        <td>
          <div style="font-weight: 600; color: #ffffff;">${order.filename}</div>
          <div style="font-size: 11px; color: var(--accent-cyan); margin-top: 1px;">
            ⚙️ ${(calc.gcode && calc.gcode.printProcess && calc.gcode.printProcess.summaryText) || 'SparkX i7 Profile'}
          </div>
          ${accTag}
          <div style="font-size: 11px; color: var(--text-dim);">${order.notes || 'Không ghi chú'}</div>
        </td>
        <td style="font-family: var(--font-mono);">${calc.weightGrams || 0}g</td>
        <td style="font-family: var(--font-mono);">${calc.timeFormatted || '--'}</td>
        <td style="font-family: var(--font-mono); color: #cbd5e1;">${PricingCalculator.formatCurrency(calc.totalBaseCost)}</td>
        <td style="font-family: var(--font-mono); color: #fbbf24;">${PricingCalculator.formatCurrency(calc.priceWholesale)}</td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8;">${PricingCalculator.formatCurrency(calc.priceRetail)}</td>
        <td style="font-family: var(--font-mono); color: var(--accent-emerald);">+${PricingCalculator.formatCurrency(calc.netProfitRetail)}</td>
        <td><span class="status-badge ${statusClass}">${order.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm btn-delete-order" data-id="${order.id}" title="Xóa đơn này" style="padding: 4px 8px;">
            ❌
          </button>
        </td>
      `;

      ordersTableBody.appendChild(tr);
    });

    // Attach delete handlers
    document.querySelectorAll('.btn-delete-order').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('Bạn có chắc chắn muốn xóa đơn hàng này khỏi danh sách?')) {
          state.orders = state.orders.filter(o => o.id !== id);
          saveOrdersToStorage();
          renderOrdersTable();
          showToast('Đã xóa đơn hàng.');
        }
      });
    });
  }

  // --- Handlers: Print Process Profile Keeper ---
  const btnDownloadProfileIni = document.getElementById('btnDownloadProfileIni');
  const btnCopyProfileText = document.getElementById('btnCopyProfileText');

  if (btnDownloadProfileIni) {
    btnDownloadProfileIni.addEventListener('click', () => {
      if (!state.currentParsedData) {
        alert('Vui lòng nạp file G-code trước!');
        return;
      }
      const text = GCodeParser.generateProfileBackupText(state.currentParsedData);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = (state.currentParsedData.filename || 'model').replace(/\.[^/.]+$/, "");
      a.href = url;
      a.download = `${baseName}_SparkX_i7_Profile.ini`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('📥 Đã tải xuống bản sao lưu Profile in (.ini)!');
    });
  }

  if (btnCopyProfileText) {
    btnCopyProfileText.addEventListener('click', () => {
      if (!state.currentParsedData) {
        alert('Vui lòng nạp file G-code trước!');
        return;
      }
      const text = GCodeParser.generateProfileBackupText(state.currentParsedData);
      navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Đã sao chép toàn bộ thông số in (để nạp vào Creality Print)!');
      }).catch(err => {
        prompt('Sao chép cấu hình dưới đây:', text);
      });
    });
  }

  searchOrdersInput.addEventListener('input', renderOrdersTable);

  btnClearHistory.addEventListener('click', () => {
    if (state.orders.length === 0) return;
    if (confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ lịch sử đơn hàng? Hãy xuất file Excel trước nếu cần lưu trữ.')) {
      state.orders = [];
      saveOrdersToStorage();
      renderOrdersTable();
      showToast('Đã dọn sạch lịch sử đơn hàng.');
    }
  });

  // --- Settings Modal Logic ---
  function populateSettingsForm() {
    const cfg = state.config;
    cfgFilamentCost.value = cfg.filamentCostPerKg;
    cfgWastagePercent.value = cfg.wastagePercent;
    cfgMachinePower.value = cfg.machinePowerWatt;
    cfgElectricityPrice.value = cfg.electricityPricePerKwh;
    cfgMachinePrice.value = cfg.machinePrice;
    cfgMachineLifespan.value = cfg.machineLifespanHours;
    cfgMaintenancePerHour.value = cfg.maintenancePerHour;
    cfgLaborRate.value = cfg.laborRatePerHour;
    cfgLaborTime.value = cfg.laborTimeMinutes;
    cfgFailRisk.value = cfg.failRiskPercent;
    cfgMarkupWholesale.value = cfg.markupWholesale;
    cfgMarkupRetail.value = cfg.markupRetail;
    if (cfgAccessoryMarkup) cfgAccessoryMarkup.value = cfg.accessoryMarkup || 1.25;
  }

  btnOpenSettings.addEventListener('click', () => {
    populateSettingsForm();
    settingsModal.classList.add('active');
  });

  btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.remove('active');
    }
  });

  btnSaveSettings.addEventListener('click', () => {
    const updated = {
      filamentCostPerKg: parseFloat(cfgFilamentCost.value) || 220000,
      wastagePercent: parseFloat(cfgWastagePercent.value) || 5,
      machinePowerWatt: parseFloat(cfgMachinePower.value) || 380,
      electricityPricePerKwh: parseFloat(cfgElectricityPrice.value) || 2600,
      machinePrice: parseFloat(cfgMachinePrice.value) || 28000000,
      machineLifespanHours: parseFloat(cfgMachineLifespan.value) || 8000,
      maintenancePerHour: parseFloat(cfgMaintenancePerHour.value) || 1500,
      laborRatePerHour: parseFloat(cfgLaborRate.value) || 50000,
      laborTimeMinutes: parseFloat(cfgLaborTime.value) || 15,
      failRiskPercent: parseFloat(cfgFailRisk.value) || 5,
      markupWholesale: parseFloat(cfgMarkupWholesale.value) || 1.5,
      markupRetail: parseFloat(cfgMarkupRetail.value) || 2.2,
      accessoryMarkup: parseFloat(cfgAccessoryMarkup?.value) || 1.25
    };

    state.config = PricingCalculator.saveConfig(updated);
    quickFilamentCost.value = updated.filamentCostPerKg;
    quickRetailMarkup.value = updated.markupRetail;

    settingsModal.classList.remove('active');
    recalculateAndRender();
    showToast('Đã lưu cấu hình chi phí mới!');
  });

  btnResetDefaultSettings.addEventListener('click', () => {
    if (confirm('Khôi phục toàn bộ thông số chi phí về mặc định ban đầu?')) {
      state.config = PricingCalculator.resetConfig();
      populateSettingsForm();
      quickFilamentCost.value = state.config.filamentCostPerKg;
      quickRetailMarkup.value = state.config.markupRetail;
      recalculateAndRender();
      showToast('Đã khôi phục cài đặt gốc.');
    }
  });

  // --- Google Sheets Integration Logic ---
  function updateGSheetStatusUI() {
    const url = GoogleSheetsSync.getWebhookUrl();
    if (url) {
      gsheetStatusDot.style.background = '#10b981';
      gsheetConnectionLabel.textContent = '🟢 Đã kết nối';
      gsheetConnectionLabel.style.color = '#10b981';
      inputGSheetWebhook.value = url;
    } else {
      gsheetStatusDot.style.background = '#94a3b8';
      gsheetConnectionLabel.textContent = '⚪ Chưa kết nối';
      gsheetConnectionLabel.style.color = '#94a3b8';
      inputGSheetWebhook.value = '';
    }
    chkAutoSyncGSheet.checked = GoogleSheetsSync.isAutoSyncEnabled();
  }

  btnOpenGSheetModal.addEventListener('click', () => {
    updateGSheetStatusUI();
    gsheetModal.classList.add('active');
  });

  btnCloseGSheetModal.addEventListener('click', () => {
    gsheetModal.classList.remove('active');
  });

  gsheetModal.addEventListener('click', (e) => {
    if (e.target === gsheetModal) {
      gsheetModal.classList.remove('active');
    }
  });

  btnSaveGSheetConfig.addEventListener('click', () => {
    const url = inputGSheetWebhook.value.trim();
    GoogleSheetsSync.setWebhookUrl(url);
    GoogleSheetsSync.setAutoSync(chkAutoSyncGSheet.checked);
    updateGSheetStatusUI();
    gsheetModal.classList.remove('active');
    showToast('Đã lưu cấu hình Google Sheets!');
  });

  btnCopyScriptCode.addEventListener('click', () => {
    const code = GoogleSheetsSync.getAppsScriptTemplate();
    navigator.clipboard.writeText(code).then(() => {
      showToast('Đã sao chép mã Google Apps Script! Hãy dán vào Apps Script của bạn.');
    }).catch(err => {
      prompt('Sao chép mã Apps Script dưới đây:', code);
    });
  });

  btnTestGSheet.addEventListener('click', async () => {
    const url = inputGSheetWebhook.value.trim();
    if (!url) {
      alert('Vui lòng nhập URL Webhook Google Apps Script trước khi gửi thử nghiệm!');
      return;
    }
    GoogleSheetsSync.setWebhookUrl(url);

    const testOrder = {
      filename: 'test_demo_dragon.gcode',
      customerName: 'Dòng Thử Nghiệm',
      customerPhone: '0900000000',
      status: 'Đã báo giá',
      notes: 'Kiểm tra kết nối Google Sheets từ CostMaster',
      calculation: {
        weightGrams: 85,
        timeFormatted: '3 giờ 15 phút',
        timeHours: 3.25,
        costFilament: 19500,
        costElectricity: 2000,
        costDepreciation: 10000,
        costLabor: 11000,
        costFailRisk: 2500,
        totalBaseCost: 45000,
        priceWholesale: 68000,
        priceRetail: 99000,
        netProfitRetail: 54000,
        profitMarginRetailPercent: 54.5,
        gcode: {
          printerModel: 'Ender-3 V3 SE',
          materialType: 'PLA',
          layerCount: 280
        }
      }
    };

    try {
      showToast('Đang gửi dòng thử nghiệm lên Google Sheet...', 'info');
      await GoogleSheetsSync.syncOrder(testOrder);
      showToast('✅ Gửi thử nghiệm thành công! Hãy kiểm tra file Google Sheet của bạn.');
      updateGSheetStatusUI();
    } catch (e) {
      alert('Lỗi kết nối: ' + e.message);
    }
  });

  // Nút gửi đơn hiện tại lên Google Sheet
  btnSyncCurrentToGSheet.addEventListener('click', async () => {
    if (!state.currentCalculation) {
      alert('Vui lòng nạp và phân tích file G-code trước!');
      return;
    }

    const webhookUrl = GoogleSheetsSync.getWebhookUrl();
    if (!webhookUrl) {
      alert('Bạn chưa kết nối URL Google Sheets! Vui lòng dán URL Webhook trong cửa sổ cài đặt.');
      btnOpenGSheetModal.click();
      return;
    }

    const currentOrder = {
      id: 'ORD-' + Date.now().toString(36).toUpperCase(),
      createdAt: new Date().toISOString(),
      filename: state.currentParsedData.filename,
      status: selectOrderStatus.value,
      notes: inputOrderNotes.value.trim(),
      calculation: state.currentCalculation
    };

    try {
      showToast('Đang đẩy dữ liệu lên Google Sheet...', 'info');
      await GoogleSheetsSync.syncOrder(currentOrder);
      showToast(`☁️ Đã lưu file "${currentOrder.filename}" vào Google Sheet tập trung!`);
    } catch (e) {
      alert('Lỗi khi đẩy lên Google Sheet: ' + e.message);
    }
  });

  // Nút đồng bộ toàn bộ lịch sử lên Google Sheet
  btnSyncAllToGSheet.addEventListener('click', async () => {
    if (state.orders.length === 0) {
      alert('Danh sách đơn hàng hiện tại đang trống!');
      return;
    }

    const webhookUrl = GoogleSheetsSync.getWebhookUrl();
    if (!webhookUrl) {
      alert('Bạn chưa kết nối URL Google Sheets!');
      btnOpenGSheetModal.click();
      return;
    }

    if (confirm(`Bạn có chắc chắn muốn đẩy ${state.orders.length} đơn hàng lên file Google Sheets?`)) {
      try {
        showToast(`Đang đồng bộ ${state.orders.length} đơn hàng...`, 'info');
        const count = await GoogleSheetsSync.syncBatch(state.orders);
        showToast(`☁️ Đã đồng bộ thành công ${count} đơn hàng lên Google Sheet!`);
      } catch (e) {
        alert('Lỗi đồng bộ: ' + e.message);
      }
    }
  });

  // --- Initialize App ---
  loadOrders();
  updateGSheetStatusUI();

  // Tự động nạp mẫu Cura mặc định khi mở trang lần đầu để giao diện có dữ liệu sống động ngay lập tức!
  btnLoadCuraDemo.click();
});
