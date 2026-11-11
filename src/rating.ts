// Motor de rating por posição (pedido 23/10/2026, escala e função secundária
// ajustadas em 30/10/2026): transforma o scout acumulado de uma atleta num
// número único de 6.0 a 10.0, pesando cada fundamento de acordo com a
// importância dele pra posição (ou posições) que ela joga.
//
// Importante: os 3 "pontos específicos" (bola_de_graça, bola de 2ª, não
// deslocou) ficam de fora do cálculo — já eram excluídos de outras análises
// de "pior fundamento" no app (ver scoutEngine.ts), porque são situações que
// sempre viram ponto pro outro lado, não uma ação com Bom/Médio/Erro de
// verdade.
//
// O rating é recalculado sempre que a tela é aberta, a partir do scout atual
// — mas a REGRA DE CONGELAMENTO (prompt mestre) é aplicada em outro nível: o
// que fica congelado pra sempre é o scout evento-a-evento de uma partida já
// finalizada, não este número. Então o rating de hoje pode mudar amanhã só
// se a fórmula mudar ou se entrar uma partida nova — nunca porque uma partida
// antiga foi "reprocessada".

import type { FundamentoScout, Partida, Posicao, SetPartida } from './types'
import { FUNDAMENTOS_SCOUT, SITUACOES_ESPECIFICAS, scoutPorAtleta, linhaVazia, type LinhaFundamento } from './scoutEngine'

/** Fundamentos que de fato entram no rating (todos os normais, exceto os 3
 *  pontos específicos). */
export const FUNDAMENTOS_RATING: FundamentoScout[] = FUNDAMENTOS_SCOUT.filter(
  (f) => !SITUACOES_ESPECIFICAS.includes(f),
)

/** Peso de cada fundamento por posição — some 1.0 em cada linha. Pensado como
 *  "o que decide um ponto quando essa atleta está em quadra, na posição que
 *  ela joga": levantadora é julgada principalmente pelo levantamento, central
 *  por bloqueio+ataque de rede, ponteiro por ataque+recepção, líbero por
 *  recepção+defesa, oposto por ataque de fundo. Ajustável no futuro sem
 *  precisar de migração — é só uma constante no código. */
export const PESOS_POSICAO: Record<Posicao, Record<FundamentoScout, number>> = {
  LEVANTADORA: { saque: 0.15, recepcao: 0.10, levantamento: 0.40, ataque: 0.10, bloqueio: 0.10, defesa: 0.15, bola_de_graca: 0, bola_de_segunda: 0, nao_deslocou: 0 },
  CENTRAL:     { saque: 0.15, recepcao: 0.05, levantamento: 0.05, ataque: 0.30, bloqueio: 0.35, defesa: 0.10, bola_de_graca: 0, bola_de_segunda: 0, nao_deslocou: 0 },
  PONTEIRO:    { saque: 0.15, recepcao: 0.25, levantamento: 0.05, ataque: 0.30, bloqueio: 0.10, defesa: 0.15, bola_de_graca: 0, bola_de_segunda: 0, nao_deslocou: 0 },
  LIBERO:      { saque: 0.05, recepcao: 0.40, levantamento: 0.10, ataque: 0.05, bloqueio: 0.05, defesa: 0.35, bola_de_graca: 0, bola_de_segunda: 0, nao_deslocou: 0 },
  OPOSTO:      { saque: 0.15, recepcao: 0.10, levantamento: 0.05, ataque: 0.40, bloqueio: 0.20, defesa: 0.10, bola_de_graca: 0, bola_de_segunda: 0, nao_deslocou: 0 },
}

/** Pesos "neutros" (média das 5 posições) usados quando a atleta ainda não
 *  tem posição cadastrada — melhor que travar o rating em 0. */
function pesosNeutros(): Record<FundamentoScout, number> {
  const pos = Object.keys(PESOS_POSICAO) as Posicao[]
  const resultado = {} as Record<FundamentoScout, number>
  for (const f of FUNDAMENTOS_RATING) {
    resultado[f] = pos.reduce((soma, p) => soma + PESOS_POSICAO[p][f], 0) / pos.length
  }
  return resultado
}

/** Peso que a função SECUNDÁRIA tem na mistura dos pesos, contra a função
 *  PRINCIPAL (pedido 30/10/2026: "função principal e secundária de cada
 *  jogadora"). 70/30: a atleta continua sendo julgada principalmente pela
 *  posição em que mais atua, mas os fundamentos importantes da posição
 *  secundária também contam, pra não ignorar uma ponteira que também
 *  bloqueia de central em algumas rotações, por exemplo. */
const PESO_FUNCAO_SECUNDARIA = 0.3

/** Mistura os pesos de 1 ou 2 posições (principal + secundária, se houver e
 *  for diferente da principal). Sem posição nenhuma cadastrada, cai nos
 *  pesos neutros (média das 5) — igual já acontecia antes de existir a
 *  função secundária. */
function pesosDaAtleta(posicaoPrincipal: Posicao | null | undefined, posicaoSecundaria: Posicao | null | undefined): Record<FundamentoScout, number> {
  const principal = (posicaoPrincipal && PESOS_POSICAO[posicaoPrincipal]) || null
  const secundaria = posicaoSecundaria && posicaoSecundaria !== posicaoPrincipal ? PESOS_POSICAO[posicaoSecundaria] ?? null : null
  if (!principal) return pesosNeutros()
  if (!secundaria) return principal
  const resultado = {} as Record<FundamentoScout, number>
  for (const f of FUNDAMENTOS_RATING) {
    resultado[f] = principal[f] * (1 - PESO_FUNCAO_SECUNDARIA) + secundaria[f] * PESO_FUNCAO_SECUNDARIA
  }
  return resultado
}

/** Quantas ações registradas uma atleta precisa ter (na soma dos
 *  fundamentos considerados) pra o rating "confiar" 100% na eficiência
 *  medida. Com menos ações que isso, o rating é puxado pra 50 (neutro) na
 *  proporção que faltar — evita que 2 ou 3 ações (boas ou más) por acaso
 *  já deem um rating de 95 ou de 5. */
const VOLUME_PARA_CONFIANCA_TOTAL = 40

/** Converte eficiência (-100 a 100, já calculada em scoutEngine) pra uma nota
 *  de 0 a 100, onde 0% de eficiência (metade acerto, metade erro) fica em 50. */
function notaDeEficiencia(eficiencia: number): number {
  return Math.max(0, Math.min(100, (eficiencia + 100) / 2))
}

/** Piso e teto da escala de rating (pedido 30/10/2026: "rating da atleta de
 *  6.0 a 10, sempre mantendo 6.0 para quem não jogou"). 6.0 é tanto o valor
 *  de quem ainda não tem nenhuma ação registrada quanto o PISO da escala —
 *  mesmo um volume grande de ações ruins não desce o rating abaixo de 6.0,
 *  por decisão explícita do Henrique (a escala só "sobe" com bom desempenho,
 *  nunca desce abaixo do piso). 10.0 é o teto, só alcançado com volume
 *  suficiente de ações E 100% de eficiência. */
export const RATING_MINIMO = 6.0
export const RATING_MAXIMO = 10.0

export interface RatingAtleta {
  /** Nota final, de 6.0 a 10.0 (1 casa decimal). 6.0 = sem jogar ainda ou sem
   *  dados suficientes. */
  rating: number
  /** Quantas ações (dos fundamentos considerados) entraram na conta. */
  totalAcoes: number
  /** De 0 a 1 — quão perto o rating está de refletir só a eficiência medida
   *  (1 = volume suficiente) vs. estar puxado pro piso (6.0) por pouco dado. */
  confianca: number
  /** Nota de 0 a 100 (escala interna, independente da escala final de 6-10)
   *  por fundamento, só os que tiveram pelo menos 1 ação. */
  porFundamento: Partial<Record<FundamentoScout, { nota: number; peso: number; totalAcoes: number }>>
  posicaoUsada: Posicao | null
  posicaoSecundariaUsada: Posicao | null
}

/** Calcula o rating de uma atleta a partir do scout agregado (`porFundamento`
 *  somado de 1 ou mais partidas — ver `agregarScoutAtleta` abaixo). Pura e
 *  síncrona: não busca nada, só processa o que já foi somado.
 *
 *  `posicaoSecundaria` (pedido 30/10/2026) é opcional — quando informada (e
 *  diferente da principal), os pesos usados são uma mistura 70% principal /
 *  30% secundária, pra uma atleta que joga mais de uma posição ser julgada
 *  também pelos fundamentos que importam na posição secundária dela. */
export function calcularRating(
  porFundamento: Record<FundamentoScout, LinhaFundamento>,
  posicao: Posicao | null | undefined,
  posicaoSecundaria?: Posicao | null | undefined,
): RatingAtleta {
  // Defensivo: `posicao`/`posicaoSecundaria` podem ser um valor antigo/inválido
  // que não existe mais no enum atual (ex.: atletas recuperadas do Supabase
  // antes da troca do Posicao de 23/10/2026, que tinham valores como
  // 'PONTA1'/'CENTRAL1' etc.). Nesse caso `PESOS_POSICAO[posicao]` dá
  // `undefined` — tratado dentro de `pesosDaAtleta`, caindo pros pesos
  // neutros, igual já acontecia quando a atleta não tinha posição cadastrada
  // nenhuma.
  const pesos = pesosDaAtleta(posicao, posicaoSecundaria)

  let somaPesoComDados = 0
  let somaPonderada = 0
  let totalAcoes = 0
  const porFundamentoResultado: RatingAtleta['porFundamento'] = {}

  for (const f of FUNDAMENTOS_RATING) {
    const linha = porFundamento[f]
    if (!linha || linha.total === 0) continue
    const nota = notaDeEficiencia(linha.eficiencia)
    const peso = pesos[f]
    somaPonderada += nota * peso
    somaPesoComDados += peso
    totalAcoes += linha.total
    porFundamentoResultado[f] = { nota: Math.round(nota), peso, totalAcoes: linha.total }
  }

  // nota 0-100 (50 = eficiência líquida zero) -> escala 6.0-10.0, só alcançada
  // de verdade com volume suficiente (`confianca` perto de 1). Sem dados
  // (confianca 0), o resultado é exatamente o piso de 6.0 — nunca um "meio
  // da escala" neutro como era antes (quando a escala era 0-100 e o neutro
  // ficava em 50).
  const notaBruta = somaPesoComDados > 0 ? somaPonderada / somaPesoComDados : 50
  const confianca = Math.max(0, Math.min(1, totalAcoes / VOLUME_PARA_CONFIANCA_TOTAL))
  const notaNaEscala = RATING_MINIMO + (notaBruta / 100) * (RATING_MAXIMO - RATING_MINIMO)
  const rating = RATING_MINIMO + (notaNaEscala - RATING_MINIMO) * confianca

  return {
    rating: Math.round(Math.max(RATING_MINIMO, Math.min(RATING_MAXIMO, rating)) * 10) / 10,
    totalAcoes,
    confianca,
    porFundamento: porFundamentoResultado,
    posicaoUsada: posicao ?? null,
    posicaoSecundariaUsada: posicaoSecundaria && posicaoSecundaria !== posicao ? posicaoSecundaria : null,
  }
}

/** Soma o scout de uma atleta em várias partidas (histórico completo, ou um
 *  recorte) — mesma lógica de agregação usada em `scoutPorAtleta`, mas
 *  atravessando partidas em vez de só sets de uma partida só. Só considera
 *  partidas já finalizadas (regra de congelamento: partida em andamento
 *  ainda pode mudar, não deve contar pro rating "oficial" ainda) e não
 *  excluídas (soft-delete). */
export function agregarScoutAtleta(atletaId: string, partidas: Pick<Partida, 'id' | 'status' | 'deletedAt' | 'setsPartida'>[]): Record<FundamentoScout, LinhaFundamento> {
  const totais = {} as Record<FundamentoScout, LinhaFundamento>
  for (const f of FUNDAMENTOS_SCOUT) totais[f] = linhaVazia()

  for (const partida of partidas) {
    if (partida.deletedAt || partida.status !== 'FINALIZADA') continue
    const porAtleta = scoutPorAtleta(partida.setsPartida).find((s) => s.atletaId === atletaId)
    if (!porAtleta) continue
    for (const f of FUNDAMENTOS_SCOUT) {
      const origem = porAtleta.porFundamento[f]
      totais[f].positivo += origem.positivo
      totais[f].neutro += origem.neutro
      totais[f].erro += origem.erro
      totais[f].total += origem.total
    }
  }

  for (const f of FUNDAMENTOS_SCOUT) {
    const l = totais[f]
    l.eficiencia = l.total > 0 ? Math.round(((l.positivo - l.erro) / l.total) * 100) : 0
  }
  return totais
}

/** Lista as partidas finalizadas (mais recente primeiro) em que a atleta teve
 *  pelo menos 1 evento registrado — base do "números por partida" pedido na
 *  tela de perfil. */
export function partidasComParticipacao(atletaId: string, partidas: Partida[]): Array<{ partida: Partida; totalGeral: LinhaFundamento }> {
  const resultado: Array<{ partida: Partida; totalGeral: LinhaFundamento }> = []
  for (const partida of partidas) {
    if (partida.deletedAt || partida.status !== 'FINALIZADA') continue
    const porAtleta = scoutPorAtleta(partida.setsPartida).find((s) => s.atletaId === atletaId)
    if (!porAtleta || porAtleta.totalGeral.total === 0) continue
    resultado.push({ partida, totalGeral: porAtleta.totalGeral })
  }
  return resultado.sort((a, b) => (a.partida.data < b.partida.data ? 1 : -1))
}

/** Junta os sets de todas as partidas finalizadas e não excluídas (mesma
 *  regra de congelamento usada em `agregarScoutAtleta`) — base pra qualquer
 *  análise que precise "replay" set a set, como `analisePorAtletaEPosicao`. */
export function setsFinalizados(partidas: Pick<Partida, 'status' | 'deletedAt' | 'setsPartida'>[]): SetPartida[] {
  return partidas.filter((p) => !p.deletedAt && p.status === 'FINALIZADA').flatMap((p) => p.setsPartida)
}
