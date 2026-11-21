import { useMemo } from 'react'
import { Calendar, Trophy, PlayCircle, Star } from 'lucide-react'
import { useStore } from '../store'
import { Card, EmptyState, Button } from '../components/ui'
import { LogoExibicao } from '../components/LogoUpload'
import { SugestaoFocoCard } from '../components/SugestaoFocoCard'
import ProximoJogoCard from '../components/ProximoJogoCard'
import AvatarAtleta from '../components/AvatarAtleta'
import { parseDataLocal, aproveitamento, formatDate, encontrarLogoAdversario } from '../utils'
import { normalizarPosicao } from '../types'
import { agregarScoutAtleta, calcularRating } from '../rating'
import { Link } from 'react-router-dom'

// Visual "Álbum" (21/11/2026): cartões arredondados, etiquetas em pílula e as
// atletas em destaque logo no Início. Tudo dentro de `.rd-album` (index.css).
export default function Dashboard() {
  const { escolas, turmas, atletas, adversarios, partidas, jogosAgendados, sessoesTreino } = useStore()
  const turmasAtivas = turmas.filter((t) => !t.deletedAt)

  const partidasEmAndamento = partidas
    .filter((p) => p.status === 'EM_ANDAMENTO' && !p.deletedAt)
    .sort((a, b) => b.data.localeCompare(a.data))

  const hoje = new Date(new Date().toDateString())
  const proximosJogos = jogosAgendados
    .filter((j) => !j.deletedAt && parseDataLocal(j.data) >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 5)

  const ultimosResultados = partidas
    .filter((p) => p.tipo === 'JOGO' && p.status === 'FINALIZADA' && !p.deletedAt)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 5)

  // Destaques: as 3 maiores notas de rating entre as atletas que já têm
  // ações registradas em partidas finalizadas.
  const destaques = useMemo(() => {
    return atletas
      .filter((a) => !a.deletedAt)
      .map((a) => {
        const r = calcularRating(agregarScoutAtleta(a.id, partidas), normalizarPosicao(a.posicaoPrincipal), normalizarPosicao(a.posicaoSecundaria))
        return { atleta: a, rating: r.rating, acoes: r.totalAcoes }
      })
      .filter((d) => d.acoes > 0)
      .sort((a, b) => b.rating - a.rating || b.acoes - a.acoes)
      .slice(0, 3)
  }, [atletas, partidas])

  const kpis = [
    { label: 'Escolas', valor: escolas.filter((e) => !e.deletedAt).length },
    { label: 'Turmas', valor: turmasAtivas.length },
    { label: 'Atletas', valor: atletas.filter((a) => !a.deletedAt).length },
    { label: 'Jogos', valor: partidas.filter((p) => p.tipo === 'JOGO' && !p.deletedAt).length },
    { label: 'Aproveitamento', valor: `${aproveitamento(partidas)}%` },
  ]

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="rd-album">
      <div className="mb-5">
        <h1 className="text-2xl font-black tracking-tight">{saudacao}, professor</h1>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {kpis.map((k) => (
            <span key={k.label} className={`rd-chip ${k.label === 'Aproveitamento' ? 'rd-chip-gold' : ''}`}>
              <strong className="font-black">{k.valor}</strong> {k.label.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      {partidasEmAndamento.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {partidasEmAndamento.map((p) => (
            <Card key={p.id} className="flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: 'var(--rd-gold)', background: 'rgba(212,175,55,.08)' }}>
              <div className="flex items-center gap-3">
                {p.tipo === 'JOGO' ? (
                  <LogoExibicao logoUrl={encontrarLogoAdversario(adversarios, p.adversarioNome)} nome={p.adversarioNome ?? 'Adversário'} />
                ) : (
                  <PlayCircle size={22} className="rd-accent-text shrink-0" />
                )}
                <div>
                  <div className="font-semibold">
                    Partida em andamento — {turmas.find((t) => t.id === p.turmaId)?.nome ?? 'Turma'}
                    {p.tipo === 'JOGO' ? ` vs ${p.adversarioNome ?? 'Adversário'}` : ' • Treino'}
                  </div>
                  <div className="text-xs text-[var(--rd-text-dim)]">{p.setsGanhosCasa} × {p.setsGanhosAdversario} sets — {formatDate(p.data)}</div>
                </div>
              </div>
              <Link to={`/scout/${p.id}`}><Button variant="gold">Continuar partida</Button></Link>
            </Card>
          ))}
        </div>
      )}

      <ProximoJogoCard />

      {destaques.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold flex items-center gap-2 mb-2"><Star size={18} className="rd-accent-text" /> Destaques</h2>
          <div className="grid grid-cols-3 gap-2 max-w-md">
            {destaques.map((d, i) => (
              <Link key={d.atleta.id} to={`/atletas/${d.atleta.id}`}>
                <Card className="text-center !px-2 !py-3 hover:brightness-95" style={i === 0 ? { borderColor: 'var(--rd-gold)' } : undefined}>
                  <AvatarAtleta nome={d.atleta.nome} fotoUrl={d.atleta.fotoUrl} tamanho={48} ouro={i === 0} />
                  <div className="text-sm font-semibold mt-1.5 truncate">{d.atleta.nome.split(' ')[0]}</div>
                  <div className={`text-lg font-black leading-tight ${i === 0 ? 'rd-accent-text' : ''}`}>{d.rating.toFixed(1).replace('.', ',')}</div>
                </Card>
              </Link>
            ))}
          </div>
          <p className="text-[11px] text-[var(--rd-text-dim)] mt-1.5">Maiores notas de rating, contando as partidas finalizadas.</p>
        </div>
      )}

      {turmasAtivas.length > 0 && (
        <div className="mb-6">
          {turmasAtivas.map((t) => (
            <SugestaoFocoCard key={t.id} turma={t} sessoesDaTurma={sessoesTreino.filter((s) => s.turmaId === t.id)} />
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h2 className="font-bold flex items-center gap-2 mb-2"><Calendar size={18} className="rd-accent-text" /> Próximos jogos</h2>
          {proximosJogos.length === 0 ? (
            <EmptyState icon={<Calendar size={40} />} text="Nenhum jogo agendado ainda." />
          ) : (
            <div className="flex flex-col gap-2">
              {proximosJogos.map((j) => (
                <Card key={j.id} className="flex items-center gap-3">
                  <LogoExibicao logoUrl={encontrarLogoAdversario(adversarios, j.adversarioNome)} nome={j.adversarioNome} tamanho={36} />
                  <div className="min-w-0">
                    <div className="font-semibold">vs {j.adversarioNome}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="rd-chip">{formatDate(j.data)}{j.horario ? ` · ${j.horario.slice(0, 5)}` : ''}</span>
                      {j.local && <span className="rd-chip">{j.local}</span>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="font-bold flex items-center gap-2 mb-2"><Trophy size={18} className="rd-accent-text" /> Últimos resultados</h2>
          {ultimosResultados.length === 0 ? (
            <EmptyState icon={<Trophy size={40} />} text="Nenhum jogo finalizado ainda." />
          ) : (
            <div className="flex flex-col gap-2">
              {ultimosResultados.map((p) => {
                const venceu = p.setsGanhosCasa > p.setsGanhosAdversario
                return (
                  <Link key={p.id} to={`/relatorio/${p.id}`}>
                    <Card className="hover:brightness-95 flex items-center gap-3">
                      <LogoExibicao logoUrl={encontrarLogoAdversario(adversarios, p.adversarioNome)} nome={p.adversarioNome ?? 'Adversário'} tamanho={36} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">vs {p.adversarioNome ?? 'Adversário'}</div>
                        <div className="text-xs text-[var(--rd-text-dim)]">{formatDate(p.data)}</div>
                      </div>
                      <span className="rd-chip" style={{ color: venceu ? 'var(--rd-positivo)' : 'var(--rd-erro)' }}>
                        {venceu ? 'Vitória' : 'Derrota'} {p.setsGanhosCasa}×{p.setsGanhosAdversario}
                      </span>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
