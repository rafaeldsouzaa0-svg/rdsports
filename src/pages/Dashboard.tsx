import { Volleyball, Calendar, Trophy, PlayCircle } from 'lucide-react'
import { useStore } from '../store'
import { PageTitle, Card, EmptyState, Button } from '../components/ui'
import { LogoExibicao } from '../components/LogoUpload'
import { SugestaoFocoCard } from '../components/SugestaoFocoCard'
import ProximoJogoCard from '../components/ProximoJogoCard'
import { parseDataLocal, aproveitamento, formatDate, encontrarLogoAdversario } from '../utils'
import { Link } from 'react-router-dom'

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

  const kpis = [
    { label: 'Escolas', valor: escolas.filter((e) => !e.deletedAt).length },
    { label: 'Turmas', valor: turmas.filter((t) => !t.deletedAt).length },
    { label: 'Atletas', valor: atletas.filter((a) => !a.deletedAt).length },
    { label: 'Jogos', valor: partidas.filter((p) => p.tipo === 'JOGO' && !p.deletedAt).length },
    { label: 'Aproveitamento', valor: `${aproveitamento(partidas)}%` },
  ]

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div>
      <PageTitle icon={<Volleyball size={24} strokeWidth={2.25} />} title={`${saudacao}!`} subtitle="Visão geral do RDSports" />

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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {kpis.map((k) => (
          <Card key={k.label} className="text-center">
            <div className="text-2xl font-black rd-accent-text">{k.valor}</div>
            <div className="text-xs text-[var(--rd-text-dim)] mt-1">{k.label}</div>
          </Card>
        ))}
      </div>

      {turmasAtivas.length > 0 && (
        <div className="mb-6">
          {turmasAtivas.map((t) => (
            <SugestaoFocoCard key={t.id} turma={t} sessoesDaTurma={sessoesTreino.filter((s) => s.turmaId === t.id)} />
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h2 className="font-bold flex items-center gap-2 mb-2"><Calendar size={18} /> Próximos jogos</h2>
          {proximosJogos.length === 0 ? (
            <EmptyState icon={<Calendar size={40} />} text="Nenhum jogo agendado ainda." />
          ) : (
            <div className="flex flex-col gap-2">
              {proximosJogos.map((j) => (
                <Card key={j.id} className="flex items-center gap-3">
                  <LogoExibicao logoUrl={encontrarLogoAdversario(adversarios, j.adversarioNome)} nome={j.adversarioNome} />
                  <div>
                    <div className="font-semibold">vs {j.adversarioNome}</div>
                    <div className="text-sm text-[var(--rd-text-dim)]">{formatDate(j.data)} {j.horario ?? ''} {j.local ? `• ${j.local}` : ''}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="font-bold flex items-center gap-2 mb-2"><Trophy size={18} /> Últimos resultados</h2>
          {ultimosResultados.length === 0 ? (
            <EmptyState icon={<Trophy size={40} />} text="Nenhum jogo finalizado ainda." />
          ) : (
            <div className="flex flex-col gap-2">
              {ultimosResultados.map((p) => (
                <Link key={p.id} to={`/relatorio/${p.id}`}>
                  <Card className="hover:brightness-95 flex items-center gap-3">
                    <LogoExibicao logoUrl={encontrarLogoAdversario(adversarios, p.adversarioNome)} nome={p.adversarioNome ?? 'Adversário'} />
                    <div>
                      <div className="font-semibold">vs {p.adversarioNome ?? 'Adversário'}</div>
                      <div className="text-sm text-[var(--rd-text-dim)]">{p.setsGanhosCasa} × {p.setsGanhosAdversario} sets — {formatDate(p.data)}</div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
