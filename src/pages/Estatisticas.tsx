import { BarChart3, School, Users, MapPin, Repeat, Crosshair } from 'lucide-react'
import { useStore } from '../store'
import { PageTitle, Card, EmptyState } from '../components/ui'
import {
  scoutEquipe, FUNDAMENTOS_SCOUT, LABEL_FUNDAMENTO, analisePorAtletaEPosicao, scoutPorAtleta, sideOutBreakPoint,
  desempenhoEmPontosDecisivos, combinarLinhas,
} from '../scoutEngine'
import { aproveitamento } from '../utils'
import type { SetPartida, Atleta, Partida } from '../types'

const ROMANO_POS = ['I', 'II', 'III', 'IV', 'V', 'VI']

function corEficiencia(ef: number): string {
  if (ef >= 50) return 'text-[var(--rd-positivo)]'
  if (ef >= 0) return 'text-[var(--rd-neutro)]'
  return 'text-[var(--rd-erro)]'
}

function corPercentual(pct: number): string {
  if (pct >= 55) return 'text-[var(--rd-positivo)]'
  if (pct >= 40) return 'text-[var(--rd-neutro)]'
  return 'text-[var(--rd-erro)]'
}

/** Side-out × break point da TEMPORADA inteira da turma (pedido 30/10/2026)
 *  — mesma métrica do Relatório por partida, só que somando todos os jogos
 *  finalizados, pra ver a tendência da temporada e não só de um jogo. */
function BlocoSideOutBreakPoint({ sets }: { sets: SetPartida[] }) {
  const r = sideOutBreakPoint(sets)
  if (r.sideOutOportunidades === 0 && r.breakOportunidades === 0) return null
  return (
    <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2" style={{ borderColor: 'var(--rd-border)' }}>
      <div className="rounded-lg border text-center py-2.5 px-2" style={{ borderColor: 'var(--rd-border)' }}>
        <div className="text-[9px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide flex items-center justify-center gap-1"><Repeat size={10} /> Side-out</div>
        <div className={`text-lg font-black mt-0.5 ${corPercentual(r.sideOutPct)}`}>{r.sideOutPct}%</div>
        <div className="text-[10px] text-[var(--rd-text-dim)]">{r.sideOutPontos}/{r.sideOutOportunidades}</div>
      </div>
      <div className="rounded-lg border text-center py-2.5 px-2" style={{ borderColor: 'var(--rd-border)' }}>
        <div className="text-[9px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide">Break point</div>
        <div className={`text-lg font-black mt-0.5 ${corPercentual(r.breakPct)}`}>{r.breakPct}%</div>
        <div className="text-[10px] text-[var(--rd-text-dim)]">{r.breakPontos}/{r.breakOportunidades}</div>
      </div>
    </div>
  )
}

/** Comparação entre atletas na temporada (pedido 30/10/2026) — quem está
 *  rendendo mais ao longo de todos os jogos da turma, não só de uma partida. */
function BlocoCompararAtletas({ sets, atletasDaTurma }: { sets: SetPartida[]; atletasDaTurma: Atleta[] }) {
  const comDados = scoutPorAtleta(sets).filter((p) => p.totalGeral.total > 0)
  if (comDados.length < 2) return null
  const nomeDe = (id: string) => atletasDaTurma.find((a) => a.id === id)?.nome ?? 'Atleta removida'
  const ordenado = [...comDados].sort((a, b) => b.totalGeral.eficiencia - a.totalGeral.eficiencia)
  return (
    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--rd-border)' }}>
      <div className="text-xs font-bold mb-2 flex items-center gap-1.5 text-[var(--rd-text-dim)]">
        <Users size={13} /> Comparar atletas na temporada
      </div>
      <div className="grid gap-2">
        {ordenado.map(({ atletaId, totalGeral }) => {
          const larguraPct = Math.max(4, ((totalGeral.eficiencia + 100) / 200) * 100)
          return (
            <div key={atletaId}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="font-semibold truncate">{nomeDe(atletaId)}</span>
                <span className={`font-bold ${corEficiencia(totalGeral.eficiencia)}`}>{totalGeral.eficiencia}% · {totalGeral.total} ações</span>
              </div>
              <div className="h-1.5 rounded-full bg-black/20 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${larguraPct}%`, background: totalGeral.eficiencia >= 50 ? 'var(--rd-positivo)' : totalGeral.eficiencia >= 0 ? 'var(--rd-neutro)' : 'var(--rd-erro)' }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Pontos decisivos (reta final do set) somados na TEMPORADA inteira — cada
 *  partida tem seu próprio alvo de pontos (`desempenhoEmPontosDecisivos`
 *  calcula por partida porque o formato/pontuação pode variar de jogo pra
 *  jogo), depois soma tudo com `combinarLinhas`. */
function BlocoPontosDecisivos({ partidasDaTurma }: { partidasDaTurma: Partida[] }) {
  const porPartida = partidasDaTurma.map((p) => desempenhoEmPontosDecisivos(p.setsPartida, p))
  const decisivo = combinarLinhas(porPartida.map((r) => r.decisivo))
  const normal = combinarLinhas(porPartida.map((r) => r.normal))
  if (decisivo.total === 0 && normal.total === 0) return null
  return (
    <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2" style={{ borderColor: 'var(--rd-border)' }}>
      <div className="rounded-lg border text-center py-2.5 px-2" style={{ borderColor: 'var(--rd-border)' }}>
        <div className="text-[9px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide flex items-center justify-center gap-1"><Crosshair size={10} /> Reta final</div>
        <div className={`text-lg font-black mt-0.5 ${decisivo.total === 0 ? 'text-[var(--rd-text-dim)]' : corEficiencia(decisivo.eficiencia)}`}>
          {decisivo.total > 0 ? `${decisivo.eficiencia}%` : '—'}
        </div>
        <div className="text-[10px] text-[var(--rd-text-dim)]">{decisivo.total} ação(ões)</div>
      </div>
      <div className="rounded-lg border text-center py-2.5 px-2" style={{ borderColor: 'var(--rd-border)' }}>
        <div className="text-[9px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide">Resto do set</div>
        <div className={`text-lg font-black mt-0.5 ${normal.total === 0 ? 'text-[var(--rd-text-dim)]' : corEficiencia(normal.eficiencia)}`}>
          {normal.total > 0 ? `${normal.eficiencia}%` : '—'}
        </div>
        <div className="text-[10px] text-[var(--rd-text-dim)]">{normal.total} ação(ões)</div>
      </div>
    </div>
  )
}

function TabelaPosicaoPorAtleta({ sets, atletasDaTurma }: { sets: SetPartida[]; atletasDaTurma: Atleta[] }) {
  const porAtleta = analisePorAtletaEPosicao(sets)
  const nomeDe = Object.fromEntries(atletasDaTurma.map((a) => [a.id, a.nome]))
  const linhas = Object.entries(porAtleta)
    .filter(([, posicoes]) => [0, 1, 2, 3, 4, 5].some((i) => posicoes[i].total > 0))
    .sort((a, b) => (nomeDe[a[0]] ?? '').localeCompare(nomeDe[b[0]] ?? ''))
  if (linhas.length === 0) return null
  return (
    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--rd-border)' }}>
      <div className="text-xs font-bold mb-2 flex items-center gap-1.5 text-[var(--rd-text-dim)]">
        <MapPin size={13} /> Desempenho por posição, atleta por atleta
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr>
              <th className="text-left py-1 pr-2 text-[var(--rd-text-dim)] font-semibold">Atleta</th>
              {ROMANO_POS.map((r) => (
                <th key={r} className="text-center py-1 px-1 text-[var(--rd-text-dim)] font-semibold">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map(([atletaId, posicoes]) => (
              <tr key={atletaId} className="border-t" style={{ borderColor: 'var(--rd-border)' }}>
                <td className="py-1.5 pr-2 font-semibold truncate max-w-[120px]">{nomeDe[atletaId] ?? 'Atleta removida'}</td>
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const l = posicoes[i]
                  const semDados = l.total === 0
                  return (
                    <td key={i} className="text-center py-1.5 px-1">
                      {semDados ? (
                        <span className="text-[var(--rd-text-dim)]">—</span>
                      ) : (
                        <span className={corEficiencia(l.eficiencia)}>{l.eficiencia}%</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Estatisticas() {
  const { escolas, turmas, partidas, atletas } = useStore()

  const escolasAtivas = escolas.filter((e) => !e.deletedAt)
  const turmasAtivas = turmas.filter((t) => !t.deletedAt)

  const temAlgumaCoisa = escolasAtivas.some((e) => turmasAtivas.some((t) => t.escolaId === e.id))

  if (!temAlgumaCoisa) {
    return (
      <div>
        <PageTitle icon={<BarChart3 size={22} />} title="Estatísticas" />
        <EmptyState icon={<BarChart3 size={40} />} text="Cadastre escolas e turmas pra ver estatísticas aqui." />
      </div>
    )
  }

  return (
    <div>
      <PageTitle icon={<BarChart3 size={22} />} title="Estatísticas" subtitle={`${escolasAtivas.length} escola(s) • ${turmasAtivas.length} turma(s)/categoria(s)`} />

      <div className="grid gap-6">
        {escolasAtivas.map((escola) => {
          const turmasDaEscola = turmasAtivas.filter((t) => t.escolaId === escola.id)
          if (turmasDaEscola.length === 0) return null
          return (
            <div key={escola.id}>
              <h2 className="text-base font-black mb-3 pb-2 border-b-2 border-[var(--rd-gold)] flex items-center gap-2">
                <School size={18} className="rd-accent-text" /> {escola.nome}
              </h2>

              <div className="grid gap-4">
                {turmasDaEscola.map((turma) => {
                  const atletasDaTurma = atletas.filter((a) => a.turmaId === turma.id && !a.deletedAt)
                  const partidasDaTurma = partidas.filter((p) => p.turmaId === turma.id && p.tipo === 'JOGO' && p.status === 'FINALIZADA' && !p.deletedAt)
                  const todosSets: SetPartida[] = partidasDaTurma.flatMap((p) => p.setsPartida)
                  const equipe = scoutEquipe(todosSets)
                  const fundamentosComDados = FUNDAMENTOS_SCOUT.filter((f) => equipe[f].total > 0)
                  const aprov = aproveitamento(partidasDaTurma)

                  return (
                    <Card key={turma.id}>
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <span className="font-bold text-sm flex items-center gap-2">
                          <Users size={15} className="text-[var(--rd-text-dim)]" /> {turma.nome}
                        </span>
                        <span className="text-xs text-[var(--rd-text-dim)]">
                          {atletasDaTurma.length} atleta(s) • {partidasDaTurma.length} jogo(s) finalizado(s)
                          {partidasDaTurma.length > 0 && (
                            <> • <span className={corEficiencia(aprov - 50)}>{aprov}% aproveitamento</span></>
                          )}
                        </span>
                      </div>

                      {fundamentosComDados.length === 0 ? (
                        <p className="text-xs text-[var(--rd-text-dim)]">Nenhum jogo finalizado com scout registrado ainda.</p>
                      ) : (
                        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                          {fundamentosComDados.map((f) => {
                            const linha = equipe[f]
                            const max = Math.max(linha.positivo, linha.neutro, linha.erro, 1)
                            const barras = [
                              { label: 'Positivo', valor: linha.positivo, cor: 'var(--rd-positivo)' },
                              { label: 'Neutro', valor: linha.neutro, cor: 'var(--rd-neutro)' },
                              { label: 'Erro', valor: linha.erro, cor: 'var(--rd-erro)' },
                            ]
                            return (
                              <div key={f}>
                                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                                  <span>{LABEL_FUNDAMENTO[f]}</span>
                                  <span className={corEficiencia(linha.eficiencia)}>{linha.eficiencia}%</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  {barras.map((b) => (
                                    <div key={b.label} className="grid grid-cols-[52px_1fr_24px] items-center gap-2 text-[11px]">
                                      <span className="text-[var(--rd-text-dim)]">{b.label}</span>
                                      <div className="h-1.5 rounded-full bg-black/20 dark:bg-white/10 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${(b.valor / max) * 100}%`, background: b.cor }} />
                                      </div>
                                      <span className="text-right font-semibold">{b.valor}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <BlocoSideOutBreakPoint sets={todosSets} />

                      <BlocoPontosDecisivos partidasDaTurma={partidasDaTurma} />

                      <BlocoCompararAtletas sets={todosSets} atletasDaTurma={atletasDaTurma} />

                      <TabelaPosicaoPorAtleta sets={todosSets} atletasDaTurma={atletasDaTurma} />
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
