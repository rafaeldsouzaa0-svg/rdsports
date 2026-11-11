import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { Card, PageTitle, Button, Field, IndicadorSync } from '../components/ui'
import { MenuGaveta } from '../components/Nav'
import {
  registrarEventoTime, criarSet, setEstaFechado, partidaEstaFinalizada, resumoFormato,
  desfazerUltimoEvento, calcularRotacao, aplicarSubstituicao,
  erroPorFundamentoAdversario, pontosPorFundamentoAdversario, scoutEquipe, LABEL_FUNDAMENTO, SITUACOES_ESPECIFICAS,
  listarEventosDoSet, corrigirEvento, FUNDAMENTOS_SCOUT,
  eficienciaGeralEquipe, scoutPorAtleta, sideOutBreakPoint, maiorSequenciaPartida, desempenhoEmPontosDecisivos,
} from '../scoutEngine'
import { gerarHtmlRelatorioPartida, baixarHtml, slugify } from '../htmlReport'
import { FORMATOS_PARTIDA, normalizarPosicao } from '../types'
import type { FundamentoScout, ResultadoEvento, FormatoPartida, SetPartida, Partida, RallyEvento } from '../types'
import type { LinhaErroAdversario, LinhaFundamento } from '../scoutEngine'
import { Volleyball, Undo2, Square, Shield, Users, Check, ArrowLeftRight, AlertTriangle, History, Pencil, Menu, BarChart3 } from 'lucide-react'

// Cor e emoji por fundamento (pedido 30/10/2026: "mudar as cores... colocar
// alguns emojis pra ficar mais divertido") — só identidade visual, não muda
// o cálculo nem o que é salvo. Cores escolhidas pra não repetir as que já têm
// significado próprio no app (verde = positivo, azul = neutro, vermelho =
// erro, dourado = destaque/ativo).
const FUNDAMENTOS: { chave: FundamentoScout; label: string; emoji: string; cor: string }[] = [
  { chave: 'saque', label: 'Saque', emoji: '🏐', cor: '#f6b93b' },
  { chave: 'recepcao', label: 'Recepção', emoji: '🙌', cor: '#38ada9' },
  { chave: 'levantamento', label: 'Levantamento', emoji: '🤲', cor: '#8854d0' },
  { chave: 'ataque', label: 'Ataque', emoji: '💥', cor: '#fd7e14' },
  { chave: 'bloqueio', label: 'Bloqueio', emoji: '🧱', cor: '#4b6cb7' },
  { chave: 'defesa', label: 'Defesa', emoji: '🛡️', cor: '#786fa6' },
]
const CORES_FUNDAMENTO: Record<FundamentoScout, string> = Object.fromEntries(
  [...FUNDAMENTOS.map((f) => [f.chave, f.cor] as const), ['bola_de_graca', 'var(--rd-positivo)'], ['bola_de_segunda', 'var(--rd-positivo)'], ['nao_deslocou', 'var(--rd-erro)']]
) as Record<FundamentoScout, string>
const EMOJI_FUNDAMENTO: Partial<Record<FundamentoScout, string>> = {
  ...Object.fromEntries(FUNDAMENTOS.map((f) => [f.chave, f.emoji])),
  bola_de_graca: '🎁', bola_de_segunda: '🥈', nao_deslocou: '🚫',
}

// Ordem visual da ficha de posição (igual à ficha impressa que o Henrique usa):
// linha de cima (rede) = IV, III, II — linha de baixo (fundo) = V, VI, I.
// Índice no array de posições: 0=I, 1=II, 2=III, 3=IV, 4=V, 5=VI.
const ORDEM_VISUAL = [3, 2, 1, 4, 5, 0]
const ROMANO: Record<number, string> = { 0: 'I', 1: 'II', 2: 'III', 3: 'IV', 4: 'V', 5: 'VI' }

function FichaPosicao({
  equipeNome, slots, nomes, servindo, onClickSlot, selecionado, elegivel,
}: {
  equipeNome: string
  slots: (string | null)[]
  nomes: Record<string, string>
  servindo?: boolean
  onClickSlot?: (idx: number) => void
  selecionado?: number | null
  /** Quando passado, só os slots pra quem retorna `true` ficam clicáveis —
   *  os demais aparecem esmaecidos (pedido 23/10/2026: filtrar por posição
   *  específica, ex.: só a levantadora em quadra pro fundamento Levantamento). */
  elegivel?: (idx: number) => boolean
}) {
  return (
    <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: 'var(--rd-border)', background: 'var(--rd-surface)' }}>
      <div className="text-center py-2 border-b" style={{ borderColor: 'var(--rd-border)' }}>
        <div className="text-[10px] uppercase tracking-wider text-[var(--rd-text-dim)]">Ficha de posição</div>
        <div className="font-black text-sm truncate px-2">{equipeNome}</div>
      </div>
      <div className="grid grid-cols-3">
        {ORDEM_VISUAL.map((idx, i) => {
          const atletaId = slots[idx]
          const nome = atletaId ? nomes[atletaId] ?? '—' : null
          const ehSaque = idx === 0 && !!servindo
          const ativo = selecionado === idx
          const ehElegivel = elegivel ? elegivel(idx) : true
          const clicavel = !!onClickSlot && ehElegivel
          return (
            <button
              key={idx}
              type="button"
              disabled={!clicavel}
              onClick={clicavel ? () => onClickSlot!(idx) : undefined}
              className="flex flex-col items-center justify-center gap-0.5 py-4 px-1 text-center border-r border-b last:border-r-0"
              style={{
                borderColor: 'var(--rd-border)',
                background: ehSaque ? 'var(--rd-gold)' : ativo ? 'rgba(212,175,55,.25)' : 'transparent',
                cursor: clicavel ? 'pointer' : 'default',
                opacity: ehElegivel ? 1 : 0.35,
                borderRightWidth: (i + 1) % 3 === 0 ? 0 : 1,
                borderBottomWidth: i < 3 ? 1 : 0,
              }}
            >
              <span className={`text-[10px] font-bold ${ehSaque ? 'text-black/70' : 'text-[var(--rd-text-dim)]'}`}>{ROMANO[idx]}</span>
              <span className={`text-xs font-bold truncate max-w-full ${ehSaque ? 'text-black' : ''}`}>{nome ?? 'toque p/ escolher'}</span>
              {ehSaque && <span className="text-[9px] font-bold text-black/70">🏐 Saque</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Levantamento e Recepção/Defesa usam Bom/Médio/Erro (nunca fecham rally no
// "bom/médio" — só marcam estatística da jogadora). Os demais usam Acerto/Em jogo/Erro.
function opcoesPara(fundamento: FundamentoScout): { resultado: ResultadoEvento; label: string; cor: string }[] {
  if (fundamento === 'recepcao' || fundamento === 'levantamento' || fundamento === 'defesa') {
    return [
      { resultado: 'BOM', label: '🟢 Bom', cor: 'var(--rd-positivo)' },
      { resultado: 'MEDIO', label: '🔵 Médio', cor: 'var(--rd-neutro)' },
      { resultado: 'ERRO', label: '🔴 Erro', cor: 'var(--rd-erro)' },
    ]
  }
  return [
    { resultado: 'ACERTO', label: '+ Ponto', cor: 'var(--rd-positivo)' },
    { resultado: 'EM_JOGO', label: '= Em jogo', cor: 'var(--rd-neutro)' },
    { resultado: 'ERRO', label: '- Erro', cor: 'var(--rd-erro)' },
  ]
}

// Pro resumo rápido entre sets, só olha os 6 fundamentos clássicos — "pontos
// específicos" (bola de graça etc.) são sempre -100% ou +100% de eficiência
// quando acontecem (nunca um meio-termo), e dominariam esse destaque sem
// agregar análise técnica de verdade.
const FUNDAMENTOS_CLASSICOS: FundamentoScout[] = ['saque', 'recepcao', 'levantamento', 'ataque', 'bloqueio', 'defesa']

function piorFundamentoNosso(equipe: Record<FundamentoScout, LinhaFundamento>): FundamentoScout | null {
  let pior: FundamentoScout | null = null
  for (const f of FUNDAMENTOS_CLASSICOS) {
    if (equipe[f].total === 0) continue
    if (!pior || equipe[f].eficiencia < equipe[pior].eficiencia) pior = f
  }
  return pior
}

function fundamentoMaisErradoAdversario(erros: Record<FundamentoScout, LinhaErroAdversario>): FundamentoScout | null {
  let pior: FundamentoScout | null = null
  for (const f of FUNDAMENTOS_CLASSICOS) {
    if (erros[f].total === 0) continue
    if (!pior || erros[f].total > erros[pior].total) pior = f
  }
  return pior
}

function fundamentoMaisAcertadoAdversario(pontos: Record<FundamentoScout, LinhaErroAdversario>): FundamentoScout | null {
  let melhor: FundamentoScout | null = null
  for (const f of FUNDAMENTOS_CLASSICOS) {
    if (pontos[f].total === 0) continue
    if (!melhor || pontos[f].total > pontos[melhor].total) melhor = f
  }
  return melhor
}

export default function ModoJogo() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { partidas, atualizarPartida, atletas, turmas } = useStore()
  const partida = partidas.find((p) => p.id === id)

  // Papeleta (wizard): configuração do set 1 e, entre sets, só a escalação nova.
  const [formatoW, setFormatoW] = useState<FormatoPartida>('MELHOR_DE_5')
  const [pontosNormalW, setPontosNormalW] = useState(25)
  const [pontosDecisivoW, setPontosDecisivoW] = useState(15)
  const [quemSacaW, setQuemSacaW] = useState<'CASA' | 'ADVERSARIO'>('CASA')
  const [escalacaoSlots, setEscalacaoSlots] = useState<(string | null)[]>([null, null, null, null, null, null])
  const [posicaoAtiva, setPosicaoAtiva] = useState<number | null>(0)

  // Scout ao vivo (pedido 23/10/2026): a tela principal fica sempre com a
  // ficha de posição, os 6 fundamentos e o botão do time adversário visíveis
  // ao mesmo tempo — ao tocar num fundamento, abre uma janela (modal) por
  // cima pra escolher quem fez a jogada (filtrado por posição quando faz
  // sentido, ex.: só levantadoras pro Levantamento) e depois o resultado.
  // `fundamentoSel` não-nulo é o que controla se a janela está aberta. Esse
  // fluxo (fundamento → quem → resultado) é só do NOSSO time agora.
  const [fundamentoSel, setFundamentoSel] = useState<FundamentoScout | null>(null)
  const [modalSubStep, setModalSubStep] = useState<'quem' | 'resultado'>('quem')
  const [atorSel, setAtorSel] = useState<string | null>(null)

  // Adversário (pedido 23/10/2026, simplificado): um botão só, do mesmo
  // tamanho do "Não deslocou" — abre uma janela separada e bem mais rápida:
  // Ponto (ataque/saque/bloqueio/largada ou bola de 2ª que funcionou), Erro
  // (ataque/saque/recepção) ou, direto, Largada de 2ª que NÃO funcionou
  // (ponto pra nós). `advAberto` controla se essa janela está aberta.
  const [advAberto, setAdvAberto] = useState(false)
  const [advEscolha, setAdvEscolha] = useState<'ponto' | 'erro' | null>(null)
  const [numeroAdvSel, setNumeroAdvSel] = useState('')

  // Substituição em quadra (reserva entra no lugar de uma titular).
  const [substituicaoAberta, setSubstituicaoAberta] = useState(false)
  const [posicaoSaindo, setPosicaoSaindo] = useState<number | null>(null)

  // Corrigir lançamento (pedido 30/10/2026 — "melhorar o desfazer"): poder
  // corrigir qualquer evento do passado do set atual, não só o último.
  // `painelCorrecaoAberto` controla a janela com a lista de eventos +
  // histórico de correções; `eventoEditando` troca pra um formulário de
  // edição desse evento específico dentro da mesma janela.
  const [painelCorrecaoAberto, setPainelCorrecaoAberto] = useState(false)
  const [mostrarHistorico, setMostrarHistorico] = useState(false)
  const [eventoEditando, setEventoEditando] = useState<RallyEvento | null>(null)
  const [fundEdit, setFundEdit] = useState<FundamentoScout>('ataque')
  const [resultadoEdit, setResultadoEdit] = useState<ResultadoEvento>('ACERTO')
  const [atletaEdit, setAtletaEdit] = useState<string>('')
  const [numAdvEdit, setNumAdvEdit] = useState<string>('')

  // Menu (pedido 30/10/2026: tela em tela cheia) — abre a gaveta de navegação
  // já que a sidebar/bottom nav fica escondida nesta tela.
  const [menuAberto, setMenuAberto] = useState(false)

  // Painel de números ao vivo (pedido 30/10/2026) — antes só dava pra ver a
  // eficiência da equipe no intervalo entre sets (papeleta) ou no Relatório
  // final; agora dá pra abrir durante o set, sem interromper o jogo.
  const [painelNumerosAberto, setPainelNumerosAberto] = useState(false)

  // Treino não usa papeleta/escalação — cria o 1º set automaticamente ao abrir a tela.
  useEffect(() => {
    if (partida && partida.tipo === 'TREINO' && partida.setsPartida.length === 0) {
      atualizarPartida(partida.id, { setsPartida: [criarSet(1)] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partida?.id, partida?.tipo, partida?.setsPartida.length])

  if (!partida) return <p>Partida não encontrada.</p>

  const meusAtletas = atletas.filter((a) => a.turmaId === partida.turmaId && !a.deletedAt)
  const turma = turmas.find((t) => t.id === partida.turmaId)
  const nomeNosso = turma?.nome ?? 'Nosso time'
  const mapaNomes = Object.fromEntries(meusAtletas.map((a) => [a.id, a.nome]))
  const ehJogo = partida.tipo === 'JOGO'
  const sets = partida.setsPartida
  const semSetAinda = sets.length === 0
  if (!ehJogo && semSetAinda) return <p>Preparando treino…</p>
  const setAtual = sets[sets.length - 1]
  const aguardandoEscalacao = ehJogo && (sets.length === 0 || setAtual.finalizado)
  const partidaId = partida.id

  function clicarCelula(idx: number) {
    if (escalacaoSlots[idx]) {
      setEscalacaoSlots((prev) => prev.map((v, i) => (i === idx ? null : v)))
    }
    setPosicaoAtiva(idx)
  }

  function escolherParaEscalacao(atletaId: string) {
    if (posicaoAtiva === null) return
    const idx = posicaoAtiva
    const novoSlots = escalacaoSlots.map((v, i) => (i === idx ? atletaId : v))
    setEscalacaoSlots(novoSlots)
    const posAtual = ORDEM_VISUAL.indexOf(idx)
    const proximo = ORDEM_VISUAL.slice(posAtual + 1).find((i) => !novoSlots[i]) ?? ORDEM_VISUAL.find((i) => !novoSlots[i])
    setPosicaoAtiva(proximo ?? null)
  }

  function iniciarSet1() {
    if (escalacaoSlots.some((v) => !v)) return
    const novoSet: SetPartida = { ...criarSet(1), escalacaoInicial: escalacaoSlots as string[], primeiroSaque: quemSacaW }
    atualizarPartida(partidaId, {
      formato: formatoW, pontosSetNormal: pontosNormalW, pontosSetDecisivo: pontosDecisivoW,
      setsPartida: [novoSet],
    })
    setEscalacaoSlots([null, null, null, null, null, null])
    setPosicaoAtiva(0)
  }

  function iniciarProximoSet() {
    if (escalacaoSlots.some((v) => !v)) return
    const novoSet: SetPartida = { ...criarSet(setAtual.numero + 1), escalacaoInicial: escalacaoSlots as string[], primeiroSaque: quemSacaW }
    atualizarPartida(partidaId, { setsPartida: [...sets, novoSet] })
    setEscalacaoSlots([null, null, null, null, null, null])
    setPosicaoAtiva(0)
  }

  function persistirESeFechou(novoSet: SetPartida) {
    const novosSets = [...sets.slice(0, -1), novoSet]
    const vencedor = setEstaFechado(novoSet, partida!)
    if (vencedor) {
      fecharSet(novosSets, novoSet, vencedor)
    } else {
      atualizarPartida(partidaId, { setsPartida: novosSets })
    }
  }

  function fecharSet(novosSets: SetPartida[], setFechado: SetPartida, vencedor: 'CASA' | 'ADVERSARIO') {
    const setsFinal = novosSets.map((s) => (s.id === setFechado.id ? { ...s, finalizado: true, vencedor } : s))
    const setsGanhosCasa = setsFinal.filter((s) => s.vencedor === 'CASA').length
    const setsGanhosAdversario = setsFinal.filter((s) => s.vencedor === 'ADVERSARIO').length
    const acabou = partidaEstaFinalizada(partida!.formato, setsGanhosCasa, setsGanhosAdversario, setsFinal.length)
    if (acabou) {
      const partidaFinal: Partida = { ...partida!, setsPartida: setsFinal, setsGanhosCasa, setsGanhosAdversario, status: 'FINALIZADA' }
      atualizarPartida(partidaId, { setsPartida: setsFinal, setsGanhosCasa, setsGanhosAdversario, status: 'FINALIZADA' })
      // Pedido 23/10/2026: relatório completo (igual ao HTML que o Henrique já
      // baixa manualmente na tela de Relatório) sai sozinho assim que a
      // partida termina — não precisa lembrar de ir lá clicar em "Baixar".
      try {
        const html = gerarHtmlRelatorioPartida(partidaFinal, setsFinal, atletas, 'Todos os sets')
        const nomeArquivo = `RDSports_relatorio_${slugify(partidaFinal.adversarioNome ?? 'adversario')}_${partidaFinal.data}.html`
        baixarHtml(html, nomeArquivo)
      } catch {
        // Se por algum motivo o download automático falhar, a pessoa sempre
        // consegue baixar manualmente na tela de Relatório pra onde já vai navegar.
      }
      navigate(`/relatorio/${partidaId}`)
    } else {
      atualizarPartida(partidaId, { setsPartida: setsFinal, setsGanhosCasa, setsGanhosAdversario })
    }
  }

  function fecharModal() {
    setFundamentoSel(null); setModalSubStep('quem'); setAtorSel(null)
  }

  /** Toca num dos botões de fundamento (ou de ponto específico) do NOSSO time
   *  na tela principal — abre a janela.
   *  Pedido 23/10/2026: quando o saque é nosso, "Saque" já pula direto pro
   *  resultado com a sacadora da posição I pré-selecionada — não faz sentido
   *  perguntar "quem sacou", já que só pode ser quem está na posição I. */
  function abrirModalFundamento(f: FundamentoScout) {
    setFundamentoSel(f)
    const sacadoraId = ehJogo && rotacao ? rotacao.posicoes[0] : null
    if (f === 'saque' && rotacao?.servindo === 'CASA' && sacadoraId) {
      setAtorSel(sacadoraId)
      setModalSubStep('resultado')
    } else {
      setAtorSel(null)
      setModalSubStep('quem')
    }
  }

  // "Pontos específicos" (pedido 23/10/2026, ajustado): bola de graça e bola
  // de segunda/largada são jogadas que DÃO CERTO — ponto pra quem fez;
  // "não deslocou" é erro de posicionamento — ponto pro outro lado. Nenhuma
  // das 3 passa pela etapa de resultado: só têm um desfecho possível, e o
  // resultado registrado (ACERTO ou ERRO) é só o que vira estatística da
  // atleta — quem pontua é decidido em `encerraRallyDe` (scoutEngine.ts).
  function registrarEspecifico(situacao: FundamentoScout, atletaId: string) {
    const resultado: ResultadoEvento = situacao === 'nao_deslocou' ? 'ERRO' : 'ACERTO'
    const novoSet = registrarEventoTime(setAtual, 'CASA', situacao, resultado, atletaId)
    persistirESeFechou(novoSet)
    fecharModal()
  }

  /** Dentro da janela: escolheu a atleta — se o fundamento é um ponto
   *  específico, registra na hora; senão, avança pra etapa de resultado
   *  dentro da mesma janela. */
  function confirmarQuem(atletaId: string) {
    if (!fundamentoSel) return
    if (SITUACOES_ESPECIFICAS.includes(fundamentoSel)) {
      registrarEspecifico(fundamentoSel, atletaId)
      return
    }
    setAtorSel(atletaId)
    setModalSubStep('resultado')
  }

  function confirmarMarcar(resultado: ResultadoEvento) {
    if (!fundamentoSel || !atorSel) return
    const novoSet = registrarEventoTime(setAtual, 'CASA', fundamentoSel, resultado, atorSel)
    persistirESeFechou(novoSet)
    fecharModal()
  }

  /** Janela do Adversário (pedido 23/10/2026, simplificado): registra uma
   *  ação do time adversário direto pelo fundamento/resultado — sem passar
   *  por "quem fez", já que normalmente não dá pra saber a posição exata do
   *  adversário em quadra. O nº da camisa continua opcional. */
  function abrirAdversario() {
    setAdvAberto(true)
    setAdvEscolha(null)
    setNumeroAdvSel('')
  }

  function fecharAdversario() {
    setAdvAberto(false)
    setAdvEscolha(null)
    setNumeroAdvSel('')
  }

  function marcarAdversario(fundamento: FundamentoScout, resultado: ResultadoEvento) {
    const novoSet = registrarEventoTime(setAtual, 'ADVERSARIO', fundamento, resultado, undefined, numeroAdvSel.trim() || undefined)
    persistirESeFechou(novoSet)
    fecharAdversario()
  }

  /** Largada/bola de 2ª do adversário — reaproveita a mesma regra de "pontos
   *  específicos" do nosso time (só que do lado do adversário): quando dá
   *  certo (botão dentro de "Ponto"), o ponto é deles; quando NÃO dá certo
   *  (botão vermelho "Largada de 2ª" avulso), o ponto é nosso. */
  function marcarAdversarioEspecifico(situacao: 'bola_de_segunda' | 'nao_deslocou') {
    const resultado: ResultadoEvento = situacao === 'nao_deslocou' ? 'ERRO' : 'ACERTO'
    marcarAdversario(situacao, resultado)
  }

  function desfazer() {
    if (!setAtual || setAtual.rallies.length === 0) return
    const novoSet = desfazerUltimoEvento(setAtual)
    atualizarPartida(partidaId, { setsPartida: [...sets.slice(0, -1), novoSet] })
  }

  /** Abre o formulário de correção de um evento específico, pré-preenchido
   *  com os valores atuais dele — nunca parte de um valor em branco/inventado. */
  function abrirEdicaoEvento(ev: RallyEvento) {
    setEventoEditando(ev)
    setFundEdit(ev.fundamento)
    setResultadoEdit(ev.resultado)
    setAtletaEdit(ev.atletaId ?? '')
    setNumAdvEdit(ev.numeroAdversario ?? '')
  }

  function fecharEdicaoEvento() {
    setEventoEditando(null)
  }

  function salvarCorrecaoEvento() {
    if (!eventoEditando) return
    const ehAdversario = eventoEditando.ladoResponsavel === 'ADVERSARIO'
    const especifico = SITUACOES_ESPECIFICAS.includes(fundEdit)
    const resultadoFinal: ResultadoEvento = especifico ? (fundEdit === 'nao_deslocou' ? 'ERRO' : 'ACERTO') : resultadoEdit
    const novoSet = corrigirEvento(setAtual, eventoEditando.id, {
      fundamento: fundEdit,
      resultado: resultadoFinal,
      ...(ehAdversario ? { numeroAdversario: numAdvEdit.trim() || undefined } : { atletaId: atletaEdit || undefined }),
    })
    persistirESeFechou(novoSet)
    fecharEdicaoEvento()
  }

  function encerrarSetManualmente() {
    if (setAtual.placarCasa === setAtual.placarAdversario) {
      alert('O set está empatado — marque mais um ponto antes de encerrar, pra saber quem venceu.')
      return
    }
    if (!window.confirm(`Encerrar este set agora com ${setAtual.placarCasa} × ${setAtual.placarAdversario}, mesmo sem bater a pontuação configurada?`)) return
    const vencedor: 'CASA' | 'ADVERSARIO' = setAtual.placarCasa > setAtual.placarAdversario ? 'CASA' : 'ADVERSARIO'
    fecharSet(sets, setAtual, vencedor)
  }

  function confirmarSubstituicao(reservaId: string) {
    if (posicaoSaindo === null) return
    const novoSet = aplicarSubstituicao(setAtual, posicaoSaindo, reservaId)
    atualizarPartida(partidaId, { setsPartida: [...sets.slice(0, -1), novoSet] })
    setSubstituicaoAberta(false)
    setPosicaoSaindo(null)
  }

  // ---------- Fase 1: papeleta (escalação + config), antes do set começar ----------
  if (aguardandoEscalacao) {
    const primeiraVez = sets.length === 0
    const setAnterior = !primeiraVez ? setAtual : null
    const equipeSetAnterior = setAnterior ? scoutEquipe([setAnterior]) : null
    const errosAdvSetAnterior = setAnterior ? erroPorFundamentoAdversario([setAnterior]) : null
    const pontosAdvSetAnterior = setAnterior ? pontosPorFundamentoAdversario([setAnterior]) : null
    const piorNosso = equipeSetAnterior ? piorFundamentoNosso(equipeSetAnterior) : null
    const piorAdversario = errosAdvSetAnterior ? fundamentoMaisErradoAdversario(errosAdvSetAnterior) : null
    const melhorAdversario = pontosAdvSetAnterior ? fundamentoMaisAcertadoAdversario(pontosAdvSetAnterior) : null
    const preenchidos = escalacaoSlots.filter(Boolean).length
    const disponiveisParaEscalar = meusAtletas.filter((a) => !escalacaoSlots.includes(a.id))

    return (
      <div>
        <PageTitle icon={<Users size={22} />} title={primeiraVez ? 'Bom jogo! 🏐' : `Escalação — Set ${setAtual.numero + 1}`}
          subtitle={primeiraVez ? 'Monte a ficha de posição e escolha como vai ser o jogo' : 'Papeleta do próximo set'} />

        {setAnterior && (
          <Card className="mb-4">
            <div className="font-bold text-sm mb-1">✅ Set {setAnterior.numero} encerrado — {setAnterior.placarCasa} × {setAnterior.placarAdversario}</div>
            {piorNosso && (
              <p className="text-xs text-[var(--rd-text-dim)]">
                📌 Pra melhorar: <strong>{LABEL_FUNDAMENTO[piorNosso]}</strong> foi nosso fundamento com pior eficiência ({equipeSetAnterior![piorNosso].eficiencia}%).
              </p>
            )}
            {melhorAdversario && (
              <p className="text-xs text-[var(--rd-text-dim)]">
                🎯 O adversário mais acertou em: <strong>{LABEL_FUNDAMENTO[melhorAdversario]}</strong> ({pontosAdvSetAnterior![melhorAdversario].total} ponto(s)).
              </p>
            )}
            {piorAdversario && (
              <p className="text-xs text-[var(--rd-text-dim)]">
                ⚠️ O adversário mais errou em: <strong>{LABEL_FUNDAMENTO[piorAdversario]}</strong> ({errosAdvSetAnterior![piorAdversario].total} erro(s)).
              </p>
            )}
          </Card>
        )}

        {primeiraVez && (
          <Card className="mb-4">
            <Field label="Como vai ser o jogo?">
              <select className="rd-input" value={formatoW} onChange={(e) => setFormatoW(e.target.value as FormatoPartida)}>
                {FORMATOS_PARTIDA.map((f) => <option key={f.valor} value={f.valor}>{f.label}</option>)}
              </select>
              <p className="text-xs text-[var(--rd-text-dim)] mt-1">{FORMATOS_PARTIDA.find((f) => f.valor === formatoW)?.descricao}</p>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Pontos — set normal">
                <input className="rd-input" type="number" min={5} value={pontosNormalW} onChange={(e) => setPontosNormalW(Number(e.target.value) || 25)} />
              </Field>
              <Field label="Pontos — set decisivo">
                <input className="rd-input" type="number" min={5} value={pontosDecisivoW} onChange={(e) => setPontosDecisivoW(Number(e.target.value) || 15)} />
              </Field>
            </div>
            <p className="text-xs text-[var(--rd-text-dim)] -mt-2 mb-2">Vale pra todos os sets desse tipo — se empatar perto do fim, o set continua até alguém abrir 2 pontos de vantagem.</p>
          </Card>
        )}

        <Card className="mb-4">
          <div className="text-xs font-semibold mb-2 text-[var(--rd-text-dim)]">Quem saca primeiro neste set?</div>
          <div className="flex gap-2">
            <button onClick={() => setQuemSacaW('CASA')} className={`rd-btn flex-1 ${quemSacaW === 'CASA' ? 'rd-btn-gold' : ''}`}>Nosso time</button>
            <button onClick={() => setQuemSacaW('ADVERSARIO')} className={`rd-btn flex-1 ${quemSacaW === 'ADVERSARIO' ? 'rd-btn-gold' : ''}`}>Adversário</button>
          </div>
        </Card>

        <Card className="mb-4">
          <div className="text-xs font-semibold mb-3 text-[var(--rd-text-dim)]">
            Ficha de posição — toque num quadrado e escolha quem começa ali ({preenchidos}/6)
          </div>
          <FichaPosicao
            equipeNome={nomeNosso}
            slots={escalacaoSlots}
            nomes={mapaNomes}
            servindo={quemSacaW === 'CASA'}
            onClickSlot={clicarCelula}
            selecionado={posicaoAtiva}
          />
          {posicaoAtiva !== null && (
            <div className="mt-3">
              <div className="text-xs font-semibold mb-2">
                Quem fica na posição <span className="rd-accent-text">{ROMANO[posicaoAtiva]}</span>?
              </div>
              <div className="flex flex-wrap gap-2">
                {disponiveisParaEscalar.length === 0 ? (
                  <p className="text-xs text-[var(--rd-text-dim)]">Todas as atletas já foram escaladas.</p>
                ) : disponiveisParaEscalar.map((a) => (
                  <button key={a.id} onClick={() => escolherParaEscalacao(a.id)} className="rd-btn text-xs">{a.nome}</button>
                ))}
              </div>
            </div>
          )}
          {meusAtletas.length < 6 && (
            <p className="text-xs text-[var(--rd-erro)] mt-2">Essa turma tem menos de 6 atletas cadastradas — cadastre mais pra montar a escalação completa.</p>
          )}
          {meusAtletas.length > 6 && (
            <p className="text-xs text-[var(--rd-text-dim)] mt-2">
              As demais ({meusAtletas.length - 6}) ficam de reserva e podem entrar no meio do set (botão "Substituição" no scout ao vivo).
            </p>
          )}
        </Card>

        <Button variant="gold" disabled={preenchidos !== 6} onClick={primeiraVez ? iniciarSet1 : iniciarProximoSet}>
          <Check size={16} /> {primeiraVez ? 'Começar partida' : `Começar Set ${setAtual.numero + 1}`}
        </Button>
      </div>
    )
  }

  // ---------- Fase 2: scout ao vivo ----------
  const rotacao = ehJogo ? calcularRotacao(setAtual) : null
  const reservas = rotacao ? meusAtletas.filter((a) => !rotacao.posicoes.includes(a.id)) : []
  const nomeAtor = atorSel ? mapaNomes[atorSel] ?? '—' : null

  // Filtro por posição (pedido 23/10/2026): Levantamento só mostra quem está
  // em quadra cadastrada como levantadora — mas só quando o time tem pelo
  // menos uma levantadora cadastrada em quadra; sem isso (time 6x0, ou
  // ninguém com posição cadastrada ainda), mostra todo mundo normalmente,
  // pra nunca travar o fluxo numa lista vazia.
  const mapaAtletaPorId = Object.fromEntries(meusAtletas.map((a) => [a.id, a]))
  function ehLevantadora(atletaId: string | null | undefined): boolean {
    if (!atletaId) return false
    return normalizarPosicao(mapaAtletaPorId[atletaId]?.posicaoPrincipal) === 'LEVANTADORA'
  }
  const apenasLevantadoras = fundamentoSel === 'levantamento' && !!rotacao && rotacao.posicoes.some(ehLevantadora)
  function elegivelParaFundamento(idx: number): boolean {
    if (!apenasLevantadoras || !rotacao) return true
    return ehLevantadora(rotacao.posicoes[idx])
  }

  return (
    <div>
      <MenuGaveta aberto={menuAberto} onFechar={() => setMenuAberto(false)} />

      <PageTitle
        icon={<Volleyball size={22} />}
        title={partida.tipo === 'JOGO' ? `${nomeNosso} vs ${partida.adversarioNome ?? 'Adversário'}` : 'Treino'}
        subtitle={resumoFormato(partida)}
        action={
          <button onClick={() => setMenuAberto(true)} className="rd-btn text-xs" aria-label="Abrir menu">
            <Menu size={16} /> Menu
          </button>
        }
      />

      <Card className="mb-4 sticky top-0 z-10 text-center">
        <div className="flex items-center justify-center gap-3 sm:gap-8">
          <div className="flex-1 min-w-0 text-right">
            <div className="text-[11px] sm:text-sm font-bold text-[var(--rd-text-dim)] truncate">{nomeNosso}</div>
            <div className="text-4xl sm:text-5xl font-black">{setAtual.placarCasa}</div>
          </div>
          <div className="text-xl sm:text-2xl text-[var(--rd-text-dim)] shrink-0">×</div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[11px] sm:text-sm font-bold text-[var(--rd-text-dim)] truncate">{partida.adversarioNome ?? 'Adversário'}</div>
            <div className="text-4xl sm:text-5xl font-black">{setAtual.placarAdversario}</div>
          </div>
        </div>
        <div className="text-xs text-[var(--rd-text-dim)] mt-1 flex items-center justify-center gap-2 flex-wrap">
          <span>Set {setAtual.numero} • {partida.setsGanhosCasa} × {partida.setsGanhosAdversario} sets</span>
          <IndicadorSync />
        </div>
      </Card>

      {ehJogo && rotacao && (
        <div className="mb-4">
          <FichaPosicao
            equipeNome={nomeNosso}
            slots={rotacao.posicoes}
            nomes={mapaNomes}
            servindo={rotacao.servindo === 'CASA'}
          />
        </div>
      )}

      {/* "Desfazer" é a correção de erro mais usada durante a partida — fica
         maior e mais chamativa que Substituição/Encerrar (ações raras),
         pra dar pra acertar de relance sem tirar o olho do jogo. */}
      <button
        className="rd-btn-grande w-full mb-3 justify-center"
        style={{ borderColor: 'var(--rd-gold)', color: 'var(--rd-gold)' }}
        onClick={desfazer}
        disabled={setAtual.rallies.length === 0}
      >
        <Undo2 size={18} /> Desfazer última marcação
      </button>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          className="rd-btn text-xs"
          onClick={() => { setPainelCorrecaoAberto(true); setMostrarHistorico(false); setEventoEditando(null) }}
          disabled={setAtual.rallies.length === 0}
        >
          <Pencil size={14} /> Corrigir lançamento
        </button>
        <button
          className="rd-btn text-xs"
          onClick={() => setPainelNumerosAberto(true)}
          disabled={sets.every((s) => s.rallies.length === 0)}
        >
          <BarChart3 size={14} /> Ver números
        </button>
        {ehJogo && rotacao && (
          <button className="rd-btn text-xs" onClick={() => { setSubstituicaoAberta((v) => !v); setPosicaoSaindo(null) }}>
            <ArrowLeftRight size={14} /> Substituição
          </button>
        )}
        <button className="rd-btn text-xs" onClick={encerrarSetManualmente}>
          <Square size={14} /> Encerrar set agora
        </button>
      </div>

      {substituicaoAberta && rotacao && (
        <Card className="mb-4">
          <div className="font-bold text-sm mb-2">🔁 Substituição</div>
          {posicaoSaindo === null ? (
            <>
              <p className="text-xs text-[var(--rd-text-dim)] mb-2">Quem vai sair de quadra?</p>
              <div className="flex flex-wrap gap-2">
                {rotacao.posicoes.map((atletaId, idx) => (
                  <button key={idx} onClick={() => setPosicaoSaindo(idx)} className="rd-btn text-xs">
                    {ROMANO[idx]} — {mapaNomes[atletaId] ?? '—'}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-[var(--rd-text-dim)] mb-2">
                Quem entra no lugar de <strong>{mapaNomes[rotacao.posicoes[posicaoSaindo]]}</strong> (posição {ROMANO[posicaoSaindo]})?
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {reservas.length === 0 ? (
                  <p className="text-xs text-[var(--rd-text-dim)]">Nenhuma reserva disponível.</p>
                ) : reservas.map((a) => (
                  <button key={a.id} onClick={() => confirmarSubstituicao(a.id)} className="rd-btn text-xs">{a.nome}</button>
                ))}
              </div>
              <button className="text-xs text-[var(--rd-text-dim)] underline" onClick={() => setPosicaoSaindo(null)}>← escolher outra posição</button>
            </>
          )}
          <div className="mt-2">
            <button className="text-xs text-[var(--rd-text-dim)] underline" onClick={() => { setSubstituicaoAberta(false); setPosicaoSaindo(null) }}>Cancelar</button>
          </div>
        </Card>
      )}

      <Card>
        <div className="font-semibold text-sm mb-3">Qual fundamento?</div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FUNDAMENTOS.map((f) => (
            <button
              key={f.chave}
              onClick={() => abrirModalFundamento(f.chave)}
              className="rd-btn-grande"
              style={{ borderColor: f.cor, color: f.cor }}
            >
              <span className="text-base">{f.emoji}</span> {f.label}
            </button>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--rd-border)' }}>
          <div className="text-xs font-semibold mb-2 text-[var(--rd-text-dim)] flex items-center gap-1.5">
            <Check size={13} className="text-[var(--rd-positivo)]" />
            Vira ponto pra quem fez
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {SITUACOES_ESPECIFICAS.filter((s) => s !== 'nao_deslocou').map((s) => (
              <button
                key={s}
                onClick={() => abrirModalFundamento(s)}
                className="rd-btn-grande"
                style={{ borderColor: 'var(--rd-positivo)', color: 'var(--rd-positivo)' }}
              >
                {EMOJI_FUNDAMENTO[s]} {LABEL_FUNDAMENTO[s]}
              </button>
            ))}
          </div>
          <div className="text-xs font-semibold mb-2 text-[var(--rd-text-dim)] flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-[var(--rd-erro)]" />
            Vira ponto pro outro lado
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SITUACOES_ESPECIFICAS.filter((s) => s === 'nao_deslocou').map((s) => (
              <button
                key={s}
                onClick={() => abrirModalFundamento(s)}
                className="rd-btn-grande"
                style={{ borderColor: 'var(--rd-erro)', color: 'var(--rd-erro)' }}
              >
                {EMOJI_FUNDAMENTO[s]} {LABEL_FUNDAMENTO[s]}
              </button>
            ))}
            <button
              onClick={abrirAdversario}
              className="rd-btn-grande flex items-center justify-center gap-1.5"
              style={{ background: 'var(--rd-danger)', borderColor: 'var(--rd-danger)', color: '#fff' }}
            >
              <Shield size={14} /> Adversário
            </button>
          </div>
        </div>
      </Card>

      <p className="text-xs text-[var(--rd-text-dim)] mt-4">
        Levantamento nunca soma ponto nem fecha o rally (nem mesmo no "Erro") — é sempre só estatística da levantadora.
        Recepção e Defesa "Bom"/"Médio" também só contam como estatística, mas o "Erro" delas fecha o rally pro adversário.
      </p>

      {fundamentoSel && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,.72)' }}
          onClick={fecharModal}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border-2 p-5"
            style={{ background: 'var(--rd-surface)', borderColor: 'var(--rd-border)', maxHeight: '88vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-[var(--rd-text-dim)] font-bold uppercase tracking-wide">Nosso time</div>
                <div className="font-black text-lg flex items-center gap-1.5" style={{ color: CORES_FUNDAMENTO[fundamentoSel] }}>
                  <span>{EMOJI_FUNDAMENTO[fundamentoSel]}</span> {LABEL_FUNDAMENTO[fundamentoSel]}
                </div>
              </div>
              <button onClick={fecharModal} className="text-xl leading-none text-[var(--rd-text-dim)] px-2">×</button>
            </div>

            {modalSubStep === 'quem' && (
              <>
                {apenasLevantadoras && (
                  <div className="flex items-start gap-2 text-xs mb-3 p-2.5 rounded-lg" style={{ background: 'rgba(212,175,55,.1)', border: '1px solid rgba(212,175,55,.3)', color: 'var(--rd-gold)' }}>
                    <span>☝️</span>
                    <span>Só aparece quem está jogando de levantadora em quadra agora.</span>
                  </div>
                )}
                {!ehJogo ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {meusAtletas.map((a) => (
                      <button key={a.id} onClick={() => confirmarQuem(a.id)} className="rd-btn-grande">{a.nome}</button>
                    ))}
                  </div>
                ) : rotacao ? (
                  <FichaPosicao
                    equipeNome={nomeNosso}
                    slots={rotacao.posicoes}
                    nomes={mapaNomes}
                    servindo={rotacao.servindo === 'CASA'}
                    onClickSlot={(idx) => { const id = rotacao.posicoes[idx]; if (id) confirmarQuem(id) }}
                    elegivel={elegivelParaFundamento}
                  />
                ) : null}
              </>
            )}

            {modalSubStep === 'resultado' && fundamentoSel && (
              <>
                <div className="text-xs text-[var(--rd-text-dim)] mb-3">{nomeAtor}</div>
                <div className="grid grid-cols-1 gap-2.5">
                  {opcoesPara(fundamentoSel).map((op) => (
                    <button
                      key={op.resultado}
                      onClick={() => confirmarMarcar(op.resultado)}
                      className="rd-btn-grande text-white"
                      style={{ background: op.cor, borderColor: op.cor }}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
                <button className="text-xs text-[var(--rd-text-dim)] underline mt-3" onClick={() => setModalSubStep('quem')}>← voltar</button>
              </>
            )}
          </div>
        </div>
      )}

      {painelCorrecaoAberto && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,.72)' }}
          onClick={() => { setPainelCorrecaoAberto(false); setEventoEditando(null) }}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border-2 p-5"
            style={{ background: 'var(--rd-surface)', borderColor: 'var(--rd-border)', maxHeight: '88vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {!eventoEditando ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-[var(--rd-text-dim)] font-bold uppercase tracking-wide flex items-center gap-1.5">
                      <Pencil size={13} /> Corrigir lançamento
                    </div>
                    <div className="font-black text-sm">Toque num evento do Set {setAtual.numero} pra corrigir</div>
                  </div>
                  <button onClick={() => setPainelCorrecaoAberto(false)} className="text-xl leading-none text-[var(--rd-text-dim)] px-2">×</button>
                </div>
                <p className="text-[11px] text-[var(--rd-text-dim)] mb-3">
                  Nada é apagado — corrigir atualiza o placar e os rallies a partir dos eventos, e fica registrado no histórico de correções abaixo.
                </p>
                <div className="grid gap-1.5">
                  {[...listarEventosDoSet(setAtual)].reverse().map((ev) => {
                    const ehAdv = ev.ladoResponsavel === 'ADVERSARIO'
                    const nome = ehAdv ? `Adversário${ev.numeroAdversario ? ` #${ev.numeroAdversario}` : ''}` : mapaNomes[ev.atletaId ?? ''] ?? '—'
                    const hora = new Date(ev.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <button
                        key={ev.id}
                        onClick={() => abrirEdicaoEvento(ev)}
                        className="w-full flex items-center justify-between text-xs rounded-lg border px-2.5 py-2 text-left hover:opacity-80"
                        style={{ borderColor: 'var(--rd-border)' }}
                      >
                        <span>
                          <strong>{LABEL_FUNDAMENTO[ev.fundamento]}</strong> · {ev.resultado} · {nome}
                        </span>
                        <span className="text-[var(--rd-text-dim)] shrink-0 ml-2">{hora}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--rd-border)' }}>
                  <button
                    className="text-xs text-[var(--rd-text-dim)] underline flex items-center gap-1"
                    onClick={() => setMostrarHistorico((v) => !v)}
                  >
                    <History size={13} /> {mostrarHistorico ? 'Esconder' : 'Ver'} histórico de correções ({setAtual.correcoes?.length ?? 0})
                  </button>
                  {mostrarHistorico && (
                    <div className="mt-2 grid gap-1.5">
                      {(!setAtual.correcoes || setAtual.correcoes.length === 0) ? (
                        <p className="text-[11px] text-[var(--rd-text-dim)]">Nenhuma correção feita neste set ainda.</p>
                      ) : [...setAtual.correcoes].reverse().map((c) => (
                        <div key={c.id} className="text-[11px] rounded-lg border px-2.5 py-2" style={{ borderColor: 'var(--rd-border)' }}>
                          <div className="text-[var(--rd-text-dim)]">{new Date(c.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                          <div>
                            {LABEL_FUNDAMENTO[c.antes.fundamento]} · {c.antes.resultado} · {c.antes.atletaId ? (mapaNomes[c.antes.atletaId] ?? '—') : (c.antes.numeroAdversario ? `Adversário #${c.antes.numeroAdversario}` : 'Adversário')}
                            {' → '}
                            {LABEL_FUNDAMENTO[c.depois.fundamento]} · {c.depois.resultado} · {c.depois.atletaId ? (mapaNomes[c.depois.atletaId] ?? '—') : (c.depois.numeroAdversario ? `Adversário #${c.depois.numeroAdversario}` : 'Adversário')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="font-black text-sm">Corrigindo lançamento</div>
                  <button onClick={fecharEdicaoEvento} className="text-xl leading-none text-[var(--rd-text-dim)] px-2">×</button>
                </div>

                {eventoEditando.ladoResponsavel !== 'ADVERSARIO' ? (
                  <Field label="Atleta">
                    <select className="rd-input" value={atletaEdit} onChange={(e) => setAtletaEdit(e.target.value)}>
                      <option value="">— sem atleta —</option>
                      {meusAtletas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                  </Field>
                ) : (
                  <Field label="Número da camisa do adversário (opcional)">
                    <input className="rd-input" value={numAdvEdit} onChange={(e) => setNumAdvEdit(e.target.value)} placeholder="ex.: 7" inputMode="numeric" />
                  </Field>
                )}

                <Field label="Fundamento">
                  <select className="rd-input" value={fundEdit} onChange={(e) => { const f = e.target.value as FundamentoScout; setFundEdit(f); if (!SITUACOES_ESPECIFICAS.includes(f)) setResultadoEdit(opcoesPara(f)[0].resultado) }}>
                    {FUNDAMENTOS_SCOUT.map((f) => <option key={f} value={f}>{LABEL_FUNDAMENTO[f]}</option>)}
                  </select>
                </Field>

                {SITUACOES_ESPECIFICAS.includes(fundEdit) ? (
                  <p className="text-xs text-[var(--rd-text-dim)] mb-3">
                    {fundEdit === 'nao_deslocou' ? 'Sempre vira ponto pro outro lado — não tem resultado pra escolher.' : 'Sempre vira ponto pra quem fez — não tem resultado pra escolher.'}
                  </p>
                ) : (
                  <Field label="Resultado">
                    <div className="grid grid-cols-3 gap-2">
                      {opcoesPara(fundEdit).map((op) => (
                        <button
                          key={op.resultado}
                          type="button"
                          onClick={() => setResultadoEdit(op.resultado)}
                          className="rd-btn text-xs"
                          style={resultadoEdit === op.resultado ? { background: op.cor, borderColor: op.cor, color: '#fff' } : undefined}
                        >
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}

                <div className="flex gap-2 mt-4">
                  <Button variant="gold" onClick={salvarCorrecaoEvento}><Check size={16} /> Salvar correção</Button>
                  <button className="rd-btn text-xs" onClick={fecharEdicaoEvento}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {painelNumerosAberto && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,.72)' }}
          onClick={() => setPainelNumerosAberto(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border-2 p-5"
            style={{ background: 'var(--rd-surface)', borderColor: 'var(--rd-border)', maxHeight: '88vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const geral = eficienciaGeralEquipe(sets)
              const sideOutBreak = sideOutBreakPoint(sets)
              const maiorSeq = maiorSequenciaPartida(sets)
              const decisivos = desempenhoEmPontosDecisivos(sets, partida)
              const topAtletas = [...scoutPorAtleta(sets)].sort((a, b) => b.totalGeral.total - a.totalGeral.total).slice(0, 5)
              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-black text-sm flex items-center gap-1.5"><BarChart3 size={15} className="rd-accent-text" /> Números ao vivo</div>
                    <button onClick={() => setPainelNumerosAberto(false)} className="text-xl leading-none text-[var(--rd-text-dim)] px-2">×</button>
                  </div>

                  <div className="rounded-lg border text-center py-3 px-2 mb-3" style={{ borderColor: 'var(--rd-border)' }}>
                    <div className="text-[10px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide">Eficiência geral (partida até agora)</div>
                    <div className="text-3xl font-black mt-1" style={{ color: geral.eficiencia >= 50 ? 'var(--rd-positivo)' : geral.eficiencia >= 0 ? 'var(--rd-neutro)' : 'var(--rd-erro)' }}>
                      {geral.total > 0 ? `${geral.eficiencia}%` : '—'}
                    </div>
                    <div className="text-[11px] text-[var(--rd-text-dim)] mt-0.5">{geral.total} ação(ões) registrada(s)</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="rounded-lg border text-center py-2.5 px-2" style={{ borderColor: 'var(--rd-border)' }}>
                      <div className="text-[9px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide">Side-out</div>
                      <div className="text-lg font-black mt-0.5">{sideOutBreak.sideOutOportunidades > 0 ? `${sideOutBreak.sideOutPct}%` : '—'}</div>
                      <div className="text-[10px] text-[var(--rd-text-dim)]">{sideOutBreak.sideOutPontos}/{sideOutBreak.sideOutOportunidades}</div>
                    </div>
                    <div className="rounded-lg border text-center py-2.5 px-2" style={{ borderColor: 'var(--rd-border)' }}>
                      <div className="text-[9px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide">Break point</div>
                      <div className="text-lg font-black mt-0.5">{sideOutBreak.breakOportunidades > 0 ? `${sideOutBreak.breakPct}%` : '—'}</div>
                      <div className="text-[10px] text-[var(--rd-text-dim)]">{sideOutBreak.breakPontos}/{sideOutBreak.breakOportunidades}</div>
                    </div>
                  </div>

                  {(decisivos.decisivo.total > 0 || decisivos.normal.total > 0) && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="rounded-lg border text-center py-2.5 px-2" style={{ borderColor: 'var(--rd-border)' }}>
                        <div className="text-[9px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide">Reta final do set</div>
                        <div className="text-lg font-black mt-0.5">{decisivos.decisivo.total > 0 ? `${decisivos.decisivo.eficiencia}%` : '—'}</div>
                        <div className="text-[10px] text-[var(--rd-text-dim)]">{decisivos.decisivo.total} ação(ões)</div>
                      </div>
                      <div className="rounded-lg border text-center py-2.5 px-2" style={{ borderColor: 'var(--rd-border)' }}>
                        <div className="text-[9px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide">Resto do set</div>
                        <div className="text-lg font-black mt-0.5">{decisivos.normal.total > 0 ? `${decisivos.normal.eficiencia}%` : '—'}</div>
                        <div className="text-[10px] text-[var(--rd-text-dim)]">{decisivos.normal.total} ação(ões)</div>
                      </div>
                    </div>
                  )}

                  {maiorSeq && maiorSeq.tamanho >= 3 && (
                    <p className="text-xs mb-3 p-2.5 rounded-lg" style={{ background: 'rgba(212,175,55,.1)', border: '1px solid rgba(212,175,55,.3)' }}>
                      🔥 Maior sequência: <strong>{maiorSeq.tamanho} pontos seguidos {maiorSeq.lado === 'CASA' ? 'nossos' : 'do adversário'}</strong> (Set {maiorSeq.setNumero}).
                    </p>
                  )}

                  {topAtletas.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-[var(--rd-text-dim)] uppercase tracking-wide mb-1.5">Mais ações até agora</div>
                      <div className="grid gap-1">
                        {topAtletas.map(({ atletaId, totalGeral }) => (
                          <div key={atletaId} className="flex items-center justify-between text-xs border-t border-[var(--rd-border)] pt-1.5 first:border-t-0 first:pt-0">
                            <span className="font-semibold truncate">{mapaNomes[atletaId] ?? '—'}</span>
                            <span className={`font-bold ${totalGeral.eficiencia >= 50 ? 'text-[var(--rd-positivo)]' : totalGeral.eficiencia >= 0 ? 'text-[var(--rd-neutro)]' : 'text-[var(--rd-erro)]'}`}>
                              {totalGeral.total} ações · {totalGeral.eficiencia}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {advAberto && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,.72)' }}
          onClick={fecharAdversario}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border-2 p-5"
            style={{ background: 'var(--rd-surface)', borderColor: 'var(--rd-border)', maxHeight: '88vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-[var(--rd-text-dim)] font-bold uppercase tracking-wide flex items-center gap-1.5">
                  <Shield size={13} /> Adversário
                </div>
                <div className="font-black text-lg">
                  {advEscolha === 'ponto' ? 'O que eles acertaram?' : advEscolha === 'erro' ? 'O que eles erraram?' : 'O que aconteceu?'}
                </div>
              </div>
              <button onClick={fecharAdversario} className="text-xl leading-none text-[var(--rd-text-dim)] px-2">×</button>
            </div>

            <Field label="Número da camisa (opcional)">
              <input className="rd-input" value={numeroAdvSel} onChange={(e) => setNumeroAdvSel(e.target.value)} placeholder="ex.: 7" inputMode="numeric" />
            </Field>

            {advEscolha === null && (
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  onClick={() => setAdvEscolha('ponto')}
                  className="rd-btn-grande text-white"
                  style={{ background: 'var(--rd-positivo)', borderColor: 'var(--rd-positivo)' }}
                >
                  🟢 Ponto
                </button>
                <button
                  onClick={() => setAdvEscolha('erro')}
                  className="rd-btn-grande text-white"
                  style={{ background: 'var(--rd-erro)', borderColor: 'var(--rd-erro)' }}
                >
                  🔴 Erro
                </button>
                <button
                  onClick={() => marcarAdversarioEspecifico('nao_deslocou')}
                  className="rd-btn-grande"
                  style={{ borderColor: 'var(--rd-erro)', color: 'var(--rd-erro)' }}
                >
                  Largada de 2ª <span className="text-[10px] font-normal opacity-80">(não funcionou — ponto nosso)</span>
                </button>
              </div>
            )}

            {advEscolha === 'ponto' && (
              <div className="grid grid-cols-1 gap-2.5">
                <button onClick={() => marcarAdversario('ataque', 'ACERTO')} className="rd-btn-grande">Ataque</button>
                <button onClick={() => marcarAdversario('saque', 'ACERTO')} className="rd-btn-grande">Saque</button>
                <button onClick={() => marcarAdversario('bloqueio', 'ACERTO')} className="rd-btn-grande">Bloqueio</button>
                <button onClick={() => marcarAdversarioEspecifico('bola_de_segunda')} className="rd-btn-grande">Largada / Bola de 2ª</button>
                <button className="text-xs text-[var(--rd-text-dim)] underline mt-1" onClick={() => setAdvEscolha(null)}>← voltar</button>
              </div>
            )}

            {advEscolha === 'erro' && (
              <div className="grid grid-cols-1 gap-2.5">
                <button onClick={() => marcarAdversario('ataque', 'ERRO')} className="rd-btn-grande">Ataque</button>
                <button onClick={() => marcarAdversario('saque', 'ERRO')} className="rd-btn-grande">Saque</button>
                <button onClick={() => marcarAdversario('recepcao', 'ERRO')} className="rd-btn-grande">Recepção</button>
                <button className="text-xs text-[var(--rd-text-dim)] underline mt-1" onClick={() => setAdvEscolha(null)}>← voltar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
