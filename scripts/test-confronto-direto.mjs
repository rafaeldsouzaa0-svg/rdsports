// Teste do confronto direto contra um adversário específico (pedido 30/10/2026).
import assert from 'node:assert'
import { criarSet, registrarEvento, confrontoDireto } from '../src/scoutEngine.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

function partida(over) {
  return {
    id: over.id ?? 'p1', tipo: 'JOGO', turmaId: 't1', status: 'FINALIZADA',
    adversarioNome: 'Colégio X', data: '2026-10-01', formato: 'MELHOR_DE_5',
    setsPartida: [], setsGanhosCasa: 3, setsGanhosAdversario: 0, createdAt: '2026-10-01',
    ...over,
  }
}

// Agrupa só as partidas FINALIZADAS, da turma certa, contra o adversário certo
// (ignora maiúsculas/minúsculas e espaços extras no nome).
{
  const p1 = partida({ id: 'p1', adversarioNome: 'Colégio X', data: '2026-09-01' })
  const p2 = partida({ id: 'p2', adversarioNome: '  colégio x  ', data: '2026-10-01', setsGanhosCasa: 1, setsGanhosAdversario: 3 })
  const p3 = partida({ id: 'p3', adversarioNome: 'Outro Colégio', data: '2026-10-05' }) // adversário diferente
  const p4 = partida({ id: 'p4', adversarioNome: 'Colégio X', turmaId: 't2', data: '2026-10-10' }) // turma diferente
  const p5 = partida({ id: 'p5', adversarioNome: 'Colégio X', status: 'EM_ANDAMENTO', data: '2026-10-15' }) // não finalizada
  const r = confrontoDireto([p1, p2, p3, p4, p5], 't1', 'Colégio X')
  check('Agrupa certo por nome normalizado, turma e status: 2 jogos', r.jogos.length === 2)
  check('Jogos vêm ordenados do mais recente pro mais antigo', r.jogos[0].id === 'p2' && r.jogos[1].id === 'p1')
}

// Vitórias/derrotas contadas certo.
{
  const p1 = partida({ id: 'p1', setsGanhosCasa: 3, setsGanhosAdversario: 1 }) // vitória
  const p2 = partida({ id: 'p2', setsGanhosCasa: 0, setsGanhosAdversario: 3 }) // derrota
  const r = confrontoDireto([p1, p2], 't1', 'Colégio X')
  check('1 vitória e 1 derrota no confronto', r.vitorias === 1 && r.derrotas === 1)
}

// Eficiência geral e pior fundamento somam os sets de TODOS os jogos do confronto.
{
  let set1 = criarSet(1)
  set1 = registrarEvento(set1, 'ataque', 'ACERTO', 'a1')
  set1 = registrarEvento(set1, 'saque', 'ERRO', 'a1')
  let set2 = criarSet(1)
  set2 = registrarEvento(set2, 'ataque', 'ACERTO', 'a1')
  const p1 = partida({ id: 'p1', setsPartida: [set1] })
  const p2 = partida({ id: 'p2', setsPartida: [set2] })
  const r = confrontoDireto([p1, p2], 't1', 'Colégio X')
  check('Eficiência geral soma os sets dos 2 jogos (3 ações, 2 positivas, 1 erro)', r.eficienciaGeral.total === 3 && r.eficienciaGeral.positivo === 2 && r.eficienciaGeral.erro === 1)
  check('Pior fundamento nosso contra esse adversário é o saque (0%, o único com erro)', r.piorFundamentoNosso === 'saque')
}

// Sem nenhum confronto: zerado, nunca quebra.
{
  const r = confrontoDireto([], 't1', 'Time que nunca jogamos')
  check('Sem confrontos: tudo zerado, pior fundamento null', r.jogos.length === 0 && r.vitorias === 0 && r.derrotas === 0 && r.piorFundamentoNosso === null)
}

console.log(`\n${ok}/${ok} testes passaram.`)
