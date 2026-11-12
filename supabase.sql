-- MOCHI & ONIGIRI: skema database Supabase PostgreSQL
-- Jalankan seluruh file ini melalui Supabase Dashboard > SQL Editor > New query.
-- Harga dalam rupiah (integer). Jangan pernah taruh service_role key di frontend.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null check (category in ('Mochi','Onigiri')),
  price integer not null check (price >= 0),
  description text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  customer_name text not null check (char_length(trim(customer_name)) between 2 and 80),
  customer_phone text not null check (char_length(trim(customer_phone)) between 6 and 25),
  customer_address text,
  payment_method text not null check (payment_method in ('QRIS','E-Wallet','Tunai')),
  payment_status text not null default 'Menunggu' check (payment_status in ('Menunggu','Lunas','Gagal')),
  order_status text not null default 'Menunggu' check (order_status in ('Menunggu','Diproses','Siap diambil','Selesai','Dibatalkan')),
  total integer not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total integer generated always as (unit_price * quantity) stored,
  created_at timestamptz not null default now()
);

-- Admin harus dibuat lewat Authentication > Users, lalu UUID-nya dimasukkan di sini.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_order_number_idx on public.orders(order_number);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

-- Fungsi pemeriksaan admin. SECURITY DEFINER menghindari recursion policy admin_users.
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to anon, authenticated;

-- Fungsi checkout publik: harga dan total dihitung ulang dari database, bukan dipercaya dari browser.
create or replace function public.create_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_payment_method text,
  p_items jsonb
)
returns table(order_id uuid, order_number text, total integer, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_total integer := 0;
  v_created_at timestamptz;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_name text;
  v_phone text;
begin
  v_name := trim(coalesce(p_customer_name, ''));
  v_phone := trim(coalesce(p_customer_phone, ''));

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Nama pemesan harus 2-80 karakter';
  end if;
  if char_length(v_phone) < 6 or char_length(v_phone) > 25 then
    raise exception 'Nomor WhatsApp tidak valid';
  end if;
  if p_payment_method is null or p_payment_method not in ('QRIS','E-Wallet','Tunai') then
    raise exception 'Metode pembayaran tidak valid';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'Daftar produk tidak valid';
  end if;

  -- Validasi seluruh item dan hitung total menggunakan harga database.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if (v_item->>'product_id') is null or (v_item->>'quantity') is null then
      raise exception 'Item pesanan tidak lengkap';
    end if;
    begin
      v_qty := (v_item->>'quantity')::integer;
    exception when others then
      raise exception 'Jumlah produk tidak valid';
    end;
    if v_qty < 1 or v_qty > 99 then
      raise exception 'Jumlah setiap produk harus 1-99';
    end if;
    select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid and active = true;
    if not found then
      raise exception 'Produk tidak tersedia';
    end if;
    v_total := v_total + v_product.price * v_qty;
  end loop;

  if v_total <= 0 then raise exception 'Total pesanan tidak valid'; end if;

  insert into public.orders(customer_name,customer_phone,customer_address,payment_method,total)
  values(v_name,v_phone,nullif(trim(coalesce(p_customer_address,'')),''),p_payment_method,v_total)
  returning id, orders.created_at into v_order_id, v_created_at;

  v_order_number := 'MO-' || to_char(v_created_at at time zone 'Asia/Jakarta','YYYYMMDD') || '-' || upper(substr(replace(v_order_id::text,'-',''),1,6));
  update public.orders set order_number = v_order_number where id = v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and active = true;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity)
    values(v_order_id,v_product.id,v_product.name,v_product.price,v_qty);
  end loop;

  return query select v_order_id, v_order_number, v_total, v_created_at;
end;
$$;
revoke all on function public.create_order(text,text,text,text,jsonb) from public;
grant execute on function public.create_order(text,text,text,text,jsonb) to anon, authenticated;

-- Row Level Security
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products
for select to anon, authenticated using (active = true or public.is_current_user_admin());

drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products
for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());

drop policy if exists "Admins read orders" on public.orders;
create policy "Admins read orders" on public.orders
for select to authenticated using (public.is_current_user_admin());

drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders" on public.orders
for update to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());

drop policy if exists "Admins read order items" on public.order_items;
create policy "Admins read order items" on public.order_items
for select to authenticated using (public.is_current_user_admin());

drop policy if exists "Admins manage admin list" on public.admin_users;
create policy "Admins manage admin list" on public.admin_users
for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());

-- Seed produk. Harga: mochi Rp2.500, onigiri Rp10.000.
insert into public.products(slug,name,category,price,description,sort_order) values
('mochi-kacang','Mochi Kacang','Mochi',2500,'Mochi lembut dengan isian kacang.',1),
('mochi-cokelat','Mochi Cokelat','Mochi',2500,'Manis cokelat dalam balutan kenyal.',2),
('mochi-stroberi','Mochi Stroberi','Mochi',2500,'Rasa stroberi yang manis dan segar.',3),
('mochi-keju','Mochi Keju','Mochi',2500,'Perpaduan mochi lembut dan keju.',4),
('mochi-susu','Mochi Susu','Mochi',2500,'Rasa susu yang lembut dan ringan.',5),
('onigiri-rendang','Onigiri Rendang','Onigiri',10000,'Nasi kepal dengan isian rendang gurih.',6),
('onigiri-ayam-geprek','Onigiri Ayam Geprek','Onigiri',10000,'Ayam geprek berbumbu untuk pencinta pedas.',7),
('onigiri-chicken-mayo','Onigiri Chicken Mayo','Onigiri',10000,'Ayam dan mayones dalam nasi kepal.',8),
('onigiri-ceker','Onigiri Ceker','Onigiri',10000,'Isian ceker berbumbu dengan rasa mantap.',9)
on conflict (slug) do update set
  name=excluded.name, category=excluded.category, price=excluded.price,
  description=excluded.description, sort_order=excluded.sort_order;
