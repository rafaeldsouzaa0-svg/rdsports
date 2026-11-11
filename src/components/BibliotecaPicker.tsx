// Seletor "Usar da biblioteca" (pedido 31/10/2026) — abre de dentro de um
// quadro da ficha de treino, já filtrado/ordenado pelos temas/problema de
// jogo/condicionantes que o treinador marcou pra essa sessão.
import { useStore } from '../store'
import type { ExercicioBiblioteca, GrupoQuadroTreino } from '../types'
import { BibliotecaExplorer } from './BibliotecaExplorer'

export function BibliotecaPicker({
  grupoAlvo, temasSessao, problemaJogoSessao, condicionantesSessao, onEscolher, onFechar,
}: {
  grupoAlvo: GrupoQuadroTreino
  temasSessao: string[]
  problemaJogoSessao?: string
  condicionantesSessao: string[]
  onEscolher: (ex: ExercicioBiblioteca) => void
  onFechar: () => void
}) {
  const bibliotecaExercicios = useStore((s) => s.bibliotecaExercicios)
  const exercicios = bibliotecaExercicios.filter((e) => !e.deletedAt)

  return (
    <div className="fixed inset-0 z-[95] bg-black/70 flex items-start sm:items-center justify-center p-3 overflow-y-auto" onClick={onFechar}>
      <div className="rd-card p-4 w-full max-w-2xl my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-sm">📚 Usar da biblioteca</div>
          <button className="rd-btn !p-1.5 text-xs" onClick={onFechar}>Fechar</button>
        </div>
        {exercicios.length === 0 ? (
          <p className="text-sm text-[var(--rd-text-dim)] py-4 text-center">
            A biblioteca ainda está vazia. Salve um exercício nela primeiro — "💾 Salvar na biblioteca" em qualquer quadro preenchido, ou na aba Biblioteca em Treinos.
          </p>
        ) : (
          <BibliotecaExplorer
            exercicios={exercicios}
            modo="escolher"
            contexto={{ grupoAlvo, temasSessao, problemaJogoSessao, condicionantesSessao }}
            onEscolher={onEscolher}
          />
        )}
      </div>
    </div>
  )
}
