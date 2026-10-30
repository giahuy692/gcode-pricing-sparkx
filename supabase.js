/**
 * Supabase Cloud Database Client Module for G-Code CostMaster 3D
 * Quản lý kết nối Cơ sở dữ liệu Cloud thực thụ (PostgreSQL), lưu trữ vĩnh viễn, truy cập mọi nơi.
 */

const SupabaseDB = {
  STORAGE_URL_KEY: 'gcode_costmaster_supabase_url',
  STORAGE_KEY_KEY: 'gcode_costmaster_supabase_anon_key',
  
  client: null,

  /**
   * Lấy cấu hình Supabase từ LocalStorage
   */
  getConfig() {
    try {
      const url = localStorage.getItem(this.STORAGE_URL_KEY) || '';
      const anonKey = localStorage.getItem(this.STORAGE_KEY_KEY) || '';
      return { url: url.trim(), anonKey: anonKey.trim() };
    } catch (e) {
      return { url: '', anonKey: '' };
    }
  },

  /**
   * Lưu cấu hình Supabase
   */
  setConfig(url, anonKey) {
    try {
      localStorage.setItem(this.STORAGE_URL_KEY, (url || '').trim());
      localStorage.setItem(this.STORAGE_KEY_KEY, (anonKey || '').trim());
      this.client = null; // Reset client để khởi tạo lại
    } catch (e) {}
  },

  /**
   * Kiểm tra xem Supabase đã được cấu hình hay chưa
   */
  isConfigured() {
    const { url, anonKey } = this.getConfig();
    return !!(url && anonKey);
  },

  /**
   * Khởi tạo hoặc lấy Supabase Client
   */
  getClient() {
    if (this.client) return this.client;
    const { url, anonKey } = this.getConfig();
    if (!url || !anonKey) return null;

    if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
      this.client = window.supabase.createClient(url, anonKey);
      return this.client;
    }
    return null;
  },

  /**
   * Kiểm tra kết nối đến Supabase Database
   */
  async testConnection(testUrl, testAnonKey) {
    const url = testUrl || this.getConfig().url;
    const anonKey = testAnonKey || this.getConfig().anonKey;

    if (!url || !anonKey) {
      throw new Error('Chưa nhập đủ Project URL và Anon Key của Supabase!');
    }

    try {
      let client;
      if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
        client = window.supabase.createClient(url, anonKey);
      } else {
        throw new Error('Thư viện Supabase JS chưa được tải!');
      }

      // Thử đọc 1 dòng từ bảng orders_3d_print
      const { data, error } = await client
        .from('orders_3d_print')
        .select('id')
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Đã kết nối Supabase thành công nhưng CHƯA TẠO BẢNG "orders_3d_print"! Hãy copy file supabase_schema.sql và chạy trong mục SQL Editor của Supabase.');
        }
        throw new Error('Lỗi từ Supabase: ' + error.message);
      }

      return { success: true, message: 'Kết nối Cơ sở dữ liệu Cloud Supabase thành công!' };
    } catch (err) {
      throw err;
    }
  },

  /**
   * Lấy danh sách toàn bộ đơn hàng từ Database Cloud
   */
  async fetchOrders() {
    const client = this.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('orders_3d_print')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(row => this.mapRowToOrder(row));
    } catch (err) {
      console.error('Lỗi khi tải đơn hàng từ Supabase:', err);
      throw err;
    }
  },

  /**
   * Lưu hoặc cập nhật 1 đơn hàng vào Database Cloud
   */
  async insertOrder(orderItem) {
    const client = this.getClient();
    if (!client) return false;

    const row = this.mapOrderToRow(orderItem);

    try {
      const { error } = await client
        .from('orders_3d_print')
        .upsert(row, { onConflict: 'id' });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Lỗi khi lưu đơn hàng lên Supabase:', err);
      throw err;
    }
  },

  /**
   * Cập nhật trạng thái đơn hàng (Đã tính giá / Đang in / Hoàn thành / Đã giao)
   */
  async updateStatus(orderId, newStatus) {
    const client = this.getClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from('orders_3d_print')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Lỗi khi cập nhật trạng thái đơn:', err);
      throw err;
    }
  },

  /**
   * Xóa 1 đơn hàng khỏi Database Cloud
   */
  async deleteOrder(orderId) {
    const client = this.getClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from('orders_3d_print')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Lỗi khi xóa đơn khỏi Supabase:', err);
      throw err;
    }
  },

  /**
   * Xóa toàn bộ lịch sử đơn hàng
   */
  async clearAllOrders() {
    const client = this.getClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from('orders_3d_print')
        .delete()
        .neq('id', 'EMPTY_ROW_SENTINEL'); // Xóa tất cả

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Lỗi khi xóa toàn bộ đơn:', err);
      throw err;
    }
  },

  /**
   * Chuyển đổi từ dữ liệu Order sang dòng SQL Table Row
   */
  mapOrderToRow(order) {
    const calc = order.calculation || {};
    const gcode = calc.gcode || {};

    return {
      id: order.id || ('ORD-' + Date.now().toString(36).toUpperCase()),
      created_at: order.createdAt || new Date().toISOString(),
      filename: order.filename || gcode.filename || 'Chưa đặt tên',
      printer_model: gcode.printerModel || 'SparkX i7',
      material_type: gcode.materialType || 'PLA',
      time_formatted: calc.timeFormatted || '',
      time_hours: parseFloat(calc.timeHours) || 0,
      weight_grams: parseFloat(calc.weightGrams) || 0,
      layer_count: parseInt(gcode.layerCount) || 0,
      cost_filament: parseFloat(calc.costFilament) || 0,
      cost_electricity: parseFloat(calc.costElectricity) || 0,
      cost_depreciation: parseFloat(calc.costDepreciation) || 0,
      cost_labor: parseFloat(calc.costLabor) || 0,
      cost_fail_risk: parseFloat(calc.costFailRisk) || 0,
      cost_accessories: parseFloat(calc.costAccessories) || 0,
      accessories_detail: calc.accessoriesDetail || '',
      accessories_json: order.accessories || [],
      total_base_cost: parseFloat(calc.totalBaseCost) || 0,
      price_wholesale: parseFloat(calc.priceWholesale) || 0,
      price_retail: parseFloat(calc.priceRetail) || 0,
      net_profit_retail: parseFloat(calc.netProfitRetail) || 0,
      profit_margin_retail_percent: parseFloat(calc.profitMarginRetailPercent) || 0,
      status: order.status || 'Đã tính giá',
      print_process: (gcode.printProcess && gcode.printProcess.summaryText) || '',
      notes: order.notes || ''
    };
  },

  /**
   * Chuyển đổi từ dòng SQL Table Row sang đối tượng Order cho UI
   */
  mapRowToOrder(row) {
    return {
      id: row.id,
      createdAt: row.created_at,
      filename: row.filename,
      status: row.status,
      notes: row.notes,
      accessories: row.accessories_json || [],
      calculation: {
        weightGrams: parseFloat(row.weight_grams) || 0,
        timeFormatted: row.time_formatted || '',
        timeHours: parseFloat(row.time_hours) || 0,
        costFilament: parseFloat(row.cost_filament) || 0,
        costElectricity: parseFloat(row.cost_electricity) || 0,
        costDepreciation: parseFloat(row.cost_depreciation) || 0,
        costLabor: parseFloat(row.cost_labor) || 0,
        costFailRisk: parseFloat(row.cost_fail_risk) || 0,
        costAccessories: parseFloat(row.cost_accessories) || 0,
        accessoriesDetail: row.accessories_detail || '',
        totalBaseCost: parseFloat(row.total_base_cost) || 0,
        priceWholesale: parseFloat(row.price_wholesale) || 0,
        priceRetail: parseFloat(row.price_retail) || 0,
        netProfitRetail: parseFloat(row.net_profit_retail) || 0,
        profitMarginRetailPercent: parseFloat(row.profit_margin_retail_percent) || 0,
        gcode: {
          filename: row.filename,
          printerModel: row.printer_model,
          materialType: row.material_type,
          layerCount: row.layer_count,
          printProcess: { summaryText: row.print_process }
        }
      }
    };
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SupabaseDB;
}
