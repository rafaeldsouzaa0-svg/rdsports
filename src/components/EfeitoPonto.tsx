// Etiqueta que aparece por cima do placar quando marcamos ponto de ataque,
// ace ou bloqueio (ver src/efeitoPonto.ts). Não bloqueia toque nenhum
// (pointer-events: none) — o próximo lance pode ser marcado na hora.
// A cada ponto novo, a `chave` muda e o React recria a etiqueta, então a
// animação recomeça do início mesmo com pontos seguidos.
import { Hand, Target, Zap } from 'lucide-react'
import { TEXTO_DESTAQUE, type TipoDestaque } from '../efeitoPonto'

const ICONE: Record<TipoDestaque, typeof Zap> = { ataque: Zap, ace: Target, bloqueio: Hand }

export default function EfeitoPontoDestaque({ tipo, chave }: { tipo: TipoDestaque; chave: number }) {
  const Icone = ICONE[tipo]
  return (
    <div className="rd-efeito-ponto-area" aria-hidden="true">
      <div key={chave} className="rd-efeito-ponto">
        <Icone size={18} strokeWidth={2.5} />
        {TEXTO_DESTAQUE[tipo]}
      </div>
    </div>
  )
}
