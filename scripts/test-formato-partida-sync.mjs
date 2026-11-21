// Teste da correção 21/11/2026: formato e pontos do jogo não podem mudar na
// ida e volta da nuvem (antes, "Melhor de 3" voltava como "Melhor de 5").
import { colunasFormato, formatoDaLinha } from '../src/formatoPartidaSync.ts'
import { pontosParaFecharSet } from '../src/scoutEngine.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}
const idaEVolta = (p) => formatoDaLinha(colunasFormato(p))

for (const formato of ['MELHOR_DE_3', 'MELHOR_DE_5', 'TRES_OBRIGATORIOS_25']) {
  assert(idaEVolta({ formato }).formato === formato, `${formato} volta igual da nuvem`)
}

const m3 = idaEVolta({ formato: 'MELHOR_DE_3', pontosSetNormal: 21, pontosSetDecisivo: 15 })
assert(m3.pontosSetNormal === 21 && m3.pontosSetDecisivo === 15, 'Pontos configurados (21 / 15) voltam iguais')
assert(pontosParaFecharSet(m3, 1) === 21 && pontosParaFecharSet(m3, 3) === 15, 'Set 1 fecha em 21 e o 3º (decisivo) em 15 depois da volta')

const semPontos = idaEVolta({ formato: 'MELHOR_DE_5' })
assert(semPontos.pontosSetNormal === undefined, 'Sem pontos configurados: continua usando o padrão (25)')

// Linhas antigas (sem a coluna formato) são lidas como antes.
assert(formatoDaLinha({ formato: null, pontos_set_decisivo: 25 }).formato === 'TRES_OBRIGATORIOS_25', 'Linha antiga com decisivo 25 = 3 sets obrigatórios')
assert(formatoDaLinha({ pontos_set_decisivo: 15 }).formato === 'MELHOR_DE_5', 'Linha antiga com decisivo 15 = melhor de 5')
assert(formatoDaLinha({ formato: 'LIXO', pontos_set_decisivo: 15 }).formato === 'MELHOR_DE_5', 'Formato desconhecido não quebra')

if (falhas > 0) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nTodos os testes do formato passaram.')
