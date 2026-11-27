import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3, Users, MapPin, Repeat, Crosshair, Trophy, Target, TrendingUp, ListOrdered, Shield, Flame, ChevronDown, ChevronUp, FileText, Info,
} from 'lucide-react'
import { useStore } from '../store'
import { PageTitle, Card, EmptyState } from '../components/ui'
import GraficoEvolucao from '../components/GraficoEvolucao'
import {
  scoutEquipe, FUNDAMENTOS_SCOUT, LABEL_FUNDAMENTO, analisePorAtletaEPosicao, sideOutBreakPoint,
  desempenhoEmPontosDecisivos, combinarLinhas, analisePorPosicaoPartida, erroPorFundamentoAdversario,
} from '../scoutEngine'
import {
  filtrarPartidas, jogosFinalizados, resumoJogos, origemDosPontos, desempenhoPorNumeroSet, evolucaoPorJogo,
  maioresSequencias, estatisticasPorAtleta, rankings, eficienciaGeral, normalizarNome,
  type PeriodoEstatistica, type LinhaAtletaCompleta, type ItemOrigem,
} from '../estatisticasCompletas'
import { formatDate } from '../utils'
import type { SetPartida, Atleta, Partida, FundamentoScout } from '../types'

const ROMANO_POS = ['I', 'II', 'III', 'IV', 'V', 'VI']
const CHAVE_TURMA = 'rd-estatisticas-turma'

type Aba = 'geral' | 'fundamentos' | 'atletas' | 'rankings' | 'jogos' | 'quadra'
const ABAS: { id: Aba; label: string; Icon: typeof BarChart3 }[] = [
  { id: 'geral', label: 'Visão geral', Icon: BarChart3 },
  { id: 'fundamentos', label: 'Fundamentos', Icon: Target },
  { id: 'atletas', label: 'Atletas', Icon: Users },
  { id: 'rankings', label: 'Rankings', Icon: Trophy },
  { id: 'jogos', label: 'Jogos', Icon: TrendingUp },
  { id: 'quadra', label: 'Quadra', Icon: MapPin },
]

const PERIODOS: { id: PeriodoEstatistica; label: string }[] = [
  { id: 'TEMPORADA', label: 'Temporada' },
  { id: 'ULTIMOS_5', label: 'Últimos 5' },
  { id: 'ULTIMO', label: 'Último jogo' },
]

function corEf(ef: number): string {
  if (ef >= 50) return 'var(--rd-positivo)'
  if (ef >= 0) return 'var(--rd-neutro)'
  return 'var(--rd-erro)'
}
function corPct(pct: number): string {
  if (pct >= 55) return 'var(--rd-positivo)'
  if (pct >= 40) return 'var(--rd-neutro)'
  return 'var(--rd-erro)'
}

function lerTurmaSalva(): string {
  try { return localStorage.getItem(CHAVE_TURMA) ?? '' } catch { return '' }
}
function salvarTurma(id: string) {
  try { localStorage.setItem(CHAVE_TURMA, id) } catch { /* sem armazenamento: só não lembra */ }
}

// ------------------------------------------------------------ peças visuais

function Secao({ titulo, icon, children, dica }: { titulo: string; icon?: ReactNode; children: ReactNode; dica?: string }) {
  return (
    <Card>
      <h2 className="text-sm font-black mb-3 flex items-center gap-2">
        {icon && <span className="rd-accent-text inline-flex">{icon}</span>}
        {titulo}
      </h2>
      {children}
      {dica && <p className="text-[11px] text-[var(--rd-text-dim)] mt-3 flex gap-1.5"><Info size={12} className="shrink-0 mt-0.5" />{dica}</p>}
    </Card>
  )
}

function Kpi({ label, valor, sub, cor }: { label: string; valor: ReactNode; sub?: ReactNode; cor?: string }) {
  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--rd-border)' }}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--rd-text-dim)]">{label}</div>
      <div className="text-xl font-black leading-tight mt-0.5 tabular-nums" style={cor ? { color: cor } : undefined}>{valor}</div>
      {sub && <div className="text-[11px] text-[var(--rd-text-dim)] mt-0.5">{sub}</div>}
    </div>
  )
}

function BarraHorizontal({ label, valor, max, cor, direita }: { label: string; valor: number; max: number; cor: string; direita: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1 gap-2">
        <span className="truncate">{label}</span>
        <span className="font-bold tabular-nums shrink-0">{direita}</span>
      </div>
      <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${max > 0 ? Math.max(3, (valor / max) * 100) : 0}%`, background: cor }} />
      </div>
    </div>
  )
}

function ListaOrigem({ titulo, itens, total, cor }: { titulo: string; itens: ItemOrigem[]; total: number; cor: string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor))
  return (
    <div>
      <div className="text-xs font-bold mb-2 flex justify-between">
        <span>{titulo}</span><span className="text-[var(--rd-text-dim)]">{total}</span>
      </div>
      {itens.length === 0 ? (
        <p className="text-xs text-[var(--rd-text-dim)]">Nada registrado.</p>
      ) : (
        <div className="grid gap-2">
          {itens.map((i) => (
            <BarraHorizontal key={i.chave} label={i.label} valor={i.valor} max={max} cor={cor} direita={<>{i.valor} <span className="text-[var(--rd-text-dim)] font-normal">({i.pct}%)</span></>} />
          ))}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------- abas

function AbaGeral({ partidas }: { partidas: Partida[] }) {
  const sets = partidas.flatMap((p) => p.setsPartida)
  const r = resumoJogos(partidas)
  const sb = sideOutBreakPoint(sets)
  const geral = eficienciaGeral(sets)
  const origem = origemDosPontos(sets)
  const seq = maioresSequencias(partidas)
  const porSet = desempenhoPorNumeroSet(partidas)
  const decisivos = partidas.map((p) => desempenhoEmPontosDecisivos(p.setsPartida, p))
  const reta = combinarLinhas(decisivos.map((d) => d.decisivo))
  const resto = combinarLinhas(decisivos.map((d) => d.normal))

  return (
    <div className="grid gap-4">
      <Secao titulo="Resumo" icon={<Trophy size={16} />}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Kpi label="Jogos" valor={`${r.vitorias}V · ${r.derrotas}D`} sub={`${r.jogos} jogo(s)`} />
          <Kpi label="Aproveitamento" valor={`${r.aproveitamento}%`} cor={corPct(r.aproveitamento)} sub="vitórias" />
          <Kpi label="Sets" valor={`${r.setsGanhos} × ${r.setsPerdidos}`} sub={`apertados: ${r.setsApertadosGanhos}V ${r.setsApertadosPerdidos}D`} />
          <Kpi label="Saldo de pontos" valor={`${r.saldoPontos > 0 ? '+' : ''}${r.saldoPontos}`} cor={r.saldoPontos >= 0 ? 'var(--rd-positivo)' : 'var(--rd-erro)'} sub={`${r.pontosFeitos} feitos · ${r.pontosSofridos} sofridos`} />
          <Kpi label="Média por set" valor={`${r.mediaPontosFeitosPorSet.toLocaleString('pt-BR')} × ${r.mediaPontosSofridosPorSet.toLocaleString('pt-BR')}`} sub="pontos nossos × deles" />
          <Kpi label="Eficiência geral" valor={`${geral.eficiencia}%`} cor={corEf(geral.eficiencia)} sub={`${geral.total} ações`} />
          <Kpi label="Momento" valor={r.sequenciaAtual ? `${r.sequenciaAtual.tamanho} ${r.sequenciaAtual.tipo === 'V' ? 'vitória(s)' : 'derrota(s)'}` : '—'} cor={r.sequenciaAtual?.tipo === 'V' ? 'var(--rd-positivo)' : r.sequenciaAtual ? 'var(--rd-erro)' : undefined} sub="seguidas" />
          <Kpi label="Maior sequência" valor={<><span style={{ color: 'var(--rd-positivo)' }}>{seq.aFavor}</span> / <span style={{ color: 'var(--rd-erro)' }}>{seq.contra}</span></>} sub="pontos seguidos a favor / contra" />
        </div>
      </Secao>

      <Secao titulo="Side-out e break point" icon={<Repeat size={16} />} dica="Side-out: pontos que ganhamos quando o adversário sacava. Break point: pontos que ganhamos no nosso saque.">
        <div className="grid grid-cols-2 gap-2">
          <Kpi label="Side-out" valor={sb.sideOutOportunidades ? `${sb.sideOutPct}%` : '—'} cor={sb.sideOutOportunidades ? corPct(sb.sideOutPct) : undefined} sub={`${sb.sideOutPontos} de ${sb.sideOutOportunidades}`} />
          <Kpi label="Break point" valor={sb.breakOportunidades ? `${sb.breakPct}%` : '—'} cor={sb.breakOportunidades ? corPct(sb.breakPct) : undefined} sub={`${sb.breakPontos} de ${sb.breakOportunidades}`} />
        </div>
      </Secao>

      <Secao titulo="De onde vêm os pontos" icon={<Flame size={16} />}>
        <div className="grid sm:grid-cols-2 gap-5">
          <ListaOrigem titulo="Pontos que fizemos" itens={origem.ganhos} total={origem.totalGanhos} cor="var(--rd-positivo)" />
          <ListaOrigem titulo="Pontos que cedemos" itens={origem.perdidos} total={origem.totalPerdidos} cor="var(--rd-erro)" />
        </div>
      </Secao>

      <Secao titulo="Reta final do set" icon={<Crosshair size={16} />} dica="Reta final = últimos 5 pontos antes de fechar o set. Mostra se o time trava na hora de fechar.">
        <div className="grid grid-cols-2 gap-2">
          <Kpi label="Reta final" valor={reta.total ? `${reta.eficiencia}%` : '—'} cor={reta.total ? corEf(reta.eficiencia) : undefined} sub={`${reta.total} ações`} />
          <Kpi label="Resto do set" valor={resto.total ? `${resto.eficiencia}%` : '—'} cor={resto.total ? corEf(resto.eficiencia) : undefined} sub={`${resto.total} ações`} />
        </div>
      </Secao>

      {porSet.length > 0 && (
        <Secao titulo="Desempenho por set" icon={<ListOrdered size={16} />} dica="Ajuda a ver se o time começa devagar ou cai no fim do jogo.">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--rd-text-dim)]">
                <th className="text-left font-semibold py-1">Set</th>
                <th className="text-center font-semibold">Ganhos</th>
                <th className="text-center font-semibold">Pontos</th>
                <th className="text-right font-semibold">Eficiência</th>
              </tr>
            </thead>
            <tbody>
              {porSet.map((l) => (
                <tr key={l.numero} className="border-t" style={{ borderColor: 'var(--rd-border)' }}>
                  <td className="py-2 font-bold">{l.numero}º set</td>
                  <td className="text-center tabular-nums">{l.ganhos}/{l.jogados}</td>
                  <td className="text-center tabular-nums">{l.pontosFeitos} × {l.pontosSofridos}</td>
                  <td className="text-right font-bold tabular-nums" style={{ color: corEf(l.eficiencia) }}>{l.eficiencia}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Secao>
      )}
    </div>
  )
}

function AbaFundamentos({ sets }: { sets: SetPartida[] }) {
  const equipe = scoutEquipe(sets)
  const comDados = FUNDAMENTOS_SCOUT.filter((f) => equipe[f].total > 0)
  const errosDeles = erroPorFundamentoAdversario(sets)
  const errosDelesLista = FUNDAMENTOS_SCOUT.filter((f) => errosDeles[f].total > 0).sort((a, b) => errosDeles[b].total - errosDeles[a].total)
  const maxErrosDeles = Math.max(1, ...errosDelesLista.map((f) => errosDeles[f].total))

  return (
    <div className="grid gap-4">
      <Secao titulo="Nosso time por fundamento" icon={<Target size={16} />} dica="Eficiência = (positivos − erros) ÷ total. Positivo = ponto ou bola boa; neutro = bola em jogo ou média.">
        {comDados.length === 0 ? (
          <p className="text-xs text-[var(--rd-text-dim)]">Nenhum lance registrado.</p>
        ) : (
          <div className="grid gap-4">
            {comDados.map((f) => {
              const l = equipe[f]
              return (
                <div key={f}>
                  <div className="flex items-center justify-between text-sm font-bold mb-1.5">
                    <span>{LABEL_FUNDAMENTO[f]}</span>
                    <span style={{ color: corEf(l.eficiencia) }}>{l.eficiencia}%</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-black/10 dark:bg-white/10" role="img" aria-label={`${l.positivo} positivos, ${l.neutro} neutros, ${l.erro} erros`}>
                    <div style={{ width: `${(l.positivo / l.total) * 100}%`, background: 'var(--rd-positivo)' }} />
                    <div style={{ width: `${(l.neutro / l.total) * 100}%`, background: 'var(--rd-neutro)' }} />
                    <div style={{ width: `${(l.erro / l.total) * 100}%`, background: 'var(--rd-erro)' }} />
                  </div>
                  <div className="flex justify-between text-[11px] mt-1 text-[var(--rd-text-dim)] tabular-nums">
                    <span><b style={{ color: 'var(--rd-positivo)' }}>{l.positivo}</b> positivos</span>
                    <span><b style={{ color: 'var(--rd-neutro)' }}>{l.neutro}</b> neutros</span>
                    <span><b style={{ color: 'var(--rd-erro)' }}>{l.erro}</b> erros</span>
                    <span>{l.total} total</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Secao>

      {errosDelesLista.length > 0 && (
        <Secao titulo="Onde o adversário mais errou" icon={<Shield size={16} />} dica="Só aparece o que foi marcado como erro do adversário durante o scout.">
          <div className="grid gap-2">
            {errosDelesLista.map((f) => (
              <BarraHorizontal key={f} label={LABEL_FUNDAMENTO[f]} valor={errosDeles[f].total} max={maxErrosDeles} cor="var(--rd-gold)" direita={errosDeles[f].total} />
            ))}
          </div>
        </Secao>
      )}
    </div>
  )
}

type Ordem = 'pontos' | 'saldo' | 'geral' | FundamentoScout
const ORDENS: { id: Ordem; label: string }[] = [
  { id: 'pontos', label: 'Pontos' },
  { id: 'saldo', label: 'Saldo' },
  { id: 'geral', label: 'Eficiência geral' },
  { id: 'ataque', label: 'Ataque' },
  { id: 'saque', label: 'Saque' },
  { id: 'recepcao', label: 'Recepção' },
  { id: 'defesa', label: 'Defesa' },
  { id: 'bloqueio', label: 'Bloqueio' },
  { id: 'levantamento', label: 'Levantamento' },
]

function valorOrdem(l: LinhaAtletaCompleta, o: Ordem): number {
  if (o === 'pontos') return l.pontos
  if (o === 'saldo') return l.saldo
  if (o === 'geral') return l.totalGeral.total > 0 ? l.totalGeral.eficiencia : -999
  return l.porFundamento[o].total > 0 ? l.porFundamento[o].eficiencia : -999
}

function AbaAtletas({ partidas, nomeDe }: { partidas: Partida[]; nomeDe: (id: string) => Atleta | undefined }) {
  const [ordem, setOrdem] = useState<Ordem>('pontos')
  const [aberta, setAberta] = useState<string | null>(null)
  const linhas = estatisticasPorAtleta(partidas)
  const ordenadas = [...linhas].sort((a, b) => valorOrdem(b, ordem) - valorOrdem(a, ordem))

  if (linhas.length === 0) return <Card><p className="text-xs text-[var(--rd-text-dim)]">Nenhum lance de atleta registrado.</p></Card>

  return (
    <div className="grid gap-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Ordenar atletas por">
        {ORDENS.map((o) => (
          <button key={o.id} onClick={() => setOrdem(o.id)} aria-pressed={ordem === o.id}
            className="shrink-0 rounded-full px-3 text-xs font-semibold border"
            style={{ minHeight: 34, borderColor: ordem === o.id ? 'var(--rd-gold)' : 'var(--rd-border)', background: ordem === o.id ? 'var(--rd-gold)' : 'transparent', color: ordem === o.id ? '#1a1300' : undefined }}>
            {o.label}
          </button>
        ))}
      </div>

      {ordenadas.map((l, i) => {
        const a = nomeDe(l.atletaId)
        const aberto = aberta === l.atletaId
        const fundComDados = FUNDAMENTOS_SCOUT.filter((f) => l.porFundamento[f].total > 0)
        const destaque = ordem === 'pontos' ? `${l.pontos} pts` : ordem === 'saldo' ? `${l.saldo > 0 ? '+' : ''}${l.saldo}` : ordem === 'geral' ? `${l.totalGeral.eficiencia}%` : l.porFundamento[ordem].total > 0 ? `${l.porFundamento[ordem].eficiencia}%` : '—'
        const corDestaque = ordem === 'pontos' ? undefined : ordem === 'saldo' ? (l.saldo >= 0 ? 'var(--rd-positivo)' : 'var(--rd-erro)') : corEf(ordem === 'geral' ? l.totalGeral.eficiencia : l.porFundamento[ordem].eficiencia)
        return (
          <Card key={l.atletaId} className="!p-0 overflow-hidden">
            <button onClick={() => setAberta(aberto ? null : l.atletaId)} aria-expanded={aberto}
              className="w-full flex items-center gap-3 px-3 py-3 text-left">
              <span className="w-6 text-center text-xs font-black text-[var(--rd-text-dim)] tabular-nums">{i + 1}</span>
              <span className="w-8 h-8 rounded-full grid place-items-center text-xs font-black shrink-0" style={{ background: 'var(--rd-gold)', color: '#1a1300' }}>
                {a?.numero ?? '–'}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-sm truncate">{a?.nome ?? 'Atleta removida'}</span>
                <span className="block text-[11px] text-[var(--rd-text-dim)]">{l.jogos} jogo(s) · {l.pontos} pts · {l.errosQueDeramPonto} erros · {l.totalGeral.total} ações</span>
              </span>
              <span className="text-base font-black tabular-nums" style={corDestaque ? { color: corDestaque } : undefined}>{destaque}</span>
              {aberto ? <ChevronUp size={16} className="text-[var(--rd-text-dim)]" /> : <ChevronDown size={16} className="text-[var(--rd-text-dim)]" />}
            </button>
            {aberto && (
              <div className="px-3 pb-3 border-t" style={{ borderColor: 'var(--rd-border)' }}>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <Kpi label="Aces" valor={l.aces} />
                  <Kpi label="Ataques ponto" valor={l.ataquesPonto} />
                  <Kpi label="Bloqueios" valor={l.bloqueiosPonto} />
                </div>
                <table className="w-full text-xs mt-3">
                  <thead>
                    <tr className="text-[var(--rd-text-dim)]">
                      <th className="text-left font-semibold py-1">Fundamento</th>
                      <th className="text-center font-semibold" style={{ color: 'var(--rd-positivo)' }}>+</th>
                      <th className="text-center font-semibold" style={{ color: 'var(--rd-neutro)' }}>=</th>
                      <th className="text-center font-semibold" style={{ color: 'var(--rd-erro)' }}>−</th>
                      <th className="text-right font-semibold">Efic.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundComDados.map((f) => {
                      const x = l.porFundamento[f]
                      return (
                        <tr key={f} className="border-t" style={{ borderColor: 'var(--rd-border)' }}>
                          <td className="py-1.5 font-semibold">{LABEL_FUNDAMENTO[f]}</td>
                          <td className="text-center tabular-nums">{x.positivo}</td>
                          <td className="text-center tabular-nums">{x.neutro}</td>
                          <td className="text-center tabular-nums">{x.erro}</td>
                          <td className="text-right font-bold tabular-nums" style={{ color: corEf(x.eficiencia) }}>{x.eficiencia}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {a && (
                  <Link to={`/atletas/${a.id}`} className="rd-btn text-xs mt-3 w-full" style={{ minHeight: 40 }}>Abrir perfil da atleta</Link>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function AbaRankings({ partidas, nomeDe }: { partidas: Partida[]; nomeDe: (id: string) => Atleta | undefined }) {
  const rk = rankings(estatisticasPorAtleta(partidas))
  if (rk.length === 0) return <Card><p className="text-xs text-[var(--rd-text-dim)]">Ainda não há lances suficientes pra montar rankings.</p></Card>
  const medalha = ['var(--rd-gold)', '#a8a9ad', '#b87333']
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {rk.map((r) => (
        <Card key={r.titulo}>
          <div className="text-xs font-black mb-2">{r.titulo}</div>
          <div className="grid gap-1.5">
            {r.itens.map((it, i) => (
              <div key={it.atletaId} className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-black" style={{ background: medalha[i] ?? 'var(--rd-border)', color: '#1a1300' }}>{i + 1}</span>
                <span className="flex-1 truncate">{nomeDe(it.atletaId)?.nome ?? 'Atleta removida'}</span>
                <span className="text-[11px] text-[var(--rd-text-dim)] tabular-nums">{it.detalhe}</span>
                <span className="font-black tabular-nums w-14 text-right">{it.valor}{r.unidade === '%' ? '%' : r.unidade ? ` ${r.unidade}` : ''}</span>
              </div>
            ))}
          </div>
        </Card>
      ))}
      <p className="text-[11px] text-[var(--rd-text-dim)] sm:col-span-2">Rankings de eficiência só incluem quem teve pelo menos 5 tentativas no fundamento.</p>
    </div>
  )
}

function AbaJogos({ partidas }: { partidas: Partida[] }) {
  const linhas = evolucaoPorJogo(partidas)
  return (
    <div className="grid gap-4">
      {linhas.length > 1 && (
        <Secao titulo="Eficiência jogo a jogo" icon={<TrendingUp size={16} />}>
          <GraficoEvolucao pontos={linhas.map((l) => ({ partida: l.partida, eficiencia: l.eficiencia, detalhe: `${l.acoes} ações` }))} cor={corEf} />
        </Secao>
      )}
      <Secao titulo="Todos os jogos" icon={<ListOrdered size={16} />}>
        <div className="grid gap-2">
          {[...linhas].reverse().map((l) => (
            <Link key={l.partida.id} to={`/relatorio/${l.partida.id}`} className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--rd-border)', minHeight: 56 }}>
              <span className="w-7 h-7 rounded-lg grid place-items-center text-xs font-black text-white shrink-0" style={{ background: l.venceu ? 'var(--rd-positivo)' : 'var(--rd-erro)' }}>{l.venceu ? 'V' : 'D'}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold truncate">vs {l.partida.adversarioNome ?? 'Adversário'}</span>
                <span className="block text-[11px] text-[var(--rd-text-dim)]">
                  {formatDate(l.partida.data)} · {l.partida.setsGanhosCasa}×{l.partida.setsGanhosAdversario} sets · {l.pontosFeitos}×{l.pontosSofridos} pts
                </span>
                <span className="block text-[11px] text-[var(--rd-text-dim)]">
                  Side-out <b style={{ color: corPct(l.sideOutPct) }}>{l.sideOutPct}%</b> · Break <b style={{ color: corPct(l.breakPct) }}>{l.breakPct}%</b>
                </span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-base font-black tabular-nums" style={{ color: corEf(l.eficiencia) }}>{l.eficiencia}%</span>
                <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--rd-text-dim)]"><FileText size={10} /> relatório</span>
              </span>
            </Link>
          ))}
        </div>
      </Secao>
    </div>
  )
}

function AbaQuadra({ sets, nomeDe }: { sets: SetPartida[]; nomeDe: (id: string) => Atleta | undefined }) {
  const porPos = analisePorPosicaoPartida(sets)
  const temPos = [0, 1, 2, 3, 4, 5].some((i) => porPos[i].pontos + porPos[i].erros > 0)
  const porAtleta = analisePorAtletaEPosicao(sets)
  const linhas = Object.entries(porAtleta)
    .filter(([, p]) => [0, 1, 2, 3, 4, 5].some((i) => p[i].total > 0))
    .sort((a, b) => (nomeDe(a[0])?.nome ?? '').localeCompare(nomeDe(b[0])?.nome ?? ''))
  // Desenho da quadra na ordem em que as posições ficam vistas do nosso lado:
  // rede em cima (IV, III, II) e fundo embaixo (V, VI, I).
  const desenho = [[3, 2, 1], [4, 5, 0]]

  if (!temPos && linhas.length === 0) {
    return <Card><p className="text-xs text-[var(--rd-text-dim)]">Precisa da escalação (papeleta) preenchida nos sets pra calcular por posição.</p></Card>
  }
  return (
    <div className="grid gap-4">
      {temPos && (
        <Secao titulo="Pontos e erros por posição" icon={<MapPin size={16} />} dica="Lances que fecharam o rally, na posição em que a atleta estava. Verde = pontos, vermelho = erros.">
          <div className="rounded-xl overflow-hidden border-2" style={{ borderColor: 'var(--rd-gold)' }}>
            <div className="text-center text-[10px] font-black tracking-widest py-1" style={{ background: 'var(--rd-gold)', color: '#1a1300' }}>REDE</div>
            {desenho.map((linha, li) => (
              <div key={li} className="grid grid-cols-3">
                {linha.map((idx) => {
                  const x = porPos[idx]
                  const saldo = x.pontos - x.erros
                  return (
                    <div key={idx} className="border text-center py-3" style={{ borderColor: 'var(--rd-border)' }}>
                      <div className="text-[11px] font-black text-[var(--rd-text-dim)]">{ROMANO_POS[idx]}</div>
                      <div className="text-sm font-bold tabular-nums">
                        <span style={{ color: 'var(--rd-positivo)' }}>{x.pontos}</span>
                        <span className="text-[var(--rd-text-dim)]"> / </span>
                        <span style={{ color: 'var(--rd-erro)' }}>{x.erros}</span>
                      </div>
                      <div className="text-[10px] font-bold tabular-nums" style={{ color: saldo >= 0 ? 'var(--rd-positivo)' : 'var(--rd-erro)' }}>{saldo > 0 ? '+' : ''}{saldo}</div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </Secao>
      )}
      {linhas.length > 0 && (
        <Secao titulo="Eficiência de cada atleta por posição" icon={<Users size={16} />}>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-1 pr-2 text-[var(--rd-text-dim)] font-semibold">Atleta</th>
                  {ROMANO_POS.map((r) => <th key={r} className="text-center py-1 px-1 text-[var(--rd-text-dim)] font-semibold">{r}</th>)}
                </tr>
              </thead>
              <tbody>
                {linhas.map(([id, pos]) => (
                  <tr key={id} className="border-t" style={{ borderColor: 'var(--rd-border)' }}>
                    <td className="py-1.5 pr-2 font-semibold truncate max-w-[120px]">{nomeDe(id)?.nome ?? 'Atleta removida'}</td>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <td key={i} className="text-center py-1.5 px-1 tabular-nums">
                        {pos[i].total === 0 ? <span className="text-[var(--rd-text-dim)]">—</span> : <span style={{ color: corEf(pos[i].eficiencia) }}>{pos[i].eficiencia}%</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}
    </div>
  )
}

// --------------------------------------------------------------- tela

export default function Estatisticas() {
  const { escolas, turmas, partidas, atletas } = useStore()
  const escolasAtivas = escolas.filter((e) => !e.deletedAt)
  const turmasAtivas = turmas.filter((t) => !t.deletedAt && escolasAtivas.some((e) => e.id === t.escolaId))

  const [turmaId, setTurmaIdState] = useState<string>(() => {
    const salva = lerTurmaSalva()
    return turmasAtivas.some((t) => t.id === salva) ? salva : ''
  })
  const [periodo, setPeriodo] = useState<PeriodoEstatistica>('TEMPORADA')
  const [partidaId, setPartidaId] = useState('')
  const [adversario, setAdversario] = useState('')
  const [aba, setAba] = useState<Aba>('geral')

  const setTurmaId = (id: string) => {
    setTurmaIdState(id)
    salvarTurma(id)
    setPartidaId('')
    setAdversario('')
  }

  const jogosDaTurma = useMemo(() => jogosFinalizados(partidas, turmaId || undefined), [partidas, turmaId])
  const adversarios = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of jogosDaTurma) if (p.adversarioNome) m.set(normalizarNome(p.adversarioNome), p.adversarioNome.trim())
    return [...m.values()].sort((a, b) => a.localeCompare(b))
  }, [jogosDaTurma])

  const filtradas = useMemo(
    () => filtrarPartidas(partidas, { turmaId: turmaId || undefined, periodo, partidaId: partidaId || undefined, adversario: adversario || undefined }),
    [partidas, turmaId, periodo, partidaId, adversario],
  )
  const sets = useMemo(() => filtradas.flatMap((p) => p.setsPartida), [filtradas])
  const atletaPorId = useMemo(() => new Map(atletas.map((a) => [a.id, a])), [atletas])
  const nomeDe = (id: string) => atletaPorId.get(id)
  const nomeTurma = (id: string) => turmas.find((t) => t.id === id)?.nome ?? ''

  if (turmasAtivas.length === 0) {
    return (
      <div>
        <PageTitle icon={<BarChart3 size={22} />} title="Estatísticas" />
        <EmptyState icon={<BarChart3 size={40} />} text="Cadastre escolas e turmas pra ver estatísticas aqui." />
      </div>
    )
  }

  const descricaoFiltro = partidaId
    ? 'Jogo escolhido'
    : `${PERIODOS.find((p) => p.id === periodo)?.label}${adversario ? ` · vs ${adversario}` : ''}`

  return (
    <div>
      <PageTitle icon={<BarChart3 size={22} />} title="Estatísticas"
        subtitle={`${turmaId ? nomeTurma(turmaId) : 'Todas as turmas'} · ${descricaoFiltro} · ${filtradas.length} jogo(s)`} />

      <Card className="mb-4 grid gap-3">
        <label className="grid gap-1 text-xs font-semibold text-[var(--rd-text-dim)]">
          Turma
          <select className="rd-input" value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={{ minHeight: 44 }}>
            <option value="">Todas as turmas</option>
            {escolasAtivas.map((e) => {
              const ts = turmasAtivas.filter((t) => t.escolaId === e.id)
              if (ts.length === 0) return null
              return (
                <optgroup key={e.id} label={e.nome}>
                  {ts.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </optgroup>
              )
            })}
          </select>
        </label>

        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl" style={{ background: 'var(--rd-bg)' }} role="group" aria-label="Período">
          {PERIODOS.map((p) => {
            const ativo = !partidaId && periodo === p.id
            return (
              <button key={p.id} onClick={() => { setPeriodo(p.id); setPartidaId('') }} aria-pressed={ativo}
                className="rounded-lg text-xs font-bold" style={{ minHeight: 38, background: ativo ? 'var(--rd-surface)' : 'transparent', boxShadow: ativo ? '0 1px 3px rgba(0,0,0,.15)' : undefined, color: ativo ? undefined : 'var(--rd-text-dim)' }}>
                {p.label}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs font-semibold text-[var(--rd-text-dim)]">
            Jogo
            <select className="rd-input" value={partidaId} onChange={(e) => setPartidaId(e.target.value)} style={{ minHeight: 44 }}>
              <option value="">Todos</option>
              {[...jogosDaTurma].reverse().map((p) => (
                <option key={p.id} value={p.id}>{formatDate(p.data)} · {p.adversarioNome ?? 'Adversário'}{turmaId ? '' : ` (${nomeTurma(p.turmaId)})`}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[var(--rd-text-dim)]">
            Adversário
            <select className="rd-input" value={adversario} onChange={(e) => { setAdversario(e.target.value); setPartidaId('') }} style={{ minHeight: 44 }} disabled={!!partidaId}>
              <option value="">Todos</option>
              {adversarios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        </div>
      </Card>

      <div className="sticky top-[52px] md:top-0 z-30 -mx-4 px-4 py-2 mb-3" style={{ background: 'var(--rd-bg)' }}>
        <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Seções das estatísticas">
          {ABAS.map(({ id, label, Icon }) => {
            const ativo = aba === id
            return (
              <button key={id} role="tab" aria-selected={ativo} onClick={() => setAba(id)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 text-xs font-bold border"
                style={{ minHeight: 38, borderColor: ativo ? 'var(--rd-gold)' : 'var(--rd-border)', background: ativo ? 'var(--rd-gold)' : 'var(--rd-surface)', color: ativo ? '#1a1300' : undefined }}>
                <Icon size={14} strokeWidth={2.4} /> {label}
              </button>
            )
          })}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState icon={<BarChart3 size={40} />} text="Nenhum jogo finalizado com esses filtros. Termine um scout de jogo pelo Calendário pra ver os números aqui." />
      ) : (
        <>
          {aba === 'geral' && <AbaGeral partidas={filtradas} />}
          {aba === 'fundamentos' && <AbaFundamentos sets={sets} />}
          {aba === 'atletas' && <AbaAtletas partidas={filtradas} nomeDe={nomeDe} />}
          {aba === 'rankings' && <AbaRankings partidas={filtradas} nomeDe={nomeDe} />}
          {aba === 'jogos' && <AbaJogos partidas={filtradas} />}
          {aba === 'quadra' && <AbaQuadra sets={sets} nomeDe={nomeDe} />}
        </>
      )}
    </div>
  )
}
