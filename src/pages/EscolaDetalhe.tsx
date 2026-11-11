import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { School as SchoolIcon, Plus, Trash2, Users } from 'lucide-react'
import { useStore } from '../store'
import { PageTitle, Card, Button, EmptyState, BotaoVoltar } from '../components/ui'
import { LogoUpload } from '../components/LogoUpload'

export default function EscolaDetalhe() {
  const { id } = useParams()
  const { escolas, turmas, atletas, addTurma, deleteTurma, updateEscola } = useStore()
  const [nome, setNome] = useState('')
  const escola = escolas.find((e) => e.id === id)
  const minhasTurmas = turmas.filter((t) => t.escolaId === id && !t.deletedAt)

  if (!escola) return <p>Escola não encontrada.</p>

  return (
    <div>
      <BotaoVoltar to="/escolas" label="Escolas" />
      <PageTitle icon={<SchoolIcon size={24} />} title={escola.nome} subtitle="Turmas desta escola" />

      <Card className="mb-4">
        <LogoUpload
          logoUrl={escola.logoUrl} prefixo="escola" id={escola.id} nome={escola.nome}
          onEnviado={(url) => updateEscola(escola.id, { logoUrl: url })}
        />
      </Card>

      <div className="flex gap-2 mb-4">
        <input className="rd-input" placeholder="Nome da turma" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Button variant="gold" onClick={() => { if (nome.trim()) { addTurma(escola.id, nome.trim()); setNome('') } }}>
          <Plus size={16} /> Adicionar
        </Button>
      </div>

      {minhasTurmas.length === 0 ? (
        <EmptyState icon={<Users size={40} />} text="Nenhuma turma cadastrada ainda." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {minhasTurmas.map((t) => (
            <Card key={t.id} className="flex items-center justify-between">
              <Link to={`/turmas/${t.id}`} className="font-semibold flex-1">
                {t.nome}
                <div className="text-xs text-[var(--rd-text-dim)] font-normal">
                  {atletas.filter((a) => a.turmaId === t.id && !a.deletedAt).length} atleta(s)
                </div>
              </Link>
              <Button variant="danger" onClick={() => { if (confirm(`Excluir a turma "${t.nome}"? Dá pra restaurar depois pela Lixeira.`)) deleteTurma(t.id) }}><Trash2 size={16} /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
