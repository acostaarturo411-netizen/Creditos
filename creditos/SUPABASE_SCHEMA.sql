-- ═══════════════════════════════════════════════════════
--  CreditOS — Schema completo
--  Pega esto en Supabase > SQL Editor > New Query > Run
-- ═══════════════════════════════════════════════════════

-- Clientes
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  notas text,
  creado_en timestamptz default now()
);

-- Proveedores
create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  notas text,
  creado_en timestamptz default now()
);

-- Productos (catálogo)
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric(12,2) not null default 0,
  unidad text not null default 'pieza',
  activo boolean default true,
  creado_en timestamptz default now()
);

-- Tickets de venta
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  numero serial,
  cliente_id uuid references clientes(id),
  total numeric(12,2) not null default 0,
  estado text default 'activo',
  notas text,
  creado_en timestamptz default now()
);

-- Líneas de cada ticket
create table if not exists ticket_items (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id) on delete cascade,
  descripcion text not null,
  cantidad numeric(10,3) not null default 1,
  unidad text not null default 'pieza',
  precio_unitario numeric(12,2) not null,
  subtotal numeric(12,2) not null,
  creado_en timestamptz default now()
);

-- Abonos de clientes (lo que me deben)
create table if not exists abonos_clientes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  ticket_id uuid references tickets(id),
  tipo text default 'general',
  forma_pago text default 'transferencia',
  monto numeric(12,2) not null,
  foto_url text,
  notas text,
  creado_en timestamptz default now()
);

-- Compras a proveedores
create table if not exists compras_proveedores (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references proveedores(id),
  descripcion text,
  total numeric(12,2) not null default 0,
  notas text,
  creado_en timestamptz default now()
);

-- Abonos a proveedores (lo que yo debo)
create table if not exists abonos_proveedores (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references proveedores(id),
  compra_id uuid references compras_proveedores(id),
  tipo text default 'general',
  forma_pago text default 'transferencia',
  monto numeric(12,2) not null,
  foto_url text,
  notas text,
  creado_en timestamptz default now()
);

-- Storage bucket para evidencias
insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict do nothing;

-- Políticas de seguridad (solo el dueño accede)
alter table clientes enable row level security;
alter table proveedores enable row level security;
alter table productos enable row level security;
alter table tickets enable row level security;
alter table ticket_items enable row level security;
alter table abonos_clientes enable row level security;
alter table compras_proveedores enable row level security;
alter table abonos_proveedores enable row level security;

-- Permite acceso solo a usuarios autenticados
create policy "Solo autenticados" on clientes for all using (auth.role() = 'authenticated');
create policy "Solo autenticados" on proveedores for all using (auth.role() = 'authenticated');
create policy "Solo autenticados" on productos for all using (auth.role() = 'authenticated');
create policy "Solo autenticados" on tickets for all using (auth.role() = 'authenticated');
create policy "Solo autenticados" on ticket_items for all using (auth.role() = 'authenticated');
create policy "Solo autenticados" on abonos_clientes for all using (auth.role() = 'authenticated');
create policy "Solo autenticados" on compras_proveedores for all using (auth.role() = 'authenticated');
create policy "Solo autenticados" on abonos_proveedores for all using (auth.role() = 'authenticated');
