// Relatório do adversário e Modo banco (pedido 27/11/2026).
import assert from 'node:assert'
import { criarSet, registrarEvento, registrarEventoTime } from '../src/scoutEngine.ts'
import { adversariosComJogos, relatorioAdversario, textoRelatorioAdversario } from '../src/relatorioAdversario.ts'
import { montarPartidaAoVivo } from '../src/modoBanco.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

function jogo(id, data, adv, set, extra = {}) {
  const g = set.placarCasa > set.placarAdversario
  return { id, tipo: 'JOGO', turmaId: 't1', formato: 'MELHOR_DE_3', data, status: 'FINALIZADA', setsPartida: [set],
    setsGanhosCasa: g ? 1 : 0, setsGanhosAdversario: g ? 0 : 1, adversarioNome: adv, createdAt: data, ...extra }
}

// Contra o Showa: camisa 7 deles faz 4 pontos de ataque; eles erram 3 saques.
let s = criarSet(1)
for (let i = 0; i < 4; i++) s = registrarEventoTime(s, 'ADVERSARIO', 'ataque', 'ACERTO', undefined, '7')
for (let i = 0; i < 3; i++) s = registrarEventoTime(s, 'ADVERSARIO', 'saque', 'ERRO', undefined, '10')
s = registrarEvento(s, 'ataque', 'ACERTO', 'bia')
s = registrarEvento(s, 'recepcao', 'ERRO', 'ana')
const j1 = jogo('j1', '2026-08-10', 'Showa Vôlei', s)
const j2 = jogo('j2', '2026-09-10', ' showa volei ', s) // sem acento: mesmo time
const outro = jogo('j3', '2026-09-20', 'Outro Time', s)
const teste = jogo('j4', '2026-09-21', 'teste', s)
const apagado = jogo('j5', '2026-09-22', 'Showa Vôlei', s, { deletedAt: '2026-09-23' })
const todas = [j1, j2, outro, teste, apagado]

{
  const lista = adversariosComJogos(todas)
  check('Lista: Showa (2 jogos, mesmo nome com espaço/maiúscula) e Outro Time; "teste" fica de fora', lista.length === 2 && lista.find((a) => a.chave === 'showa volei').jogos === 2)
  check('Lista: mais recente primeiro', lista[0].nome === 'Outro Time')
}

{
  const r = relatorioAdversario(todas, 'SHOWA VÔLEI')
  check('Relatório: 2 jogos (apagado fica de fora)', r.jogos.length === 2)
  check('Camisa 7 é a mais perigosa (8 pontos em 2 jogos)', r.camisasPerigosas[0].numero === '7' && r.camisasPerigosas[0].pontos === 8)
  check('Camisa 10 é a que mais erra (6 erros)', r.camisasQueErram[0].numero === '10' && r.camisasQueErram[0].erros === 6)
  check('Eles erram 3 saques por jogo', r.errosDeles[0].fundamento === 'saque' && r.errosDeles[0].porJogo === 3)
  check('Como eles pontuaram: ataque deles em 1º', r.pontosDeles[0].chave === 'adv_ataque' && r.pontosDeles[0].valor === 8)
  check('Dica da camisa perigosa', r.dicas.some((d) => d.includes('camisa 7') && d.includes('8 pontos')))
  check('Dica do saque deles', r.dicas.some((d) => d.includes('3 vezes por jogo no saque')))
  const t = textoRelatorioAdversario(r)
  check('Texto pra WhatsApp tem o nome e as camisas', t.includes('Showa') && t.includes('#7 (8)'))
  check('Adversário sem jogos: relatório vazio, sem erro', relatorioAdversario(todas, 'Ninguém').jogos.length === 0 && relatorioAdversario(todas, 'Ninguém').dicas.length === 0)
}

// Modo banco: montar o jogo a partir das linhas da nuvem
{
  const linhaPartida = { id: 'p1', turma_id: 't1', data: '2026-11-27', status: 'EM_ANDAMENTO', tipo: 'JOGO', sets_ganhos_casa: 0, sets_ganhos_adversario: 0,
    formato: 'MELHOR_DE_3', pontos_por_set: null, pontos_set_decisivo: null, convocadas: null, criada_em: '2026-11-27', adversarios: { nome: 'Rival' } }
  const ev = (id, ordem, f, r, extra = {}) => ({ id, ordem, fundamento: f, resultado: r, atleta_id: 'bia', detalhe: null, lado_responsavel: null, numero_adversario: null, video_seg: null, zona: null, ...extra })
  const sets = [{
    id: 's1', numero: 1, placar_casa: 1, placar_adversario: 1, finalizado: false, vencedor: null,
    titulares_iniciais: ['a', 'b', 'c', 'd', 'e', 'f'], saque_inicial_casa: true, libero_id: null, libero_substitui: null, substituicoes: [],
    rallies: [
      { id: 'r2', numero: 2, ponto: 'ADVERSARIO', placar_casa: 1, placar_adversario: 1, horario: 'x', rally_eventos: [ev('e3', 0, 'ATAQUE', 'ERRO', { detalhe: 'BLOQUEADO', zona: 4 })] },
      { id: 'r1', numero: 1, ponto: 'CASA', placar_casa: 1, placar_adversario: 0, horario: 'x', rally_eventos: [ev('e2', 1, 'ATAQUE', 'ACERTO'), ev('e1', 0, 'RECEPCAO', 'BOM')] },
      // rally acontecendo agora: placar não andou, não pode virar ponto
      { id: 'r3', numero: 3, ponto: 'ADVERSARIO', placar_casa: 1, placar_adversario: 1, horario: 'x', rally_eventos: [ev('e4', 0, 'SAQUE', 'EM_JOGO')] },
    ],
  }]
  const p = montarPartidaAoVivo(linhaPartida, sets)
  const st = p.setsPartida[0]
  check('Banco: rallies e lances em ordem', st.rallies.map((r) => r.id).join() === 'r1,r2,r3' && st.rallies[0].eventos[0].fundamento === 'recepcao')
  check('Banco: rally 1 nosso, rally 2 deles', st.rallies[0].pontoCasa === true && st.rallies[0].eventos[1].encerraRally === 'CASA' && st.rallies[1].eventos[0].encerraRally === 'ADVERSARIO')
  check('Banco: rally em andamento não fecha', st.rallies[2].eventos[0].encerraRally === null && st.rallies[2].pontoCasa === false)
  check('Banco: zona e bloqueado chegam', st.rallies[1].eventos[0].zona === '4' && st.rallies[1].eventos[0].tipoErro === 'BLOQUEADO')
  check('Banco: escalação e adversário', st.escalacaoInicial.length === 6 && st.primeiroSaque === 'CASA' && p.adversarioNome === 'Rival')
}

console.log(`\n${ok} verificações ok`)
