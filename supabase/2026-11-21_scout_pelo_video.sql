-- Scout pelo vídeo (pedido 21/11/2026). Só aplicar com autorização do
-- Rafael, ANTES de publicar o app que usa estas colunas.
-- Link do vídeo do jogo (YouTube). Arquivo do aparelho NÃO vai pra nuvem.
alter table public.partidas add column if not exists video_url text;
-- Segundo do vídeo em que cada lance foi marcado.
alter table public.rally_eventos add column if not exists video_seg real;
