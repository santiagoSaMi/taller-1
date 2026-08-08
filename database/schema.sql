-- =========================================================
-- Esquema: scraped_items
-- Plataforma: Supabase (PostgreSQL)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =========================================================

-- 1. Extensión necesaria para generar UUIDs (Supabase normalmente ya la trae)
create extension if not exists "pgcrypto";

-- 2. Tabla principal
create table if not exists public.scraped_items (
    id          uuid primary key default gen_random_uuid(),
    title       text not null,
    link        text not null,
    metadata    jsonb default '{}'::jsonb,   -- info extra flexible (autor, tags, precio, etc.)
    source      text not null default 'unknown', -- de qué sitio vino el registro
    created_at  timestamptz not null default now()
);

-- Índice para acelerar el ORDER BY cronológico del GET /api/items
create index if not exists idx_scraped_items_created_at
    on public.scraped_items (created_at desc);

-- Evita duplicados exactos del mismo link+source (opcional pero recomendado)
create unique index if not exists idx_scraped_items_link_source
    on public.scraped_items (link, source);

-- 3. Row Level Security (RLS)
alter table public.scraped_items enable row level security;

-- Lectura pública (para que el frontend con anon key pueda hacer GET)
create policy "Permitir lectura publica"
    on public.scraped_items
    for select
    using (true);

-- Escritura: solo permitida usando la service_role key (el backend),
-- NUNCA se debe usar la anon key para insertar desde el cliente.
-- La service_role key bypassea RLS por defecto, pero dejamos la política
-- explícita para documentar la intención y por si se usa un JWT custom.
create policy "Permitir insercion autenticada"
    on public.scraped_items
    for insert
    with check (auth.role() = 'service_role');

-- =========================================================
-- Notas de seguridad:
-- - El backend (server.js) debe usar SUPABASE_SERVICE_ROLE_KEY (nunca
--   la expongas en el frontend).
-- - El frontend (index.html) debe usar SUPABASE_ANON_KEY o, mejor aún,
--   simplemente consumir el endpoint GET /api/items del backend en vez
--   de hablarle directo a Supabase.
-- =========================================================
