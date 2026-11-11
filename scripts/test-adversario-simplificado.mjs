// Teste do novo fluxo simplificado do Adversário (pedido 23/10/2026): o
// botão único "Adversário" (Ponto/Erro/Largada de 2ª) usa exatamente os
// mesmos primitivos do motor (registrarEventoTime) que já existiam — este
// teste confere que a pontuação sai certa pros 3 caminhos da janela nova.
import { registrarEventoTime, criarSet, erroPorFundamentoAdversario, pontosPorFundamentoAdversario } from '../src/scoutEngine.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

// 1) "Ponto" -> Ataque/Saque/Bloqueio (ACERTO) soma ponto pro adversário.
let set = criarSet(1)
set = registrarEventoTime(set, 'ADVERSARIO', 'ataque', 'ACERTO', undefined, '9')
assert(set.placarAdversario === 1 && set.placarCasa === 0, '"Ponto" -> Ataque soma ponto pro adversário')

set = registrarEventoTime(set, 'ADVERSARIO', 'saque', 'ACERTO')
assert(set.placarAdversario === 2, '"Ponto" -> Saque (ace deles) soma ponto pro adversário')

set = registrarEventoTime(set, 'ADVERSARIO', 'bloqueio', 'ACERTO')
assert(set.placarAdversario === 3, '"Ponto" -> Bloqueio soma ponto pro adversário')

// 2) "Ponto" -> Largada/Bola de 2ª (bola_de_segunda, ACERTO) soma ponto pro adversário.
set = registrarEventoTime(set, 'ADVERSARIO', 'bola_de_segunda', 'ACERTO')
assert(set.placarAdversario === 4, '"Ponto" -> Largada/Bola de 2ª que funcionou soma ponto pro adversário')

// 3) "Erro" -> Ataque/Saque/Recepção (ERRO) soma ponto pra nós.
set = registrarEventoTime(set, 'ADVERSARIO', 'ataque', 'ERRO')
assert(set.placarCasa === 1, '"Erro" -> Ataque deles soma ponto pra nós')

set = registrarEventoTime(set, 'ADVERSARIO', 'saque', 'ERRO')
assert(set.placarCasa === 2, '"Erro" -> Saque deles (fora) soma ponto pra nós')

set = registrarEventoTime(set, 'ADVERSARIO', 'recepcao', 'ERRO')
assert(set.placarCasa === 3, '"Erro" -> Recepção deles soma ponto pra nós')

// 4) Botão avulso "Largada de 2ª" (vermelho, não funcionou) = nao_deslocou do
//    adversário -> soma ponto pra nós, não pra eles.
set = registrarEventoTime(set, 'ADVERSARIO', 'nao_deslocou', 'ERRO')
assert(set.placarCasa === 4, 'Largada de 2ª vermelha (não funcionou) soma ponto pra nós')

// 5) Relatório: "o que mais acertaram" (pontos) e "o que mais erraram" (erros)
//    batem com os eventos registrados acima.
const pontos = pontosPorFundamentoAdversario([set])
const erros = erroPorFundamentoAdversario([set])
assert(pontos.ataque.total === 1, 'Relatório: 1 ponto do adversário em Ataque')
assert(pontos.saque.total === 1, 'Relatório: 1 ponto do adversário em Saque')
assert(pontos.bloqueio.total === 1, 'Relatório: 1 ponto do adversário em Bloqueio')
assert(pontos.bola_de_segunda.total === 1, 'Relatório: 1 ponto do adversário em Largada/Bola de 2ª')
assert(erros.ataque.total === 1, 'Relatório: 1 erro do adversário em Ataque')
assert(erros.saque.total === 1, 'Relatório: 1 erro do adversário em Saque')
assert(erros.recepcao.total === 1, 'Relatório: 1 erro do adversário em Recepção')
assert(erros.nao_deslocou.total === 1, 'Relatório: a largada de 2ª que não funcionou conta como erro do adversário')
assert(pontos.ataque.porNumero['9'] === 1, 'Relatório: nº da camisa (9) fica registrado no ponto de ataque')

console.log(falhas === 0 ? `\nTudo certo (${12} verificações).` : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
