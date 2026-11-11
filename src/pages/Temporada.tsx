import { CalendarRange, School, Users, Trophy, AlertTriangle, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { PageTitle, Card, EmptyState } from '../components/ui'
import { scoutEquipe, erroPorFundamentoAdversario, eficienciaGeralEquipe, FUNDAMENTOS_SCOUT, LABEL_FUNDAMENTO } from '../scoutEngine'
import type { Partida, SetPartida, Turma } from '../types'
import GraficoEvolucao from '../components/GraficoEvolucao'

function piorFundamentoEquipe(equipe: ReturnType<typeof scoutEquipe>): { fundamento: string; eficiencia: number } | null {
  let pior: { f: keyof typeof equipe; eficiencia: number } | null = null
  for (const f of FUNDAMENTOS_SCOUT) {
    if (equipe[f].total === 0) continue
    if (!pior || equipe[f].eficiencia < pior.eficiencia) pior = { f, eficiencia: equipe[f].eficiencia }
  }
  return pior ? { fundamento: LABEL_FUNDAMENTO[pior.f], eficiencia: pior.eficiencia } : null
}

function corVD(v: number, d: number): string {
  if (v + d === 0) return 'text-[var(--rd-text-dim)]'
  return v >= d ? 'text-[var(--rd-positivo)]' : 'text-[var(--rd-erro)]'
}

function corEficiencia(ef: number): string {
  if (ef >= 50) return 'var(--rd-positivo)'
  if (ef >= 0) return 'var(--rd-neutro)'
  return 'var(--rd-erro)'
}

/** Evolução do desempenho da equipe ao longo da temporada (pedido 30/10/2026
 *  — "Nível 2"): eficiência geral (todos os fundamentos, recalculada dos
 *  eventos de cada partida — ver `eficienciaGeralEquipe`) jogo a jogo, em
 *  ordem cronológica (mais antigo primeiro), pra dar pra ver se a equipe tá
 *  melhorando ou piorando. Um gráfico de barras simples, sem lib externa —
 *  só aparece com 2+ jogos (com 1 jogo só não há "evolução" pra mostrar). */
function EvolucaoTemporada({ jogos }: { jogos: Partida[] }) {
  const comDados = jogos
    .filter((p) => p.setsPartida.some((s) => s.rallies.length > 0))
    .sort((a, b) => a.data.localeCompare(b.data))
  if (comDados.length < 2) return null
  const pontos = comDados.map((p) => ({ partida: p, geral: eficienciaGeralEquipe(p.setsPartida) }))
  return (
    <Card className="mb-3">
      <div className="text-xs font-bold mb-3 flex items-center gap-1.5 text-[var(--rd-text-dim)] uppercase tracking-wide">
        <TrendingUp size={13} /> Evolução da eficiência geral (do jogo mais antigo pro mais recente)
      </div>
      <GraficoEvolucao cor={corEficiencia} pontos={pontos.map(({ partida, geral }) => ({ partida, eficiencia: geral.eficiencia }))} />
      <p className="text-[11px] text-[var(--rd-text-dim)] mt-2">
        Eficiência geral = todas as ações nossas da partida, recalculadas (positivo − erro) ÷ total — não é a soma nem a média de jogos diferentes.
      </p>
    </Card>
  )
}

/** Um bloco por TURMA/categoria (pedido 30/10/2026: "7º ano A", "8º ano" e
 *  "7º ano B" são categorias diferentes dentro da mesma escola — as contas e
 *  comparações da temporada não podem misturar os jogos delas). Cada turma
 *  tem seu próprio V×D, evolução de eficiência, maiores erros e lista de
 *  jogos — exatamente o que antes era calculado por ESCOLA (errado: somava
 *  turmas diferentes como se fossem uma equipe só). */
function BlocoTurma({ turma, jogosDaTurma }: { turma: Turma; jogosDaTurma: Partida[] }) {
  const v = jogosDaTurma.filter((p) => p.setsGanhosCasa > p.setsGanhosAdversario).length
  const d = jogosDaTurma.length - v
  const todosSets: SetPartida[] = jogosDaTurma.flatMap((p) => p.setsPartida)
  const equipe = scoutEquipe(todosSets)
  const errosAdv = erroPorFundamentoAdversario(todosSets)
  const pior = piorFundamentoEquipe(equipe)
  const fundamentosComErro = FUNDAMENTOS_SCOUT.filter((f) => equipe[f].erro > 0).sort((a, b) => equipe[b].erro - equipe[a].erro)
  const piorAdversario = FUNDAMENTOS_SCOUT.filter((f) => errosAdv[f].total > 0).sort((a, b) => errosAdv[b].total - errosAdv[a].total)[0]
  const jogosOrdenados = [...jogosDaTurma].sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div className="mb-5">
      <h3 className="text-sm font-black mb-2 flex items-center gap-1.5 text-[var(--rd-text-dim)]">
        <Users size={14} className="rd-accent-text" /> {turma.nome}
      </h3>

      <Card className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <span className="flex items-center gap-2 text-sm font-bold">
          <Trophy size={16} className="rd-accent-text" />
          <span className={corVD(v, d)}>{v} V × {d} D</span>
          <span className="text-xs font-normal text-[var(--rd-text-dim)]">({jogosDaTurma.length} jogo(s))</span>
        </span>
        {pior && (
          <span className="flex items-center gap-1.5 text-xs text-[var(--rd-text-dim)]">
            <AlertTriangle size={13} className="text-[var(--rd-erro)]" />
            Maior dificuldade: <strong>{pior.fundamento}</strong> ({pior.eficiencia}% de eficiência)
          </span>
        )}
      </Card>

      <EvolucaoTemporada jogos={jogosDaTurma} />

      {(fundamentosComErro.length > 0 || piorAdversario) && (
        <Card className="mb-3">
          <div className="text-xs font-bold mb-2 text-[var(--rd-text-dim)] uppercase tracking-wide">Maiores erros da temporada</div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
            {fundamentosComErro.slice(0, 3).map((f) => (
              <div key={f} className="flex items-center justify-between text-xs py-1 border-t border-[var(--rd-border)] first:border-t-0">
                <span>Nosso <strong>{LABEL_FUNDAMENTO[f]}</strong></span>
                <span className="text-[var(--rd-erro)] font-bold">{equipe[f].erro} erro(s)</span>
              </div>
            ))}
          </div>
          {piorAdversario && (
            <p className="text-xs text-[var(--rd-text-dim)] mt-2 pt-2 border-t border-[var(--rd-border)]">
              🎯 O adversário mais errou em <strong>{LABEL_FUNDAMENTO[piorAdversario]}</strong> contra a gente ({errosAdv[piorAdversario].total}×) — aproveita esse ponto fraco.
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-2">
        {jogosOrdenados.map((p: Partida) => {
          const venceu = p.setsGanhosCasa > p.setsGanhosAdversario
          const teveScout = p.setsPartida.some((s) => s.rallies.length > 0)
          const geral = teveScout ? eficienciaGeralEquipe(p.setsPartida) : null
          return (
            <Link key={p.id} to={`/relatorio/${p.id}`}>
              <Card className="flex items-center justify-between gap-2 flex-wrap hover:opacity-80">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">vs {p.adversarioNome ?? 'Adversário'}</div>
                  <div className="text-xs text-[var(--rd-text-dim)]">{p.data}{p.local ? ` • ${p.local}` : ''}</div>
                </div>
                <span className="flex items-center gap-2 shrink-0">
                  {geral && (
                    <span className="text-[11px] font-bold" style={{ color: corEficiencia(geral.eficiencia) }}>{geral.eficiencia}% efic.</span>
                  )}
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{
                      background: venceu ? 'rgba(46,204,113,.15)' : 'rgba(231,76,60,.15)',
                      color: venceu ? 'var(--rd-positivo)' : 'var(--rd-erro)',
                    }}
                  >
                    {venceu ? 'Vitória' : 'Derrota'} {p.setsGanhosCasa}×{p.setsGanhosAdversario}
                  </span>
                </span>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function Temporada() {
  const { escolas, turmas, partidas } = useStore()

  const escolasAtivas = escolas.filter((e) => !e.deletedAt)
  const turmasAtivas = turmas.filter((t) => !t.deletedAt)
  const jogosFinalizados = partidas.filter((p) => p.tipo === 'JOGO' && p.status === 'FINALIZADA' && !p.deletedAt)

  if (jogosFinalizados.length === 0) {
    return (
      <div>
        <PageTitle icon={<CalendarRange size={22} />} title="Temporada" />
        <EmptyState icon={<CalendarRange size={40} />} text="Nenhum jogo finalizado ainda nesta temporada." />
      </div>
    )
  }

  const totalV = jogosFinalizados.filter((p) => p.setsGanhosCasa > p.setsGanhosAdversario).length
  const totalD = jogosFinalizados.length - totalV

  return (
    <div>
      <PageTitle icon={<CalendarRange size={22} />} title="Temporada" subtitle={`${jogosFinalizados.length} jogo(s) finalizado(s) no total`} />

      <Card className="mb-6 text-center">
        <div className="text-xs font-semibold text-[var(--rd-text-dim)] mb-1">Visão geral da temporada</div>
        <div className="text-4xl font-black">
          <span className="text-[var(--rd-positivo)]">{totalV}</span>
          <span className="text-[var(--rd-text-dim)] text-2xl"> V </span>
          <span className="text-[var(--rd-text-dim)] text-2xl">×</span>
          <span className="text-[var(--rd-erro)]"> {totalD}</span>
          <span className="text-[var(--rd-text-dim)] text-2xl"> D</span>
        </div>
        <div className="text-sm text-[var(--rd-text-dim)] mt-1">
          {jogosFinalizados.length > 0 ? Math.round((totalV / jogosFinalizados.length) * 100) : 0}% de aproveitamento
        </div>
      </Card>

      <div className="grid gap-8">
        {escolasAtivas.map((escola) => {
          const turmasDaEscola = turmasAtivas.filter((t) => t.escolaId === escola.id)
          // Cada turma (categoria) é contada separadamente — "7º ano A", "8º
          // ano" e "7º ano B" não são somadas numa conta só, mesmo sendo da
          // mesma escola (pedido 30/10/2026).
          const turmasComJogo = turmasDaEscola
            .map((turma) => ({ turma, jogosDaTurma: jogosFinalizados.filter((p) => p.turmaId === turma.id) }))
            .filter(({ jogosDaTurma }) => jogosDaTurma.length > 0)
          if (turmasComJogo.length === 0) return null

          return (
            <div key={escola.id}>
              <h2 className="text-base font-black mb-4 pb-2 border-b-2 border-[var(--rd-gold)] flex items-center gap-2">
                <School size={18} className="rd-accent-text" /> {escola.nome}
              </h2>
              {turmasComJogo.map(({ turma, jogosDaTurma }) => (
                <BlocoTurma key={turma.id} turma={turma} jogosDaTurma={jogosDaTurma} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
