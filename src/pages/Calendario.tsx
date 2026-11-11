import { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Volleyball, Dumbbell, Trash2, Play, ClipboardList } from 'lucide-react'
import { useStore } from '../store'
import { PageTitle, Card, Button, EmptyState, Field } from '../components/ui'
import { isoDia, parseDataLocal, encontrarLogoAdversario } from '../utils'
import { LogoExibicao } from '../components/LogoUpload'
import type { JogoAgendado } from '../types'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface EventoDia {
  tipo: 'JOGO_JOGADO' | 'JOGO_AGENDADO' | 'TREINO' | 'SESSAO_TREINO'
  data: string
  titulo: string
  local?: string
  partidaId?: string
  jogoAgendado?: JogoAgendado
  sessaoTreinoId?: string
  /** Só em JOGO_JOGADO/JOGO_AGENDADO — usado pra achar o logo do adversário
   *  (pedido 30/10/2026: "Logo das escolas/adversários nas telas"). */
  adversarioNome?: string
}

/** Gera as ocorrências de treino recorrente que caem num intervalo [inicio, fim]
 *  (inclusive), independente de "hoje" — diferente de `gerarOcorrenciasTreino`
 *  (que só olha pra frente a partir de hoje), pra poder navegar meses passados
 *  no calendário e ainda ver os treinos daquele mês. */
function ocorrenciasTreinoNoIntervalo(horarios: { id: string; turmaId: string; diaSemana: number; horario: string; local?: string; deletedAt?: string }[], inicio: Date, fim: Date) {
  const ocorrencias: { horarioId: string; turmaId: string; data: string; horario: string; local?: string }[] = []
  const cursor = new Date(inicio)
  while (cursor <= fim) {
    const diaSemana = cursor.getDay()
    for (const h of horarios) {
      if (h.deletedAt) continue
      if (h.diaSemana === diaSemana) {
        ocorrencias.push({ horarioId: h.id, turmaId: h.turmaId, data: isoDia(cursor), horario: h.horario, local: h.local })
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return ocorrencias
}

export default function Calendario() {
  const navigate = useNavigate()
  const location = useLocation()
  const { turmas, partidas, jogosAgendados, horariosTreino, sessoesTreino, adversarios, addJogoAgendado, addAdversario, deleteJogoAgendado, criarPartida } = useStore()
  const [adversario, setAdversario] = useState('')
  const [dataForm, setDataForm] = useState('')
  const [turmaId, setTurmaId] = useState(turmas[0]?.id ?? '')

  // Chegando de "Salvar e ver no Calendário" (editor de Treinos): abre direto
  // no mês/dia da sessão que acabou de ser salva, pra confirmar visualmente
  // que ela está lá.
  const abrirDia = (location.state as { abrirDia?: string } | null)?.abrirDia
  const hoje = new Date(new Date().toDateString())
  const diaInicial = abrirDia ? parseDataLocal(abrirDia) : hoje
  const [mesAtual, setMesAtual] = useState(new Date(diaInicial.getFullYear(), diaInicial.getMonth(), 1))
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(abrirDia ?? null)

  // Grade do mês: começa no domingo da semana do dia 1, termina no sábado da
  // semana do último dia — pra mostrar sempre semanas completas (dias do mês
  // anterior/seguinte aparecem esmaecidos, mesmo visual do calendário antigo.
  const inicioGrade = useMemo(() => {
    const d = new Date(mesAtual)
    d.setDate(d.getDate() - d.getDay())
    return d
  }, [mesAtual])

  const fimGrade = useMemo(() => {
    const ultimoDiaMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0)
    const d = new Date(ultimoDiaMes)
    d.setDate(d.getDate() + (6 - d.getDay()))
    return d
  }, [mesAtual])

  const diasDaGrade = useMemo(() => {
    const dias: Date[] = []
    const cursor = new Date(inicioGrade)
    while (cursor <= fimGrade) {
      dias.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return dias
  }, [inicioGrade, fimGrade])

  // Todos os jogos já jogados (Histórico) que caem na grade visível.
  const jogosJogados: EventoDia[] = useMemo(() => partidas
    .filter((p) => p.tipo === 'JOGO' && !p.deletedAt)
    .filter((p) => {
      const d = parseDataLocal(p.data)
      return d >= inicioGrade && d <= fimGrade
    })
    .map((p) => ({
      tipo: 'JOGO_JOGADO',
      data: p.data,
      titulo: `vs ${p.adversarioNome ?? 'Adversário'}${p.status === 'FINALIZADA' ? ` — ${p.setsGanhosCasa}×${p.setsGanhosAdversario}` : ' (em andamento)'}`,
      local: p.local,
      partidaId: p.id,
      adversarioNome: p.adversarioNome,
    })), [partidas, inicioGrade, fimGrade])

  // Jogos agendados (ainda não jogados) que caem na grade visível.
  const jogosFuturos: EventoDia[] = useMemo(() => jogosAgendados
    .filter((j) => !j.deletedAt)
    .filter((j) => {
      const d = parseDataLocal(j.data)
      return d >= inicioGrade && d <= fimGrade
    })
    .map((j) => ({
      tipo: 'JOGO_AGENDADO' as const,
      data: j.data,
      titulo: `vs ${j.adversarioNome}${j.horario ? ` — ${j.horario}` : ''}`,
      local: j.local,
      jogoAgendado: j,
      adversarioNome: j.adversarioNome,
    })), [jogosAgendados, inicioGrade, fimGrade])

  const treinos: EventoDia[] = useMemo(() =>
    ocorrenciasTreinoNoIntervalo(horariosTreino, inicioGrade, fimGrade)
      .map((o) => ({ tipo: 'TREINO', data: o.data, titulo: `Treino — ${o.horario}`, local: o.local })),
    [horariosTreino, inicioGrade, fimGrade])

  // Sessões de treino montadas no editor de Treinos (pedido 29/10/2026) — ao
  // salvar uma sessão com data, ela já aparece aqui sozinha (igual jogo
  // agendado/partida), sem precisar de um passo manual de "adicionar ao
  // calendário". Clicar abre a mesma ficha de novo pra continuar editando.
  const sessoesDeTreino: EventoDia[] = useMemo(() => sessoesTreino
    .filter((s) => !s.deletedAt && s.data)
    .filter((s) => {
      const d = parseDataLocal(s.data)
      return d >= inicioGrade && d <= fimGrade
    })
    .map((s) => {
      const turma = turmas.find((t) => t.id === s.turmaId)
      return {
        tipo: 'SESSAO_TREINO' as const,
        data: s.data,
        titulo: `Sessão de treino — ${turma?.nome ?? 'Turma'}${s.numeroSessao ? ` (nº ${s.numeroSessao})` : ''}`,
        sessaoTreinoId: s.id,
      }
    }), [sessoesTreino, turmas, inicioGrade, fimGrade])

  const todosEventos = useMemo(() => [...jogosJogados, ...jogosFuturos, ...treinos, ...sessoesDeTreino], [jogosJogados, jogosFuturos, treinos, sessoesDeTreino])

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoDia[]>()
    for (const ev of todosEventos) {
      if (!mapa.has(ev.data)) mapa.set(ev.data, [])
      mapa.get(ev.data)!.push(ev)
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.titulo.localeCompare(b.titulo))
    return mapa
  }, [todosEventos])

  const eventosDoDiaSelecionado = diaSelecionado ? (eventosPorDia.get(diaSelecionado) ?? []) : []

  function agendar() {
    if (!adversario.trim() || !dataForm || !turmaId) return
    const adv = addAdversario(adversario.trim())
    addJogoAgendado({ turmaId, adversarioId: adv.id, adversarioNome: adv.nome, data: dataForm })
    setAdversario(''); setDataForm('')
  }

  /** Transforma um jogo agendado em partida de verdade e já abre o Scout ao
   *  vivo nela — antes não existia NENHUM jeito de começar o scout a partir de
   *  um jogo que já tinha sido agendado no Calendário (só dava pra começar
   *  direto da tela da turma, "do zero"). Ao iniciar, o jogo agendado sai da
   *  lista (marcado como concluído/consumido) pra não aparecer duplicado como
   *  "agendado" e "jogado" no mesmo dia. */
  function iniciarScoutDeAgendado(jogo: JogoAgendado) {
    const partida = criarPartida(jogo.turmaId, 'JOGO', 'MELHOR_DE_5', {
      adversarioId: jogo.adversarioId,
      adversarioNome: jogo.adversarioNome,
      campeonatoId: jogo.campeonatoId,
      data: jogo.data,
      local: jogo.local,
    })
    deleteJogoAgendado(jogo.id)
    navigate(`/scout/${partida.id}`)
  }

  function mudarMes(delta: number) {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + delta, 1))
    setDiaSelecionado(null)
  }

  function irParaHoje() {
    setMesAtual(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
    setDiaSelecionado(isoDia(hoje))
  }

  return (
    <div>
      <PageTitle icon={<CalendarIcon size={22} />} title="Calendário" subtitle="Jogos (agendados e já jogados) e treinos recorrentes" />

      <Card className="mb-5">
        <div className="grid sm:grid-cols-3 gap-2">
          <Field label="Turma">
            <select className="rd-input" value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </Field>
          <Field label="Adversário">
            <input className="rd-input" value={adversario} onChange={(e) => setAdversario(e.target.value)} placeholder="Nome do adversário" />
          </Field>
          <Field label="Data">
            <input className="rd-input" type="date" value={dataForm} onChange={(e) => setDataForm(e.target.value)} />
          </Field>
        </div>
        <Button variant="gold" onClick={agendar}><Plus size={16} /> Agendar jogo</Button>
      </Card>

      <Card className="mb-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button className="rd-btn !p-2" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
            <span className="font-bold text-sm w-40 text-center">{MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}</span>
            <button className="rd-btn !p-2" onClick={() => mudarMes(1)} aria-label="Próximo mês"><ChevronRight size={16} /></button>
          </div>
          <button className="rd-btn text-xs" onClick={irParaHoje}>Hoje</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[var(--rd-text-dim)] mb-1">
          {DIAS_SEMANA.map((d) => <div key={d}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {diasDaGrade.map((dia) => {
            const diaIso = isoDia(dia)
            const doMesAtual = dia.getMonth() === mesAtual.getMonth()
            const eh_hoje = diaIso === isoDia(hoje)
            const eventosDesseDia = eventosPorDia.get(diaIso) ?? []
            const qtdJogos = eventosDesseDia.filter((e) => e.tipo === 'JOGO_JOGADO' || e.tipo === 'JOGO_AGENDADO').length
            const qtdTreinos = eventosDesseDia.filter((e) => e.tipo === 'TREINO' || e.tipo === 'SESSAO_TREINO').length
            const selecionado = diaSelecionado === diaIso
            return (
              <button
                key={diaIso}
                onClick={() => setDiaSelecionado(selecionado ? null : diaIso)}
                className="aspect-square rounded-lg p-1 flex flex-col items-center justify-start gap-0.5 text-left transition-colors"
                style={{
                  background: selecionado ? 'var(--rd-gold)' : eh_hoje ? 'rgba(212,175,55,.15)' : 'transparent',
                  border: `1px solid ${eh_hoje && !selecionado ? 'var(--rd-gold)' : 'var(--rd-border)'}`,
                  opacity: doMesAtual ? 1 : 0.35,
                }}
              >
                <span className={`text-[11px] font-bold ${selecionado ? 'text-black' : ''}`}>{dia.getDate()}</span>
                <div className="flex gap-0.5 flex-wrap justify-center">
                  {qtdJogos > 0 && (
                    <span className={`text-[9px] px-1 rounded-full ${selecionado ? 'bg-black/20 text-black' : ''}`} style={!selecionado ? { background: 'rgba(212,175,55,.2)', color: 'var(--rd-gold)' } : undefined}>
                      🏐{qtdJogos}
                    </span>
                  )}
                  {qtdTreinos > 0 && (
                    <span className={`text-[9px] px-1 rounded-full ${selecionado ? 'bg-black/20 text-black' : ''}`} style={!selecionado ? { background: 'rgba(52,152,219,.2)', color: 'var(--rd-neutro)' } : undefined}>
                      🏃{qtdTreinos}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {diaSelecionado && (
        <div className="mb-5">
          <h2 className="text-sm font-bold mb-2">
            {parseDataLocal(diaSelecionado).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </h2>
          {eventosDoDiaSelecionado.length === 0 ? (
            <EmptyState icon={<CalendarIcon size={32} />} text="Nenhum evento neste dia." />
          ) : (
            <div className="grid gap-2">
              {eventosDoDiaSelecionado.map((ev, i) => (
                <Card key={i} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="flex items-center gap-2 text-sm">
                    {ev.tipo === 'TREINO' ? <Dumbbell size={16} className="text-[var(--rd-neutro)] shrink-0" />
                      : ev.tipo === 'SESSAO_TREINO' ? <ClipboardList size={16} className="text-[var(--rd-neutro)] shrink-0" />
                      : ev.adversarioNome ? <LogoExibicao logoUrl={encontrarLogoAdversario(adversarios, ev.adversarioNome)} nome={ev.adversarioNome} tamanho={22} />
                      : <Volleyball size={16} className="rd-accent-text shrink-0" />}
                    {ev.titulo}
                    {ev.local && <span className="text-[var(--rd-text-dim)]">• {ev.local}</span>}
                  </span>
                  {ev.jogoAgendado && (
                    <span className="flex gap-2">
                      <button className="rd-btn rd-btn-gold text-xs" onClick={() => iniciarScoutDeAgendado(ev.jogoAgendado!)}>
                        <Play size={14} /> Iniciar Scout
                      </button>
                      <button className="rd-btn !p-2 rd-btn-danger" onClick={() => { if (confirm('Excluir este jogo agendado?')) deleteJogoAgendado(ev.jogoAgendado!.id) }} aria-label="Excluir jogo agendado">
                        <Trash2 size={14} />
                      </button>
                    </span>
                  )}
                  {ev.sessaoTreinoId && (
                    <button className="rd-btn rd-btn-gold text-xs" onClick={() => navigate(`/treinos/${ev.sessaoTreinoId}`)}>
                      Abrir sessão
                    </button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
