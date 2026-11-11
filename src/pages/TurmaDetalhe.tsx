import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Users, Plus, Trash2, Volleyball, Dumbbell } from 'lucide-react'
import { useStore } from '../store'
import { PageTitle, Card, Button, EmptyState, Field } from '../components/ui'
import { FORMATOS_PARTIDA } from '../types'
import type { FormatoPartida } from '../types'

export default function TurmaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { turmas, atletas, addAtleta, deleteAtleta, criarPartida } = useStore()
  const [nome, setNome] = useState('')
  const [formato, setFormato] = useState<FormatoPartida>('MELHOR_DE_5')
  const turmaEncontrada = turmas.find((t) => t.id === id)
  const meusAtletas = atletas.filter((a) => a.turmaId === id && !a.deletedAt)

  if (!turmaEncontrada) return <p>Turma não encontrada.</p>
  const turma = turmaEncontrada
  const turmaId = turma.id

  function iniciar(tipo: 'JOGO' | 'TREINO') {
    const p = criarPartida(turmaId, tipo, formato)
    navigate(`/scout/${p.id}`)
  }

  return (
    <div>
      <PageTitle icon={<Users size={24} />} title={turma.nome} subtitle="Atletas e ações rápidas" />

      <Card className="mb-5">
        <Field label="Formato da partida (pra Novo Scout)">
          <select className="rd-input" value={formato} onChange={(e) => setFormato(e.target.value as FormatoPartida)}>
            {FORMATOS_PARTIDA.map((f) => (
              <option key={f.valor} value={f.valor}>{f.label}</option>
            ))}
          </select>
          <p className="text-xs text-[var(--rd-text-dim)] mt-1">
            {FORMATOS_PARTIDA.find((f) => f.valor === formato)?.descricao}
          </p>
        </Field>
        <div className="flex gap-2 mt-2">
          <Button variant="gold" onClick={() => iniciar('JOGO')}><Volleyball size={16} /> Novo Scout</Button>
          <Button onClick={() => iniciar('TREINO')}><Dumbbell size={16} /> Treino</Button>
        </div>
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
          {meusAtletas.map((a) => (
            <Card key={a.id} className="flex items-center justify-between">
              <Link to={`/atletas/${a.id}`} className="font-semibold flex-1 hover:underline">{a.nome}</Link>
              <Button variant="danger" onClick={() => { if (confirm(`Excluir a atleta "${a.nome}"? Dá pra restaurar depois pela Lixeira.`)) deleteAtleta(a.id) }}><Trash2 size={16} /></Button>
            </Card>
          ))}
        </div>
      )}

      <Link to="/escolas" className="inline-block mt-4 text-sm text-[var(--rd-text-dim)] underline">← Voltar</Link>
    </div>
  )
}
