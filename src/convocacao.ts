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
