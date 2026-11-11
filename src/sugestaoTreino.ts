// Sugestão de foco do próximo treino (pedido 31/10/2026: "fiz 3 treinos
// seguidos de ataque, sugerir fazer treino de saque e recepção") — olha o
// histórico de sessões de UMA turma (cada turma evolui separado) e, se as
// últimas sessões repetirem o mesmo tema principal e/ou o mesmo "problema
// de jogo", sugere o que está mais "atrasado" (nunca usado, ou usado há
// mais tempo) como próximo foco. Puramente derivado do histórico — nunca
// obriga nada, é só uma sugestão que o treinador pode ignorar.
import { TEMAS_TREINO, PROBLEMAS_JOGO_SUGERIDOS, type SessaoTreino } from './types'

/** Quantas sessões seguidas com o mesmo foco disparam a sugestão de variar
 *  (escolhido pelo Henrique: nem muito sensível, nem muito tolerante). */
export const MINIMO_REPETICOES_FOCO = 3

export interface SugestaoTreino {
  motivo: string
  temaRepetidoId?: string
  problemaRepetido?: string
  temaSugeridoId?: string
  problemaSugerido?: string
}

function temaLabel(id: string): string {
  return TEMAS_TREINO.find((t) => t.id === id)?.label ?? id
}

/** Ordena candidatos por "menos usado recentemente primeiro" — nunca usado
 *  vem antes de qualquer um já usado, e entre os já usados o mais antigo
 *  vem primeiro. `ultimoUso` é um mapa id/valor → última data (string ISO
 *  "AAAA-MM-DD", comparável diretamente). */
function ordenarPorMenosRecente<T>(candidatos: T[], chaveDe: (c: T) => string, ultimoUso: Map<string, string>): T[] {
  return [...candidatos].sort((a, b) => {
    const da = ultimoUso.get(chaveDe(a))
    const db = ultimoUso.get(chaveDe(b))
    if (!da && !db) return 0
    if (!da) return -1
    if (!db) return 1
    return da < db ? -1 : da > db ? 1 : 0
  })
}

/** Calcula a sugestão pra UMA turma a partir do histórico completo de
 *  sessões dela (não precisa vir pré-filtrado por turma — filtra aqui).
 *  Retorna `null` quando não há histórico suficiente (menos de
 *  `MINIMO_REPETICOES_FOCO` sessões com tema/problema marcado) ou quando
 *  as últimas sessões já têm foco variado (nada a sugerir). */
export function sugerirProximoFoco(sessoesDaTurma: SessaoTreino[]): SugestaoTreino | null {
  const validas = sessoesDaTurma
    .filter((s) => !s.deletedAt && (s.temas.length > 0 || s.problemaJogo))
    .sort((a, b) => (a.data !== b.data ? (a.data < b.data ? -1 : 1) : (a.createdAt ?? '') < (b.createdAt ?? '') ? -1 : 1))

  if (validas.length < MINIMO_REPETICOES_FOCO) return null

  const ultimas = validas.slice(-MINIMO_REPETICOES_FOCO)

  const temasPrincipais = ultimas.map((s) => s.temas[0]).filter((t): t is string => !!t)
  const temaRepetidoId = temasPrincipais.length === MINIMO_REPETICOES_FOCO && temasPrincipais.every((t) => t === temasPrincipais[0])
    ? temasPrincipais[0]
    : undefined

  const problemas = ultimas.map((s) => s.problemaJogo).filter((p): p is string => !!p)
  const problemaRepetido = problemas.length === MINIMO_REPETICOES_FOCO && problemas.every((p) => p === problemas[0])
    ? problemas[0]
    : undefined

  if (!temaRepetidoId && !problemaRepetido) return null

  let temaSugeridoId: string | undefined
  if (temaRepetidoId) {
    const grupoRepetido = TEMAS_TREINO.find((t) => t.id === temaRepetidoId)?.grupo
    const ultimoUsoPorTema = new Map<string, string>()
    for (const s of validas) {
      for (const t of s.temas) {
        const atual = ultimoUsoPorTema.get(t)
        if (!atual || s.data > atual) ultimoUsoPorTema.set(t, s.data)
      }
    }
    const candidatos = TEMAS_TREINO.filter((t) => t.id !== temaRepetidoId)
    // Prioriza um grupo DIFERENTE do repetido (ex.: repetiu KI/ataque →
    // sugere algo de KII/saque-bloqueio-defesa), pra dar mais contraste —
    // só cai pro grupo igual se não sobrar nenhum candidato de outro grupo.
    const comGrupoDiferente = grupoRepetido ? candidatos.filter((t) => t.grupo !== grupoRepetido) : candidatos
    const pool = comGrupoDiferente.length > 0 ? comGrupoDiferente : candidatos
    temaSugeridoId = ordenarPorMenosRecente(pool, (t) => t.id, ultimoUsoPorTema)[0]?.id
  }

  let problemaSugerido: string | undefined
  if (problemaRepetido) {
    const ultimoUsoPorProblema = new Map<string, string>()
    for (const s of validas) {
      if (s.problemaJogo) {
        const atual = ultimoUsoPorProblema.get(s.problemaJogo)
        if (!atual || s.data > atual) ultimoUsoPorProblema.set(s.problemaJogo, s.data)
      }
    }
    const candidatos = PROBLEMAS_JOGO_SUGERIDOS.filter((p) => p !== problemaRepetido)
    problemaSugerido = ordenarPorMenosRecente(candidatos, (p) => p, ultimoUsoPorProblema)[0]
  }

  const partesMotivo: string[] = []
  if (temaRepetidoId) partesMotivo.push(`as últimas ${MINIMO_REPETICOES_FOCO} sessões focaram em "${temaLabel(temaRepetidoId)}"`)
  if (problemaRepetido) partesMotivo.push(`as últimas ${MINIMO_REPETICOES_FOCO} tiveram "${problemaRepetido}" como problema de jogo`)

  return {
    motivo: partesMotivo.join(' e '),
    temaRepetidoId,
    problemaRepetido,
    temaSugeridoId,
    problemaSugerido,
  }
}

export { temaLabel }
