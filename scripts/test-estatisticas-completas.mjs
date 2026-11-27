// Teste da aba Estatísticas completa (pedido 27/11/2026).
import assert from 'node:assert'
import { criarSet, registrarEvento, registrarEventoTime } from '../src/scoutEngine.ts'
import {
  filtrarPartidas, resumoJogos, origemDosPontos, desempenhoPorNumeroSet, evolucaoPorJogo,
  maioresSequencias, estatisticasPorAtleta, rankings,
} from '../src/estatisticasCompletas.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

function partida(id, data, sets, extra = {}) {
  const ganhosC = sets.filter((s) => s.placarCasa > s.placarAdversario).length
  const ganhosA = sets.filter((s) => s.placarAdversario > s.placarCasa).length
  return {
    id, tipo: 'JOGO', turmaId: 't1', formato: 'MELHOR_DE_3', data, status: 'FINALIZADA',
    setsPartida: sets, setsGanhosCasa: ganhosC, setsGanhosAdversario: ganhosA,
    adversarioNome: 'Showa', createdAt: data, ...extra,
  }
}

// Set 1: ace da Ana, ataque da Bia, erro de saque da Ana, erro do adversário,
// ponto de ataque do adversário, erro de recepção da Bia.
let s1 = { ...criarSet(1), primeiroSaque: 'CASA' }
s1 = registrarEvento(s1, 'saque', 'ACERTO', 'ana')       // 1-0 ace
s1 = registrarEvento(s1, 'saque', 'EM_JOGO', 'ana')
s1 = registrarEvento(s1, 'ataque', 'ACERTO', 'bia')      // 2-0
s1 = registrarEvento(s1, 'saque', 'ERRO', 'ana')         // 2-1
s1 = registrarEventoTime(s1, 'ADVERSARIO', 'saque', 'ERRO') // 3-1 erro deles
s1 = registrarEventoTime(s1, 'ADVERSARIO', 'ataque', 'ACERTO') // 3-2 ponto deles
s1 = registrarEvento(s1, 'recepcao', 'ERRO', 'bia')      // 3-3

const p1 = partida('p1', '2026-08-01', [s1])
check('Placar do set montado certo (3 x 3)', s1.placarCasa === 3 && s1.placarAdversario === 3)

let s2 = { ...criarSet(1), primeiroSaque: 'ADVERSARIO' }
for (let i = 0; i < 4; i++) s2 = registrarEvento(s2, 'ataque', 'ACERTO', 'bia')
s2 = registrarEvento(s2, 'bloqueio', 'ACERTO', 'cris')
const p2 = partida('p2', '2026-08-10', [s2], { adversarioNome: ' showa ' })
const p3 = partida('p3', '2026-08-20', [s2], { adversarioNome: 'Outro', status: 'EM_ANDAMENTO' })
const p4 = partida('p4', '2026-08-25', [s2], { adversarioNome: 'Outro', deletedAt: '2026-09-01' })

// Filtros
{
  const todas = [p2, p1, p3, p4]
  const temporada = filtrarPartidas(todas, { periodo: 'TEMPORADA' })
  check('Só entram jogos finalizados e não apagados', temporada.length === 2)
  check('Ordem do mais antigo pro mais novo', temporada[0].id === 'p1' && temporada[1].id === 'p2')
  check('Último jogo', filtrarPartidas(todas, { periodo: 'ULTIMO' })[0].id === 'p2')
  check('Filtro por adversário ignora maiúsculas e espaços', filtrarPartidas(todas, { periodo: 'TEMPORADA', adversario: 'SHOWA' }).length === 2)
  check('Jogo específico manda no período', filtrarPartidas(todas, { periodo: 'ULTIMO', partidaId: 'p1' })[0].id === 'p1')
  check('Filtro por turma', filtrarPartidas(todas, { periodo: 'TEMPORADA', turmaId: 'outra' }).length === 0)
}

// Resumo
{
  const r = resumoJogos([p1, p2])
  check('Resumo: 2 jogos, 1 vitória (p2), p1 empatado conta como derrota', r.jogos === 2 && r.vitorias === 1 && r.derrotas === 1)
  check('Resumo: pontos feitos e sofridos', r.pontosFeitos === 8 && r.pontosSofridos === 3 && r.saldoPontos === 5)
  check('Resumo: sequência atual = 1 vitória', r.sequenciaAtual.tipo === 'V' && r.sequenciaAtual.tamanho === 1)
  check('Resumo vazio não dá NaN', resumoJogos([]).aproveitamento === 0 && resumoJogos([]).mediaPontosFeitosPorSet === 0)
}

// Origem dos pontos
{
  const o = origemDosPontos([s1])
  const g = Object.fromEntries(o.ganhos.map((x) => [x.chave, x.valor]))
  const p = Object.fromEntries(o.perdidos.map((x) => [x.chave, x.valor]))
  check('Pontos ganhos: 1 ace, 1 ataque, 1 erro do adversário', g.saque === 1 && g.ataque === 1 && g.erro_adversario === 1 && o.totalGanhos === 3)
  check('Pontos perdidos: erro de saque, erro de recepção, ataque deles', p.erro_saque === 1 && p.erro_recepcao === 1 && p.adv_ataque === 1 && o.totalPerdidos === 3)
  check('Total de ganhos bate com o placar', o.totalGanhos === s1.placarCasa && o.totalPerdidos === s1.placarAdversario)
}

// Por número de set e jogo a jogo
{
  const ps = desempenhoPorNumeroSet([p1, p2])
  check('1º set: 2 jogados, 1 ganho', ps.length === 1 && ps[0].jogados === 2 && ps[0].ganhos === 1)
  const ev = evolucaoPorJogo([p1, p2])
  check('Jogo a jogo: p2 vencido e 100% de eficiência', ev[1].venceu && ev[1].eficiencia === 100)
  check('Jogo a jogo: pontos do p1', ev[0].pontosFeitos === 3 && ev[0].pontosSofridos === 3)
}

// Sequências
{
  const m = maioresSequencias([p1, p2])
  check('Maior sequência a favor = 5 (p2)', m.aFavor === 5)
  check('Maior sequência contra = 2 (fim do set 1)', m.contra === 2)
}

// Por atleta e rankings
{
  const linhas = estatisticasPorAtleta([p1, p2])
  const de = Object.fromEntries(linhas.map((l) => [l.atletaId, l]))
  check('Ana: 1 ace, 1 erro que deu ponto, saldo 0', de.ana.aces === 1 && de.ana.errosQueDeramPonto === 1 && de.ana.saldo === 0)
  check('Bia: 5 pontos de ataque em 2 jogos, 1 erro', de.bia.ataquesPonto === 5 && de.bia.jogos === 2 && de.bia.errosQueDeramPonto === 1)
  check('Cris: 1 bloqueio de ponto', de.cris.bloqueiosPonto === 1)
  const rk = rankings(linhas)
  const mais = rk.find((r) => r.titulo === 'Mais pontos')
  check('Ranking de pontos: Bia primeiro', mais.itens[0].atletaId === 'bia' && mais.itens[0].valor === 5)
  const atq = rk.find((r) => r.titulo === 'Ataque (eficiência)')
  check('Ranking de eficiência exige 5 tentativas (Bia tem 5)', atq && atq.itens.length === 1 && atq.itens[0].atletaId === 'bia')
  check('Sem ranking de recepção (ninguém com 5 tentativas)', !rk.some((r) => r.titulo === 'Recepção (eficiência)'))
}

console.log(`\n${ok} verificações ok`)
