// Janela flutuante do vídeo (21/11/2026): tamanho e nunca sair da tela.
import { larguraDaJanela, prenderNaTela } from '../src/components/PlayerVideo.tsx'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

assert(larguraDaJanela('p', 375) === 169, 'Celular: janela pequena ~45% da tela')
assert(larguraDaJanela('g', 375) === 263, 'Celular: janela grande ~70% da tela')
assert(larguraDaJanela('p', 1024) === 340, 'Tablet: janela pequena no máximo 340 px')
assert(larguraDaJanela('g', 1024) === 560, 'Tablet: janela grande no máximo 560 px')

let p = prenderNaTela(-50, -20, 200, 120, 375, 700)
assert(p.x === 8 && p.y === 8, 'Arrastada pra fora pela esquerda/topo: volta pra dentro')
p = prenderNaTela(900, 900, 200, 120, 375, 700)
assert(p.x === 375 - 200 - 8 && p.y === 700 - 120 - 8, 'Arrastada pra fora pela direita/baixo: volta pra dentro')
p = prenderNaTela(100, 200, 200, 120, 375, 700)
assert(p.x === 100 && p.y === 200, 'Dentro da tela: fica onde foi solta')

if (falhas) { console.error(`${falhas} falha(s)`); process.exit(1) }
