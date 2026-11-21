-- Formato do jogo na nuvem (correção 21/11/2026). Só aplicar com
-- autorização do Rafael, ANTES de publicar o app que usa a coluna.

alter table public.partidas add column if not exists formato text;

-- Conserta os jogos já salvos. Um jogo terminado em que o vencedor fez só
-- 2 sets não pode ter sido "melhor de 5" (que termina em 3): era "melhor de
-- 3". Decisivo 25 = "3 sets obrigatórios", como o app já lia antes.
-- O update também atualiza `updated_at` (trigger), então os aparelhos pegam
-- a versão corrigida na próxima sincronização.
update public.partidas set formato = 'TRES_OBRIGATORIOS_25'
  where formato is null and pontos_set_decisivo = 25;
update public.partidas set formato = 'MELHOR_DE_3'
  where formato is null and status = 'FINALIZADA'
    and greatest(sets_ganhos_casa, sets_ganhos_adversario) = 2
    and coalesce(pontos_set_decisivo, 15) <> 25;
