// Testes de: desempenho em pontos decisivos, impacto de substituição e
// combinarLinhas (pedido 30/10/2026).
import assert from 'node:assert'
import {
  criarSet, registrarEvento, desempenhoEmPontosDecisivos, impactoSubstituicao, combinarLinhas,
  aplicarSubstituicao, linhaVazia,
} from '../src/scoutEngine.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

const PARTIDA_25 = { formato: 'MELHOR_DE_5', pontosSetNormal: 25, pontosSetDecisivo: 15 }

// --- combinarLinhas ---
{
  const l1 = { ...linhaVazia(), positivo: 2, erro: 1, total: 3 }
  const l2 = { ...linhaVazia(), positivo: 1, erro: 0, total: 1 }
  const c = combinarLinhas([l1, l2])
  check('combinarLinhas soma totais corretamente', c.positivo === 3 && c.erro === 1 && c.total === 4)
  check('combinarLinhas recalcula eficiência do total (não média)', c.eficiencia === Math.round((3 - 1) / 4 * 100))
}
{
  const c = combinarLinhas([])
  check('combinarLinhas de lista vazia: zerado, sem NaN', c.total === 0 && c.eficiencia === 0 && !Number.isNaN(c.eficiencia))
}

// --- desempenhoEmPontosDecisivos ---
// Set até 25: "decisivo" começa em 25-5=20. Ações antes de 20x? contam como
// normal; ações com o maior placar >= 20 contam como decisivo.
{
  let set = criarSet(1)
  // Simula vários pontos nossos até chegar perto do fim (ações simples:
  // ataque acerto = ponto nosso).
  for (let i = 0; i < 19; i++) set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // 0..18 -> placar sobe até 19x0
  const antes = desempenhoEmPontosDecisivos([set], PARTIDA_25)
  check('Antes de chegar a 20: tudo "normal", nada "decisivo" ainda', antes.decisivo.total === 0 && antes.normal.total === 19)

  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // placar vai de 19x0 pra 20x0 -> ESSE evento ainda é "normal" (antes do rally, placar era 19x0 < 20)
  set = registrarEvento(set, 'ataque', 'ERRO', 'a1')   // placar antes do rally: 20x0 (>=20) -> esse evento é "decisivo"
  const depois = desempenhoEmPontosDecisivos([set], PARTIDA_25)
  check('Evento que LEVA o placar a 20 ainda conta como normal (placar ANTES do rally decide)', depois.normal.total === 20)
  check('Evento com placar de entrada >= 20 conta como decisivo', depois.decisivo.total === 1 && depois.decisivo.erro === 1)
}

// Set decisivo (alvo 15): decisivo começa em 15-5=10.
{
  const partidaComDecisivoCurto = { formato: 'MELHOR_DE_5', pontosSetNormal: 25, pontosSetDecisivo: 15 }
  let set = criarSet(5) // 5º set = decisivo em MELHOR_DE_5 (totalSets=5)
  for (let i = 0; i < 10; i++) set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // placar sobe até 10x0
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // placar ANTES = 10x0 (>=10) -> decisivo
  const r = desempenhoEmPontosDecisivos([set], partidaComDecisivoCurto)
  check('Set decisivo usa o alvo de 15 (não 25): decisivo começa em 10, não em 20', r.decisivo.total === 1 && r.normal.total === 10)
}

// --- impactoSubstituicao ---
{
  let set = criarSet(1)
  set = { ...set, escalacaoInicial: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'], primeiroSaque: 'CASA' }
  // 2 rallies ANTES da troca: 1 acerto, 1 erro -> antes: total 2, eficiência 0%.
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  set = registrarEvento(set, 'ataque', 'ERRO', 'a1')
  set = aplicarSubstituicao(set, 0, 'a7') // troca na posição 0, depois de 2 rallies fechados
  // 3 rallies DEPOIS da troca, todos acerto -> depois: total 3, eficiência 100%.
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a7')
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a7')
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a7')

  const subId = set.substituicoes[0].id
  const impacto = impactoSubstituicao(set, subId)
  check('Impacto: antes tem 2 ações com eficiência 0%', impacto.antes.total === 2 && impacto.antes.eficiencia === 0)
  check('Impacto: depois tem 3 ações com eficiência 100%', impacto.depois.total === 3 && impacto.depois.eficiencia === 100)
}

// Substituição inexistente: null (nunca inventa dado).
{
  const set = criarSet(1)
  check('impactoSubstituicao com id inexistente: null', impactoSubstituicao(set, 'id-que-nao-existe') === null)
}

console.log(`\n${ok}/${ok} testes passaram.`)
