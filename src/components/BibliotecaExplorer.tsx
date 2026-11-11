// Explorador da Biblioteca de exercícios (pedido 31/10/2026): filtros +
// lista de cards, reaproveitado em dois lugares — a aba "Biblioteca" (modo
// "gerenciar": editar/apagar) e o seletor que abre dentro de um quadro da
// ficha de treino (modo "escolher": tocar escolhe). A lógica de filtro e de
// relevância fica aqui uma vez só, pra não desalinhar entre os dois usos.
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  GRUPOS_QUADRO_ORDEM, GRUPOS_TEMAS_TREINO, TEMAS_TREINO, CONDICIONANTES_TREINO,
  type ExercicioBiblioteca, type GrupoQuadroTreino,
} from '../types'
import { QuadroDesenhoPreview } from './QuadroDesenhoEditor'

function chipBtnClass(ativo: boolean): string {
  return `text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
    ativo ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)] hover:bg-black/5 dark:hover:bg-white/10'
  }`
}

/** O que a sessão/quadro atual já tem marcado — usado só pra ORDENAR a
 *  lista (os mais parecidos primeiro) e mostrar o selo "★ combina"; nunca
 *  esconde exercícios que não combinam, só os deixa mais pra baixo. */
export interface ContextoRelevancia {
  grupoAlvo?: GrupoQuadroTreino
  temasSessao: string[]
  problemaJogoSessao?: string
  condicionantesSessao: string[]
}

function pontuar(ex: ExercicioBiblioteca, ctx?: ContextoRelevancia): number {
  if (!ctx) return 0
  let pontos = 0
  if (ctx.grupoAlvo && ex.grupo === ctx.grupoAlvo) pontos += 3
  pontos += ex.temas.filter((t) => ctx.temasSessao.includes(t)).length
  if (ctx.problemaJogoSessao && ex.problemaJogo && ex.problemaJogo === ctx.problemaJogoSessao) pontos += 2
  pontos += ex.condicionantes.filter((c) => ctx.condicionantesSessao.includes(c)).length
  return pontos
}

export function BibliotecaExplorer({
  exercicios, modo, contexto, onEscolher, onEditar, onApagar,
}: {
  exercicios: ExercicioBiblioteca[]
  modo: 'gerenciar' | 'escolher'
  contexto?: ContextoRelevancia
  onEscolher?: (ex: ExercicioBiblioteca) => void
  onEditar?: (ex: ExercicioBiblioteca) => void
  onApagar?: (ex: ExercicioBiblioteca) => void
}) {
  const [busca, setBusca] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState<GrupoQuadroTreino | null>(null)
  const [filtroTemas, setFiltroTemas] = useState<string[]>([])
  const [filtroCondicionantes, setFiltroCondicionantes] = useState<string[]>([])
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)

  function alternarFiltroTema(id: string) {
    setFiltroTemas((atual) => (atual.includes(id) ? atual.filter((t) => t !== id) : [...atual, id]))
  }
  function alternarFiltroCondicionante(id: string) {
    setFiltroCondicionantes((atual) => (atual.includes(id) ? atual.filter((c) => c !== id) : [...atual, id]))
  }

  const buscaNorm = busca.trim().toLowerCase()
  const filtrados = exercicios.filter((ex) => {
    if (buscaNorm && !ex.nome.toLowerCase().includes(buscaNorm) && !(ex.objetivo ?? '').toLowerCase().includes(buscaNorm)) return false
    // Parte do treino: exercício "genérico" (sem grupo marcado) serve pra
    // qualquer parte, então continua aparecendo mesmo com esse filtro ativo.
    if (filtroGrupo && ex.grupo && ex.grupo !== filtroGrupo) return false
    if (filtroTemas.length > 0 && !ex.temas.some((t) => filtroTemas.includes(t))) return false
    if (filtroCondicionantes.length > 0 && !ex.condicionantes.some((c) => filtroCondicionantes.includes(c))) return false
    return true
  })

  const ordenados = [...filtrados].sort((a, b) => {
    const pa = pontuar(a, contexto)
    const pb = pontuar(b, contexto)
    if (pa !== pb) return pb - pa
    if (modo === 'gerenciar') return b.updatedAt > a.updatedAt ? 1 : -1
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })

  const temFiltroAtivo = !!filtroGrupo || filtroTemas.length > 0 || filtroCondicionantes.length > 0

  return (
    <div>
      <input
        className="rd-input mb-2 text-sm"
        placeholder="Buscar por nome ou objetivo..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <button className="text-xs font-semibold text-[var(--rd-text-dim)] mb-3 underline" onClick={() => setFiltrosAbertos((v) => !v)}>
        {filtrosAbertos ? 'Esconder filtros' : 'Filtrar por tema/parte/condicionante'}{temFiltroAtivo && !filtrosAbertos ? ' (ativos)' : ''}
      </button>

      {filtrosAbertos && (
        <div className="mb-3 flex flex-col gap-2.5 rounded-lg border p-2.5" style={{ borderColor: 'var(--rd-border)' }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--rd-text-dim)] mb-1">Parte do treino</div>
            <div className="flex flex-wrap gap-1.5">
              {GRUPOS_QUADRO_ORDEM.map(({ grupo, label }) => (
                <button key={grupo} className={chipBtnClass(filtroGrupo === grupo)} onClick={() => setFiltroGrupo(filtroGrupo === grupo ? null : grupo)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {GRUPOS_TEMAS_TREINO.map((g) => (
            <div key={g.id}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--rd-text-dim)] mb-1">{g.id} — {g.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {TEMAS_TREINO.filter((t) => t.grupo === g.id).map((t) => (
                  <button key={t.id} className={chipBtnClass(filtroTemas.includes(t.id))} onClick={() => alternarFiltroTema(t.id)}>{t.label}</button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--rd-text-dim)] mb-1">Condicionantes</div>
            <div className="flex flex-wrap gap-1.5">
              {CONDICIONANTES_TREINO.map((c) => (
                <button key={c.id} className={chipBtnClass(filtroCondicionantes.includes(c.id))} onClick={() => alternarFiltroCondicionante(c.id)}>{c.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {ordenados.length === 0 ? (
        <p className="text-sm text-[var(--rd-text-dim)] py-4 text-center">Nenhum exercício encontrado com esses filtros.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {ordenados.map((ex) => {
            const pontos = pontuar(ex, contexto)
            const grupoLabel = GRUPOS_QUADRO_ORDEM.find((g) => g.grupo === ex.grupo)?.label
            const conteudo = (
              <>
                {ex.desenho && ex.desenho.elementos.length > 0 && (
                  <div className="mb-1.5 max-h-[90px] overflow-hidden rounded">
                    <QuadroDesenhoPreview desenho={ex.desenho} />
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-semibold truncate">{ex.nome || '(sem nome)'}</div>
                  {contexto && pontos > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'var(--rd-gold)', color: '#1a1300' }}>
                      ★ combina
                    </span>
                  )}
                </div>
                {ex.objetivo && <div className="text-[10px] text-[var(--rd-text-dim)] truncate">{ex.objetivo}</div>}
                <div className="flex flex-wrap gap-1 mt-1">
                  {grupoLabel && <span className="text-[9px] px-1.5 py-0.5 rounded-full border" style={{ borderColor: 'var(--rd-border)' }}>{grupoLabel}</span>}
                  {ex.tempoMin != null && <span className="text-[9px] px-1.5 py-0.5 rounded-full border" style={{ borderColor: 'var(--rd-border)' }}>{ex.tempoMin} min</span>}
                </div>
              </>
            )
            if (modo === 'escolher') {
              return (
                <button
                  key={ex.id}
                  className="rounded-lg border p-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
                  style={{ borderColor: 'var(--rd-border)' }}
                  onClick={() => onEscolher?.(ex)}
                >
                  {conteudo}
                </button>
              )
            }
            return (
              <div key={ex.id} className="rounded-lg border p-2" style={{ borderColor: 'var(--rd-border)' }}>
                {conteudo}
                <div className="flex gap-2 mt-2">
                  <button className="rd-btn !p-1.5 text-[10px]" onClick={() => onEditar?.(ex)}><Pencil size={12} /> Editar</button>
                  <button className="rd-btn !p-1.5 text-[10px]" onClick={() => onApagar?.(ex)}><Trash2 size={12} /> Apagar</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
