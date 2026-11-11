// Teste isolado das novidades do Scout ao vivo (22/10/2026): rodízio automático,
// desfazer última marcação, e registro de erro do adversário.
import { criarSet, registrarEvento, desfazerUltimoEvento, registrarErroAdversario, calcularRotacao, erroPorFundamentoAdversario } from '../src/scoutEngine.ts'

let falhas = 0
function assert(cond, msg) { if (!cond) { console.error('FALHOU:', msg); falhas++ } else console.log('OK:', msg) }

// --- Rodízio: só gira quando GANHAMOS o saque de volta (side-out a nosso favor) ---
let set = criarSet(1)
set.escalacaoInicial = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
set.primeiroSaque = 'CASA'

let rot = calcularRotacao(set)
assert(rot.servindo === 'CASA' && rot.posicoes[0] === 'p1', 'Rodízio inicial: p1 na posição 1, nós sacando')

// Nós sacamos e ganhamos o ponto (ace) — continuamos sacando, NÃO gira.
set = registrarEvento(set, 'saque', 'ACERTO')
rot = calcularRotacao(set)
assert(rot.servindo === 'CASA' && rot.posicoes[0] === 'p1', 'Ace nosso: continuamos sacando, rodízio não gira')

// Erramos o saque — vira saque do adversário (side-out contra nós, não gira AINDA).
set = registrarEvento(set, 'saque', 'ERRO')
rot = calcularRotacao(set)
assert(rot.servindo === 'ADVERSARIO' && rot.posicoes[0] === 'p1', 'Perdemos o saque: adversário saca, nosso rodízio ainda não girou')

// Ganhamos o rally de volta (ex.: erro de ataque do adversário não registrado aqui,
// simulado como um ataque nosso que fecha o rally) — viramos sacadoras: GIRA.
set = registrarEvento(set, 'ataque', 'ACERTO')
rot = calcularRotacao(set)
assert(rot.servindo === 'CASA' && rot.posicoes[0] === 'p2', 'Recuperamos o saque: rodízio girou, p2 assume a posição 1')

// --- Desfazer: remove o último evento e recalcula o placar certo ---
let s2 = criarSet(1)
s2 = registrarEvento(s2, 'ataque', 'ACERTO') // 1x0
assert(s2.placarCasa === 1, 'Placar 1x0 antes de desfazer')
s2 = desfazerUltimoEvento(s2)
assert(s2.placarCasa === 0 && s2.rallies.length === 0, 'Desfazer remove o rally inteiro e zera o placar')

let s3 = criarSet(1)
s3 = registrarEvento(s3, 'recepcao', 'BOM') // estatística, não fecha rally
s3 = registrarEvento(s3, 'ataque', 'ACERTO') // fecha 1x0, mesmo rally
assert(s3.placarCasa === 1 && s3.rallies[0].eventos.length === 2, 'Rally com 2 eventos, 1x0')
s3 = desfazerUltimoEvento(s3) // desfaz só o ataque (que fechou) — sobra a recepção
assert(s3.placarCasa === 0 && s3.rallies.length === 1 && s3.rallies[0].eventos.length === 1, 'Desfazer o evento que fechava reabre o rally, mantendo a recepção')

// --- Erro do adversário: sempre fecha o rally e soma ponto pra nós ---
let s4 = criarSet(1)
s4 = registrarErroAdversario(s4, 'saque', '7')
assert(s4.placarCasa === 1 && s4.placarAdversario === 0, 'Erro de saque do adversário (nº 7) vira ponto nosso')
s4 = registrarErroAdversario(s4, 'ataque')
assert(s4.placarCasa === 2, 'Segundo erro do adversário (sem número) também soma ponto')

const porFundamento = erroPorFundamentoAdversario([s4])
assert(porFundamento.saque.total === 1 && porFundamento.saque.porNumero['7'] === 1, 'Agregação: 1 erro de saque do adversário, da nº 7')
assert(porFundamento.ataque.total === 1 && Object.keys(porFundamento.ataque.porNumero).length === 0, 'Agregação: 1 erro de ataque do adversário, sem número')

console.log(falhas === 0 ? '\nTudo passou.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
