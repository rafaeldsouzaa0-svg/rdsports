// Bug real 21/11/2026: no scout ao vivo, pontos marcados "voltavam". O envio
// anterior deixava a partida da nuvem com updated_at mais novo e, no ciclo
// seguinte, a cópia da nuvem (sem os pontos novos) passava por cima da do
// aparelho. Agora partida com `pendenteEnvio` nunca é trocada pela da nuvem.
import { mesclarPartidas } from '../src/store.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const partida = (id, rallies, extra = {}) => ({ id, tipo: 'JOGO', turmaId: 't', formato: 'MELHOR_DE_3', data: '2026-11-21', status: 'EM_ANDAMENTO', setsPartida: [{ id: 's', numero: 1, placarCasa: rallies, placarAdversario: 0, rallies: [], finalizado: false }], setsGanhosCasa: 0, setsGanhosAdversario: 0, createdAt: '2026-11-21T10:00:00Z', ...extra })

// Aparelho marcou o 3º ponto; a nuvem ainda tem 2 pontos, mas com updated_at mais novo.
const local = [partida('p1', 3, { updatedAt: '2026-11-21T22:00:00Z', pendenteEnvio: true })]
const nuvem = [partida('p1', 2, { updatedAt: '2026-11-21T22:00:05Z' })]
let r = mesclarPartidas(local, nuvem)
assert(r[0].setsPartida[0].placarCasa === 3, 'Partida pendente no aparelho NÃO é trocada pela da nuvem (o ponto não volta)')

// Depois do envio confirmado (sem pendência), a nuvem mais nova vale de novo.
const localEnviado = [partida('p1', 3, { updatedAt: '2026-11-21T22:00:00Z', pendenteEnvio: false })]
const nuvemNova = [partida('p1', 3, { updatedAt: '2026-11-21T22:00:10Z' })]
r = mesclarPartidas(localEnviado, nuvemNova)
assert(r[0].updatedAt === '2026-11-21T22:00:10Z', 'Sem pendência: a versão mais nova da nuvem entra (outro aparelho continua vendo as mudanças)')

// Partida nova vinda de outro aparelho sempre entra, mesmo com outra pendente.
r = mesclarPartidas(local, [...nuvem, partida('p2', 0, { updatedAt: '2026-11-21T22:01:00Z' })])
assert(r.length === 2 && r.find((p) => p.id === 'p2') && r.find((p) => p.id === 'p1').setsPartida[0].placarCasa === 3, 'Partida nova de outro aparelho entra, e a pendente continua protegida')

// Sem nada pendente e sem mudança: devolve a mesma lista (não dispara sincronização à toa).
const igual = [partida('p1', 3, { updatedAt: 'X' })]
assert(mesclarPartidas(igual, [partida('p1', 3, { updatedAt: 'X' })]) === igual, 'Nada mudou: mesma lista')

if (falhas) { console.error(`${falhas} falha(s)`); process.exit(1) }
