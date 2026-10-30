const test = require('node:test');
const assert = require('node:assert');
const XLSX = require('../xlsx.full.min.js');

// Mock window.XLSX for Node environment
global.window = { XLSX };
global.XLSX = XLSX;

const ExcelDatabase = require('../excel.js');

test('ExcelDatabase buildWorkbook creates proper sheets and columns', () => {
  const sampleOrders = [
    {
      id: 'ORD-TEST-1',
      createdAt: '2026-10-30T08:00:00.000Z',
      filename: 'dragon_sparkx_i7.gcode',
      status: 'Đã tính giá',
      notes: 'Khách cọc 50k',
      calculation: {
        weightGrams: 120,
        timeFormatted: '4 giờ 30 phút',
        timeHours: 4.5,
        costFilament: 26400,
        costElectricity: 4500,
        costDepreciation: 15750,
        costLabor: 12500,
        costFailRisk: 2950,
        costAccessories: 35000,
        accessoriesDetail: 'Dây LED USB 5V',
        totalBaseCost: 97100,
        priceWholesale: 145000,
        priceRetail: 215000,
        netProfitRetail: 117900,
        profitMarginRetailPercent: 54.8,
        gcode: {
          printerModel: 'SparkX i7',
          materialType: 'PETG',
          layerCount: 450,
          printProcess: { summaryText: '220°C / 70°C' }
        }
      }
    }
  ];

  const config = {
    filamentCostPerKg: 220000,
    machinePowerWatt: 380,
    electricityPricePerKwh: 2600
  };

  const wb = ExcelDatabase.buildWorkbook(sampleOrders, config);
  assert.ok(wb.SheetNames.includes('QuanLyDonHangIn3D'));
  assert.ok(wb.SheetNames.includes('CauHinhChiPhi'));

  // Test reading back the workbook data
  const ws = wb.Sheets['QuanLyDonHangIn3D'];
  const rows = XLSX.utils.sheet_to_json(ws);
  assert.strictEqual(rows.length, 2); // 1 order row + 1 total row
  assert.strictEqual(rows[0]['Mã Đơn Hàng'], 'ORD-TEST-1');
  assert.strictEqual(rows[0]['Tên File G-Code'], 'dragon_sparkx_i7.gcode');
  assert.strictEqual(rows[0]['GIÁ VỐN TOÀN DIỆN (đ)'], 97100);
  assert.strictEqual(rows[0]['GIÁ BÁN LẺ (đ)'], 215000);
});

test('ExcelDatabase reads orders correctly from buffer', async () => {
  const sampleOrders = [
    {
      id: 'ORD-READ-99',
      createdAt: '2026-10-30T10:00:00.000Z',
      filename: 'lightbox_batman.gcode',
      status: 'Đang in',
      notes: 'Giao thứ 7',
      calculation: {
        weightGrams: 80,
        timeFormatted: '2 giờ 45 phút',
        timeHours: 2.75,
        costFilament: 17600,
        costElectricity: 2700,
        costDepreciation: 9625,
        costLabor: 12500,
        costFailRisk: 2120,
        costAccessories: 50000,
        accessoriesDetail: 'Bộ LED RGB + Nguồn 12V',
        totalBaseCost: 94545,
        priceWholesale: 130000,
        priceRetail: 195000,
        netProfitRetail: 100455,
        profitMarginRetailPercent: 51.5,
        gcode: {
          printerModel: 'SparkX i7',
          materialType: 'PLA',
          layerCount: 280,
          printProcess: { summaryText: '205°C / 60°C' }
        }
      }
    }
  ];

  const wb = ExcelDatabase.buildWorkbook(sampleOrders, {});
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

  // Mock blob with arrayBuffer
  const mockBlob = {
    arrayBuffer: async () => buffer
  };

  const parsed = await ExcelDatabase.readOrdersFromBlob(mockBlob);
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].id, 'ORD-READ-99');
  assert.strictEqual(parsed[0].filename, 'lightbox_batman.gcode');
  assert.strictEqual(parsed[0].status, 'Đang in');
  assert.strictEqual(parsed[0].calculation.weightGrams, 80);
  assert.strictEqual(parsed[0].calculation.totalBaseCost, 94545);
  assert.strictEqual(parsed[0].calculation.costAccessories, 50000);
});
