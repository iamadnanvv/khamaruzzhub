
-- ROLES
create type public.app_role as enum ('admin', 'staff');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','staff'))
$$;

create policy "users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- PRODUCTS
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique not null,
  category text,
  description text,
  ingredients text,
  variant text not null default '200g', -- 200g | 400g | premium
  cost_price numeric(10,2) not null default 0,
  selling_price numeric(10,2) not null default 0,
  gst_rate numeric(5,2) not null default 5,
  image_url text,
  mfg_date date,
  expiry_date date,
  shelf_life_days integer,
  fssai_number text,
  barcode text,
  upc_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create policy "admins manage products" on public.products for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- INVENTORY
create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade not null,
  batch_no text,
  quantity integer not null default 0,
  low_stock_threshold integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.inventory enable row level security;
create policy "admins manage inventory" on public.inventory for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- CUSTOMERS
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.customers enable row level security;
create policy "admins manage customers" on public.customers for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- SUPPLIERS
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  material text,
  outstanding numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.suppliers enable row level security;
create policy "admins manage suppliers" on public.suppliers for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ORDERS
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null default ('KH-' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,4)),
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null default 'direct', -- direct | whatsapp | instagram | retail
  status text not null default 'pending', -- pending | packed | shipped | delivered | cancelled
  payment_status text not null default 'unpaid', -- unpaid | paid | partial
  subtotal numeric(10,2) not null default 0,
  gst_amount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create policy "admins manage orders" on public.orders for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete restrict not null,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  line_total numeric(10,2) not null
);
alter table public.order_items enable row level security;
create policy "admins manage order items" on public.order_items for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- SEED ADMIN USER (Kamaruzz / 123@rla)
-- email mapped from username for Supabase auth
do $$
declare
  uid uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where email = 'kamaruzz@khamaruzz.app') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'kamaruzz@khamaruzz.app', crypt('123@rla', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"Kamaruzz"}'::jsonb,
      false, '', '', '', ''
    );
    insert into public.user_roles (user_id, role) values (uid, 'admin');
  end if;
end $$;

-- SEED PRODUCTS (variants per size)
insert into public.products (name, sku, category, variant, cost_price, selling_price, gst_rate, ingredients, fssai_number, shelf_life_days) values
('Mango Pickle','KH-MNG-200','Pickle','200g',25,59,5,'Raw mango, mustard oil, salt, chilli, fenugreek','10024023456789',365),
('Mango Pickle','KH-MNG-400','Pickle','400g',45,109,5,'Raw mango, mustard oil, salt, chilli, fenugreek','10024023456789',365),
('Mango Pickle','KH-MNG-PREM','Pickle','Premium Glass Jar',55,129,5,'Raw mango, mustard oil, salt, chilli, fenugreek','10024023456789',365),
('Garlic Pickle','KH-GRL-200','Pickle','200g',30,69,5,'Garlic, mustard oil, chilli, vinegar','10024023456789',365),
('Garlic Pickle','KH-GRL-400','Pickle','400g',55,129,5,'Garlic, mustard oil, chilli, vinegar','10024023456789',365),
('Garlic Pickle','KH-GRL-PREM','Pickle','Premium Glass Jar',65,149,5,'Garlic, mustard oil, chilli, vinegar','10024023456789',365),
('Ginger Pickle','KH-GNG-200','Pickle','200g',28,65,5,'Ginger, lemon, salt, mustard oil','10024023456789',365),
('Ginger Pickle','KH-GNG-400','Pickle','400g',50,119,5,'Ginger, lemon, salt, mustard oil','10024023456789',365),
('Ginger Pickle','KH-GNG-PREM','Pickle','Premium Glass Jar',60,139,5,'Ginger, lemon, salt, mustard oil','10024023456789',365),
('Chilli Pickle','KH-CHL-200','Pickle','200g',30,69,5,'Green chilli, mustard, oil, salt','10024023456789',365),
('Chilli Pickle','KH-CHL-400','Pickle','400g',55,129,5,'Green chilli, mustard, oil, salt','10024023456789',365),
('Chilli Pickle','KH-CHL-PREM','Pickle','Premium Glass Jar',65,149,5,'Green chilli, mustard, oil, salt','10024023456789',365),
('Soya Bean Pickle','KH-SOY-200','Pickle','200g',35,79,5,'Soya bean, spices, mustard oil','10024023456789',270),
('Soya Bean Pickle','KH-SOY-400','Pickle','400g',65,149,5,'Soya bean, spices, mustard oil','10024023456789',270),
('Soya Bean Pickle','KH-SOY-PREM','Pickle','Premium Glass Jar',75,169,5,'Soya bean, spices, mustard oil','10024023456789',270);

-- seed inventory
insert into public.inventory (product_id, batch_no, quantity, low_stock_threshold)
select id, 'B-' || to_char(now(),'YYMMDD'), (random()*80)::int + 5, 15 from public.products;
