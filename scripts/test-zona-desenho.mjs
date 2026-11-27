// Teste do tamanho da Zona no desenho do treino (pedido 26/11/2026): puxar
// um canto com o dedo e os botões − / +.
import { cantosDaZona, redimensionarPeloCanto, ajustarTamanho, tamanhoEmMetros } from '../src/zonaDesenho.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const z = { x: 30, y: 50, largura: 20, altura: 10 }
assert(igual(cantosDaZona(z).no, { x: 20, y: 45 }) && igual(cantosDaZona(z).se, { x: 40, y: 55 }), 'cantos calculados a partir do centro e do tamanho')

// Puxar o canto de baixo à direita: o de cima à esquerda (20, 45) fica parado.
let r = redimensionarPeloCanto(z, 'se', { x: 60, y: 75 })
assert(igual(r, { largura: 40, altura: 30, x: 40, y: 60 }), 'puxar canto de baixo/direita aumenta e o canto oposto não sai do lugar')
assert(igual(cantosDaZona(r).no, cantosDaZona(z).no), 'canto oposto continua exatamente no mesmo ponto')

// Puxar o canto de cima à esquerda pra dentro: diminui, o de baixo/direita (40, 55) fica parado.
r = redimensionarPeloCanto(z, 'no', { x: 30, y: 50 })
assert(igual(r, { largura: 10, altura: 5, x: 35, y: 52.5 }), 'puxar canto de cima/esquerda pra dentro diminui')

// Dedo passa do canto oposto: não vira do avesso, para no mínimo (5%).
r = redimensionarPeloCanto(z, 'se', { x: 5, y: 5 })
assert(r.largura === 5 && r.altura === 5 && r.x === 22.5 && r.y === 47.5, 'passar do outro lado não inverte a zona: fica no tamanho mínimo')

// Botões − / +
assert(ajustarTamanho(z, 'largura', 1).largura === 25, '+ na largura: 20 → 25')
assert(ajustarTamanho(z, 'altura', -1).altura === 5, '− na altura: 10 → 5')
assert(ajustarTamanho({ ...z, altura: 5 }, 'altura', -1).altura === 5, 'não diminui abaixo de 5')
assert(ajustarTamanho({ ...z, largura: 100 }, 'largura', 1).largura === 100, 'não passa de 100 (quadra inteira)')
assert(ajustarTamanho({ ...z, largura: 23 }, 'largura', 1).largura === 25 && ajustarTamanho({ ...z, largura: 23 }, 'largura', -1).largura === 20, 'tamanho puxado com o dedo (23) arredonda pro próximo múltiplo de 5')
const b = ajustarTamanho(z, 'largura', 1)
assert(b.x === z.x && b.y === z.y && b.altura === z.altura, 'botão mantém o centro e o outro lado')

// Metros (quadra 18 m × 9 m)
assert(tamanhoEmMetros({ largura: 20, altura: 15 }) === '3,6 m × 1,4 m', 'zona padrão = 3,6 m × 1,4 m')
assert(tamanhoEmMetros({ largura: 50, altura: 100 }) === '9,0 m × 9,0 m', 'meia quadra inteira = 9,0 m × 9,0 m')

if (falhas > 0) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nTamanho da zona: tudo certo.')
