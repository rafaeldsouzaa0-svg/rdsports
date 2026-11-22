-- Lance do ADVERSÁRIO não tem atleta nossa (atleta_id vazio). Com a coluna
-- obrigatória, o banco recusava o lote inteiro de lances (21/11/2026: era o
-- "Não sincronizou — tentando de novo" no scout; nenhum lance do adversário
-- tinha chegado na nuvem até aqui).
alter table public.rally_eventos alter column atleta_id drop not null;
