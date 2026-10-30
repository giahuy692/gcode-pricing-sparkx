/**
 * G-Code Parser Engine for 3D Printing CostMaster
 * Hỗ trợ các Slicer: UltiMaker Cura, Creality Print, Bambu Studio, OrcaSlicer, PrusaSlicer, Simplify3D
 */

const GCodeParser = {
  // Bảng khối lượng riêng (g/cm³) của các loại nhựa phổ biến
  FILAMENT_DENSITY: {
    'PLA': 1.24,
    'PLA+': 1.24,
    'PETG': 1.27,
    'ABS': 1.04,
    'ASA': 1.07,
    'TPU': 1.21,
    'PC': 1.20,
    'NYLON': 1.14,
    'RESIN': 1.15
  },

  // Đường kính sợi nhựa tiêu chuẩn (1.75mm)
  DEFAULT_DIAMETER: 1.75,

  /**
   * Tính khối lượng nhựa từ chiều dài (mét)
   * V = L * pi * (d/2)^2
   * m = V * density
   */
  metersToGrams(meters, materialType = 'PLA', diameter = 1.75) {
    if (!meters || meters <= 0) return 0;
    const density = this.FILAMENT_DENSITY[materialType.toUpperCase()] || 1.24;
    const radiusMm = diameter / 2;
    const crossSectionAreaMm2 = Math.PI * radiusMm * radiusMm;
    const volumeMm3 = meters * 1000 * crossSectionAreaMm2;
    const volumeCm3 = volumeMm3 / 1000;
    return volumeCm3 * density;
  },

  /**
   * Tính chiều dài (mét) từ khối lượng (grams)
   */
  gramsToMeters(grams, materialType = 'PLA', diameter = 1.75) {
    if (!grams || grams <= 0) return 0;
    const density = this.FILAMENT_DENSITY[materialType.toUpperCase()] || 1.24;
    const volumeCm3 = grams / density;
    const volumeMm3 = volumeCm3 * 1000;
    const radiusMm = diameter / 2;
    const crossSectionAreaMm2 = Math.PI * radiusMm * radiusMm;
    return (volumeMm3 / crossSectionAreaMm2) / 1000;
  },

  /**
   * Chuyển đổi chuỗi thời gian như "2h 35m 14s", "14580", "1d 2h 30m" sang giây
   */
  parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    timeStr = String(timeStr).trim();

    // Nếu là số thuần túy (giây, ví dụ Cura ;TIME:14580)
    if (/^\d+(\.\d+)?$/.test(timeStr)) {
      return Math.round(parseFloat(timeStr));
    }

    let totalSeconds = 0;
    const daysMatch = timeStr.match(/(\d+)\s*d/i);
    const hoursMatch = timeStr.match(/(\d+)\s*h/i);
    const minsMatch = timeStr.match(/(\d+)\s*m(?:in)?/i);
    const secsMatch = timeStr.match(/(\d+)\s*s/i);

    if (daysMatch) totalSeconds += parseInt(daysMatch[1], 10) * 86400;
    if (hoursMatch) totalSeconds += parseInt(hoursMatch[1], 10) * 3600;
    if (minsMatch) totalSeconds += parseInt(minsMatch[1], 10) * 60;
    if (secsMatch) totalSeconds += parseInt(secsMatch[1], 10);

    // Dạng HH:MM:SS
    if (totalSeconds === 0 && timeStr.includes(':')) {
      const parts = timeStr.split(':').map(p => parseFloat(p) || 0);
      if (parts.length === 3) {
        totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        totalSeconds = parts[0] * 60 + parts[1];
      }
    }

    return Math.round(totalSeconds);
  },

  /**
   * Định dạng giây sang chuỗi "X giờ Y phút"
   */
  formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0 phút';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    let res = '';
    if (hrs > 0) res += `${hrs} giờ `;
    if (mins > 0 || hrs > 0) res += `${mins} phút`;
    if (hrs === 0 && mins === 0) res += `${secs} giây`;
    return res.trim();
  },

  /**
   * Phân tích nội dung file G-code
   * @param {string} content - Nội dung text của file G-code
   * @param {string} filename - Tên file gốc
   * @returns {Object} Kết quả trích xuất thông tin
   */
  parse(content, filename = 'model.gcode') {
    const result = {
      filename: filename,
      slicer: 'Tự động phát hiện',
      materialType: 'PLA',
      filamentDiameter: 1.75,
      timeSeconds: 0,
      timeFormatted: '0 phút',
      timeHours: 0,
      filamentLengthMeters: 0,
      filamentWeightGrams: 0,
      layerCount: 0,
      layerHeight: 0.2,
      printerModel: 'SparkX i7',
      dimensions: { x: null, y: null, z: null },
      parseMethod: 'metadata' // 'metadata' | 'stream_fallback'
    };

    if (!content || typeof content !== 'string') {
      return result;
    }

    // Đọc 2000 dòng đầu và 1000 dòng cuối (nơi chứa hầu hết metadata của Cura/Creality/Prusa/Bambu)
    const lines = content.split(/\r?\n/);
    const headerLines = lines.slice(0, 3000);
    const footerLines = lines.length > 4000 ? lines.slice(-1500) : [];
    const sampleLines = [...headerLines, ...footerLines];

    let detectedTimeSec = 0;
    let detectedMeters = 0;
    let detectedGrams = 0;
    let detectedLayers = 0;
    let detectedLayerHeight = 0;
    let detectedMaterial = '';
    let detectedPrinter = '';

    // Khởi tạo bộ lưu trữ thông số quy trình in (Print Process Settings)
    const printProcess = {
      nozzleTemp: null,
      bedTemp: null,
      infillPercent: null,
      infillPattern: null,
      printSpeed: null,
      wallSpeed: null,
      retractDistance: null,
      retractSpeed: null,
      wallCount: null,
      wallThickness: null,
      supportEnabled: null,
      supportType: null,
      fanSpeedPercent: null,
      initialLayerHeight: null
    };

    for (const line of sampleLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Quét cả lệnh M104/M109/M140/M190 trong G-code
      if (printProcess.nozzleTemp === null) {
        if (/^M10[49]\s+S(\d+)/i.test(trimmed)) {
          const t = parseInt(trimmed.match(/^M10[49]\s+S(\d+)/i)[1], 10);
          if (t > 150) printProcess.nozzleTemp = t;
        }
      }
      if (printProcess.bedTemp === null) {
        if (/^M1[49]0\s+S(\d+)/i.test(trimmed)) {
          const b = parseInt(trimmed.match(/^M1[49]0\s+S(\d+)/i)[1], 10);
          if (b >= 30) printProcess.bedTemp = b;
        }
      }

      if (!trimmed.startsWith(';')) continue;

      // 1. Nhận diện Slicer
      if (/Cura_SteamEngine/i.test(trimmed)) {
        result.slicer = 'UltiMaker Cura ' + (trimmed.match(/Cura_SteamEngine\s*([\d\.]+)/i)?.[1] || '');
      } else if (/Creality\s*Print/i.test(trimmed)) {
        result.slicer = 'Creality Print ' + (trimmed.match(/Creality\s*Print\s*([\d\.]+)/i)?.[1] || '');
      } else if (/BambuStudio/i.test(trimmed)) {
        result.slicer = 'Bambu Studio';
      } else if (/OrcaSlicer/i.test(trimmed)) {
        result.slicer = 'OrcaSlicer';
      } else if (/PrusaSlicer/i.test(trimmed)) {
        result.slicer = 'PrusaSlicer';
      }

      // 2. Nhận diện Tên máy in (Ưu tiên SparkX i7)
      if (/SparkX\s*i?7?/i.test(trimmed)) {
        detectedPrinter = 'SparkX i7';
      } else if (/TARGET_MACHINE\.NAME:\s*(.+)/i.test(trimmed)) {
        detectedPrinter = trimmed.match(/TARGET_MACHINE\.NAME:\s*(.+)/i)[1].trim();
      } else if (/printer_model\s*=\s*(.+)/i.test(trimmed)) {
        detectedPrinter = trimmed.match(/printer_model\s*=\s*(.+)/i)[1].trim();
      } else if (/printer_model:\s*(.+)/i.test(trimmed)) {
        detectedPrinter = trimmed.match(/printer_model:\s*(.+)/i)[1].trim();
      }

      // 3. Nhận diện Thời gian in
      if (/^;TIME:(\d+(\.\d+)?)/i.test(trimmed) && detectedTimeSec === 0) {
        detectedTimeSec = Math.round(parseFloat(trimmed.match(/^;TIME:(\d+(\.\d+)?)/i)[1]));
      } else if (/estimated printing time/i.test(trimmed) && detectedTimeSec === 0) {
        const match = trimmed.match(/estimated printing time[^:=]*[:=]\s*(.+)/i);
        if (match) detectedTimeSec = this.parseTimeToSeconds(match[1]);
      } else if (/estimated printing time \(normal mode\)\s*=\s*(.+)/i.test(trimmed) && detectedTimeSec === 0) {
        detectedTimeSec = this.parseTimeToSeconds(trimmed.match(/estimated printing time \(normal mode\)\s*=\s*(.+)/i)[1]);
      } else if (/^;TIME_ELAPSED:(\d+)/i.test(trimmed) && detectedTimeSec === 0) {
        detectedTimeSec = parseInt(trimmed.match(/^;TIME_ELAPSED:(\d+)/i)[1], 10);
      }

      // 4. Nhựa tiêu thụ (Filament used)
      if (/^;Filament used:\s*([\d\.]+)m/i.test(trimmed) && detectedMeters === 0) {
        detectedMeters = parseFloat(trimmed.match(/^;Filament used:\s*([\d\.]+)m/i)[1]);
      } else if (/^;Filament used:\s*([\d\.]+)g/i.test(trimmed) && detectedGrams === 0) {
        detectedGrams = parseFloat(trimmed.match(/^;Filament used:\s*([\d\.]+)g/i)[1]);
      } else if (/total filament used\s*[:=]\s*([\d\.]+)g/i.test(trimmed) && detectedGrams === 0) {
        detectedGrams = parseFloat(trimmed.match(/total filament used\s*[:=]\s*([\d\.]+)g/i)[1]);
      } else if (/filament used \[m\]\s*=\s*([\d\.]+)/i.test(trimmed) && detectedMeters === 0) {
        detectedMeters = parseFloat(trimmed.match(/filament used \[m\]\s*=\s*([\d\.]+)/i)[1]);
      } else if (/total filament used \[g\]\s*=\s*([\d\.]+)/i.test(trimmed) && detectedGrams === 0) {
        detectedGrams = parseFloat(trimmed.match(/total filament used \[g\]\s*=\s*([\d\.]+)/i)[1]);
      } else if (/total filament used \[mm\]\s*=\s*([\d\.]+)/i.test(trimmed) && detectedMeters === 0) {
        detectedMeters = parseFloat(trimmed.match(/total filament used \[mm\]\s*=\s*([\d\.]+)/i)[1]) / 1000;
      }

      // 5. Số lớp (Layer count) & Chiều cao lớp
      if (/^;LAYER_COUNT:(\d+)/i.test(trimmed)) {
        detectedLayers = parseInt(trimmed.match(/^;LAYER_COUNT:(\d+)/i)[1], 10);
      } else if (/total_layers\s*[:=]\s*(\d+)/i.test(trimmed)) {
        detectedLayers = parseInt(trimmed.match(/total_layers\s*[:=]\s*(\d+)/i)[1], 10);
      }
      if (/layer_height\s*[:=]\s*([\d\.]+)/i.test(trimmed)) {
        detectedLayerHeight = parseFloat(trimmed.match(/layer_height\s*[:=]\s*([\d\.]+)/i)[1]);
      }
      if (/initial_layer_print_height\s*[:=]\s*([\d\.]+)/i.test(trimmed)) {
        printProcess.initialLayerHeight = parseFloat(trimmed.match(/initial_layer_print_height\s*[:=]\s*([\d\.]+)/i)[1]);
      }

      // 6. Loại nhựa
      if (/filament_type\s*[:=]\s*([a-zA-Z0-9\+\-]+)/i.test(trimmed)) {
        detectedMaterial = trimmed.match(/filament_type\s*[:=]\s*([a-zA-Z0-9\+\-]+)/i)[1].toUpperCase();
      } else if (/material_type\s*[:=]\s*([a-zA-Z0-9\+\-]+)/i.test(trimmed)) {
        detectedMaterial = trimmed.match(/material_type\s*[:=]\s*([a-zA-Z0-9\+\-]+)/i)[1].toUpperCase();
      }

      // 7. Cài đặt Quy trình in (Print Process Settings chi tiết của Creality/Cura/Bambu)
      if (printProcess.nozzleTemp === null) {
        if (/printing_temperature\s*[:=]\s*(\d+)/i.test(trimmed)) {
          printProcess.nozzleTemp = parseInt(trimmed.match(/printing_temperature\s*[:=]\s*(\d+)/i)[1], 10);
        } else if (/nozzle_temperature\s*[:=]\s*(\d+)/i.test(trimmed)) {
          printProcess.nozzleTemp = parseInt(trimmed.match(/nozzle_temperature\s*[:=]\s*(\d+)/i)[1], 10);
        }
      }
      if (printProcess.bedTemp === null && /bed_temperature\s*[:=]\s*(\d+)/i.test(trimmed)) {
        printProcess.bedTemp = parseInt(trimmed.match(/bed_temperature\s*[:=]\s*(\d+)/i)[1], 10);
      }

      // Infill
      if (printProcess.infillPercent === null) {
        if (/infill_sparse_density\s*[:=]\s*([\d\.]+)/i.test(trimmed)) {
          printProcess.infillPercent = parseFloat(trimmed.match(/infill_sparse_density\s*[:=]\s*([\d\.]+)/i)[1]);
        } else if (/infill_density\s*[:=]\s*([\d\.]+)/i.test(trimmed)) {
          printProcess.infillPercent = parseFloat(trimmed.match(/infill_density\s*[:=]\s*([\d\.]+)/i)[1]);
        }
      }
      if (!printProcess.infillPattern && /infill_pattern\s*[:=]\s*([a-zA-Z0-9_\-]+)/i.test(trimmed)) {
        printProcess.infillPattern = trimmed.match(/infill_pattern\s*[:=]\s*([a-zA-Z0-9_\-]+)/i)[1];
      }

      // Tốc độ in (Speed)
      if (printProcess.printSpeed === null) {
        if (/speed_print\s*[:=]\s*([\d\.]+)/i.test(trimmed)) {
          printProcess.printSpeed = parseFloat(trimmed.match(/speed_print\s*[:=]\s*([\d\.]+)/i)[1]);
        } else if (/print_speed\s*[:=]\s*([\d\.]+)/i.test(trimmed)) {
          printProcess.printSpeed = parseFloat(trimmed.match(/print_speed\s*[:=]\s*([\d\.]+)/i)[1]);
        }
      }
      if (printProcess.wallSpeed === null && /speed_wall\s*[:=]\s*([\d\.]+)/i.test(trimmed)) {
        printProcess.wallSpeed = parseFloat(trimmed.match(/speed_wall\s*[:=]\s*([\d\.]+)/i)[1]);
      }

      // Retraction
      if (printProcess.retractDistance === null) {
        if (/retraction_amount\s*[:=]\s*([\d\.]+)/i.test(trimmed)) {
          printProcess.retractDistance = parseFloat(trimmed.match(/retraction_amount\s*[:=]\s*([\d\.]+)/i)[1]);
        } else if (/retract_length\s*[:=]\s*([\d\.]+)/i.test(trimmed)) {
          printProcess.retractDistance = parseFloat(trimmed.match(/retract_length\s*[:=]\s*([\d\.]+)/i)[1]);
        }
      }
      if (printProcess.retractSpeed === null && /retraction_speed\s*[:=]\s*([\d\.]+)/i.test(trimmed)) {
        printProcess.retractSpeed = parseFloat(trimmed.match(/retraction_speed\s*[:=]\s*([\d\.]+)/i)[1]);
      }

      // Wall & Support
      if (printProcess.wallCount === null && /wall_line_count\s*[:=]\s*(\d+)/i.test(trimmed)) {
        printProcess.wallCount = parseInt(trimmed.match(/wall_line_count\s*[:=]\s*(\d+)/i)[1], 10);
      }
      if (printProcess.wallThickness === null && /wall_thickness\s*[:=]\s*([\d\.]+)/i.test(trimmed)) {
        printProcess.wallThickness = parseFloat(trimmed.match(/wall_thickness\s*[:=]\s*([\d\.]+)/i)[1]);
      }
      if (printProcess.supportEnabled === null && /support_enable\s*[:=]\s*([a-zA-Z]+)/i.test(trimmed)) {
        printProcess.supportEnabled = /true|1|yes/i.test(trimmed.match(/support_enable\s*[:=]\s*([a-zA-Z]+)/i)[1]);
      }
      if (!printProcess.supportType && /support_type\s*[:=]\s*([a-zA-Z0-9_\-]+)/i.test(trimmed)) {
        printProcess.supportType = trimmed.match(/support_type\s*[:=]\s*([a-zA-Z0-9_\-]+)/i)[1];
      }
      if (printProcess.fanSpeedPercent === null && /fan_speed\s*[:=]\s*(\d+)/i.test(trimmed)) {
        printProcess.fanSpeedPercent = parseInt(trimmed.match(/fan_speed\s*[:=]\s*(\d+)/i)[1], 10);
      }
    }

    // Nếu không tìm thấy trong metadata, quét fallback qua các dòng G-code
    if (detectedTimeSec === 0 || (detectedMeters === 0 && detectedGrams === 0)) {
      const fallback = this.streamFallback(lines);
      if (detectedTimeSec === 0) detectedTimeSec = fallback.timeSeconds;
      if (detectedMeters === 0 && detectedGrams === 0) detectedMeters = fallback.meters;
      if (detectedLayers === 0) detectedLayers = fallback.layers;
      result.parseMethod = 'stream_fallback';
    }

    // Cập nhật kết quả
    if (detectedMaterial && this.FILAMENT_DENSITY[detectedMaterial]) {
      result.materialType = detectedMaterial;
    }
    if (detectedPrinter) {
      result.printerModel = detectedPrinter;
    }

    result.timeSeconds = detectedTimeSec;
    result.timeFormatted = this.formatTime(detectedTimeSec);
    result.timeHours = Number((detectedTimeSec / 3600).toFixed(2));

    // Tính toán cân bằng giữa mét và gram
    if (detectedGrams > 0 && detectedMeters === 0) {
      result.filamentWeightGrams = Number(detectedGrams.toFixed(1));
      result.filamentLengthMeters = Number(this.gramsToMeters(detectedGrams, result.materialType).toFixed(2));
    } else if (detectedMeters > 0) {
      result.filamentLengthMeters = Number(detectedMeters.toFixed(2));
      result.filamentWeightGrams = Number((detectedGrams > 0 ? detectedGrams : this.metersToGrams(detectedMeters, result.materialType)).toFixed(1));
    } else {
      result.filamentLengthMeters = 0;
      result.filamentWeightGrams = 0;
    }

    result.layerCount = detectedLayers;
    result.layerHeight = detectedLayerHeight || 0.2;

    // Chuẩn hóa cài đặt quy trình in
    const nozzleStr = printProcess.nozzleTemp ? `${printProcess.nozzleTemp}°C` : '205°C-215°C';
    const bedStr = printProcess.bedTemp ? `${printProcess.bedTemp}°C` : '60°C';
    const infillStr = printProcess.infillPercent !== null ? `${printProcess.infillPercent}%` : '20%';
    const patternStr = printProcess.infillPattern ? ` (${printProcess.infillPattern})` : '';
    const speedStr = printProcess.printSpeed ? `${printProcess.printSpeed} mm/s` : '60-80 mm/s';
    const retractStr = printProcess.retractDistance ? `${printProcess.retractDistance}mm @ ${printProcess.retractSpeed || 40}mm/s` : '1.0mm @ 40mm/s';

    printProcess.summaryText = `${nozzleStr} / ${bedStr} | Infill: ${infillStr}${patternStr} | Tốc độ: ${speedStr} | Rút: ${retractStr}`;

    result.printProcess = printProcess;
    return result;
  },

  /**
   * Tạo nội dung file cấu hình dự phòng (.ini / .txt) để nạp lại vào Slicer bất kỳ lúc nào
   */
  generateProfileBackupText(parsedData) {
    const p = parsedData.printProcess || {};
    return `; ====================================================================
; BẢN SAO LƯU CẤU HÌNH IN (PRINT PROCESS PROFILE BACKUP)
; Tạo tự động bởi: G-Code CostMaster 3D cho máy ${parsedData.printerModel || 'SparkX i7'}
; Thời gian xuất: ${new Date().toLocaleString('vi-VN')}
; File gốc: ${parsedData.filename}
; Slicer: ${parsedData.slicer}
; ====================================================================

[Machine_Info]
printer_model = ${parsedData.printerModel || 'SparkX i7'}
filament_type = ${parsedData.materialType || 'PLA'}
filament_diameter = ${parsedData.filamentDiameter || 1.75} mm

[Layer_And_Quality]
layer_height = ${parsedData.layerHeight || 0.20} mm
initial_layer_height = ${p.initialLayerHeight || 0.24} mm
total_layers = ${parsedData.layerCount || 0}
wall_line_count = ${p.wallCount || 2}
wall_thickness = ${p.wallThickness || 0.8} mm

[Temperatures]
printing_temperature = ${p.nozzleTemp || 210} °C
bed_temperature = ${p.bedTemp || 60} °C

[Infill_Settings]
infill_density = ${p.infillPercent !== null ? p.infillPercent : 20} %
infill_pattern = ${p.infillPattern || 'gyroid'}

[Speed_Settings]
print_speed = ${p.printSpeed || 70} mm/s
wall_speed = ${p.wallSpeed || 35} mm/s

[Retraction]
retraction_distance = ${p.retractDistance || 1.0} mm
retraction_speed = ${p.retractSpeed || 45} mm/s

[Cooling_And_Support]
fan_speed = ${p.fanSpeedPercent || 100} %
support_enabled = ${p.supportEnabled ? 'True' : 'False'}
support_type = ${p.supportType || 'Tree'}

[Estimates]
total_print_time = ${parsedData.timeFormatted} (${parsedData.timeHours} giờ)
filament_weight = ${parsedData.filamentWeightGrams} g
filament_length = ${parsedData.filamentLengthMeters} m
; ====================================================================
; Lưu ý: Dùng các thông số này để điền lại vào Creality Print / Cura 
; khi phần mềm cập nhật làm mất cài đặt của máy SparkX i7.
; ====================================================================`;
  },

  /**
   * Quét cơ bản theo lệnh G1 E... và feedrate F nếu file không chứa comment metadata
   */
  streamFallback(lines) {
    let maxE = 0;
    let currentE = 0;
    let isRelativeE = false;
    let layerCount = 0;
    let totalDistanceMm = 0;
    let currentX = 0, currentY = 0, currentZ = 0;
    let currentFeedrate = 3000; // mm/min mặc định

    // Giới hạn duyệt tối đa 100,000 dòng để tránh chậm trình duyệt
    const maxScanLines = Math.min(lines.length, 120000);

    for (let i = 0; i < maxScanLines; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith(';')) {
        if (line.startsWith(';LAYER:')) layerCount++;
        continue;
      }

      if (line === 'M83') isRelativeE = true;
      if (line === 'M82') isRelativeE = false;
      if (line.startsWith('G92') && line.includes('E0')) {
        currentE = 0;
      }

      if (line.startsWith('G1') || line.startsWith('G0')) {
        // Feedrate
        const fMatch = line.match(/F([\d\.]+)/);
        if (fMatch) currentFeedrate = parseFloat(fMatch[1]) || 3000;

        // Extrusion
        const eMatch = line.match(/E([\d\.\-]+)/);
        if (eMatch) {
          const eVal = parseFloat(eMatch[1]);
          if (isRelativeE) {
            if (eVal > 0) maxE += eVal;
          } else {
            if (eVal > currentE) {
              maxE += (eVal - currentE);
              currentE = eVal;
            }
          }
        }

        // Ước lượng quãng đường di chuyển
        const xMatch = line.match(/X([\d\.\-]+)/);
        const yMatch = line.match(/Y([\d\.\-]+)/);
        const zMatch = line.match(/Z([\d\.\-]+)/);
        const newX = xMatch ? parseFloat(xMatch[1]) : currentX;
        const newY = yMatch ? parseFloat(yMatch[1]) : currentY;
        const newZ = zMatch ? parseFloat(zMatch[1]) : currentZ;

        const dx = newX - currentX;
        const dy = newY - currentY;
        const dz = newZ - currentZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        totalDistanceMm += dist;

        currentX = newX;
        currentY = newY;
        currentZ = newZ;
      }
    }

    // Thời gian ước tính sơ bộ từ vận tốc trung bình (60mm/s ~ 3600 mm/min)
    const estimatedMinutes = (totalDistanceMm / 3000) * 1.35; // Hệ số gia tốc
    const timeSeconds = Math.round(estimatedMinutes * 60);
    const meters = Number((maxE / 1000).toFixed(2));

    return {
      timeSeconds: timeSeconds > 0 ? timeSeconds : 3600,
      meters: meters > 0 ? meters : 10,
      layers: layerCount > 0 ? layerCount : 150
    };
  }
};

// Export cho môi trường web hoặc node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GCodeParser;
}
