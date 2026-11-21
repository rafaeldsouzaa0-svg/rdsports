// Teste do registro rápido de treino (21/11/2026): os exercícios marcados
// viram os quadros da ficha, e os temas vêm do que foi marcado + exercícios.
import { quadrosComExercicios, temasDoRegistro } from '../src/treinoRapido.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}
const ex = (id, grupo, temas = []) => ({ id, nome: id, grupo, temas, condicionantes: [], tempoMin: 10, createdAt: '', updatedAt: '' })

const q = quadrosComExercicios([ex('aquec', 'AQUEC_TECNICO'), ex('livre'), ex('final', 'JOGO_FINAL'), ex('aquec2', 'AQUEC_TECNICO'), ex('aquec3', 'AQUEC_TECNICO')])
const em = (chave) => q.find((x) => x.chave === chave)?.nome
assert(q.length === 11, 'sempre 11 quadros')
assert(em('aquec_tecnico_1') === 'aquec' && em('aquec_tecnico_2') === 'aquec2', 'exercício vai pra parte certa do treino')
assert(em('jogo_final_1') === 'final', 'jogo final no quadro de jogo final')
assert(em('aq_jogo') === 'livre', 'sem parte marcada → primeiro quadro livre')
assert(em('parte1_1') === 'aquec3', 'parte cheia → próximo quadro livre')
assert(q.filter((x) => x.nome).length === 5, 'nenhum exercício perdido nem duplicado')
assert(quadrosComExercicios([]).every((x) => !x.nome), 'nenhum exercício → quadros vazios')
const muitos = quadrosComExercicios(Array.from({ length: 13 }, (_, i) => ex(`e${i}`)))
assert(muitos.filter((x) => x.nome).length === 11, 'mais de 11 exercícios → preenche os 11 sem travar')
assert(q.find((x) => x.chave === 'aquec_tecnico_1').tempoMin === 10, 'copia o tempo do exercício')

const temas = temasDoRegistro(['KI_recepcao'], [ex('a', undefined, ['KII_saque', 'KI_recepcao'])])
assert(temas[0] === 'KI_recepcao' && temas.includes('KII_saque') && temas.length === 2, 'tema marcado é o principal; temas dos exercícios entram sem repetir')
assert(temasDoRegistro([], [ex('a', undefined, ['KI_ataque'])])[0] === 'KI_ataque', 'só exercício → tema vem dele')

if (falhas) { console.error(`${falhas} falha(s)`); process.exit(1) }
