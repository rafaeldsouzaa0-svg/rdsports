import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  build: {
    // Sem subpasta "assets/" — todos os arquivos ficam soltos na raiz do dist/,
    // pra caber num upload direto (arrastar arquivos) no GitHub sem precisar
    // recriar estrutura de pastas.
    assetsDir: '',
    // Bibliotecas em arquivos próprios: elas quase nunca mudam, então ficam no
    // cache do celular e, a cada atualização do app, só o código do RDSports é
    // baixado de novo.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'vendor-supabase', test: /node_modules[\\/](@supabase|iceberg-js|tslib)[\\/]/ },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'RDSports — Scout de Voleibol',
        short_name: 'RDSports',
        description: 'Scout, gestão e estatísticas de voleibol',
        theme_color: '#0b0a08',
        background_color: '#0b0a08',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
      },
    }),
  ],
})
