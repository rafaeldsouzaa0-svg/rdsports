-- Apelidos das atletas pro scout por voz (21/11/2026).
-- Coluna opcional; o app manda/lê em atletaSync.ts e cloudSync.ts.
alter table public.atletas add column if not exists apelidos text;
comment on column public.atletas.apelidos is 'Apelidos usados no ginásio, separados por vírgula — o scout por voz reconhece a atleta por eles (21/11/2026).';
