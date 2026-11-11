// Teste isolado do motor de scout, antes de subir — confere:
// 1) Levantamento NUNCA marca ponto nem fecha rally, em nenhuma hipótese —
//    nem Bom/Médio, nem Erro (ajuste 23/10/2026: antes o Erro fechava pro
//    adversário; agora não fecha mais nunca, é só estatística da levantadora).
// 2) Os 3 formatos de partida fecham set/partida corretamente.
import { registrarEvento, criarSet, setEstaFechado, partidaEstaFinalizada } from '../src/scoutEngine.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

// --- 1) Levantamento nunca fecha rally / nunca soma ponto, nem mesmo no Erro ---
let set = criarSet(1)
set = registrarEvento(set, 'levantamento', 'BOM')
assert(set.placarCasa === 0 && set.placarAdversario === 0, 'Levantamento "Bom" não altera o placar')
set = registrarEvento(set, 'levantamento', 'MEDIO')
assert(set.placarCasa === 0 && set.placarAdversario === 0, 'Levantamento "Médio" não altera o placar')
set = registrarEvento(set, 'levantamento', 'ERRO')
assert(set.placarCasa === 0 && set.placarAdversario === 0, 'Levantamento "Erro" também não altera o placar (ajuste 23/10/2026)')
const rallyAberto = set.rallies[set.rallies.length - 1]
assert(rallyAberto.eventos.every((e) => e.encerraRally === null), 'Nenhum evento de levantamento (Bom/Médio/Erro) fecha o rally')
assert(rallyAberto.eventos.filter((e) => e.fundamento === 'levantamento' && e.resultado === 'ERRO').length === 1,
  'O Erro de levantamento continua registrado como estatística, só não fecha o rally')

// --- 2) Melhor de 5: set fecha aos 25 (ou 15 no 5º), 2 pontos de vantagem ---
function jogarAte(set, ladoAlvo, pontos, formato) {
  for (let i = 0; i < pontos; i++) {
    set = registrarEvento(set, 'ataque', 'ACERTO')
    if (ladoAlvo === 'ADVERSARIO') {
      // simula ponto adversário via erro nosso de ataque no rally seguinte
    }
  }
  return set
}
let s1 = criarSet(1)
for (let i = 0; i < 25; i++) s1 = registrarEvento(s1, 'ataque', 'ACERTO')
assert(setEstaFechado(s1, { formato: 'MELHOR_DE_5' }) === 'CASA', 'Set 1 (Melhor de 5) fecha 25x0 pra casa')

// --- 3) Melhor de 3: fecha com 2 sets ---
assert(partidaEstaFinalizada('MELHOR_DE_3', 2, 0, 2) === true, 'Melhor de 3: acaba 2x0')
assert(partidaEstaFinalizada('MELHOR_DE_3', 1, 1, 2) === false, 'Melhor de 3: 1x1 continua pro 3º set')

// --- 4) Melhor de 5: só acaba com 3 sets, até o 5º decisivo (15 pts) ---
assert(partidaEstaFinalizada('MELHOR_DE_5', 3, 1, 4) === true, 'Melhor de 5: acaba 3x1')
assert(partidaEstaFinalizada('MELHOR_DE_5', 2, 2, 4) === false, 'Melhor de 5: 2x2 vai pro 5º set decisivo')
let s5 = criarSet(5)
for (let i = 0; i < 15; i++) s5 = registrarEvento(s5, 'ataque', 'ACERTO')
assert(setEstaFechado(s5, { formato: 'MELHOR_DE_5' }) === 'CASA', '5º set (decisivo) fecha com 15 pontos, não 25')

// --- 5) Três obrigatórios de 25: sempre joga os 3, mesmo que um lado já tenha 2 ---
assert(partidaEstaFinalizada('TRES_OBRIGATORIOS_25', 2, 0, 2) === false, '3 obrigatórios: 2x0 ainda joga o 3º set')
assert(partidaEstaFinalizada('TRES_OBRIGATORIOS_25', 2, 1, 3) === true, '3 obrigatórios: acaba só depois do 3º set')
let s3 = criarSet(3)
for (let i = 0; i < 25; i++) s3 = registrarEvento(s3, 'ataque', 'ACERTO')
assert(setEstaFechado(s3, { formato: 'TRES_OBRIGATORIOS_25' }) === 'CASA', '3 obrigatórios: todo set (incluindo o 3º) fecha a 25, não a 15')

// --- 6) Pontuação configurável (ex.: "21 pontos") sobrepõe o padrão do formato ---
let s21 = criarSet(1)
for (let i = 0; i < 20; i++) s21 = registrarEvento(s21, 'ataque', 'ACERTO')
assert(setEstaFechado(s21, { formato: 'MELHOR_DE_5', pontosSetNormal: 21 }) === null, '20x0 com meta de 21 ainda não fechou')
s21 = registrarEvento(s21, 'ataque', 'ACERTO')
assert(setEstaFechado(s21, { formato: 'MELHOR_DE_5', pontosSetNormal: 21 }) === 'CASA', '21x0 com meta de 21 fecha pra casa')

console.log(falhas === 0 ? '\nTudo passou.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
