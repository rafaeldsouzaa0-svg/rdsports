// Teste isolado de scoutPorAtleta — confere agregação por atleta/fundamento antes de subir.
import { scoutPorAtleta } from '../src/scoutEngine.ts'

let falhas = 0
function assert(cond, msg) { if (!cond) { console.error('FALHOU:', msg); falhas++ } else console.log('OK:', msg) }

const partida = {
  setsPartida: [
    {
      id: 's1', numero: 1, placarCasa: 2, placarAdversario: 0, finalizado: false,
      rallies: [
        { id: 'r1', numero: 1, pontoCasa: true, placarCasaApos: 1, placarAdversarioApos: 0, eventos: [
          { id: 'e1', atletaId: 'ana', fundamento: 'saque', resultado: 'EM_JOGO', encerraRally: null, timestamp: '' },
          { id: 'e2', atletaId: 'bia', fundamento: 'recepcao', resultado: 'BOM', encerraRally: null, timestamp: '' },
          { id: 'e3', atletaId: 'ana', fundamento: 'ataque', resultado: 'ACERTO', encerraRally: 'CASA', timestamp: '' },
        ]},
        { id: 'r2', numero: 2, pontoCasa: true, placarCasaApos: 2, placarAdversarioApos: 0, eventos: [
          { id: 'e4', atletaId: 'ana', fundamento: 'saque', resultado: 'ACERTO', encerraRally: 'CASA', timestamp: '' },
        ]},
        { id: 'r3', numero: 3, pontoCasa: false, placarCasaApos: 2, placarAdversarioApos: 1, eventos: [
          { id: 'e5', atletaId: 'ana', fundamento: 'saque', resultado: 'ERRO', encerraRally: 'ADVERSARIO', timestamp: '' },
        ]},
      ],
    },
  ],
}

const scout = scoutPorAtleta(partida.setsPartida)
const ana = scout.find((s) => s.atletaId === 'ana')
const bia = scout.find((s) => s.atletaId === 'bia')

assert(!!ana, 'Ana aparece no scout')
assert(ana.porFundamento.saque.total === 3, 'Ana tem 3 saques registrados')
assert(ana.porFundamento.saque.positivo === 1 && ana.porFundamento.saque.neutro === 1 && ana.porFundamento.saque.erro === 1, 'Saque de Ana: 1 positivo, 1 neutro, 1 erro')
assert(ana.porFundamento.ataque.total === 1 && ana.porFundamento.ataque.positivo === 1, 'Ataque de Ana: 1 ação positiva')
assert(ana.totalGeral.total === 4, 'Total geral de Ana é 4 ações (3 saque + 1 ataque)')
assert(!!bia && bia.porFundamento.recepcao.positivo === 1, 'Bia tem 1 recepção boa')
assert(bia.porFundamento.saque.total === 0, 'Bia não tem saques (linha vazia)')

console.log(falhas === 0 ? '\nTudo passou.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
