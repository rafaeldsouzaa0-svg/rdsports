// Modo banco (pedido 27/11/2026, ideia do "client on the bench" do Data
// Volley): um 2º aparelho (do técnico no banco) vê os números do jogo AO VIVO
// enquanto outra pessoa faz o scout. Só LEITURA: este módulo busca o jogo
// direto da nuvem e nunca grava nada nem mexe nos dados guardados no
// aparelho — assim o banco não atrapalha quem está marcando.
import { supabase } from './supabaseClient'
import { resultadoDaNuvem } from './repararScout'
import { formatoDaLinha } from './formatoPartidaSync'
import { zonaDoBanco } from './zonas'
import type { FundamentoScout, Partida, Rally, RallyEvento, SetPartida } from './types'

/** Quanto tempo entre uma leitura e outra (o aparelho do scout envia em ~3 s). */
export const INTERVALO_ATUALIZACAO_MS = 8000

interface LinhaEvento { id: string; ordem: number; fundamento: string; resultado: string; atleta_id: string | null; detalhe: string | null; lado_responsavel: string | null; numero_adversario: string | null; video_seg: number | null; zona: number | null }
interface LinhaRally { id: string; numero: number; ponto: string; placar_casa: number; placar_adversario: number; horario: string; rally_eventos?: LinhaEvento[] }
interface LinhaSubstituicao { id: string; apos_rally_numero: number; posicao_index: number | null; entra_atleta_id: string; horario: string }
export interface LinhaSet {
  id: string; numero: number; placar_casa: number; placar_adversario: number; finalizado: boolean; vencedor: string | null
  titulares_iniciais: string[] | null; saque_inicial_casa: boolean; libero_id: string | null; libero_substitui: string[] | null
  rallies?: LinhaRally[]; substituicoes?: LinhaSubstituicao[]
}
export interface LinhaPartida {
  id: string; turma_id: string | null; data: string; status: string; tipo: string | null
  sets_ganhos_casa: number; sets_ganhos_adversario: number; formato?: string | null; pontos_por_set?: number | null; pontos_set_decisivo?: number | null
  convocadas: string[] | null; criada_em: string; adversarios?: { nome: string } | null
}

/** Monta a partida (no mesmo formato do app) a partir das linhas da nuvem.
 *  Diferente da leitura completa, aqui um rally só "fecha" se o placar
 *  andou — o rally que ainda está acontecendo no momento não vira ponto. */
export function montarPartidaAoVivo(p: LinhaPartida, linhasSets: LinhaSet[]): Partida {
  const sets: SetPartida[] = [...linhasSets].sort((a, b) => a.numero - b.numero).map((st) => {
    let totalAntes = 0
    const rallies: Rally[] = [...(st.rallies ?? [])].sort((a, b) => a.numero - b.numero).map((r) => {
      const total = r.placar_casa + r.placar_adversario
      const fechou = total > totalAntes
      if (fechou) totalAntes = total
      const evs = [...(r.rally_eventos ?? [])].sort((a, b) => a.ordem - b.ordem)
      const eventos: RallyEvento[] = evs.map((ev, idx) => ({
        id: ev.id, atletaId: ev.atleta_id ?? undefined, fundamento: ev.fundamento.toLowerCase() as FundamentoScout,
        resultado: resultadoDaNuvem(ev.fundamento, ev.resultado),
        encerraRally: fechou && idx === evs.length - 1 ? (r.ponto === 'CASA' ? 'CASA' : 'ADVERSARIO') : null,
        tipoErro: ev.detalhe ?? undefined, timestamp: r.horario,
        ladoResponsavel: ev.lado_responsavel === 'ADVERSARIO' ? 'ADVERSARIO' : undefined,
        numeroAdversario: ev.numero_adversario ?? undefined,
        ...(zonaDoBanco(ev.zona) ? { zona: zonaDoBanco(ev.zona) } : {}),
      }))
      return { id: r.id, numero: r.numero, eventos, pontoCasa: fechou && r.ponto === 'CASA', placarCasaApos: r.placar_casa, placarAdversarioApos: r.placar_adversario }
    })
    const temEscalacao = Array.isArray(st.titulares_iniciais) && st.titulares_iniciais.length === 6
    return {
      id: st.id, numero: st.numero, placarCasa: st.placar_casa, placarAdversario: st.placar_adversario,
      rallies, finalizado: st.finalizado, vencedor: (st.vencedor ?? undefined) as SetPartida['vencedor'],
      ...(temEscalacao ? {
        escalacaoInicial: st.titulares_iniciais as string[],
        primeiroSaque: st.saque_inicial_casa ? 'CASA' as const : 'ADVERSARIO' as const,
        ...(st.libero_id && st.libero_substitui?.length ? { libero: { atletaId: st.libero_id, substitui: st.libero_substitui } } : {}),
        substituicoes: (st.substituicoes ?? []).filter((s) => s.posicao_index != null).map((s) => ({
          id: s.id, aposRallyFechado: s.apos_rally_numero, posicaoIndex: s.posicao_index as number, atletaEntraId: s.entra_atleta_id, timestamp: s.horario,
        })),
      } : {}),
    }
  })
  return {
    id: p.id, tipo: (p.tipo ?? 'JOGO') as Partida['tipo'], turmaId: p.turma_id ?? '',
    adversarioNome: p.adversarios?.nome, ...formatoDaLinha(p), data: p.data,
    status: p.status === 'FINALIZADA' ? 'FINALIZADA' : 'EM_ANDAMENTO',
    setsPartida: sets, setsGanhosCasa: p.sets_ganhos_casa, setsGanhosAdversario: p.sets_ganhos_adversario,
    convocadas: p.convocadas?.length ? p.convocadas : undefined, createdAt: p.criada_em,
  }
}

const COLUNAS_PARTIDA = 'id, turma_id, data, status, tipo, sets_ganhos_casa, sets_ganhos_adversario, formato, pontos_por_set, pontos_set_decisivo, convocadas, criada_em, adversarios(nome)'

export interface JogoEmAndamento { id: string; data: string; adversario: string; turmaId: string; placarSets: string }

/** Jogos que estão acontecendo agora (na conta logada). */
export async function listarJogosEmAndamento(): Promise<JogoEmAndamento[]> {
  const { data, error } = await supabase.from('partidas').select(COLUNAS_PARTIDA)
    .eq('status', 'EM_ANDAMENTO').eq('tipo', 'JOGO').is('deleted_at', null)
    .order('data', { ascending: false }).limit(20)
  if (error) throw error
  return ((data ?? []) as unknown as LinhaPartida[]).map((p) => ({
    id: p.id, data: p.data, adversario: p.adversarios?.nome ?? 'Adversário', turmaId: p.turma_id ?? '',
    placarSets: `${p.sets_ganhos_casa} × ${p.sets_ganhos_adversario}`,
  }))
}

/** Lê um jogo inteiro (sets, rallies, lances e substituições) numa consulta só. */
export async function lerJogoAoVivo(partidaId: string): Promise<Partida | null> {
  const [pRes, sRes] = await Promise.all([
    supabase.from('partidas').select(COLUNAS_PARTIDA).eq('id', partidaId).maybeSingle(),
    supabase.from('sets_partida')
      .select('id, numero, placar_casa, placar_adversario, finalizado, vencedor, titulares_iniciais, saque_inicial_casa, libero_id, libero_substitui, rallies(id, numero, ponto, placar_casa, placar_adversario, horario, rally_eventos(id, ordem, fundamento, resultado, atleta_id, detalhe, lado_responsavel, numero_adversario, video_seg, zona)), substituicoes(id, apos_rally_numero, posicao_index, entra_atleta_id, horario)')
      .eq('partida_id', partidaId),
  ])
  if (pRes.error) throw pRes.error
  if (sRes.error) throw sRes.error
  if (!pRes.data) return null
  return montarPartidaAoVivo(pRes.data as unknown as LinhaPartida, (sRes.data ?? []) as unknown as LinhaSet[])
}
