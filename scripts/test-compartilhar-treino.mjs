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

// Sem recado: o aviso aparece, mas sem a linha "Recado:".
const semRecado = gerarHtmlFichaTreino({ ...sessao, recadoSubstituto: '   ' }, turma, escola, { paraSubstituto: true })
assert(semRecado.includes('Treino para você aplicar') && !semRecado.includes('<b>Recado:</b>'), 'Sem recado: não mostra a linha de recado vazia')

console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
