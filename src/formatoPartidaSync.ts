// Formato e pontuação do jogo na nuvem (correção 21/11/2026).
//
// Bug: o banco não guardava o formato da partida. Na volta da nuvem o app
// "adivinhava" pelo ponto do set decisivo (25 = 3 sets obrigatórios, senão
// melhor de 5), então um jogo "Melhor de 3" voltava como "Melhor de 5". Os
// pontos configurados na papeleta (ex.: set de 21) também se perdiam.
// Agora o formato vai na coluna `formato` e os pontos em `pontos_por_set` e
// `pontos_set_decisivo`. Linhas antigas, sem `formato`, continuam sendo lidas
// do jeito antigo.
import { CONFIG_FORMATO, type FormatoPartida, type Partida } from './types'

const FORMATOS_VALIDOS = Object.keys(CONFIG_FORMATO) as FormatoPartida[]

/** Partida do aparelho → colunas da tabela `partidas`. */
export function colunasFormato(p: Pick<Partida, 'formato' | 'pontosSetNormal' | 'pontosSetDecisivo'>) {
  return {
    formato: p.formato,
    pontos_por_set: p.pontosSetNormal ?? null,
    pontos_set_decisivo: p.pontosSetDecisivo ?? CONFIG_FORMATO[p.formato]?.pontosDecisivo ?? 15,
  }
}

/** Linha da tabela `partidas` → formato e pontos no aparelho. */
export function formatoDaLinha(linha: { formato?: string | null; pontos_por_set?: number | null; pontos_set_decisivo?: number | null }):
  Pick<Partida, 'formato' | 'pontosSetNormal' | 'pontosSetDecisivo'> {
  const salvo = FORMATOS_VALIDOS.find((f) => f === linha.formato)
  if (!salvo) {
    // Linha antiga (antes da correção): só dá pra saber o que dava antes.
    return { formato: linha.pontos_set_decisivo === 25 ? 'TRES_OBRIGATORIOS_25' : 'MELHOR_DE_5' }
  }
  return {
    formato: salvo,
    ...(linha.pontos_por_set ? { pontosSetNormal: linha.pontos_por_set } : {}),
    ...(linha.pontos_set_decisivo ? { pontosSetDecisivo: linha.pontos_set_decisivo } : {}),
  }
}
