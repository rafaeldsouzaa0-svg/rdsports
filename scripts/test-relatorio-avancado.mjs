// Teste isolado da rodada 23/10/2026: análise por posição, substituições com
// contexto (placar na hora da troca) e ponto a ponto do set — pro relatório
// final da partida.
import { criarSet, registrarEventoTime, aplicarSubstituicao, analisePorPosicao, analisePorPosicaoPartida, listaSubstituicoesDetalhada, pontoAPontoDoSet } from '../src/scoutEngine.ts'

let falhas = 0
function assert(cond, msg) { if (!cond) { console.error('FALHOU:', msg); falhas++ } else console.log('OK:', msg) }

let set = criarSet(1)
set.escalacaoInicial = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
set.primeiroSaque = 'CASA'

// p1 (posição I) marca um ataque de ponto — conta pra posição 0.
set = registrarEventoTime(set, 'CASA', 'ataque', 'ACERTO', 'p1') // 1x0
// p2 (posição II) erra um ataque — conta erro pra posição 1, ponto pro adversário.
set = registrarEventoTime(set, 'CASA', 'ataque', 'ERRO', 'p2') // 1x1

let analise = analisePorPosicao(set)
assert(analise[0].pontos === 1 && analise[0].erros === 0, 'Posição I (p1) tem 1 ponto, 0 erro')
assert(analise[1].pontos === 0 && analise[1].erros === 1, 'Posição II (p2) tem 0 ponto, 1 erro')

const totalPartida = analisePorPosicaoPartida([set])
assert(totalPartida[0].pontos === 1, 'analisePorPosicaoPartida agrega corretamente')

// --- Substituição com contexto de placar ---
set = aplicarSubstituicao(set, 3, 'reserva1') // troca a posição IV (p4) depois de 2 rallies fechados
const subs = listaSubstituicoesDetalhada(set)
assert(subs.length === 1, 'Uma substituição registrada')
assert(subs[0].atletaSaiId === 'p4' && subs[0].atletaEntraId === 'reserva1', 'Substituição mostra quem saiu (p4) e quem entrou (reserva1)')
assert(subs[0].placarCasaNoMomento === 1 && subs[0].placarAdversarioNoMomento === 1, 'Substituição mostra o placar correto no momento da troca (1x1)')

// --- Ponto a ponto ---
const pontos = pontoAPontoDoSet(set)
assert(pontos.length === 2, 'Ponto a ponto tem os 2 rallies fechados')
assert(pontos[0].placarCasa === 1 && pontos[0].placarAdversario === 0 && pontos[0].ganhouCasa === true, 'Primeiro ponto: 1x0 pra casa')
assert(pontos[1].placarCasa === 1 && pontos[1].placarAdversario === 1 && pontos[1].ganhouCasa === false, 'Segundo ponto: 1x1, ponto do adversário')

console.log(falhas === 0 ? '\nTudo passou.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
