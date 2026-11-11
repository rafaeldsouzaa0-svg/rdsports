// Teste de sequências de pontos / runs (pedido 30/10/2026).
import assert from 'node:assert'
import { criarSet, registrarEvento, sequenciasDePontos, maiorSequenciaPartida } from '../src/scoutEngine.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

// Set vazio: nenhuma sequência.
{
  const set = criarSet(1)
  check('Set vazio: nenhuma sequência', sequenciasDePontos(set).length === 0)
}

// Sequência de 3 pontos nossos seguidos (0x0 -> 3x0), não destaca sequências
// menores que o mínimo (padrão 3).
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  set = registrarEvento(set, 'ataque', 'ERRO', 'a1') // ponto do adversário, só 1 -> não destaca
  const seqs = sequenciasDePontos(set)
  check('1 sequência de 3 pontos nossos (0x0 -> 3x0)', seqs.length === 1 && seqs[0].lado === 'CASA' && seqs[0].tamanho === 3)
  check('Placar antes/depois da sequência corretos', seqs[0].placarCasaAntes === 0 && seqs[0].placarAdversarioAntes === 0 && seqs[0].placarCasaDepois === 3 && seqs[0].placarAdversarioDepois === 0)
}

// Sequência que NÃO começa do 0x0 (placar "antes" tem que vir do ponto
// anterior, não de zero).
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ERRO', 'a1')  // 0x1 (ponto adversário)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // 1x1
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // 2x1
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1') // 3x1 -> sequência de 3 nossos
  const seqs = sequenciasDePontos(set)
  check('Sequência não começa do zero: antes é 0x1 (não 0x0)', seqs.length === 1 && seqs[0].placarCasaAntes === 0 && seqs[0].placarAdversarioAntes === 1)
  check('Depois da sequência: 3x1', seqs[0].placarCasaDepois === 3 && seqs[0].placarAdversarioDepois === 1)
}

// minimoParaDestaque customizado inclui sequências menores.
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  set = registrarEvento(set, 'ataque', 'ACERTO', 'a1')
  const seqs3 = sequenciasDePontos(set, 3)
  const seqs2 = sequenciasDePontos(set, 2)
  check('Com mínimo 3: sequência de 2 não aparece', seqs3.length === 0)
  check('Com mínimo 2: sequência de 2 aparece', seqs2.length === 1 && seqs2[0].tamanho === 2)
}

// Sequência do ADVERSÁRIO é detectada igual.
{
  let set = criarSet(1)
  set = registrarEvento(set, 'ataque', 'ERRO', 'a1')
  set = registrarEvento(set, 'ataque', 'ERRO', 'a1')
  set = registrarEvento(set, 'ataque', 'ERRO', 'a1')
  const seqs = sequenciasDePontos(set)
  check('Sequência do adversário detectada (3 erros nossos seguidos)', seqs.length === 1 && seqs[0].lado === 'ADVERSARIO' && seqs[0].tamanho === 3)
}

// maiorSequenciaPartida pega a maior entre vários sets, com o número do set certo.
{
  let set1 = criarSet(1)
  set1 = registrarEvento(set1, 'ataque', 'ACERTO', 'a1')
  set1 = registrarEvento(set1, 'ataque', 'ACERTO', 'a1')
  let set2 = criarSet(2)
  set2 = registrarEvento(set2, 'ataque', 'ACERTO', 'a1')
  set2 = registrarEvento(set2, 'ataque', 'ACERTO', 'a1')
  set2 = registrarEvento(set2, 'ataque', 'ACERTO', 'a1')
  set2 = registrarEvento(set2, 'ataque', 'ACERTO', 'a1')
  const maior = maiorSequenciaPartida([set1, set2])
  check('Maior sequência veio do set 2 (4 pontos)', maior !== null && maior.setNumero === 2 && maior.tamanho === 4)
}

// maiorSequenciaPartida com sets vazios: null.
{
  check('maiorSequenciaPartida de sets vazios: null', maiorSequenciaPartida([criarSet(1), criarSet(2)]) === null)
}

console.log(`\n${ok}/${ok} testes passaram.`)
