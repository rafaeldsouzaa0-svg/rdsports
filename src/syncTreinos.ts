// Sincronização dos Treinos (sessões) e da Biblioteca de exercícios entre
// aparelhos — pedido do Rafael 11/11/2026: "no meu celular eu montei o treino
// do sub-10 e não tem mais nenhum outro, só que no tablet aparece outras
// coisas". Até aqui esses dois ficavam só no aparelho onde foram criados.
//
// Cada registro vai inteiro pra coluna `dados` (jsonb) das tabelas
// `sessoes_treino` / `exercicios_biblioteca`. As datas de atualização e de
// exclusão ficam em colunas próprias e NÃO vão dentro de `dados`: o banco só
// marca `updated_at` quando `dados` ou `deleted_at` mudam de verdade (trigger
// `marcar_updated_at_se_mudou`), e se a data de atualização fosse junto, todo
// reenvio pareceria uma mudança e os aparelhos ficariam "atualizando" a cópia
// um do outro sem parar.
import { supabase } from './supabaseClient'
import type { SessaoTreino, ExercicioBiblioteca } from './types'

type ComDatas = { id: string; updatedAt?: string; deletedAt?: string }

export interface LinhaSync {
  id: string
  owner_id: string
  dados: Record<string, unknown>
  deleted_at: string | null
}

/** Registro do aparelho → linha da tabela. */
export function paraLinha<T extends ComDatas>(item: T, ownerId: string): LinhaSync {
  const dados = JSON.parse(JSON.stringify(item)) as Record<string, unknown>
  delete dados.updatedAt
  delete dados.deletedAt
  return { id: item.id, owner_id: ownerId, dados, deleted_at: item.deletedAt ?? null }
}

/** Datas do banco vêm como "2026-11-11T23:41:26.20496+00:00"; no aparelho são
 *  "2026-11-11T23:41:26.204Z". A mesclagem compara as datas como texto, então
 *  tudo é convertido pro formato do aparelho antes. */
export function normalizarData(valor: string | null | undefined): string | undefined {
  if (!valor) return undefined
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** Linha da tabela → registro do aparelho. */
export function daLinha<T extends ComDatas>(linha: { id: string; dados: unknown; updated_at?: string | null; deleted_at?: string | null }): T {
  const dados = (linha.dados && typeof linha.dados === 'object' ? linha.dados : {}) as Record<string, unknown>
  const item = { ...dados, id: linha.id } as Record<string, unknown>
  const atualizado = normalizarData(linha.updated_at)
  if (atualizado) item.updatedAt = atualizado
  const apagado = normalizarData(linha.deleted_at)
  if (apagado) item.deletedAt = apagado
  else delete item.deletedAt
  return item as T
}

const LOTE = 200

async function enviar(tabela: string, linhas: LinhaSync[]) {
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { error } = await supabase.from(tabela).upsert(linhas.slice(i, i + LOTE))
    if (error) throw new Error(`[sync] ${tabela}: ${error.message}`)
  }
}

/** Junta todas as páginas de uma consulta. O Supabase devolve no máximo 1000
 *  linhas por consulta — sem isso, tabelas grandes (os lances de scout já
 *  passaram de 1500) chegavam cortadas no aparelho. Se qualquer página der
 *  erro, falha tudo: melhor não mesclar nada do que mesclar um jogo pela
 *  metade. */
export async function lerEmPaginas<T>(
  buscarPagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  tamanho = 1000,
): Promise<T[]> {
  const todas: T[] = []
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await buscarPagina(de, de + tamanho - 1)
    if (error) throw new Error(error.message)
    todas.push(...(data ?? []))
    if (!data || data.length < tamanho) break
  }
  return todas
}

/** Todas as linhas da conta numa tabela, em ordem de id (ordem fixa, pra
 *  nenhuma linha pular ou repetir entre uma página e outra). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function lerTabelaInteira(tabela: string, ownerId: string, colunas = '*'): Promise<any[]> {
  try {
    return await lerEmPaginas((de, ate) =>
      supabase.from(tabela).select(colunas).eq('owner_id', ownerId).order('id').range(de, ate),
    )
  } catch (e) {
    throw new Error(`[sync] ${tabela}: ${(e as Error).message}`)
  }
}

export async function enviarTreinos(
  ownerId: string,
  estado: { sessoesTreino: SessaoTreino[]; bibliotecaExercicios: ExercicioBiblioteca[] },
): Promise<void> {
  if (estado.sessoesTreino.length) await enviar('sessoes_treino', estado.sessoesTreino.map((s) => paraLinha(s, ownerId)))
  if (estado.bibliotecaExercicios.length) await enviar('exercicios_biblioteca', estado.bibliotecaExercicios.map((e) => paraLinha(e, ownerId)))
}

export async function lerTreinos(ownerId: string): Promise<{ sessoesTreino: SessaoTreino[]; bibliotecaExercicios: ExercicioBiblioteca[] }> {
  const colunas = 'id, dados, updated_at, deleted_at'
  const [sessoes, exercicios] = await Promise.all([
    lerTabelaInteira('sessoes_treino', ownerId, colunas),
    lerTabelaInteira('exercicios_biblioteca', ownerId, colunas),
  ])
  return {
    sessoesTreino: sessoes.map((l) => daLinha<SessaoTreino>(l)),
    bibliotecaExercicios: exercicios.map((l) => daLinha<ExercicioBiblioteca>(l)),
  }
}
