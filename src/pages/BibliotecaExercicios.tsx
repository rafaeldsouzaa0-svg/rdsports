// Aba "Biblioteca" de Treinos (pedido 31/10/2026: "banco de exercícios") —
// exercícios prontos, independentes de qualquer sessão, com as mesmas
// marcações de tema/problema de jogo/condicionantes da ficha, pra filtrar
// bem e sugerir o exercício certo na hora de montar uma sessão nova
// (ver `BibliotecaPicker`, usado em SessaoTreinoForm).
import { useState } from 'react'
import { BookOpen, Plus } from 'lucide-react'
import { useStore } from '../store'
import { Button, Field, EmptyState } from '../components/ui'
import {
  GRUPOS_QUADRO_ORDEM, GRUPOS_TEMAS_TREINO, TEMAS_TREINO, PROBLEMAS_JOGO_SUGERIDOS, CONDICIONANTES_TREINO,
  type ExercicioBiblioteca, type QuadroDesenho,
} from '../types'
import { QuadroDesenhoEditor, QuadroDesenhoPreview } from '../components/QuadroDesenhoEditor'
import { BibliotecaExplorer } from '../components/BibliotecaExplorer'

function chipBtnClass(ativo: boolean): string {
  return `text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
    ativo ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)] hover:bg-black/5 dark:hover:bg-white/10'
  }`
}

function vazio(ex: ExercicioBiblioteca): boolean {
  return !ex.nome.trim() && !ex.objetivo && !ex.comoFunciona && !ex.desenho && !ex.problemaJogo && !ex.grupo
    && ex.temas.length === 0 && ex.condicionantes.length === 0
}

export default function BibliotecaExercicios() {
  const bibliotecaExercicios = useStore((s) => s.bibliotecaExercicios)
  const addExercicioBiblioteca = useStore((s) => s.addExercicioBiblioteca)
  const atualizarExercicioBiblioteca = useStore((s) => s.atualizarExercicioBiblioteca)
  const excluirExercicioBiblioteca = useStore((s) => s.excluirExercicioBiblioteca)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [desenhando, setDesenhando] = useState(false)

  const exercicios = bibliotecaExercicios.filter((e) => !e.deletedAt)
  const editando = exercicios.find((e) => e.id === editandoId) ?? null

  function novo() {
    const ex = addExercicioBiblioteca({ nome: '', temas: [], condicionantes: [] })
    setEditandoId(ex.id)
  }

  function fecharEdicao() {
    if (editando && vazio(editando)) excluirExercicioBiblioteca(editando.id)
    setEditandoId(null)
  }

  function alternarTema(ex: ExercicioBiblioteca, temaId: string) {
    const jaTem = ex.temas.includes(temaId)
    atualizarExercicioBiblioteca(ex.id, { temas: jaTem ? ex.temas.filter((t) => t !== temaId) : [...ex.temas, temaId] })
  }

  function alternarCondicionante(ex: ExercicioBiblioteca, condId: string) {
    const jaTem = ex.condicionantes.includes(condId)
    atualizarExercicioBiblioteca(ex.id, { condicionantes: jaTem ? ex.condicionantes.filter((c) => c !== condId) : [...ex.condicionantes, condId] })
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm text-[var(--rd-text-dim)] max-w-md">
          Guarde exercícios prontos aqui pra reusar em qualquer sessão — cada quadro da ficha pode puxar direto daqui.
        </p>
        <Button variant="gold" onClick={novo}><Plus size={16} /> Novo exercício</Button>
      </div>

      {exercicios.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} />}
          text="Nenhum exercício na biblioteca ainda."
          action={<Button variant="gold" onClick={novo}><Plus size={16} /> Novo exercício</Button>}
        />
      ) : (
        <BibliotecaExplorer
          exercicios={exercicios}
          modo="gerenciar"
          onEditar={(ex) => setEditandoId(ex.id)}
          onApagar={(ex) => { if (confirm(`Apagar "${ex.nome || 'exercício sem nome'}" da biblioteca?`)) excluirExercicioBiblioteca(ex.id) }}
        />
      )}

      {editando && (
        <div className="fixed inset-0 z-[90] bg-black/70 flex items-start sm:items-center justify-center p-3 overflow-y-auto" onClick={fecharEdicao}>
          <div className="rd-card p-4 w-full max-w-lg my-6" onClick={(e) => e.stopPropagation()}>
            <div className="font-bold text-sm mb-3">Exercício da biblioteca</div>

            <Field label="Nome *">
              <input className="rd-input" placeholder="Nome do exercício" value={editando.nome} onChange={(e) => atualizarExercicioBiblioteca(editando.id, { nome: e.target.value })} />
            </Field>
            <Field label="Objetivo">
              <input className="rd-input" placeholder="O que este exercício busca" value={editando.objetivo ?? ''} onChange={(e) => atualizarExercicioBiblioteca(editando.id, { objetivo: e.target.value })} />
            </Field>
            <Field label="Tempo (min)">
              <input type="number" min={0} className="rd-input" value={editando.tempoMin ?? ''} onChange={(e) => atualizarExercicioBiblioteca(editando.id, { tempoMin: e.target.value ? Number(e.target.value) : undefined })} />
            </Field>
            <Field label="Como funciona (opcional)">
              <textarea className="rd-input" rows={2} value={editando.comoFunciona ?? ''} onChange={(e) => atualizarExercicioBiblioteca(editando.id, { comoFunciona: e.target.value })} />
            </Field>

            <button className="rd-btn text-xs mb-3" onClick={() => setDesenhando(true)}>
              {editando.desenho ? 'Editar desenho' : '✏️ Desenhar na quadra'}
            </button>
            {editando.desenho && editando.desenho.elementos.length > 0 && (
              <div className="mb-3 max-w-[220px]"><QuadroDesenhoPreview desenho={editando.desenho} /></div>
            )}

            <div className="font-bold text-sm mb-1">Parte do treino (opcional)</div>
            <div className="text-[11px] text-[var(--rd-text-dim)] mb-1.5">Sem marcar = aparece sugerido em qualquer quadro.</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {GRUPOS_QUADRO_ORDEM.map(({ grupo, label }) => (
                <button key={grupo} className={chipBtnClass(editando.grupo === grupo)} onClick={() => atualizarExercicioBiblioteca(editando.id, { grupo: editando.grupo === grupo ? undefined : grupo })}>
                  {label}
                </button>
              ))}
            </div>

            <div className="font-bold text-sm mb-1.5">Temas</div>
            {GRUPOS_TEMAS_TREINO.map((g) => (
              <div key={g.id} className="mb-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--rd-text-dim)] mb-1">{g.id} — {g.label}</div>
                <div className="flex flex-wrap gap-2">
                  {TEMAS_TREINO.filter((t) => t.grupo === g.id).map((t) => (
                    <button key={t.id} className={chipBtnClass(editando.temas.includes(t.id))} onClick={() => alternarTema(editando, t.id)}>{t.label}</button>
                  ))}
                </div>
              </div>
            ))}

            <div className="font-bold text-sm mb-1.5 mt-1">Problema de jogo</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {PROBLEMAS_JOGO_SUGERIDOS.map((p) => (
                <button key={p} className={chipBtnClass(editando.problemaJogo === p)} onClick={() => atualizarExercicioBiblioteca(editando.id, { problemaJogo: editando.problemaJogo === p ? undefined : p })}>{p}</button>
              ))}
            </div>

            <div className="font-bold text-sm mb-1.5">Condicionantes</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {CONDICIONANTES_TREINO.map((c) => (
                <button key={c.id} className={chipBtnClass(editando.condicionantes.includes(c.id))} onClick={() => alternarCondicionante(editando, c.id)}>{c.label}</button>
              ))}
            </div>

            <div className="flex justify-end">
              <Button variant="gold" onClick={fecharEdicao}>Pronto</Button>
            </div>
          </div>
        </div>
      )}

      {desenhando && editando && (
        <QuadroDesenhoEditor
          titulo={editando.nome || 'Exercício da biblioteca'}
          desenhoInicial={editando.desenho}
          onFechar={() => setDesenhando(false)}
          onSalvar={(desenho: QuadroDesenho) => {
            atualizarExercicioBiblioteca(editando.id, { desenho })
            setDesenhando(false)
          }}
        />
      )}
    </div>
  )
}
