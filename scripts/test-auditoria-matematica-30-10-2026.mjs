// Auditoria matemática das estatísticas (pedido 30/10/2026): os 12 cenários
// pedidos explicitamente — sem ações, ações positivas/negativas, correção,
// desfazer, substituição, múltiplos sets, coletivas vs. placar, rotação,
// dados incompletos, recálculo idempotente, recuperação dos dados (reload) e
// consistência entre telas. Cada valor esperado foi conferido manualmente
// contra a regra implementada em scoutEngine.ts (não é só "rodou sem
// quebrar" — os números abaixo foram calculados à mão primeiro).
import assert from 'node:assert'
import {
  criarSet, registrarEvento, registrarEventoTime, desfazerUltimoEvento,
  scoutPorAtleta, scoutEquipe, calcularRotacao, analisePorAtletaEPosicao,
  aplicarSubstituicao, erroPorFundamentoAdversario, linhaVazia, porFundamentoVazio,
} from '../src/scoutEngine.ts'
import { calcularRating, agregarScoutAtleta } from '../src/rating.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

// ============================================================
// Teste 1 — Sem ações
// ============================================================
{
  const set = criarSet(1)
  const porAtleta = scoutPorAtleta([set])
  check('T1: set sem nenhum evento não gera nenhuma atleta em scoutPorAtleta (não inventa linha vazia)', porAtleta.length === 0)

  const equipe = scoutEquipe([set])
  check('T1: scoutEquipe com set vazio não quebra e tudo fica 0', Object.values(equipe).every((l) => l.total === 0 && l.eficiencia === 0))
  check('T1: eficiência nunca vira NaN com total=0 (divisão por zero tratada)', Object.values(equipe).every((l) => !Number.isNaN(l.eficiencia)))

  // Escala de rating mudou de 0-100 pra 6.0-10.0 em 30/10/2026 — quem não tem
  // nenhuma ação registrada fica no PISO da escala (6.0), não mais num "meio"
  // neutro (antes era 50, no meio de 0-100).
  const rating = calcularRating(porFundamentoVazio(), 'PONTEIRO')
  check('T1: atleta sem nenhuma ação tem rating no piso da escala (6.0), não 0 nem erro', rating.rating === 6)
  check('T1: confiança do rating é 0 (não há dado nenhum pra confiar)', rating.confianca === 0)
}

// ============================================================
// Teste 2 — Ações positivas, neutras e negativas (uma atleta, a1)
// ============================================================
{
  let set = criarSet(1)
  set = registrarEvento(set, 'saque', 'ACERTO', 'a1') // ace: ponto CASA
  set = registrarEvento(set, 'ataque', 'EM_JOGO', 'a1') // bola em jogo: não fecha rally
  set = registrarEvento(set, 'ataque', 'ERRO', 'a1') // erro: ponto ADVERSARIO

  const a1 = scoutPorAtleta([set]).find((s) => s.atletaId === 'a1')
  check('T2: saque — 1 ação, 1 positiva, eficiência 100%', a1.porFundamento.saque.total === 1 && a1.porFundamento.saque.positivo === 1 && a1.porFundamento.saque.eficiencia === 100)
  check('T2: ataque — 2 ações (1 neutra "em jogo" dentro do mesmo rally + 1 erro no próximo)', a1.porFundamento.ataque.total === 2)
  check('T2: ataque — eficiência = (0 positivo - 1 erro) / 2 ações = -50%', a1.porFundamento.ataque.eficiencia === -50)
  check('T2: placar reflete exatamente os 2 eventos que fecharam rally (ace + erro de ataque) — 1x1', set.placarCasa === 1 && set.placarAdversario === 1)
}

// ============================================================
// Teste 3 — Correção de uma ação (registrar errado, desfazer, registrar certo)
// ============================================================
{
  let set = criarSet(1)
  // Por engano, marcou "saque ERRO" da a1 (ponto do adversário)...
  set = registrarEvento(set, 'saque', 'ERRO', 'a1')
  check('T3: antes da correção, placar está 0x1 (erro registrado por engano)', set.placarCasa === 0 && set.placarAdversario === 1)
  // ...percebe o engano, desfaz...
  set = desfazerUltimoEvento(set)
  check('T3: desfeito o engano, placar volta a 0x0', set.placarCasa === 0 && set.placarAdversario === 0)
  // ...e registra o que realmente aconteceu: ace.
  set = registrarEvento(set, 'saque', 'ACERTO', 'a1')

  const a1 = scoutPorAtleta([set]).find((s) => s.atletaId === 'a1')
  check('T3: depois da correção, só existe 1 saque no scout da atleta (não ficaram os dois)', a1.porFundamento.saque.total === 1)
  check('T3: e esse 1 saque é o correto (positivo, não erro)', a1.porFundamento.saque.positivo === 1 && a1.porFundamento.saque.erro === 0)
  check('T3: placar final reflete só a versão corrigida — 1x0', set.placarCasa === 1 && set.placarAdversario === 0)
}

// ============================================================
// Teste 4 — Desfazer uma ação (atleta sem nenhuma outra ação some da lista)
// ============================================================
{
  let set = criarSet(1)
  set = registrarEvento(set, 'bloqueio', 'ACERTO', 'a9')
  check('T4: depois de registrar, a9 aparece no scout', scoutPorAtleta([set]).some((s) => s.atletaId === 'a9'))
  set = desfazerUltimoEvento(set)
  check('T4: depois de desfazer a única ação dela, a9 não aparece mais no scout (não fica "fantasma")', !scoutPorAtleta([set]).some((s) => s.atletaId === 'a9'))
  check('T4: placar volta a 0x0 depois de desfazer', set.placarCasa === 0 && set.placarAdversario === 0)
}

// ============================================================
// Teste 5 — Substituição não mistura os dados de atletas diferentes
// ============================================================
{
  let set = criarSet(1)
  set.escalacaoInicial = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']
  set.primeiroSaque = 'CASA'

  set = registrarEvento(set, 'saque', 'ACERTO', 'a1') // a1 (posição I) faz ace — continuamos sacando
  set = aplicarSubstituicao(set, 0, 'r1') // reserva r1 entra na posição I no lugar da a1
  set = registrarEvento(set, 'saque', 'ACERTO', 'r1') // r1 também faz ace

  const porAtleta = scoutPorAtleta([set])
  const a1 = porAtleta.find((s) => s.atletaId === 'a1')
  const r1 = porAtleta.find((s) => s.atletaId === 'r1')
  check('T5: a1 tem exatamente 1 saque (o dela, antes da troca)', a1.porFundamento.saque.total === 1)
  check('T5: r1 tem exatamente 1 saque (o dela, depois de entrar)', r1.porFundamento.saque.total === 1)
  check('T5: nenhuma ação da r1 foi parar na a1 nem vice-versa', a1.porFundamento.saque.positivo === 1 && r1.porFundamento.saque.positivo === 1)

  const rotacao = calcularRotacao(set)
  check('T5: depois da troca, r1 está na posição I (índice 0) no rodízio atual', rotacao.posicoes[0] === 'r1')
  check('T5: a1 não aparece mais em nenhuma posição do rodízio atual', !rotacao.posicoes.includes('a1'))
}

// ============================================================
// Teste 6 — Múltiplos sets (totais por set e totais acumulados)
// ============================================================
{
  let set1 = criarSet(1)
  set1 = registrarEvento(set1, 'ataque', 'ACERTO', 'a1')
  let set2 = criarSet(2)
  set2 = registrarEvento(set2, 'ataque', 'ERRO', 'a1')

  const soSet1 = scoutPorAtleta([set1]).find((s) => s.atletaId === 'a1')
  const soSet2 = scoutPorAtleta([set2]).find((s) => s.atletaId === 'a1')
  const ambos = scoutPorAtleta([set1, set2]).find((s) => s.atletaId === 'a1')

  check('T6: set 1 sozinho mostra só o acerto (1 ação, eficiência 100%)', soSet1.porFundamento.ataque.total === 1 && soSet1.porFundamento.ataque.eficiencia === 100)
  check('T6: set 2 sozinho mostra só o erro (1 ação, eficiência -100%)', soSet2.porFundamento.ataque.total === 1 && soSet2.porFundamento.ataque.eficiencia === -100)
  check('T6: os dois sets juntos somam 2 ações (não é média dos dois sets, é recontagem dos eventos)', ambos.porFundamento.ataque.total === 2)
  check('T6: eficiência acumulada = (1 positivo - 1 erro) / 2 = 0%, não a média de 100% e -100% calculada separadamente', ambos.porFundamento.ataque.eficiencia === 0)
}

// ============================================================
// Teste 7 — Coletivas vs. placar (pontos do adversário não "pertencem" a ninguém)
// ============================================================
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // nossa atleta pontua: CASA 1
  set = registrarEventoTime(set, 'ADVERSARIO', 'saque', 'ERRO') // adversário erra o saque: também CASA (2)

  check('T7: placar da equipe é 2x0 (1 ataque nosso + 1 erro de saque do adversário)', set.placarCasa === 2 && set.placarAdversario === 0)

  const porAtleta = scoutPorAtleta([set])
  const somaPontosIndividuais = porAtleta.reduce((soma, a) => soma + a.porFundamento.ataque.positivo + a.porFundamento.saque.positivo, 0)
  check(
    'T7: a soma dos pontos atribuídos às atletas (1) NÃO é igual ao placar da equipe (2) — o ponto do erro adversário não é de ninguém específico',
    somaPontosIndividuais === 1 && set.placarCasa === 2,
  )

  const equipe = scoutEquipe([set])
  check('T7: scoutEquipe (eventos NOSSOS) conta só o ataque da a1, não o erro do adversário', equipe.ataque.total === 1 && equipe.saque.total === 0)

  const errosAdv = erroPorFundamentoAdversario([set])
  check('T7: o erro do adversário fica separado, em "erros do adversário por fundamento"', errosAdv.saque.total === 1)
}

// ============================================================
// Teste 8 — Rotação: cada evento preso à posição de QUANDO o rally começou
// ============================================================
{
  let set = criarSet(1)
  set.escalacaoInicial = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] // índice 2 = posição III = p3
  set.primeiroSaque = 'ADVERSARIO' // começamos recebendo

  // Rally 1: p3 (posição III) ataca e ganha o rally — como não éramos nós que
  // sacávamos, ganhar o rally FAZ o rodízio girar depois disso.
  set = registrarEvento(set, 'ataque', 'ACERTO', 'p3')
  const rotacaoDepoisRally1 = calcularRotacao(set)
  check('T8: depois de recuperar o saque, o rodízio girou — p2 assume a posição I', rotacaoDepoisRally1.posicoes[0] === 'p2')
  check('T8: e quem estava na posição III (p3) foi pra posição II depois de girar', rotacaoDepoisRally1.posicoes[1] === 'p3')

  // Rally 2: agora quem está na posição I (p2) saca e faz ace — já estávamos
  // sacando, então o rodízio NÃO gira de novo.
  set = registrarEvento(set, 'saque', 'ACERTO', 'p2')

  const analise = analisePorAtletaEPosicao([set])
  check(
    'T8: a ação da p3 fica presa à posição III (onde ela estava QUANDO o rally 1 começou) — não na posição II onde ela terminou depois de girar',
    analise.p3[2].total === 1 && analise.p3[2].positivo === 1 && analise.p3[1].total === 0,
  )
  check(
    'T8: a ação da p2 fica presa à posição I (onde ela já estava quando o rally 2 começou, depois do giro)',
    analise.p2[0].total === 1 && analise.p2[0].positivo === 1,
  )
}

// ============================================================
// Teste 9 — Dados incompletos (set sem escalação) não inventam rotação
// ============================================================
{
  let set = criarSet(1) // sem escalacaoInicial nem primeiroSaque
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')

  check('T9: calcularRotacao retorna null quando não há escalação — não inventa um rodízio', calcularRotacao(set) === null)
  const analise = analisePorAtletaEPosicao([set])
  check('T9: analisePorAtletaEPosicao simplesmente não inclui esse set (não inventa posição pra a1)', Object.keys(analise).length === 0)
  // mas o scout "normal" (sem depender de posição) continua funcionando —
  // a ausência de escalação não trava as outras estatísticas.
  const a1 = scoutPorAtleta([set]).find((s) => s.atletaId === 'a1')
  check('T9: mesmo sem escalação, o evento ainda conta no scout geral da atleta', a1.porFundamento.ataque.total === 1)
}

// ============================================================
// Teste 10 — Recalcular duas vezes com os mesmos eventos dá o mesmo resultado
// ============================================================
{
  let set = criarSet(1)
  set = registrarEvento(set, 'saque', 'ACERTO', 'a1')
  set = registrarEvento(set, 'recepcao', 'BOM', 'a2')
  set = registrarEvento(set, 'ataque', 'ERRO', 'a1')

  const primeiraVez = scoutPorAtleta([set])
  const segundaVez = scoutPorAtleta([set]) // mesmo set, recalculado de novo
  check('T10: recalcular duas vezes com os mesmos dados dá exatamente o mesmo resultado (função pura, sem efeito colateral)', JSON.stringify(primeiraVez) === JSON.stringify(segundaVez))
  check('T10: nenhuma atleta foi duplicada no recálculo', primeiraVez.length === 2 && segundaVez.length === 2)
}

// ============================================================
// Teste 11 — Recuperação dos dados (simulando fechar/reabrir o app: round-trip JSON)
// ============================================================
{
  let set = criarSet(1)
  set = registrarEvento(set, 'saque', 'ACERTO', 'a1')
  set = registrarEvento(set, 'ataque', 'ERRO', 'a1')
  set = registrarEventoTime(set, 'ADVERSARIO', 'ataque', 'ERRO', undefined, '7')

  const antes = scoutPorAtleta([set])
  // Isso é exatamente o que acontece ao salvar no IndexedDB (JSON.stringify)
  // e ler de novo ao reabrir o app, ou ao vir do Supabase depois de sincronizar.
  const setRecuperado = JSON.parse(JSON.stringify(set))
  const depois = scoutPorAtleta([setRecuperado])

  check('T11: estatísticas recalculadas depois de "reabrir" (round-trip JSON) são idênticas às de antes', JSON.stringify(antes) === JSON.stringify(depois))
  check('T11: placar também sobrevive à recuperação sem mudar', set.placarCasa === setRecuperado.placarCasa && set.placarAdversario === setRecuperado.placarAdversario)
}

// ============================================================
// Teste 12 — Consistência entre telas (Perfil da atleta x Estatísticas da equipe)
// ============================================================
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  set = registrarEvento(set, 'ataque', 'ERRO', 'a2')
  set = registrarEvento(set, 'bloqueio', 'ACERTO', 'a1')
  set.finalizado = true
  set.vencedor = 'CASA'

  const partida = {
    id: 'p1', status: 'FINALIZADA', deletedAt: undefined, setsPartida: [set],
  }

  // "Perfil da atleta" usa agregarScoutAtleta (rating.ts); "Estatísticas"/
  // "Relatório" usam scoutPorAtleta (scoutEngine.ts) direto. Têm que bater.
  const viaPerfil = agregarScoutAtleta('a1', [partida])
  const viaRelatorio = scoutPorAtleta([set]).find((s) => s.atletaId === 'a1').porFundamento

  check('T12: ataque da a1 é igual no Perfil e no Relatório', viaPerfil.ataque.total === viaRelatorio.ataque.total && viaPerfil.ataque.positivo === viaRelatorio.ataque.positivo)
  check('T12: bloqueio da a1 é igual no Perfil e no Relatório', viaPerfil.bloqueio.total === viaRelatorio.bloqueio.total)

  // "Estatísticas da equipe" (scoutEquipe) tem que bater com a SOMA das atletas
  // individuais (scoutPorAtleta) — nunca divergir, já que os dois partem dos
  // mesmos eventos brutos.
  const equipe = scoutEquipe([set])
  const porAtleta = scoutPorAtleta([set])
  const somaAtaquePositivoIndividual = porAtleta.reduce((s, a) => s + a.porFundamento.ataque.positivo, 0)
  const somaAtaqueErroIndividual = porAtleta.reduce((s, a) => s + a.porFundamento.ataque.erro, 0)
  check('T12: total de ataques positivos da equipe = soma dos individuais (1)', equipe.ataque.positivo === somaAtaquePositivoIndividual && equipe.ataque.positivo === 1)
  check('T12: total de ataques com erro da equipe = soma dos individuais (1)', equipe.ataque.erro === somaAtaqueErroIndividual && equipe.ataque.erro === 1)
}

console.log(`\n${ok}/${ok} testes passaram.`)
