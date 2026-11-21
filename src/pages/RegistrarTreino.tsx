// Registro rápido de treino (pedido 21/11/2026): quando não deu tempo de
// montar a ficha, o treinador só marca o que teve no treino — temas e
// exercícios da biblioteca — e salva. Vira uma sessão de treino normal.
// Regras em `treinoRapido.ts`.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckSquare, Square, Search, Save } from 'lucide-react'
import { useStore } from '../store'
import { PageTitle, Card, Field, BotaoVoltar } from '../components/ui'
import { GRUPOS_TEMAS_TREINO, TEMAS_TREINO } from '../types'
import { quadrosComExercicios, temasDoRegistro } from '../treinoRapido'
import { isoDia, formatDate } from '../utils'

function chipClass(ativo: boolean): string {
  return `text-sm px-3 py-1.5 rounded-full border transition-colors ${
    ativo ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300] font-semibold' : 'border-[var(--rd-border)] hover:bg-black/5 dark:hover:bg-white/10'
  }`
}

export default function RegistrarTreino() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const turmas = useStore((s) => s.turmas)
  const escolas = useStore((s) => s.escolas)
  const biblioteca = useStore((s) => s.bibliotecaExercicios)
  const sessoesTreino = useStore((s) => s.sessoesTreino)
  const criarSessaoTreino = useStore((s) => s.criarSessaoTreino)
  const atualizarSessaoTreino = useStore((s) => s.atualizarSessaoTreino)

  const turmasAtivas = turmas.filter((t) => !t.deletedAt)
  const turmaInicial = turmasAtivas.find((t) => t.id === params.get('turma'))?.id ?? turmasAtivas[0]?.id ?? ''
  const [turmaId, setTurmaId] = useState(turmaInicial)
  const [data, setData] = useState(isoDia(new Date()))
  const [temas, setTemas] = useState<string[]>([])
  const [exerciciosIds, setExerciciosIds] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  // Vindo do Assistente (lá embaixo na conversa): abre no topo da tela.
  useEffect(() => { window.scrollTo(0, 0) }, [])

  const exerciciosAtivos = biblioteca.filter((e) => !e.deletedAt)
  // Exercícios dos temas marcados aparecem primeiro; depois os outros, por nome.
  const listaExercicios = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return exerciciosAtivos
      .filter((e) => !termo || e.nome.toLowerCase().includes(termo))
      .sort((a, b) => {
        const pa = a.temas.some((t) => temas.includes(t)) ? 0 : 1
        const pb = b.temas.some((t) => temas.includes(t)) ? 0 : 1
        return pa - pb || a.nome.localeCompare(b.nome)
      })
  }, [exerciciosAtivos, busca, temas])

  const jaTemTreino = sessoesTreino.find((s) => !s.deletedAt && s.turmaId === turmaId && s.data === data)
  const podeSalvar = !!turmaId && (temas.length > 0 || exerciciosIds.length > 0)

  function alternar(lista: string[], id: string): string[] {
    return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]
  }

  function salvar() {
    if (!podeSalvar) return
    const escolhidos = exerciciosIds.map((id) => exerciciosAtivos.find((e) => e.id === id)!).filter(Boolean)
    const sessao = criarSessaoTreino(turmaId)
    atualizarSessaoTreino(sessao.id, {
      data,
      temas: temasDoRegistro(temas, escolhidos),
      quadros: quadrosComExercicios(escolhidos),
    })
    navigate('/treinos')
  }

  if (turmasAtivas.length === 0) {
    return (
      <div>
        <BotaoVoltar to="/treinos" label="Treinos" />
        <PageTitle title="Registrar o que teve" />
        <Card>Cadastre uma escola e uma turma antes de registrar um treino.</Card>
      </div>
    )
  }

  return (
    <div className="pb-24">
      <BotaoVoltar to="/treinos" label="Treinos" />
      <PageTitle icon={<CheckSquare size={24} />} title="Registrar o que teve" subtitle="Sem ficha: só marque o que foi trabalhado no treino." />

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Turma">
            <select className="rd-input" value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              {turmasAtivas.map((t) => {
                const esc = escolas.find((e) => e.id === t.escolaId)
                return <option key={t.id} value={t.id}>{esc ? `${esc.nome} ` : ''}{t.nome}</option>
              })}
            </select>
          </Field>
          <Field label="Dia">
            <input type="date" className="rd-input" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
        </div>
        {jaTemTreino && (
          <p className="text-sm text-[var(--rd-text-dim)]">
            Já existe um treino dessa turma em {formatDate(data)}. <Link to={`/treinos/${jaTemTreino.id}`} className="font-semibold underline">Abrir ele</Link> ou salve este como outro registro.
          </p>
        )}
      </Card>

      <Card className="mb-4">
        <h2 className="font-bold mb-1">O que foi trabalhado</h2>
        <p className="text-sm text-[var(--rd-text-dim)] mb-3">Toque nos temas. O primeiro que você marcar é o principal.</p>
        {GRUPOS_TEMAS_TREINO.map((g) => (
          <div key={g.id} className="mb-3">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--rd-text-dim)] mb-1.5">{g.label}</div>
            <div className="flex flex-wrap gap-2">
              {TEMAS_TREINO.filter((t) => t.grupo === g.id).map((t) => (
                <button key={t.id} className={chipClass(temas.includes(t.id))} onClick={() => setTemas(alternar(temas, t.id))}>
                  {temas[0] === t.id ? '★ ' : ''}{t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <Card className="mb-4">
        <h2 className="font-bold mb-1">Exercícios que usou <span className="font-normal text-[var(--rd-text-dim)]">(opcional)</span></h2>
        {exerciciosAtivos.length === 0 ? (
          <p className="text-sm text-[var(--rd-text-dim)]">Sua biblioteca ainda não tem exercícios. Marque só os temas e salve.</p>
        ) : (
          <>
            <div className="relative mb-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rd-text-dim)]" />
              <input className="rd-input !pl-9" placeholder="Procurar exercício…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="flex flex-col">
              {listaExercicios.map((e) => {
                const marcado = exerciciosIds.includes(e.id)
                return (
                  <button
                    key={e.id}
                    onClick={() => setExerciciosIds(alternar(exerciciosIds, e.id))}
                    className="flex items-center gap-3 text-left py-2.5 border-b last:border-b-0 border-[var(--rd-border)]"
                    style={{ minHeight: 44 }}
                  >
                    {marcado ? <CheckSquare size={22} className="rd-accent-text shrink-0" /> : <Square size={22} className="text-[var(--rd-text-dim)] shrink-0" />}
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium">{e.nome}</span>
                      <span className="block text-xs text-[var(--rd-text-dim)] truncate">
                        {[e.tempoMin ? `${e.tempoMin} min` : '', e.temas.map((t) => TEMAS_TREINO.find((x) => x.id === t)?.label).filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                )
              })}
              {listaExercicios.length === 0 && <p className="text-sm text-[var(--rd-text-dim)] py-2">Nenhum exercício com esse nome.</p>}
            </div>
          </>
        )}
      </Card>

      <div className="fixed bottom-0 left-0 right-0 md:left-56 px-4 py-3 border-t" style={{ background: 'var(--rd-bg)', borderColor: 'var(--rd-border)' }}>
        <button className="rd-btn rd-btn-gold w-full justify-center disabled:opacity-50" style={{ minHeight: 48 }} disabled={!podeSalvar} onClick={salvar}>
          <Save size={18} /> Salvar treino{exerciciosIds.length ? ` (${exerciciosIds.length} exercício${exerciciosIds.length > 1 ? 's' : ''})` : ''}
        </button>
      </div>
    </div>
  )
}
