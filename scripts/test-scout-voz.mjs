// Teste do scout por voz (pedido 21/11/2026): frases faladas viram a mesma
// marcação dos botões — e o que não der pra entender vira pergunta, nunca
// chute.
import { interpretarFala, fraseConfirmacao, normalizarFala } from '../src/scoutVoz.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const atl = (id, nome, numero) => ({ id, nome, numero })
const emQuadra = [atl('ju', 'Júlia', '1'), atl('ma', 'Marina', '7'), atl('ca', 'Carol'), atl('bi', 'Bianca'), atl('le', 'Letícia'), atl('so', 'Sofia', '10')]
const todas = [...emQuadra, atl('he', 'Helena'), atl('ac', 'Ana Clara'), atl('al', 'Ana Luiza')]
const ctx = { emQuadra, todas, sacadoraId: 'ju' }
const fala = (t, c = ctx) => interpretarFala(t, c)
const ok = (r, lado, f, res, atletaId) =>
  r.tipo === 'jogada' && r.lado === lado && r.fundamento === f && r.resultado === res && (atletaId === undefined || r.atletaId === atletaId) && r.faltando.length === 0

assert(normalizarFala('Ataque da Marína, PONTO!') === 'ataque da marina ponto', 'Normaliza acento, maiúscula e pontuação')

// Nosso time
assert(ok(fala('Ataque da Marina, ponto'), 'CASA', 'ataque', 'ACERTO', 'ma'), '"Ataque da Marina, ponto"')
assert(ok(fala('ataque marina erro'), 'CASA', 'ataque', 'ERRO', 'ma'), '"ataque marina erro"')
assert(ok(fala('Marina atacou na rede'), 'CASA', 'ataque', 'ERRO', 'ma'), '"Marina atacou na rede" = erro')
assert(ok(fala('ataque da Bianca em jogo'), 'CASA', 'ataque', 'EM_JOGO', 'bi'), '"em jogo"')
assert(ok(fala('Recepção Sofia boa'), 'CASA', 'recepcao', 'BOM', 'so'), '"Recepção Sofia boa"')
assert(ok(fala('passe da Leticia médio'), 'CASA', 'recepcao', 'MEDIO', 'le'), '"passe" = recepção, nome sem acento')
assert(ok(fala('levantamento Júlia erro'), 'CASA', 'levantamento', 'ERRO', 'ju'), 'Levantamento erro')
assert(ok(fala('defesa da Carol ótima'), 'CASA', 'defesa', 'BOM', 'ca'), 'Defesa ótima = boa')
assert(ok(fala('bloqueio Carol ponto'), 'CASA', 'bloqueio', 'ACERTO', 'ca'), 'Bloqueio ponto')
assert(ok(fala('toco da Carol'), 'CASA', 'bloqueio', undefined, 'ca') === false, '"toco da Carol" sem resultado não marca sozinho')
assert(fala('toco da Carol').faltando.join() === 'resultado', '...e pergunta só o resultado')

// Saque: quem saca já é conhecida
assert(ok(fala('Saque erro'), 'CASA', 'saque', 'ERRO', 'ju'), '"Saque erro" usa a sacadora da posição I')
assert(ok(fala('ace!'), 'CASA', 'saque', 'ACERTO', 'ju'), '"Ace" = saque ponto da sacadora')
assert(ok(fala('saque da Marina ponto'), 'CASA', 'saque', 'ACERTO', 'ma'), 'Nome falado vale mais que a sacadora')
const semSacadora = fala('saque erro', { ...ctx, sacadoraId: null })
assert(semSacadora.faltando.join() === 'atleta', 'Saque sem saber quem saca: pergunta a atleta')

// Pontos específicos
assert(ok(fala('bola de graça da Bianca'), 'CASA', 'bola_de_graca', 'ACERTO', 'bi'), 'Bola de graça')
assert(ok(fala('largada da Júlia'), 'CASA', 'bola_de_segunda', 'ACERTO', 'ju'), 'Largada = bola de 2ª')
assert(ok(fala('Letícia não deslocou'), 'CASA', 'nao_deslocou', 'ERRO', 'le'), 'Não deslocou')

// Nomes
assert(fala('ataque da Julha ponto').atletaId === 'ju', 'Nome com erro pequeno do reconhecimento ("Julha") ainda acha')
assert(fala('ataque da Helena ponto').atletaId === 'he', 'Atleta fora de quadra também é achada')
assert(fala('ataque da Ana ponto').faltando.includes('atleta'), 'Duas "Ana": não escolhe sozinho, pergunta')
assert(fala('ataque da Ana Clara ponto').atletaId === 'ac', 'Nome completo resolve as duas "Ana"')
assert(fala('ataque camisa sete ponto').atletaId === 'ma', '"camisa sete" acha pelo número')
assert(fala('ataque da Fernanda ponto').faltando.join() === 'atleta', 'Nome que não existe: pergunta a atleta')

// Faltando coisas
assert(fala('Marina ponto').faltando.join() === 'fundamento', 'Sem fundamento: pergunta o fundamento')
assert(fala('recepção da Sofia ponto').faltando.join() === 'resultado', 'Recepção não tem "ponto": pergunta (boa/média/erro)')
assert(fala('blá blá').tipo === 'jogada' && fala('blá blá').faltando.length === 3, 'Frase sem sentido: não marca nada sozinho')
assert(fala('   ').tipo === 'vazio', 'Nada falado')

// Adversário
assert(ok(fala('Ponto deles, ataque'), 'ADVERSARIO', 'ataque', 'ACERTO'), '"Ponto deles, ataque"')
assert(ok(fala('erro deles saque'), 'ADVERSARIO', 'saque', 'ERRO'), '"erro deles saque"')
assert(ok(fala('adversário errou a recepção'), 'ADVERSARIO', 'recepcao', 'ERRO'), '"adversário errou a recepção"')
assert(ok(fala('ponto delas de bloqueio'), 'ADVERSARIO', 'bloqueio', 'ACERTO'), '"delas" também vale')
assert(ok(fala('largada deles, ponto'), 'ADVERSARIO', 'bola_de_segunda', 'ACERTO'), 'Largada deles que deu certo')
assert(ok(fala('largada deles errada'), 'ADVERSARIO', 'nao_deslocou', 'ERRO'), 'Largada deles errada = ponto nosso (igual ao botão)')
assert(fala('erro deles saque camisa 12').numeroAdversario === '12', 'Número da camisa do adversário')
assert(fala('erro deles saque número oito').numeroAdversario === '8', 'Número por extenso')
assert(fala('ponto deles').faltando.join() === 'fundamento', 'Ponto deles sem fundamento: pergunta')
assert(fala('erro deles bloqueio').faltando.join() === 'fundamento', 'Erro deles de bloqueio não existe nos botões: pergunta')

// Desfazer
assert(fala('desfaz').tipo === 'desfazer', '"desfaz"')
assert(fala('Apaga!').tipo === 'desfazer', '"apaga"')
assert(fala('cancela essa').tipo === 'desfazer', '"cancela essa"')

// Confirmação falada
assert(fraseConfirmacao({ lado: 'CASA', fundamento: 'ataque', resultado: 'ACERTO' }, 'Marina Souza') === 'Ataque Marina, ponto', 'Confirma "Ataque Marina, ponto"')
assert(fraseConfirmacao({ lado: 'ADVERSARIO', fundamento: 'saque', resultado: 'ERRO' }) === 'Erro deles, saque', 'Confirma "Erro deles, saque"')

if (falhas > 0) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nTodos os testes do scout por voz passaram.')
