// Sanity check da exportação do desenho estático de um quadro (pedido
// 29/10/2026, Fase 2): confere que `gerarHtmlFichaTreino` troca a quadra em
// branco pelo SVG do desenho quando o quadro tem elementos, e que elementos
// sem desenho continuam saindo em branco (pra desenhar à mão).
import { gerarHtmlFichaTreino } from '../src/treinoHtml.ts'
import { QUADRO_SLOTS } from '../src/types.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const turma = { nome: 'Vôlei — Master' }
const escola = { nome: 'Minha Escola' }

const sessaoBase = {
  id: 's1', turmaId: 't1', data: '2026-10-30',
  temas: [], condicionantes: [],
  quadros: QUADRO_SLOTS.map((q) => ({ chave: q.chave })),
  registroPedagogico: {},
  createdAt: '2026-10-30T10:00:00.000Z', updatedAt: '2026-10-30T10:00:00.000Z',
}

const htmlSemDesenho = gerarHtmlFichaTreino(sessaoBase, turma, escola)
assert(!htmlSemDesenho.includes('<svg viewBox="0 0 300 200"'), 'Sem desenho nenhum: nenhum quadro usa o SVG do desenho (todos em branco)')

const sessaoComDesenho = {
  ...sessaoBase,
  quadros: sessaoBase.quadros.map((q) =>
    q.chave === 'aq_jogo'
      ? { ...q, nome: 'Side-out 4x4', desenho: { elementos: [{ id: 'e1', tipo: 'atleta_azul', x: 50, y: 50, numero: '7' }], linhas: [{ id: 'l1', tipo: 'saque_ataque', x1: 10, y1: 10, x2: 90, y2: 90 }] } }
      : q
  ),
}

const htmlComDesenho = gerarHtmlFichaTreino(sessaoComDesenho, turma, escola)
assert(htmlComDesenho.includes('<svg viewBox="0 0 300 200"'), 'Com desenho no AQ/Jogo: o quadro usa o SVG do desenho')
assert(htmlComDesenho.includes('>7<'), 'Número da camisa (7) aparece no SVG exportado')
assert(htmlComDesenho.includes('marker-end="url(#seta-saque_ataque)"'), 'Seta de Saque/Ataque exportada com a marcação certa')

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
