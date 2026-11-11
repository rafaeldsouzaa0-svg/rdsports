// Teste isolado: "pontos específicos" (bola de graça, bola de segunda, não
// deslocou). Regra AJUSTADA em 23/10/2026 (correção enviada pelo Henrique
// depois de ver a versão anterior): bola de graça e bola de 2ª/largada são
// jogadas que DÃO CERTO — ponto pra quem fez a jogada. "Não deslocou" é erro
// de posicionamento de verdade — ponto pro outro lado. Os 3 entram no
// relatório da equipe/atleta e, quando é o adversário que faz, em "erros do
// adversário" (só no caso de não deslocou, já que é o único que é erro).
import { criarSet, registrarEventoTime, scoutEquipe, scoutPorAtleta, erroPorFundamentoAdversario, FUNDAMENTOS_SCOUT, SITUACOES_ESPECIFICAS } from '../src/scoutEngine.ts'

let falhas = 0
function assert(cond, msg) { if (!cond) { console.error('FALHOU:', msg); falhas++ } else console.log('OK:', msg) }

assert(SITUACOES_ESPECIFICAS.length === 3, 'Existem exatamente 3 pontos específicos')
assert(FUNDAMENTOS_SCOUT.includes('bola_de_graca') && FUNDAMENTOS_SCOUT.includes('bola_de_segunda') && FUNDAMENTOS_SCOUT.includes('nao_deslocou'),
  'Os 3 pontos específicos entram em FUNDAMENTOS_SCOUT (pra aparecer nos relatórios automaticamente)')

// --- Nossa atleta faz "bola de graça": vira ponto PRA NÓS (jogada boa) ---
let s1 = criarSet(1)
s1 = registrarEventoTime(s1, 'CASA', 'bola_de_graca', 'ACERTO', 'ana')
assert(s1.placarCasa === 1 && s1.placarAdversario === 0, 'Bola de graça da nossa atleta vira ponto pra nós')

const equipe1 = scoutEquipe([s1])
assert(equipe1.bola_de_graca.positivo === 1 && equipe1.bola_de_graca.total === 1, 'Entra no relatório da equipe, como ação positiva')
const porAtleta1 = scoutPorAtleta([s1]).find((p) => p.atletaId === 'ana')
assert(porAtleta1 && porAtleta1.porFundamento.bola_de_graca.positivo === 1, 'Entra no relatório individual da atleta, como ação positiva')

// --- Adversário faz "bola de graça": vira ponto PRA ELE (mesma regra, espelhada) ---
let sAdvGraca = criarSet(1)
sAdvGraca = registrarEventoTime(sAdvGraca, 'ADVERSARIO', 'bola_de_graca', 'ACERTO', undefined, '9')
assert(sAdvGraca.placarCasa === 0 && sAdvGraca.placarAdversario === 1, 'Bola de graça do adversário vira ponto pra ele (mesma regra dos dois lados)')

// --- Nossa atleta "não desloca": continua vira ponto pro ADVERSÁRIO (erro de posicionamento) ---
let s2 = criarSet(1)
s2 = registrarEventoTime(s2, 'CASA', 'nao_deslocou', 'ERRO', 'ana')
assert(s2.placarCasa === 0 && s2.placarAdversario === 1, '"Não deslocou" da nossa atleta continua virando ponto pro adversário')

// --- Adversário "não desloca": vira ponto PRA NÓS, e entra em erros do adversário ---
let s3 = criarSet(1)
s3 = registrarEventoTime(s3, 'ADVERSARIO', 'nao_deslocou', 'ERRO', undefined, '12')
assert(s3.placarCasa === 1 && s3.placarAdversario === 0, '"Não deslocou" do adversário vira ponto nosso')
const errosAdv = erroPorFundamentoAdversario([s3])
assert(errosAdv.nao_deslocou.total === 1 && errosAdv.nao_deslocou.porNumero['12'] === 1, 'Entra em "erros do adversário", com o número da camisa')

// --- "Bola de segunda" segue a mesma regra nova (ponto pra quem fez) ---
let s4 = criarSet(1)
s4 = registrarEventoTime(s4, 'CASA', 'bola_de_segunda', 'ACERTO', 'bia')
assert(s4.placarCasa === 1 && s4.placarAdversario === 0, 'Bola de segunda nossa também vira ponto pra nós')

console.log(falhas === 0 ? '\nTudo passou.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
