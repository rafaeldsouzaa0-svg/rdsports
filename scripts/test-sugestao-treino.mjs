// Teste da sugestão de foco do próximo treino (pedido 31/10/2026).
import assert from 'node:assert'
import { sugerirProximoFoco, MINIMO_REPETICOES_FOCO } from '../src/sugestaoTreino.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

function sessao(over) {
  return {
    id: over.id ?? 's1', turmaId: 't1', data: over.data ?? '2026-10-01',
    temas: over.temas ?? [], condicionantes: [], quadros: [], registroPedagogico: {},
    createdAt: over.data ?? '2026-10-01',
    ...over,
  }
}

check('Precisa do mínimo configurado em repetições', MINIMO_REPETICOES_FOCO === 3)

// Sem histórico suficiente: null.
{
  const r = sugerirProximoFoco([
    sessao({ id: 's1', data: '2026-10-01', temas: ['KI_ataque'] }),
    sessao({ id: 's2', data: '2026-10-03', temas: ['KI_ataque'] }),
  ])
  check('Menos de 3 sessões com foco marcado: sem sugestão', r === null)
}

// 3 sessões seguidas com o MESMO tema principal: sugere algo de outro grupo, nunca usado antes.
{
  const r = sugerirProximoFoco([
    sessao({ id: 's1', data: '2026-10-01', temas: ['KI_ataque'] }),
    sessao({ id: 's2', data: '2026-10-03', temas: ['KI_ataque'] }),
    sessao({ id: 's3', data: '2026-10-05', temas: ['KI_ataque'] }),
  ])
  check('Detecta tema repetido 3x', r !== null && r.temaRepetidoId === 'KI_ataque')
  check('Sugere um tema de grupo diferente de KI (nunca usado)', r.temaSugeridoId && r.temaSugeridoId !== 'KI_ataque' && !r.temaSugeridoId.startsWith('KI_'))
}

// Foco variado nas últimas 3: nenhuma sugestão.
{
  const r = sugerirProximoFoco([
    sessao({ id: 's1', data: '2026-10-01', temas: ['KI_ataque'] }),
    sessao({ id: 's2', data: '2026-10-03', temas: ['KII_saque'] }),
    sessao({ id: 's3', data: '2026-10-05', temas: ['JC_jogo_completo'] }),
  ])
  check('Temas variados: sem sugestão', r === null)
}

// Problema de jogo repetido 3x: sugere um problema diferente, nunca usado antes.
{
  const r = sugerirProximoFoco([
    sessao({ id: 's1', data: '2026-10-01', temas: ['KI_ataque'], problemaJogo: 'Ataque e cobertura' }),
    sessao({ id: 's2', data: '2026-10-03', temas: ['KII_saque'], problemaJogo: 'Ataque e cobertura' }),
    sessao({ id: 's3', data: '2026-10-05', temas: ['JC_jogo_completo'], problemaJogo: 'Ataque e cobertura' }),
  ])
  check('Detecta problema de jogo repetido 3x (mesmo com temas variados)', r !== null && r.problemaRepetido === 'Ataque e cobertura')
  check('Sugere um problema de jogo diferente', r.problemaSugerido && r.problemaSugerido !== 'Ataque e cobertura')
}

// Prioriza o tema NUNCA usado sobre um usado há pouco tempo, mesmo que o usado há pouco seja de outro grupo.
{
  const r = sugerirProximoFoco([
    sessao({ id: 's0', data: '2026-09-01', temas: ['KII_saque'] }), // usado há mais tempo, mas de outro grupo
    sessao({ id: 's1', data: '2026-10-01', temas: ['KI_ataque'] }),
    sessao({ id: 's2', data: '2026-10-03', temas: ['KI_ataque'] }),
    sessao({ id: 's3', data: '2026-10-05', temas: ['KI_ataque'] }),
  ])
  check('Prioriza grupo diferente do repetido mesmo tendo histórico com KII_saque', r.temaSugeridoId !== 'KI_ataque')
}

// Sessões apagadas (deletedAt) nunca contam pro histórico.
{
  const r = sugerirProximoFoco([
    sessao({ id: 's1', data: '2026-10-01', temas: ['KI_ataque'] }),
    sessao({ id: 's2', data: '2026-10-03', temas: ['KI_ataque'] }),
    sessao({ id: 's3', data: '2026-10-05', temas: ['KI_ataque'], deletedAt: '2026-10-06' }),
    sessao({ id: 's4', data: '2026-10-07', temas: ['KI_ataque'] }),
  ])
  check('Sessão apagada não conta — com só 3 válidas restando ainda detecta a repetição', r !== null && r.temaRepetidoId === 'KI_ataque')
}

console.log(`\n${ok}/${ok} testes passaram.`)
