// Scout por voz no ginásio (21/11/2026): apelidos, sobrenome, palavras
// ouvidas errado e escolha entre as versões que o microfone devolve.
import { interpretarFala, escolherMelhorFala, corrigirPalavras, separarApelidos } from '../src/scoutVoz.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const atl = (id, nome, numero, apelidos) => ({ id, nome, numero, apelidos })
const emQuadra = [
  atl('cl', 'Cláudia Orsini', '4', ['Cacau', 'Clau']),
  atl('pr', 'Priscila Fasterra', '9', ['Pri']),
  atl('ga', 'Gabriela Camisotti', '11'),
  atl('lu', 'Luciana Zuri', '2', ['Lu']),
  atl('sa', 'Sacha Lima', '5'),
  atl('ma', 'Maria Eduarda Souza', '8', ['Duda']),
]
const ctx = { emQuadra, todas: emQuadra, sacadoraId: 'ga' }
const fala = (t) => interpretarFala(t, ctx)
const ok = (r, f, res, id) => r.tipo === 'jogada' && r.fundamento === f && r.resultado === res && r.atletaId === id && r.faltando.length === 0

assert(separarApelidos('Cacau, Clau / Claudinha').join('|') === 'Cacau|Clau|Claudinha', 'Separa apelidos por vírgula ou barra')

// Apelidos
assert(ok(fala('ataque da Cacau ponto'), 'ataque', 'ACERTO', 'cl'), 'Apelido "Cacau" acha a Cláudia')
assert(ok(fala('bloqueio Pri ponto'), 'bloqueio', 'ACERTO', 'pr'), 'Apelido curto "Pri" (exato) acha a Priscila')
assert(ok(fala('recepção da Duda boa'), 'recepcao', 'BOM', 'ma'), 'Apelido "Duda" acha a Maria Eduarda')
assert(ok(fala('ataque Cacao ponto'), 'ataque', 'ACERTO', 'cl'), 'Apelido com erro pequeno ("Cacao") ainda acha')

// Sobrenome
assert(ok(fala('ataque da Orsini ponto'), 'ataque', 'ACERTO', 'cl'), 'Sobrenome "Orsini" acha a Cláudia')
assert(ok(fala('ataque Camisotti erro'), 'ataque', 'ERRO', 'ga'), 'Sobrenome "Camisotti" acha a Gabriela')

// Palavras ouvidas errado
assert(corrigirPalavras('ataque cacau pronto', ctx) === 'ataque cacau ponto', '"pronto" vira "ponto"')
assert(ok(fala('ataqui da Gabriela pronto'), 'ataque', 'ACERTO', 'ga'), '"ataqui ... pronto" = ataque ponto')
assert(ok(fala('bloqueiu Luciana ponto'), 'bloqueio', 'ACERTO', 'lu'), '"bloqueiu" = bloqueio')
assert(ok(fala('ase'), 'saque', 'ACERTO', 'ga'), '"ase" = ace da sacadora')
assert(ok(fala('defeza da Priscila boa'), 'defesa', 'BOM', 'pr'), '"defeza" = defesa')
assert(ok(fala('ataque Gabriela pontu'), 'ataque', 'ACERTO', 'ga') || fala('ataque Gabriela pontu').faltando.join() === 'resultado', '"pontu" não vira coisa errada')
assert(corrigirPalavras('saque sacha erro', ctx) === 'saque sacha erro', 'Nome de atleta ("Sacha") nunca é trocado por palavra do scout')
assert(ok(fala('saque da Sacha erro'), 'saque', 'ERRO', 'sa'), '"Sacha" continua sendo a atleta')

// Várias versões do microfone
const escolha = escolherMelhorFala(['a taca da cacau pronto', 'ataque da cacau ponto', 'ataque da casa ponto'], ctx)
assert(escolha.texto === 'ataque da cacau ponto', 'Fica com a versão que o scout entende por completo')
assert(escolha.fala.tipo === 'jogadas' && escolha.fala.jogadas[0].atletaId === 'cl', '...e marca a atleta certa')
const empate = escolherMelhorFala(['ataque gabriela ponto', 'ataque luciana ponto'], ctx)
assert(empate.texto === 'ataque gabriela ponto', 'Empate: fica com a mais provável (a primeira)')
assert(escolherMelhorFala(['', '  '], ctx).fala.tipo === 'vazio', 'Nada ouvido: vazio')
assert(escolherMelhorFala(['confirma'], ctx, true).fala.tipo === 'confirmar', '"confirma" com lista esperando continua funcionando')

if (falhas) { console.error(`${falhas} falha(s)`); process.exit(1) }
