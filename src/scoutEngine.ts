// Motor de regras do scout ao vivo.
//
// REGRA CRÍTICA (pedido do Henrique, ajustado de novo em 23/10/2026): o
// levantamento NUNCA marca ponto/fecha rally, em NENHUMA hipótese — nem
// Bom/Médio, nem Erro. É só estatística da levantadora (continua contando
// pro scout dela e da equipe), mas o rally só fecha quando o fundamento que
// efetivamente decide o lance (Ataque, Bloqueio, Saque etc.) acontecer.
import type { FundamentoScout, ResultadoEvento, Rally, RallyEvento, SetPartida, Partida, FormatoPartida, Substituicao, CorrecaoEvento } from './types'
import { CONFIG_FORMATO } from './types'
import { uid, nowISO } from './utils'

export function encerraRallyDe(fundamento: FundamentoScout, resultado: ResultadoEvento): 'CASA' | 'ADVERSARIO' | null {
  switch (fundamento) {
    case 'saque':
      if (resultado === 'ACERTO') return 'CASA' // ace
      if (resultado === 'ERRO') return 'ADVERSARIO'
      return null // EM_JOGO — saque bom, bola em jogo
    case 'recepcao':
      // Bom/Médio nunca fecham rally (só o ataque decide); Erro fecha pro adversário.
      return resultado === 'ERRO' ? 'ADVERSARIO' : null
    case 'levantamento':
      // Pedido 23/10/2026: nunca fecha o rally nem soma ponto — nem mesmo no
      // Erro. É só estatística da levantadora (fica registrado, mas o rally
      // continua até outro fundamento decidir o lance).
      return null
    case 'ataque':
      if (resultado === 'ACERTO') return 'CASA'
      if (resultado === 'ERRO') return 'ADVERSARIO'
      return null
    case 'bloqueio':
      if (resultado === 'ACERTO') return 'CASA' // bloqueio de ponto
      if (resultado === 'ERRO') return 'ADVERSARIO'
      return null
    case 'defesa':
      // Defesa mantém a bola em jogo; só conta erro (bola não defendida) como fechamento.
      return resultado === 'ERRO' ? 'ADVERSARIO' : null
    case 'bola_de_graca':
    case 'bola_de_segunda':
      // Pedido 23/10/2026 (ajustado): bola de graça e bola de 2ª/largada são
      // jogadas que DÃO CERTO — o ponto é pra quem fez a jogada, não pro
      // outro lado. Não têm Bom/Médio/Erro — só acontecem, e sempre marcam
      // ponto na hora. ('CASA' aqui é a convenção interna de "quem cometeu a
      // ação" — `registrarEventoTime` já inverte certo quando é o adversário
      // que faz a jogada, então o ponto vai pra ele, não pra nós.)
      return 'CASA'
    case 'nao_deslocou':
      // "Não deslocou" continua sendo um erro de posicionamento de verdade —
      // sempre vira ponto pro OUTRO lado, igual antes.
      return 'ADVERSARIO'
  }
}

export function criarSet(numero: number): SetPartida {
  return { id: uid(), numero, placarCasa: 0, placarAdversario: 0, rallies: [], finalizado: false }
}

/** Função interna compartilhada: anexa um evento já pronto (com `encerraRally`
 *  já decidido) ao set, fechando o rally e somando o ponto pro lado certo
 *  quando for o caso. Usada tanto pelos eventos do nosso time quanto do
 *  adversário — a única diferença entre os dois é QUEM fecha o rally. */
function aplicarEvento(set: SetPartida, evento: RallyEvento): SetPartida {
  const encerra = evento.encerraRally
  const rallyAtual = set.rallies[set.rallies.length - 1]
  const rallyEmAndamento = rallyAtual && rallyAtual.placarCasaApos === set.placarCasa && rallyAtual.placarAdversarioApos === set.placarAdversario && !encerraFoiRegistrado(rallyAtual)

  if (!encerra) {
    if (rallyEmAndamento) {
      const rallies = set.rallies.slice(0, -1)
      return { ...set, rallies: [...rallies, { ...rallyAtual, eventos: [...rallyAtual.eventos, evento] }] }
    }
    const novoRally: Rally = {
      id: uid(), numero: set.rallies.length + 1, eventos: [evento],
      pontoCasa: false, placarCasaApos: set.placarCasa, placarAdversarioApos: set.placarAdversario,
    }
    return { ...set, rallies: [...set.rallies, novoRally] }
  }

  const pontoCasa = encerra === 'CASA'
  const placarCasa = set.placarCasa + (pontoCasa ? 1 : 0)
  const placarAdversario = set.placarAdversario + (pontoCasa ? 0 : 1)

  let rallies: Rally[]
  if (rallyEmAndamento) {
    rallies = [
      ...set.rallies.slice(0, -1),
      { ...rallyAtual, eventos: [...rallyAtual.eventos, evento], pontoCasa, placarCasaApos: placarCasa, placarAdversarioApos: placarAdversario },
    ]
  } else {
    rallies = [
      ...set.rallies,
      { id: uid(), numero: set.rallies.length + 1, eventos: [evento], pontoCasa, placarCasaApos: placarCasa, placarAdversarioApos: placarAdversario },
    ]
  }

  return { ...set, placarCasa, placarAdversario, rallies }
}

export function registrarEvento(
  set: SetPartida,
  fundamento: FundamentoScout,
  resultado: ResultadoEvento,
  atletaId?: string,
  detalhes?: Partial<RallyEvento>
): SetPartida {
  const encerra = encerraRallyDe(fundamento, resultado)
  const evento: RallyEvento = {
    id: uid(), atletaId, fundamento, resultado, encerraRally: encerra, timestamp: nowISO(), ...detalhes,
  }
  return aplicarEvento(set, evento)
}

/** Marca uma ação de QUALQUER um dos dois times no mesmo fluxo (pedido
 *  23/10/2026: "selecionar primeiro a atleta [ou o adversário], depois o
 *  fundamento, e o resultado"). Pra nós, funciona igual ao `registrarEvento`
 *  de sempre. Pro adversário, o resultado é visto do ponto de vista DELE —
 *  um "Ponto"/"Acerto" do adversário fecha o rally PRA ELE (ponto do
 *  adversário), e um "Erro" do adversário fecha o rally PRA NÓS — exatamente
 *  o oposto de quando é a nossa atleta que erra ou acerta. */
export function registrarEventoTime(
  set: SetPartida,
  lado: 'CASA' | 'ADVERSARIO',
  fundamento: FundamentoScout,
  resultado: ResultadoEvento,
  atletaId?: string,
  numeroAdversario?: string
): SetPartida {
  if (lado === 'CASA') return registrarEvento(set, fundamento, resultado, atletaId)
  const natural = encerraRallyDe(fundamento, resultado)
  const encerra: 'CASA' | 'ADVERSARIO' | null = natural === null ? null : natural === 'CASA' ? 'ADVERSARIO' : 'CASA'
  const evento: RallyEvento = {
    id: uid(), fundamento, resultado, encerraRally: encerra,
    ladoResponsavel: 'ADVERSARIO', numeroAdversario, timestamp: nowISO(),
  }
  return aplicarEvento(set, evento)
}

function encerraFoiRegistrado(rally: Rally): boolean {
  return rally.eventos.some((e) => e.encerraRally !== null)
}

/** Quantos pontos são precisos para fechar ESTE set. Usa `pontosSetNormal`/
 *  `pontosSetDecisivo` da partida quando o treinador configurou um valor
 *  próprio (ex.: "21 pontos" — pedido 22/10/2026); senão cai nos padrões do
 *  `formato` escolhido (CONFIG_FORMATO), igual sempre funcionou. A regra de
 *  vencer por 2 de diferença (em `setEstaFechado`) vale pra qualquer valor,
 *  então "pode passar se precisar" já funciona sozinho. */
export function pontosParaFecharSet(partida: Pick<Partida, 'formato' | 'pontosSetNormal' | 'pontosSetDecisivo'>, numeroSet: number): number {
  const cfg = CONFIG_FORMATO[partida.formato]
  const ehDecisivo = numeroSet === cfg.totalSets
  if (ehDecisivo) return partida.pontosSetDecisivo ?? cfg.pontosDecisivo
  return partida.pontosSetNormal ?? 25
}

export function setEstaFechado(set: SetPartida, partida: Pick<Partida, 'formato' | 'pontosSetNormal' | 'pontosSetDecisivo'>): 'CASA' | 'ADVERSARIO' | null {
  const alvo = pontosParaFecharSet(partida, set.numero)
  const { placarCasa, placarAdversario } = set
  const diff = Math.abs(placarCasa - placarAdversario)
  if (placarCasa >= alvo && diff >= 2) return 'CASA'
  if (placarAdversario >= alvo && diff >= 2) return 'ADVERSARIO'
  return null
}

/** Depois de fechar um set, decide se a partida acabou — considerando o formato
 *  escolhido (item pedido pelo Henrique: cada campeonato tem um formato próprio):
 *  - Melhor de 3 / Melhor de 5: acaba assim que um lado atinge os sets necessários.
 *  - 3 sets obrigatórios de 25: sempre joga os 3 sets, mesmo que um lado já tenha
 *    vencido os 2 primeiros — só decide o resultado (não empata o placar de sets). */
export function partidaEstaFinalizada(formato: FormatoPartida, setsGanhosCasa: number, setsGanhosAdversario: number, setsJogados: number): boolean {
  const cfg = CONFIG_FORMATO[formato]
  if (cfg.obrigaTodosOsSets) return setsJogados >= cfg.totalSets
  return setsGanhosCasa >= cfg.setsParaVencer || setsGanhosAdversario >= cfg.setsParaVencer
}

export function resumoFormato(partida: Pick<Partida, 'formato'>): string {
  const cfg = CONFIG_FORMATO[partida.formato]
  if (partida.formato === 'TRES_OBRIGATORIOS_25') return '3 sets obrigatórios de 25 pontos'
  return `Melhor de ${cfg.totalSets} sets (decisivo a ${cfg.pontosDecisivo})`
}

export const FUNDAMENTOS_SCOUT: FundamentoScout[] = [
  'saque', 'recepcao', 'levantamento', 'ataque', 'bloqueio', 'defesa',
  'bola_de_graca', 'bola_de_segunda', 'nao_deslocou',
]

/** Os 3 "pontos específicos" (pedido 23/10/2026, ajustado) — sem Bom/Médio/Em
 *  jogo, só acontecem ou não. Bola de graça e bola de 2ª/largada são jogadas
 *  que dão certo: ponto pra quem fez. Não deslocou é erro de posicionamento:
 *  ponto pro outro lado. Usado pra separar o botão deles do grid normal de
 *  fundamentos na tela de scout ao vivo. */
export const SITUACOES_ESPECIFICAS: FundamentoScout[] = ['bola_de_graca', 'bola_de_segunda', 'nao_deslocou']

export interface LinhaFundamento {
  positivo: number // ACERTO (saque/ataque/bloqueio) ou BOM (recepção/levantamento/defesa)
  neutro: number // EM_JOGO ou MEDIO
  erro: number
  total: number
  eficiencia: number // (positivo - erro) / total * 100, arredondado
}

export function linhaVazia(): LinhaFundamento {
  return { positivo: 0, neutro: 0, erro: 0, total: 0, eficiencia: 0 }
}

export function porFundamentoVazio(): Record<FundamentoScout, LinhaFundamento> {
  const vazio = {} as Record<FundamentoScout, LinhaFundamento>
  for (const f of FUNDAMENTOS_SCOUT) vazio[f] = linhaVazia()
  return vazio
}

/** Monta o scout completo de um conjunto de sets (um set só, ou a partida inteira),
 *  por atleta e por fundamento — reconstrói o "relatório individual por jogo" das
 *  rodadas anteriores a partir dos eventos de rally já registrados (ao vivo ou
 *  recuperados do Supabase). Só inclui atletas que tiveram pelo menos um evento
 *  registrado no(s) set(s) analisado(s). */
export function scoutPorAtleta(sets: Pick<Partida, 'setsPartida'>['setsPartida']): Array<{ atletaId: string; porFundamento: Record<FundamentoScout, LinhaFundamento>; totalGeral: LinhaFundamento }> {
  const porAtleta = new Map<string, Record<FundamentoScout, LinhaFundamento>>()

  for (const set of sets) {
    for (const rally of set.rallies) {
      for (const ev of rally.eventos) {
        if (!ev.atletaId || ev.ladoResponsavel === 'ADVERSARIO') continue
        if (!porAtleta.has(ev.atletaId)) {
          const vazio = {} as Record<FundamentoScout, LinhaFundamento>
          for (const f of FUNDAMENTOS_SCOUT) vazio[f] = linhaVazia()
          porAtleta.set(ev.atletaId, vazio)
        }
        const linha = porAtleta.get(ev.atletaId)![ev.fundamento]
        linha.total += 1
        if (ev.resultado === 'ACERTO' || ev.resultado === 'BOM') linha.positivo += 1
        else if (ev.resultado === 'EM_JOGO' || ev.resultado === 'MEDIO') linha.neutro += 1
        else if (ev.resultado === 'ERRO') linha.erro += 1
      }
    }
  }

  const resultado: Array<{ atletaId: string; porFundamento: Record<FundamentoScout, LinhaFundamento>; totalGeral: LinhaFundamento }> = []
  for (const [atletaId, porFundamento] of porAtleta) {
    for (const f of FUNDAMENTOS_SCOUT) {
      const l = porFundamento[f]
      l.eficiencia = l.total > 0 ? Math.round(((l.positivo - l.erro) / l.total) * 100) : 0
    }
    const totalGeral = linhaVazia()
    for (const f of FUNDAMENTOS_SCOUT) {
      totalGeral.positivo += porFundamento[f].positivo
      totalGeral.neutro += porFundamento[f].neutro
      totalGeral.erro += porFundamento[f].erro
      totalGeral.total += porFundamento[f].total
    }
    totalGeral.eficiencia = totalGeral.total > 0 ? Math.round(((totalGeral.positivo - totalGeral.erro) / totalGeral.total) * 100) : 0
    resultado.push({ atletaId, porFundamento, totalGeral })
  }
  return resultado.sort((a, b) => b.totalGeral.total - a.totalGeral.total)
}

/** Monta a mesma tabela por-fundamento (positivo/neutro/erro/total/eficiência)
 *  que `scoutPorAtleta` calcula, mas a partir de uma lista "achatada" de
 *  eventos (sem precisar da árvore partida→set→rally) — usado pelo Portal da
 *  Atleta, que recebe só uma lista plana de eventos da RPC `atleta_login`
 *  (ver src/atletaAuth.ts), sem os ids/estrutura completos de rally. */
export function linhaDeEventos(eventos: Pick<RallyEvento, 'fundamento' | 'resultado'>[]): Record<FundamentoScout, LinhaFundamento> {
  const totais = porFundamentoVazio()
  for (const ev of eventos) {
    const l = totais[ev.fundamento]
    l.total += 1
    if (ev.resultado === 'ACERTO' || ev.resultado === 'BOM') l.positivo += 1
    else if (ev.resultado === 'EM_JOGO' || ev.resultado === 'MEDIO') l.neutro += 1
    else if (ev.resultado === 'ERRO') l.erro += 1
  }
  for (const f of FUNDAMENTOS_SCOUT) {
    const l = totais[f]
    l.eficiencia = l.total > 0 ? Math.round(((l.positivo - l.erro) / l.total) * 100) : 0
  }
  return totais
}

export const LABEL_FUNDAMENTO: Record<FundamentoScout, string> = {
  saque: 'Saque', recepcao: 'Recepção', levantamento: 'Levantamento',
  ataque: 'Ataque', bloqueio: 'Bloqueio', defesa: 'Defesa',
  bola_de_graca: 'Bola de graça', bola_de_segunda: 'Bola de 2ª', nao_deslocou: 'Não deslocou',
}

/** Totais da EQUIPE (somando todas as atletas) por fundamento, pra alimentar as
 *  barrinhas de visão geral de um set (ou da partida inteira). */
export function scoutEquipe(sets: Pick<Partida, 'setsPartida'>['setsPartida']): Record<FundamentoScout, LinhaFundamento> {
  const totais = {} as Record<FundamentoScout, LinhaFundamento>
  for (const f of FUNDAMENTOS_SCOUT) totais[f] = linhaVazia()
  for (const set of sets) {
    for (const rally of set.rallies) {
      for (const ev of rally.eventos) {
        if (ev.ladoResponsavel === 'ADVERSARIO') continue
        const l = totais[ev.fundamento]
        l.total += 1
        if (ev.resultado === 'ACERTO' || ev.resultado === 'BOM') l.positivo += 1
        else if (ev.resultado === 'EM_JOGO' || ev.resultado === 'MEDIO') l.neutro += 1
        else if (ev.resultado === 'ERRO') l.erro += 1
      }
    }
  }
  for (const f of FUNDAMENTOS_SCOUT) {
    const l = totais[f]
    l.eficiencia = l.total > 0 ? Math.round(((l.positivo - l.erro) / l.total) * 100) : 0
  }
  return totais
}

/** Eficiência GERAL da equipe (todos os fundamentos somados num número só) —
 *  pedido 30/10/2026 pra comparar sets entre si e acompanhar a evolução da
 *  equipe ao longo da temporada sem precisar abrir fundamento por fundamento.
 *  Sempre recalculada a partir de `scoutEquipe` (mesma fonte de verdade das
 *  outras telas) — nunca é a média dos percentuais de cada fundamento, é o
 *  total positivo/erro de TODAS as ações dividido pelo total de ações. */
export function eficienciaGeralEquipe(sets: Pick<Partida, 'setsPartida'>['setsPartida']): LinhaFundamento {
  const equipe = scoutEquipe(sets)
  const geral = linhaVazia()
  for (const f of FUNDAMENTOS_SCOUT) {
    geral.positivo += equipe[f].positivo
    geral.neutro += equipe[f].neutro
    geral.erro += equipe[f].erro
    geral.total += equipe[f].total
  }
  geral.eficiencia = geral.total > 0 ? Math.round(((geral.positivo - geral.erro) / geral.total) * 100) : 0
  return geral
}

/** Desfaz o último evento marcado no set — pedido 22/10/2026 pra corrigir um
 *  toque errado sem precisar recomeçar o set. Se o evento removido era o que
 *  tinha fechado o rally (somado o ponto), desfaz o ponto também e deixa o
 *  rally em aberto de novo; se era o único evento do rally, remove o rally
 *  inteiro. Não faz nada se o set ainda não tem nenhum evento. */
export function desfazerUltimoEvento(set: SetPartida): SetPartida {
  if (set.rallies.length === 0) return set
  const rallies = [...set.rallies]
  const ultimoRally = rallies[rallies.length - 1]
  if (ultimoRally.eventos.length === 0) return set
  const eventoRemovido = ultimoRally.eventos[ultimoRally.eventos.length - 1]
  const eventosRestantes = ultimoRally.eventos.slice(0, -1)
  const fechavaRally = eventoRemovido.encerraRally !== null

  let placarCasa = set.placarCasa
  let placarAdversario = set.placarAdversario
  if (fechavaRally) {
    if (eventoRemovido.encerraRally === 'CASA') placarCasa -= 1
    else placarAdversario -= 1
  }

  if (eventosRestantes.length === 0) {
    rallies.pop()
    return { ...set, rallies, placarCasa, placarAdversario }
  }

  rallies[rallies.length - 1] = {
    ...ultimoRally,
    eventos: eventosRestantes,
    // Com a marcação que fechava removida, o rally volta a ficar "em
    // andamento" — mesmo estado de quando foi criado, pra próxima marcação
    // poder tanto continuar quanto fechar ele de novo.
    pontoCasa: fechavaRally ? false : ultimoRally.pontoCasa,
    placarCasaApos: placarCasa,
    placarAdversarioApos: placarAdversario,
  }
  return { ...set, rallies, placarCasa, placarAdversario }
}

/** Lista TODOS os eventos do set em ordem cronológica, achatando a árvore
 *  rallies→eventos — inclui eventos nossos e do adversário. É a base pra
 *  mostrar "o histórico do set" numa tela de correção e pra `corrigirEvento`
 *  reconstruir o set do zero. */
export function listarEventosDoSet(set: SetPartida): RallyEvento[] {
  return set.rallies.flatMap((r) => r.eventos)
}

/** Reconstrói o set inteiro a partir de uma lista de eventos JÁ NA ORDEM
 *  cronológica certa — nunca mexe no placar ou nos rallies "na mão": reaplica
 *  cada evento com a mesma lógica (`encerraRallyDe`) que o scout ao vivo usa
 *  pra registrar normalmente. É a base de `corrigirEvento`: garante que uma
 *  correção de fundamento/resultado recalcule o fechamento do rally e o
 *  placar certinho, nunca deixando divergência entre os eventos e o placar
 *  mostrado. Preserva id/número/escalação/substituições do set original —
 *  só placar e rallies são recalculados. */
function reconstruirSetDeEventos(setBase: SetPartida, eventos: RallyEvento[]): SetPartida {
  let novo: SetPartida = { ...setBase, placarCasa: 0, placarAdversario: 0, rallies: [] }
  for (const ev of eventos) {
    // Recalcula encerraRally do zero (nunca confia no valor já salvo no
    // evento) — é o que garante que corrigir o fundamento/resultado de um
    // evento também corrija se/pra quem o rally fechou.
    const natural = encerraRallyDe(ev.fundamento, ev.resultado)
    const encerra: 'CASA' | 'ADVERSARIO' | null =
      ev.ladoResponsavel === 'ADVERSARIO'
        ? natural === null ? null : natural === 'CASA' ? 'ADVERSARIO' : 'CASA'
        : natural
    novo = aplicarEvento(novo, { ...ev, encerraRally: encerra })
  }
  return novo
}

/** Corrige um evento ESPECÍFICO do passado — não precisa ser o último (pedido
 *  30/10/2026: "melhorar o desfazer" pra poder corrigir a atleta, o
 *  fundamento ou o resultado de um lançamento feito errado, sem perder o
 *  resto do set). Nunca apaga o evento nem o reescreve às cegas: troca só os
 *  campos passados em `correcao` e reconstrói o set inteiro a partir da lista
 *  de eventos (`reconstruirSetDeEventos`) — placar e fechamento de rally saem
 *  sempre recalculados dos eventos, igual aconteceria se a correção tivesse
 *  sido digitada certa desde o início. Guarda a correção em `set.correcoes`
 *  (histórico auditável, nunca apagado). Não faz nada se o evento não existir
 *  no set, ou se a correção não mudar nada de verdade. */
export function corrigirEvento(
  set: SetPartida,
  eventoId: string,
  correcao: { atletaId?: string; fundamento?: FundamentoScout; resultado?: ResultadoEvento; numeroAdversario?: string }
): SetPartida {
  const eventosOriginais = listarEventosDoSet(set)
  const alvo = eventosOriginais.find((e) => e.id === eventoId)
  if (!alvo) return set

  const depois: RallyEvento = {
    ...alvo,
    atletaId: 'atletaId' in correcao ? correcao.atletaId : alvo.atletaId,
    fundamento: correcao.fundamento ?? alvo.fundamento,
    resultado: correcao.resultado ?? alvo.resultado,
    numeroAdversario: 'numeroAdversario' in correcao ? correcao.numeroAdversario : alvo.numeroAdversario,
  }

  const mudouAlgo =
    depois.atletaId !== alvo.atletaId || depois.fundamento !== alvo.fundamento ||
    depois.resultado !== alvo.resultado || depois.numeroAdversario !== alvo.numeroAdversario
  if (!mudouAlgo) return set

  const eventosCorrigidos = eventosOriginais.map((e) => (e.id === eventoId ? depois : e))
  const reconstruido = reconstruirSetDeEventos(set, eventosCorrigidos)

  const registro: CorrecaoEvento = {
    id: uid(),
    eventoId,
    antes: { atletaId: alvo.atletaId, fundamento: alvo.fundamento, resultado: alvo.resultado, numeroAdversario: alvo.numeroAdversario },
    depois: { atletaId: depois.atletaId, fundamento: depois.fundamento, resultado: depois.resultado, numeroAdversario: depois.numeroAdversario },
    timestamp: nowISO(),
  }

  return { ...reconstruido, correcoes: [...(set.correcoes ?? []), registro] }
}

export interface SideOutBreakPoint {
  sideOutPontos: number
  sideOutOportunidades: number
  sideOutPct: number
  breakPontos: number
  breakOportunidades: number
  breakPct: number
}

/** Side-out % (eficiência quando RECEBEMOS, ou seja, o adversário estava
 *  sacando) e break point % (eficiência quando NÓS sacávamos) — pedido
 *  30/10/2026, uma das estatísticas mais usadas no vôlei de alto nível,
 *  porque a eficiência GERAL esconde se o time está sofrendo mais no saque
 *  ou na recepção. Não precisa de nenhum dado novo no scout ao vivo: só
 *  reconstrói, rally a rally, quem estava sacando quando aquele rally
 *  começou (mesma lógica de "servindo" de `calcularRotacao`, mas sem
 *  precisar da escalação/ficha de posição — só de `primeiroSaque`). Sets sem
 *  `primeiroSaque` definido (ex.: dados muito antigos) são ignorados, nunca
 *  inventados. */
export function sideOutBreakPoint(sets: Pick<Partida, 'setsPartida'>['setsPartida']): SideOutBreakPoint {
  let sideOutPontos = 0, sideOutOportunidades = 0, breakPontos = 0, breakOportunidades = 0
  for (const set of sets) {
    if (!set.primeiroSaque) continue
    let servindo: 'CASA' | 'ADVERSARIO' = set.primeiroSaque
    for (const rally of set.rallies) {
      const fechado = rally.eventos.some((e) => e.encerraRally !== null)
      if (!fechado) continue
      const ganhou: 'CASA' | 'ADVERSARIO' = rally.pontoCasa ? 'CASA' : 'ADVERSARIO'
      if (servindo === 'ADVERSARIO') {
        sideOutOportunidades += 1
        if (ganhou === 'CASA') sideOutPontos += 1
      } else {
        breakOportunidades += 1
        if (ganhou === 'CASA') breakPontos += 1
      }
      if (ganhou !== servindo) servindo = ganhou
    }
  }
  return {
    sideOutPontos, sideOutOportunidades,
    sideOutPct: sideOutOportunidades > 0 ? Math.round((sideOutPontos / sideOutOportunidades) * 100) : 0,
    breakPontos, breakOportunidades,
    breakPct: breakOportunidades > 0 ? Math.round((breakPontos / breakOportunidades) * 100) : 0,
  }
}

export interface SequenciaPontos {
  lado: 'CASA' | 'ADVERSARIO'
  tamanho: number
  placarCasaAntes: number
  placarAdversarioAntes: number
  placarCasaDepois: number
  placarAdversarioDepois: number
}

/** Sequências de pontos seguidos (runs) de um set — pedido 30/10/2026, pra
 *  saber quando o jogo "escapou" (ex.: adversário fez 5 pontos seguidos) e
 *  ajudar a decidir quando pedir tempo. Calculada 100% a partir do
 *  `pontoAPontoDoSet` que já existe — nenhum dado novo precisa ser
 *  registrado no scout ao vivo. Só retorna sequências com `tamanho >=
 *  minimoParaDestaque` (padrão 3, pra não poluir com sequências de 1-2
 *  pontos que são normais em qualquer set). */
export function sequenciasDePontos(set: SetPartida, minimoParaDestaque = 3): SequenciaPontos[] {
  const pontos = pontoAPontoDoSet(set)
  const sequencias: SequenciaPontos[] = []
  let i = 0
  while (i < pontos.length) {
    const lado: 'CASA' | 'ADVERSARIO' = pontos[i].ganhouCasa ? 'CASA' : 'ADVERSARIO'
    let j = i
    while (j < pontos.length && (pontos[j].ganhouCasa ? 'CASA' : 'ADVERSARIO') === lado) j += 1
    const tamanho = j - i
    if (tamanho >= minimoParaDestaque) {
      const antes = i === 0 ? { placarCasa: 0, placarAdversario: 0 } : pontos[i - 1]
      const depois = pontos[j - 1]
      sequencias.push({
        lado, tamanho,
        placarCasaAntes: antes.placarCasa, placarAdversarioAntes: antes.placarAdversario,
        placarCasaDepois: depois.placarCasa, placarAdversarioDepois: depois.placarAdversario,
      })
    }
    i = j
  }
  return sequencias
}

/** A maior sequência de pontos seguidos (de qualquer um dos dois lados) em
 *  toda a partida, com o número do set em que aconteceu — usada no
 *  destaque do relatório. `null` se o set ainda não tem nenhum rally fechado. */
export function maiorSequenciaPartida(sets: SetPartida[]): (SequenciaPontos & { setNumero: number }) | null {
  let maior: (SequenciaPontos & { setNumero: number }) | null = null
  for (const set of sets) {
    for (const seq of sequenciasDePontos(set, 1)) {
      if (!maior || seq.tamanho > maior.tamanho) maior = { ...seq, setNumero: set.numero }
    }
  }
  return maior
}

/** Soma várias `LinhaFundamento` numa só, recalculando a eficiência do total
 *  (nunca a média das eficiências individuais) — útil pra juntar o mesmo tipo
 *  de estatística de várias partidas/sets numa única linha. */
export function combinarLinhas(linhas: LinhaFundamento[]): LinhaFundamento {
  const total = linhaVazia()
  for (const l of linhas) {
    total.positivo += l.positivo
    total.neutro += l.neutro
    total.erro += l.erro
    total.total += l.total
  }
  total.eficiencia = total.total > 0 ? Math.round(((total.positivo - total.erro) / total.total) * 100) : 0
  return total
}

export interface DesempenhoDecisivo {
  decisivo: LinhaFundamento
  normal: LinhaFundamento
}

/** Um rally é "decisivo" quando o set já está na reta final — pedido
 *  30/10/2026. Considera reta final os últimos ~5 pontos antes do alvo de
 *  vitória do set configurado (`pontosParaFecharSet`, que já respeita o
 *  formato e a pontuação própria de CADA partida/set — nunca um número fixo
 *  igual pra todo mundo), e continua valendo além do alvo em caso de
 *  vantagem/deuce (o `Math.max` nunca para de crescer). */
function rallyEhDecisivo(set: SetPartida, partida: Pick<Partida, 'formato' | 'pontosSetNormal' | 'pontosSetDecisivo'>, placarCasaAntes: number, placarAdversarioAntes: number): boolean {
  const alvo = pontosParaFecharSet(partida, set.numero)
  return Math.max(placarCasaAntes, placarAdversarioAntes) >= alvo - 5
}

/** Eficiência da equipe em pontos DECISIVOS (reta final do set) comparada
 *  com o resto do set — pedido 30/10/2026: um time pode ter uma eficiência
 *  geral boa mas travar justamente na hora de fechar, e isso fica escondido
 *  dentro da média. Calculada 100% a partir dos eventos já registrados (só
 *  das nossas ações, igual `scoutEquipe`) — nenhum dado novo precisa ser
 *  registrado no scout ao vivo. */
export function desempenhoEmPontosDecisivos(sets: SetPartida[], partida: Pick<Partida, 'formato' | 'pontosSetNormal' | 'pontosSetDecisivo'>): DesempenhoDecisivo {
  const decisivo = linhaVazia()
  const normal = linhaVazia()
  for (const set of sets) {
    let placarCasaAntes = 0
    let placarAdversarioAntes = 0
    for (const rally of set.rallies) {
      const ehDecisivo = rallyEhDecisivo(set, partida, placarCasaAntes, placarAdversarioAntes)
      const alvo = ehDecisivo ? decisivo : normal
      for (const ev of rally.eventos) {
        if (ev.ladoResponsavel === 'ADVERSARIO') continue
        alvo.total += 1
        if (ev.resultado === 'ACERTO' || ev.resultado === 'BOM') alvo.positivo += 1
        else if (ev.resultado === 'EM_JOGO' || ev.resultado === 'MEDIO') alvo.neutro += 1
        else if (ev.resultado === 'ERRO') alvo.erro += 1
      }
      if (rally.eventos.some((e) => e.encerraRally !== null)) {
        placarCasaAntes = rally.placarCasaApos
        placarAdversarioAntes = rally.placarAdversarioApos
      }
    }
  }
  decisivo.eficiencia = decisivo.total > 0 ? Math.round(((decisivo.positivo - decisivo.erro) / decisivo.total) * 100) : 0
  normal.eficiencia = normal.total > 0 ? Math.round(((normal.positivo - normal.erro) / normal.total) * 100) : 0
  return { decisivo, normal }
}

export interface ImpactoSubstituicao {
  antes: LinhaFundamento
  depois: LinhaFundamento
}

/** Eficiência da equipe nos rallies ANTES e DEPOIS de uma substituição
 *  específica (pedido 30/10/2026) — mostra se a troca ajudou ou atrapalhou,
 *  sem precisar adivinhar. Usa o mesmo marco (`aposRallyFechado`) que
 *  `calcularRotacao` usa pra saber quando a troca passou a valer: os
 *  rallies até o N-ésimo fechado contam como "antes", os de lá pra frente
 *  como "depois" — tudo dentro do MESMO set da troca. `null` se a
 *  substituição não existir nesse set. */
export function impactoSubstituicao(set: SetPartida, substituicaoId: string): ImpactoSubstituicao | null {
  const sub = (set.substituicoes ?? []).find((s) => s.id === substituicaoId)
  if (!sub) return null
  const antes = linhaVazia()
  const depois = linhaVazia()
  let fechados = 0
  for (const rally of set.rallies) {
    const estaAntes = fechados < sub.aposRallyFechado
    const alvo = estaAntes ? antes : depois
    for (const ev of rally.eventos) {
      if (ev.ladoResponsavel === 'ADVERSARIO') continue
      alvo.total += 1
      if (ev.resultado === 'ACERTO' || ev.resultado === 'BOM') alvo.positivo += 1
      else if (ev.resultado === 'EM_JOGO' || ev.resultado === 'MEDIO') alvo.neutro += 1
      else if (ev.resultado === 'ERRO') alvo.erro += 1
    }
    if (rally.eventos.some((e) => e.encerraRally !== null)) fechados += 1
  }
  antes.eficiencia = antes.total > 0 ? Math.round(((antes.positivo - antes.erro) / antes.total) * 100) : 0
  depois.eficiencia = depois.total > 0 ? Math.round(((depois.positivo - depois.erro) / depois.total) * 100) : 0
  return { antes, depois }
}

function normalizarNomeAdversario(nome: string): string {
  return nome.trim().toLowerCase()
}

export interface ConfrontoDireto {
  jogos: Partida[]
  vitorias: number
  derrotas: number
  eficienciaGeral: LinhaFundamento
  piorFundamentoNosso: FundamentoScout | null
}

/** Confronto direto contra um adversário específico (pedido 30/10/2026) —
 *  junta todas as partidas JÁ FINALIZADAS dessa turma contra o mesmo
 *  adversário (comparando `adversarioNome` normalizado — maiúsculas/espaços
 *  não importam — porque nem toda partida tem `adversarioId` preenchido:
 *  partidas criadas direto pela tela da turma só ganham o nome do adversário
 *  depois, editado em Histórico, sem passar pelo cadastro de Adversario).
 *  Pra não arriscar deixar partida de fora por causa de um ID que às vezes
 *  nem existe, o critério é sempre o nome. */
export function confrontoDireto(partidas: Partida[], turmaId: string, adversarioNome: string): ConfrontoDireto {
  const alvo = normalizarNomeAdversario(adversarioNome)
  const jogos = partidas
    .filter((p) => !p.deletedAt && p.tipo === 'JOGO' && p.status === 'FINALIZADA' && p.turmaId === turmaId && p.adversarioNome && normalizarNomeAdversario(p.adversarioNome) === alvo)
    .sort((a, b) => b.data.localeCompare(a.data))
  const vitorias = jogos.filter((p) => p.setsGanhosCasa > p.setsGanhosAdversario).length
  const derrotas = jogos.length - vitorias
  const todosSets = jogos.flatMap((p) => p.setsPartida)
  const eficienciaGeral = eficienciaGeralEquipe(todosSets)
  const equipe = scoutEquipe(todosSets)
  let piorFundamentoNosso: FundamentoScout | null = null
  for (const f of FUNDAMENTOS_SCOUT) {
    if (equipe[f].total === 0) continue
    if (!piorFundamentoNosso || equipe[f].eficiencia < equipe[piorFundamentoNosso].eficiencia) piorFundamentoNosso = f
  }
  return { jogos, vitorias, derrotas, eficienciaGeral, piorFundamentoNosso }
}

/** Registra um erro do time ADVERSÁRIO (ex.: saque pra fora, invasão) — pedido
 *  22/10/2026 pra entender melhor o jogo do outro time. Sempre fecha o rally e
 *  soma ponto pra CASA (um erro do adversário é sempre nosso ponto). O número
 *  da camisa de quem errou é opcional — não trava o ritmo do scout ao vivo se
 *  o treinador não conseguir ver a tempo. */
export function registrarErroAdversario(set: SetPartida, fundamento: FundamentoScout, numeroAdversario?: string): SetPartida {
  return registrarEventoTime(set, 'ADVERSARIO', fundamento, 'ERRO', undefined, numeroAdversario)
}

export interface LinhaErroAdversario { total: number; porNumero: Record<string, number> }

/** Quantos erros o time ADVERSÁRIO cometeu em cada fundamento (e, quando o
 *  número da camisa foi anotado, por jogadora) — alimenta o relatório rápido
 *  entre sets ("qual fundamento o outro time mais errou") e a análise do
 *  adversário no relatório final da partida. Conta só os eventos com
 *  resultado = ERRO — desde 23/10/2026 o adversário também pode ter eventos
 *  de PONTO (quando ele que marcou), que não entram aqui. */
export function erroPorFundamentoAdversario(sets: Pick<Partida, 'setsPartida'>['setsPartida']): Record<FundamentoScout, LinhaErroAdversario> {
  const totais = {} as Record<FundamentoScout, LinhaErroAdversario>
  for (const f of FUNDAMENTOS_SCOUT) totais[f] = { total: 0, porNumero: {} }
  for (const set of sets) {
    for (const rally of set.rallies) {
      for (const ev of rally.eventos) {
        if (ev.ladoResponsavel !== 'ADVERSARIO' || ev.resultado !== 'ERRO') continue
        totais[ev.fundamento].total += 1
        if (ev.numeroAdversario) {
          const chave = ev.numeroAdversario
          totais[ev.fundamento].porNumero[chave] = (totais[ev.fundamento].porNumero[chave] ?? 0) + 1
        }
      }
    }
  }
  return totais
}

/** Quantos pontos o adversário marcou diretamente (ACERTO em cima de nós) em
 *  cada fundamento — complementa `erroPorFundamentoAdversario` pra mostrar o
 *  outro lado da análise do time adversário. */
export function pontosPorFundamentoAdversario(sets: Pick<Partida, 'setsPartida'>['setsPartida']): Record<FundamentoScout, LinhaErroAdversario> {
  const totais = {} as Record<FundamentoScout, LinhaErroAdversario>
  for (const f of FUNDAMENTOS_SCOUT) totais[f] = { total: 0, porNumero: {} }
  for (const set of sets) {
    for (const rally of set.rallies) {
      for (const ev of rally.eventos) {
        if (ev.ladoResponsavel !== 'ADVERSARIO' || ev.resultado !== 'ACERTO') continue
        totais[ev.fundamento].total += 1
        if (ev.numeroAdversario) {
          const chave = ev.numeroAdversario
          totais[ev.fundamento].porNumero[chave] = (totais[ev.fundamento].porNumero[chave] ?? 0) + 1
        }
      }
    }
  }
  return totais
}

/** Calcula o rodízio atual do NOSSO time: quem está em cada posição (1 a 6,
 *  índice 0 = posição 1) e quem está sacando agora — a partir da escalação
 *  inicial do set e do resultado de cada rally já fechado. Segue a regra
 *  oficial do vôlei: só giramos quando GANHAMOS o saque de volta (viramos
 *  sacadoras vindo de recepção) — não a cada ponto. Retorna `null` se o set
 *  ainda não tem escalação definida (aguardando a "papeleta"). */
export function calcularRotacao(set: SetPartida): { posicoes: string[]; servindo: 'CASA' | 'ADVERSARIO' } | null {
  if (!set.escalacaoInicial || set.escalacaoInicial.length !== 6 || !set.primeiroSaque) return null
  let posicoes = [...set.escalacaoInicial]
  let servindo: 'CASA' | 'ADVERSARIO' = set.primeiroSaque
  let fechados = 0
  const subs = set.substituicoes ?? []

  function aplicarSubsEm(marco: number) {
    for (const sub of subs) {
      if (sub.aposRallyFechado === marco) {
        posicoes = posicoes.map((p, i) => (i === sub.posicaoIndex ? sub.atletaEntraId : p))
      }
    }
  }

  aplicarSubsEm(0) // trocas feitas antes de qualquer rally fechar neste set
  for (const rally of set.rallies) {
    const fechado = rally.eventos.some((e) => e.encerraRally !== null)
    if (!fechado) continue // rally ainda em andamento — ainda não decidiu o saque seguinte
    const ladoQueGanhou: 'CASA' | 'ADVERSARIO' = rally.pontoCasa ? 'CASA' : 'ADVERSARIO'
    if (ladoQueGanhou !== servindo) {
      if (ladoQueGanhou === 'CASA') posicoes = [...posicoes.slice(1), posicoes[0]]
      servindo = ladoQueGanhou
    }
    fechados += 1
    aplicarSubsEm(fechados)
  }
  return { posicoes, servindo }
}

/** Troca uma atleta em quadra por uma reserva, no meio do set (pedido
 *  23/10/2026) — guarda só QUANDO aconteceu (quantos rallies já tinham
 *  fechado), pra `calcularRotacao` aplicar a troca no ponto certo do rodízio. */
export function aplicarSubstituicao(set: SetPartida, posicaoIndex: number, atletaEntraId: string): SetPartida {
  const aposRallyFechado = set.rallies.filter((r) => r.eventos.some((e) => e.encerraRally !== null)).length
  const sub: Substituicao = { id: uid(), aposRallyFechado, posicaoIndex, atletaEntraId, timestamp: nowISO() }
  return { ...set, substituicoes: [...(set.substituicoes ?? []), sub] }
}

export interface LinhaPosicao { pontos: number; erros: number }

/** Desempenho por posição da ficha (I a VI, índice 0 a 5) — pedido 23/10/2026:
 *  "em qual posição tomamos mais pontos e em qual fomos melhores". Reconstrói
 *  o rodízio igual a `calcularRotacao`, mas a cada rally fechado por um evento
 *  NOSSO (tem atletaId, não é do adversário) soma em `pontos` (quando o
 *  resultado foi positivo e fechou pra nós) ou em `erros` (quando foi erro e
 *  fechou pro adversário) — sempre na posição em que a atleta responsável
 *  estava QUANDO o rally fechou. Rallies decididos por um evento do
 *  adversário (sem atleta nossa responsável) não entram aqui — não dá pra
 *  atribuir a uma posição específica da ficha. Retorna `null` se o set ainda
 *  não tem escalação (igual `calcularRotacao`). */
export function analisePorPosicao(set: SetPartida): Record<number, LinhaPosicao> | null {
  if (!set.escalacaoInicial || set.escalacaoInicial.length !== 6 || !set.primeiroSaque) return null
  let posicoes = [...set.escalacaoInicial]
  let servindo: 'CASA' | 'ADVERSARIO' = set.primeiroSaque
  let fechados = 0
  const subs = set.substituicoes ?? []
  const porPosicao: Record<number, LinhaPosicao> = { 0: { pontos: 0, erros: 0 }, 1: { pontos: 0, erros: 0 }, 2: { pontos: 0, erros: 0 }, 3: { pontos: 0, erros: 0 }, 4: { pontos: 0, erros: 0 }, 5: { pontos: 0, erros: 0 } }

  function aplicarSubsEm(marco: number) {
    for (const sub of subs) {
      if (sub.aposRallyFechado === marco) posicoes = posicoes.map((p, i) => (i === sub.posicaoIndex ? sub.atletaEntraId : p))
    }
  }

  aplicarSubsEm(0)
  for (const rally of set.rallies) {
    const eventoFechamento = rally.eventos.find((e) => e.encerraRally !== null)
    if (!eventoFechamento) continue
    if (eventoFechamento.atletaId && eventoFechamento.ladoResponsavel !== 'ADVERSARIO') {
      const idx = posicoes.indexOf(eventoFechamento.atletaId)
      if (idx !== -1) {
        if (eventoFechamento.encerraRally === 'CASA') porPosicao[idx].pontos += 1
        else porPosicao[idx].erros += 1
      }
    }
    const ladoQueGanhou: 'CASA' | 'ADVERSARIO' = rally.pontoCasa ? 'CASA' : 'ADVERSARIO'
    if (ladoQueGanhou !== servindo) {
      if (ladoQueGanhou === 'CASA') posicoes = [...posicoes.slice(1), posicoes[0]]
      servindo = ladoQueGanhou
    }
    fechados += 1
    aplicarSubsEm(fechados)
  }
  return porPosicao
}

/** Soma `analisePorPosicao` de vários sets (relatório da partida inteira) —
 *  sets sem escalação (ex.: treino) são simplesmente ignorados. */
export function analisePorPosicaoPartida(sets: SetPartida[]): Record<number, LinhaPosicao> {
  const total: Record<number, LinhaPosicao> = { 0: { pontos: 0, erros: 0 }, 1: { pontos: 0, erros: 0 }, 2: { pontos: 0, erros: 0 }, 3: { pontos: 0, erros: 0 }, 4: { pontos: 0, erros: 0 }, 5: { pontos: 0, erros: 0 } }
  for (const set of sets) {
    const porSet = analisePorPosicao(set)
    if (!porSet) continue
    for (let idx = 0; idx < 6; idx++) {
      total[idx].pontos += porSet[idx].pontos
      total[idx].erros += porSet[idx].erros
    }
  }
  return total
}

export interface LinhaPosicaoAtleta { positivo: number; neutro: number; erro: number; total: number; eficiencia: number }

function linhaPosicaoAtletaVazia(): LinhaPosicaoAtleta {
  return { positivo: 0, neutro: 0, erro: 0, total: 0, eficiencia: 0 }
}

/** "Em qual posição a atleta rende melhor" (pedido 23/10/2026, ajustado): pra
 *  cada atleta, soma TODAS as ações dela (não só as que fecham o rally — uma
 *  levantadora, por exemplo, quase nunca decide o ponto, mas ainda assim
 *  precisa aparecer aqui) na posição que ela ocupava QUANDO aquele rally
 *  começou, classificando positivo/neutro/erro exatamente como
 *  `scoutPorAtleta`. Reconstrói o rodízio set a set igual `calcularRotacao`. */
export function analisePorAtletaEPosicao(sets: SetPartida[]): Record<string, Record<number, LinhaPosicaoAtleta>> {
  const porAtleta = new Map<string, Record<number, LinhaPosicaoAtleta>>()

  function linhaDe(atletaId: string, idx: number): LinhaPosicaoAtleta {
    if (!porAtleta.has(atletaId)) {
      const vazio: Record<number, LinhaPosicaoAtleta> = { 0: linhaPosicaoAtletaVazia(), 1: linhaPosicaoAtletaVazia(), 2: linhaPosicaoAtletaVazia(), 3: linhaPosicaoAtletaVazia(), 4: linhaPosicaoAtletaVazia(), 5: linhaPosicaoAtletaVazia() }
      porAtleta.set(atletaId, vazio)
    }
    return porAtleta.get(atletaId)![idx]
  }

  for (const set of sets) {
    if (!set.escalacaoInicial || set.escalacaoInicial.length !== 6 || !set.primeiroSaque) continue
    let posicoes = [...set.escalacaoInicial]
    let servindo: 'CASA' | 'ADVERSARIO' = set.primeiroSaque
    let fechados = 0
    const subs = set.substituicoes ?? []

    function aplicarSubsEm(marco: number) {
      for (const sub of subs) {
        if (sub.aposRallyFechado === marco) posicoes = posicoes.map((p, i) => (i === sub.posicaoIndex ? sub.atletaEntraId : p))
      }
    }

    aplicarSubsEm(0)
    for (const rally of set.rallies) {
      // Posição de cada atleta QUANDO o rally começou — todas as ações dela
      // nesse rally (mesmo as que não decidem o ponto) contam aqui.
      for (const ev of rally.eventos) {
        if (!ev.atletaId || ev.ladoResponsavel === 'ADVERSARIO') continue
        const idx = posicoes.indexOf(ev.atletaId)
        if (idx === -1) continue
        const linha = linhaDe(ev.atletaId, idx)
        linha.total += 1
        if (ev.resultado === 'ACERTO' || ev.resultado === 'BOM') linha.positivo += 1
        else if (ev.resultado === 'EM_JOGO' || ev.resultado === 'MEDIO') linha.neutro += 1
        else if (ev.resultado === 'ERRO') linha.erro += 1
      }

      const fechado = rally.eventos.some((e) => e.encerraRally !== null)
      if (!fechado) continue
      const ladoQueGanhou: 'CASA' | 'ADVERSARIO' = rally.pontoCasa ? 'CASA' : 'ADVERSARIO'
      if (ladoQueGanhou !== servindo) {
        if (ladoQueGanhou === 'CASA') posicoes = [...posicoes.slice(1), posicoes[0]]
        servindo = ladoQueGanhou
      }
      fechados += 1
      aplicarSubsEm(fechados)
    }
  }

  const resultado: Record<string, Record<number, LinhaPosicaoAtleta>> = {}
  for (const [atletaId, porPosicao] of porAtleta) {
    for (let idx = 0; idx < 6; idx++) {
      const l = porPosicao[idx]
      l.eficiencia = l.total > 0 ? Math.round(((l.positivo - l.erro) / l.total) * 100) : 0
    }
    resultado[atletaId] = porPosicao
  }
  return resultado
}

export interface SubstituicaoDetalhada {
  id: string
  posicaoIndex: number
  atletaSaiId: string | null
  atletaEntraId: string
  placarCasaNoMomento: number
  placarAdversarioNoMomento: number
}

/** Lista as substituições de um set com contexto — quem saiu (reconstruído a
 *  partir do rodízio até aquele momento), quem entrou e o placar na hora da
 *  troca — pedido 23/10/2026 pra aparecer no relatório final. */
export function listaSubstituicoesDetalhada(set: SetPartida): SubstituicaoDetalhada[] {
  const subs = set.substituicoes ?? []
  if (subs.length === 0 || !set.escalacaoInicial) return []
  let posicoes = [...set.escalacaoInicial]
  let servindo: 'CASA' | 'ADVERSARIO' = set.primeiroSaque ?? 'CASA'
  let fechados = 0
  let placarCasa = 0
  let placarAdversario = 0
  const porOrdem = [...subs].sort((a, b) => a.aposRallyFechado - b.aposRallyFechado)
  const resultado: SubstituicaoDetalhada[] = []

  function aplicarSubsEm(marco: number) {
    for (const sub of porOrdem) {
      if (sub.aposRallyFechado === marco) {
        const atletaSaiId = posicoes[sub.posicaoIndex] ?? null
        resultado.push({
          id: sub.id, posicaoIndex: sub.posicaoIndex, atletaSaiId, atletaEntraId: sub.atletaEntraId,
          placarCasaNoMomento: placarCasa, placarAdversarioNoMomento: placarAdversario,
        })
        posicoes = posicoes.map((p, i) => (i === sub.posicaoIndex ? sub.atletaEntraId : p))
      }
    }
  }

  aplicarSubsEm(0)
  for (const rally of set.rallies) {
    const fechado = rally.eventos.some((e) => e.encerraRally !== null)
    if (!fechado) continue
    placarCasa = rally.placarCasaApos
    placarAdversario = rally.placarAdversarioApos
    const ladoQueGanhou: 'CASA' | 'ADVERSARIO' = rally.pontoCasa ? 'CASA' : 'ADVERSARIO'
    if (ladoQueGanhou !== servindo) {
      if (ladoQueGanhou === 'CASA') posicoes = [...posicoes.slice(1), posicoes[0]]
      servindo = ladoQueGanhou
    }
    fechados += 1
    aplicarSubsEm(fechados)
  }
  return resultado
}

export interface PontoDoSet {
  numero: number
  placarCasa: number
  placarAdversario: number
  ganhouCasa: boolean
}

/** Ponto a ponto de um set — pedido 23/10/2026, pra mostrar a "sequência" do
 *  set inteiro no relatório final (ex.: 1-0, 1-1, 2-1, 2-2, 3-2…). Só inclui
 *  rallies já fechados (com ponto decidido). */
export function pontoAPontoDoSet(set: SetPartida): PontoDoSet[] {
  return set.rallies
    .filter((r) => r.eventos.some((e) => e.encerraRally !== null))
    .map((r, i) => ({ numero: i + 1, placarCasa: r.placarCasaApos, placarAdversario: r.placarAdversarioApos, ganhouCasa: r.pontoCasa }))
}
