// Mensagem da convocação pro WhatsApp (pedido 12/11/2026: o Rafael manda a
// convocação pro coordenador).
import assert from 'node:assert'
import { textoConvocacaoWhatsApp, linkWhatsApp, dataComDiaDaSemana } from '../src/convocacao.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

const turmas = [
  { id: 't13', escolaId: 'e1', nome: 'Sub-13', createdAt: '' },
  { id: 't12', escolaId: 'e1', nome: 'Sub-12 copa Kairós', createdAt: '' },
]
const atletas = [
  { id: 'a1', turmaId: 't13', nome: 'Bianca Souza', numero: '7', nascimento: '2013-05-03', createdAt: '' },
  { id: 'a2', turmaId: 't13', nome: 'Ana Lima', createdAt: '', idade: 13 },
  { id: 'a3', turmaId: 't13', nome: 'Carla Dias', createdAt: '' }, // não convocada
  { id: 'a4', turmaId: 't12', nome: 'Duda Reis', numero: '10', nascimento: '2014-12-01', createdAt: '' },
  { id: 'a5', turmaId: 't13', nome: 'Excluída', createdAt: '', deletedAt: '2026-11-01T00:00:00Z' },
]
const jogo = {
  turmaId: 't13', convocadas: ['a1', 'a2', 'a4', 'a5'], adversarioNome: 'Showa Volei', campeonatoNome: 'Copa Kairós',
  data: '2026-11-15', horario: '14:00:00', local: 'Ginásio Central', formato: 'MELHOR_DE_3',
}
const hoje = new Date('2026-11-12T12:00:00Z')
const txt = textoConvocacaoWhatsApp(jogo, turmas[0], 'Sanfra', atletas, turmas, hoje)
console.log('\n' + txt + '\n')

check('Título com turma e escola', txt.startsWith('*CONVOCAÇÃO — Sub-13 (Sanfra)*'))
check('Adversário', txt.includes('vs Showa Volei'))
check('Campeonato', txt.includes('*Campeonato:* Copa Kairós'))
check('Data com dia da semana e horário sem segundos', txt.includes('Domingo, 15/11/2026 às 14:00'))
check('Local e formato', txt.includes('Ginásio Central') && txt.includes('Melhor de 3 sets'))
check('Conta só as convocadas que existem (3, sem a excluída)', txt.includes('*Convocadas (3):*') && !txt.includes('Excluída'))
check('Atleta não convocada fica de fora', !txt.includes('Carla'))
check('Turma principal primeiro, em ordem alfabética', txt.indexOf('Ana Lima') < txt.indexOf('Bianca Souza') && txt.indexOf('Bianca Souza') < txt.indexOf('Duda Reis'))
check('Número, idade calculada e nascimento', txt.includes('2. #7 Bianca Souza — 13 anos · nasc. 03/05/2013'))
check('Sem nascimento: usa a idade do cadastro', txt.includes('1. Ana Lima — 13 anos'))
check('Reforço em seção própria, com a turma de origem', txt.includes('*Reforços (1):*') && txt.includes('3. #10 Duda Reis — 11 anos · nasc. 01/12/2014 · reforço do Sub-12 copa Kairós'))

const simples = textoConvocacaoWhatsApp({ turmaId: 't13', convocadas: ['a2'], adversarioNome: 'Atc', data: '2026-11-16' }, turmas[0], undefined, atletas, turmas, hoje)
check('Sem campeonato/local/horário/escola: não deixa linha vazia nem "undefined"', !simples.includes('undefined') && !simples.includes('Campeonato') && !simples.includes('Local') && simples.startsWith('*CONVOCAÇÃO — Sub-13*') && simples.includes('Segunda, 16/11/2026\n'))
check('Sem reforço: não mostra a seção de reforços', !simples.includes('Reforços'))

check('Dia da semana certo (não muda com fuso)', dataComDiaDaSemana('2026-11-12') === 'Quinta, 12/11/2026')
const link = linkWhatsApp(txt)
check('Link do WhatsApp com o texto codificado', link.startsWith('https://wa.me/?text=') && decodeURIComponent(link.split('text=')[1]) === txt)

console.log(`\n${ok} verificações passaram.`)
