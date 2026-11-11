// Sincronização principal do RDSports via Supabase — substitui o jsonbin.io.
// Ao logar: PUXA os dados que já existem na nuvem (recuperação dos dados antigos
// do Henrique, espelhados lá nas Rodadas 29/08–20/09/2026, antes da perda do código).
// Daí em diante: PUXA periodicamente (pra ver o que outros aparelhos mandaram) e
// EMPURRA (debounce) qualquer mudança local — cada aparelho loga com a mesma conta.
//
// Esquema normalizado (sets_partida/rallies/rally_eventos) é reaproveitado tal como
// documentado nas Fases 0–3 do histórico do projeto. Como o app reconstruído ainda
// não tem o conceito de Equipe/Categoria/Temporada na interface (só Escola → Turma →
// Atleta), este módulo provisiona automaticamente uma Equipe/Categoria "espelho" por
// Turma e uma Temporada ativa do ano atual — só pra satisfazer as colunas obrigatórias
// do schema antigo, sem expor isso na UI.
import { supabase } from './supabaseClient'
import { enviarTreinos, lerTreinos, lerTabelaInteira } from './syncTreinos'
import {
  normalizarPosicao,
  type Escola, type Turma, type Atleta, type Adversario, type Campeonato, type Partida, type SetPartida, type Rally, type RallyEvento,
  type JogoAgendado, type AvaliacaoPeriodica, type SessaoTreino, type ExercicioBiblioteca, type FundamentoScout, type ResultadoEvento, type FormatoPartida,
} from './types'

export interface DadosNuvem {
  escolas: Escola[]
  turmas: Turma[]
  atletas: Atleta[]
  adversarios: Adversario[]
  campeonatos: Campeonato[]
  partidas: Partida[]
  jogosAgendados: JogoAgendado[]
  avaliacoes: AvaliacaoPeriodica[]
  // Treinos e Biblioteca (sincronizam desde 11/11/2026 — ver syncTreinos.ts).
  sessoesTreino: SessaoTreino[]
  bibliotecaExercicios: ExercicioBiblioteca[]
}

async function getOwnerId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

// --- Provisionamento automático (equipe/categoria/temporada "espelho") ---
const temporadaCache = new Map<string, string>() // ownerId -> temporadaId
const equipeCache = new Map<string, string>() // turmaId -> equipeId
const categoriaCache = new Map<string, string>() // equipeId -> categoriaId
let adversarioTreinoId: string | null = null

async function getOrCreateTemporadaAtiva(ownerId: string): Promise<string> {
  const cached = temporadaCache.get(ownerId)
  if (cached) return cached
  const ano = new Date().getFullYear()
  const { data: existente } = await supabase.from('temporadas').select('id').eq('owner_id', ownerId).eq('ano', ano).maybeSingle()
  if (existente) { temporadaCache.set(ownerId, existente.id); return existente.id }
  const { data: criada, error } = await supabase.from('temporadas').insert({ owner_id: ownerId, ano, ativa: true }).select('id').single()
  if (error || !criada) throw error ?? new Error('Falha ao criar temporada')
  temporadaCache.set(ownerId, criada.id)
  return criada.id
}

async function getOrCreateEquipeDaTurma(ownerId: string, turma: Turma): Promise<string> {
  const cached = equipeCache.get(turma.id)
  if (cached) return cached
  const { data: existente } = await supabase.from('equipes').select('id').eq('owner_id', ownerId).eq('turma_id', turma.id).maybeSingle()
  if (existente) { equipeCache.set(turma.id, existente.id); return existente.id }
  const { data: criada, error } = await supabase
    .from('equipes')
    .insert({ owner_id: ownerId, escola_id: turma.escolaId, turma_id: turma.id, nome: turma.nome })
    .select('id').single()
  if (error || !criada) throw error ?? new Error('Falha ao criar equipe')
  equipeCache.set(turma.id, criada.id)
  return criada.id
}

async function getOrCreateCategoriaDaEquipe(ownerId: string, equipeId: string): Promise<string> {
  const cached = categoriaCache.get(equipeId)
  if (cached) return cached
  const { data: existente } = await supabase.from('categorias').select('id').eq('owner_id', ownerId).eq('equipe_id', equipeId).maybeSingle()
  if (existente) { categoriaCache.set(equipeId, existente.id); return existente.id }
  const { data: criada, error } = await supabase.from('categorias').insert({ owner_id: ownerId, equipe_id: equipeId, nome: 'Geral' }).select('id').single()
  if (error || !criada) throw error ?? new Error('Falha ao criar categoria')
  categoriaCache.set(equipeId, criada.id)
  return criada.id
}

async function getOrCreateAdversarioTreino(ownerId: string): Promise<string> {
  if (adversarioTreinoId) return adversarioTreinoId
  const { data: existente } = await supabase.from('adversarios').select('id').eq('owner_id', ownerId).eq('nome', 'Treino interno').maybeSingle()
  if (existente) { adversarioTreinoId = existente.id; return existente.id }
  const { data: criado, error } = await supabase.from('adversarios').insert({ owner_id: ownerId, nome: 'Treino interno' }).select('id').single()
  if (error || !criado) throw error ?? new Error('Falha ao criar adversário de treino')
  adversarioTreinoId = criado.id
  return criado.id
}

// --- PUSH: manda o estado local atual pra nuvem (upsert por id, nunca apaga nada lá) ---
//
// CORREÇÃO (30/10/2026 — bug real: "fica no 'Salvando...' pra sempre, o que
// adicionei no tablet não chega no celular"): antes, isso aqui mandava UM
// registro de cada vez (await dentro de loop) pra atletas, partidas, sets,
// rallies e eventos de rally — com 171 atletas e 26 partidas já escaneadas
// (cada uma com vários sets/rallies/eventos), isso virava MILHARES de
// requisições sequenciais a cada push, um push podia levar muitos MINUTOS
// pra terminar. E como jogos do calendário (jogosAgendados) eram enviados
// só no FINAL de tudo isso, uma coisa pequena como "adicionei um jogo" ficava
// esperando atrás de uma fila gigante — na prática nunca chegava na nuvem
// a tempo. Agora: (1) o que é pequeno e rápido (escolas, turmas, adversários,
// campeonatos, jogos do calendário, avaliações) vai primeiro, em lotes
// (um upsert só por tabela); (2) atletas também vira um upsert em lote só;
// (3) sets/rallies/eventos/substituições de TODAS as partidas são juntados
// e enviados em 4 upserts em lote no final, em vez de um por registro.
export async function pushAll(estado: {
  escolas: Escola[]; turmas: Turma[]; atletas: Atleta[]; adversarios: Adversario[]
  campeonatos: Campeonato[]; partidas: Partida[]; jogosAgendados: JogoAgendado[]; avaliacoes: AvaliacaoPeriodica[]
  sessoesTreino: SessaoTreino[]; bibliotecaExercicios: ExercicioBiblioteca[]
}): Promise<void> {
  const ownerId = await getOwnerId()
  if (!ownerId) return

  // Treinos e Biblioteca vão primeiro: são pequenos e não dependem de nada
  // do resto (11/11/2026).
  await enviarTreinos(ownerId, estado)

  if (estado.escolas.length) {
    await supabase.from('escolas').upsert(estado.escolas.map((e) => ({
      id: e.id, owner_id: ownerId, nome: e.nome, logo_url: e.logoUrl ?? null, created_at: e.createdAt, deleted_at: e.deletedAt ?? null,
    })))
  }
  if (estado.turmas.length) {
    await supabase.from('turmas').upsert(estado.turmas.map((t) => ({
      id: t.id, owner_id: ownerId, escola_id: t.escolaId, nome: t.nome,
      // Nível da turma (convocação, 11/11/2026) mora na coluna ano_serie.
      ano_serie: t.nivel != null ? String(t.nivel) : null,
      created_at: t.createdAt, deleted_at: t.deletedAt ?? null,
    })))
  }
  if (estado.adversarios.length) {
    await supabase.from('adversarios').upsert(estado.adversarios.map((a) => ({
      id: a.id, owner_id: ownerId, nome: a.nome, logo_url: a.logoUrl ?? null, created_at: a.createdAt,
    })))
  }
  if (estado.campeonatos.length) {
    await supabase.from('campeonatos').upsert(estado.campeonatos.map((c) => ({
      id: c.id, owner_id: ownerId, nome: c.nome, created_at: c.createdAt,
    })))
  }

  // Jogos do calendário — pequeno volume, mas vai ANTES de atletas/partidas
  // de propósito: é o tipo de coisa que o Henrique acabou de adicionar e
  // quer ver sincronizar rápido, não depois de uma fila gigante.
  if (estado.jogosAgendados.length) {
    const linhas = []
    for (const j of estado.jogosAgendados) {
      const turma = estado.turmas.find((t) => t.id === j.turmaId)
      linhas.push({
        id: j.id, owner_id: ownerId, tipo: 'JOGO', titulo: j.adversarioNome, data: j.data,
        hora_inicio: j.horario ?? null, local: j.local ?? null,
        convocadas: j.convocadas ?? null, formato: j.formato ?? null, campeonato: j.campeonatoNome ?? null,
        checklist: j.checklist ?? null,
        equipe_id: turma ? await getOrCreateEquipeDaTurma(ownerId, turma) : null,
        created_at: j.createdAt, deleted_at: j.deletedAt ?? null,
      })
    }
    await supabase.from('eventos_calendario').upsert(linhas)
  }

  if (estado.avaliacoes.length) {
    await supabase.from('avaliacoes').upsert(estado.avaliacoes.map((av) => ({
      id: av.id, owner_id: ownerId, atleta_id: av.atletaId, data: av.data,
      periodo: av.periodo, notas: av.notas, observacoes: av.observacoes ?? null,
    })))
  }

  if (estado.atletas.length) {
    await supabase.from('atletas').upsert(estado.atletas.map((a) => ({
      id: a.id, owner_id: ownerId, nome: a.nome,
      numero: a.numero && !Number.isNaN(Number(a.numero)) ? Number(a.numero) : null,
      posicao: a.posicaoPrincipal ?? null, posicao_secundaria: a.posicaoSecundaria ?? null, foto_url: a.fotoUrl ?? null,
      idade: a.idade ?? null, nascimento: a.nascimento ?? null, altura: a.alturaCm ?? null, codigo_acesso: a.codigoAcesso ?? null,
      status: (a.status ?? 'ATIVA').toLowerCase(), created_at: a.createdAt, deleted_at: a.deletedAt ?? null,
    })))

    // Vínculo atleta→turma (atleta_equipe_historico): resolve equipe/categoria
    // de cada turma usada (cache, poucas turmas) e manda só os vínculos que
    // ainda não existem, num select + insert em lote em vez de um par
    // select+insert POR atleta.
    const temporadaId = await getOrCreateTemporadaAtiva(ownerId)
    const turmaInfo = new Map<string, { equipeId: string; categoriaId: string }>()
    const atletasComTurma = estado.atletas.filter((a) => a.turmaId && estado.turmas.some((t) => t.id === a.turmaId))
    for (const a of atletasComTurma) {
      if (turmaInfo.has(a.turmaId!)) continue
      const turma = estado.turmas.find((t) => t.id === a.turmaId)!
      const equipeId = await getOrCreateEquipeDaTurma(ownerId, turma)
      const categoriaId = await getOrCreateCategoriaDaEquipe(ownerId, equipeId)
      turmaInfo.set(a.turmaId!, { equipeId, categoriaId })
    }
    if (atletasComTurma.length) {
      const { data: abertos } = await supabase
        .from('atleta_equipe_historico').select('atleta_id, turma_id')
        .eq('owner_id', ownerId).is('data_saida', null)
        .in('atleta_id', atletasComTurma.map((a) => a.id))
      const jaTemVinculo = new Set((abertos ?? []).map((h) => `${h.atleta_id}:${h.turma_id}`))
      const novosVinculos = atletasComTurma
        .filter((a) => !jaTemVinculo.has(`${a.id}:${a.turmaId}`))
        .map((a) => {
          const turma = estado.turmas.find((t) => t.id === a.turmaId)!
          const info = turmaInfo.get(a.turmaId!)!
          return {
            owner_id: ownerId, atleta_id: a.id, escola_id: turma.escolaId, turma_id: turma.id,
            equipe_id: info.equipeId, categoria_id: info.categoriaId, temporada_id: temporadaId,
          }
        })
      if (novosVinculos.length) await supabase.from('atleta_equipe_historico').insert(novosVinculos)
    }
  }

  if (estado.partidas.length) {
    const todosSets: Record<string, unknown>[] = []
    const todasRallies: Record<string, unknown>[] = []
    const todosEventos: Record<string, unknown>[] = []
    const todasSubstituicoes: Record<string, unknown>[] = []

    for (const p of estado.partidas) {
      const turma = estado.turmas.find((t) => t.id === p.turmaId)
      if (!turma) continue
      const equipeId = await getOrCreateEquipeDaTurma(ownerId, turma)
      const categoriaId = await getOrCreateCategoriaDaEquipe(ownerId, equipeId)
      const temporadaId = await getOrCreateTemporadaAtiva(ownerId)
      const adversarioId = p.adversarioId ?? (await getOrCreateAdversarioTreino(ownerId))

      await supabase.from('partidas').upsert({
        id: p.id, owner_id: ownerId, temporada_id: temporadaId, escola_id: turma.escolaId, turma_id: turma.id,
        equipe_id: equipeId, categoria_id: categoriaId, adversario_id: adversarioId,
        campeonato_id: p.campeonatoId ?? null, tipo: p.tipo, data: p.data, local: p.local ?? null,
        campeonato: p.campeonato ?? null, observacoes: p.observacoes ?? null,
        convocadas: p.convocadas ?? null,
        status: p.status === 'FINALIZADA' ? 'FINALIZADA' : 'EM_ANDAMENTO',
        sets_ganhos_casa: p.setsGanhosCasa, sets_ganhos_adversario: p.setsGanhosAdversario,
        pontos_set_decisivo: p.formato === 'TRES_OBRIGATORIOS_25' ? 25 : 15,
        criada_em: p.createdAt, deleted_at: p.deletedAt ?? null,
      })

      for (const set of p.setsPartida) {
        todosSets.push({
          id: set.id, owner_id: ownerId, partida_id: p.id, numero: set.numero,
          placar_casa: set.placarCasa, placar_adversario: set.placarAdversario,
          finalizado: set.finalizado, vencedor: set.vencedor ?? null,
          titulares_iniciais: set.escalacaoInicial ?? [],
          saque_inicial_casa: set.primeiroSaque === 'CASA',
        })
        for (const sub of set.substituicoes ?? []) {
          todasSubstituicoes.push({
            id: sub.id, owner_id: ownerId, partida_id: p.id, set_id: set.id,
            entra_atleta_id: sub.atletaEntraId, posicao_index: sub.posicaoIndex,
            apos_rally_numero: sub.aposRallyFechado, horario: sub.timestamp,
          })
        }
        for (const rally of set.rallies) {
          todasRallies.push({
            id: rally.id, owner_id: ownerId, set_id: set.id, numero: rally.numero,
            ponto: rally.pontoCasa ? 'CASA' : 'ADVERSARIO',
            placar_casa: rally.placarCasaApos, placar_adversario: rally.placarAdversarioApos,
          })
          let ordem = 0
          for (const ev of rally.eventos) {
            todosEventos.push({
              id: ev.id, owner_id: ownerId, rally_id: rally.id, ordem: ordem++,
              fundamento: ev.fundamento.toUpperCase(), atleta_id: ev.atletaId ?? null,
              resultado: ev.resultado, detalhe: ev.tipoErro ?? ev.tipoPontoAtaqueAdversario ?? null,
              lado_responsavel: ev.ladoResponsavel ?? null, numero_adversario: ev.numeroAdversario ?? null,
            })
          }
        }
      }
    }

    // Upserts do Postgres/PostgREST têm um limite prático de tamanho de
    // requisição — manda em pedaços de 500 linhas pra não estourar isso em
    // temporadas com muitas partidas escaneadas.
    const EM_LOTES_DE = 500
    async function upsertEmLotes(tabela: string, linhas: Record<string, unknown>[]) {
      for (let i = 0; i < linhas.length; i += EM_LOTES_DE) {
        await supabase.from(tabela).upsert(linhas.slice(i, i + EM_LOTES_DE))
      }
    }
    await upsertEmLotes('sets_partida', todosSets)
    await upsertEmLotes('substituicoes', todasSubstituicoes)
    await upsertEmLotes('rallies', todasRallies)
    await upsertEmLotes('rally_eventos', todosEventos)
  }
}

// --- PULL: lê tudo que existe na nuvem pra essa conta e remonta no formato local ---
export async function pullAll(): Promise<DadosNuvem | null> {
  const ownerId = await getOwnerId()
  if (!ownerId) return null

  // CORREÇÃO (11/11/2026): cada tabela é lida INTEIRA, de 1000 em 1000. Antes
  // era uma consulta só por tabela, e o Supabase corta em 1000 linhas — com
  // os lances de scout passando de 1500, jogos chegavam no aparelho com
  // lances faltando (e, como a cópia da nuvem é sempre a "mais nova", o jogo
  // incompleto substituía o completo no aparelho). Se alguma leitura falhar,
  // nada é mesclado nessa rodada (o erro sobe pro syncManager).
  const lidas = await Promise.all([
    lerTabelaInteira('escolas', ownerId),
    lerTabelaInteira('turmas', ownerId),
    lerTabelaInteira('equipes', ownerId),
    lerTabelaInteira('atletas', ownerId),
    lerTabelaInteira('atleta_equipe_historico', ownerId),
    lerTabelaInteira('adversarios', ownerId),
    lerTabelaInteira('campeonatos', ownerId),
    lerTabelaInteira('partidas', ownerId),
    lerTabelaInteira('sets_partida', ownerId),
    lerTabelaInteira('rallies', ownerId),
    lerTabelaInteira('rally_eventos', ownerId),
    lerTabelaInteira('eventos_calendario', ownerId),
    lerTabelaInteira('avaliacoes', ownerId),
    lerTabelaInteira('substituicoes', ownerId),
  ])
  const [escolasR, turmasR, equipesR, atletasR, historicoR, adversariosR, campeonatosR, partidasR, setsR, ralliesR, eventosR, calendarioR, avaliacoesR, substituicoesR] = lidas.map((data) => ({ data }))

  const escolas: Escola[] = (escolasR.data ?? []).map((e) => ({
    id: e.id, nome: e.nome, logoUrl: e.logo_url ?? undefined, createdAt: e.created_at, updatedAt: e.updated_at ?? undefined, deletedAt: e.deleted_at ?? undefined,
  }))
  const turmas: Turma[] = (turmasR.data ?? []).map((t) => ({
    id: t.id, escolaId: t.escola_id, nome: t.nome,
    nivel: t.ano_serie && /^\d+$/.test(String(t.ano_serie).trim()) ? Number(String(t.ano_serie).trim()) : undefined,
    createdAt: t.created_at, updatedAt: t.updated_at ?? undefined, deletedAt: t.deleted_at ?? undefined,
  }))

  const equipeParaTurma = new Map<string, string>()
  for (const eq of equipesR.data ?? []) if (eq.turma_id) equipeParaTurma.set(eq.id, eq.turma_id)

  const historicoPorAtleta = new Map<string, Array<{ turma_id: string | null; data_entrada: string; data_saida: string | null }>>()
  for (const h of historicoR.data ?? []) {
    const lista = historicoPorAtleta.get(h.atleta_id) ?? []
    lista.push(h)
    historicoPorAtleta.set(h.atleta_id, lista)
  }
  function turmaAtualDoAtleta(atletaId: string): string | undefined {
    const lista = historicoPorAtleta.get(atletaId)
    if (!lista || lista.length === 0) return undefined
    const abertos = lista.filter((h) => !h.data_saida)
    const escolhido = [...(abertos.length ? abertos : lista)].sort((a, b) => (b.data_entrada ?? '').localeCompare(a.data_entrada ?? ''))[0]
    return escolhido?.turma_id ?? undefined
  }

  const atletas: Atleta[] = (atletasR.data ?? [])
    .map((a) => ({
      id: a.id, turmaId: turmaAtualDoAtleta(a.id) ?? '', nome: a.nome,
      numero: a.numero != null ? String(a.numero) : undefined,
      posicaoPrincipal: normalizarPosicao(a.posicao), posicaoSecundaria: normalizarPosicao(a.posicao_secundaria), fotoUrl: a.foto_url ?? undefined,
      idade: a.idade ?? undefined, nascimento: a.nascimento ?? undefined, alturaCm: a.altura ?? undefined, codigoAcesso: a.codigo_acesso ?? undefined,
      status: (a.status ? a.status.toUpperCase() : 'ATIVA') as Atleta['status'],
      createdAt: a.created_at, updatedAt: a.updated_at ?? undefined, deletedAt: a.deleted_at ?? undefined,
    }))
    .filter((a) => a.turmaId)

  const adversariosData = adversariosR.data ?? []
  const adversarios: Adversario[] = adversariosData
    .filter((a) => a.nome !== 'Treino interno')
    .map((a) => ({ id: a.id, nome: a.nome, logoUrl: a.logo_url ?? undefined, createdAt: a.created_at, updatedAt: a.updated_at ?? undefined }))
  const campeonatos: Campeonato[] = (campeonatosR.data ?? []).map((c) => ({ id: c.id, nome: c.nome, createdAt: c.created_at, updatedAt: c.updated_at ?? undefined }))

  const eventosPorRally = new Map<string, typeof eventosR.data>()
  for (const ev of eventosR.data ?? []) {
    const lista = eventosPorRally.get(ev.rally_id) ?? []
    lista.push(ev)
    eventosPorRally.set(ev.rally_id, lista)
  }
  const ralliesPorSet = new Map<string, typeof ralliesR.data>()
  for (const r of ralliesR.data ?? []) {
    const lista = ralliesPorSet.get(r.set_id) ?? []
    lista.push(r)
    ralliesPorSet.set(r.set_id, lista)
  }
  const setsPorPartida = new Map<string, typeof setsR.data>()
  for (const st of setsR.data ?? []) {
    const lista = setsPorPartida.get(st.partida_id) ?? []
    lista.push(st)
    setsPorPartida.set(st.partida_id, lista)
  }
  const substituicoesPorSet = new Map<string, typeof substituicoesR.data>()
  for (const sub of substituicoesR.data ?? []) {
    const lista = substituicoesPorSet.get(sub.set_id) ?? []
    lista.push(sub)
    substituicoesPorSet.set(sub.set_id, lista)
  }

  function fundamentoLocal(f: string): FundamentoScout {
    return f.toLowerCase() as FundamentoScout
  }
  function resultadoLocal(r: string): ResultadoEvento {
    const up = (r ?? '').toUpperCase()
    if (up === 'ACERTO' || up === 'BOM' || up === 'MEDIO' || up === 'ERRO' || up === 'EM_JOGO') return up as ResultadoEvento
    return 'EM_JOGO'
  }

  const partidas: Partida[] = (partidasR.data ?? [])
    .map((p) => {
      const sets: SetPartida[] = (setsPorPartida.get(p.id) ?? [])
        .slice().sort((a, b) => a.numero - b.numero)
        .map((st) => {
          const rallies: Rally[] = (ralliesPorSet.get(st.id) ?? [])
            .slice().sort((a, b) => a.numero - b.numero)
            .map((r) => {
              const eventos: RallyEvento[] = (eventosPorRally.get(r.id) ?? [])
                .slice().sort((a, b) => a.ordem - b.ordem)
                .map((ev, idx, arr) => ({
                  id: ev.id, atletaId: ev.atleta_id ?? undefined, fundamento: fundamentoLocal(ev.fundamento),
                  resultado: resultadoLocal(ev.resultado),
                  encerraRally: idx === arr.length - 1 ? (r.ponto === 'CASA' ? 'CASA' : 'ADVERSARIO') : null,
                  tipoErro: ev.detalhe ?? undefined, timestamp: r.horario,
                  ladoResponsavel: ev.lado_responsavel === 'ADVERSARIO' ? 'ADVERSARIO' as const : undefined,
                  numeroAdversario: ev.numero_adversario ?? undefined,
                }))
              return {
                id: r.id, numero: r.numero, eventos, pontoCasa: r.ponto === 'CASA',
                placarCasaApos: r.placar_casa, placarAdversarioApos: r.placar_adversario,
              }
            })
          const temEscalacao = Array.isArray(st.titulares_iniciais) && st.titulares_iniciais.length === 6
          return {
            id: st.id, numero: st.numero, placarCasa: st.placar_casa, placarAdversario: st.placar_adversario,
            rallies, finalizado: st.finalizado, vencedor: st.vencedor ?? undefined,
            ...(temEscalacao ? {
              escalacaoInicial: st.titulares_iniciais as string[],
              primeiroSaque: (st.saque_inicial_casa ? 'CASA' : 'ADVERSARIO') as 'CASA' | 'ADVERSARIO',
              substituicoes: (substituicoesPorSet.get(st.id) ?? [])
                .filter((sub) => sub.posicao_index != null)
                .map((sub) => ({
                  id: sub.id, aposRallyFechado: sub.apos_rally_numero, posicaoIndex: sub.posicao_index,
                  atletaEntraId: sub.entra_atleta_id, timestamp: sub.horario,
                })),
            } : {}),
          }
        })
      const turmaId = p.turma_id ?? (p.equipe_id ? equipeParaTurma.get(p.equipe_id) : undefined) ?? ''
      const formato: FormatoPartida = p.pontos_set_decisivo === 25 ? 'TRES_OBRIGATORIOS_25' : 'MELHOR_DE_5'
      return {
        id: p.id, tipo: (p.tipo ?? 'JOGO') as Partida['tipo'], turmaId,
        adversarioId: p.adversario_id ?? undefined,
        adversarioNome: adversariosData.find((a) => a.id === p.adversario_id)?.nome,
        campeonato: p.campeonato ?? undefined, campeonatoId: p.campeonato_id ?? undefined,
        formato, data: p.data, local: p.local ?? undefined,
        status: p.status === 'FINALIZADA' ? 'FINALIZADA' : 'EM_ANDAMENTO',
        setsPartida: sets, setsGanhosCasa: p.sets_ganhos_casa, setsGanhosAdversario: p.sets_ganhos_adversario,
        observacoes: p.observacoes ?? undefined,
        convocadas: Array.isArray(p.convocadas) && p.convocadas.length ? (p.convocadas as string[]) : undefined,
        createdAt: p.criada_em, updatedAt: p.updated_at ?? undefined, deletedAt: p.deleted_at ?? undefined,
      } satisfies Partida
    })
    .filter((p) => p.turmaId)

  const jogosAgendados: JogoAgendado[] = (calendarioR.data ?? [])
    .filter((e) => e.tipo === 'JOGO')
    .map((e) => ({
      id: e.id, turmaId: (e.equipe_id ? equipeParaTurma.get(e.equipe_id) : undefined) ?? '',
      adversarioNome: e.titulo, data: e.data, horario: e.hora_inicio ?? undefined, local: e.local ?? undefined,
      convocadas: Array.isArray(e.convocadas) && e.convocadas.length ? (e.convocadas as string[]) : undefined,
      formato: (e.formato ?? undefined) as FormatoPartida | undefined, campeonatoNome: e.campeonato ?? undefined,
      checklist: Array.isArray(e.checklist) ? (e.checklist as { item: string; feito: boolean }[]) : undefined,
      createdAt: e.created_at, updatedAt: e.updated_at ?? undefined, deletedAt: e.deleted_at ?? undefined,
    }))
    .filter((j) => j.turmaId)

  const avaliacoes: AvaliacaoPeriodica[] = (avaliacoesR.data ?? []).map((av) => ({
    id: av.id, atletaId: av.atleta_id, data: av.data,
    periodo: (av.periodo ?? 'PERSONALIZADA') as AvaliacaoPeriodica['periodo'],
    notas: av.notas ?? {}, observacoes: av.observacoes ?? undefined, updatedAt: av.updated_at ?? undefined,
  }))

  const { sessoesTreino, bibliotecaExercicios } = await lerTreinos(ownerId)

  return { escolas, turmas, atletas, adversarios, campeonatos, partidas, jogosAgendados, avaliacoes, sessoesTreino, bibliotecaExercicios }
}
