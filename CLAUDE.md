# RDSports — instruções para o Claude

## EXIGÊNCIA MÁXIMA: código-fonte a cada atualização

Toda vez que o app for alterado (qualquer commit/push na `main`), o Rafael
precisa receber o código-fonte completo. Isso não é opcional.

1. **Na conversa:** depois de publicar, gerar o zip do código com
   `git archive --format=zip --prefix=rdsports/ -o rdsports-codigo-fonte-AAAA-MM-DD_HHhMM.zip HEAD`
   (data/hora de São Paulo) e enviar o arquivo ao Rafael na própria conversa.
   Nunca encerrar uma tarefa que mudou o app sem enviar o zip.
2. **No GitHub (automático):** o job `codigo-fonte` em
   `.github/workflows/deploy.yml` cria uma Release com o zip a cada publicação.
   Conferir que a Release foi criada; se falhar, avisar o Rafael. Não remover
   nem desativar esse job.

## Projeto

- App de scout de voleibol (PWA): Vite + React 19 + TypeScript + Tailwind 4 +
  Zustand + Supabase. Código e comentários em português.
- Publicação: GitHub Pages via GitHub Actions, a cada push na `main`.
- `npm test` roda todos os `scripts/test-*.mjs`; o workflow só publica se
  todos passarem. Ao mudar regras de scout, adicionar/ajustar testes.
- Responder ao Rafael em português, de forma simples (ele não é programador).
