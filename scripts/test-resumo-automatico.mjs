// Teste do resumo automático da partida em texto (pedido 30/10/2026).
import assert from 'node:assert'
import { criarSet, registrarEvento } from '../src/scoutEngine.ts'
import { gerarResumoPartida } from '../src/resumoAutomatico.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

const atletas = [{ id: 'a1', nome: 'Maria', turmaId: 't1', createdAt: '2026-01-01' }, { id: 'a2', nome: 'Ana', turmaId: 't1', createdAt: '2026-01-01' }]

function partidaBase(over) {
  return {
    id: 'p1', tipo: 'JOGO', turmaId: 't1', status: 'FINALIZADA',
    adversarioNome: 'Colégio X', data: '2026-10-01', formato: 'MELHOR_DE_5',
    setsPartida: [], setsGanhosCasa: 3, setsGanhosAdversario: 1, createdAt: '2026-10-01',
    ...over,
  }
}

// Sem nenhuma ação registrada: null (nunca inventa resumo vazio).
{
  const p = partidaBase({ setsPartida: [criarSet(1)] })
  check('Partida sem nenhuma ação: resumo null', gerarResumoPartida(p, atletas) === null)
}

// Resumo básico: resultado, melhor/pior fundamento.
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  set = registrarEvento(set, 'saque', 'ERRO', 'a1')
  const p = partidaBase({ setsPartida: [set], setsGanhosCasa: 3, setsGanhosAdversario: 1 })
  const resumo = gerarResumoPartida(p, atletas)
  check('Resumo começa com o resultado certo', resumo.startsWith('Vencemos 3 × 1 contra Colégio X.'))
  check('Resumo cita o ataque como melhor fundamento (100%)', resumo.includes('Melhor fundamento: Ataque (100%') )
  check('Resumo cita o saque como pior fundamento (-100%)', resumo.includes('Pior fundamento: Saque (-100%)'))
}

// Derrota é descrita como "Perdemos".
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  const p = partidaBase({ setsPartida: [set], setsGanhosCasa: 1, setsGanhosAdversario: 3 })
  const resumo = gerarResumoPartida(p, atletas)
  check('Derrota: resumo começa com "Perdemos"', resumo.startsWith('Perdemos 1 × 3 contra Colégio X.'))
}

// Quando só há 1 fundamento com dados, não repete "pior" igual ao "melhor".
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  const p = partidaBase({ setsPartida: [set] })
  const resumo = gerarResumoPartida(p, atletas)
  check('Só 1 fundamento com dados: não aparece frase de "pior fundamento"', !resumo.includes('Pior fundamento'))
}

// Maior sequência aparece só quando >= 3.
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  const p = partidaBase({ setsPartida: [set] })
  const resumo = gerarResumoPartida(p, atletas)
  check('Sequência de 3 pontos nossos aparece no resumo', resumo.includes('maior sequência da partida foi de 3 pontos nossos'))
}
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  const p = partidaBase({ setsPartida: [set] })
  const resumo = gerarResumoPartida(p, atletas)
  check('Sequência de só 2 pontos NÃO aparece (abaixo do mínimo)', !resumo.includes('maior sequência'))
}

// Destaque individual: com poucas ações (< 5), usa "quem mais atuou" (volume), não eficiência isolada.
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // a1: 1 ação, 100%
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a2')
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a2')
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a2') // a2: 3 ações, 100% também, mas mais volume
  const p = partidaBase({ setsPartida: [set] })
  const resumo = gerarResumoPartida(p, atletas)
  check('Com poucas ações (<5), destaque vai pra quem mais atuou (Ana, 3 ações)', resumo.includes('Destaque: Ana, com 100% de eficiência em 3 ações.'))
}

// Destaque individual: com volume suficiente (>=5), prioriza quem teve
// melhor eficiência, mesmo com menos ações que outra atleta.
{
  let set = criarSet(1)
  // a1: 5 ações, 100% de eficiência.
  for (let i = 0; i < 5; i++) set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  // a2: 8 ações, mas eficiência bem pior (alguns erros).
  for (let i = 0; i < 5; i++) set = registrarEvento(set, 'ataque', 'ACERTO', 'a2')
  for (let i = 0; i < 3; i++) set = registrarEvento(set, 'ataque', 'ERRO', 'a2')
  const p = partidaBase({ setsPartida: [set] })
  const resumo = gerarResumoPartida(p, atletas)
  check('Com volume suficiente, destaque prioriza eficiência (Maria, 100%) mesmo com menos ações que Ana', resumo.includes('Destaque: Maria, com 100% de eficiência em 5 ações.'))
}

console.log(`\n${ok}/${ok} testes passaram.`)
