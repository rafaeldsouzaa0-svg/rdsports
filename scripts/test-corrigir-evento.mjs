// Teste do editor de correção de eventos (pedido 30/10/2026 — "melhorar o
// desfazer": poder corrigir a atleta, o fundamento ou o resultado de
// QUALQUER lançamento do passado, não só o último, com histórico auditável
// e placar sempre recalculado a partir dos eventos — nunca "na mão").
import assert from 'node:assert'
import {
  criarSet, registrarEvento, registrarEventoTime, listarEventosDoSet, corrigirEvento, calcularRotacao,
} from '../src/scoutEngine.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

// --- T1: corrigir a ATLETA de um evento que NÃO fechou o rally (ex.: um
// levantamento no meio do rally) não deve mexer no placar nem no número de
// rallies — só troca de quem é a estatística.
{
  let set = criarSet(1)
  set = registrarEvento(set, 'levantamento', 'BOM', 'a1')
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a2') // fecha o rally, ponto nosso
  const eventos = listarEventosDoSet(set)
  const evLevantamento = eventos.find((e) => e.fundamento === 'levantamento')
  const corrigido = corrigirEvento(set, evLevantamento.id, { atletaId: 'a3' })
  check('Corrigir atleta de evento que não fecha rally: placar intacto', corrigido.placarCasa === 1 && corrigido.placarAdversario === 0)
  check('Corrigir atleta de evento que não fecha rally: nº de rallies intacto', corrigido.rallies.length === 1)
  const eventosDepois = listarEventosDoSet(corrigido)
  check('Evento de levantamento agora pertence à atleta corrigida (a3)', eventosDepois.find((e) => e.fundamento === 'levantamento').atletaId === 'a3')
  check('Evento de ataque permanece intacto (a2)', eventosDepois.find((e) => e.fundamento === 'ataque').atletaId === 'a2')
}

// --- T2: corrigir o RESULTADO de um evento que fechava o rally pra nós
// (ACERTO) pra ERRO — o ponto tem que virar pro adversário, recalculado do
// zero (não só "subtrair 1 de um lado e somar no outro" na mão).
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // ponto nosso: 1x0
  const eventos = listarEventosDoSet(set)
  const evAtaque = eventos[0]
  check('Antes da correção: 1x0 pra nós', set.placarCasa === 1 && set.placarAdversario === 0)
  const corrigido = corrigirEvento(set, evAtaque.id, { resultado: 'ERRO' })
  check('Corrigir ACERTO→ERRO: o ponto vira pro adversário (0x1)', corrigido.placarCasa === 0 && corrigido.placarAdversario === 1)
  check('Corrigir ACERTO→ERRO: continua havendo 1 rally só', corrigido.rallies.length === 1)
}

// --- T3: corrigir um evento do MEIO do set recalcula corretamente o que vem
// DEPOIS dele (placar final consistente, não só o rally corrigido).
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ERRO', 'a1') // ponto adversário: 0x1
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // ponto nosso: 1x1
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // ponto nosso: 2x1
  const primeiroEvento = listarEventosDoSet(set)[0]
  // Corrige o PRIMEIRO evento (que era erro nosso) pra acerto nosso — os dois
  // pontos seguintes continuam sendo nossos, então o placar final sobe pra 3x0.
  const corrigido = corrigirEvento(set, primeiroEvento.id, { resultado: 'ACERTO' })
  check('Corrigir evento do meio do set recalcula o placar final certo (3x0, não 2x1 com patch manual)', corrigido.placarCasa === 3 && corrigido.placarAdversario === 0)
  check('Corrigir evento do meio do set recalcula 3 rallies fechados', corrigido.rallies.length === 3)
}

// --- T4: corrigir o FUNDAMENTO de um evento (ex.: era "ataque", era na
// verdade "bloqueio") muda a classificação sem mudar o resultado/pontuação.
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  const ev = listarEventosDoSet(set)[0]
  const corrigido = corrigirEvento(set, ev.id, { fundamento: 'bloqueio' })
  check('Corrigir fundamento: placar não muda (continua ponto nosso)', corrigido.placarCasa === 1 && corrigido.placarAdversario === 0)
  check('Corrigir fundamento: evento passa a ser bloqueio', listarEventosDoSet(corrigido)[0].fundamento === 'bloqueio')
}

// --- T5: histórico de correções é sempre ANEXADO (nunca sobrescrito), com
// antes/depois corretos.
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ERRO', 'a1')
  const ev = listarEventosDoSet(set)[0]
  set = corrigirEvento(set, ev.id, { resultado: 'ACERTO' })
  check('1ª correção: histórico tem 1 entrada', set.correcoes?.length === 1)
  check('1ª correção: antes=ERRO, depois=ACERTO', set.correcoes[0].antes.resultado === 'ERRO' && set.correcoes[0].depois.resultado === 'ACERTO')
  set = corrigirEvento(set, ev.id, { atletaId: 'a2' })
  check('2ª correção no MESMO evento: histórico tem 2 entradas (nunca sobrescreve)', set.correcoes?.length === 2)
  check('2ª correção: antes=a1, depois=a2', set.correcoes[1].antes.atletaId === 'a1' && set.correcoes[1].depois.atletaId === 'a2')
  check('1ª entrada do histórico continua intacta depois da 2ª correção', set.correcoes[0].antes.resultado === 'ERRO' && set.correcoes[0].depois.resultado === 'ACERTO')
}

// --- T6: correção "vazia" (sem mudar nada de verdade) não cria entrada no
// histórico nem mexe no set.
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  const ev = listarEventosDoSet(set)[0]
  const semMudanca = corrigirEvento(set, ev.id, { resultado: 'ACERTO', atletaId: 'a1' })
  check('Correção sem mudança real: não cria histórico', !semMudanca.correcoes || semMudanca.correcoes.length === 0)
}

// --- T7: corrigir um eventoId que não existe no set não faz nada (nunca
// inventa/ignora silenciosamente um evento errado).
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  const antes = JSON.stringify(set)
  const corrigido = corrigirEvento(set, 'id-que-nao-existe', { resultado: 'ERRO' })
  check('corrigirEvento com id inexistente: set fica idêntico', JSON.stringify(corrigido) === antes)
}

// --- T8: corrigir o numeroAdversario de um evento do adversário funciona e
// não mexe no placar/fundamento.
{
  let set = criarSet(1)
  set = registrarEventoTime(set, 'ADVERSARIO', 'saque', 'ERRO', undefined, '7') // nosso ponto
  const ev = listarEventosDoSet(set)[0]
  const corrigido = corrigirEvento(set, ev.id, { numeroAdversario: '9' })
  check('Corrigir nº do adversário: placar intacto (1x0)', corrigido.placarCasa === 1 && corrigido.placarAdversario === 0)
  check('Corrigir nº do adversário: nº atualizado pra 9', listarEventosDoSet(corrigido)[0].numeroAdversario === '9')
}

// --- T9: corrigir um evento que muda o número de rallies fechados recalcula
// a rotação certinho a partir dos eventos corrigidos (não trava, não inventa
// posição) — uso real: a atleta que a rotação mostra em quadra muda se a
// correção adiantar/atrasar quando o rally fechou.
{
  let set = criarSet(1)
  set = { ...set, escalacaoInicial: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'], primeiroSaque: 'CASA' }
  set = registrarEvento(set, 'ataque', 'EM_JOGO', 'a1') // não fecha — bola segue em jogo
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // fecha: ponto nosso, mas servindo já era CASA -> não gira
  const rotacaoAntes = calcularRotacao(set)
  check('Antes da correção: rotação calculada sem travar', rotacaoAntes !== null && rotacaoAntes.posicoes.length === 6)
  const evEmJogo = listarEventosDoSet(set).find((e) => e.resultado === 'EM_JOGO')
  // Corrige o 1º evento pra ERRO (vira ponto do adversário) — agora o rally
  // fecha ali mesmo, e o 2º evento (ACERTO) vira um rally NOVO.
  const corrigido = corrigirEvento(set, evEmJogo.id, { resultado: 'ERRO' })
  check('Corrigir evento que muda fechamento de rally: 2 rallies agora (era 1)', corrigido.rallies.length === 2)
  const rotacaoDepois = calcularRotacao(corrigido)
  check('Depois da correção: rotação recalculada sem travar', rotacaoDepois !== null && rotacaoDepois.posicoes.length === 6)
}

console.log(`\n${ok}/${ok} testes passaram.`)
