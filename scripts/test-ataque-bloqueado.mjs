// Ataque bloqueado (pedido 27/11/2026): continua sendo erro de ataque (ponto
// deles), mas com o detalhe BLOQUEADO, separado nas estatísticas e na voz.
import assert from 'node:assert'
import { criarSet, registrarEvento, scoutEquipe } from '../src/scoutEngine.ts'
import { marcarDetalheErro, ehAtaqueBloqueado, TIPO_BLOQUEADO } from '../src/bloqueio.ts'
import { origemDosPontos, estatisticasPorAtleta } from '../src/estatisticasCompletas.ts'
import { ataquePorFase } from '../src/analiseAvancada.ts'
import { interpretarFala, fraseConfirmacao } from '../src/scoutVoz.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

let s = criarSet(1)
s = marcarDetalheErro(registrarEvento(s, 'ataque', 'ERRO', 'duda'), TIPO_BLOQUEADO) // 0-1 bloqueado
s = registrarEvento(s, 'ataque', 'ERRO', 'duda') // 0-2 erro comum
s = registrarEvento(s, 'ataque', 'ACERTO', 'duda') // 1-2
s = marcarDetalheErro(s, null) // sem detalhe: nada muda
const ev = s.rallies.flatMap((r) => r.eventos)

check('Bloqueado conta ponto pro adversário (placar 1 x 2)', s.placarCasa === 1 && s.placarAdversario === 2)
check('Só o primeiro ataque é bloqueado', ehAtaqueBloqueado(ev[0]) && !ehAtaqueBloqueado(ev[1]) && !ehAtaqueBloqueado(ev[2]))
check('Bloqueado continua sendo erro na eficiência (2 erros, 1 ponto)', scoutEquipe([s]).ataque.erro === 2 && scoutEquipe([s]).ataque.positivo === 1)

const origem = Object.fromEntries(origemDosPontos([s]).perdidos.map((x) => [x.chave, x.valor]))
check('De onde vêm os pontos: 1 ataque bloqueado e 1 erro de ataque', origem.ataque_bloqueado === 1 && origem.erro_ataque === 1)

const duda = estatisticasPorAtleta([{ id: 'p', setsPartida: [s] }]).find((l) => l.atletaId === 'duda')
check('Atleta: 1 ataque bloqueado, 2 erros que deram ponto', duda.ataquesBloqueados === 1 && duda.errosQueDeramPonto === 2)

const fase = ataquePorFase([s])
check('K2 (sem recepção): 1 bloqueado de 3 (33%)', fase.k2.bloqueados === 1 && fase.k2.bloqueadoPct === 33)

// Voz
const atl = (id, nome) => ({ id, nome })
const ctx = { emQuadra: [atl('du', 'Duda'), atl('ma', 'Marina')], todas: [atl('du', 'Duda'), atl('ma', 'Marina')], sacadoraId: null }
const f = (t) => interpretarFala(t, ctx)
check('"ataque Duda bloqueado" -> ataque, erro, bloqueado', f('ataque Duda bloqueado').fundamento === 'ataque' && f('ataque Duda bloqueado').resultado === 'ERRO' && f('ataque Duda bloqueado').tipoErro === TIPO_BLOQUEADO && f('ataque Duda bloqueado').faltando.length === 0)
check('"Duda foi bloqueada" (sem dizer ataque) -> ataque bloqueado', f('Duda foi bloqueada').fundamento === 'ataque' && f('Duda foi bloqueada').tipoErro === TIPO_BLOQUEADO)
check('"bloqueio Marina ponto" continua sendo bloqueio nosso', f('bloqueio Marina ponto').fundamento === 'bloqueio' && f('bloqueio Marina ponto').resultado === 'ACERTO' && !f('bloqueio Marina ponto').tipoErro)
check('"ataque Duda erro" não vira bloqueado', !f('ataque Duda erro').tipoErro)
check('Confirmação fala "bloqueado"', fraseConfirmacao({ lado: 'CASA', fundamento: 'ataque', resultado: 'ERRO', tipoErro: TIPO_BLOQUEADO }, 'Duda Alves') === 'Ataque Duda, bloqueado')

console.log(`\n${ok} verificações ok`)
