// Zona falada no scout por voz (pedido 27/11/2026): "ataque da Marina ponto
// zona 4" marca a zona 4 — e a zona é sempre opcional.
import assert from 'node:assert'
import { interpretarFala, interpretarFalaVarias, fraseConfirmacao } from '../src/scoutVoz.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

const atl = (id, nome, numero) => ({ id, nome, numero })
const emQuadra = [atl('ju', 'Júlia', '1'), atl('ma', 'Marina', '7'), atl('du', 'Duda', '4')]
const ctx = { emQuadra, todas: emQuadra, sacadoraId: 'ju' }
const f = (t) => interpretarFala(t, ctx)

check('"ataque da Marina ponto zona 4" -> zona 4', f('ataque da Marina ponto zona 4').zona === 4 && f('ataque da Marina ponto zona 4').faltando.length === 0)
check('Número por extenso: "zona sete" -> 7', f('ataque Marina ponto zona sete').zona === 7)
check('"na 9" também vale', f('ataque Marina na 9 ponto').zona === 9)
check('"pra cinco" também vale', f('saque pra cinco em jogo').zona === 5)
check('Saque sem nome usa a sacadora e guarda a zona', f('saque em jogo zona 1').atletaId === 'ju' && f('saque em jogo zona 1').zona === 1)
check('"sona 8" (ouvido errado) vira zona 8', f('ataque Marina ponto sona 8').zona === 8)
check('Sem zona falada: marca normal, sem pedir zona', f('ataque Marina ponto').zona === undefined && f('ataque Marina ponto').faltando.length === 0)
check('Zona não vale na recepção', f('recepção Marina boa zona 4').zona === undefined)
check('"camisa 7" continua sendo a atleta, não zona', f('ataque camisa 7 ponto').atletaId === 'ma' && f('ataque camisa 7 ponto').zona === undefined)
check('Zona 0 ou 10 não vale', f('ataque Marina ponto zona 10').zona === undefined)
check('"na rede" continua sendo erro (sem zona)', f('Marina atacou na rede').resultado === 'ERRO' && f('Marina atacou na rede').zona === undefined)

// Várias jogadas na mesma fala: cada uma com a sua zona
{
  const r = interpretarFalaVarias('saque Júlia em jogo zona 1 ataque Marina ponto zona 4', ctx)
  check('Duas jogadas, cada uma com sua zona', r.tipo === 'jogadas' && r.jogadas.length === 2 && r.jogadas[0].zona === 1 && r.jogadas[1].zona === 4)
}

// Confirmação falada/escrita
check('Confirmação fala a zona', fraseConfirmacao({ lado: 'CASA', fundamento: 'ataque', resultado: 'ACERTO', zona: 4 }, 'Marina Souza') === 'Ataque Marina, ponto, zona 4')
check('Sem zona, confirmação igual a antes', fraseConfirmacao({ lado: 'CASA', fundamento: 'ataque', resultado: 'ACERTO' }, 'Marina Souza') === 'Ataque Marina, ponto')

console.log(`\n${ok} verificações ok`)
