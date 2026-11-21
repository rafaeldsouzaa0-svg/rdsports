// Reparo dos acertos do app antigo que viraram "em jogo" (21/11/2026).
import { resultadoDaNuvem, repararRally, repararPartidas } from '../src/repararScout.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

assert(resultadoDaNuvem('SAQUE', 'ACE') === 'ACERTO', '"ACE" no saque vira ACERTO')
assert(resultadoDaNuvem('ATAQUE', 'ACE') === 'ACERTO', '"ACE" no ataque vira ACERTO')
assert(resultadoDaNuvem('RECEPCAO', 'ACE') === 'ERRO', '"ACE" na recepção (ace sofrido) vira ERRO')
assert(resultadoDaNuvem('ATAQUE', 'erro') === 'ERRO', 'nomes atuais continuam iguais (sem diferença de maiúscula)')
assert(resultadoDaNuvem('DEFESA', 'QUALQUER') === 'EM_JOGO', 'nome desconhecido continua neutro')

const ev = (fundamento, resultado, extra = {}) => ({ id: fundamento + resultado, fundamento, resultado, encerraRally: null, timestamp: '', ...extra })
const rally = (pontoCasa, eventos) => ({ id: 'r', numero: 1, pontoCasa, placarCasaApos: 1, placarAdversarioApos: 0, eventos })

let r = repararRally(rally(true, [ev('recepcao', 'EM_JOGO'), ev('ataque', 'EM_JOGO', { encerraRally: 'CASA' })]))
assert(r.eventos[1].resultado === 'ACERTO' && r.eventos[0].resultado === 'EM_JOGO', 'ataque "em jogo" que fechou ponto nosso vira ACERTO (a recepção não muda)')
r = repararRally(rally(true, [ev('saque', 'EM_JOGO')]))
assert(r.eventos[0].resultado === 'ACERTO', 'saque "em jogo" que fechou ponto nosso vira ACE')
r = repararRally(rally(true, [ev('bloqueio', 'EM_JOGO')]))
assert(r.eventos[0].resultado === 'ACERTO', 'bloqueio "em jogo" que fechou ponto nosso vira ponto de bloqueio')

const pontoDeles = rally(false, [ev('ataque', 'EM_JOGO')])
assert(repararRally(pontoDeles) === pontoDeles, 'rally que foi ponto DELES não muda')
const doAdversario = rally(true, [ev('ataque', 'EM_JOGO', { ladoResponsavel: 'ADVERSARIO' })])
assert(repararRally(doAdversario) === doAdversario, 'lance do adversário não muda')
const recepcao = rally(true, [ev('recepcao', 'EM_JOGO')])
assert(repararRally(recepcao) === recepcao, 'recepção "em jogo" não vira ponto (não dá pra saber a nota)')
const certo = rally(true, [ev('ataque', 'ACERTO')])
assert(repararRally(certo) === certo, 'rally já certo não muda')
const emAndamento = rally(false, [ev('saque', 'EM_JOGO')])
assert(repararRally(emAndamento) === emAndamento, 'rally em andamento (scout ao vivo) não muda')

const partida = (rallies) => ({ id: 'p', setsPartida: [{ id: 's', numero: 1, placarCasa: 1, placarAdversario: 0, finalizado: true, rallies }] })
const lista = [partida([certo, pontoDeles])]
assert(repararPartidas(lista) === lista, 'sem nada pra consertar, devolve a mesma lista (não dispara sincronização)')
const consertada = repararPartidas([partida([rally(true, [ev('saque', 'EM_JOGO')])])])
assert(consertada[0].setsPartida[0].rallies[0].eventos[0].resultado === 'ACERTO', 'repararPartidas conserta dentro dos sets')

if (falhas) { console.error(`${falhas} falha(s)`); process.exit(1) }
