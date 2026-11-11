// Lista de sessões de treino (pedido 29/10/2026), de todas as escolas/turmas,
// com atalho pra criar uma nova. Pedido 31/10/2026: ganhou uma 2ª aba
// "Biblioteca" (banco de exercícios reaproveitável em qualquer sessão —
// ver `BibliotecaExercicios.tsx`), igual o H10 tem sub-separadores aqui.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, Printer, Trash2, BookOpen } from 'lucide-react'
import { useStore } from '../store'
import { PageTitle, Card, Button, EmptyState } from '../components/ui'
import { formatDate } from '../utils'
import { TEMAS_TREINO } from '../types'
import { gerarHtmlFichaTreino } from '../treinoHtml'
import { abrirParaImprimir } from '../htmlReport'
import BibliotecaExercicios from './BibliotecaExercicios'
import { SugestaoFocoCard } from '../components/SugestaoFocoCard'

function abaBtnClass(ativa: boolean): string {
  return `text-sm font-semibold px-4 py-2 rounded-lg border transition-colors flex items-center gap-1.5 ${
    ativa ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)] hover:bg-black/5 dark:hover:bg-white/10'
  }`
}

export default function Treinos() {
  const navigate = useNavigate()
  const [aba, setAba] = useState<'sessoes' | 'biblioteca'>('sessoes')
  const sessoesTreino = useStore((s) => s.sessoesTreino)
  const turmas = useStore((s) => s.turmas)
  const escolas = useStore((s) => s.escolas)
  const criarSessaoTreino = useStore((s) => s.criarSessaoTreino)
  const excluirSessaoTreino = useStore((s) => s.excluirSessaoTreino)

  const mapaTurma = Object.fromEntries(turmas.map((t) => [t.id, t]))
  const mapaEscola = Object.fromEntries(escolas.map((e) => [e.id, e]))
  const turmasAtivas = turmas.filter((t) => !t.deletedAt)

  const sessoes = sessoesTreino
    .filter((s) => !s.deletedAt)
    .sort((a, b) => (b.data > a.data ? 1 : b.data < a.data ? -1 : 0))

  function nova() {
    if (turmasAtivas.length === 0) {
      alert('Cadastre uma escola e uma turma antes de montar um treino.')
      return
    }
    const sessao = criarSessaoTreino(turmasAtivas[0].id)
    navigate(`/treinos/${sessao.id}`)
  }

  function imprimir(sessaoId: string) {
    const sessao = sessoesTreino.find((s) => s.id === sessaoId)
    if (!sessao) return
    const turma = mapaTurma[sessao.turmaId]
    const escola = turma ? mapaEscola[turma.escolaId] : undefined
    if (!turma || !escola) return
    abrirParaImprimir(gerarHtmlFichaTreino(sessao, turma, escola))
  }

  return (
    <div>
      <PageTitle
        icon={<ClipboardList size={24} />}
        title="Treinos"
        subtitle={aba === 'sessoes' ? 'Monte a ficha do treino: ela sai pronta pra imprimir ou salvar em PDF.' : 'Exercícios prontos pra reusar em qualquer sessão.'}
        action={aba === 'sessoes' ? <Button variant="gold" onClick={nova}><Plus size={16} /> Nova sessão</Button> : undefined}
      />

      <div className="flex gap-2 mb-4">
        <button className={abaBtnClass(aba === 'sessoes')} onClick={() => setAba('sessoes')}><ClipboardList size={15} /> Sessões</button>
        <button className={abaBtnClass(aba === 'biblioteca')} onClick={() => setAba('biblioteca')}><BookOpen size={15} /> Biblioteca</button>
      </div>

      {aba === 'sessoes' && turmasAtivas.length > 0 && (
        <div className="mb-3">
          {turmasAtivas.map((t) => (
            <SugestaoFocoCard key={t.id} turma={t} sessoesDaTurma={sessoesTreino.filter((s) => s.turmaId === t.id)} />
          ))}
        </div>
      )}

      {aba === 'biblioteca' ? (
        <BibliotecaExercicios />
      ) : sessoes.length === 0 ? (
        <EmptyState icon={<ClipboardList size={28} />} text="Nenhuma sessão de treino montada ainda." action={<Button variant="gold" onClick={nova}><Plus size={16} /> Nova sessão</Button>} />
      ) : (
        <div className="flex flex-col gap-2">
          {sessoes.map((s) => {
            const turma = mapaTurma[s.turmaId]
            const escola = turma ? mapaEscola[turma.escolaId] : undefined
            const temaPrincipal = TEMAS_TREINO.find((t) => t.id === s.temas[0])
            const preenchidos = s.quadros.filter((q) => q.nome || q.objetivo || (q.desenho && q.desenho.elementos.length > 0)).length
            return (
              <Card key={s.id} className="flex items-center justify-between gap-3 flex-wrap">
                <button className="text-left flex-1 min-w-0" onClick={() => navigate(`/treinos/${s.id}`)}>
                  <div className="font-semibold">
                    {turma?.nome ?? 'Turma apagada'} {escola ? `— ${escola.nome}` : ''}
                  </div>
                  <div className="text-xs text-[var(--rd-text-dim)]">
                    {formatDate(s.data)}{s.numeroSessao ? ` · Sessão ${s.numeroSessao}` : ''} · {preenchidos}/11 quadros preenchidos
                    {temaPrincipal ? ` · ${temaPrincipal.label}` : ''}
                  </div>
                </button>
                <div className="flex gap-2 shrink-0">
                  <button className="rd-btn !p-2" title="Imprimir / salvar em PDF" onClick={() => imprimir(s.id)}><Printer size={16} /></button>
                  <button className="rd-btn !p-2" title="Apagar" onClick={() => { if (confirm('Apagar esta sessão de treino?')) excluirSessaoTreino(s.id) }}><Trash2 size={16} /></button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
