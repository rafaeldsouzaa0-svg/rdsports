import { Trash2, RotateCcw } from 'lucide-react'
import { PageTitle, Card, Button, EmptyState, BotaoVoltar } from '../components/ui'
import { useStore } from '../store'
import { formatDate } from '../utils'

function formatDataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return iso
  }
}

export default function Lixeira() {
  const atletas = useStore((s) => s.atletas)
  const turmas = useStore((s) => s.turmas)
  const escolas = useStore((s) => s.escolas)
  const partidas = useStore((s) => s.partidas)
  const bibliotecaExercicios = useStore((s) => s.bibliotecaExercicios)
  const restoreAtleta = useStore((s) => s.restoreAtleta)
  const restoreTurma = useStore((s) => s.restoreTurma)
  const restaurarPartida = useStore((s) => s.restaurarPartida)
  const restaurarExercicioBiblioteca = useStore((s) => s.restaurarExercicioBiblioteca)

  const mapaTurma = Object.fromEntries(turmas.map((t) => [t.id, t]))
  const mapaEscola = Object.fromEntries(escolas.map((e) => [e.id, e]))

  const atletasApagadas = atletas
    .filter((a) => a.deletedAt)
    .sort((a, b) => (b.deletedAt! > a.deletedAt! ? 1 : -1))

  const partidasApagadas = partidas
    .filter((p) => p.deletedAt)
    .sort((a, b) => (b.deletedAt! > a.deletedAt! ? 1 : -1))

  const turmasApagadas = turmas
    .filter((t) => t.deletedAt)
    .sort((a, b) => (b.deletedAt! > a.deletedAt! ? 1 : -1))

  const exerciciosApagados = bibliotecaExercicios
    .filter((e) => e.deletedAt)
    .sort((a, b) => (b.deletedAt! > a.deletedAt! ? 1 : -1))

  const vazia = atletasApagadas.length === 0 && partidasApagadas.length === 0 && turmasApagadas.length === 0 && exerciciosApagados.length === 0

  return (
    <div>
      <BotaoVoltar to="/configuracoes" label="Configurações" />
      <PageTitle icon={<Trash2 size={22} />} title="Lixeira" subtitle="Itens apagados — pode restaurar quando quiser." />

      {vazia && <EmptyState icon={<Trash2 size={28} />} text="A lixeira está vazia." />}

      {atletasApagadas.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--rd-text-dim)] mb-2">
            Atletas apagadas
          </div>
          <div className="flex flex-col gap-2">
            {atletasApagadas.map((a) => {
              const turma = mapaTurma[a.turmaId]
              const escola = turma ? mapaEscola[turma.escolaId] : undefined
              return (
                <Card key={a.id} className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold">{a.nome}</div>
                    <div className="text-xs text-[var(--rd-text-dim)]">
                      {[turma?.nome, escola?.nome].filter(Boolean).join(' — ') || 'Turma apagada'} · apagada em {formatDataHora(a.deletedAt!)}
                    </div>
                  </div>
                  <Button variant="gold" onClick={() => restoreAtleta(a.id)}>
                    <RotateCcw size={16} /> Restaurar
                  </Button>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {partidasApagadas.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--rd-text-dim)] mb-2">
            Partidas/scouts apagados
          </div>
          <div className="flex flex-col gap-2">
            {partidasApagadas.map((p) => {
              const turma = mapaTurma[p.turmaId]
              return (
                <Card key={p.id} className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold">
                      {turma?.nome ?? 'Turma apagada'} {p.adversarioNome ? `× ${p.adversarioNome}` : ''}
                    </div>
                    <div className="text-xs text-[var(--rd-text-dim)]">
                      {formatDate(p.data)} · {p.tipo === 'JOGO' ? 'Jogo' : 'Treino'} · apagada em {formatDataHora(p.deletedAt!)}
                    </div>
                  </div>
                  <Button variant="gold" onClick={() => restaurarPartida(p.id)}>
                    <RotateCcw size={16} /> Restaurar
                  </Button>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {exerciciosApagados.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--rd-text-dim)] mb-2">
            Exercícios da biblioteca apagados
          </div>
          <div className="flex flex-col gap-2">
            {exerciciosApagados.map((ex) => (
              <Card key={ex.id} className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">{ex.nome}</div>
                  <div className="text-xs text-[var(--rd-text-dim)]">
                    {ex.objetivo || 'Sem objetivo'} · apagado em {formatDataHora(ex.deletedAt!)}
                  </div>
                </div>
                <Button variant="gold" onClick={() => restaurarExercicioBiblioteca(ex.id)}>
                  <RotateCcw size={16} /> Restaurar
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {turmasApagadas.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--rd-text-dim)] mb-2">
            Turmas apagadas
          </div>
          <div className="flex flex-col gap-2">
            {turmasApagadas.map((t) => {
              const escola = mapaEscola[t.escolaId]
              return (
                <Card key={t.id} className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold">{t.nome}</div>
                    <div className="text-xs text-[var(--rd-text-dim)]">
                      {escola?.nome ?? 'Escola apagada'} · apagada em {formatDataHora(t.deletedAt!)}
                    </div>
                  </div>
                  <Button variant="gold" onClick={() => restoreTurma(t.id)}>
                    <RotateCcw size={16} /> Restaurar
                  </Button>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
