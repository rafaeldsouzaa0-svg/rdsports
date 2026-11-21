// Teste de várias jogadas na mesma fala (pedido 21/11/2026):
// "Recepção Sofia boa, levantamento Maria Eduarda boa, ataque Valentina ponto".
import { interpretarFalaVarias, separarJogadas } from '../src/scoutVoz.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const atl = (id, nome) => ({ id, nome })
const emQuadra = [atl('so', 'Sofia'), atl('me', 'Maria Eduarda'), atl('va', 'Valentina'), atl('mc', 'Maria Clara'), atl('ju', 'Júlia'), atl('bi', 'Bianca')]
const ctx = { emQuadra, todas: emQuadra, sacadoraId: 'ju' }
const resumo = (r) => r.jogadas.map((j) => `${j.lado}:${j.fundamento ?? "-"}:${j.resultado ?? "-"}:${j.atletaId ?? '-'}:${j.faltando.join('+')}`).join(' | ')

const pedido = interpretarFalaVarias('Recepção Sofia boa, levantamento Maria Eduarda boa, ataque Valentina ponto', ctx)
assert(pedido.tipo === 'jogadas' && pedido.jogadas.length === 3, 'A frase do Rafael vira 3 jogadas')
assert(resumo(pedido) === 'CASA:recepcao:BOM:so: | CASA:levantamento:BOM:me: | CASA:ataque:ACERTO:va:', 'Cada jogada certinha (Maria Eduarda ≠ Maria Clara)')
assert(pedido.confirmarNoFim === false, 'Sem "confirma" no fim: espera a confirmação')

const semVirgula = interpretarFalaVarias('recepção sofia boa levantamento maria eduarda boa ataque valentina ponto', ctx)
assert(resumo(semVirgula) === resumo(pedido), 'Sem vírgulas (como o reconhecimento de voz entrega) dá o mesmo resultado')

const comConfirma = interpretarFalaVarias('recepção sofia boa ataque valentina ponto confirma', ctx)
assert(comConfirma.jogadas.length === 2 && comConfirma.confirmarNoFim, '"… confirma" no fim marca direto')
assert(comConfirma.jogadas[1].resultado === 'ACERTO', '"confirma" não atrapalha a última jogada')

const comAdv = interpretarFalaVarias('saque erro ponto deles ataque', ctx)
assert(resumo(comAdv) === 'CASA:saque:ERRO:ju: | ADVERSARIO:ataque:ACERTO:-:', 'Nosso saque errado + ponto deles de ataque')
const advPrimeiro = interpretarFalaVarias('erro deles saque recepção sofia boa', ctx)
assert(resumo(advPrimeiro) === 'ADVERSARIO:saque:ERRO:-: | CASA:recepcao:BOM:so:', 'Erro deles + recepção nossa')

const faltando = interpretarFalaVarias('recepção boa ataque valentina', ctx)
assert(resumo(faltando) === 'CASA:recepcao:BOM:-:atleta | CASA:ataque:-:va:resultado', 'O que faltar em cada jogada vira pergunta, sem chute')

const comDepois = interpretarFalaVarias('defesa da Bianca boa depois ataque da Valentina erro', ctx)
assert(comDepois.jogadas.length === 2, '"depois" também separa')

assert(separarJogadas('bola de segunda da julia').length === 1, '"bola de segunda" é uma jogada só (não corta no "segunda")')
assert(interpretarFalaVarias('ataque valentina ponto', ctx).jogadas.length === 1, 'Uma jogada só continua funcionando')

// Respostas à pergunta "confirma?"
assert(interpretarFalaVarias('confirma', ctx, true).tipo === 'confirmar', '"confirma"')
assert(interpretarFalaVarias('sim, pode', ctx, true).tipo === 'confirmar', '"sim, pode"')
assert(interpretarFalaVarias('cancela', ctx, true).tipo === 'cancelar', '"cancela" com lista esperando')
assert(interpretarFalaVarias('não', ctx, true).tipo === 'cancelar', '"não"')
assert(interpretarFalaVarias('desfaz', ctx, false).tipo === 'desfazer', '"desfaz" sem lista esperando = desfazer a última')
assert(interpretarFalaVarias('ataque bianca ponto', ctx, true).tipo === 'jogadas', 'Com lista esperando, uma jogada nova é jogada nova')

if (falhas > 0) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nTodos os testes de várias jogadas passaram.')
