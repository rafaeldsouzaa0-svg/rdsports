// Relatório do adversário (pedido 27/11/2026, ideia do Data Volley): junta
// tudo o que já foi marcado nos jogos contra um time, pra preparar o próximo
// jogo. Só usa jogos FINALIZADOS e não apagados.
import type { FundamentoScout, Partida } from './types'
import { erroPorFundamentoAdversario, pontosPorFundamentoAdversario, scoutEquipe, sideOutBreakPoint, LABEL_FUNDAMENTO, type LinhaFundamento } from './scoutEngine'
import { jogosFinalizados, normalizarNome, resumoJogos, origemDosPontos, estatisticasPorAtleta, type ResumoJogos, type ItemOrigem, type LinhaAtletaCompleta } from './estatisticasCompletas'
import { desempenhoPorRodizio, type LinhaRodizio } from './analiseAvancada'
import { desempenhoPorZona } from './zonas'

/** Nomes que não são adversário de verdade. */
const IGNORAR = new Set(['treino interno', 'teste'])

/** Entre os jeitos que o nome foi escrito, fica com o mais usado; empate →
 *  o que tem letra maiúscula (ex.: "Showa Vôlei" em vez de "showa volei"). */
export function melhorNome(nomes: (string | undefined)[]): string {
  const cont = new Map<string, number>()
  for (const n of nomes) { const t = (n ?? '').trim(); if (t) cont.set(t, (cont.get(t) ?? 0) + 1) }
  return [...cont.entries()].sort((a, b) => b[1] - a[1] || Number(/[A-ZÀ-Ú]/.test(b[0])) - Number(/[A-ZÀ-Ú]/.test(a[0])) || b[0].localeCompare(a[0]))[0]?.[0] ?? ''
}

export interface AdversarioComJogos { nome: string; chave: string; jogos: number; vitorias: number; derrotas: number; ultimaData: string }

export function adversariosComJogos(partidas: Partida[], turmaId?: string): AdversarioComJogos[] {
  const mapa = new Map<string, AdversarioComJogos>()
  const grafias = new Map<string, (string | undefined)[]>()
  for (const p of jogosFinalizados(partidas, turmaId)) {
    const chave = normalizarNome(p.adversarioNome)
    if (!chave || IGNORAR.has(chave)) continue
    const a = mapa.get(chave) ?? { nome: p.adversarioNome!.trim(), chave, jogos: 0, vitorias: 0, derrotas: 0, ultimaData: '' }
    a.jogos += 1
    if (p.setsGanhosCasa > p.setsGanhosAdversario) a.vitorias += 1
    else a.derrotas += 1
    if (p.data > a.ultimaData) a.ultimaData = p.data
    grafias.set(chave, [...(grafias.get(chave) ?? []), p.adversarioNome])
    mapa.set(chave, a)
  }
  for (const [chave, a] of mapa) a.nome = melhorNome(grafias.get(chave) ?? [a.nome])
  return [...mapa.values()].sort((a, b) => b.ultimaData.localeCompare(a.ultimaData))
}

export interface CamisaAdversaria { numero: string; pontos: number; erros: number; porFundamento: Partial<Record<FundamentoScout, number>> }

export interface RelatorioAdversario {
  nome: string
  jogos: Partida[]
  resumo: ResumoJogos
  /** Como ELES fizeram ponto: ponto direto deles (ataque, bloqueio, saque…) e nossos erros. */
  pontosDeles: ItemOrigem[]
  totalPontosDeles: number
  /** Onde eles mais erraram (cada erro deles é ponto nosso). */
  errosDeles: { fundamento: FundamentoScout; label: string; total: number; porJogo: number }[]
  /** Camisas deles que mais pontuaram (quando o número foi anotado). */
  camisasPerigosas: CamisaAdversaria[]
  /** Camisas deles que mais erraram. */
  camisasQueErram: CamisaAdversaria[]
  sideOutPct: number | null
  breakPct: number | null
  nossosFundamentos: { fundamento: FundamentoScout; label: string; linha: LinhaFundamento }[]
  destaques: LinhaAtletaCompleta[]
  piorRodizio: (LinhaRodizio & { nome: string }) | null
  melhorZonaAtaque: { zona: number; pctPonto: number; total: number } | null
  dicas: string[]
}

export function relatorioAdversario(partidas: Partida[], nome: string, opcoes: { turmaId?: string; levantadoras?: Set<string> } = {}): RelatorioAdversario {
  const alvo = normalizarNome(nome)
  const jogos = jogosFinalizados(partidas, opcoes.turmaId).filter((p) => normalizarNome(p.adversarioNome) === alvo)
  const sets = jogos.flatMap((p) => p.setsPartida)
  const n = Math.max(1, jogos.length)

  const origem = origemDosPontos(sets)
  const erros = erroPorFundamentoAdversario(sets)
  const pontos = pontosPorFundamentoAdversario(sets)

  const errosDeles = (Object.keys(erros) as FundamentoScout[])
    .filter((f) => erros[f].total > 0)
    .map((f) => ({ fundamento: f, label: LABEL_FUNDAMENTO[f], total: erros[f].total, porJogo: Math.round((erros[f].total / n) * 10) / 10 }))
    .sort((a, b) => b.total - a.total)

  const camisas = new Map<string, CamisaAdversaria>()
  const pegar = (num: string) => {
    if (!camisas.has(num)) camisas.set(num, { numero: num, pontos: 0, erros: 0, porFundamento: {} })
    return camisas.get(num)!
  }
  for (const f of Object.keys(pontos) as FundamentoScout[]) {
    for (const [num, q] of Object.entries(pontos[f].porNumero)) {
      const c = pegar(num); c.pontos += q; c.porFundamento[f] = (c.porFundamento[f] ?? 0) + q
    }
    for (const [num, q] of Object.entries(erros[f].porNumero)) pegar(num).erros += q
  }
  const todasCamisas = [...camisas.values()]

  const sb = sideOutBreakPoint(sets)
  const equipe = scoutEquipe(sets)
  const nossosFundamentos = (['saque', 'recepcao', 'levantamento', 'ataque', 'bloqueio', 'defesa'] as FundamentoScout[])
    .filter((f) => equipe[f].total > 0)
    .map((f) => ({ fundamento: f, label: LABEL_FUNDAMENTO[f], linha: equipe[f] }))

  const rod = desempenhoPorRodizio(sets, opcoes.levantadoras ?? new Set())
  const piorLinha = rod.linhas.filter((l) => l.pontosFeitos + l.pontosSofridos >= 5).sort((a, b) => a.saldo - b.saldo)[0]
  const piorRodizio = piorLinha && piorLinha.saldo < 0 ? { ...piorLinha, nome: rod.modo === 'levantadora' ? `P${piorLinha.rodizio + 1}` : `R${piorLinha.rodizio + 1}` } : null

  const zonas = desempenhoPorZona(sets, 'ataque')
  const melhorZona = Object.values(zonas.porZona).filter((z) => z.total >= 3).sort((a, b) => b.pctPonto - a.pctPonto)[0]

  const destaques = estatisticasPorAtleta(jogos).filter((l) => l.totalGeral.total >= 5).sort((a, b) => b.saldo - a.saldo).slice(0, 5)

  const r: RelatorioAdversario = {
    nome: jogos.length ? melhorNome(jogos.map((p) => p.adversarioNome)) : nome,
    jogos, resumo: resumoJogos(jogos),
    pontosDeles: origem.perdidos, totalPontosDeles: origem.totalPerdidos,
    errosDeles,
    camisasPerigosas: todasCamisas.filter((c) => c.pontos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, 5),
    camisasQueErram: todasCamisas.filter((c) => c.erros > 0).sort((a, b) => b.erros - a.erros).slice(0, 5),
    sideOutPct: sb.sideOutOportunidades ? sb.sideOutPct : null,
    breakPct: sb.breakOportunidades ? sb.breakPct : null,
    nossosFundamentos,
    destaques,
    piorRodizio,
    melhorZonaAtaque: melhorZona ? { zona: melhorZona.zona, pctPonto: melhorZona.pctPonto, total: melhorZona.total } : null,
    dicas: [],
  }
  r.dicas = dicasDoRelatorio(r)
  return r
}

/** Frases curtas e práticas pra preparar o jogo, só com o que os números mostram. */
export function dicasDoRelatorio(r: RelatorioAdversario): string[] {
  const dicas: string[] = []
  if (r.jogos.length === 0) return dicas
  const principal = r.pontosDeles[0]
  if (principal && r.totalPontosDeles >= 10) {
    dicas.push(principal.chave.startsWith('erro_') || principal.chave === 'ataque_bloqueado'
      ? `A maior parte dos pontos deles veio de erro nosso: ${principal.label.replace('Nosso erro: ', '').toLowerCase()} (${principal.pct}%). Treinar isso antes do jogo.`
      : `A maior parte dos pontos deles veio de ${principal.label.replace('Ponto deles: ', '').toLowerCase()} (${principal.pct}%).`)
  }
  const perigosa = r.camisasPerigosas[0]
  if (perigosa && perigosa.pontos >= 3) {
    const f = (Object.entries(perigosa.porFundamento) as [FundamentoScout, number][]).sort((a, b) => b[1] - a[1])[0]
    dicas.push(`Atenção na camisa ${perigosa.numero}: ${perigosa.pontos} pontos${f ? `, a maioria de ${LABEL_FUNDAMENTO[f[0]].toLowerCase()}` : ''}.`)
  }
  const erroMaior = r.errosDeles[0]
  if (erroMaior && erroMaior.porJogo >= 3) dicas.push(`Eles erram em média ${erroMaior.porJogo.toLocaleString('pt-BR')} vezes por jogo ${['recepcao', 'defesa'].includes(erroMaior.fundamento) ? 'na' : 'no'} ${erroMaior.label.toLowerCase()} — vale forçar isso.`)
  const pior = [...r.nossosFundamentos].filter((x) => x.linha.total >= 10).sort((a, b) => a.linha.eficiencia - b.linha.eficiencia)[0]
  if (pior) dicas.push(`Nosso fundamento mais fraco contra eles: ${pior.label.toLowerCase()} (${pior.linha.eficiencia}% de eficiência).`)
  if (r.sideOutPct !== null && r.sideOutPct < 45) dicas.push(`Nosso side-out contra eles foi de ${r.sideOutPct}%: o saque deles incomoda. Atenção na recepção.`)
  if (r.piorRodizio) dicas.push(`Rodízio que mais sofreu contra eles: ${r.piorRodizio.nome} (${r.piorRodizio.pontosFeitos} × ${r.piorRodizio.pontosSofridos}).`)
  if (r.melhorZonaAtaque && r.melhorZonaAtaque.pctPonto >= 50) dicas.push(`Nosso ataque na zona ${r.melhorZonaAtaque.zona} virou ponto ${r.melhorZonaAtaque.pctPonto}% das vezes contra eles.`)
  return dicas
}

/** Texto pronto pra copiar ou mandar no WhatsApp. */
export function textoRelatorioAdversario(r: RelatorioAdversario, turmaNome?: string): string {
  const l: string[] = []
  l.push(`📋 *Relatório do adversário: ${r.nome}*${turmaNome ? ` (${turmaNome})` : ''}`)
  l.push(`Jogos: ${r.resumo.jogos} · ${r.resumo.vitorias}V ${r.resumo.derrotas}D · sets ${r.resumo.setsGanhos}×${r.resumo.setsPerdidos} · pontos ${r.resumo.pontosFeitos}×${r.resumo.pontosSofridos}`)
  if (r.sideOutPct !== null || r.breakPct !== null) l.push(`Side-out ${r.sideOutPct ?? '—'}% · Break ${r.breakPct ?? '—'}%`)
  if (r.dicas.length) { l.push(''); l.push('*O que fazer:*'); r.dicas.forEach((d) => l.push(`• ${d}`)) }
  if (r.camisasPerigosas.length) { l.push(''); l.push(`*Camisas que mais pontuaram:* ${r.camisasPerigosas.map((c) => `#${c.numero} (${c.pontos})`).join(', ')}`) }
  if (r.errosDeles.length) l.push(`*Onde eles mais erram:* ${r.errosDeles.slice(0, 3).map((e) => `${e.label.toLowerCase()} (${e.total})`).join(', ')}`)
  return l.join('\n')
}
