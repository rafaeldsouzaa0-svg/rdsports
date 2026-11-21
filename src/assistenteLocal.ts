// Assistente "sem IA" (pedido 21/11/2026 — caminho grátis): as respostas dos
// botões do Assistente são calculadas aqui, no próprio aparelho, com os dados
// que o app já tem (jogos agendados, partidas/scout, horários e sessões de
// treino, biblioteca). Não custa nada, responde na hora e funciona sem
// internet. Perguntas livres ficam pro Claude (fora do app).
// Funções puras, testadas em scripts/test-assistente-local.mjs.
import type { Escola, Turma, Partida, JogoAgendado, HorarioTreino, SessaoTreino, ExercicioBiblioteca, FundamentoScout } from './types'
import { scoutEquipe, LABEL_FUNDAMENTO, confrontoDireto, type LinhaFundamento } from './scoutEngine'
import { sugerirProximoFoco, temaLabel } from './sugestaoTreino'
import { checklistDoJogo } from './proximoJogo'
import { parseDataLocal, isoDia } from './utils'

export interface DadosAssistente {
  escolas: Escola[]; turmas: Turma[]; partidas: Partida[]; jogosAgendados: JogoAgendado[]
  horariosTreino: HorarioTreino[]; sessoesTreino: SessaoTreino[]; bibliotecaExercicios: ExercicioBiblioteca[]
}

/** Uma resposta do assistente: título, linhas (aceitam **negrito**) e atalhos
 *  pra abrir a tela certa do app. */
export interface RespostaAssistente {
  titulo: string
  linhas: string[]
  acoes?: { rotulo: string; para: string }[]
}

export type TipoPergunta = 'semana' | 'pendencias' | 'jogo' | 'treino'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
/** Fundamentos "de verdade" usados pra achar ponto forte/fraco (os 3 pontos
 *  específicos têm pouco volume e distorcem a comparação). */
const FUNDAMENTOS_BASE: FundamentoScout[] = ['saque', 'recepcao', 'levantamento', 'ataque', 'bloqueio', 'defesa']
/** Mínimo de ações num fundamento pra ele entrar na comparação. */
const MINIMO_ACOES = 5
/** Tema de treino (TEMAS_TREINO) que trabalha cada fundamento. */
export const TEMA_DO_FUNDAMENTO: Partial<Record<FundamentoScout, string>> = {
  saque: 'KII_saque', recepcao: 'KI_recepcao', levantamento: 'KI_levantamento',
  ataque: 'KI_ataque', bloqueio: 'KII_bloqueio', defesa: 'KII_defesa',
}

/** Registros de teste (nome com "teste") ficam fora das respostas. */
function ehTeste(...nomes: (string | undefined)[]): boolean {
  return nomes.some((n) => !!n && /teste/i.test(n))
}

/** "1 jogo", "2 jogos", "0 derrotas". */
export function plural(n: number, singular: string, pluralTexto = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

/** "17:00:00" (vindo da nuvem) → "17:00". */
export function horaCurta(h: string | undefined): string {
  return h ? h.slice(0, 5) : ''
}

function diaCurto(data: string): string {
  const d = parseDataLocal(data)
  return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function somaDias(hoje: string, n: number): string {
  const d = parseDataLocal(hoje)
  d.setDate(d.getDate() + n)
  return isoDia(d)
}

function nomeTurma(dados: DadosAssistente, turmaId: string): string {
  const turma = dados.turmas.find((t) => t.id === turmaId)
  if (!turma) return 'Turma'
  const escola = dados.escolas.find((e) => e.id === turma.escolaId)
  return escola ? `${escola.nome} ${turma.nome}` : turma.nome
}

function turmaEhTeste(dados: DadosAssistente, turmaId: string): boolean {
  const turma = dados.turmas.find((t) => t.id === turmaId)
  if (!turma) return false
  const escola = dados.escolas.find((e) => e.id === turma.escolaId)
  return !!turma.deletedAt || ehTeste(turma.nome, escola?.nome)
}

function jogosValidos(dados: DadosAssistente): JogoAgendado[] {
  return dados.jogosAgendados.filter((j) => !j.deletedAt && !ehTeste(j.adversarioNome) && !turmaEhTeste(dados, j.turmaId))
}

function partidasValidas(dados: DadosAssistente): Partida[] {
  return dados.partidas.filter((p) => !p.deletedAt && p.tipo === 'JOGO' && !ehTeste(p.adversarioNome) && !turmaEhTeste(dados, p.turmaId))
}

function ordenarJogos(a: JogoAgendado, b: JogoAgendado): number {
  return a.data.localeCompare(b.data) || (a.horario ?? '').localeCompare(b.horario ?? '')
}

// --- Minha semana ---
export function minhaSemana(dados: DadosAssistente, hoje: string): RespostaAssistente {
  const fim = somaDias(hoje, 6)
  type Item = { data: string; hora: string; texto: string }
  const itens: Item[] = []

  for (const j of jogosValidos(dados).filter((j) => j.data >= hoje && j.data <= fim)) {
    const semConvocadas = !j.convocadas || j.convocadas.length === 0
    itens.push({
      data: j.data, hora: j.horario ?? '',
      texto: `**${diaCurto(j.data)}** — Jogo ${nomeTurma(dados, j.turmaId)} × ${j.adversarioNome}${j.horario ? `, ${horaCurta(j.horario)}` : ''}${j.local ? ` (${j.local})` : ''}${semConvocadas ? '\n   ⚠️ ainda sem convocadas' : ''}`,
    })
  }
  // Treinos fixos da grade (horários) — um por dia/turma.
  for (let i = 0; i <= 6; i++) {
    const dia = somaDias(hoje, i)
    const diaSemana = parseDataLocal(dia).getDay()
    for (const h of dados.horariosTreino) {
      if (h.deletedAt || h.diaSemana !== diaSemana || turmaEhTeste(dados, h.turmaId)) continue
      const sessao = dados.sessoesTreino.find((s) => !s.deletedAt && s.turmaId === h.turmaId && s.data === dia)
      itens.push({
        data: dia, hora: h.horario,
        texto: `**${diaCurto(dia)}** — Treino ${nomeTurma(dados, h.turmaId)}, ${horaCurta(h.horario)}${sessao ? ' (treino já montado ✓)' : ''}`,
      })
    }
  }
  // Sessões de treino montadas em dias que não estão na grade fixa.
  for (const s of dados.sessoesTreino) {
    if (s.deletedAt || !s.data || s.data < hoje || s.data > fim || turmaEhTeste(dados, s.turmaId)) continue
    const diaSemana = parseDataLocal(s.data).getDay()
    if (dados.horariosTreino.some((h) => !h.deletedAt && h.turmaId === s.turmaId && h.diaSemana === diaSemana)) continue
    itens.push({ data: s.data, hora: '', texto: `**${diaCurto(s.data)}** — Treino ${nomeTurma(dados, s.turmaId)} (treino montado)` })
  }

  itens.sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora))
  const titulo = `Sua semana (${diaCurto(hoje).slice(4)} a ${diaCurto(fim).slice(4)})`
  if (itens.length === 0) {
    return { titulo, linhas: ['Nenhum jogo ou treino nos próximos 7 dias.'], acoes: [{ rotulo: 'Abrir Calendário', para: '/calendario' }] }
  }
  return { titulo, linhas: itens.map((i) => i.texto), acoes: [{ rotulo: 'Abrir Calendário', para: '/calendario' }] }
}

// --- Pendências ---
export function pendencias(dados: DadosAssistente, hoje: string): RespostaAssistente {
  const linhas: string[] = []
  const jogos = jogosValidos(dados)

  // Jogo agendado com data passada: quando o scout começa pelo Calendário o
  // agendamento some; se ainda está lá, o jogo não teve scout (ou não foi lançado).
  const semScout = jogos.filter((j) => j.data < hoje).sort(ordenarJogos)
  for (const j of semScout) linhas.push(`📋 **Jogo sem scout** — ${diaCurto(j.data)}, ${nomeTurma(dados, j.turmaId)} × ${j.adversarioNome}`)

  const emAndamento = partidasValidas(dados).filter((p) => p.status === 'EM_ANDAMENTO').sort((a, b) => a.data.localeCompare(b.data))
  for (const p of emAndamento) linhas.push(`⏸️ **Partida não finalizada** — ${diaCurto(p.data)}, ${nomeTurma(dados, p.turmaId)} × ${p.adversarioNome ?? 'Adversário'} (${p.setsGanhosCasa}×${p.setsGanhosAdversario})`)

  const limite = somaDias(hoje, 14)
  const semConvocadas = jogos.filter((j) => j.data >= hoje && j.data <= limite && (!j.convocadas || j.convocadas.length === 0)).sort(ordenarJogos)
  for (const j of semConvocadas) linhas.push(`👥 **Sem convocadas** — ${diaCurto(j.data)}, ${nomeTurma(dados, j.turmaId)} × ${j.adversarioNome}`)

  if (linhas.length === 0) return { titulo: 'Pendências', linhas: ['Tudo em dia! Nenhuma pendência encontrada. ✅'] }
  const acoes = [{ rotulo: 'Abrir Calendário', para: '/calendario' }]
  if (emAndamento.length) acoes.push({ rotulo: 'Abrir Histórico', para: '/historico' })
  return { titulo: `Pendências (${linhas.length})`, linhas, acoes }
}

// --- Fundamentos fortes/fracos dos últimos jogos de uma turma ---
export interface AnaliseFundamentos {
  jogosAnalisados: number
  pior?: { fundamento: FundamentoScout; linha: LinhaFundamento }
  melhor?: { fundamento: FundamentoScout; linha: LinhaFundamento }
}

export function analisarUltimosJogos(dados: DadosAssistente, turmaId: string, quantos = 3): AnaliseFundamentos {
  const ultimos = partidasValidas(dados)
    .filter((p) => p.turmaId === turmaId && p.status === 'FINALIZADA')
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, quantos)
  const equipe = scoutEquipe(ultimos.flatMap((p) => p.setsPartida))
  const candidatos = FUNDAMENTOS_BASE.filter((f) => equipe[f].total >= MINIMO_ACOES)
  if (candidatos.length === 0) return { jogosAnalisados: ultimos.length }
  const ordenados = [...candidatos].sort((a, b) => equipe[a].eficiencia - equipe[b].eficiencia)
  const pior = ordenados[0]
  const melhor = ordenados[ordenados.length - 1]
  return {
    jogosAnalisados: ultimos.length,
    pior: { fundamento: pior, linha: equipe[pior] },
    melhor: candidatos.length > 1 ? { fundamento: melhor, linha: equipe[melhor] } : undefined,
  }
}

function descreverLinha(l: LinhaFundamento): string {
  const pctErro = l.total > 0 ? Math.round((l.erro / l.total) * 100) : 0
  return `eficiência ${l.eficiencia}%, ${pctErro}% de erro em ${l.total} ações`
}

export function proximoJogoValido(dados: DadosAssistente, hoje: string): JogoAgendado | undefined {
  return jogosValidos(dados).filter((j) => j.data >= hoje).sort(ordenarJogos)[0]
}

// --- Preparar próximo jogo ---
// Pedido 21/11/2026: com vários jogos na semana (até no mesmo dia), um cartão
// pra CADA jogo dos próximos 7 dias; sem jogo na semana, o próximo jogo.
export function prepararProximoJogo(dados: DadosAssistente, hoje: string): RespostaAssistente[] {
  const fimSemana = somaDias(hoje, 6)
  const daSemana = jogosValidos(dados).filter((j) => j.data >= hoje && j.data <= fimSemana).sort(ordenarJogos)
  const jogos = daSemana.length ? daSemana : [proximoJogoValido(dados, hoje)].filter((j): j is JogoAgendado => !!j)
  if (!jogos.length) return [{ titulo: 'Preparar próximo jogo', linhas: ['Não há jogo agendado. Agende um jogo pela tela da turma.'], acoes: [{ rotulo: 'Abrir Escolas', para: '/escolas' }] }]
  return jogos.map((j) => prepararJogo(dados, j))
}

function prepararJogo(dados: DadosAssistente, jogo: JogoAgendado): RespostaAssistente {

  const linhas: string[] = []
  linhas.push(`${diaCurto(jogo.data)}${jogo.horario ? `, ${horaCurta(jogo.horario)}` : ''}${jogo.local ? ` — ${jogo.local}` : ''}`)

  const confronto = confrontoDireto(partidasValidas(dados), jogo.turmaId, jogo.adversarioNome)
  if (confronto.jogos.length === 0) {
    linhas.push('**Histórico:** primeiro jogo contra esse adversário.')
  } else {
    const ultimo = confronto.jogos[0]
    const res = ultimo.setsGanhosCasa > ultimo.setsGanhosAdversario ? 'vitória' : 'derrota'
    linhas.push(`**Histórico:** ${plural(confronto.jogos.length, 'jogo')}, ${plural(confronto.vitorias, 'vitória')} e ${plural(confronto.derrotas, 'derrota')} (último: ${res} ${ultimo.setsGanhosCasa}×${ultimo.setsGanhosAdversario} em ${diaCurto(ultimo.data).slice(4)}).`)
    if (confronto.piorFundamentoNosso) linhas.push(`Contra eles, nosso pior fundamento foi **${LABEL_FUNDAMENTO[confronto.piorFundamentoNosso]}**.`)
  }

  const analise = analisarUltimosJogos(dados, jogo.turmaId)
  if (analise.pior) {
    linhas.push(analise.jogosAnalisados === 1 ? '**Último jogo da turma:**' : `**Últimos ${analise.jogosAnalisados} jogos da turma:**`)
    linhas.push(`- Precisa cuidar: **${LABEL_FUNDAMENTO[analise.pior.fundamento]}** (${descreverLinha(analise.pior.linha)})`)
    if (analise.melhor) linhas.push(`- Ponto forte: **${LABEL_FUNDAMENTO[analise.melhor.fundamento]}** (${descreverLinha(analise.melhor.linha)})`)
  } else {
    linhas.push('Ainda não há scout suficiente dos últimos jogos dessa turma pra apontar ponto forte/fraco.')
  }

  const convocadas = jogo.convocadas?.length ?? 0
  linhas.push(convocadas > 0 ? `**Convocadas:** ${plural(convocadas, 'atleta')} ✓` : '⚠️ **Ainda sem convocadas.**')
  const faltando = checklistDoJogo(jogo).filter((i) => !i.feito).map((i) => i.item)
  if (faltando.length) linhas.push(`**Checklist pendente:** ${faltando.join(', ')}`)

  return {
    titulo: `${nomeTurma(dados, jogo.turmaId)} × ${jogo.adversarioNome}`,
    linhas,
    acoes: [{ rotulo: 'Abrir a turma', para: `/turmas/${jogo.turmaId}` }, { rotulo: 'Montar treino', para: '/treinos' }],
  }
}

// --- Montar treino ---
// Pedido 21/11/2026: com dois (ou mais) jogos na semana, aparece uma sugestão
// de treino pra CADA jogo, não só pro primeiro.
export function montarTreino(dados: DadosAssistente, hoje: string): RespostaAssistente[] {
  const fimSemana = somaDias(hoje, 6)
  const jogosDaSemana = jogosValidos(dados).filter((j) => j.data >= hoje && j.data <= fimSemana).sort(ordenarJogos)
  if (jogosDaSemana.length) return jogosDaSemana.map((j) => treinoDaTurma(dados, j.turmaId, j))

  // Sem jogo na semana: o próximo jogo; sem jogo agendado, a turma do último jogo com scout.
  const jogo = proximoJogoValido(dados, hoje)
  const ultimaPartida = partidasValidas(dados).filter((p) => p.status === 'FINALIZADA').sort((a, b) => b.data.localeCompare(a.data))[0]
  const turmaId = jogo?.turmaId ?? ultimaPartida?.turmaId
  if (!turmaId) return [{ titulo: 'Montar treino', linhas: ['Ainda não há jogos com scout pra saber o que treinar. Faça o scout de um jogo e volte aqui.'], acoes: [{ rotulo: 'Abrir Treinos', para: '/treinos' }, { rotulo: 'Só registrar o que teve', para: '/treinos/registrar' }] }]
  return [treinoDaTurma(dados, turmaId, jogo)]
}

function treinoDaTurma(dados: DadosAssistente, turmaId: string, jogo: JogoAgendado | undefined): RespostaAssistente {
  const linhas: string[] = []
  linhas.push(jogo ? `Para o jogo de ${diaCurto(jogo.data)} contra ${jogo.adversarioNome}.` : 'Com base no último jogo com scout.')

  const analise = analisarUltimosJogos(dados, turmaId)
  let temaFoco: string | undefined
  if (analise.pior) {
    temaFoco = TEMA_DO_FUNDAMENTO[analise.pior.fundamento]
    linhas.push(`**Foco sugerido: ${LABEL_FUNDAMENTO[analise.pior.fundamento]}** — pior fundamento ${analise.jogosAnalisados === 1 ? 'no último jogo' : `nos últimos ${analise.jogosAnalisados} jogos`} (${descreverLinha(analise.pior.linha)}).`)
  }

  const sessoesTurma = dados.sessoesTreino.filter((s) => !s.deletedAt && s.turmaId === turmaId)
  const variar = sugerirProximoFoco(sessoesTurma)
  if (variar) linhas.push(`💡 ${variar.motivo}`)
  if (!temaFoco && variar?.temaSugeridoId) temaFoco = variar.temaSugeridoId

  if (temaFoco) {
    const exercicios = dados.bibliotecaExercicios.filter((e) => !e.deletedAt && e.temas.includes(temaFoco!)).slice(0, 4)
    if (exercicios.length) {
      linhas.push(`**Exercícios da sua biblioteca (${temaLabel(temaFoco)}):**`)
      for (const e of exercicios) linhas.push(`- ${e.nome}${e.tempoMin ? ` (${e.tempoMin} min)` : ''}${e.objetivo ? ` — ${e.objetivo}` : ''}`)
    } else {
      linhas.push(`Sua biblioteca ainda não tem exercícios marcados com o tema "${temaLabel(temaFoco)}".`)
    }
  } else if (!variar) {
    linhas.push('Não há scout suficiente pra sugerir um foco. Que tal um treino de jogo completo?')
  }

  return {
    titulo: `Treino — ${nomeTurma(dados, turmaId)}`,
    linhas,
    acoes: [{ rotulo: 'Abrir Treinos', para: '/treinos' }, { rotulo: 'Só registrar o que teve', para: `/treinos/registrar?turma=${turmaId}` }],
  }
}

/** Pergunta escrita/falada → qual botão ela pede. `null` = pergunta livre
 *  (o assistente grátis não entende; sugere o Claude). */
export function entenderPergunta(texto: string): TipoPergunta | null {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/pendenc|pendent|falta|esqueci|atrasad/.test(t)) return 'pendencias'
  if (/treino|exercicio|treinar/.test(t)) return 'treino'
  if (/jogo|adversari|partida|preparar|confronto/.test(t)) return 'jogo'
  if (/semana|agenda|compromisso|hoje|amanha|calendario/.test(t)) return 'semana'
  return null
}

/** Sempre uma lista: "Montar treino" pode trazer um cartão por jogo da semana. */
export function responder(tipo: TipoPergunta, dados: DadosAssistente, hoje: string): RespostaAssistente[] {
  if (tipo === 'semana') return [minhaSemana(dados, hoje)]
  if (tipo === 'pendencias') return [pendencias(dados, hoje)]
  if (tipo === 'jogo') return prepararProximoJogo(dados, hoje)
  return montarTreino(dados, hoje)
}

