// Como uma atleta do aparelho vira uma linha da tabela `atletas` na nuvem.
//
// CORREÇÃO (21/11/2026 — bug real: "alterações de atleta não chegam na
// nuvem desde 30/10"): a coluna `atletas.posicao` no Supabase é NOT NULL.
// 29 atletas têm lá o valor antigo "6x0", que `normalizarPosicao` converte
// em `undefined` (não existe mais essa posição). Ao reenviar, ia `null` e o
// Postgres recusava o LOTE INTEIRO de atletas — e como o erro era ignorado,
// nenhuma alteração de nenhuma atleta subia desde que o envio virou lote
// (30/10/2026). Agora atleta sem posição vai como 'SEM_POSICAO' (o mesmo
// valor que o pull já entende como "sem posição": normaliza pra undefined).
import type { Atleta } from './types'

export const POSICAO_VAZIA_NUVEM = 'SEM_POSICAO'

export function linhaAtletaNuvem(a: Atleta, ownerId: string) {
  return {
    id: a.id, owner_id: ownerId, nome: a.nome,
    numero: a.numero && !Number.isNaN(Number(a.numero)) ? Number(a.numero) : null,
    posicao: a.posicaoPrincipal ?? POSICAO_VAZIA_NUVEM,
    posicao_secundaria: a.posicaoSecundaria ?? null, foto_url: a.fotoUrl ?? null,
    idade: a.idade ?? null, nascimento: a.nascimento ?? null, altura: a.alturaCm ?? null, codigo_acesso: a.codigoAcesso ?? null,
    status: (a.status ?? 'ATIVA').toLowerCase(), created_at: a.createdAt, deleted_at: a.deletedAt ?? null,
  }
}
