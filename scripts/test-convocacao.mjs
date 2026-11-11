// Teste da convocação (pedido 11/11/2026): data de nascimento → idade,
// reforços só das turmas DE BAIXO da MESMA escola, prioridade da turma
// principal e a lista de atletas que o scout mostra.
import {
  calcularIdade, formatarDataBR, nivelDaTurma, turmasDeBaixo, montarListaConvocacao,
  convocacaoInicial, principaisDeForaComReforco, atletasDaPartida,
} from '../src/convocacao.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

// --- Idade pela data de nascimento ---
const hoje = new Date(2026, 10, 11) // 11/11/2026
assert(calcularIdade('2012-03-14', hoje) === 14, 'nasceu em 14/03/2012 → 14 anos em 11/11/2026')
assert(calcularIdade('2012-11-11', hoje) === 14, 'faz aniversário hoje → já conta o ano novo')
assert(calcularIdade('2012-11-12', hoje) === 13, 'aniversário amanhã → ainda não fez')
assert(calcularIdade('2030-01-01', hoje) === undefined, 'data no futuro não vira idade')
assert(calcularIdade('', hoje) === undefined && calcularIdade(undefined, hoje) === undefined, 'sem data → sem idade')
assert(formatarDataBR('2012-03-14') === '14/03/2012', 'data aparece no formato brasileiro')

// --- Nível das turmas ---
assert(nivelDaTurma({ nome: '8º ano' }) === 8, 'nível tirado do nome "8º ano"')
assert(nivelDaTurma({ nome: 'Sub-13' }) === 13, 'nível tirado do nome "Sub-13"')
assert(nivelDaTurma({ nome: 'Mirim', nivel: 2 }) === 2, 'campo nível vale mais que o nome')
assert(nivelDaTurma({ nome: 'Mirim' }) === undefined, 'sem número e sem campo → sem nível')

const t6 = { id: 't6', escolaId: 'A', nome: '6º ano', createdAt: '' }
const t7 = { id: 't7', escolaId: 'A', nome: '7º ano', createdAt: '' }
const t8 = { id: 't8', escolaId: 'A', nome: '8º ano', createdAt: '' }
const t9 = { id: 't9', escolaId: 'A', nome: '9º ano', createdAt: '' }
const outra7 = { id: 'x7', escolaId: 'B', nome: '7º ano', createdAt: '' }
const excluida = { id: 'e5', escolaId: 'A', nome: '5º ano', createdAt: '', deletedAt: '2026-01-01' }
const turmas = [t6, t7, t8, t9, outra7, excluida]

const baixo = turmasDeBaixo(t8, turmas).map((t) => t.id)
assert(JSON.stringify(baixo) === JSON.stringify(['t7', 't6']), 'turmas de baixo do 8º: 7º e 6º, a mais próxima primeiro')
assert(!baixo.includes('t9'), 'turma de CIMA nunca entra como reforço')
assert(!baixo.includes('x7'), 'turma de OUTRA escola nunca entra como reforço')
assert(!baixo.includes('e5'), 'turma excluída não entra')
assert(turmasDeBaixo({ id: 'm', escolaId: 'A', nome: 'Mirim', createdAt: '' }, turmas).length === 0, 'turma sem nível → sem reforços')

// --- Lista de convocação e prioridade ---
const at = (id, nome, turmaId, extra = {}) => ({ id, nome, turmaId, status: 'ATIVA', createdAt: '', ...extra })
const atletas = [
  at('a1', 'Bia', 't8'), at('a2', 'Ana', 't8'), at('a3', 'Carla', 't8'),
  at('r1', 'Duda', 't7'), at('r2', 'Eva', 't6'),
  at('c1', 'Fê', 't9'), at('o1', 'Gabi', 'x7'),
  at('afast', 'Helô', 't8', { status: 'AFASTADA' }), at('del', 'Iara', 't8', { deletedAt: '2026-01-01' }),
]
const lista = montarListaConvocacao(t8, turmas, atletas)
assert(JSON.stringify(lista.principais.map((a) => a.id)) === JSON.stringify(['a2', 'a1', 'a3']), 'turma principal em ordem alfabética, sem afastada nem excluída')
assert(JSON.stringify(lista.reforcos.map((g) => g.turma.id)) === JSON.stringify(['t7', 't6']), 'reforços agrupados por turma de baixo')

const inicial = convocacaoInicial(lista)
assert(inicial.length === 3 && !inicial.includes('r1') && !inicial.includes('r2'), 'convocação nova: turma principal toda marcada, nenhum reforço')

assert(principaisDeForaComReforco(lista, ['a1', 'a2']).length === 0, 'sem reforço marcado → não avisa, mesmo com alguém de fora')
const deFora = principaisDeForaComReforco(lista, ['a1', 'a2', 'r1'])
assert(deFora.length === 1 && deFora[0].id === 'a3', 'reforço marcado com atleta da principal de fora → avisa quem ficou de fora')
assert(principaisDeForaComReforco(lista, ['a1', 'a2', 'a3', 'r1']).length === 0, 'principal completa + reforço → nada a avisar')

// --- O que o scout mostra ---
const noJogo = atletasDaPartida({ turmaId: 't8', convocadas: ['r2', 'a1', 'r1', 'a2'] }, atletas, turmas)
assert(JSON.stringify(noJogo.map((x) => x.atleta.id)) === JSON.stringify(['a2', 'a1', 'r1', 'r2']), 'scout: principal primeiro, depois reforços (7º antes do 6º)')
assert(noJogo[0].reforcoDe === undefined && noJogo[2].reforcoDe === '7º ano' && noJogo[3].reforcoDe === '6º ano', 'scout: reforço mostra a turma de origem')
assert(!noJogo.some((x) => x.atleta.id === 'a3'), 'scout: quem não foi convocada não aparece')

const semConvocacao = atletasDaPartida({ turmaId: 't8' }, atletas, turmas).map((x) => x.atleta.id)
assert(semConvocacao.includes('a3') && semConvocacao.includes('afast') && !semConvocacao.includes('r1'), 'treino/partida antiga sem convocação: turma inteira, como antes')

if (falhas > 0) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nConvocação: tudo certo.')
