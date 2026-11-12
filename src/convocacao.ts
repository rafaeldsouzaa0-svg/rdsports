// Convocação de atletas pra um jogo agendado (pedido 11/11/2026).
//
// Regras combinadas com o Rafael:
// - O jogo é agendado DENTRO da turma (a turma é a "categoria" do jogo, ex.:
//   8º ano). As atletas dessa turma são a TURMA PRINCIPAL e têm prioridade:
//   já vêm todas marcadas e aparecem sempre primeiro.
// - Dá pra puxar REFORÇOS das turmas DE BAIXO da MESMA escola (ex.: meninas do
//   7º ano jogando pelo 8º). Reforço nunca vem marcado sozinho, e se for
//   convocado enquanto ainda tem atleta da turma principal de fora, o app
//   avisa (não bloqueia — a decisão é do treinador).
// - "De baixo" = nível menor. O nível vem do campo `nivel` da turma; se não
//   tiver, é tirado do primeiro número do nome ("7º ano" → 7, "Sub-13" → 13).
//
// Tudo aqui é função pura (sem tela, sem banco) pra poder ser testado em
// scripts/test-convocacao.mjs.
import type { Atleta, Turma } from './types'

/** Idade completa na data `hoje`, a partir de 'AAAA-MM-DD'. undefined se a
 *  data for inválida ou estiver no futuro. */
export function calcularIdade(nascimento: string | undefined, hoje: Date = new Date()): number | undefined {
  if (!nascimento) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nascimento)
  if (!m) return undefined
  const ano = Number(m[1]), mes = Number(m[2]), dia = Number(m[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return undefined
  let idade = hoje.getFullYear() - ano
  const mesHoje = hoje.getMonth() + 1
  if (mesHoje < mes || (mesHoje === mes && hoje.getDate() < dia)) idade--
  return idade >= 0 ? idade : undefined
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' (pra mostrar na tela e no PDF). */
export function formatarDataBR(data: string | undefined): string {
  const m = data ? /^(\d{4})-(\d{2})-(\d{2})/.exec(data) : null
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** Nível da turma: o campo `nivel`, ou o primeiro número do nome. */
export function nivelDaTurma(turma: Pick<Turma, 'nome' | 'nivel'>): number | undefined {
  if (typeof turma.nivel === 'number' && Number.isFinite(turma.nivel)) return turma.nivel
  const m = /\d+/.exec(turma.nome)
  return m ? Number(m[0]) : undefined
}

/** Turmas de onde dá pra puxar reforço: mesma escola, não excluídas, nível
 *  MENOR que o da principal. A mais próxima vem primeiro (8º → 7º, 6º...).
 *  Sem nível na turma principal não dá pra saber quem está "embaixo": vazio. */
export function turmasDeBaixo(principal: Turma, turmas: Turma[]): Turma[] {
  const nivelPrincipal = nivelDaTurma(principal)
  if (nivelPrincipal === undefined) return []
  return turmas
    .filter((t) => t.id !== principal.id && t.escolaId === principal.escolaId && !t.deletedAt)
    .filter((t) => {
      const n = nivelDaTurma(t)
      return n !== undefined && n < nivelPrincipal
    })
    .sort((a, b) => (nivelDaTurma(b) ?? 0) - (nivelDaTurma(a) ?? 0) || a.nome.localeCompare(b.nome))
}

function ativa(a: Atleta) {
  return !a.deletedAt && (a.status ?? 'ATIVA') === 'ATIVA'
}
function porNome(a: Atleta, b: Atleta) {
  return a.nome.localeCompare(b.nome, 'pt-BR')
}

export interface ListaConvocacao {
  principais: Atleta[]
  reforcos: { turma: Turma; atletas: Atleta[] }[]
}

/** O que aparece na tela de convocação: turma principal primeiro, depois as
 *  turmas de baixo (só as que têm atleta ativa). */
export function montarListaConvocacao(principal: Turma, turmas: Turma[], atletas: Atleta[]): ListaConvocacao {
  const principais = atletas.filter((a) => a.turmaId === principal.id && ativa(a)).sort(porNome)
  const reforcos = turmasDeBaixo(principal, turmas)
    .map((turma) => ({ turma, atletas: atletas.filter((a) => a.turmaId === turma.id && ativa(a)).sort(porNome) }))
    .filter((g) => g.atletas.length > 0)
  return { principais, reforcos }
}

/** Seleção inicial de uma convocação nova: toda a turma principal, nenhum
 *  reforço. */
export function convocacaoInicial(lista: ListaConvocacao): string[] {
  return lista.principais.map((a) => a.id)
}

/** Aviso de prioridade: atletas da turma principal que ficaram de fora
 *  ENQUANTO há reforço convocado. Vazio = nada a avisar. */
export function principaisDeForaComReforco(lista: ListaConvocacao, convocadas: string[]): Atleta[] {
  const sel = new Set(convocadas)
  const temReforco = lista.reforcos.some((g) => g.atletas.some((a) => sel.has(a.id)))
  if (!temReforco) return []
  return lista.principais.filter((a) => !sel.has(a.id))
}

export interface AtletaDaPartida {
  atleta: Atleta
  /** Nome da turma de origem quando a atleta é reforço; undefined = turma principal. */
  reforcoDe?: string
}

/** Atletas que aparecem no scout de uma partida. Com convocação: só as
 *  convocadas (turma principal primeiro, reforços depois, com a turma de
 *  origem). Sem convocação (partidas antigas e treinos): a turma inteira,
 *  como sempre foi. */
export function atletasDaPartida(
  partida: { turmaId: string; convocadas?: string[] },
  atletas: Atleta[],
  turmas: Turma[],
): AtletaDaPartida[] {
  if (!partida.convocadas || partida.convocadas.length === 0) {
    return atletas.filter((a) => a.turmaId === partida.turmaId && !a.deletedAt).map((atleta) => ({ atleta }))
  }
  const ids = new Set(partida.convocadas)
  const escolhidas = atletas.filter((a) => ids.has(a.id) && !a.deletedAt)
  const principais = escolhidas.filter((a) => a.turmaId === partida.turmaId).sort(porNome)
  const reforcos = escolhidas
    .filter((a) => a.turmaId !== partida.turmaId)
    .map((atleta) => ({ atleta, turma: turmas.find((t) => t.id === atleta.turmaId) }))
    .sort((x, y) => (nivelDaTurma(y.turma ?? { nome: '' }) ?? 0) - (nivelDaTurma(x.turma ?? { nome: '' }) ?? 0) || porNome(x.atleta, y.atleta))
  return [
    ...principais.map((atleta) => ({ atleta })),
    ...reforcos.map(({ atleta, turma }) => ({ atleta, reforcoDe: turma?.nome ?? 'outra turma' })),
  ]
}

// --- Mensagem da convocação pro WhatsApp (pedido 12/11/2026) ---------------
// O Rafael manda a convocação pro coordenador pelo WhatsApp. Texto simples,
// com *negrito* do WhatsApp, pronto pra colar ou abrir direto no app.

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const NOMES_FORMATO: Record<string, string> = {
  MELHOR_DE_5: 'Melhor de 5 sets',
  MELHOR_DE_3: 'Melhor de 3 sets',
  TRES_OBRIGATORIOS_25: '3 sets obrigatórios de 25',
}

/** 'AAAA-MM-DD' → 'Sábado, 15/11/2026' (sem fuso: a data é só o dia). */
export function dataComDiaDaSemana(data: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data)
  if (!m) return data
  const dia = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
  return `${DIAS_SEMANA[dia]}, ${formatarDataBR(data)}`
}

export function textoConvocacaoWhatsApp(
  jogo: {
    turmaId: string; convocadas?: string[]; adversarioNome: string; campeonatoNome?: string
    data: string; horario?: string; local?: string; formato?: string
  },
  turma: Pick<Turma, 'nome'>,
  escolaNome: string | undefined,
  atletas: Atleta[],
  turmas: Turma[],
  hoje: Date = new Date(),
): string {
  const lista = atletasDaPartida(jogo, atletas, turmas)
  const principais = lista.filter((x) => !x.reforcoDe)
  const reforcos = lista.filter((x) => x.reforcoDe)

  const linhaAtleta = (a: Atleta, n: number, reforcoDe?: string) => {
    const idade = calcularIdade(a.nascimento, hoje) ?? a.idade
    const detalhes = [
      idade !== undefined ? `${idade} anos` : '',
      a.nascimento ? `nasc. ${formatarDataBR(a.nascimento)}` : '',
      reforcoDe ? `reforço do ${reforcoDe}` : '',
    ].filter(Boolean).join(' · ')
    return `${n}. ${a.numero ? `#${a.numero} ` : ''}${a.nome.trim()}${detalhes ? ` — ${detalhes}` : ''}`
  }

  const linhas: string[] = []
  linhas.push(`*CONVOCAÇÃO — ${turma.nome.trim()}${escolaNome ? ` (${escolaNome.trim()})` : ''}*`)
  linhas.push('')
  linhas.push(`🏐 *Jogo:* vs ${jogo.adversarioNome.trim()}`)
  if (jogo.campeonatoNome?.trim()) linhas.push(`🏆 *Campeonato:* ${jogo.campeonatoNome.trim()}`)
  linhas.push(`📅 *Data:* ${dataComDiaDaSemana(jogo.data)}${jogo.horario ? ` às ${jogo.horario.slice(0, 5)}` : ''}`)
  if (jogo.local?.trim()) linhas.push(`📍 *Local:* ${jogo.local.trim()}`)
  if (jogo.formato && NOMES_FORMATO[jogo.formato]) linhas.push(`📋 *Formato:* ${NOMES_FORMATO[jogo.formato]}`)
  linhas.push('')
  if (lista.length === 0) {
    linhas.push('_Nenhuma atleta convocada ainda._')
  } else {
    linhas.push(`*Convocadas (${lista.length}):*`)
    principais.forEach((x, i) => linhas.push(linhaAtleta(x.atleta, i + 1)))
    if (reforcos.length) {
      linhas.push('')
      linhas.push(`*Reforços (${reforcos.length}):*`)
      reforcos.forEach((x, i) => linhas.push(linhaAtleta(x.atleta, principais.length + i + 1, x.reforcoDe)))
    }
  }
  return linhas.join('\n')
}

/** Link que abre o WhatsApp com a mensagem pronta (a pessoa escolhe o contato). */
export function linkWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}
