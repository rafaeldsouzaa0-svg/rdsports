// Sanity check do catálogo da ficha de treino (pedido 29/10/2026): confere
// que os 11 quadros fixos batem exatamente com a estrutura do H10 (AQ/Jogo=1,
// Aquec. Técnico=2, Parte 1=3, Parte 2=3, Jogo Final=2) e que os catálogos de
// temas/condicionantes não têm ids duplicados (usados como key no React e
// como referência salva em `SessaoTreino.temas`/`.condicionantes`).
import { QUADRO_SLOTS, TEMAS_TREINO, CONDICIONANTES_TREINO, GRUPOS_TEMAS_TREINO } from '../src/types.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

assert(QUADRO_SLOTS.length === 11, 'QUADRO_SLOTS tem exatamente 11 quadros')

function contarGrupo(grupo) { return QUADRO_SLOTS.filter((q) => q.grupo === grupo).length }
assert(contarGrupo('AQ_JOGO') === 1, 'AQ/Jogo tem 1 quadro')
assert(contarGrupo('AQUEC_TECNICO') === 2, 'Aquec. Técnico tem 2 quadros')
assert(contarGrupo('PARTE1') === 3, 'Parte 1 tem 3 quadros')
assert(contarGrupo('PARTE2') === 3, 'Parte 2 tem 3 quadros')
assert(contarGrupo('JOGO_FINAL') === 2, 'Jogo Final tem 2 quadros')

const chaves = new Set(QUADRO_SLOTS.map((q) => q.chave))
assert(chaves.size === QUADRO_SLOTS.length, 'Nenhuma chave de quadro duplicada')

const temaIds = new Set(TEMAS_TREINO.map((t) => t.id))
assert(temaIds.size === TEMAS_TREINO.length, 'Nenhum id de tema duplicado')
assert(TEMAS_TREINO.every((t) => GRUPOS_TEMAS_TREINO.some((g) => g.id === t.grupo)), 'Todo tema pertence a um grupo válido (KI/KII/JC/OUT)')

const condIds = new Set(CONDICIONANTES_TREINO.map((c) => c.id))
assert(condIds.size === CONDICIONANTES_TREINO.length, 'Nenhum id de condicionante duplicado')

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
