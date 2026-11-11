// Teste da eficiência geral da equipe (pedido 30/10/2026: comparação entre
// sets + evolução na temporada, "Nível 2" da sugestão que o Henrique trouxe
// de outra IA). Confirma que é recalculada a partir dos eventos — nunca a
// média dos percentuais de cada fundamento — e que não quebra sem dados.
import assert from 'node:assert'
import { criarSet, registrarEvento, registrarEventoTime, eficienciaGeralEquipe } from '../src/scoutEngine.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

// Set vazio: não quebra, não vira NaN.
{
  const set = criarSet(1)
  const g = eficienciaGeralEquipe([set])
  check('Set vazio: total 0, eficiência 0 (sem NaN)', g.total === 0 && g.eficiencia === 0 && !Number.isNaN(g.eficiencia))
}

// 2 fundamentos com eficiências bem diferentes — tem que ser o total
// recalculado, não a média simples dos dois percentuais.
{
  let set = criarSet(1)
  set = registrarEvento(set, 'saque', 'ACERTO', 'a1') // saque: 1/1 = 100%
  set = registrarEvento(set, 'saque', 'ACERTO', 'a1') // saque: 2/2 = 100%
  set = registrarEvento(set, 'ataque', 'ERRO', 'a1') // ataque: -1/1 = -100%
  // Média simples dos percentuais (100% e -100%) daria 0%. O certo é somar os
  // eventos: 2 positivos, 1 erro, 3 ações no total => (2-1)/3*100 = 33%.
  const g = eficienciaGeralEquipe([set])
  check('Eficiência geral é recalculada dos totais (33%), não a média simples dos percentuais por fundamento (que daria 0%)', g.total === 3 && g.positivo === 2 && g.erro === 1 && g.eficiencia === Math.round((1 / 3) * 100))
}

// Eventos do adversário não entram na eficiência GERAL da nossa equipe.
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  set = registrarEventoTime(set, 'ADVERSARIO', 'saque', 'ERRO') // ponto nosso, mas não é ação de nenhuma atleta nossa
  const g = eficienciaGeralEquipe([set])
  check('Erro do adversário não entra na eficiência geral da equipe (só ações nossas contam)', g.total === 1 && g.positivo === 1)
}

// Comparação entre 2 sets diferentes (uso real: tabela de comparação no Relatório).
{
  let set1 = criarSet(1)
  set1 = registrarEvento(set1, 'ataque', 'ACERTO', 'a1')
  set1 = registrarEvento(set1, 'ataque', 'ACERTO', 'a1')
  let set2 = criarSet(2)
  set2 = registrarEvento(set2, 'ataque', 'ERRO', 'a1')
  const g1 = eficienciaGeralEquipe([set1])
  const g2 = eficienciaGeralEquipe([set2])
  check('Set 1 e Set 2 têm eficiências diferentes e independentes (100% e -100%)', g1.eficiencia === 100 && g2.eficiencia === -100)
}

console.log(`\n${ok}/${ok} testes passaram.`)
