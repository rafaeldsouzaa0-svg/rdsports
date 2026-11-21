// Teste da líbero no rodízio (pedido 21/11/2026): ela fica fora das 6, entra
// sozinha no fundo de quadra (I, V, VI) no lugar das atletas marcadas
// (centrais), sai quando essa atleta volta pra rede, e NÃO saca — na posição
// I com o saque nosso, quem saca é a própria central.
import { registrarEventoTime, criarSet, calcularRotacao, aplicarSubstituicao, analisePorAtletaEPosicao, quadraComLibero } from '../src/scoutEngine.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const [S, P1, C1, O, P2, C2, L, C3] = ['lev', 'pon1', 'cen1', 'opo', 'pon2', 'cen2', 'libero', 'cen3']

const pontoNosso = (set, quem = O) => registrarEventoTime(set, 'CASA', 'ataque', 'ACERTO', quem)
const pontoDeles = (set) => registrarEventoTime(set, 'ADVERSARIO', 'ataque', 'ACERTO')

// Escalação: I=lev, II=pon1, III=cen1, IV=opo, V=pon2, VI=cen2. Adversário saca.
let set = {
  ...criarSet(1),
  escalacaoInicial: [S, P1, C1, O, P2, C2],
  primeiroSaque: 'ADVERSARIO',
  libero: { atletaId: L, substitui: [C1, C2] },
}

let r = calcularRotacao(set)
assert(r.posicoes[5] === L, 'Início: líbero entra na VI no lugar da central 2 (fundo)')
assert(r.base[5] === C2, 'O rodízio "base" continua com a central 2 na VI')
assert(r.posicoes[2] === C1, 'Central 1 está na rede (III), líbero não mexe nela')
assert(!r.posicoes.includes(C2), 'Central 2 fica fora enquanto a líbero joga')

// Ganhamos o saque: gira. Base = [pon1, cen1, opo, pon2, cen2, lev].
set = pontoNosso(set)
r = calcularRotacao(set)
assert(r.servindo === 'CASA' && r.posicoes[0] === P1, 'Depois do side-out, pon1 saca na I')
assert(r.posicoes[4] === L, 'Central 2 foi pra V (fundo): a líbero acompanha')

// Ganhamos de novo (não gira), perdemos o saque, ganhamos de volta (gira).
// Base = [cen1, opo, pon2, cen2, lev, pon1] — central 1 na I, nosso saque.
set = pontoNosso(set)
set = pontoDeles(set)
set = pontoNosso(set)
r = calcularRotacao(set)
assert(r.servindo === 'CASA', 'Saque é nosso')
assert(r.posicoes[0] === C1, 'Central 1 na I SACA: a líbero não saca')
assert(!r.posicoes.includes(L), 'Líbero fica fora enquanto a central 1 saca (central 2 está na rede, IV)')
assert(r.posicoes[3] === C2, 'Central 2 voltou pra rede (IV) e jogou no lugar da líbero')

// Perdemos o saque: central 1 continua na I, agora no fundo sem sacar → líbero entra.
set = pontoDeles(set)
r = calcularRotacao(set)
assert(r.servindo === 'ADVERSARIO' && r.posicoes[0] === L, 'Perdeu o saque: líbero entra na I no lugar da central 1')

// Substituição: central 3 entra no lugar da central 1 (pela posição dela no
// rodízio base, mesmo com a líbero em quadra). A líbero passa a trocar com a
// central 3.
set = aplicarSubstituicao(set, 0, C3)
r = calcularRotacao(set)
assert(r.base[0] === C3, 'Central 3 entrou no rodízio base, na I')
assert(r.posicoes[0] === L, 'Líbero continua em quadra, agora no lugar da central 3')
set = pontoNosso(set) // gira: central 3 vai pra VI, ainda fundo
r = calcularRotacao(set)
assert(r.posicoes[5] === L && r.base[5] === C3, 'Líbero acompanha a central 3 no fundo (herdou a troca)')

// Ação da líbero conta na posição em que ela estava (VI).
set = registrarEventoTime(set, 'CASA', 'recepcao', 'BOM', L)
const porAtleta = analisePorAtletaEPosicao([set])
assert(porAtleta[L] && porAtleta[L][5].total === 1, 'Recepção da líbero contada na posição VI')

// Set sem líbero continua igual a antes.
const semLibero = { ...criarSet(1), escalacaoInicial: [S, P1, C1, O, P2, C2], primeiroSaque: 'ADVERSARIO' }
assert(calcularRotacao(semLibero).posicoes.join() === [S, P1, C1, O, P2, C2].join(), 'Set sem líbero: rodízio igual a antes')

// Configuração estranha (as duas centrais no fundo): a líbero entra em só um lugar.
const quadra = quadraComLibero([C1, 'x', 'y', 'z', C2, 'w'], 'ADVERSARIO', L, [C1, C2])
assert(quadra.filter((p) => p === L).length === 1, 'Líbero nunca aparece em dois lugares ao mesmo tempo')

if (falhas > 0) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nTodos os testes da líbero passaram.')
