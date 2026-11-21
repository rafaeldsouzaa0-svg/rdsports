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
    /** O que ainda falta pra marcar — a tela pergunta com botões. Vazio = já dá pra marcar. */
    faltando: CampoFaltando[]
  }

export interface AtletaVoz { id: string; nome: string; numero?: string }

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

/** Procura uma atleta pelo nome (ou pelo número da camisa, "camisa 7").
 *  Primeiro em quadra, depois no jogo todo. Nome que bate com mais de uma
 *  atleta (ex.: duas "Ana") não é escolhido sozinho — a tela pergunta. */
function acharAtleta(frase: string, ctx: ContextoVoz): string | undefined {
  const palavras = frase.split(' ').filter((p) => p.length >= 3 && !PALAVRAS_DO_SCOUT.has(p))
  const numeroCamisa = frase.match(/(?:numero|camisa|n) (\d{1,2})( |$)/)?.[1]

  for (const grupo of [ctx.emQuadra, ctx.todas]) {
    if (numeroCamisa) {
      const pelaCamisa = grupo.filter((a) => a.numero && a.numero.replace(/^0+/, '') === numeroCamisa)
      if (pelaCamisa.length === 1) return pelaCamisa[0].id
    }
    // Nome completo falado ("Ana Clara") vale mais que só o primeiro nome.
    const completos = grupo.filter((a) => {
      const n = normalizarFala(a.nome)
      return n.includes(' ') && new RegExp(`(^| )${n}( |$)`).test(frase)
    })
    if (completos.length === 1) return completos[0].id
    for (const tolerancia of [0, 1, 2]) {
      const achadas = grupo.filter((a) => {
        const primeiro = normalizarFala(a.nome).split(' ')[0]
        if (!primeiro) return false
        const limite = tolerancia === 0 ? 0 : primeiro.length >= 6 ? tolerancia : tolerancia === 1 && primeiro.length >= 4 ? 1 : -1
        if (limite < 0) return false
        return palavras.some((p) => distancia(p, primeiro) <= limite)
      })
      if (achadas.length === 1) return achadas[0].id
      if (achadas.length > 1) return undefined
    }
  }
  return undefined
}

/** Interpreta uma frase falada. Nunca inventa: o que não entendeu volta em
 *  `faltando` pra tela perguntar. */
export function interpretarFala(texto: string, ctx: ContextoVoz): ComandoVoz {
  const frase = normalizarFala(texto)
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

  const fundamento = acharFundamento(fraseNum)
  let atletaId = acharAtleta(fraseNum, ctx)
  if (!atletaId && fundamento === 'saque' && ctx.sacadoraId) atletaId = ctx.sacadoraId
  let resultado: ResultadoEvento | undefined
  if (fundamento && SEM_RESULTADO.includes(fundamento)) resultado = fundamento === 'nao_deslocou' ? 'ERRO' : 'ACERTO'
  else resultado = acharResultado(fraseNum, fundamento)
  if (fundamento && resultado && !SEM_RESULTADO.includes(fundamento) && !resultadosPossiveis(fundamento).includes(resultado)) resultado = undefined

  const faltando: CampoFaltando[] = []
  if (!fundamento) faltando.push('fundamento')
  if (!atletaId) faltando.push('atleta')
  if (!resultado) faltando.push('resultado')
  return { tipo: 'jogada', lado: 'CASA', fundamento, resultado, atletaId, faltando }
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
  c: { lado: 'CASA' | 'ADVERSARIO'; fundamento: FundamentoScout; resultado: ResultadoEvento; numeroAdversario?: string },
  nomeAtleta?: string,
): string {
  const f = LABEL_FUNDAMENTO_VOZ[c.fundamento]
  if (c.lado === 'ADVERSARIO') {
    if (c.fundamento === 'nao_deslocou') return 'Largada deles errada, ponto nosso'
    const quem = c.numeroAdversario ? ` camisa ${c.numeroAdversario}` : ''
    return c.resultado === 'ERRO' ? `Erro deles${quem}, ${f}` : `Ponto deles${quem}, ${f}`
  }
  const nome = nomeAtleta ? ` ${nomeAtleta.split(' ')[0]}` : ''
  if (SEM_RESULTADO.includes(c.fundamento)) return `${f[0].toUpperCase()}${f.slice(1)}${nome}`
  return `${f[0].toUpperCase()}${f.slice(1)}${nome}, ${LABEL_RESULTADO_VOZ[c.resultado]}`
}

export { LABEL_RESULTADO_VOZ, LABEL_FUNDAMENTO_VOZ }
