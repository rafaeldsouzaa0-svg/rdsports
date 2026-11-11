// Teste de `analisePorAtletaEPosicao` (pedido 23/10/2026, ajustado): "em qual
// posição a Renata rende melhor" — tem que contar TODAS as ações da atleta
// naquela posição (inclusive Levantamento, que nunca fecha rally), não só as
// que decidiram o ponto — senão uma levantadora nunca apareceria em lugar
// nenhum, mesmo sendo ótima ou péssima.
import { registrarEventoTime, criarSet, analisePorAtletaEPosicao } from '../src/scoutEngine.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const RENATA = 'renata-id'
const OUTRA = 'outra-id'

// Renata é levantadora, escalada na posição III (índice 2).
let set1 = {
  ...criarSet(1),
  escalacaoInicial: ['a1', 'a2', RENATA, OUTRA, 'a5', 'a6'],
  primeiroSaque: 'CASA',
}
// 2 levantamentos Bom, 1 Erro — NENHUM fecha o rally (regra do app), mas
// ainda assim precisam contar pra posição III da Renata.
set1 = registrarEventoTime(set1, 'CASA', 'levantamento', 'BOM', RENATA)
set1 = registrarEventoTime(set1, 'CASA', 'levantamento', 'BOM', RENATA)
set1 = registrarEventoTime(set1, 'CASA', 'levantamento', 'ERRO', RENATA)
// E um ataque de outra atleta fecha o rally (CASA ganha o saque de novo,
// rodízio não gira ainda).
set1 = registrarEventoTime(set1, 'CASA', 'ataque', 'ACERTO', OUTRA)

const porAtleta1 = analisePorAtletaEPosicao([set1])
assert(porAtleta1[RENATA] !== undefined, 'Renata aparece na análise mesmo sendo levantadora (ações dela não fecham rally)')
assert(porAtleta1[RENATA][2].total === 3, 'Renata tem 3 ações contadas na posição III (2 levantamentos Bom + 1 Erro)')
assert(porAtleta1[RENATA][2].positivo === 2 && porAtleta1[RENATA][2].erro === 1, 'Renata: 2 positivos e 1 erro na posição III')
assert(porAtleta1[RENATA][2].eficiencia === Math.round(((2 - 1) / 3) * 100), 'Eficiência da Renata na posição III calculada certo')

// Outra atleta: só o ataque dela (fechou o rally) deve contar, na posição
// dela — e os dados da Renata não podem vazar pra cá.
assert(porAtleta1[OUTRA] !== undefined, 'A outra atleta também aparece, com os próprios dados')
assert(porAtleta1[OUTRA][2] === undefined || porAtleta1[OUTRA][2].total === 0, 'A outra atleta não tem nada contado na posição III (ela nem estava lá)')

// Set 2: Renata muda pra posição IV numa partida diferente.
let set2 = {
  ...criarSet(1),
  escalacaoInicial: ['a1', 'a2', 'a3', RENATA, 'a5', 'a6'],
  primeiroSaque: 'CASA',
}
set2 = registrarEventoTime(set2, 'CASA', 'levantamento', 'BOM', RENATA)

const porAtletaTotal = analisePorAtletaEPosicao([set1, set2])
assert(porAtletaTotal[RENATA][2].total === 3, 'Histórico: posição III da Renata preserva o que já tinha no set 1')
assert(porAtletaTotal[RENATA][3].total === 1, 'Histórico: posição IV da Renata soma o levantamento do set 2')

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
