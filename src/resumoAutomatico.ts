// Resumo automático da partida em texto (pedido 30/10/2026) — pronto pra
// copiar e mandar num grupo de WhatsApp ou pros pais, sem precisar ler
// tabela por tabela. Sempre montado a partir dos mesmos números que já
// aparecem no Relatório (eficiência geral, por fundamento, maior sequência,
// destaque individual) — nunca inventa nem arredonda diferente do resto do
// app.
import { FUNDAMENTOS_SCOUT, LABEL_FUNDAMENTO, scoutEquipe, eficienciaGeralEquipe, scoutPorAtleta, maiorSequenciaPartida } from './scoutEngine'
import type { Atleta, Partida } from './types'

/** Ações mínimas que uma atleta precisa ter na partida pra ser considerada
 *  "destaque em eficiência" — evita que 1 ou 2 ações isoladas (boas por
 *  acaso) virem o destaque do resumo. Abaixo disso, o destaque vira "quem
 *  mais atuou" (volume), não "quem teve melhor %". */
const MINIMO_ACOES_PARA_DESTAQUE_EFICIENCIA = 5

/** Monta o parágrafo-resumo da partida. `null` se a partida ainda não tem
 *  nenhuma ação registrada (nada pra resumir ainda) — nunca inventa um
 *  resumo vazio ou genérico. */
export function gerarResumoPartida(partida: Partida, atletas: Atleta[]): string | null {
  const geral = eficienciaGeralEquipe(partida.setsPartida)
  if (geral.total === 0) return null

  const nomeDe = (id: string) => atletas.find((a) => a.id === id)?.nome ?? 'uma atleta'
  const frases: string[] = []

  const venceu = partida.setsGanhosCasa > partida.setsGanhosAdversario
  const adversario = partida.adversarioNome ?? 'o adversário'
  frases.push(`${venceu ? 'Vencemos' : 'Perdemos'} ${partida.setsGanhosCasa} × ${partida.setsGanhosAdversario} contra ${adversario}.`)

  const equipe = scoutEquipe(partida.setsPartida)
  const fundamentosComDados = FUNDAMENTOS_SCOUT.filter((f) => equipe[f].total > 0)
  if (fundamentosComDados.length > 0) {
    let melhor = fundamentosComDados[0]
    let pior = fundamentosComDados[0]
    for (const f of fundamentosComDados) {
      if (equipe[f].eficiencia > equipe[melhor].eficiencia) melhor = f
      if (equipe[f].eficiencia < equipe[pior].eficiencia) pior = f
    }
    frases.push(`Melhor fundamento: ${LABEL_FUNDAMENTO[melhor]} (${equipe[melhor].eficiencia}% de eficiência).`)
    if (pior !== melhor) {
      frases.push(`Pior fundamento: ${LABEL_FUNDAMENTO[pior]} (${equipe[pior].eficiencia}%).`)
    }
  }

  const maiorSeq = maiorSequenciaPartida(partida.setsPartida)
  if (maiorSeq && maiorSeq.tamanho >= 3) {
    frases.push(`A maior sequência da partida foi de ${maiorSeq.tamanho} pontos ${maiorSeq.lado === 'CASA' ? 'nossos' : 'do adversário'} seguidos, no ${maiorSeq.setNumero}º set.`)
  }

  const porAtleta = scoutPorAtleta(partida.setsPartida)
  if (porAtleta.length > 0) {
    const elegiveisEficiencia = porAtleta.filter((p) => p.totalGeral.total >= MINIMO_ACOES_PARA_DESTAQUE_EFICIENCIA)
    const destaque = elegiveisEficiencia.length > 0
      ? elegiveisEficiencia.reduce((melhor, p) => (p.totalGeral.eficiencia > melhor.totalGeral.eficiencia ? p : melhor))
      : porAtleta.reduce((maisAcoes, p) => (p.totalGeral.total > maisAcoes.totalGeral.total ? p : maisAcoes))
    frases.push(`Destaque: ${nomeDe(destaque.atletaId)}, com ${destaque.totalGeral.eficiencia}% de eficiência em ${destaque.totalGeral.total} ações.`)
  }

  return frases.join(' ')
}
