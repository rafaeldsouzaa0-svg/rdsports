// Reparo dos resultados de scout que vieram do app antigo (21/11/2026).
//
// O que aconteceu: o app antigo (antes da reconstrução de 23/10/2026) gravava
// os acertos com nomes que o app novo não conhece (sobrou "ACE" no banco).
// Ao puxar da nuvem, tudo que não era ACERTO/BOM/MEDIO/ERRO/EM_JOGO virava
// "EM_JOGO" (neutro) e, na sincronização seguinte, voltava pro banco assim.
// Resultado: os pontos de ataque, aces e bloqueios das partidas de 14/08 a
// 20/10/2026 passaram a contar como neutros (os erros ficaram certos porque
// "ERRO" tinha o mesmo nome nos dois apps).
//
// Como recupera: o banco ainda sabe QUEM ganhou cada rally. Pela regra do
// próprio app (scoutEngine.encerraRallyDe), um lance "em jogo" nunca encerra
// o rally — então, se o ÚLTIMO lance de um rally que foi ponto NOSSO é um
// ataque/saque/bloqueio da nossa atleta marcado "em jogo", ele só pode ter
// sido o ponto: ataque de ponto, ace ou bloqueio de ponto (ACERTO).
// O que não encerrou rally (recepção boa/média etc.) não tem como recuperar.
import type { FundamentoScout, Partida, Rally, ResultadoEvento } from './types'

const RESULTADOS_VALIDOS: ResultadoEvento[] = ['ACERTO', 'BOM', 'MEDIO', 'ERRO', 'EM_JOGO']
const PONTO_DE_QUEM_FEZ: FundamentoScout[] = ['ataque', 'saque', 'bloqueio']

/** Converte o resultado gravado na nuvem pro formato do app, entendendo os
 *  nomes antigos. "ACE" no saque/ataque é ponto (ACERTO); "ACE" na recepção
 *  é ace SOFRIDO (ERRO). */
export function resultadoDaNuvem(fundamento: string, resultado: string): ResultadoEvento {
  const up = (resultado ?? '').toUpperCase()
  if ((RESULTADOS_VALIDOS as string[]).includes(up)) return up as ResultadoEvento
  if (up === 'ACE') return (fundamento ?? '').toUpperCase() === 'RECEPCAO' ? 'ERRO' : 'ACERTO'
  return 'EM_JOGO'
}

/** Devolve o MESMO rally quando não há nada pra consertar. */
export function repararRally(rally: Rally): Rally {
  if (!rally.pontoCasa || rally.eventos.length === 0) return rally
  const ultimo = rally.eventos[rally.eventos.length - 1]
  if (ultimo.resultado !== 'EM_JOGO') return rally
  if (ultimo.ladoResponsavel === 'ADVERSARIO') return rally
  if (!PONTO_DE_QUEM_FEZ.includes(ultimo.fundamento)) return rally
  return { ...rally, eventos: [...rally.eventos.slice(0, -1), { ...ultimo, resultado: 'ACERTO', encerraRally: 'CASA' }] }
}

/** Conserta todas as partidas. Devolve o MESMO array quando nada mudou (pra
 *  não disparar sincronização à toa — ver store.mesclarDaNuvem). */
export function repararPartidas(partidas: Partida[]): Partida[] {
  let mudouAlguma = false
  const novas = partidas.map((p) => {
    let mudouPartida = false
    const sets = p.setsPartida.map((s) => {
      let mudouSet = false
      const rallies = s.rallies.map((r) => {
        const novo = repararRally(r)
        if (novo !== r) mudouSet = true
        return novo
      })
      if (!mudouSet) return s
      mudouPartida = true
      return { ...s, rallies }
    })
    if (!mudouPartida) return p
    mudouAlguma = true
    return { ...p, setsPartida: sets }
  })
  return mudouAlguma ? novas : partidas
}
