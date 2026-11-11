// Teste de side-out % / break point % (pedido 30/10/2026 — estatística
// pedida pelo Henrique depois da minha sugestão de "o que mais ajudaria").
import assert from 'node:assert'
import { criarSet, registrarEvento, registrarEventoTime, sideOutBreakPoint } from '../src/scoutEngine.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

// Set sem primeiroSaque definido: ignorado, nunca inventa dado.
{
  const set = criarSet(1)
  const r = sideOutBreakPoint([set])
  check('Set sem primeiroSaque: tudo zerado, sem NaN', r.sideOutOportunidades === 0 && r.breakOportunidades === 0 && !Number.isNaN(r.sideOutPct) && !Number.isNaN(r.breakPct))
}

// Nós sacamos primeiro e ganhamos o rally (ace) -> conta como BREAK (nós
// sacando), não como side-out.
{
  let set = criarSet(1)
  set = { ...set, primeiroSaque: 'CASA' }
  set = registrarEvento(set, 'saque', 'ACERTO', 'a1') // ace nosso
  const r = sideOutBreakPoint([set])
  check('Ace nosso no nosso saque: conta como break (1/1), não side-out', r.breakOportunidades === 1 && r.breakPontos === 1 && r.sideOutOportunidades === 0)
}

// Adversário sacou (perdemos o saque pro adversário antes), e nós ganhamos o
// rally recebendo -> side-out.
{
  let set = criarSet(1)
  set = { ...set, primeiroSaque: 'ADVERSARIO' }
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // ganhamos o rally recebendo
  const r = sideOutBreakPoint([set])
  check('Ganhamos recebendo: conta como side-out (1/1)', r.sideOutOportunidades === 1 && r.sideOutPontos === 1 && r.breakOportunidades === 0)
}

// Cenário completo: primeiroSaque ADVERSARIO. 1) perdemos o rally recebendo
// (erro de recepção) -> side-out oportunidade perdida, adversário continua
// sacando. 2) perdemos de novo -> outra oportunidade de side-out perdida.
// 3) ganhamos recebendo -> side-out convertido, viramos sacadoras.
// 4) ganhamos sacando (ace) -> break convertido.
// 5) erramos o saque -> break perdido, adversário recebe o saque de volta.
{
  let set = criarSet(1)
  set = { ...set, primeiroSaque: 'ADVERSARIO' }
  set = registrarEvento(set, 'recepcao', 'ERRO', 'a1')        // 1) adversário ponto, continua sacando
  set = registrarEvento(set, 'recepcao', 'ERRO', 'a1')        // 2) adversário ponto, continua sacando
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')        // 3) nosso ponto recebendo -> viramos sacadoras
  set = registrarEvento(set, 'saque', 'ACERTO', 'a1')         // 4) ace nosso sacando
  set = registrarEvento(set, 'saque', 'ERRO', 'a1')           // 5) erramos o saque -> adversário ponto, vira saque dele
  const r = sideOutBreakPoint([set])
  check('Side-out: 1 ponto em 3 oportunidades (33%)', r.sideOutOportunidades === 3 && r.sideOutPontos === 1 && r.sideOutPct === Math.round(1 / 3 * 100))
  check('Break: 1 ponto em 2 oportunidades (50%)', r.breakOportunidades === 2 && r.breakPontos === 1 && r.breakPct === 50)
}

// Eventos do adversário (erro dele, que é ponto nosso) também contam
// corretamente no lado em que estávamos (recebendo ou sacando).
{
  let set = criarSet(1)
  set = { ...set, primeiroSaque: 'ADVERSARIO' }
  set = registrarEventoTime(set, 'ADVERSARIO', 'saque', 'ERRO') // saque dele foi pra fora -> ponto nosso recebendo
  const r = sideOutBreakPoint([set])
  check('Erro de saque do adversário: conta como side-out convertido', r.sideOutOportunidades === 1 && r.sideOutPontos === 1)
}

// Soma corretamente vários sets.
{
  let set1 = criarSet(1)
  set1 = { ...set1, primeiroSaque: 'CASA' }
  set1 = registrarEvento(set1, 'saque', 'ACERTO', 'a1') // break convertido
  let set2 = criarSet(2)
  set2 = { ...set2, primeiroSaque: 'CASA' }
  set2 = registrarEvento(set2, 'saque', 'ERRO', 'a1') // break perdido
  const r = sideOutBreakPoint([set1, set2])
  check('Soma de 2 sets: break 1/2 (50%)', r.breakOportunidades === 2 && r.breakPontos === 1 && r.breakPct === 50)
}

console.log(`\n${ok}/${ok} testes passaram.`)
