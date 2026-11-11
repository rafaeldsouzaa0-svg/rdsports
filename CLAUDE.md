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

## EXIGÊNCIA: prévia com foto e autorização ANTES de publicar

O Rafael não quer nenhuma mudança indo pro ar sem ver antes (pedido
11/11/2026). Fluxo obrigatório:

1. Fazer a mudança num branch separado (`previa/<assunto>`), nunca direto na
   `main` (push na `main` publica o site na hora).
2. Rodar testes e build, e tirar fotos (screenshots em tamanho de celular) de
   como vai ficar, com antes/depois quando fizer sentido.
3. Mandar as fotos pro Rafael e perguntar se pode publicar.
4. Só depois do "pode subir" dele: juntar na `main`, conferir a publicação e a
   Release, e mandar o zip do código-fonte.

Isso vale também pra mudanças pequenas. Mudanças no banco (Supabase) também
precisam de autorização antes.

## Projeto

- App de scout de voleibol (PWA): Vite + React 19 + TypeScript + Tailwind 4 +
  Zustand + Supabase. Código e comentários em português.
- Publicação: GitHub Pages via GitHub Actions, a cada push na `main`.
- `npm test` roda todos os `scripts/test-*.mjs`; o workflow só publica se
  todos passarem. Ao mudar regras de scout, adicionar/ajustar testes.
- Responder ao Rafael em português, de forma simples (ele não é programador).
