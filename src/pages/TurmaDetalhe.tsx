import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Users, Plus, Trash2, Dumbbell, CalendarPlus, CalendarDays, Pencil } from 'lucide-react'
import { useStore } from '../store'
import { PageTitle, Card, Button, EmptyState, Field, BotaoVoltar } from '../components/ui'
import ConvocacaoForm from '../components/ConvocacaoForm'
import { FORMATOS_PARTIDA } from '../types'
import type { FormatoPartida } from '../types'
import { calcularIdade, formatarDataBR, nivelDaTurma } from '../convocacao'
import { formatDate } from '../utils'

export default function TurmaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { escolas, turmas, atletas, jogosAgendados, addAtleta, deleteAtleta, deleteJogoAgendado, criarPartida, updateTurma } = useStore()
  const [nome, setNome] = useState('')
  const [formato, setFormato] = useState<FormatoPartida>('MELHOR_DE_5')
  // null = formulário fechado; 'novo' = agendando; id = editando a convocação daquele jogo.
  const [formJogo, setFormJogo] = useState<string | null>(null)
  const turmaEncontrada = turmas.find((t) => t.id === id)
  const meusAtletas = atletas.filter((a) => a.turmaId === id && !a.deletedAt)

  if (!turmaEncontrada) return <p>Turma não encontrada.</p>
  const turma = turmaEncontrada
  const turmaId = turma.id
  const hoje = new Date().toISOString().slice(0, 10)
  const proximosJogos = jogosAgendados
    .filter((j) => j.turmaId === turmaId && !j.deletedAt && j.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data))
  const nivelAuto = nivelDaTurma({ nome: turma.nome })

  // Scout de JOGO só começa pelo Calendário (pedido 11/11/2026), a partir de
  // um jogo agendado com convocação. Aqui na turma fica só o Treino.
  function iniciarTreino() {
    const p = criarPartida(turmaId, 'TREINO', formato)
    navigate(`/scout/${p.id}`)
  }

  return (
    <div>
      <BotaoVoltar to={`/escolas/${turma.escolaId}`} label={escolas.find((e) => e.id === turma.escolaId)?.nome ?? 'Escola'} />
      <PageTitle icon={<Users size={24} />} title={turma.nome} subtitle="Jogos, convocação e atletas" />

      <Card className="mb-5">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <div className="font-bold text-sm flex items-center gap-2"><CalendarDays size={18} /> Próximos jogos</div>
          {formJogo !== 'novo' && (
            <Button variant="gold" onClick={() => setFormJogo('novo')}><CalendarPlus size={16} /> Agendar jogo</Button>
          )}
        </div>

        {formJogo === 'novo' && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--rd-border)' }}>
            <ConvocacaoForm turma={turma} onPronto={() => setFormJogo(null)} />
          </div>
        )}

        {proximosJogos.length === 0 && formJogo !== 'novo' && (
          <p className="text-sm text-[var(--rd-text-dim)]">Nenhum jogo agendado. Agende aqui com a convocação; no dia, o scout começa pelo Calendário.</p>
        )}

        <div className="grid gap-2 mt-2">
          {proximosJogos.map((j) => (
            formJogo === j.id ? (
              <div key={j.id} className="pt-3" style={{ borderTop: '1px solid var(--rd-border)' }}>
                <ConvocacaoForm turma={turma} jogo={j} onPronto={() => setFormJogo(null)} />
              </div>
            ) : (
              <div key={j.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ border: '1px solid var(--rd-border)' }}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">vs {j.adversarioNome}</div>
                  <div className="text-xs text-[var(--rd-text-dim)]">
                    {formatDate(j.data)}{j.horario ? ` · ${j.horario.slice(0, 5)}` : ''}{j.local ? ` · ${j.local}` : ''}
                    {j.campeonatoNome ? ` · ${j.campeonatoNome}` : ''}
                  </div>
                  <div className="text-xs mt-0.5">
                    {j.convocadas?.length ? `${j.convocadas.length} convocada(s)` : 'Sem convocação ainda'}
                  </div>
                </div>
                <Button onClick={() => setFormJogo(j.id)} aria-label="Editar convocação"><Pencil size={16} /></Button>
                <Button onClick={() => navigate('/calendario', { state: { abrirDia: j.data } })} aria-label="Ver no calendário"><CalendarDays size={16} /></Button>
                <Button variant="danger" onClick={() => { if (confirm(`Excluir o jogo contra ${j.adversarioNome}?`)) deleteJogoAgendado(j.id) }} aria-label="Excluir jogo"><Trash2 size={16} /></Button>
              </div>
            )
          ))}
        </div>
      </Card>

      <Card className="mb-5">
        <div className="grid sm:grid-cols-2 gap-x-3 items-end">
          <Field label="Nível da turma (pra puxar reforço das turmas de baixo)">
            <input
              type="number" min={0} className="rd-input"
              value={turma.nivel ?? ''}
              placeholder={nivelAuto !== undefined ? `${nivelAuto} (tirado do nome)` : 'Ex.: 8 pro 8º ano'}
              onChange={(e) => updateTurma(turma.id, { nivel: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>
          <Field label="Formato (pro Treino)">
            <select className="rd-input" value={formato} onChange={(e) => setFormato(e.target.value as FormatoPartida)}>
              {FORMATOS_PARTIDA.map((f) => (
                <option key={f.valor} value={f.valor}>{f.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <Button onClick={iniciarTreino}><Dumbbell size={16} /> Treino</Button>
      </Card>

      <div className="flex gap-2 mb-4">
        <input className="rd-input" placeholder="Nome da atleta" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Button variant="gold" onClick={() => { if (nome.trim()) { addAtleta(turma.id, nome.trim()); setNome('') } }}>
          <Plus size={16} /> Adicionar
        </Button>
      </div>

      {meusAtletas.length === 0 ? (
        <EmptyState icon={<Users size={40} />} text="Nenhuma atleta cadastrada ainda." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {meusAtletas.map((a) => {
            const idade = calcularIdade(a.nascimento) ?? a.idade
            return (
              <Card key={a.id} className="flex items-center justify-between">
                <Link to={`/atletas/${a.id}`} className="flex-1 hover:underline">
                  <span className="font-semibold block">{a.nome}</span>
                  <span className="text-xs text-[var(--rd-text-dim)]">
                    {a.nascimento ? `Nasc. ${formatarDataBR(a.nascimento)}` : 'Sem data de nascimento'}
                    {idade !== undefined ? ` · ${idade} anos` : ''}
                  </span>
                </Link>
                <Button variant="danger" onClick={() => { if (confirm(`Excluir a atleta "${a.nome}"? Dá pra restaurar depois pela Lixeira.`)) deleteAtleta(a.id) }}><Trash2 size={16} /></Button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
