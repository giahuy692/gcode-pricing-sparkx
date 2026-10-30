-- ========================================================
-- CƠ SỞ DỮ LIỆU SUPABASE CHO G-CODE COSTMASTER 3D (SPARKX i7)
-- ========================================================
-- Hướng dẫn:
-- 1. Đăng nhập vào https://supabase.com (Miễn phí)
-- 2. Tạo một Project mới (ví dụ đặt tên: "costmaster-3d")
-- 3. Vào mục "SQL Editor" ở thanh menu bên trái
-- 4. Dán toàn bộ đoạn mã SQL này vào và bấm "Run"
-- ========================================================

-- Tạo bảng quản lý đơn hàng in 3D
create table if not exists public.orders_3d_print (
    id text primary key,
    created_at timestamptz default now(),
    filename text not null,
    printer_model text default 'SparkX i7',
    material_type text default 'PLA',
    time_formatted text,
    time_hours numeric default 0,
    weight_grams numeric default 0,
    layer_count integer default 0,
    cost_filament numeric default 0,
    cost_electricity numeric default 0,
    cost_depreciation numeric default 0,
    cost_labor numeric default 0,
    cost_fail_risk numeric default 0,
    cost_accessories numeric default 0,
    accessories_detail text default '',
    accessories_json jsonb default '[]'::jsonb,
    total_base_cost numeric default 0,
    price_wholesale numeric default 0,
    price_retail numeric default 0,
    net_profit_retail numeric default 0,
    profit_margin_retail_percent numeric default 0,
    status text default 'Đã tính giá',
    print_process text default '',
    notes text default ''
);

-- Kích hoạt Row Level Security (RLS) để bảo mật
alter table public.orders_3d_print enable row level security;

-- Tạo chính sách cho phép ứng dụng đọc và ghi dữ liệu công khai thông qua Anon Key
drop policy if exists "Cho phép đọc đơn hàng" on public.orders_3d_print;
create policy "Cho phép đọc đơn hàng" 
on public.orders_3d_print for select 
using (true);

drop policy if exists "Cho phép thêm đơn hàng" on public.orders_3d_print;
create policy "Cho phép thêm đơn hàng" 
on public.orders_3d_print for insert 
with check (true);

drop policy if exists "Cho phép cập nhật đơn hàng" on public.orders_3d_print;
create policy "Cho phép cập nhật đơn hàng" 
on public.orders_3d_print for update 
using (true);

drop policy if exists "Cho phép xóa đơn hàng" on public.orders_3d_print;
create policy "Cho phép xóa đơn hàng" 
on public.orders_3d_print for delete 
using (true);

-- Tạo chỉ mục (Index) tăng tốc độ tìm kiếm
create index if not exists idx_orders_created_at on public.orders_3d_print (created_at desc);
create index if not exists idx_orders_filename on public.orders_3d_print (filename);
create index if not exists idx_orders_status on public.orders_3d_print (status);
