// Teste das análises da Etapa 1 "nível Data Volley" (pedido 27/11/2026).
import assert from 'node:assert'
import { criarSet, registrarEvento, registrarEventoTime } from '../src/scoutEngine.ts'
import {
  contextosDoSet, ataquePorRecepcao, ataquePorFase, desempenhoPorRodizio, distribuicaoAtaque,
  resumoPlacarSet, alertasTendencia, textoAlerta,
} from '../src/analiseAvancada.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

// Escalação: lev na I, pont1 II, cen1 III, opo IV, pont2 V, cen2 VI.
const escalacao = ['lev', 'pont1', 'cen1', 'opo', 'pont2', 'cen2']
const funcao = { lev: 'LEVANTADORA', pont1: 'PONTEIRO', pont2: 'PONTEIRO', cen1: 'CENTRAL', cen2: 'CENTRAL', opo: 'OPOSTO' }

// Set começa com o ADVERSÁRIO sacando.
let s = { ...criarSet(1), escalacaoInicial: escalacao, primeiroSaque: 'ADVERSARIO' }
// R1: recepção boa da pont1, ataque ponto da opo -> side-out (giramos: lev vai pra VI)
s = registrarEvento(s, 'recepcao', 'BOM', 'pont1')
s = registrarEvento(s, 'levantamento', 'BOM', 'lev')
s = registrarEvento(s, 'ataque', 'ACERTO', 'opo')
// R2: nós sacamos (pont1 na I agora), ace -> break
s = registrarEvento(s, 'saque', 'ACERTO', 'pont1')
// R3: saque em jogo, defesa, contra-ataque erro -> perdemos o saque
s = registrarEvento(s, 'saque', 'EM_JOGO', 'pont1')
s = registrarEvento(s, 'defesa', 'BOM', 'cen2')
s = registrarEvento(s, 'ataque', 'ERRO', 'pont2')
// R4: recebemos, recepção média, ataque em jogo, depois contra-ataque ponto
s = registrarEvento(s, 'recepcao', 'MEDIO', 'pont2')
s = registrarEvento(s, 'ataque', 'EM_JOGO', 'pont2')
s = registrarEvento(s, 'defesa', 'MEDIO', 'lev')
s = registrarEvento(s, 'ataque', 'ACERTO', 'opo')
// R5: nós sacamos, erro de saque
s = registrarEvento(s, 'saque', 'ERRO', 'cen1')
// R6: recebemos, erro de recepção
s = registrarEvento(s, 'recepcao', 'ERRO', 'pont1')
// R7: recebemos, recepção boa, ataque bloqueado (erro)
s = registrarEvento(s, 'recepcao', 'BOM', 'pont1')
s = registrarEvento(s, 'ataque', 'ERRO', 'cen1')
// R8: adversário erra o saque (ponto nosso, sem recepção marcada)
s = registrarEventoTime(s, 'ADVERSARIO', 'saque', 'ERRO')

check('Placar montado (4 x 4)', s.placarCasa === 4 && s.placarAdversario === 4)

// Contexto/rodízio
{
  const c = contextosDoSet(s)
  check('Contexto: 8 rallies', c.length === 8)
  check('R1 recebendo, lev na posição I', c[0].servindo === 'ADVERSARIO' && c[0].base[0] === 'lev')
  check('R2 sacando depois de girar (pont1 na I, lev na VI)', c[1].servindo === 'CASA' && c[1].base[0] === 'pont1' && c[1].base[5] === 'lev' && c[1].giros === 1)
  check('Set sem papeleta não tem contexto', contextosDoSet(criarSet(2)).length === 0)
}

// Ataque por recepção
{
  const r = Object.fromEntries(ataquePorRecepcao([s]).map((l) => [l.qualidade, l]))
  check('Recepção boa: 2 recepções, 1 side-out (50%)', r.BOM.recepcoes === 2 && r.BOM.sideOutPontos === 1 && r.BOM.sideOutPct === 50)
  check('Recepção boa: ataque 1 ponto e 1 erro em 2 (efic. 0%, kill 50%)', r.BOM.ataque.total === 2 && r.BOM.ataque.eficiencia === 0 && r.BOM.killPct === 50)
  check('Recepção média: 1 recepção, side-out 100%, ataque K1 em jogo', r.MEDIO.recepcoes === 1 && r.MEDIO.sideOutPct === 100 && r.MEDIO.ataque.neutro === 1)
  check('Erro de recepção: 0% side-out, sem ataque', r.ERRO.recepcoes === 1 && r.ERRO.sideOutPct === 0 && r.ERRO.ataque.total === 0)
  check('Rally sem recepção marcada (erro de saque deles) não entra', !('EM_JOGO' in r))
}

// K1 x K2
{
  const f = ataquePorFase([s])
  check('K1: 3 ataques (R1, R4 1º, R7)', f.k1.ataque.total === 3 && f.k1.ataque.positivo === 1 && f.k1.ataque.erro === 1)
  check('K2: 2 ataques (R3 erro, R4 2º ponto)', f.k2.ataque.total === 2 && f.k2.ataque.positivo === 1 && f.k2.ataque.erro === 1)
  check('K1 kill% = 33', f.k1.killPct === 33)
}

// Por rodízio (pela levantadora)
{
  const r = desempenhoPorRodizio([s], new Set(['lev']))
  check('Modo levantadora', r.modo === 'levantadora' && r.ignorados === 0)
  const p1 = r.linhas[0] // lev na I
  check('P1: só R1 (side-out ganho)', p1.sideOutOportunidades === 1 && p1.sideOutPontos === 1 && p1.breakOportunidades === 0)
  const p6 = r.linhas[5] // lev na VI depois do 1º giro
  check('P6: R2 e R3 (break 1/2) e R4 (side-out 1/1)', p6.breakOportunidades === 2 && p6.breakPontos === 1 && p6.sideOutOportunidades === 1 && p6.sideOutPontos === 1)
  const total = r.linhas.reduce((t, l) => t + l.pontosFeitos + l.pontosSofridos, 0)
  check('Todos os 8 rallies contados', total === 8)
  const semLev = desempenhoPorRodizio([s], new Set())
  check('Sem levantadora cadastrada: conta por giros', semLev.modo === 'giro' && semLev.linhas[0].sideOutOportunidades === 1)
}

// Distribuição
{
  const d = distribuicaoAtaque([s], (id) => funcao[id])
  const g = Object.fromEntries(d.map((x) => [x.situacao, x]))
  check('Depois de recepção boa: opo e cen1, 1 cada', g.RECEPCAO_BOA.total === 2 && g.RECEPCAO_BOA.porAtleta.every((x) => x.total === 1))
  check('Depois de recepção média: pont2', g.RECEPCAO_MEDIA.total === 1 && g.RECEPCAO_MEDIA.porAtleta[0].chave === 'pont2')
  check('Contra-ataque: pont2 e opo', g.CONTRA_ATAQUE.total === 2)
  check('Por função: oposto aparece', g.RECEPCAO_BOA.porFuncao.some((x) => x.chave === 'OPOSTO' && x.pct === 50))
}

// Resumo do placar
{
  let t = criarSet(1)
  t = registrarEvento(t, 'ataque', 'ACERTO', 'a') // 1-0
  t = registrarEvento(t, 'ataque', 'ERRO', 'a')   // 1-1
  t = registrarEvento(t, 'ataque', 'ERRO', 'a')   // 1-2 virada
  t = registrarEvento(t, 'ataque', 'ERRO', 'a')   // 1-3
  t = registrarEvento(t, 'ataque', 'ACERTO', 'a') // 2-3
  t = registrarEvento(t, 'ataque', 'ACERTO', 'a') // 3-3
  t = registrarEvento(t, 'ataque', 'ACERTO', 'a') // 4-3 virada
  const r = resumoPlacarSet(t)
  check('Viradas = 2', r.viradas === 2)
  check('Empates = 2 (1-1 e 3-3)', r.empates === 2)
  check('Maior vantagem: nossa 1, deles 2', r.maiorVantagemNossa === 1 && r.maiorVantagemDeles === 2)
}

// Alertas
{
  let t = criarSet(1)
  t = registrarEvento(t, 'saque', 'ERRO', 'duda')
  t = registrarEvento(t, 'saque', 'EM_JOGO', 'duda'); t = registrarEvento(t, 'ataque', 'ACERTO', 'bia')
  t = registrarEvento(t, 'saque', 'ERRO', 'duda')
  t = registrarEvento(t, 'saque', 'ERRO', 'duda')
  t = registrarEvento(t, 'ataque', 'ACERTO', 'bia')
  t = registrarEvento(t, 'ataque', 'ACERTO', 'bia')
  t = registrarEvento(t, 'ataque', 'EM_JOGO', 'bia')
  const a = alertasTendencia([t])
  const duda = a.find((x) => x.atletaId === 'duda')
  const bia = a.find((x) => x.atletaId === 'bia')
  check('Duda: alerta de 3 erros em 4 saques', duda && duda.tipo === 'alerta' && duda.quantos === 3)
  check('Texto do alerta', textoAlerta(duda) === 'errou 3 dos últimos 4 saques')
  check('Bia: destaque (3 pontos nos últimos 4 ataques)', bia && bia.tipo === 'destaque' && bia.quantos === 3)
  check('Alertas vêm antes dos destaques', a[0].tipo === 'alerta')
  // alerta velho some
  let v = t
  for (let i = 0; i < 12; i++) v = registrarEvento(v, 'ataque', 'ACERTO', 'cris')
  check('Alerta velho (12 rallies depois) não aparece', !alertasTendencia([v]).some((x) => x.atletaId === 'duda'))
  check('Menos de 4 ações: sem alerta', alertasTendencia([criarSet(1)]).length === 0)
}

console.log(`\n${ok} verificações ok`)
