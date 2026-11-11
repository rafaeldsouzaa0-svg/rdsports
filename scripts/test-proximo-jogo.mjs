// Teste do cartão "Próximo jogo" (pedido 11/11/2026): qual jogo é o
// próximo, a contagem regressiva e o checklist.
import {
  proximoJogo, contagemRegressiva, checklistDoJogo, alternarItem, adicionarItem, removerItem, CHECKLIST_PADRAO,
} from '../src/proximoJogo.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const agora = new Date(2026, 10, 11, 10, 0) // qua 11/11/2026 10:00
const j = (id, data, horario, extra = {}) => ({ id, turmaId: 't', adversarioNome: id, data, horario, createdAt: '', ...extra })

// --- Qual é o próximo jogo ---
const jogos = [j('passado', '2026-11-10'), j('sabado', '2026-11-14', '09:00'), j('hoje-tarde', '2026-11-11', '15:00'), j('excluido', '2026-11-11', '08:00', { deletedAt: 'x' })]
assert(proximoJogo(jogos, agora)?.id === 'hoje-tarde', 'próximo = o de hoje à tarde (ignora passado e excluído)')
assert(proximoJogo([j('a', '2026-11-11', '18:00'), j('b', '2026-11-11', '08:00')], agora)?.id === 'b', 'dois jogos no mesmo dia → o de horário mais cedo')
assert(proximoJogo([j('passado', '2026-11-01')], agora) === undefined, 'só jogos passados → nenhum cartão')

// --- Contagem regressiva ---
let c = contagemRegressiva('2026-11-14', '09:00', agora)
assert(c.partes.dias === 2 && c.partes.horas === 23 && c.partes.minutos === 0, 'sábado 9h, de quarta 10h → 2 dias, 23 h, 0 min')
assert(c.texto === 'Faltam 2 dias e 23 h' && !c.ehHoje, 'texto: "Faltam 2 dias e 23 h"')
c = contagemRegressiva('2026-11-11', '13:20', agora)
assert(c.ehHoje && c.texto === 'É hoje! Faltam 3 h 20 min', 'hoje 13:20 → "É hoje! Faltam 3 h 20 min"')
c = contagemRegressiva('2026-11-11', '09:30', agora)
assert(c.comecou && c.texto === 'Já começou', 'horário de hoje já passou → "Já começou"')
c = contagemRegressiva('2026-11-12', undefined, agora)
assert(c.texto === 'É amanhã' && !c.partes, 'sem horário, amanhã → "É amanhã"')
c = contagemRegressiva('2026-11-20', undefined, agora)
assert(c.texto === 'Faltam 9 dias', 'sem horário, dia 20 → "Faltam 9 dias"')
c = contagemRegressiva('2026-11-11', undefined, agora)
assert(c.texto === 'É hoje!' && c.ehHoje, 'sem horário, hoje → "É hoje!"')
c = contagemRegressiva('2026-11-11', '10:45', agora)
assert(c.texto === 'É hoje! Faltam 45 min', 'menos de 1 hora → só minutos')

// --- Checklist ---
let lista = checklistDoJogo({})
assert(lista.length === CHECKLIST_PADRAO.length && lista.every((i) => !i.feito), 'jogo sem checklist → itens padrão, nenhum marcado')
lista = alternarItem(lista, 1)
assert(lista[1].feito && !lista[0].feito, 'tocar marca só aquele item')
assert(!alternarItem(lista, 1)[1].feito, 'tocar de novo desmarca')
const maior = adicionarItem(lista, '  Joelheiras ')
assert(maior.length === lista.length + 1 && maior.at(-1).item === 'Joelheiras', 'adiciona item novo (sem espaços sobrando)')
assert(adicionarItem(maior, 'joelheiras').length === maior.length, 'não duplica item repetido')
assert(adicionarItem(lista, '   ').length === lista.length, 'item vazio é ignorado')
assert(removerItem(maior, 0).length === maior.length - 1 && removerItem(maior, 0)[0].item === maior[1].item, 'remove o item escolhido')
assert(checklistDoJogo({ checklist: [] }).length === 0, 'checklist esvaziado de propósito continua vazio (não volta o padrão)')

if (falhas > 0) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nPróximo jogo: tudo certo.')
