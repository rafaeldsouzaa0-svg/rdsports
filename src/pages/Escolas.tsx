import { useState } from 'react'
import { Link } from 'react-router-dom'
import { School, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { PageTitle, Card, Button, EmptyState } from '../components/ui'
import { LogoExibicao } from '../components/LogoUpload'

export default function Escolas() {
  const { escolas, turmas, addEscola, deleteEscola } = useStore()
  const [nome, setNome] = useState('')
  const visiveis = escolas.filter((e) => !e.deletedAt)

  return (
    <div>
      <PageTitle icon={<School size={24} />} title="Escolas" subtitle={`${visiveis.length} cadastradas`} />

      <div className="flex gap-2 mb-4">
        <input className="rd-input" placeholder="Nome da escola" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Button variant="gold" onClick={() => { if (nome.trim()) { addEscola(nome.trim()); setNome('') } }}>
          <Plus size={16} /> Adicionar
        </Button>
      </div>

      {visiveis.length === 0 ? (
        <EmptyState icon={<School size={40} />} text="Nenhuma escola cadastrada ainda." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {visiveis.map((e) => (
            <Card key={e.id} className="flex items-center justify-between">
              <Link to={`/escolas/${e.id}`} className="font-semibold flex-1 flex items-center gap-3">
                <LogoExibicao logoUrl={e.logoUrl} nome={e.nome} tamanho={36} />
                <div>
                  {e.nome}
                  <div className="text-xs text-[var(--rd-text-dim)] font-normal">
                    {turmas.filter((t) => t.escolaId === e.id && !t.deletedAt).length} turma(s)
                  </div>
                </div>
              </Link>
              <Button variant="danger" onClick={() => { if (confirm(`Excluir a escola "${e.nome}"? Isso também esconde as turmas dela.`)) deleteEscola(e.id) }}><Trash2 size={16} /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
