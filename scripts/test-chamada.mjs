// Teste da chamada dos treinos e da frequência (pedido 21/11/2026).
import { idDaChamada, marcarNaChamada, marcarTodasPresentes, chamadaDoDia, frequenciaPorAtleta, historicoChamadas } from '../src/chamada.ts'
import { mesclarPorId } from '../src/store.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const T = 'turma-sub13'
const T2 = 'turma-sub11'
const [ANA, BIA, CAU] = ['ana', 'bia', 'cau']
const t1 = '2026-11-21T10:00:00.000Z'
const t2 = '2026-11-21T10:05:00.000Z'

assert(idDaChamada(T, '2026-11-20') === idDaChamada(T, '2026-11-20'), 'Mesma turma e dia = mesmo id (em qualquer aparelho)')
assert(idDaChamada(T, '2026-11-20') !== idDaChamada(T, '2026-11-21'), 'Dias diferentes = ids diferentes')
assert(idDaChamada(T, '2026-11-20') !== idDaChamada(T2, '2026-11-20'), 'Turmas diferentes = ids diferentes')
assert(/^[0-9a-f-]{36}$/.test(idDaChamada(T, '2026-11-20')), 'Id no formato que o banco aceita (uuid)')

let ch = []
ch = marcarNaChamada(ch, T, '2026-11-20', ANA, true, t1)
ch = marcarNaChamada(ch, T, '2026-11-20', BIA, false, t1)
assert(ch.length === 1, 'Duas marcações no mesmo dia ficam numa chamada só')
assert(chamadaDoDia(ch, T, '2026-11-20').presencas[ANA] === true, 'Ana veio')
assert(chamadaDoDia(ch, T, '2026-11-20').presencas[BIA] === false, 'Bia faltou')

const antes = ch
ch = marcarNaChamada(ch, T, '2026-11-20', BIA, null, t2)
assert(chamadaDoDia(ch, T, '2026-11-20').presencas[BIA] === undefined, 'Desmarcar tira a Bia da chamada')
assert(antes[0].presencas[BIA] === false, 'A lista antiga não é alterada (estado imutável)')
assert(chamadaDoDia(ch, T, '2026-11-20').updatedAt === t2, 'Marcar atualiza a data de alteração (pra sincronizar)')

ch = marcarTodasPresentes(ch, T, '2026-11-20', [ANA, BIA, CAU], t2)
const dia20 = chamadaDoDia(ch, T, '2026-11-20').presencas
assert(dia20[BIA] === true && dia20[CAU] === true, '"Marcar as outras" marca quem faltava marcar')

ch = marcarNaChamada(ch, T, '2026-11-18', ANA, true, t1)
ch = marcarNaChamada(ch, T, '2026-11-18', BIA, false, t1)
ch = marcarNaChamada(ch, T, '2026-11-16', BIA, false, t1)
ch = marcarNaChamada(ch, T2, '2026-11-18', CAU, false, t1)

const freq = frequenciaPorAtleta(ch, T)
assert(freq[ANA].presencas === 2 && freq[ANA].total === 2 && freq[ANA].percentual === 100, 'Ana: 2 de 2 treinos = 100%')
assert(freq[BIA].presencas === 1 && freq[BIA].faltas === 2 && freq[BIA].percentual === 33, 'Bia: 1 de 3 = 33%')
assert(freq[CAU].total === 1 && freq[CAU].percentual === 100, 'Cau: só conta a turma pedida (falta na outra turma fica de fora)')
assert(frequenciaPorAtleta(ch, null)[CAU].total === 2, 'Sem turma: soma todas as turmas (usado na convocação)')
assert(frequenciaPorAtleta(ch, T, '2026-11-18')[BIA].total === 2, 'Filtro por período funciona')

const hist = historicoChamadas(ch, T)
assert(hist.map((c) => c.data).join() === '2026-11-20,2026-11-18,2026-11-16', 'Histórico do mais recente pro mais antigo')

// Dois aparelhos fazendo a chamada do mesmo dia: mesmo id, fica a mais nova.
const celular = marcarNaChamada([], T, '2026-11-21', ANA, true, '2026-11-21T10:00:00.000Z')
const tablet = marcarNaChamada([], T, '2026-11-21', ANA, false, '2026-11-21T10:09:00.000Z')
const mesclado = mesclarPorId(celular, tablet)
assert(mesclado.length === 1 && mesclado[0].presencas[ANA] === false, 'Mesma chamada em 2 aparelhos não duplica; vale a mais nova')

if (falhas > 0) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nTodos os testes da chamada passaram.')
