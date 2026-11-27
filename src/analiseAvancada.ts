// Análises "nível Data Volley" — Etapa 1 (pedido 27/11/2026, depois da
// pesquisa sobre o Data Volley). Tudo calculado a partir dos lances que o
// scout JÁ registra: nenhuma marcação nova no jogo.
//
// - Ataque conforme a recepção (o "jogo em sistema" × fora de sistema)
// - Ataque de side-out (K1) × contra-ataque (K2)
// - Side-out e break point por rodízio (posição da levantadora, P1 a P6)
// - Distribuição da levantadora (pra quem vai a bola em cada situação)
// - Resumo do ponto a ponto (viradas, empates, maior vantagem)
// - Alertas de tendência ao vivo ("3 erros nos últimos 4 saques")
import type { FundamentoScout, Posicao, Rally, RallyEvento, ResultadoEvento, SetPartida } from './types'
import { quadraComLibero, herdarLibero, linhaVazia, type LinhaFundamento } from './scoutEngine'

const ehNosso = (e: RallyEvento) => e.ladoResponsavel !== 'ADVERSARIO'
const ehFechado = (r: Rally) => r.eventos.some((e) => e.encerraRally !== null)
const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0)

function somar(l: LinhaFundamento, r: ResultadoEvento) {
  l.total += 1
  if (r === 'ACERTO' || r === 'BOM') l.positivo += 1
  else if (r === 'EM_JOGO' || r === 'MEDIO') l.neutro += 1
  else if (r === 'ERRO') l.erro += 1
}
function fechar(l: LinhaFundamento): LinhaFundamento {
  l.eficiencia = l.total > 0 ? Math.round(((l.positivo - l.erro) / l.total) * 100) : 0
  return l
}

// ------------------------------------------------- como cada rally começou

export interface ContextoRally {
  rally: Rally
  /** Quem sacava quando o rally começou. */
  servindo: 'CASA' | 'ADVERSARIO'
  /** As 6 da escalação em cada posição (índice 0 = posição I), sem a líbero. */
  base: string[]
  /** Quem estava de verdade em quadra (com a líbero no lugar certo). */
  quadra: string[]
  /** Quantas vezes o time girou desde o começo do set. */
  giros: number
}

/** Percorre os rallies de um set reconstruindo o rodízio igual a
 *  `calcularRotacao` (mesmas regras de substituição e líbero). Sets sem
 *  papeleta (escalação + primeiro saque) não têm rodízio: devolve []. */
export function contextosDoSet(set: SetPartida): ContextoRally[] {
  if (!set.escalacaoInicial || set.escalacaoInicial.length !== 6 || !set.primeiroSaque) return []
  let posicoes = [...set.escalacaoInicial]
  let servindo: 'CASA' | 'ADVERSARIO' = set.primeiroSaque
  let fechados = 0
  let giros = 0
  const subs = set.substituicoes ?? []
  let substituiLibero = [...(set.libero?.substitui ?? [])]
  const aplicarSubsEm = (marco: number) => {
    for (const sub of subs) {
      if (sub.aposRallyFechado === marco) {
        substituiLibero = herdarLibero(substituiLibero, posicoes[sub.posicaoIndex], sub.atletaEntraId)
        posicoes = posicoes.map((p, i) => (i === sub.posicaoIndex ? sub.atletaEntraId : p))
      }
    }
  }
  aplicarSubsEm(0)
  const saida: ContextoRally[] = []
  for (const rally of set.rallies) {
    saida.push({ rally, servindo, base: [...posicoes], quadra: quadraComLibero(posicoes, servindo, set.libero?.atletaId, substituiLibero), giros })
    if (!ehFechado(rally)) continue
    const ganhou: 'CASA' | 'ADVERSARIO' = rally.pontoCasa ? 'CASA' : 'ADVERSARIO'
    if (ganhou !== servindo) {
      if (ganhou === 'CASA') { posicoes = [...posicoes.slice(1), posicoes[0]]; giros += 1 }
      servindo = ganhou
    }
    fechados += 1
    aplicarSubsEm(fechados)
  }
  return saida
}

// --------------------------------------------- ataque conforme a recepção

export type QualidadeRecepcao = 'BOM' | 'MEDIO' | 'EM_JOGO' | 'ERRO'
export const LABEL_QUALIDADE: Record<QualidadeRecepcao, string> = {
  BOM: 'Recepção boa', MEDIO: 'Recepção média', EM_JOGO: 'Recepção sem nota', ERRO: 'Erro de recepção',
}

/** O que aconteceu em cada rally em que NÓS recebemos: a nota da recepção e
 *  o primeiro ataque nosso depois dela (o ataque de side-out, K1). */
interface RallyRecebido { rally: Rally; recepcao: RallyEvento; ataqueK1: RallyEvento | null }

function ralliesRecebidos(sets: SetPartida[]): RallyRecebido[] {
  const lista: RallyRecebido[] = []
  for (const set of sets) {
    for (const rally of set.rallies) {
      if (!ehFechado(rally)) continue
      const iRec = rally.eventos.findIndex((e) => ehNosso(e) && e.fundamento === 'recepcao')
      if (iRec === -1) continue
      const ataqueK1 = rally.eventos.slice(iRec + 1).find((e) => ehNosso(e) && e.fundamento === 'ataque') ?? null
      lista.push({ rally, recepcao: rally.eventos[iRec], ataqueK1 })
    }
  }
  return lista
}

export interface LinhaAtaquePorRecepcao {
  qualidade: QualidadeRecepcao
  label: string
  recepcoes: number
  sideOutPontos: number
  sideOutPct: number
  ataque: LinhaFundamento
  killPct: number
}

/** Side-out e ataque depois de cada tipo de recepção. Só entram rallies com
 *  a nossa recepção marcada. */
export function ataquePorRecepcao(sets: SetPartida[]): LinhaAtaquePorRecepcao[] {
  const ordem: QualidadeRecepcao[] = ['BOM', 'MEDIO', 'EM_JOGO', 'ERRO']
  const mapa = new Map<QualidadeRecepcao, { rec: number; so: number; atq: LinhaFundamento }>()
  for (const r of ralliesRecebidos(sets)) {
    const q = r.recepcao.resultado as QualidadeRecepcao
    if (!ordem.includes(q)) continue
    const x = mapa.get(q) ?? { rec: 0, so: 0, atq: linhaVazia() }
    x.rec += 1
    if (r.rally.pontoCasa) x.so += 1
    if (r.ataqueK1) somar(x.atq, r.ataqueK1.resultado)
    mapa.set(q, x)
  }
  return ordem.filter((q) => mapa.has(q)).map((q) => {
    const x = mapa.get(q)!
    const ataque = fechar(x.atq)
    return {
      qualidade: q, label: LABEL_QUALIDADE[q], recepcoes: x.rec, sideOutPontos: x.so,
      sideOutPct: pct(x.so, x.rec), ataque, killPct: pct(ataque.positivo, ataque.total),
    }
  })
}

// --------------------------------------------- K1 (side-out) × K2 (contra)

export interface LinhaFase { ataque: LinhaFundamento; killPct: number; erroPct: number }
export interface AtaquePorFase { k1: LinhaFase; k2: LinhaFase }

/** K1 = primeiro ataque depois da NOSSA recepção (side-out). K2 = todos os
 *  outros ataques nossos (contra-ataque, depois de defesa/bloqueio/bola de
 *  graça, ou um segundo ataque no mesmo rally). */
export function ataquePorFase(sets: SetPartida[]): AtaquePorFase {
  const k1 = linhaVazia()
  const k2 = linhaVazia()
  const idsK1 = new Set(ralliesRecebidos(sets).map((r) => r.ataqueK1?.id).filter(Boolean))
  for (const set of sets) {
    for (const rally of set.rallies) {
      for (const e of rally.eventos) {
        if (!ehNosso(e) || e.fundamento !== 'ataque') continue
        somar(idsK1.has(e.id) ? k1 : k2, e.resultado)
      }
    }
  }
  const linha = (l: LinhaFundamento): LinhaFase => ({ ataque: fechar(l), killPct: pct(l.positivo, l.total), erroPct: pct(l.erro, l.total) })
  return { k1: linha(k1), k2: linha(k2) }
}

// ------------------------------------------------------- por rodízio

export interface LinhaRodizio {
  /** 0 a 5 = levantadora na posição I a VI (modo 'levantadora') ou giros
   *  desde a escalação de saída (modo 'giro'). */
  rodizio: number
  sideOutOportunidades: number
  sideOutPontos: number
  sideOutPct: number
  breakOportunidades: number
  breakPontos: number
  breakPct: number
  pontosFeitos: number
  pontosSofridos: number
  saldo: number
}
export interface DesempenhoRodizio {
  modo: 'levantadora' | 'giro'
  linhas: LinhaRodizio[]
  /** Rallies que ficaram de fora (set sem papeleta, ou sem a levantadora em quadra). */
  ignorados: number
}

/** Side-out e break point em cada um dos 6 rodízios. Quando dá pra saber
 *  quem é a levantadora (posição Levantadora no cadastro e em quadra), o
 *  rodízio é contado pela posição dela (P1 = levantadora na posição I, como
 *  o Data Volley); senão, pelo número de giros desde a escalação de saída. */
export function desempenhoPorRodizio(sets: SetPartida[], levantadoras: Set<string>): DesempenhoRodizio {
  const contextos = sets.flatMap(contextosDoSet).filter((c) => ehFechado(c.rally))
  const semPapeleta = sets.reduce((s, set) => s + (contextosDoSet(set).length === 0 ? set.rallies.filter(ehFechado).length : 0), 0)
  const posLev = (c: ContextoRally) => c.base.findIndex((id) => levantadoras.has(id))
  // Modo levantadora quando ela aparece em quadra em pelo menos 80% dos
  // rallies; os rallies sem ela (ex.: levantadora substituída) ficam de fora.
  const comLev = contextos.filter((c) => posLev(c) !== -1).length
  const modo: 'levantadora' | 'giro' = contextos.length > 0 && comLev / contextos.length >= 0.8 ? 'levantadora' : 'giro'
  let semLevantadora = 0
  const vazio = (i: number): LinhaRodizio => ({ rodizio: i, sideOutOportunidades: 0, sideOutPontos: 0, sideOutPct: 0, breakOportunidades: 0, breakPontos: 0, breakPct: 0, pontosFeitos: 0, pontosSofridos: 0, saldo: 0 })
  const linhas = [0, 1, 2, 3, 4, 5].map(vazio)
  for (const c of contextos) {
    const idx = modo === 'levantadora' ? posLev(c) : c.giros % 6
    if (idx === -1) { semLevantadora += 1; continue }
    const l = linhas[idx]
    if (c.servindo === 'ADVERSARIO') {
      l.sideOutOportunidades += 1
      if (c.rally.pontoCasa) l.sideOutPontos += 1
    } else {
      l.breakOportunidades += 1
      if (c.rally.pontoCasa) l.breakPontos += 1
    }
    if (c.rally.pontoCasa) l.pontosFeitos += 1
    else l.pontosSofridos += 1
  }
  for (const l of linhas) {
    l.sideOutPct = pct(l.sideOutPontos, l.sideOutOportunidades)
    l.breakPct = pct(l.breakPontos, l.breakOportunidades)
    l.saldo = l.pontosFeitos - l.pontosSofridos
  }
  return { modo, linhas, ignorados: semPapeleta + semLevantadora }
}

// ---------------------------------------------- distribuição da levantadora

export type SituacaoAtaque = 'RECEPCAO_BOA' | 'RECEPCAO_MEDIA' | 'CONTRA_ATAQUE'
export const LABEL_SITUACAO: Record<SituacaoAtaque, string> = {
  RECEPCAO_BOA: 'Depois de recepção boa',
  RECEPCAO_MEDIA: 'Depois de recepção média/sem nota',
  CONTRA_ATAQUE: 'Contra-ataque',
}
export interface ItemDistribuicao { chave: string; total: number; pct: number; pontos: number; erros: number; eficiencia: number }
export interface GrupoDistribuicao { situacao: SituacaoAtaque; label: string; total: number; porAtleta: ItemDistribuicao[]; porFuncao: ItemDistribuicao[] }

/** Pra quem a bola foi atacada em cada situação (o "pra quem a levantadora
 *  levanta"). `funcaoDe` devolve a posição cadastrada da atleta. */
export function distribuicaoAtaque(sets: SetPartida[], funcaoDe: (id: string) => Posicao | undefined): GrupoDistribuicao[] {
  const situacaoDoK1 = new Map<string, SituacaoAtaque>()
  for (const r of ralliesRecebidos(sets)) {
    if (!r.ataqueK1) continue
    situacaoDoK1.set(r.ataqueK1.id, r.recepcao.resultado === 'BOM' ? 'RECEPCAO_BOA' : 'RECEPCAO_MEDIA')
  }
  type Acc = Map<string, { total: number; pontos: number; erros: number }>
  const grupos = new Map<SituacaoAtaque, { atl: Acc; fun: Acc; total: number }>()
  const add = (m: Acc, chave: string, e: RallyEvento) => {
    const x = m.get(chave) ?? { total: 0, pontos: 0, erros: 0 }
    x.total += 1
    if (e.resultado === 'ACERTO') x.pontos += 1
    if (e.resultado === 'ERRO') x.erros += 1
    m.set(chave, x)
  }
  for (const set of sets) {
    for (const rally of set.rallies) {
      for (const e of rally.eventos) {
        if (!ehNosso(e) || e.fundamento !== 'ataque' || !e.atletaId) continue
        const sit = situacaoDoK1.get(e.id) ?? 'CONTRA_ATAQUE'
        const g = grupos.get(sit) ?? { atl: new Map(), fun: new Map(), total: 0 }
        g.total += 1
        add(g.atl, e.atletaId, e)
        add(g.fun, funcaoDe(e.atletaId) ?? 'SEM_POSICAO', e)
        grupos.set(sit, g)
      }
    }
  }
  const lista = (m: Acc, total: number): ItemDistribuicao[] => [...m.entries()]
    .map(([chave, x]) => ({ chave, total: x.total, pct: pct(x.total, total), pontos: x.pontos, erros: x.erros, eficiencia: x.total > 0 ? Math.round(((x.pontos - x.erros) / x.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
  const ordem: SituacaoAtaque[] = ['RECEPCAO_BOA', 'RECEPCAO_MEDIA', 'CONTRA_ATAQUE']
  return ordem.filter((s) => grupos.has(s)).map((s) => {
    const g = grupos.get(s)!
    return { situacao: s, label: LABEL_SITUACAO[s], total: g.total, porAtleta: lista(g.atl, g.total), porFuncao: lista(g.fun, g.total) }
  })
}

// ------------------------------------------------------ ponto a ponto

export interface ResumoPlacarSet { viradas: number; empates: number; maiorVantagemNossa: number; maiorVantagemDeles: number }

/** Viradas (quem estava na frente mudou), empates depois do 0 a 0 e a maior
 *  vantagem de cada lado no set. */
export function resumoPlacarSet(set: SetPartida): ResumoPlacarSet {
  let viradas = 0, empates = 0, nossa = 0, deles = 0
  let lider: 1 | -1 | 0 = 0
  for (const r of set.rallies) {
    if (!ehFechado(r)) continue
    const d = r.placarCasaApos - r.placarAdversarioApos
    nossa = Math.max(nossa, d)
    deles = Math.max(deles, -d)
    if (d === 0) { empates += 1; continue }
    const agora: 1 | -1 = d > 0 ? 1 : -1
    if (lider !== 0 && agora !== lider) viradas += 1
    lider = agora
  }
  return { viradas, empates, maiorVantagemNossa: nossa, maiorVantagemDeles: deles }
}

// -------------------------------------------------- alertas ao vivo

export interface AlertaTendencia {
  tipo: 'alerta' | 'destaque'
  atletaId: string
  fundamento: FundamentoScout
  quantos: number
  janela: number
}

const FUNDAMENTOS_ALERTA: FundamentoScout[] = ['saque', 'recepcao', 'ataque']

/** "Duda errou 3 dos últimos 4 saques" / "Bia fez 3 pontos nos últimos 4
 *  ataques". Olha as últimas `janela` ações de cada atleta em saque,
 *  recepção e ataque, só se a última delas foi nos últimos `recencia`
 *  rallies da partida (alerta velho não aparece). */
export function alertasTendencia(sets: SetPartida[], janela = 4, minimo = 3, recencia = 12): AlertaTendencia[] {
  const historico = new Map<string, { resultados: ResultadoEvento[]; ultimoRally: number }>()
  let nRally = 0
  for (const set of sets) {
    for (const rally of set.rallies) {
      nRally += 1
      for (const e of rally.eventos) {
        if (!ehNosso(e) || !e.atletaId || !FUNDAMENTOS_ALERTA.includes(e.fundamento)) continue
        const chave = `${e.atletaId}|${e.fundamento}`
        const h = historico.get(chave) ?? { resultados: [], ultimoRally: 0 }
        h.resultados.push(e.resultado)
        h.ultimoRally = nRally
        historico.set(chave, h)
      }
    }
  }
  const alertas: AlertaTendencia[] = []
  for (const [chave, h] of historico) {
    if (h.resultados.length < janela || nRally - h.ultimoRally >= recencia) continue
    const [atletaId, fundamento] = chave.split('|') as [string, FundamentoScout]
    const ultimos = h.resultados.slice(-janela)
    const erros = ultimos.filter((r) => r === 'ERRO').length
    const bons = ultimos.filter((r) => (fundamento === 'recepcao' ? r === 'BOM' : r === 'ACERTO')).length
    if (erros >= minimo) alertas.push({ tipo: 'alerta', atletaId, fundamento, quantos: erros, janela })
    else if (bons >= minimo) alertas.push({ tipo: 'destaque', atletaId, fundamento, quantos: bons, janela })
  }
  return alertas.sort((a, b) => (a.tipo === b.tipo ? b.quantos - a.quantos : a.tipo === 'alerta' ? -1 : 1))
}

const PLURAL: Partial<Record<FundamentoScout, string>> = { saque: 'saques', recepcao: 'recepções', ataque: 'ataques' }

/** Texto curto do alerta, ex.: "errou 3 dos últimos 4 saques". */
export function textoAlerta(a: AlertaTendencia): string {
  const plural = PLURAL[a.fundamento] ?? 'lances'
  if (a.tipo === 'alerta') return `errou ${a.quantos} dos últimos ${a.janela} ${plural}`
  if (a.fundamento === 'recepcao') return `${a.quantos} recepções boas nas últimas ${a.janela}`
  return `${a.quantos} pontos nos últimos ${a.janela} ${plural}`
}
