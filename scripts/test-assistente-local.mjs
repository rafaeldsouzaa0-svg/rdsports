// Teste do Assistente grátis (21/11/2026): respostas dos 4 atalhos calculadas
// no aparelho, sem IA.
import { minhaSemana, pendencias, prepararProximoJogo, montarTreino, analisarUltimosJogos, entenderPergunta } from '../src/assistenteLocal.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}
const tem = (r, trecho) => r.linhas.some((l) => l.includes(trecho)) || r.titulo.includes(trecho)

const hoje = '2026-11-21' // sábado
const ev = (fundamento, resultado) => ({ id: Math.random().toString(), fundamento, resultado })
// Partida finalizada com recepção ruim (6 erros em 10) e saque bom (8 acertos em 10).
function partida(id, data, extra = {}) {
  const eventos = [
    ...Array.from({ length: 6 }, () => ev('recepcao', 'ERRO')), ...Array.from({ length: 4 }, () => ev('recepcao', 'BOM')),
    ...Array.from({ length: 8 }, () => ev('saque', 'ACERTO')), ...Array.from({ length: 2 }, () => ev('saque', 'ERRO')),
  ]
  return {
    id, tipo: 'JOGO', turmaId: 't1', adversarioNome: 'Vértice', formato: 'MELHOR_DE_3', data, status: 'FINALIZADA',
    setsGanhosCasa: 1, setsGanhosAdversario: 2, createdAt: '',
    setsPartida: [{ id: 's', numero: 1, rallies: [{ id: 'r', numero: 1, eventos }] }], ...extra,
  }
}
const dados = {
  escolas: [{ id: 'e1', nome: 'Aubrick' }, { id: 'e2', nome: 'Escola Teste' }],
  turmas: [{ id: 't1', escolaId: 'e1', nome: 'Sub-15' }, { id: 't2', escolaId: 'e2', nome: 'X' }],
  partidas: [
    partida('p1', '2026-10-14'),
    partida('p2', '2026-11-01', { adversarioNome: 'Santa Cruz', status: 'EM_ANDAMENTO', setsGanhosCasa: 1, setsGanhosAdversario: 0 }),
    partida('p3', '2026-11-05', { adversarioNome: 'time teste' }),
  ],
  jogosAgendados: [
    { id: 'j1', turmaId: 't1', adversarioNome: 'Vértice', data: '2026-11-25', horario: '14:30', createdAt: '' },
    { id: 'j2', turmaId: 't1', adversarioNome: 'Objetivo', data: '2026-11-10', createdAt: '' },
    { id: 'j3', turmaId: 't2', adversarioNome: 'Qualquer', data: '2026-11-24', createdAt: '' },
    { id: 'j4', turmaId: 't1', adversarioNome: 'Excluído', data: '2026-11-23', createdAt: '', deletedAt: 'x' },
  ],
  horariosTreino: [{ id: 'h1', turmaId: 't1', diaSemana: 1, horario: '16:00' }],
  sessoesTreino: [],
  bibliotecaExercicios: [{ id: 'x1', nome: 'Recepção em W', temas: ['KI_recepcao'], tempoMin: 15 }],
}

const semana = minhaSemana(dados, hoje)
assert(tem(semana, 'Vértice') && tem(semana, 'sem convocadas'), 'semana mostra o jogo de terça e avisa sem convocadas')
assert(tem(semana, 'Seg 23/11') && tem(semana, '16:00'), 'semana mostra o treino fixo de segunda')
assert(!tem(semana, 'Qualquer'), 'semana ignora turma de teste')
assert(!tem(semana, 'Excluído'), 'semana ignora jogo excluído')
assert(semana.linhas[0].includes('Seg 23/11'), 'semana em ordem de data')

const pend = pendencias(dados, hoje)
assert(tem(pend, 'Jogo sem scout') && tem(pend, 'Objetivo'), 'jogo agendado no passado aparece como sem scout')
assert(tem(pend, 'Partida não finalizada') && tem(pend, 'Santa Cruz'), 'partida em andamento aparece')
assert(tem(pend, 'Sem convocadas') && tem(pend, 'Vértice'), 'jogo próximo sem convocadas aparece')
assert(!tem(pend, 'teste') && !tem(pend, 'Qualquer'), 'pendências ignoram registros de teste')
assert(pendencias({ ...dados, partidas: [], jogosAgendados: [] }, hoje).linhas[0].includes('Tudo em dia'), 'sem pendências → tudo em dia')

const analise = analisarUltimosJogos(dados, 't1')
assert(analise.pior?.fundamento === 'recepcao', 'pior fundamento = recepção')
assert(analise.melhor?.fundamento === 'saque', 'melhor fundamento = saque')
assert(analise.jogosAnalisados === 1, 'só conta partida finalizada e que não é de teste')

const jogos = prepararProximoJogo(dados, hoje)
assert(jogos.length === 1, 'um jogo na semana → um cartão')
const jogo = jogos[0]
assert(jogo.titulo.includes('Aubrick Sub-15') && jogo.titulo.includes('Vértice'), 'próximo jogo = Aubrick Sub-15 × Vértice')
assert(tem(jogo, '1 jogo, 0 vitórias e 1 derrota'), 'histórico contra o adversário')
assert(tem(jogo, 'Precisa cuidar: **Recepção**'), 'aponta recepção pra cuidar')
assert(tem(jogo, 'Ainda sem convocadas'), 'avisa que faltam convocadas')
assert(prepararProximoJogo({ ...dados, jogosAgendados: [] }, hoje)[0].linhas[0].includes('Não há jogo'), 'sem jogo agendado → avisa')

const treinos = montarTreino(dados, hoje)
assert(treinos.length === 1, 'um jogo na semana → um cartão de treino')
const treino = treinos[0]
assert(tem(treino, 'Foco sugerido: Recepção'), 'treino focado em recepção')
assert(tem(treino, 'Recepção em W'), 'sugere exercício da biblioteca com o tema')
assert(treino.acoes.some((a) => a.para === '/treinos/registrar?turma=t1'), 'tem atalho pra só registrar o que teve')

// Pedido 21/11/2026: dois jogos na semana → um cartão de treino pra cada jogo.
const doisJogos = { ...dados, turmas: [...dados.turmas, { id: 't3', escolaId: 'e1', nome: 'Sub-13' }],
  jogosAgendados: [...dados.jogosAgendados, { id: 'j5', turmaId: 't3', adversarioNome: 'Dante', data: '2026-11-27', createdAt: '' }] }
const varios = montarTreino(doisJogos, hoje)
assert(varios.length === 2, 'dois jogos na semana → dois cartões')
assert(varios[0].linhas[0].includes('Vértice') && varios[1].linhas[0].includes('Dante'), 'um cartão por jogo, em ordem de data')
assert(varios[1].titulo.includes('Sub-13'), 'cada cartão é da turma do seu jogo')
const foraDaSemana = { ...dados, jogosAgendados: [{ id: 'j9', turmaId: 't1', adversarioNome: 'Longe', data: '2026-12-10', createdAt: '' }] }
assert(montarTreino(foraDaSemana, hoje).length === 1 && montarTreino(foraDaSemana, hoje)[0].linhas[0].includes('Longe'), 'sem jogo na semana → usa o próximo jogo')

assert(entenderPergunta('Quais são minhas pendências?') === 'pendencias', 'entende "pendências"')
assert(entenderPergunta('como tá minha semana') === 'semana', 'entende "semana"')
assert(entenderPergunta('prepara o jogo de terça') === 'jogo', 'entende "jogo"')
assert(entenderPergunta('monta um treino pra segunda') === 'treino', 'entende "treino"')
assert(entenderPergunta('qual a capital da França') === null, 'pergunta livre → não entende (sugere o Claude)')

// Pedido 21/11/2026 (foto do Rafael): dois jogos no mesmo dia → um cartão pra cada.
const mesmoDia = { ...dados, turmas: [...dados.turmas, { id: 't3', escolaId: 'e1', nome: '8º ano' }],
  jogosAgendados: [
    { id: 'a', turmaId: 't1', adversarioNome: 'Lourenço Castanho', data: '2026-11-25', horario: '17:00:00', createdAt: '' },
    { id: 'b', turmaId: 't3', adversarioNome: 'Pueri Domus', data: '2026-11-25', horario: '18:00:00', createdAt: '' },
  ] }
const prep = prepararProximoJogo(mesmoDia, hoje)
assert(prep.length === 2, 'dois jogos no mesmo dia → dois cartões em Preparar próximo jogo')
assert(prep[0].titulo.includes('Lourenço') && prep[1].titulo.includes('Pueri'), 'em ordem de horário')
assert(prep[0].linhas[0].includes('17:00') && !prep[0].linhas[0].includes('17:00:00'), 'horário sem segundos')
assert(!minhaSemana(mesmoDia, hoje).linhas.some((l) => l.includes(':00:00')), 'semana mostra horário sem segundos')
const longe = { ...dados, jogosAgendados: [{ id: 'z', turmaId: 't1', adversarioNome: 'Longe', data: '2026-12-10', createdAt: '' }] }
assert(prepararProximoJogo(longe, hoje).length === 1 && prepararProximoJogo(longe, hoje)[0].titulo.includes('Longe'), 'sem jogo na semana → o próximo jogo')

if (falhas) { console.error(`${falhas} falha(s)`); process.exit(1) }
