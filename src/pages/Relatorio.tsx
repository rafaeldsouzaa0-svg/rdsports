import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '../store'
import { Card, EmptyState } from '../components/ui'
import { LogoExibicao } from '../components/LogoUpload'
import { encontrarLogoAdversario } from '../utils'
import { Trophy, Users, Volleyball, Download, Printer, ShieldAlert, Target, MapPin, ArrowLeftRight, ListOrdered, BarChart3, Repeat, Flame, Crosshair, Swords, Sparkles, Copy, Check } from 'lucide-react'
import {
  resumoFormato, scoutPorAtleta, scoutEquipe, erroPorFundamentoAdversario, pontosPorFundamentoAdversario, FUNDAMENTOS_SCOUT, LABEL_FUNDAMENTO,
  porFundamentoVazio, linhaVazia, analisePorPosicaoPartida, listaSubstituicoesDetalhada, pontoAPontoDoSet, eficienciaGeralEquipe,
  sideOutBreakPoint, sequenciasDePontos, maiorSequenciaPartida, desempenhoEmPontosDecisivos, impactoSubstituicao, confrontoDireto,
} from '../scoutEngine'
import { gerarResumoPartida } from '../resumoAutomatico'
import { gerarHtmlRelatorioPartida, gerarHtmlRelatorioAtleta, baixarHtml, abrirParaImprimir, slugify } from '../htmlReport'
import type { Partida, SetPartida, Atleta } from '../types'

const ROMANO = ['I', 'II', 'III', 'IV', 'V', 'VI']

function corEficiencia(ef: number): string {
  if (ef >= 50) return 'text-[var(--rd-positivo)]'
  if (ef >= 0) return 'text-[var(--rd-neutro)]'
  return 'text-[var(--rd-erro)]'
}

function BarraFundamento({ fundamento, linha }: { fundamento: string; linha: { positivo: number; neutro: number; erro: number; total: number } }) {
  const max = Math.max(linha.positivo, linha.neutro, linha.erro, 1)
  const linhas = [
    { label: 'Positivo', valor: linha.positivo, cor: 'var(--rd-positivo)' },
    { label: 'Neutro', valor: linha.neutro, cor: 'var(--rd-neutro)' },
    { label: 'Erro', valor: linha.erro, cor: 'var(--rd-erro)' },
  ]
  return (
    <div className="mb-3">
      <div className="text-xs font-bold mb-1.5">{fundamento}</div>
      <div className="flex flex-col gap-1">
        {linhas.map((l) => (
          <div key={l.label} className="grid grid-cols-[60px_1fr_28px] items-center gap-2 text-[11px]">
            <span className="text-[var(--rd-text-dim)]">{l.label}</span>
            <div className="h-2 rounded-full bg-black/20 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${(l.valor / max) * 100}%`, background: l.cor }} />
            </div>
            <span className="text-right font-semibold">{l.valor}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SecaoErrosAdversario({ sets }: { sets: SetPartida[] }) {
  const erros = erroPorFundamentoAdversario(sets)
  const fundamentosComErro = FUNDAMENTOS_SCOUT.filter((f) => erros[f].total > 0)
  if (fundamentosComErro.length === 0) return null
  return (
    <Card className="mb-5">
      <div className="font-bold text-sm mb-3 flex items-center gap-2"><ShieldAlert size={16} className="text-[var(--rd-erro)]" /> Erros do adversário</div>
      <div className="grid gap-2">
        {fundamentosComErro
          .sort((a, b) => erros[b].total - erros[a].total)
          .map((f) => {
            const numeros = Object.entries(erros[f].porNumero).sort((a, b) => b[1] - a[1])
            return (
              <div key={f} className="flex items-center justify-between text-xs border-t border-[var(--rd-border)] pt-2 first:border-t-0 first:pt-0">
                <span className="font-semibold">{LABEL_FUNDAMENTO[f]}</span>
                <span className="text-[var(--rd-text-dim)]">
                  {erros[f].total} erro(s){numeros.length > 0 && ` — nº ${numeros.map(([n, c]) => `${n} (${c}×)`).join(', ')}`}
                </span>
              </div>
            )
          })}
      </div>
    </Card>
  )
}

function SecaoPontosAdversario({ sets }: { sets: SetPartida[] }) {
  const pontos = pontosPorFundamentoAdversario(sets)
  const fundamentosComPonto = FUNDAMENTOS_SCOUT.filter((f) => pontos[f].total > 0)
  if (fundamentosComPonto.length === 0) return null
  return (
    <Card className="mb-5">
      <div className="font-bold text-sm mb-3 flex items-center gap-2"><Target size={16} className="text-[var(--rd-positivo)]" /> O que o adversário mais acertou</div>
      <div className="grid gap-2">
        {fundamentosComPonto
          .sort((a, b) => pontos[b].total - pontos[a].total)
          .map((f) => {
            const numeros = Object.entries(pontos[f].porNumero).sort((a, b) => b[1] - a[1])
            return (
              <div key={f} className="flex items-center justify-between text-xs border-t border-[var(--rd-border)] pt-2 first:border-t-0 first:pt-0">
                <span className="font-semibold">{LABEL_FUNDAMENTO[f]}</span>
                <span className="text-[var(--rd-text-dim)]">
                  {pontos[f].total} ponto(s){numeros.length > 0 && ` — nº ${numeros.map(([n, c]) => `${n} (${c}×)`).join(', ')}`}
                </span>
              </div>
            )
          })}
      </div>
    </Card>
  )
}

/** Comparação entre sets, lado a lado (pedido 30/10/2026 — "Nível 2": em vez
 *  de ter que abrir aba por aba pra comparar, mostra todos os sets já
 *  disputados numa tabela só, fundamento por fundamento + eficiência geral).
 *  Cada coluna é recalculada a partir dos eventos DAQUELE set sozinho — não
 *  depende da aba selecionada no relatório. Só aparece com 2+ sets jogados. */
function SecaoComparativoSets({ todosOsSets }: { todosOsSets: SetPartida[] }) {
  const setsComDados = todosOsSets.filter((s) => s.rallies.length > 0).sort((a, b) => a.numero - b.numero)
  if (setsComDados.length < 2) return null
  const geralPorSet = setsComDados.map((s) => ({ set: s, geral: eficienciaGeralEquipe([s]) }))
  const equipePorSet = setsComDados.map((s) => ({ set: s, equipe: scoutEquipe([s]) }))
  const fundamentosComDados = FUNDAMENTOS_SCOUT.filter((f) => equipePorSet.some(({ equipe }) => equipe[f].total > 0))
  return (
    <Card className="mb-5">
      <div className="font-bold text-sm mb-3 flex items-center gap-2"><BarChart3 size={16} className="rd-accent-text" /> Comparar sets</div>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs min-w-[380px]">
          <thead>
            <tr className="text-[var(--rd-text-dim)] text-left uppercase text-[10px]">
              <th className="py-1 px-1 font-bold">Fundamento</th>
              {geralPorSet.map(({ set }) => (
                <th key={set.id} className="py-1 px-1 font-bold text-center">Set {set.numero}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fundamentosComDados.map((f) => (
              <tr key={f} className="border-t" style={{ borderColor: 'var(--rd-border)' }}>
                <td className="py-1.5 px-1 font-medium">{LABEL_FUNDAMENTO[f]}</td>
                {equipePorSet.map(({ set, equipe }) => (
                  <td key={set.id} className={`py-1.5 px-1 text-center font-bold ${equipe[f].total === 0 ? 'text-[var(--rd-text-dim)]' : corEficiencia(equipe[f].eficiencia)}`}>
                    {equipe[f].total === 0 ? '—' : `${equipe[f].eficiencia}%`}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2" style={{ borderColor: 'var(--rd-border)' }}>
              <td className="py-1.5 px-1 font-bold">Geral</td>
              {geralPorSet.map(({ set, geral }) => (
                <td key={set.id} className={`py-1.5 px-1 text-center font-black ${corEficiencia(geral.eficiencia)}`}>{geral.eficiencia}%</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-[var(--rd-text-dim)] mt-2">Eficiência de cada set calculada só com os eventos daquele set — "—" quando o fundamento não teve nenhuma ação nele.</p>
    </Card>
  )
}

function corPercentual(pct: number): string {
  if (pct >= 55) return 'text-[var(--rd-positivo)]'
  if (pct >= 40) return 'text-[var(--rd-neutro)]'
  return 'text-[var(--rd-erro)]'
}

/** Side-out % × break point % (pedido 30/10/2026): separa a eficiência de
 *  quando RECEBEMOS o saque do adversário (side-out) da eficiência de
 *  quando NÓS sacamos (break point) — a eficiência geral sozinha esconde
 *  qual dos dois momentos está pesando mais no resultado. */
function SecaoSideOutBreakPoint({ sets }: { sets: SetPartida[] }) {
  const r = sideOutBreakPoint(sets)
  if (r.sideOutOportunidades === 0 && r.breakOportunidades === 0) return null
  return (
    <Card className="mb-5">
      <div className="font-bold text-sm mb-3 flex items-center gap-2"><Repeat size={16} className="rd-accent-text" /> Side-out × Break point</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border text-center py-3 px-2" style={{ borderColor: 'var(--rd-border)' }}>
          <div className="text-[10px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide">Side-out (recebendo)</div>
          <div className={`text-2xl font-black mt-1 ${corPercentual(r.sideOutPct)}`}>{r.sideOutOportunidades > 0 ? `${r.sideOutPct}%` : '—'}</div>
          <div className="text-[11px] text-[var(--rd-text-dim)] mt-0.5">{r.sideOutPontos}/{r.sideOutOportunidades} pontos</div>
        </div>
        <div className="rounded-lg border text-center py-3 px-2" style={{ borderColor: 'var(--rd-border)' }}>
          <div className="text-[10px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide">Break point (sacando)</div>
          <div className={`text-2xl font-black mt-1 ${corPercentual(r.breakPct)}`}>{r.breakOportunidades > 0 ? `${r.breakPct}%` : '—'}</div>
          <div className="text-[11px] text-[var(--rd-text-dim)] mt-0.5">{r.breakPontos}/{r.breakOportunidades} pontos</div>
        </div>
      </div>
      <p className="text-[11px] text-[var(--rd-text-dim)] mt-2">
        Side-out = % de rallies que ganhamos recebendo o saque do adversário. Break point = % de rallies que ganhamos sacando. Separar os dois mostra se o time sofre mais no saque ou na recepção.
      </p>
    </Card>
  )
}

/** Sequências de pontos seguidos / "runs" (pedido 30/10/2026) — ajuda a
 *  identificar momentos em que o jogo "escapou" pra decisões de tempo. */
function SecaoSequencias({ sets }: { sets: SetPartida[] }) {
  const porSet = sets.map((s) => ({ set: s, seqs: sequenciasDePontos(s, 3) })).filter((x) => x.seqs.length > 0)
  const maior = maiorSequenciaPartida(sets)
  if (porSet.length === 0) return null
  return (
    <Card className="mb-5">
      <div className="font-bold text-sm mb-3 flex items-center gap-2"><Flame size={16} className="rd-accent-text" /> Sequências de pontos</div>
      {maior && maior.tamanho >= 3 && (
        <p className="text-xs mb-3 p-2.5 rounded-lg" style={{ background: 'rgba(212,175,55,.1)', border: '1px solid rgba(212,175,55,.3)' }}>
          🔥 Maior sequência da partida: <strong>{maior.tamanho} pontos seguidos {maior.lado === 'CASA' ? 'nossos' : 'do adversário'}</strong> no Set {maior.setNumero} ({maior.placarCasaAntes}-{maior.placarAdversarioAntes} → {maior.placarCasaDepois}-{maior.placarAdversarioDepois}).
        </p>
      )}
      <div className="grid gap-3">
        {porSet.map(({ set, seqs }) => (
          <div key={set.id}>
            <div className="text-xs font-bold mb-1.5 rd-accent-text">Set {set.numero}</div>
            <div className="grid gap-1">
              {seqs.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs border-t border-[var(--rd-border)] pt-1.5 first:border-t-0 first:pt-0">
                  <span className="font-semibold" style={{ color: s.lado === 'CASA' ? 'var(--rd-positivo)' : 'var(--rd-erro)' }}>
                    {s.lado === 'CASA' ? 'Nós' : 'Adversário'}: {s.tamanho} pontos seguidos
                  </span>
                  <span className="text-[var(--rd-text-dim)]">{s.placarCasaAntes}-{s.placarAdversarioAntes} → {s.placarCasaDepois}-{s.placarAdversarioDepois}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Comparação entre atletas, lado a lado (pedido 30/10/2026) — pra ver de
 *  relance quem está rendendo mais nesse recorte, sem abrir perfil por
 *  perfil. Só aparece com 2+ atletas com ações registradas. */
function SecaoCompararAtletas({ sets, atletas }: { sets: SetPartida[]; atletas: Atleta[] }) {
  const comDados = scoutPorAtleta(sets).filter((p) => p.totalGeral.total > 0)
  if (comDados.length < 2) return null
  const nomeDe = (id: string) => atletas.find((a) => a.id === id)?.nome ?? 'Atleta removida'
  const ordenado = [...comDados].sort((a, b) => b.totalGeral.eficiencia - a.totalGeral.eficiencia)
  return (
    <Card className="mb-5">
      <div className="font-bold text-sm mb-3 flex items-center gap-2"><Users size={16} className="rd-accent-text" /> Comparar atletas</div>
      <div className="grid gap-2.5">
        {ordenado.map(({ atletaId, totalGeral }) => {
          const larguraPct = Math.max(4, ((totalGeral.eficiencia + 100) / 200) * 100)
          return (
            <div key={atletaId}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold truncate">{nomeDe(atletaId)}</span>
                <span className={`font-bold ${corEficiencia(totalGeral.eficiencia)}`}>{totalGeral.eficiencia}% · {totalGeral.total} ações</span>
              </div>
              <div className="h-2 rounded-full bg-black/20 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${larguraPct}%`, background: totalGeral.eficiencia >= 50 ? 'var(--rd-positivo)' : totalGeral.eficiencia >= 0 ? 'var(--rd-neutro)' : 'var(--rd-erro)' }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-[var(--rd-text-dim)] mt-2">Eficiência geral de cada atleta nesse recorte (todas as ações dela, positivo − erro ÷ total).</p>
    </Card>
  )
}

/** Eficiência em pontos DECISIVOS (reta final do set) vs o resto do set
 *  (pedido 30/10/2026) — mostra se a equipe trava na hora de fechar. */
function SecaoPontosDecisivos({ sets, partida }: { sets: SetPartida[]; partida: Partida }) {
  const r = desempenhoEmPontosDecisivos(sets, partida)
  if (r.decisivo.total === 0 && r.normal.total === 0) return null
  return (
    <Card className="mb-5">
      <div className="font-bold text-sm mb-3 flex items-center gap-2"><Crosshair size={16} className="rd-accent-text" /> Pontos decisivos</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border text-center py-3 px-2" style={{ borderColor: 'var(--rd-border)' }}>
          <div className="text-[10px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide">Reta final do set</div>
          <div className={`text-2xl font-black mt-1 ${r.decisivo.total === 0 ? 'text-[var(--rd-text-dim)]' : corEficiencia(r.decisivo.eficiencia)}`}>
            {r.decisivo.total > 0 ? `${r.decisivo.eficiencia}%` : '—'}
          </div>
          <div className="text-[11px] text-[var(--rd-text-dim)] mt-0.5">{r.decisivo.total} ação(ões)</div>
        </div>
        <div className="rounded-lg border text-center py-3 px-2" style={{ borderColor: 'var(--rd-border)' }}>
          <div className="text-[10px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide">Resto do set</div>
          <div className={`text-2xl font-black mt-1 ${r.normal.total === 0 ? 'text-[var(--rd-text-dim)]' : corEficiencia(r.normal.eficiencia)}`}>
            {r.normal.total > 0 ? `${r.normal.eficiencia}%` : '—'}
          </div>
          <div className="text-[11px] text-[var(--rd-text-dim)] mt-0.5">{r.normal.total} ação(ões)</div>
        </div>
      </div>
      <p className="text-[11px] text-[var(--rd-text-dim)] mt-2">
        "Reta final" = últimos pontos antes do set fechar (ou além, em caso de vantagem). Separar do resto do set mostra se a equipe trava justamente na hora de fechar.
      </p>
    </Card>
  )
}

function SecaoPorPosicao({ sets }: { sets: SetPartida[] }) {
  const analise = analisePorPosicaoPartida(sets)
  const comDados = [0, 1, 2, 3, 4, 5].filter((i) => analise[i].pontos > 0 || analise[i].erros > 0)
  if (comDados.length === 0) return null
  let melhor = comDados[0]
  let pior = comDados[0]
  for (const i of comDados) {
    if (analise[i].pontos - analise[i].erros > analise[melhor].pontos - analise[melhor].erros) melhor = i
    if (analise[i].pontos - analise[i].erros < analise[pior].pontos - analise[pior].erros) pior = i
  }
  return (
    <Card className="mb-5">
      <div className="font-bold text-sm mb-3 flex items-center gap-2"><MapPin size={16} className="rd-accent-text" /> Desempenho por posição</div>
      {melhor !== pior && (
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(46,204,113,.15)', color: 'var(--rd-positivo)' }}>
            🏆 Melhor: posição {ROMANO[melhor]}
          </span>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(231,76,60,.15)', color: 'var(--rd-erro)' }}>
            ⚠️ Mais pontos tomados: posição {ROMANO[pior]}
          </span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-lg border text-center py-2.5 px-1" style={{ borderColor: 'var(--rd-border)' }}>
            <div className="text-[10px] font-bold text-[var(--rd-text-dim)]">Posição {ROMANO[i]}</div>
            <div className="text-xs font-bold mt-0.5">
              <span style={{ color: 'var(--rd-positivo)' }}>+{analise[i].pontos}</span> / <span style={{ color: 'var(--rd-erro)' }}>-{analise[i].erros}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[var(--rd-text-dim)] mt-2">+ = pontos que marcamos com a atleta nessa posição • − = pontos perdidos por erro nosso nessa posição.</p>
    </Card>
  )
}

function SecaoSubstituicoes({ sets, atletas }: { sets: SetPartida[]; atletas: Atleta[] }) {
  const nomeDe = (id: string | null) => (id ? atletas.find((a) => a.id === id)?.nome ?? 'Atleta removida' : '—')
  const comSubs = sets.map((s) => ({ set: s, subs: listaSubstituicoesDetalhada(s) })).filter((x) => x.subs.length > 0)
  if (comSubs.length === 0) return null
  return (
    <Card className="mb-5">
      <div className="font-bold text-sm mb-3 flex items-center gap-2"><ArrowLeftRight size={16} className="rd-accent-text" /> Substituições</div>
      <div className="grid gap-3">
        {comSubs.map(({ set, subs }) => (
          <div key={set.id}>
            <div className="text-xs font-bold mb-1.5 rd-accent-text">Set {set.numero}</div>
            <div className="grid gap-1">
              {subs.map((s) => {
                const impacto = impactoSubstituicao(set, s.id)
                const temDadosSuficientes = impacto && impacto.antes.total > 0 && impacto.depois.total > 0
                return (
                  <div key={s.id} className="text-xs border-t border-[var(--rd-border)] pt-1.5 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between">
                      <span><strong>{nomeDe(s.atletaEntraId)}</strong> entrou no lugar de <strong>{nomeDe(s.atletaSaiId)}</strong> (posição {ROMANO[s.posicaoIndex]})</span>
                      <span className="text-[var(--rd-text-dim)] shrink-0 ml-2">{s.placarCasaNoMomento} × {s.placarAdversarioNoMomento}</span>
                    </div>
                    {temDadosSuficientes && (
                      <div className="text-[11px] text-[var(--rd-text-dim)] mt-0.5">
                        Impacto: {impacto.antes.eficiencia}% antes → <span className={corEficiencia(impacto.depois.eficiencia)}>{impacto.depois.eficiencia}%</span> depois da troca
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Linha do tempo visual do placar (pedido 30/10/2026) — a mesma informação
 *  dos "chips" de ponto a ponto abaixo, só que como gráfico de linha da
 *  DIFERENÇA de placar (nós − adversário) rally a rally, pra ficar óbvio de
 *  relance em que momento o set "virou" ou "escapou", sem precisar ler
 *  número por número. Puramente visual — não recalcula nada, só desenha o
 *  que `pontoAPontoDoSet` já calculou. */
function LinhaDoTempoPlacar({ pontos }: { pontos: { placarCasa: number; placarAdversario: number }[] }) {
  if (pontos.length < 2) return null
  const diffs = pontos.map((p) => p.placarCasa - p.placarAdversario)
  const maxAbs = Math.max(1, ...diffs.map((d) => Math.abs(d)))
  const w = 100
  const h = 36
  const margem = 3
  const coordX = (i: number) => (i / (pontos.length - 1)) * w
  const coordY = (d: number) => h / 2 - (d / maxAbs) * (h / 2 - margem)
  const linha = diffs.map((d, i) => `${coordX(i).toFixed(2)},${coordY(d).toFixed(2)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full mb-1.5" style={{ height: 44 }}>
      <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="var(--rd-border)" strokeWidth="0.6" strokeDasharray="2,2" />
      <polyline points={linha} fill="none" stroke="var(--rd-gold)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function SecaoPontoAPonto({ sets }: { sets: SetPartida[] }) {
  const comPontos = sets.map((s) => ({ set: s, pontos: pontoAPontoDoSet(s) })).filter((x) => x.pontos.length > 0)
  if (comPontos.length === 0) return null
  return (
    <Card className="mb-5">
      <div className="font-bold text-sm mb-3 flex items-center gap-2"><ListOrdered size={16} className="rd-accent-text" /> Ponto a ponto</div>
      <div className="grid gap-3">
        {comPontos.map(({ set, pontos }) => (
          <div key={set.id}>
            <div className="text-xs font-bold mb-1.5 rd-accent-text">Set {set.numero}</div>
            <LinhaDoTempoPlacar pontos={pontos} />
            <div className="flex flex-wrap gap-1">
              {pontos.map((p) => (
                <span
                  key={p.numero}
                  className="text-[10px] font-bold px-1.5 py-1 rounded"
                  style={{ background: 'rgba(255,255,255,.06)', color: p.ganhouCasa ? 'var(--rd-positivo)' : 'var(--rd-erro)' }}
                >
                  {p.placarCasa}-{p.placarAdversario}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[var(--rd-text-dim)] mt-2">A linha mostra a diferença de placar (nós − adversário) rally a rally — acima da linha pontilhada é vantagem nossa, abaixo é vantagem do adversário.</p>
    </Card>
  )
}

/** Resumo automático em texto (pedido 30/10/2026) — pronto pra copiar e
 *  mandar num grupo, sem precisar ler tabela por tabela. */
function SecaoResumoAutomatico({ partida, atletas }: { partida: Partida; atletas: Atleta[] }) {
  const resumo = gerarResumoPartida(partida, atletas)
  const [copiado, setCopiado] = useState(false)
  if (!resumo) return null
  function copiar() {
    navigator.clipboard?.writeText(resumo!).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    })
  }
  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="font-bold text-sm flex items-center gap-2"><Sparkles size={16} className="rd-accent-text" /> Resumo automático</div>
        <button className="rd-btn text-xs" onClick={copiar}>
          {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <p className="text-sm leading-relaxed">{resumo}</p>
    </Card>
  )
}

/** Confronto direto contra esse adversário específico (pedido 30/10/2026) —
 *  retrospecto histórico, pra consultar antes de uma revanche. Só aparece
 *  quando já houve PELO MENOS UM confronto anterior além deste (senão é só
 *  repetir o que já está no resto da tela). */
function SecaoConfrontoDireto({ partida, partidas }: { partida: Partida; partidas: Partida[] }) {
  if (!partida.adversarioNome) return null
  const r = confrontoDireto(partidas, partida.turmaId, partida.adversarioNome)
  if (r.jogos.length < 2) return null
  return (
    <Card className="mb-5">
      <div className="font-bold text-sm mb-3 flex items-center gap-2"><Swords size={16} className="rd-accent-text" /> Confronto direto vs {partida.adversarioNome}</div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <span className="text-sm font-bold">
          <span className={corVD(r.vitorias, r.derrotas)}>{r.vitorias} V × {r.derrotas} D</span>
          <span className="text-xs font-normal text-[var(--rd-text-dim)]"> ({r.jogos.length} confronto(s) no total)</span>
        </span>
        {r.eficienciaGeral.total > 0 && (
          <span className={`text-xs font-bold ${corEficiencia(r.eficienciaGeral.eficiencia)}`}>{r.eficienciaGeral.eficiencia}% de eficiência geral nesses jogos</span>
        )}
      </div>
      {r.piorFundamentoNosso && (
        <p className="text-xs text-[var(--rd-text-dim)] mb-2">
          ⚠️ Contra esse adversário, nosso fundamento mais fraco costuma ser <strong>{LABEL_FUNDAMENTO[r.piorFundamentoNosso]}</strong>.
        </p>
      )}
      <div className="grid gap-1">
        {r.jogos.map((p) => {
          const venceu = p.setsGanhosCasa > p.setsGanhosAdversario
          return (
            <Link key={p.id} to={`/relatorio/${p.id}`} className="flex items-center justify-between text-xs border-t border-[var(--rd-border)] pt-1.5 first:border-t-0 first:pt-0 hover:opacity-80">
              <span>{p.data}{p.id === partida.id && <span className="text-[var(--rd-text-dim)]"> (esta partida)</span>}</span>
              <span className={venceu ? 'text-[var(--rd-positivo)] font-bold' : 'text-[var(--rd-erro)] font-bold'}>{p.setsGanhosCasa} × {p.setsGanhosAdversario}</span>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}

function corVD(v: number, d: number): string {
  if (v + d === 0) return 'text-[var(--rd-text-dim)]'
  return v >= d ? 'text-[var(--rd-positivo)]' : 'text-[var(--rd-erro)]'
}

function SecaoScout({ titulo, sets, atletas, partida, rotuloRecorte }: { titulo: string; sets: SetPartida[]; atletas: Atleta[]; partida: Partida; rotuloRecorte: string }) {
  const equipe = scoutEquipe(sets)
  const comDados = scoutPorAtleta(sets)
  // Pedido 23/10/2026: mostrar TODAS as atletas da turma no relatório geral,
  // até quem não entrou na partida ou não teve nenhuma ação registrada —
  // completa a lista com linhas zeradas pra quem ficou de fora.
  // Jogo com convocação (11/11/2026): a lista é das convocadas, incluindo
  // reforços de turmas de baixo; sem convocação, a turma inteira.
  const atletasDaTurma = partida.convocadas?.length
    ? atletas.filter((a) => partida.convocadas!.includes(a.id) && !a.deletedAt)
    : atletas.filter((a) => a.turmaId === partida.turmaId && !a.deletedAt)
  const idsComDados = new Set(comDados.map((p) => p.atletaId))
  const semDados = atletasDaTurma
    .filter((a) => !idsComDados.has(a.id))
    .map((a) => ({ atletaId: a.id, porFundamento: porFundamentoVazio(), totalGeral: linhaVazia() }))
  const porAtleta = [...comDados, ...semDados]
  const fundamentosComDados = FUNDAMENTOS_SCOUT.filter((f) => equipe[f].total > 0)

  function compartilharAtleta(atletaId: string, nome: string, modo: 'html' | 'pdf') {
    const html = gerarHtmlRelatorioAtleta(partida, sets, { id: atletaId, nome }, rotuloRecorte)
    if (modo === 'html') baixarHtml(html, `RDSports_${slugify(nome)}_${slugify(partida.adversarioNome ?? 'adversario')}_${partida.data}.html`)
    else abrirParaImprimir(html)
  }

  return (
    <div className="mb-8">
      <h2 className="text-base font-black mb-3 pb-2 border-b-2 border-[var(--rd-gold)]">{titulo}</h2>

      {porAtleta.length === 0 ? (
        <EmptyState icon={<Users size={32} />} text="Nenhuma atleta cadastrada nessa turma ainda." />
      ) : (
        <>
          {fundamentosComDados.length > 0 && (
            <Card className="mb-3">
              <div className="grid sm:grid-cols-2 gap-x-6">
                {fundamentosComDados.map((f) => (
                  <BarraFundamento key={f} fundamento={LABEL_FUNDAMENTO[f]} linha={equipe[f]} />
                ))}
              </div>
            </Card>
          )}

          <div className="grid gap-3">
            {porAtleta.map(({ atletaId, porFundamento, totalGeral }) => {
              const atleta = atletas.find((a) => a.id === atletaId)
              return (
                <Card key={atletaId}>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="font-bold text-sm truncate">{atleta?.nome ?? 'Atleta removida'}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold ${totalGeral.total === 0 ? 'text-[var(--rd-text-dim)]' : corEficiencia(totalGeral.eficiencia)}`}>
                        {totalGeral.total} ações{totalGeral.total > 0 && ` • ${totalGeral.eficiencia}%`}
                      </span>
                      {atleta && (
                        <span className="flex gap-1">
                          <button className="rd-btn !p-1.5" title="Baixar relatório individual em HTML" onClick={() => compartilharAtleta(atletaId, atleta.nome, 'html')}>
                            <Download size={13} />
                          </button>
                          <button className="rd-btn !p-1.5" title="Baixar relatório individual em PDF" onClick={() => compartilharAtleta(atletaId, atleta.nome, 'pdf')}>
                            <Printer size={13} />
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                  {totalGeral.total === 0 ? (
                    <p className="text-xs text-[var(--rd-text-dim)]">Não entrou em quadra (ou nenhuma ação registrada) neste recorte.</p>
                  ) : (
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-xs min-w-[460px]">
                        <thead>
                          <tr className="text-[var(--rd-text-dim)] text-left uppercase text-[10px]">
                            <th className="py-1 px-1 font-bold">Fundamento</th>
                            <th className="py-1 px-1 font-bold text-center">Positivo</th>
                            <th className="py-1 px-1 font-bold text-center">Neutro</th>
                            <th className="py-1 px-1 font-bold text-center">Erro</th>
                            <th className="py-1 px-1 font-bold text-center">Total</th>
                            <th className="py-1 px-1 font-bold text-center">Efic.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {FUNDAMENTOS_SCOUT.map((f) => {
                            const l = porFundamento[f]
                            if (l.total === 0) return null
                            return (
                              <tr key={f} className="border-t border-[var(--rd-border)]">
                                <td className="py-1.5 px-1 font-medium">{LABEL_FUNDAMENTO[f]}</td>
                                <td className="py-1.5 px-1 text-center" style={{ color: 'var(--rd-positivo)' }}>{l.positivo}</td>
                                <td className="py-1.5 px-1 text-center" style={{ color: 'var(--rd-neutro)' }}>{l.neutro}</td>
                                <td className="py-1.5 px-1 text-center" style={{ color: 'var(--rd-erro)' }}>{l.erro}</td>
                                <td className="py-1.5 px-1 text-center">{l.total}</td>
                                <td className={`py-1.5 px-1 text-center font-bold ${corEficiencia(l.eficiencia)}`}>{l.eficiencia}%</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function Relatorio() {
  const { id } = useParams()
  const { partidas, atletas, adversarios } = useStore()
  const partida = partidas.find((p) => p.id === id)
  const [aba, setAba] = useState<'geral' | number>('geral')
  if (!partida) return <p>Partida não encontrada.</p>

  const setsParaExibir = aba === 'geral' ? partida.setsPartida : partida.setsPartida.filter((s) => s.numero === aba)
  const rotuloRecorte = aba === 'geral' ? 'Todos os sets' : `Set ${aba}`

  function compartilharPartida(modo: 'html' | 'pdf') {
    const html = gerarHtmlRelatorioPartida(partida!, setsParaExibir, atletas, rotuloRecorte)
    const nomeArquivo = `RDSports_relatorio_${slugify(partida!.adversarioNome ?? 'adversario')}_${partida!.data}.html`
    if (modo === 'html') baixarHtml(html, nomeArquivo)
    else abrirParaImprimir(html)
  }

  return (
    <div>
      <div className="rd-header-gold p-6 flex items-center gap-4 mb-5">
        {(() => {
          const logo = encontrarLogoAdversario(adversarios, partida.adversarioNome)
          return logo ? (
            <LogoExibicao logoUrl={logo} nome={partida.adversarioNome ?? 'Adversário'} tamanho={56} />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Volleyball size={28} />
            </div>
          )
        })()}
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-tight truncate">vs {partida.adversarioNome ?? 'Adversário'}</h1>
          <p className="text-sm opacity-85 mt-0.5">{partida.data} • {resumoFormato(partida)}</p>
        </div>
      </div>

      <Card className="mb-4 text-center">
        <div className="text-5xl font-black tracking-tight">
          {partida.setsGanhosCasa} <span className="text-[var(--rd-gold)]">×</span> {partida.setsGanhosAdversario}
        </div>
        <div className="text-sm text-[var(--rd-text-dim)] mt-1">{partida.status === 'FINALIZADA' ? 'Finalizada' : 'Em andamento'}</div>
        <div className="flex justify-center gap-2 flex-wrap mt-2">
          {partida.setsPartida.map((s) => (
            <span
              key={s.id}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{
                background: s.vencedor === 'CASA' ? 'rgba(46,204,113,.15)' : s.vencedor === 'ADVERSARIO' ? 'rgba(231,76,60,.15)' : 'rgba(255,255,255,.08)',
                color: s.vencedor === 'CASA' ? 'var(--rd-positivo)' : s.vencedor === 'ADVERSARIO' ? 'var(--rd-erro)' : 'var(--rd-text-dim)',
              }}
            >
              Set {s.numero}: {s.placarCasa}-{s.placarAdversario}
            </span>
          ))}
        </div>
      </Card>

      <SecaoResumoAutomatico partida={partida} atletas={atletas} />

      <SecaoConfrontoDireto partida={partida} partidas={partidas} />

      <div className="flex gap-2 flex-wrap mb-5 sticky top-0 py-2 z-10 bg-[var(--rd-bg)]/90 backdrop-blur">
        <button onClick={() => setAba('geral')} className={`rd-btn text-xs ${aba === 'geral' ? 'rd-btn-gold' : ''}`}>
          <Trophy size={14} /> Geral (todos os sets)
        </button>
        {partida.setsPartida.map((s) => (
          <button key={s.id} onClick={() => setAba(s.numero)} className={`rd-btn text-xs ${aba === s.numero ? 'rd-btn-gold' : ''}`}>
            Set {s.numero} — {s.placarCasa} × {s.placarAdversario}
          </button>
        ))}
      </div>

      <Card className="mb-5 flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-bold flex items-center gap-2"><Download size={16} className="rd-accent-text" /> Compartilhar relatório ({rotuloRecorte})</span>
        <div className="flex gap-2">
          <button className="rd-btn text-xs" onClick={() => compartilharPartida('html')}><Download size={14} /> Baixar HTML</button>
          <button className="rd-btn text-xs" onClick={() => compartilharPartida('pdf')}><Printer size={14} /> Baixar PDF</button>
        </div>
      </Card>

      <SecaoComparativoSets todosOsSets={partida.setsPartida} />

      <SecaoSideOutBreakPoint sets={setsParaExibir} />

      <SecaoPontosDecisivos sets={setsParaExibir} partida={partida} />

      <SecaoSequencias sets={setsParaExibir} />

      <SecaoCompararAtletas sets={setsParaExibir} atletas={atletas} />

      <SecaoPorPosicao sets={setsParaExibir} />

      <SecaoPontosAdversario sets={setsParaExibir} />

      <SecaoErrosAdversario sets={setsParaExibir} />

      <SecaoSubstituicoes sets={setsParaExibir} atletas={atletas} />

      <SecaoPontoAPonto sets={setsParaExibir} />

      <SecaoScout
        titulo={aba === 'geral' ? '📊 Scout completo — todos os sets' : `🏐 Scout completo — Set ${aba}`}
        sets={setsParaExibir}
        atletas={atletas}
        partida={partida}
        rotuloRecorte={rotuloRecorte}
      />

      <Link to="/historico" className="inline-block mt-4 text-sm text-[var(--rd-text-dim)] underline">← Voltar pro Histórico</Link>
    </div>
  )
}
