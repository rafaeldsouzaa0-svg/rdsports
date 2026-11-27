// Zona de destino do ataque e do saque (pedido 27/11/2026): no scout ao vivo
// aparece a quadrinha do adversário com as 6 zonas e o professor toca em
// pra onde a bola foi (opcional). 9 zonas, igual à prancheta do Rafael e ao
// Data Volley: rede em cima, 4 3 2 / 7 8 9 / 5 6 1. Guardada em
// `RallyEvento.zona` ('1'..'9') e na coluna `rally_eventos.zona` do Supabase.
import type { FundamentoScout, SetPartida } from './types'

/** Fundamentos em que a quadrinha aparece. */
export const FUNDAMENTOS_COM_ZONA: FundamentoScout[] = ['ataque', 'saque']

/** Desenho da quadrinha (pedido 27/11/2026, foto da prancheta): rede em
 *  cima; 7 8 9 é a faixa do meio, entre a rede e o fundo. */
export const DESENHO_QUADRA: number[][] = [
  [4, 3, 2], // perto da rede
  [7, 8, 9], // meio
  [5, 6, 1], // fundo
]
export const TOTAL_ZONAS = 9

export function zonaValida(z: unknown): z is string {
  const n = Number(z)
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_ZONAS
}

export function zonaParaBanco(z: string | undefined): number | null {
  return zonaValida(z) ? Number(z) : null
}

export function zonaDoBanco(n: number | string | null | undefined): string | undefined {
  return zonaValida(n) ? String(Number(n)) : undefined
}

/** `pctPonto` = bolas daquela zona que viraram ponto. Mostramos isso (e não
 *  a eficiência) porque bola pra fora quase nunca tem zona marcada, então a
 *  eficiência por zona ficaria melhor do que é de verdade. */
export interface LinhaZona { zona: number; total: number; pontos: number; erros: number; eficiencia: number; pctPonto: number; pct: number }
export interface DesempenhoZonas { porZona: Record<number, LinhaZona>; comZona: number; semZona: number }

/** Quantas bolas foram pra cada zona e como terminaram — só lances NOSSOS
 *  do fundamento escolhido (e da atleta, se informada). `pct` = parte das
 *  bolas com zona marcada que foram pra aquela zona. */
export function desempenhoPorZona(sets: SetPartida[], fundamento: FundamentoScout, atletaId?: string): DesempenhoZonas {
  const porZona: Record<number, LinhaZona> = {}
  for (let z = 1; z <= TOTAL_ZONAS; z++) porZona[z] = { zona: z, total: 0, pontos: 0, erros: 0, eficiencia: 0, pctPonto: 0, pct: 0 }
  let comZona = 0, semZona = 0
  for (const set of sets) {
    for (const rally of set.rallies) {
      for (const e of rally.eventos) {
        if (e.ladoResponsavel === 'ADVERSARIO' || e.fundamento !== fundamento) continue
        if (atletaId && e.atletaId !== atletaId) continue
        if (!zonaValida(e.zona)) { semZona += 1; continue }
        const l = porZona[Number(e.zona)]
        comZona += 1
        l.total += 1
        if (e.resultado === 'ACERTO') l.pontos += 1
        if (e.resultado === 'ERRO') l.erros += 1
      }
    }
  }
  for (let z = 1; z <= TOTAL_ZONAS; z++) {
    const l = porZona[z]
    l.eficiencia = l.total > 0 ? Math.round(((l.pontos - l.erros) / l.total) * 100) : 0
    l.pctPonto = l.total > 0 ? Math.round((l.pontos / l.total) * 100) : 0
    l.pct = comZona > 0 ? Math.round((l.total / comZona) * 100) : 0
  }
  return { porZona, comZona, semZona }
}

/** Grava a zona no lance que acabou de ser marcado (o último evento do
 *  último rally, igual `carimbarVideo`). Sem zona escolhida, não muda nada. */
export function carimbarZona<T extends { rallies: { eventos: { zona?: string }[] }[] }>(set: T, zona: string | null | undefined): T {
  if (!zonaValida(zona)) return set
  const ultimo = set.rallies[set.rallies.length - 1]
  if (!ultimo || ultimo.eventos.length === 0) return set
  const eventos = ultimo.eventos.map((e, i) => (i === ultimo.eventos.length - 1 ? { ...e, zona: String(Number(zona)) } : e))
  return { ...set, rallies: [...set.rallies.slice(0, -1), { ...ultimo, eventos }] }
}

/** Separa as linhas de `rally_eventos` que vão pra nuvem: as que têm zona e
 *  as que não têm (essas vão sem a coluna `zona`, pra o envio não apagar uma
 *  zona que já esteja salva na nuvem). */
export function separarPorZona<T extends Record<string, unknown>>(linhas: T[]): { comZona: T[]; semZona: T[] } {
  const comZona: T[] = []
  const semZona: T[] = []
  for (const l of linhas) ('zona' in l ? comZona : semZona).push(l)
  return { comZona, semZona }
}
