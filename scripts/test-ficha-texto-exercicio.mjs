// Teste da ficha de treino compartilhada (pedido 11/11/2026): o texto do
// exercício ("Objetivo" e "Como funciona") tem que ir junto do desenho, pro
// auxiliar saber exatamente o que aplicar. Também gera um exemplo em
// FICHA_EXEMPLO (se a variável existir) pra conferir visualmente.
import { writeFileSync } from 'node:fs'
import { gerarHtmlFichaTreino } from '../src/treinoHtml.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const desenho = {
  elementos: [
    { id: 'a', tipo: 'atleta_azul', x: 20, y: 30, numero: '1' },
    { id: 'b', tipo: 'atleta_amarelo', x: 75, y: 60, numero: '2' },
    { id: 'c', tipo: 'bola', x: 25, y: 35 },
  ],
  linhas: [{ id: 'l', tipo: 'toque_passe', x1: 25, y1: 35, x2: 70, y2: 60 }],
}
const sessao = {
  id: 's', turmaId: 't', data: '2026-11-12', temas: [], condicionantes: [],
  recadoSubstituto: 'Começar pontualmente às 14h.',
  quadros: [
    {
      chave: 'aq_jogo', nome: 'Rei da quadra', tempoMin: 10, desenho,
      objetivo: 'Aquecer jogando & manter a bola no ar',
      comoFunciona: 'Trios na quadra.\nQuem faz o ponto fica; quem perde sai e entra o próximo trio.\nSó vale ponto com 3 toques.',
    },
    { chave: 'parte1_1', nome: 'Saque na zona', tempoMin: 15, comoFunciona: 'Cada aluna saca 10 bolas mirando a zona 1 <marcada com cones>.' },
  ],
  registroPedagogico: { problemaResolvido: 'REFLEXAO_PRIVADA_DO_PROFESSOR' },
  createdAt: '', updatedAt: '',
}

for (const [nome, opcoes] of [['ficha normal', {}], ['ficha pro auxiliar', { paraSubstituto: true }]]) {
  const html = gerarHtmlFichaTreino(sessao, { nome: '8º ano' }, { nome: 'Colégio Horizonte' }, opcoes)
  assert(html.includes('Como funciona') && html.includes('Quem faz o ponto fica; quem perde sai e entra o próximo trio.'), `${nome}: leva o texto "Como funciona"`)
  assert(html.includes('Trios na quadra.\nQuem faz'), `${nome}: mantém as quebras de linha do texto`)
  assert(html.includes('Aquecer jogando &amp; manter a bola no ar'), `${nome}: leva o objetivo (com caracteres especiais protegidos)`)
  assert(html.includes('&lt;marcada com cones&gt;') && !html.includes('<marcada com cones>'), `${nome}: texto digitado não vira código na página`)
  assert(html.includes('<svg'), `${nome}: continua levando o desenho`)
  if (opcoes.paraSubstituto) {
    assert((html.match(/class="quadro-card"/g) ?? []).length === 2, 'pro auxiliar: só os 2 quadros preenchidos (sem os 9 vazios)')
    assert(!html.includes('REFLEXAO_PRIVADA_DO_PROFESSOR'), 'pro auxiliar: não leva o registro pedagógico')
    if (process.env.FICHA_EXEMPLO) writeFileSync(process.env.FICHA_EXEMPLO, html)
  } else {
    assert((html.match(/class="quadro-card"/g) ?? []).length === 11, 'ficha normal: continua com os 11 quadros (vazios pra desenhar à mão)')
  }
}

if (falhas > 0) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nFicha com texto do exercício: tudo certo.')
