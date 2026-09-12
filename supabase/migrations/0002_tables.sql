-- profiles: one row per auth.users, created via invite by admin
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role user_role not null default 'seller',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents integer not null check (price_cents > 0),
  number_count integer not null check (number_count > 0),
  number_start integer not null default 1,
  draw_date date,
  status campaign_status not null default 'RASCUNHO',
  reservation_hours integer, -- null = sem expiracao automatica
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaign_prizes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  position integer not null,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (campaign_id, position)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_customers_name on customers using gin (to_tsvector('simple', name));

create table orders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  customer_id uuid not null references customers(id),
  seller_id uuid not null references profiles(id),
  status order_status not null default 'RESERVADO',
  total_cents integer not null default 0,
  note text,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_orders_campaign on orders(campaign_id);
create index idx_orders_seller on orders(seller_id);
create index idx_orders_status on orders(status);

create table campaign_numbers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  number integer not null,
  status number_status not null default 'DISPONIVEL',
  order_id uuid references orders(id) on delete set null,
  reserved_by uuid references profiles(id),
  reserved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, number)
);
create index idx_campaign_numbers_status on campaign_numbers(campaign_id, status);
create index idx_campaign_numbers_order on campaign_numbers(order_id);

create table order_numbers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  campaign_number_id uuid not null references campaign_numbers(id),
  created_at timestamptz not null default now(),
  unique (campaign_number_id)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  amount_cents integer not null check (amount_cents > 0),
  method payment_method not null,
  confirmed_by uuid not null references profiles(id),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_payments_order on payments(order_id);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_created on audit_logs(created_at desc);

create table draws (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  executed_by uuid not null references profiles(id),
  executed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table draw_results (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references draws(id) on delete cascade,
  prize_id uuid not null references campaign_prizes(id),
  campaign_number_id uuid not null references campaign_numbers(id),
  customer_id uuid not null references customers(id),
  created_at timestamptz not null default now(),
  unique (prize_id)
);
