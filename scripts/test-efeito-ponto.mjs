// Efeito de ponto no scout (21/11/2026): só ponto NOSSO de ataque, ace ou
// bloqueio ganha destaque; outros pontos só "pulam" o placar de quem pontuou;
// lance que não muda o placar (e o Desfazer) não dispara nada.
import { detectarEfeitoPonto } from '../src/efeitoPonto.ts'
import { criarSet, registrarEventoTime, desfazerUltimoEvento } from '../src/scoutEngine.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

function marcar(lado, fundamento, resultado) {
  const antes = criarSet(1)
  const depois = registrarEventoTime(antes, lado, fundamento, resultado, lado === 'CASA' ? 'atleta1' : undefined)
  return detectarEfeitoPonto(antes, depois)
}

let e = marcar('CASA', 'ataque', 'ACERTO')
assert(e?.lado === 'CASA' && e.destaque === 'ataque', 'nosso ataque de ponto → destaque "ataque"')
e = marcar('CASA', 'saque', 'ACERTO')
assert(e?.lado === 'CASA' && e.destaque === 'ace', 'nosso saque de ponto → destaque "ace"')
e = marcar('CASA', 'bloqueio', 'ACERTO')
assert(e?.lado === 'CASA' && e.destaque === 'bloqueio', 'nosso bloqueio de ponto → destaque "bloqueio"')

e = marcar('ADVERSARIO', 'ataque', 'ERRO')
assert(e?.lado === 'CASA' && e.destaque === null, 'erro de ataque do adversário → ponto nosso, sem destaque')
e = marcar('CASA', 'bola_de_segunda', 'ACERTO')
assert(e?.lado === 'CASA' && e.destaque === null, 'bola de 2ª nossa → ponto nosso, sem destaque')
e = marcar('ADVERSARIO', 'ataque', 'ACERTO')
assert(e?.lado === 'ADVERSARIO' && e.destaque === null, 'ataque de ponto do adversário → ponto deles, sem destaque')
e = marcar('CASA', 'ataque', 'ERRO')
assert(e?.lado === 'ADVERSARIO' && e.destaque === null, 'nosso erro de ataque → ponto deles, sem destaque')

e = marcar('CASA', 'saque', 'EM_JOGO')
assert(e === null, 'saque em jogo (placar não muda) → nenhum efeito')
e = marcar('CASA', 'recepcao', 'BOM')
assert(e === null, 'recepção boa → nenhum efeito')

const comPonto = registrarEventoTime(criarSet(1), 'CASA', 'ataque', 'ACERTO', 'atleta1')
assert(detectarEfeitoPonto(comPonto, desfazerUltimoEvento(comPonto)) === null, 'Desfazer → nenhum efeito')

// Rally longo: recepção, levantamento e só então o ataque de ponto.
let s = criarSet(1)
s = registrarEventoTime(s, 'CASA', 'recepcao', 'BOM', 'a1')
s = registrarEventoTime(s, 'CASA', 'levantamento', 'BOM', 'a2')
const antesAtaque = s
s = registrarEventoTime(s, 'CASA', 'ataque', 'ACERTO', 'a3')
e = detectarEfeitoPonto(antesAtaque, s)
assert(e?.destaque === 'ataque', 'ataque de ponto no fim de um rally longo → destaque "ataque"')

if (falhas) { console.error(`${falhas} falha(s)`); process.exit(1) }
