-- Líbero no rodízio e chamada dos treinos (pedido 21/11/2026).
-- Só aplicar no Supabase com autorização do Rafael, ANTES de publicar o app
-- que usa estas colunas/tabela (senão o envio pra nuvem dá erro).

-- 1) Líbero de cada set: quem é e com quem ela troca no fundo.
alter table public.sets_partida
  add column if not exists libero_id uuid,
  add column if not exists libero_substitui uuid[];

-- 2) Chamada dos treinos: um registro por turma + dia, inteiro em `dados`
--    (mesmo esquema de sessoes_treino).
create table if not exists public.chamadas_treino (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  dados jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.chamadas_treino enable row level security;
drop policy if exists chamadas_treino_owner on public.chamadas_treino;
create policy chamadas_treino_owner on public.chamadas_treino for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create index if not exists chamadas_treino_owner_idx on public.chamadas_treino (owner_id);
drop trigger if exists trg_marcar_updated_at on public.chamadas_treino;
create trigger trg_marcar_updated_at before insert or update on public.chamadas_treino
  for each row execute function marcar_updated_at_se_mudou();
