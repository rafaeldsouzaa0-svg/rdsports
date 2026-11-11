# RDSports — Scout de Voleibol

App web (PWA) de scout, gestão e estatísticas para equipes de voleibol: escolas, turmas, atletas, modo jogo com scout ao vivo, relatórios, treinos, biblioteca de exercícios, temporada e painel do atleta. Os dados ficam no aparelho e sincronizam com o Supabase.

## Rodando localmente

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # gera o site em dist/
npm run lint
```

Testes da lógica de scout e relatórios ficam em `scripts/test-*.mjs`. `npm test` roda todos; um só: `node --import tsx scripts/test-scout-engine.mjs`.

## Publicação

O site é publicado no GitHub Pages automaticamente pelo workflow `.github/workflows/deploy.yml` a cada push na branch `main`. Em **Settings → Pages**, a origem (Source) deve estar como **GitHub Actions**.

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, Supabase, vite-plugin-pwa.
