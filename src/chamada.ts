// Chamada dos treinos e frequência das atletas (pedido 21/11/2026).
// Funções puras (sem tela nem banco) pra dar pra testar em
// scripts/test-chamada.mjs.
import { v5 as uuidV5 } from 'uuid'
import type { ChamadaTreino } from './types'

// "Espaço de nomes" fixo pra gerar os ids das chamadas. Nunca mudar: os ids
// já salvos dependem dele.
const NAMESPACE_CHAMADA = '6f1c9a52-3d0e-4b7a-9a43-5e2b8f7d1c10'

/** Mesma turma + mesmo dia = sempre o mesmo id, em qualquer aparelho. */
export function idDaChamada(turmaId: string, data: string): string {
  return uuidV5(`${turmaId}|${data}`, NAMESPACE_CHAMADA)
}

/** Marca (true = veio, false = faltou) ou desmarca (null) uma atleta na
 *  chamada do dia, criando a chamada se ainda não existir. Devolve a lista
 *  nova de chamadas (não altera a original). */
export function marcarNaChamada(
  chamadas: ChamadaTreino[], turmaId: string, data: string, atletaId: string, valor: boolean | null, agora: string,
): ChamadaTreino[] {
  const id = idDaChamada(turmaId, data)
  const existente = chamadas.find((c) => c.id === id)
  const base: ChamadaTreino = existente
    ? { ...existente, deletedAt: undefined }
    : { id, turmaId, data, presencas: {}, createdAt: agora }
  const presencas = { ...(existente && !existente.deletedAt ? base.presencas : {}) }
  if (valor === null) delete presencas[atletaId]
  else presencas[atletaId] = valor
  const nova: ChamadaTreino = { ...base, presencas, updatedAt: agora }
  return existente ? chamadas.map((c) => (c.id === id ? nova : c)) : [...chamadas, nova]
}

/** Marca todas de uma vez como presentes (só as que ainda não foram marcadas). */
export function marcarTodasPresentes(
  chamadas: ChamadaTreino[], turmaId: string, data: string, atletaIds: string[], agora: string,
): ChamadaTreino[] {
  const atual = chamadaDoDia(chamadas, turmaId, data)?.presencas ?? {}
  let resultado = chamadas
  for (const id of atletaIds) {
    if (atual[id] === undefined) resultado = marcarNaChamada(resultado, turmaId, data, id, true, agora)
  }
  return resultado
}

export function chamadaDoDia(chamadas: ChamadaTreino[], turmaId: string, data: string): ChamadaTreino | undefined {
  const c = chamadas.find((x) => x.id === idDaChamada(turmaId, data))
  return c && !c.deletedAt ? c : undefined
}

export interface Frequencia {
  presencas: number
  faltas: number
  /** Treinos em que a atleta foi marcada (veio + faltou). */
  total: number
  /** 0 a 100, arredondado; null quando ainda não tem nenhuma marcação. */
  percentual: number | null
}

/** Frequência de cada atleta numa turma (ou em todas, com `turmaId` null),
 *  contando só os dias em que ela foi marcada. `desde` (AAAA-MM-DD,
 *  opcional) limita a um período. */
export function frequenciaPorAtleta(chamadas: ChamadaTreino[], turmaId: string | null, desde?: string): Record<string, Frequencia> {
  const resultado: Record<string, Frequencia> = {}
  for (const c of chamadas) {
    if ((turmaId && c.turmaId !== turmaId) || c.deletedAt) continue
    if (desde && c.data < desde) continue
    for (const [atletaId, veio] of Object.entries(c.presencas)) {
      const f = resultado[atletaId] ?? (resultado[atletaId] = { presencas: 0, faltas: 0, total: 0, percentual: null })
      if (veio) f.presencas += 1
      else f.faltas += 1
      f.total += 1
    }
  }
  for (const f of Object.values(resultado)) f.percentual = f.total ? Math.round((f.presencas / f.total) * 100) : null
  return resultado
}

/** Dias com chamada da turma, do mais recente pro mais antigo. */
export function historicoChamadas(chamadas: ChamadaTreino[], turmaId: string): ChamadaTreino[] {
  return chamadas
    .filter((c) => c.turmaId === turmaId && !c.deletedAt && Object.keys(c.presencas).length > 0)
    .sort((a, b) => b.data.localeCompare(a.data))
}
