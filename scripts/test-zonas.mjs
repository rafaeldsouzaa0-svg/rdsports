// Teste das zonas de destino (quadrinha de 9 zonas, pedido 27/11/2026).
import assert from 'node:assert'
import { criarSet, registrarEvento, registrarEventoTime } from '../src/scoutEngine.ts'
import { separarPorZona, carimbarZona, desempenhoPorZona, zonaParaBanco, zonaDoBanco, zonaValida, DESENHO_QUADRA } from '../src/zonas.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

check('Desenho igual à prancheta: 4 3 2 / 7 8 9 / 5 6 1', JSON.stringify(DESENHO_QUADRA) === '[[4,3,2],[7,8,9],[5,6,1]]')
check('Zonas 1 a 9 valem; 0, 10 e texto não', zonaValida('1') && zonaValida(9) && !zonaValida(0) && !zonaValida('10') && !zonaValida('x') && !zonaValida(undefined))
check('Ida pro banco: "7" -> 7; vazio -> null', zonaParaBanco('7') === 7 && zonaParaBanco(undefined) === null && zonaParaBanco('12') === null)
check('Volta do banco: 9 -> "9"; null -> undefined', zonaDoBanco(9) === '9' && zonaDoBanco(null) === undefined)

// Carimbar a zona no último lance
{
  let s = criarSet(1)
  s = registrarEvento(s, 'saque', 'EM_JOGO', 'ana')
  s = carimbarZona(s, '1')
  s = registrarEvento(s, 'recepcao', 'BOM', 'x') // não muda a zona do saque
  s = registrarEvento(s, 'ataque', 'ACERTO', 'bia')
  s = carimbarZona(s, '4')
  const ev = s.rallies.flatMap((r) => r.eventos)
  check('Saque ficou com zona 1', ev[0].zona === '1')
  check('Recepção ficou sem zona', ev[1].zona === undefined)
  check('Ataque ficou com zona 4', ev[2].zona === '4')
  check('Placar não muda ao carimbar', s.placarCasa === 1 && s.placarAdversario === 0)
  const sem = carimbarZona(s, null)
  check('Sem zona escolhida: nada muda', sem === s)
  check('Set vazio: nada muda', carimbarZona(criarSet(1), '3').rallies.length === 0)
}

// Desempenho por zona
{
  let s = criarSet(1)
  const atq = (res, atleta, z) => { s = registrarEvento(s, 'ataque', res, atleta); if (z) s = carimbarZona(s, z) }
  atq('ACERTO', 'bia', '1')
  atq('ACERTO', 'bia', '1')
  atq('ERRO', 'bia', '1')
  atq('EM_JOGO', 'duda', '7')
  atq('ACERTO', 'duda', '9')
  atq('ERRO', 'duda', null) // sem zona
  s = registrarEventoTime(s, 'ADVERSARIO', 'ataque', 'ACERTO')
  s = carimbarZona(s, '5') // ataque do adversário não entra
  const d = desempenhoPorZona([s], 'ataque')
  check('5 bolas com zona, 1 sem', d.comZona === 5 && d.semZona === 1)
  check('Zona 1: 3 bolas, 2 pontos, 1 erro, efic. 33%, 60% das bolas', d.porZona[1].total === 3 && d.porZona[1].eficiencia === 33 && d.porZona[1].pct === 60)
  check('Zona 1: 67% das bolas viraram ponto', d.porZona[1].pctPonto === 67)
  check('Zona 7 e 9 contam (faixa do meio)', d.porZona[7].total === 1 && d.porZona[9].pontos === 1)
  check('Ataque do adversário fica de fora', d.porZona[5].total === 0)
  const bia = desempenhoPorZona([s], 'ataque', 'bia')
  check('Filtro por atleta: Bia só na zona 1 (100%)', bia.comZona === 3 && bia.porZona[1].pct === 100)
  check('Saque: nada marcado', desempenhoPorZona([s], 'saque').comZona === 0)
}

// Envio pra nuvem: lance sem zona vai SEM a coluna (não apaga zona antiga)
{
  const { comZona, semZona } = separarPorZona([{ id: 'a', zona: 4 }, { id: 'b' }, { id: 'c', zona: 9 }])
  check('Separa lances com e sem zona', comZona.length === 2 && semZona.length === 1 && !('zona' in semZona[0]))
}

console.log(`\n${ok} verificações ok`)
