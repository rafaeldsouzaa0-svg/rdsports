// Cartão de sugestão de foco (pedido 31/10/2026: "fiz 3 treinos seguidos de
// ataque, sugerir fazer treino de saque e recepção") — mostra o aviso e já
// oferece criar a próxima sessão dessa turma com o tema/problema de jogo
// sugeridos pré-marcados (o treinador ainda pode trocar tudo na tela
// seguinte, isso só economiza o primeiro toque).
import { Lightbulb } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { Card, Button } from './ui'
import { sugerirProximoFoco, temaLabel } from '../sugestaoTreino'
import type { SessaoTreino, Turma } from '../types'

export function SugestaoFocoCard({ turma, sessoesDaTurma }: { turma: Turma; sessoesDaTurma: SessaoTreino[] }) {
  const navigate = useNavigate()
  const criarSessaoTreino = useStore((s) => s.criarSessaoTreino)
  const atualizarSessaoTreino = useStore((s) => s.atualizarSessaoTreino)

  const sugestao = sugerirProximoFoco(sessoesDaTurma)
  if (!sugestao) return null

  function iniciarComSugestao() {
    const sessao = criarSessaoTreino(turma.id)
    const patch: Partial<Pick<SessaoTreino, 'temas' | 'problemaJogo'>> = {}
    if (sugestao!.temaSugeridoId) patch.temas = [sugestao!.temaSugeridoId]
    if (sugestao!.problemaSugerido) patch.problemaJogo = sugestao!.problemaSugerido
    if (Object.keys(patch).length > 0) atualizarSessaoTreino(sessao.id, patch)
    navigate(`/treinos/${sessao.id}`)
  }

  return (
    <Card className="mb-2 flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: 'var(--rd-gold)', background: 'rgba(212,175,55,.08)' }}>
      <div className="flex items-start gap-2.5 min-w-0">
        <Lightbulb size={18} className="rd-accent-text shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="font-semibold text-sm">💡 Sugestão de foco — {turma.nome}</div>
          <div className="text-xs text-[var(--rd-text-dim)]">
            {sugestao.motivo}. Que tal variar{sugestao.temaSugeridoId ? ` pra "${temaLabel(sugestao.temaSugeridoId)}"` : ''}
            {sugestao.problemaSugerido ? `${sugestao.temaSugeridoId ? ' e' : ''} "${sugestao.problemaSugerido}"` : ''}?
          </div>
        </div>
      </div>
      <Button variant="gold" onClick={iniciarComSugestao}>Nova sessão com essa sugestão</Button>
    </Card>
  )
}
