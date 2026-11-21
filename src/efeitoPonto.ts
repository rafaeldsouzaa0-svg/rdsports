// Efeito visual quando um ponto é marcado no scout (pedido 21/11/2026:
// "um efeito quando marcar ponto, por exemplo de ataque, ace e bloqueio").
//
// Esta parte só DECIDE qual efeito mostrar, comparando o set antes e depois da
// marcação — sem nada de tela, pra dar pra testar (scripts/test-efeito-ponto.mjs).
// Quem desenha é components/EfeitoPonto.tsx.
//
// Regras:
// - Só quando o placar SOBE (Desfazer e correções não disparam nada).
// - Ponto NOSSO de ataque, ace ou bloqueio → destaque (etiqueta dourada).
// - Qualquer outro ponto (erro do adversário, bola de graça, ponto deles...)
//   → só um "pulo" discreto no número do placar de quem pontuou.
import type { SetPartida } from './types'

export type TipoDestaque = 'ataque' | 'ace' | 'bloqueio'

export interface EfeitoPonto {
  /** Quem ganhou o ponto. */
  lado: 'CASA' | 'ADVERSARIO'
  /** Preenchido só nos pontos nossos que merecem destaque. */
  destaque: TipoDestaque | null
}

export const TEXTO_DESTAQUE: Record<TipoDestaque, string> = {
  ataque: 'Ponto de ataque!',
  ace: 'Ace!',
  bloqueio: 'Ponto de bloqueio!',
}

export function detectarEfeitoPonto(antes: SetPartida | undefined, depois: SetPartida): EfeitoPonto | null {
  const casaAntes = antes?.placarCasa ?? 0
  const advAntes = antes?.placarAdversario ?? 0
  const subiuCasa = depois.placarCasa > casaAntes
  const subiuAdv = depois.placarAdversario > advAntes
  if (!subiuCasa && !subiuAdv) return null
  // Marcação por voz pode somar pontos pros dois lados de uma vez: vale o
  // último lance, que é o que acabou de acontecer.
  const ultimoRally = depois.rallies[depois.rallies.length - 1]
  const fechou = ultimoRally?.eventos.filter((e) => e.encerraRally !== null).pop()
  const lado: 'CASA' | 'ADVERSARIO' = fechou?.encerraRally ?? (subiuCasa ? 'CASA' : 'ADVERSARIO')
  if (lado !== 'CASA' || !fechou || fechou.ladoResponsavel === 'ADVERSARIO' || fechou.resultado !== 'ACERTO') {
    return { lado, destaque: null }
  }
  if (fechou.fundamento === 'ataque') return { lado, destaque: 'ataque' }
  if (fechou.fundamento === 'saque') return { lado, destaque: 'ace' }
  if (fechou.fundamento === 'bloqueio') return { lado, destaque: 'bloqueio' }
  return { lado, destaque: null }
}
