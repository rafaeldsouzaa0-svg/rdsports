// Ataque bloqueado (pedido 27/11/2026, ideia do Data Volley): continua sendo
// um ERRO de ataque (ponto do adversário, conta como erro na eficiência), mas
// com o detalhe "BLOQUEADO" — a mesma marca que uma versão antiga do app já
// gravava em `rally_eventos.detalhe` (junto com REDE e FORA). Assim dá pra
// separar "errou sozinha" de "parou no bloqueio".
import type { RallyEvento } from './types'

export const TIPO_BLOQUEADO = 'BLOQUEADO'

export function ehAtaqueBloqueado(e: Pick<RallyEvento, 'fundamento' | 'resultado' | 'tipoErro' | 'ladoResponsavel'>): boolean {
  return e.ladoResponsavel !== 'ADVERSARIO' && e.fundamento === 'ataque' && e.resultado === 'ERRO' && e.tipoErro === TIPO_BLOQUEADO
}

/** Grava o detalhe do erro no lance que acabou de ser marcado (último evento
 *  do último rally, igual `carimbarZona`). Sem detalhe, não muda nada. */
export function marcarDetalheErro<T extends { rallies: { eventos: { tipoErro?: string }[] }[] }>(set: T, tipoErro: string | null | undefined): T {
  if (!tipoErro) return set
  const ultimo = set.rallies[set.rallies.length - 1]
  if (!ultimo || ultimo.eventos.length === 0) return set
  const eventos = ultimo.eventos.map((e, i) => (i === ultimo.eventos.length - 1 ? { ...e, tipoErro } : e))
  return { ...set, rallies: [...set.rallies.slice(0, -1), { ...ultimo, eventos }] }
}
