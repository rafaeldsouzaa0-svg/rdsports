// Teste isolado do gerador de relatório HTML — confere que o HTML sai bem formado,
// contém o conteúdo esperado, e que o relatório individual nunca vaza dados de colegas.
import { gerarHtmlRelatorioPartida, gerarHtmlRelatorioAtleta, slugify } from '../src/htmlReport.ts'

let falhas = 0
function assert(cond, msg) { if (!cond) { console.error('FALHOU:', msg); falhas++ } else console.log('OK:', msg) }

const set1 = {
  id: 's1', numero: 1, placarCasa: 25, placarAdversario: 20, finalizado: true, vencedor: 'CASA',
  rallies: [
    { id: 'r1', numero: 1, pontoCasa: true, placarCasaApos: 1, placarAdversarioApos: 0, eventos: [
      { id: 'e1', atletaId: 'ana', fundamento: 'ataque', resultado: 'ACERTO', encerraRally: 'CASA', timestamp: '' },
    ]},
    { id: 'r2', numero: 2, pontoCasa: false, placarCasaApos: 1, placarAdversarioApos: 1, eventos: [
      { id: 'e2', atletaId: 'bia', fundamento: 'saque', resultado: 'ERRO', encerraRally: 'ADVERSARIO', timestamp: '' },
    ]},
  ],
}

const partida = {
  id: 'p1', tipo: 'JOGO', turmaId: 't1', adversarioNome: 'Tigresas', formato: 'MELHOR_DE_5',
  data: '2026-10-22', status: 'FINALIZADA', setsPartida: [set1], setsGanhosCasa: 1, setsGanhosAdversario: 0,
  createdAt: '',
}

const atletas = [
  { id: 'ana', nome: 'Ana Silva', turmaId: 't1' },
  { id: 'bia', nome: 'Bia Costa', turmaId: 't1' },
  { id: 'carla', nome: 'Carla Reis', turmaId: 't1' }, // não teve nenhuma ação registrada
]

const htmlCompleto = gerarHtmlRelatorioPartida(partida, partida.setsPartida, atletas, 'Todos os sets')
assert(htmlCompleto.startsWith('<!doctype html>'), 'Relatório completo começa com <!doctype html>')
assert(htmlCompleto.includes('Ana Silva') && htmlCompleto.includes('Bia Costa'), 'Relatório completo tem as duas atletas')
assert(htmlCompleto.includes('vs Tigresas'), 'Relatório completo tem o nome do adversário')
assert(htmlCompleto.includes('1 <span class="x">×</span> 0'), 'Relatório completo tem o placar certo')
assert(htmlCompleto.includes('Carla Reis'), 'Relatório completo mostra atleta sem nenhuma ação registrada (pedido 23/10/2026)')

const htmlAna = gerarHtmlRelatorioAtleta(partida, partida.setsPartida, atletas[0], 'Todos os sets')
assert(htmlAna.startsWith('<!doctype html>'), 'Relatório individual começa com <!doctype html>')
assert(htmlAna.includes('Ana Silva'), 'Relatório individual da Ana tem o nome dela')
assert(!htmlAna.includes('Bia Costa'), 'Relatório individual da Ana NUNCA mostra o nome da Bia (privacidade)')

assert(slugify('Tigresas FC') === 'Tigresas-FC', 'slugify troca espaço por hífen')
assert(slugify('São Paulo') === 'Sao-Paulo', 'slugify remove acentos')

console.log(falhas === 0 ? '\nTudo passou.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
