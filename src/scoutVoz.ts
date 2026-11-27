// Scout por voz (pedido 21/11/2026): transforma a frase que o professor fala
// ("Ataque da Marina, ponto", "Erro deles, saque", "Desfaz") numa marcação do
// scout. Só a interpretação do texto fica aqui (sem microfone nem tela), pra
// dar pra testar em scripts/test-scout-voz.mjs. O reconhecimento de voz em si
// é do navegador (ver useReconhecimentoVoz.ts).
//
// Regras do app que valem aqui também (iguais às dos botões):
// - Saque/Ataque/Bloqueio: Acerto (ponto) / Em jogo / Erro.
// - Recepção/Levantamento/Defesa: Bom / Médio / Erro.
// - Bola de graça, Bola de 2ª e Não deslocou não têm resultado (só acontecem).
// - Adversário: ponto deles (ataque, saque, bloqueio, largada/bola de 2ª) ou
//   erro deles (ataque, saque, recepção, largada que não funcionou).
import { FUNDAMENTOS_COM_ZONA } from './zonas'
import { TIPO_BLOQUEADO } from './bloqueio'
import type { FundamentoScout, ResultadoEvento } from './types'

export type CampoFaltando = 'fundamento' | 'atleta' | 'resultado'

export type ComandoVoz =
  | { tipo: 'desfazer' }
  | { tipo: 'vazio' }
  | {
    tipo: 'jogada'
    lado: 'CASA' | 'ADVERSARIO'
    fundamento?: FundamentoScout
    resultado?: ResultadoEvento
    atletaId?: string
    numeroAdversario?: string
    /** Zona pra onde foi o ataque/saque (1 a 9), se foi falada. Opcional:
     *  nunca entra em `faltando`. */
    zona?: number
    /** Detalhe do erro: 'BLOQUEADO' quando o ataque parou no bloqueio. */
    tipoErro?: string
    /** O que ainda falta pra marcar — a tela pergunta com botões. Vazio = já dá pra marcar. */
    faltando: CampoFaltando[]
  }

export interface AtletaVoz {
  id: string
  nome: string
  numero?: string
  /** Apelidos falados no ginásio ("Cacau", "Clau") — cadastrados no perfil
   *  da atleta (21/11/2026). */
  apelidos?: string[]
}

/** "Cacau, Clau / Claudinha" → ['Cacau', 'Clau', 'Claudinha']. */
export function separarApelidos(texto: string | undefined): string[] {
  return (texto ?? '').split(/[,;/]/).map((s) => s.trim()).filter(Boolean)
}

export interface ContextoVoz {
  /** Quem está em quadra agora (no treino: a turma toda). A busca pelo nome
   *  começa por aqui. */
  emQuadra: AtletaVoz[]
  /** Todas as atletas do jogo — se falar o nome de alguém fora de quadra,
   *  ainda é reconhecida (ex.: acabou de entrar e o rodízio não foi ajustado). */
  todas: AtletaVoz[]
  /** Quem está sacando, quando o saque é nosso: "Saque erro" já sabe quem foi. */
  sacadoraId?: string | null
}

/** Minúsculas, sem acento e sem pontuação. */
export function normalizarFala(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const NUMEROS_FALADOS: Record<string, string> = {
  um: '1', uma: '1', dois: '2', duas: '2', tres: '3', quatro: '4', cinco: '5', seis: '6', sete: '7', oito: '8',
  nove: '9', dez: '10', onze: '11', doze: '12', treze: '13', quatorze: '14', catorze: '14', quinze: '15',
  dezesseis: '16', dezessete: '17', dezoito: '18', dezenove: '19', vinte: '20',
}

const temPalavra = (frase: string, palavras: string[]) => palavras.some((p) => new RegExp(`(^| )${p}( |$)`).test(frase))

const DESFAZER = ['desfaz', 'desfazer', 'desfaca', 'apaga', 'apagar', 'cancela', 'cancelar', 'volta', 'voltar']
const ADVERSARIO = ['deles', 'delas', 'adversario', 'adversaria', 'adversarios', 'rival', 'outro time']

// Ordem importa: as expressões de várias palavras vêm antes das simples.
const FUNDAMENTOS_VOZ: { f: FundamentoScout; palavras: string[] }[] = [
  { f: 'nao_deslocou', palavras: ['nao deslocou', 'nao se deslocou', 'nao saiu do lugar'] },
  { f: 'bola_de_graca', palavras: ['bola de graca', 'de graca'] },
  { f: 'bola_de_segunda', palavras: ['bola de segunda', 'bola de 2', 'de segunda', 'largada', 'largou', 'segunda bola'] },
  { f: 'saque', palavras: ['saque', 'sacou', 'saca', 'ace'] },
  { f: 'recepcao', palavras: ['recepcao', 'recepcoes', 'recebeu', 'passe', 'passou'] },
  { f: 'levantamento', palavras: ['levantamento', 'levantou', 'levantada'] },
  { f: 'ataque', palavras: ['ataque', 'atacou', 'cortada', 'cortou', 'pipe', 'diagonal', 'paralela'] },
  { f: 'bloqueio', palavras: ['bloqueio', 'bloqueou', 'toco'] },
  { f: 'defesa', palavras: ['defesa', 'defendeu', 'defensa'] },
]

export const SEM_RESULTADO: FundamentoScout[] = ['bola_de_graca', 'bola_de_segunda', 'nao_deslocou']
export const FUNDAMENTOS_BOM_MEDIO: FundamentoScout[] = ['recepcao', 'levantamento', 'defesa']

/** Resultados que valem pra cada fundamento (os mesmos botões da tela). */
export function resultadosPossiveis(f: FundamentoScout): ResultadoEvento[] {
  if (SEM_RESULTADO.includes(f)) return []
  return FUNDAMENTOS_BOM_MEDIO.includes(f) ? ['BOM', 'MEDIO', 'ERRO'] : ['ACERTO', 'EM_JOGO', 'ERRO']
}

function acharFundamento(frase: string): FundamentoScout | undefined {
  for (const { f, palavras } of FUNDAMENTOS_VOZ) if (temPalavra(frase, palavras)) return f
  return undefined
}

/** Zona falada (pedido 27/11/2026): "zona 4", "na 4", "pra 9", "para
 *  sete" (o número por extenso já virou algarismo). Só de 1 a 9; "camisa 7"
 *  continua sendo a camisa da atleta. */
function acharZona(fraseNum: string): number | undefined {
  const m = fraseNum.match(/(?:^| )(?:zona|na|no|pra|pro|para) ([1-9])(?= |$)/)
  return m ? Number(m[1]) : undefined
}

function acharResultado(frase: string, f: FundamentoScout | undefined): ResultadoEvento | undefined {
  const erro = temPalavra(frase, ['erro', 'errou', 'errada', 'errado', 'fora', 'rede', 'ruim', 'pessima', 'pessimo', 'perdeu'])
  const emJogo = temPalavra(frase, ['em jogo', 'continua', 'continuou', 'seguiu', 'devolveu'])
  const medio = temPalavra(frase, ['media', 'medio', 'regular', 'mais ou menos', 'razoavel'])
  const bom = temPalavra(frase, ['boa', 'bom', 'otima', 'otimo', 'perfeita', 'perfeito', 'excelente', 'certa', 'certo', 'acerto', 'acertou'])
  const ponto = temPalavra(frase, ['ponto', 'acerto', 'acertou', 'certo', 'certa', 'matou', 'ace', 'pontuou', 'no chao'])
  if (erro) return 'ERRO'
  if (!f) return ponto ? 'ACERTO' : emJogo ? 'EM_JOGO' : medio ? 'MEDIO' : bom ? 'BOM' : undefined
  if (FUNDAMENTOS_BOM_MEDIO.includes(f)) return medio ? 'MEDIO' : bom ? 'BOM' : undefined
  if (emJogo) return 'EM_JOGO'
  if (ponto || bom) return 'ACERTO'
  return undefined
}

/** Distância de edição pequena (pra "Leticia" ≈ "Letícia", "Julia" ≈ "Júlia"
 *  e erros comuns do reconhecimento de voz). */
function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

const PALAVRAS_DO_SCOUT = new Set([
  ...FUNDAMENTOS_VOZ.flatMap((x) => x.palavras.flatMap((p) => p.split(' '))),
  'ponto', 'erro', 'errou', 'boa', 'bom', 'media', 'medio', 'da', 'do', 'de', 'a', 'o', 'e', 'na', 'no',
  'numero', 'camisa', 'deles', 'delas', 'jogo', 'fora', 'rede', 'certo', 'certa', 'otima', 'otimo',
])

/** Quanto de erro aceitar numa palavra de `n` letras (0 = tem que ser igual). */
function limiteErro(tolerancia: number, n: number): number {
  if (tolerancia === 0) return 0
  if (n >= 6) return tolerancia
  return tolerancia === 1 && n >= 4 ? 1 : -1
}

const DE_LIGACAO = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

/** Procura uma atleta pelo nome, apelido, sobrenome ou número da camisa
 *  ("camisa 7"). Primeiro em quadra, depois no jogo todo. O que bate com
 *  mais de uma atleta (ex.: duas "Ana") não é escolhido sozinho — a tela
 *  pergunta. Ordem de confiança: camisa → nome completo/apelido de várias
 *  palavras → primeiro nome ou apelido → sobrenome. */
function acharAtleta(frase: string, ctx: ContextoVoz): string | undefined {
  const palavras = frase.split(' ').filter((p) => p.length >= 3 && !PALAVRAS_DO_SCOUT.has(p))
  const numeroCamisa = frase.match(/(?:numero|camisa|n) (\d{1,2})( |$)/)?.[1]
  const temExpressao = (exp: string) => new RegExp(`(^| )${exp}( |$)`).test(frase)

  for (const grupo of [ctx.emQuadra, ctx.todas]) {
    if (numeroCamisa) {
      const pelaCamisa = grupo.filter((a) => a.numero && a.numero.replace(/^0+/, '') === numeroCamisa)
      if (pelaCamisa.length === 1) return pelaCamisa[0].id
    }
    // Nome completo ou apelido de várias palavras ("Ana Clara", "Maria Eduarda").
    const completos = grupo.filter((a) =>
      [a.nome, ...(a.apelidos ?? [])].map(normalizarFala).some((n) => n.includes(' ') && temExpressao(n)))
    if (completos.length === 1) return completos[0].id
    // Primeiro nome ou apelido de uma palavra (aceita erro pequeno do reconhecimento).
    for (const tolerancia of [0, 1, 2]) {
      const achadas = grupo.filter((a) => {
        const alvos = [normalizarFala(a.nome).split(' ')[0], ...(a.apelidos ?? []).map(normalizarFala).filter((x) => !x.includes(' '))]
        return alvos.some((alvo) => {
          if (!alvo) return false
          const limite = limiteErro(tolerancia, alvo.length)
          if (limite < 0) return false
          // Apelido curto ("Bia", "Ju") só vale exato.
          if (alvo.length < 3) return frase.split(' ').includes(alvo)
          return palavras.some((p) => distancia(p, alvo) <= limite)
        })
      })
      if (achadas.length === 1) return achadas[0].id
      if (achadas.length > 1) return undefined
    }
    // Sobrenome ("Orsini", "Fasterra") — só se for de uma atleta só.
    for (const tolerancia of [0, 1]) {
      const achadas = grupo.filter((a) => {
        const sobrenomes = normalizarFala(a.nome).split(' ').slice(1).filter((s) => s.length >= 4 && !DE_LIGACAO.has(s))
        return sobrenomes.some((s) => {
          const limite = limiteErro(tolerancia, s.length)
          return limite >= 0 && palavras.some((p) => distancia(p, s) <= limite)
        })
      })
      if (achadas.length === 1) return achadas[0].id
      if (achadas.length > 1) return undefined
    }
  }
  return undefined
}

// ---------- Palavras ouvidas errado (ginásio barulhento, 21/11/2026) ----------
// O reconhecimento de voz costuma trocar palavras parecidas ("pronto" no
// lugar de "ponto", "ataqui", "bloqueiu"). Antes de interpretar, cada palavra
// que não é nome de atleta é comparada com o vocabulário do scout: troca
// conhecida (lista abaixo) ou diferença de 1 letra em palavra de 5+ letras.

const TROCAS_CONHECIDAS: Record<string, string> = {
  pronto: 'ponto', pontos: 'ponto', punto: 'ponto', ponte: 'ponto',
  ataqui: 'ataque', atac: 'ataque', ataques: 'ataque', atake: 'ataque',
  saqui: 'saque', saco: 'saque', saques: 'saque', saquei: 'saque',
  ase: 'ace', eice: 'ace',
  bloqueiu: 'bloqueio', bloqueios: 'bloqueio', bloqueia: 'bloqueio', bloquei: 'bloqueio', bloquear: 'bloqueio',
  recepsao: 'recepcao', recepcoes: 'recepcao', recessao: 'recepcao', recepcion: 'recepcao',
  defeza: 'defesa', defesas: 'defesa', defende: 'defesa',
  levantament: 'levantamento', levantamentos: 'levantamento',
  erros: 'erro', erru: 'erro', hero: 'erro', ero: 'erro',
  desfas: 'desfaz', desfazendo: 'desfaz',
  sona: 'zona', zonas: 'zona', zone: 'zona', zonar: 'zona',
}

const VOCABULARIO_SCOUT = [
  ...new Set([
    ...FUNDAMENTOS_VOZ.flatMap((x) => x.palavras).filter((p) => !p.includes(' ')),
    'ponto', 'erro', 'errou', 'errada', 'errado', 'otima', 'otimo', 'media', 'medio', 'perfeita', 'perfeito',
    'regular', 'razoavel', 'continua', 'continuou', 'seguiu', 'devolveu', 'excelente', 'certa', 'certo',
    'acerto', 'acertou', 'matou', 'pontuou', 'pessima', 'pessimo', 'perdeu',
    'deles', 'delas', 'adversario', 'adversaria', 'adversarios', 'rival',
    'desfaz', 'desfazer', 'desfaca', 'apaga', 'apagar', 'cancela', 'cancelar', 'volta', 'voltar',
    'confirma', 'confirmar', 'confirmado', 'confirmo', 'camisa', 'numero', 'depois', 'entao',
  ]),
].filter((p) => p.length >= 5)

/** Troca palavras ouvidas errado pelo termo do scout. Nunca mexe em nome ou
 *  apelido de atleta (ex.: "Sacha" não vira "saque"). */
export function corrigirPalavras(fraseNormalizada: string, ctx?: ContextoVoz): string {
  const nomes = new Set<string>()
  for (const a of ctx?.todas ?? []) {
    for (const n of [a.nome, ...(a.apelidos ?? [])]) normalizarFala(n).split(' ').forEach((p) => nomes.add(p))
  }
  return fraseNormalizada.split(' ').map((p) => {
    if (!p || nomes.has(p)) return p
    if (TROCAS_CONHECIDAS[p]) return TROCAS_CONHECIDAS[p]
    if (p.length < 5 || VOCABULARIO_SCOUT.includes(p)) return p
    const parecida = VOCABULARIO_SCOUT.filter((v) => Math.abs(v.length - p.length) <= 1 && distancia(p, v) <= 1)
    return parecida.length === 1 ? parecida[0] : p
  }).join(' ')
}

/** Interpreta uma frase falada. Nunca inventa: o que não entendeu volta em
 *  `faltando` pra tela perguntar. */
export function interpretarFala(texto: string, ctx: ContextoVoz): ComandoVoz {
  const frase = corrigirPalavras(normalizarFala(texto), ctx)
  if (!frase) return { tipo: 'vazio' }
  if (temPalavra(frase, DESFAZER) && frase.split(' ').length <= 3) return { tipo: 'desfazer' }

  // Números falados por extenso viram algarismo ("camisa sete" → "camisa 7").
  const fraseNum = frase.split(' ').map((p) => NUMEROS_FALADOS[p] ?? p).join(' ')

  if (temPalavra(fraseNum, ADVERSARIO)) {
    const numero = fraseNum.match(/(?:numero|camisa|n) (\d{1,2})( |$)/)?.[1]
    let fundamento = acharFundamento(fraseNum)
    const ehErro = temPalavra(fraseNum, ['erro', 'errou', 'errada', 'errado', 'fora', 'rede'])
    const ehPonto = temPalavra(fraseNum, ['ponto', 'acerto', 'acertou', 'ace', 'matou', 'pontuou'])
    let resultado: ResultadoEvento | undefined = ehErro ? 'ERRO' : ehPonto ? 'ACERTO' : undefined
    // Largada/bola de 2ª deles: deu certo = bola_de_segunda (ponto deles);
    // errada = "não deslocou" do lado deles (ponto nosso) — igual aos botões.
    if (fundamento === 'bola_de_segunda' && resultado === 'ERRO') fundamento = 'nao_deslocou'
    if (fundamento && SEM_RESULTADO.includes(fundamento)) resultado = fundamento === 'nao_deslocou' ? 'ERRO' : 'ACERTO'
    // Combinações que não existem nos botões do adversário viram pergunta.
    const validos: Record<string, FundamentoScout[]> = {
      ACERTO: ['ataque', 'saque', 'bloqueio', 'bola_de_segunda'],
      ERRO: ['ataque', 'saque', 'recepcao', 'nao_deslocou'],
    }
    if (fundamento && resultado && !validos[resultado].includes(fundamento)) fundamento = undefined
    const faltando: CampoFaltando[] = []
    if (!resultado) faltando.push('resultado')
    if (!fundamento) faltando.push('fundamento')
    return { tipo: 'jogada', lado: 'ADVERSARIO', fundamento, resultado, numeroAdversario: numero, faltando }
  }

  // "Duda foi bloqueada", "ataque da Duda bloqueado" (27/11/2026): ataque
  // com erro e detalhe BLOQUEADO. Sem outro fundamento falado, é ataque.
  const bloqueado = temPalavra(fraseNum, ['bloqueada', 'bloqueado', 'bloquearam', 'levou bloqueio', 'tomou bloqueio'])
  let fundamento = acharFundamento(fraseNum)
  if (bloqueado && (!fundamento || fundamento === 'bloqueio')) fundamento = 'ataque'
  let atletaId = acharAtleta(fraseNum, ctx)
  if (!atletaId && fundamento === 'saque' && ctx.sacadoraId) atletaId = ctx.sacadoraId
  let resultado: ResultadoEvento | undefined
  if (fundamento && SEM_RESULTADO.includes(fundamento)) resultado = fundamento === 'nao_deslocou' ? 'ERRO' : 'ACERTO'
  else resultado = acharResultado(fraseNum, fundamento)
  if (fundamento && resultado && !SEM_RESULTADO.includes(fundamento) && !resultadosPossiveis(fundamento).includes(resultado)) resultado = undefined
  const tipoErro = bloqueado && fundamento === 'ataque' ? TIPO_BLOQUEADO : undefined
  if (tipoErro) resultado = 'ERRO'

  // Zona só vale no ataque e no saque (os mesmos da quadrinha). Sem
  // fundamento ainda, guarda: a tela pode perguntar o fundamento depois.
  const zonaFalada = acharZona(fraseNum)
  const zona = zonaFalada && (!fundamento || FUNDAMENTOS_COM_ZONA.includes(fundamento)) ? zonaFalada : undefined

  const faltando: CampoFaltando[] = []
  if (!fundamento) faltando.push('fundamento')
  if (!atletaId) faltando.push('atleta')
  if (!resultado) faltando.push('resultado')
  return { tipo: 'jogada', lado: 'CASA', fundamento, resultado, atletaId, ...(zona ? { zona } : {}), ...(tipoErro ? { tipoErro } : {}), faltando }
}

const LABEL_RESULTADO_VOZ: Record<ResultadoEvento, string> = {
  ACERTO: 'ponto', BOM: 'boa', MEDIO: 'média', ERRO: 'erro', EM_JOGO: 'em jogo',
}

const LABEL_FUNDAMENTO_VOZ: Record<FundamentoScout, string> = {
  saque: 'saque', recepcao: 'recepção', ataque: 'ataque', bloqueio: 'bloqueio', levantamento: 'levantamento',
  defesa: 'defesa', bola_de_graca: 'bola de graça', bola_de_segunda: 'bola de segunda', nao_deslocou: 'não deslocou',
}

/** Frase curta que o celular fala de volta pra confirmar ("Ataque Marina, ponto"). */
export function fraseConfirmacao(
  c: { lado: 'CASA' | 'ADVERSARIO'; fundamento: FundamentoScout; resultado: ResultadoEvento; numeroAdversario?: string; zona?: number; tipoErro?: string },
  nomeAtleta?: string,
  /** true = nome completo (na tela); false = só o primeiro nome (falado). */
  nomeCompleto = false,
): string {
  const f = LABEL_FUNDAMENTO_VOZ[c.fundamento]
  if (c.lado === 'ADVERSARIO') {
    if (c.fundamento === 'nao_deslocou') return 'Largada deles errada, ponto nosso'
    const quem = c.numeroAdversario ? ` camisa ${c.numeroAdversario}` : ''
    return c.resultado === 'ERRO' ? `Erro deles${quem}, ${f}` : `Ponto deles${quem}, ${f}`
  }
  const nome = nomeAtleta ? ` ${nomeCompleto ? nomeAtleta : nomeAtleta.split(' ')[0]}` : ''
  if (SEM_RESULTADO.includes(c.fundamento)) return `${f[0].toUpperCase()}${f.slice(1)}${nome}`
  const zona = c.zona && FUNDAMENTOS_COM_ZONA.includes(c.fundamento) ? `, zona ${c.zona}` : ''
  const res = c.tipoErro === TIPO_BLOQUEADO && c.fundamento === 'ataque' ? 'bloqueado' : LABEL_RESULTADO_VOZ[c.resultado]
  return `${f[0].toUpperCase()}${f.slice(1)}${nome}, ${res}${zona}`
}

export { LABEL_RESULTADO_VOZ, LABEL_FUNDAMENTO_VOZ }

// ---------- Várias jogadas na mesma fala (pedido 21/11/2026) ----------
// Ex.: "Recepção Sofia boa, levantamento Maria Eduarda boa, ataque Valentina
// ponto" → 3 jogadas. O reconhecimento de voz quase nunca põe vírgula, então
// a frase é cortada a cada palavra de fundamento ("recepção", "ataque"…) e
// a cada "ponto deles"/"erro deles". O professor confere a lista e confirma
// (tocando ou falando "confirma"); pode também terminar a fala com
// "confirma" pra marcar direto.

export type Jogada = Extract<ComandoVoz, { tipo: 'jogada' }>

export type FalaVarias =
  | { tipo: 'vazio' }
  | { tipo: 'desfazer' }
  | { tipo: 'confirmar' }
  | { tipo: 'cancelar' }
  | { tipo: 'jogadas'; jogadas: Jogada[]; confirmarNoFim: boolean }

const PALAVRAS_CONFIRMAR = ['confirma', 'confirmar', 'confirmado', 'confirmo', 'pode marcar', 'pode confirmar', 'marca tudo', 'marcar tudo']
const RESPOSTA_SIM = [...PALAVRAS_CONFIRMAR, 'sim', 'pode', 'ok', 'isso', 'isso mesmo', 'certo', 'correto', 'beleza']
const RESPOSTA_NAO = ['nao', 'cancela', 'cancelar', 'cancelado', 'apaga', 'apagar', 'esquece']
const PREFIXOS_ADVERSARIO = ['ponto deles', 'ponto delas', 'erro deles', 'erro delas', 'ponto do adversario', 'erro do adversario']

/** Quanto de palavras (a partir de `i`) formam um início de jogada, ou 0. */
function inicioEm(tokens: string[], i: number, lista: string[]): number {
  for (const exp of lista) {
    const partes = exp.split(' ')
    if (partes.every((p, k) => tokens[i + k] === p)) return partes.length
  }
  return 0
}

const TODAS_PALAVRAS_FUNDAMENTO = FUNDAMENTOS_VOZ.flatMap((x) => x.palavras).sort((a, b) => b.split(' ').length - a.split(' ').length)

/** Corta a fala em pedaços, um por jogada. */
export function separarJogadas(fraseNormalizada: string): string[] {
  const pedacos: string[] = []
  for (const parte of fraseNormalizada.split(/ (?:depois|em seguida|e depois|entao) /)) {
    const tokens = parte.split(' ').filter(Boolean)
    let atual: string[] = []
    let temFundamento = false
    let temAdv = false
    for (let i = 0; i < tokens.length;) {
      const adv = inicioEm(tokens, i, PREFIXOS_ADVERSARIO)
      const fund = adv ? 0 : inicioEm(tokens, i, TODAS_PALAVRAS_FUNDAMENTO)
      if ((adv && (temFundamento || temAdv)) || (fund && temFundamento)) {
        pedacos.push(atual.join(' '))
        atual = []
        temFundamento = false
        temAdv = false
      }
      const n = adv || fund || 1
      atual.push(...tokens.slice(i, i + n))
      if (adv) temAdv = true
      if (fund) temFundamento = true
      i += n
    }
    if (atual.length) pedacos.push(atual.join(' '))
  }
  return pedacos.map((p) => p.trim()).filter(Boolean)
}

/** Interpreta uma fala que pode ter várias jogadas, ou ser só uma resposta
 *  ("confirma", "cancela") pra lista que está esperando confirmação. */
export function interpretarFalaVarias(texto: string, ctx: ContextoVoz, esperandoConfirmacao = false): FalaVarias {
  let frase = corrigirPalavras(normalizarFala(texto), ctx)
  if (!frase) return { tipo: 'vazio' }
  const poucasPalavras = frase.split(' ').length <= 3
  if (esperandoConfirmacao && poucasPalavras) {
    if (temPalavra(frase, RESPOSTA_NAO)) return { tipo: 'cancelar' }
    if (temPalavra(frase, RESPOSTA_SIM)) return { tipo: 'confirmar' }
  }
  if (poucasPalavras && temPalavra(frase, DESFAZER)) return { tipo: 'desfazer' }

  // "…, confirma" no fim da fala = marcar direto, sem esperar o toque.
  let confirmarNoFim = false
  for (const p of PALAVRAS_CONFIRMAR) {
    const m = frase.match(new RegExp(`(^| )${p}$`))
    if (m) { confirmarNoFim = true; frase = frase.slice(0, m.index).trim(); break }
  }
  if (!frase) return esperandoConfirmacao ? { tipo: 'confirmar' } : { tipo: 'vazio' }

  const jogadas = separarJogadas(frase)
    .map((pedaco) => interpretarFala(pedaco, ctx))
    .filter((c): c is Jogada => c.tipo === 'jogada')
    // Pedaço sem nada reconhecível (ex.: só "e") não vira jogada.
    .filter((j) => j.faltando.length < 3 || j.lado === 'ADVERSARIO')
  if (jogadas.length === 0) {
    const unica = interpretarFala(frase, ctx)
    return unica.tipo === 'jogada' ? { tipo: 'jogadas', jogadas: [unica], confirmarNoFim } : { tipo: 'vazio' }
  }
  return { tipo: 'jogadas', jogadas, confirmarNoFim }
}

/** Quanto falta numa interpretação (menor = entendeu melhor). */
function faltaNaFala(f: FalaVarias): number {
  if (f.tipo === 'vazio') return 1000
  if (f.tipo !== 'jogadas') return 0
  return f.jogadas.reduce((s, j) => s + j.faltando.length, 0)
}

/** O celular pode devolver várias versões do que ouviu (útil no barulho do
 *  ginásio). Fica com a que o scout entende melhor; empate = a primeira, que
 *  é a que o reconhecimento achou mais provável. Devolve também o texto
 *  escolhido, pra mostrar "Você disse". */
export function escolherMelhorFala(alternativas: string[], ctx: ContextoVoz, esperandoConfirmacao = false): { texto: string; fala: FalaVarias } {
  let melhor: { texto: string; fala: FalaVarias } | null = null
  for (const texto of alternativas.map((t) => t.trim()).filter(Boolean)) {
    const fala = interpretarFalaVarias(texto, ctx, esperandoConfirmacao)
    if (!melhor || faltaNaFala(fala) < faltaNaFala(melhor.fala)) melhor = { texto, fala }
    if (faltaNaFala(fala) === 0) break
  }
  return melhor ?? { texto: '', fala: { tipo: 'vazio' } }
}
