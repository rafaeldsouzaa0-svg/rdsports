// Contas da aba Estatísticas completa (pedido 27/11/2026: "todas as
// informações possíveis na aba de estatística"). Tudo aqui é calculado a
// partir dos lances que JÁ são registrados no scout — nenhum dado novo é
// pedido no jogo. As regras de positivo/neutro/erro e de eficiência são as
// mesmas do scoutEngine.ts (eficiência = (positivo − erro) / total × 100).
import type { FundamentoScout, Partida, SetPartida, RallyEvento } from './types'
import { scoutPorAtleta, scoutEquipe, sideOutBreakPoint, LABEL_FUNDAMENTO, linhaVazia, FUNDAMENTOS_SCOUT, type LinhaFundamento } from './scoutEngine'

export type PeriodoEstatistica = 'TEMPORADA' | 'ULTIMOS_5' | 'ULTIMO'

export interface FiltroEstatistica {
  /** Turma escolhida; vazio = todas as turmas. */
  turmaId?: string
  periodo: PeriodoEstatistica
  /** Um jogo específico (id da partida). Quando preenchido, manda no período. */
  partidaId?: string
  /** Nome do adversário (sem diferenciar maiúsculas/espaços). */
  adversario?: string
}

export function normalizarNome(nome: string | undefined): string {
  return (nome ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Só jogos FINALIZADOS e não apagados, do mais antigo pro mais novo. */
export function jogosFinalizados(partidas: Partida[], turmaId?: string): Partida[] {
  return partidas
    .filter((p) => !p.deletedAt && p.tipo === 'JOGO' && p.status === 'FINALIZADA' && (!turmaId || p.turmaId === turmaId))
    .sort((a, b) => a.data.localeCompare(b.data) || a.createdAt.localeCompare(b.createdAt))
}

export function filtrarPartidas(partidas: Partida[], filtro: FiltroEstatistica): Partida[] {
  let lista = jogosFinalizados(partidas, filtro.turmaId)
  if (filtro.partidaId) return lista.filter((p) => p.id === filtro.partidaId)
  if (filtro.adversario) {
    const alvo = normalizarNome(filtro.adversario)
    lista = lista.filter((p) => normalizarNome(p.adversarioNome) === alvo)
  }
  if (filtro.periodo === 'ULTIMOS_5') return lista.slice(-5)
  if (filtro.periodo === 'ULTIMO') return lista.slice(-1)
  return lista
}

function ehRallyFechado(r: { eventos: RallyEvento[] }): boolean {
  return r.eventos.some((e) => e.encerraRally !== null)
}

// ---------------------------------------------------------------- Resumo

export interface ResumoJogos {
  jogos: number
  vitorias: number
  derrotas: number
  aproveitamento: number
  setsGanhos: number
  setsPerdidos: number
  pontosFeitos: number
  pontosSofridos: number
  saldoPontos: number
  /** Sets decididos por 2 pontos ou menos. */
  setsApertadosGanhos: number
  setsApertadosPerdidos: number
  mediaPontosFeitosPorSet: number
  mediaPontosSofridosPorSet: number
  /** Jogos seguidos com o mesmo resultado no fim do período (ex.: 3 vitórias). */
  sequenciaAtual: { tipo: 'V' | 'D'; tamanho: number } | null
}

function setsJogados(p: Partida): SetPartida[] {
  return p.setsPartida.filter((s) => s.placarCasa + s.placarAdversario > 0)
}

export function resumoJogos(partidas: Partida[]): ResumoJogos {
  let vitorias = 0, setsGanhos = 0, setsPerdidos = 0, pontosFeitos = 0, pontosSofridos = 0
  let apertG = 0, apertP = 0, nSets = 0
  for (const p of partidas) {
    if (p.setsGanhosCasa > p.setsGanhosAdversario) vitorias += 1
    setsGanhos += p.setsGanhosCasa
    setsPerdidos += p.setsGanhosAdversario
    for (const s of setsJogados(p)) {
      nSets += 1
      pontosFeitos += s.placarCasa
      pontosSofridos += s.placarAdversario
      if (Math.abs(s.placarCasa - s.placarAdversario) <= 2) {
        if (s.placarCasa > s.placarAdversario) apertG += 1
        else if (s.placarAdversario > s.placarCasa) apertP += 1
      }
    }
  }
  let sequenciaAtual: ResumoJogos['sequenciaAtual'] = null
  for (let i = partidas.length - 1; i >= 0; i--) {
    const tipo = partidas[i].setsGanhosCasa > partidas[i].setsGanhosAdversario ? 'V' : 'D'
    if (!sequenciaAtual) sequenciaAtual = { tipo, tamanho: 1 }
    else if (sequenciaAtual.tipo === tipo) sequenciaAtual.tamanho += 1
    else break
  }
  return {
    jogos: partidas.length,
    vitorias,
    derrotas: partidas.length - vitorias,
    aproveitamento: partidas.length > 0 ? Math.round((vitorias / partidas.length) * 100) : 0,
    setsGanhos, setsPerdidos, pontosFeitos, pontosSofridos,
    saldoPontos: pontosFeitos - pontosSofridos,
    setsApertadosGanhos: apertG,
    setsApertadosPerdidos: apertP,
    mediaPontosFeitosPorSet: nSets > 0 ? Math.round((pontosFeitos / nSets) * 10) / 10 : 0,
    mediaPontosSofridosPorSet: nSets > 0 ? Math.round((pontosSofridos / nSets) * 10) / 10 : 0,
    sequenciaAtual,
  }
}

// ------------------------------------------------- De onde vêm os pontos

export interface ItemOrigem { chave: string; label: string; valor: number; pct: number }
export interface OrigemPontos { ganhos: ItemOrigem[]; perdidos: ItemOrigem[]; totalGanhos: number; totalPerdidos: number }

const LABEL_PONTO_NOSSO: Partial<Record<FundamentoScout, string>> = {
  ataque: 'Ataque', saque: 'Ace (saque)', bloqueio: 'Bloqueio',
  bola_de_graca: 'Bola de graça', bola_de_segunda: 'Bola de 2ª / largada',
}

/** Como cada ponto do jogo aconteceu, olhando o lance que fechou o rally:
 *  pontos nossos (ataque, ace, bloqueio, erro do adversário…) e pontos que
 *  entregamos (nosso erro em cada fundamento) ou que o adversário fez. */
export function origemDosPontos(sets: SetPartida[]): OrigemPontos {
  const ganhos = new Map<string, { label: string; valor: number }>()
  const perdidos = new Map<string, { label: string; valor: number }>()
  const somar = (m: typeof ganhos, chave: string, label: string) => {
    const atual = m.get(chave) ?? { label, valor: 0 }
    atual.valor += 1
    m.set(chave, atual)
  }
  for (const set of sets) {
    for (const rally of set.rallies) {
      const ev = rally.eventos.find((e) => e.encerraRally !== null)
      if (!ev) continue
      const doAdversario = ev.ladoResponsavel === 'ADVERSARIO'
      if (rally.pontoCasa) {
        if (doAdversario) somar(ganhos, 'erro_adversario', 'Erro do adversário')
        else somar(ganhos, ev.fundamento, LABEL_PONTO_NOSSO[ev.fundamento] ?? LABEL_FUNDAMENTO[ev.fundamento])
      } else if (doAdversario) {
        somar(perdidos, `adv_${ev.fundamento}`, `Ponto deles: ${LABEL_FUNDAMENTO[ev.fundamento].toLowerCase()}`)
      } else {
        const label = ev.fundamento === 'nao_deslocou' ? 'Nosso erro: não deslocou' : `Nosso erro: ${LABEL_FUNDAMENTO[ev.fundamento].toLowerCase()}`
        somar(perdidos, `erro_${ev.fundamento}`, label)
      }
    }
  }
  const lista = (m: typeof ganhos) => {
    const total = [...m.values()].reduce((s, x) => s + x.valor, 0)
    const itens = [...m.entries()]
      .map(([chave, x]) => ({ chave, label: x.label, valor: x.valor, pct: total > 0 ? Math.round((x.valor / total) * 100) : 0 }))
      .sort((a, b) => b.valor - a.valor)
    return { itens, total }
  }
  const g = lista(ganhos)
  const p = lista(perdidos)
  return { ganhos: g.itens, perdidos: p.itens, totalGanhos: g.total, totalPerdidos: p.total }
}

// ------------------------------------------------------- Por set (1º, 2º…)

export interface LinhaPorNumeroSet {
  numero: number
  jogados: number
  ganhos: number
  pontosFeitos: number
  pontosSofridos: number
  eficiencia: number
}

/** "A gente começa devagar?" — desempenho no 1º set, 2º set, 3º set… */
export function desempenhoPorNumeroSet(partidas: Partida[]): LinhaPorNumeroSet[] {
  const porNumero = new Map<number, { sets: SetPartida[]; ganhos: number; feitos: number; sofridos: number }>()
  for (const p of partidas) {
    for (const s of setsJogados(p)) {
      const atual = porNumero.get(s.numero) ?? { sets: [], ganhos: 0, feitos: 0, sofridos: 0 }
      atual.sets.push(s)
      if (s.placarCasa > s.placarAdversario) atual.ganhos += 1
      atual.feitos += s.placarCasa
      atual.sofridos += s.placarAdversario
      porNumero.set(s.numero, atual)
    }
  }
  return [...porNumero.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numero, x]) => ({
      numero,
      jogados: x.sets.length,
      ganhos: x.ganhos,
      pontosFeitos: x.feitos,
      pontosSofridos: x.sofridos,
      eficiencia: eficienciaGeral(x.sets).eficiencia,
    }))
}

/** Todas as ações do nosso time somadas (todos os fundamentos). */
export function eficienciaGeral(sets: SetPartida[]): LinhaFundamento {
  const eq = scoutEquipe(sets)
  const total = linhaVazia()
  for (const f of FUNDAMENTOS_SCOUT) {
    total.positivo += eq[f].positivo
    total.neutro += eq[f].neutro
    total.erro += eq[f].erro
    total.total += eq[f].total
  }
  total.eficiencia = total.total > 0 ? Math.round(((total.positivo - total.erro) / total.total) * 100) : 0
  return total
}

// ------------------------------------------------------ Jogo a jogo

export interface LinhaJogo {
  partida: Partida
  venceu: boolean
  eficiencia: number
  acoes: number
  sideOutPct: number
  breakPct: number
  pontosFeitos: number
  pontosSofridos: number
}

export function evolucaoPorJogo(partidas: Partida[]): LinhaJogo[] {
  return partidas.map((p) => {
    const ger = eficienciaGeral(p.setsPartida)
    const sb = sideOutBreakPoint(p.setsPartida)
    const sets = setsJogados(p)
    return {
      partida: p,
      venceu: p.setsGanhosCasa > p.setsGanhosAdversario,
      eficiencia: ger.eficiencia,
      acoes: ger.total,
      sideOutPct: sb.sideOutPct,
      breakPct: sb.breakPct,
      pontosFeitos: sets.reduce((s, x) => s + x.placarCasa, 0),
      pontosSofridos: sets.reduce((s, x) => s + x.placarAdversario, 0),
    }
  })
}

// --------------------------------------------------- Sequências de pontos

export interface MaioresSequencias { aFavor: number; contra: number }

/** Maior número de pontos seguidos a favor e contra no período. */
export function maioresSequencias(partidas: Partida[]): MaioresSequencias {
  let aFavor = 0, contra = 0
  for (const p of partidas) {
    for (const s of p.setsPartida) {
      let lado: boolean | null = null
      let tam = 0
      for (const r of s.rallies) {
        if (!ehRallyFechado(r)) continue
        if (r.pontoCasa === lado) tam += 1
        else { lado = r.pontoCasa; tam = 1 }
        if (lado) aFavor = Math.max(aFavor, tam)
        else contra = Math.max(contra, tam)
      }
    }
  }
  return { aFavor, contra }
}

// --------------------------------------------------------- Por atleta

export interface LinhaAtletaCompleta {
  atletaId: string
  jogos: number
  porFundamento: Record<FundamentoScout, LinhaFundamento>
  totalGeral: LinhaFundamento
  /** Pontos que ela fez (lance dela que fechou o rally pra nós). */
  pontos: number
  /** Erros dela que deram ponto pro adversário. */
  errosQueDeramPonto: number
  /** Pontos − erros que deram ponto. */
  saldo: number
  aces: number
  bloqueiosPonto: number
  ataquesPonto: number
}

export function estatisticasPorAtleta(partidas: Partida[]): LinhaAtletaCompleta[] {
  const sets = partidas.flatMap((p) => p.setsPartida)
  const base = scoutPorAtleta(sets)
  const extra = new Map<string, { jogos: Set<string>; pontos: number; erros: number; aces: number; bloq: number; atq: number }>()
  const pegar = (id: string) => {
    if (!extra.has(id)) extra.set(id, { jogos: new Set(), pontos: 0, erros: 0, aces: 0, bloq: 0, atq: 0 })
    return extra.get(id)!
  }
  for (const p of partidas) {
    for (const s of p.setsPartida) {
      for (const r of s.rallies) {
        for (const ev of r.eventos) {
          if (!ev.atletaId || ev.ladoResponsavel === 'ADVERSARIO') continue
          const x = pegar(ev.atletaId)
          x.jogos.add(p.id)
          if (ev.encerraRally === 'CASA') {
            x.pontos += 1
            if (ev.fundamento === 'saque') x.aces += 1
            if (ev.fundamento === 'bloqueio') x.bloq += 1
            if (ev.fundamento === 'ataque') x.atq += 1
          } else if (ev.encerraRally === 'ADVERSARIO') {
            x.erros += 1
          }
        }
      }
    }
  }
  return base.map((b) => {
    const x = pegar(b.atletaId)
    return {
      atletaId: b.atletaId,
      jogos: x.jogos.size,
      porFundamento: b.porFundamento,
      totalGeral: b.totalGeral,
      pontos: x.pontos,
      errosQueDeramPonto: x.erros,
      saldo: x.pontos - x.erros,
      aces: x.aces,
      bloqueiosPonto: x.bloq,
      ataquesPonto: x.atq,
    }
  })
}

// ----------------------------------------------------------- Rankings

export interface ItemRanking { atletaId: string; valor: number; detalhe: string }
export interface Ranking { titulo: string; unidade: string; itens: ItemRanking[] }

/** Mínimo de tentativas pra entrar num ranking de eficiência — com 1 ou 2
 *  ações a porcentagem engana (1 de 1 = 100%). */
export const MINIMO_TENTATIVAS_RANKING = 5

export function rankings(linhas: LinhaAtletaCompleta[], limite = 3): Ranking[] {
  const top = (titulo: string, unidade: string, valor: (l: LinhaAtletaCompleta) => number | null, detalhe: (l: LinhaAtletaCompleta) => string): Ranking => ({
    titulo,
    unidade,
    itens: linhas
      .map((l) => ({ l, v: valor(l) }))
      .filter((x): x is { l: LinhaAtletaCompleta; v: number } => x.v !== null && x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, limite)
      .map(({ l, v }) => ({ atletaId: l.atletaId, valor: v, detalhe: detalhe(l) })),
  })
  const efic = (f: FundamentoScout) => (l: LinhaAtletaCompleta) => {
    const x = l.porFundamento[f]
    return x.total >= MINIMO_TENTATIVAS_RANKING ? x.eficiencia : null
  }
  const det = (f: FundamentoScout) => (l: LinhaAtletaCompleta) => `${l.porFundamento[f].positivo}/${l.porFundamento[f].total}`
  return [
    top('Mais pontos', 'pts', (l) => l.pontos, (l) => `${l.jogos} jogo(s)`),
    top('Melhor saldo (pontos − erros)', '', (l) => l.saldo, (l) => `${l.pontos} pts · ${l.errosQueDeramPonto} erros`),
    top('Ataque (eficiência)', '%', efic('ataque'), det('ataque')),
    top('Mais pontos de ataque', 'pts', (l) => l.ataquesPonto, det('ataque')),
    top('Saque (eficiência)', '%', efic('saque'), det('saque')),
    top('Mais aces', 'aces', (l) => l.aces, det('saque')),
    top('Recepção (eficiência)', '%', efic('recepcao'), det('recepcao')),
    top('Defesa (eficiência)', '%', efic('defesa'), det('defesa')),
    top('Mais bloqueios de ponto', 'pts', (l) => l.bloqueiosPonto, det('bloqueio')),
    top('Levantamento (eficiência)', '%', efic('levantamento'), det('levantamento')),
    top('Mais erros que deram ponto', 'erros', (l) => l.errosQueDeramPonto, (l) => `${l.totalGeral.total} ações`),
  ].filter((r) => r.itens.length > 0)
}
