// Teste isolado da rodada 23/10/2026: fluxo único atleta/adversário → fundamento
// → resultado (registrarEventoTime), e substituição de atleta no meio do set.
import { criarSet, registrarEventoTime, aplicarSubstituicao, calcularRotacao, erroPorFundamentoAdversario, pontosPorFundamentoAdversario } from '../src/scoutEngine.ts'

let falhas = 0
function assert(cond, msg) { if (!cond) { console.error('FALHOU:', msg); falhas++ } else console.log('OK:', msg) }

// --- registrarEventoTime pro NOSSO time funciona igual ao registrarEvento de sempre ---
let s1 = criarSet(1)
s1 = registrarEventoTime(s1, 'CASA', 'ataque', 'ACERTO', 'ana')
assert(s1.placarCasa === 1 && s1.placarAdversario === 0, 'Nossa atleta marca ponto normalmente')
assert(s1.rallies[0].eventos[0].atletaId === 'ana' && !s1.rallies[0].eventos[0].ladoResponsavel, 'Evento guarda a atleta, sem ladoResponsavel (é nosso por padrão)')

// --- registrarEventoTime pro ADVERSÁRIO: "Ponto" dele fecha pra ELE ---
let s2 = criarSet(1)
s2 = registrarEventoTime(s2, 'ADVERSARIO', 'ataque', 'ACERTO', undefined, '10')
assert(s2.placarCasa === 0 && s2.placarAdversario === 1, 'Ataque com "+Ponto" do adversário vira ponto DELE, não nosso')
assert(s2.rallies[0].eventos[0].ladoResponsavel === 'ADVERSARIO' && s2.rallies[0].eventos[0].numeroAdversario === '10', 'Evento marcado como do adversário, com o número da camisa')

// --- registrarEventoTime pro ADVERSÁRIO: "Erro" dele vira ponto NOSSO (igual já era) ---
let s3 = criarSet(1)
s3 = registrarEventoTime(s3, 'ADVERSARIO', 'saque', 'ERRO')
assert(s3.placarCasa === 1 && s3.placarAdversario === 0, 'Erro de saque do adversário continua virando ponto nosso')

const erros3 = erroPorFundamentoAdversario([s3])
assert(erros3.saque.total === 1, 'erroPorFundamentoAdversario conta só os ERROS do adversário')
const pontos2 = pontosPorFundamentoAdversario([s2])
assert(pontos2.ataque.total === 1 && pontos2.ataque.porNumero['10'] === 1, 'pontosPorFundamentoAdversario conta os pontos que o adversário marcou, por número')
const erros2 = erroPorFundamentoAdversario([s2])
assert(erros2.ataque.total === 0, 'Um PONTO do adversário não entra na contagem de ERROS dele')

// --- Substituição no meio do set: a reserva assume a posição a partir dali ---
let set = criarSet(1)
set.escalacaoInicial = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
set.primeiroSaque = 'CASA'

// 1 rally fechado antes da troca
set = registrarEventoTime(set, 'CASA', 'ataque', 'ACERTO', 'p1') // 1x0, continuamos sacando
let rot = calcularRotacao(set)
assert(rot.posicoes[0] === 'p1', 'Antes da troca, p1 segue na posição I')

set = aplicarSubstituicao(set, 0, 'reserva1') // troca quem está na posição I
rot = calcularRotacao(set)
assert(rot.posicoes[0] === 'reserva1', 'Depois da troca, reserva1 assume a posição I')
assert(rot.posicoes[1] === 'p2', 'As outras posições continuam intactas')

// a troca "gruda" na posição mesmo depois que ela girar pro rodízio
set = registrarEventoTime(set, 'ADVERSARIO', 'ataque', 'ERRO') // ponto nosso de novo (erro deles), continuamos sacando — não gira
rot = calcularRotacao(set)
assert(rot.posicoes[0] === 'reserva1', 'reserva1 continua na posição I enquanto seguimos sacando')

console.log(falhas === 0 ? '\nTudo passou.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
