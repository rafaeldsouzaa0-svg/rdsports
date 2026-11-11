// Teste isolado: normalizarPosicao() mapeia valores antigos de posição (do
// Supabase, de antes de 23/10/2026) pro enum atual, e calcularRating() nunca
// trava mesmo recebendo um valor de posição inválido/desconhecido (bug real
// encontrado em produção em 23/10/2026: tela preta ao abrir perfil de atleta).
import assert from 'node:assert'
import { normalizarPosicao } from '../src/types.ts'
import { calcularRating } from '../src/rating.ts'
import { linhaVazia } from '../src/scoutEngine.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

// --- normalizarPosicao ---
check('Ponteira -> PONTEIRO', normalizarPosicao('Ponteira') === 'PONTEIRO')
check('Central -> CENTRAL', normalizarPosicao('Central') === 'CENTRAL')
check('Levantadora -> LEVANTADORA', normalizarPosicao('Levantadora') === 'LEVANTADORA')
check('Oposta -> OPOSTO', normalizarPosicao('Oposta') === 'OPOSTO')
check('Líbero -> LIBERO', normalizarPosicao('Líbero') === 'LIBERO')
check('já no formato novo (CENTRAL) continua CENTRAL', normalizarPosicao('CENTRAL') === 'CENTRAL')
check('6x0 -> undefined (sem posição fixa, sem equivalente)', normalizarPosicao('6x0') === undefined)
check('SEIS_POR_ZERO -> undefined', normalizarPosicao('SEIS_POR_ZERO') === undefined)
check('null -> undefined', normalizarPosicao(null) === undefined)
check('string vazia -> undefined', normalizarPosicao('') === undefined)
check('lixo qualquer -> undefined (nunca lança erro)', normalizarPosicao('qualquer coisa aleatória') === undefined)

// --- calcularRating nunca trava, mesmo com posição inválida direto (sem normalizar antes) ---
const scoutVazio = {
  saque: linhaVazia(), recepcao: linhaVazia(), levantamento: linhaVazia(), ataque: linhaVazia(),
  bloqueio: linhaVazia(), defesa: linhaVazia(), bola_de_graca: linhaVazia(), bola_de_segunda: linhaVazia(), nao_deslocou: linhaVazia(),
}
check(
  'calcularRating com posição crua antiga ("Ponteira") não lança erro',
  (() => { try { calcularRating(scoutVazio, 'Ponteira'); return true } catch { return false } })(),
)
check(
  'calcularRating com posição undefined não lança erro',
  (() => { try { calcularRating(scoutVazio, undefined); return true } catch { return false } })(),
)
check(
  'calcularRating com posição válida (CENTRAL) não lança erro',
  (() => { try { calcularRating(scoutVazio, 'CENTRAL'); return true } catch { return false } })(),
)

console.log(`\n${ok}/${ok} testes passaram.`)
