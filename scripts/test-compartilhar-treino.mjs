// Ficha de treino pro auxiliar (pedido 11/11/2026): o Rafael compartilha o
// treino com quem vai dar a aula no lugar dele. Confere que a versão do
// auxiliar traz o recado, não mostra "Voltar ao app" nem o Registro
// pedagógico, e que a ficha normal continua igual.
import { gerarHtmlFichaTreino } from '../src/treinoHtml.ts'
import { QUADRO_SLOTS } from '../src/types.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const turma = { nome: 'Sub-15 Feminino' }
const escola = { nome: 'Escola Centro' }
const sessao = {
  id: 's1', turmaId: 't1', data: '2026-11-12',
  temas: [], condicionantes: [],
  quadros: QUADRO_SLOTS.map((q, i) => ({ chave: q.chave, ...(i === 0 ? { nome: 'Rede baixa 2x2', objetivo: 'Ler a defesa', tempoMin: 15 } : {}) })),
  registroPedagogico: { problemaResolvido: 'Reflexão pessoal do professor' },
  recadoSubstituto: 'Chegar 10 min antes <b>armário 3</b>',
  createdAt: '2026-11-11T10:00:00.000Z', updatedAt: '2026-11-11T10:00:00.000Z',
}

const normal = gerarHtmlFichaTreino(sessao, turma, escola)
const auxiliar = gerarHtmlFichaTreino(sessao, turma, escola, { paraSubstituto: true })

// Ficha normal: nada muda.
assert(normal.includes('Voltar ao app'), 'Ficha normal continua com o botão "Voltar ao app"')
assert(normal.includes('Registro pedagógico'), 'Ficha normal continua com o Registro pedagógico')
assert(!normal.includes('Treino para você aplicar'), 'Ficha normal não mostra o aviso do auxiliar')

// Ficha do auxiliar.
assert(auxiliar.includes('Treino para você aplicar'), 'Ficha do auxiliar mostra o aviso no topo')
assert(auxiliar.includes('Chegar 10 min antes'), 'Ficha do auxiliar traz o recado')
assert(auxiliar.includes('&lt;b&gt;armário 3&lt;/b&gt;') && !auxiliar.includes('<b>armário 3</b>'), 'Recado é escapado (texto digitado não vira HTML)')
assert(!auxiliar.includes('Voltar ao app'), 'Ficha do auxiliar não tem "Voltar ao app" (ele abre fora do app)')
assert(!auxiliar.includes('Registro pedagógico') && !auxiliar.includes('Reflexão pessoal do professor'), 'Ficha do auxiliar não leva o Registro pedagógico')
assert(auxiliar.includes('Rede baixa 2x2') && auxiliar.includes('Ler a defesa') && auxiliar.includes('15 min'), 'Ficha do auxiliar traz os exercícios')
assert(auxiliar.includes('Sub-15 Feminino') && auxiliar.includes('Escola Centro'), 'Ficha do auxiliar traz turma e escola')

// "Como funciona" aparece nas duas fichas (antes não saía em nenhuma).
const comExplicacao = {
  ...sessao,
  quadros: sessao.quadros.map((q, i) => (i === 0 ? { ...q, comoFunciona: 'Duplas, 3 toques obrigatórios' } : q)),
}
assert(gerarHtmlFichaTreino(comExplicacao, turma, escola).includes('Duplas, 3 toques obrigatórios'), 'Ficha normal mostra o "Como funciona"')
assert(gerarHtmlFichaTreino(comExplicacao, turma, escola, { paraSubstituto: true }).includes('Duplas, 3 toques obrigatórios'), 'Ficha do auxiliar mostra o "Como funciona"')

// Auxiliar: só os quadros preenchidos, um por linha. Ficha normal: os 11.
const contarQuadros = (html) => (html.match(/class="quadro-card"/g) ?? []).length
assert(contarQuadros(normal) === 1, 'Ficha normal também mostra só o quadro preenchido (os em branco não saem)')
assert(contarQuadros(auxiliar) === 1, 'Ficha do auxiliar mostra só o quadro preenchido')
assert(auxiliar.includes('quadros-grid lista') && !normal.includes('quadros-grid lista'), 'Só a ficha do auxiliar usa um exercício por linha')
assert(!normal.includes('class="quadro-court"') && !auxiliar.includes('class="quadro-court"'), 'Exercício sem desenho não mostra quadra em branco (nas duas fichas)')
// Opção "com quadros em branco": os 11 quadros, com quadra vazia pra desenhar.
const auxComBranco = gerarHtmlFichaTreino(sessao, turma, escola, { paraSubstituto: true, incluirQuadrosEmBranco: true })
assert(contarQuadros(auxComBranco) === QUADRO_SLOTS.length, `Com quadros em branco: mostra os ${QUADRO_SLOTS.length} quadros`)
assert(auxComBranco.includes('class="quadro-court"'), 'Com quadros em branco: tem quadra vazia pra desenhar à mão')
assert(auxComBranco.includes('Treino para você aplicar') && !auxComBranco.includes('Registro pedagógico'), 'Com quadros em branco: continua sendo a ficha do auxiliar')

const vazia = { ...sessao, quadros: QUADRO_SLOTS.map((q) => ({ chave: q.chave })) }
assert(gerarHtmlFichaTreino(vazia, turma, escola, { paraSubstituto: true }).includes('Nenhum exercício preenchido'), 'Auxiliar sem nenhum exercício: mostra aviso em vez de lista vazia')

// Sem recado: o aviso aparece, mas sem a linha "Recado:".
const semRecado = gerarHtmlFichaTreino({ ...sessao, recadoSubstituto: '   ' }, turma, escola, { paraSubstituto: true })
assert(semRecado.includes('Treino para você aplicar') && !semRecado.includes('<b>Recado:</b>'), 'Sem recado: não mostra a linha de recado vazia')

console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
