// Teste isolado do motor de rating por posição — confere pesos, confiança por
// volume, agregação entre partidas, a escala 6.0-10.0 (pedido 30/10/2026) e a
// mistura de função principal/secundária (pedido 30/10/2026) antes de subir.
import { calcularRating, agregarScoutAtleta, FUNDAMENTOS_RATING, PESOS_POSICAO, RATING_MINIMO, RATING_MAXIMO } from '../src/rating.ts'
import { linhaVazia } from '../src/scoutEngine.ts'

let falhas = 0
function assert(cond, msg) { if (!cond) { console.error('FALHOU:', msg); falhas++ } else console.log('OK:', msg) }

// 1) Pesos de cada posição somam 1.0
for (const pos of Object.keys(PESOS_POSICAO)) {
  const soma = FUNDAMENTOS_RATING.reduce((s, f) => s + PESOS_POSICAO[pos][f], 0)
  assert(Math.abs(soma - 1) < 1e-9, `Pesos de ${pos} somam 1.0 (deu ${soma})`)
}

function porFundamentoVazio() {
  const v = {}
  for (const f of FUNDAMENTOS_RATING) v[f] = linhaVazia()
  v.bola_de_graca = linhaVazia(); v.bola_de_segunda = linhaVazia(); v.nao_deslocou = linhaVazia()
  return v
}

// 2) Sem nenhuma ação registrada -> rating no PISO da escala (6.0), confiança 0
{
  const r = calcularRating(porFundamentoVazio(), 'PONTEIRO')
  assert(r.rating === RATING_MINIMO, `Sem dados, rating fica no piso 6.0 (deu ${r.rating})`)
  assert(r.confianca === 0, `Sem dados, confiança é 0 (deu ${r.confianca})`)
}

// 3) Poucas ações muito boas não disparam pro teto — fica puxado pro piso
{
  const dados = porFundamentoVazio()
  dados.ataque = { positivo: 3, neutro: 0, erro: 0, total: 3, eficiencia: 100 }
  const r = calcularRating(dados, 'OPOSTO')
  assert(r.rating < 8, `3 ataques perfeitos (pouco volume) não levam o rating perto do teto (deu ${r.rating})`)
  assert(r.rating > RATING_MINIMO, `Mas o rating ainda sobe um pouco acima do piso (deu ${r.rating})`)
}

// 4) Volume alto e consistente bate perto do teto da escala
{
  const dados = porFundamentoVazio()
  dados.ataque = { positivo: 40, neutro: 0, erro: 0, total: 40, eficiencia: 100 } // nota 100
  const r = calcularRating(dados, 'OPOSTO')
  assert(r.rating >= 9.8, `Volume alto (40 ações) com 100% de eficiência fica perto do teto 10.0 (deu ${r.rating})`)
}

// 4b) Mesmo com volume alto, o rating nunca passa de 10.0 nem fica abaixo de 6.0
{
  const dados = porFundamentoVazio()
  dados.ataque = { positivo: 0, neutro: 0, erro: 40, total: 40, eficiencia: -100 } // pior caso possível
  const r = calcularRating(dados, 'OPOSTO')
  assert(r.rating === RATING_MINIMO, `Volume alto com 100% de erro ainda fica no piso 6.0, nunca abaixo (deu ${r.rating})`)
  assert(r.rating >= RATING_MINIMO && r.rating <= RATING_MAXIMO, `Rating sempre dentro de [6.0, 10.0] (deu ${r.rating})`)
}

// 5) Posições diferentes dão pesos (e portanto ratings) diferentes pro mesmo scout
{
  const dados = porFundamentoVazio()
  dados.bloqueio = { positivo: 30, neutro: 0, erro: 0, total: 30, eficiencia: 100 }
  dados.recepcao = { positivo: 0, neutro: 0, erro: 30, total: 30, eficiencia: -100 }
  const central = calcularRating(dados, 'CENTRAL') // pesa pouco a recepção, bastante o bloqueio
  const libero = calcularRating(dados, 'LIBERO') // pesa muito a recepção (ruim aqui)
  assert(central.rating > libero.rating, `Mesmo scout dá rating maior pra Central (${central.rating}) que pra Líbero (${libero.rating}), porque a Central não é julgada pela recepção`)
}

// 6) agregarScoutAtleta soma só partidas finalizadas, não deletadas, e ignora eventos de adversário
{
  const partidaFinalizada = {
    id: 'p1', status: 'FINALIZADA', deletedAt: undefined,
    setsPartida: [{
      id: 's1', numero: 1, placarCasa: 25, placarAdversario: 20, finalizado: true,
      rallies: [{ id: 'r1', numero: 1, pontoCasa: true, placarCasaApos: 1, placarAdversarioApos: 0, eventos: [
        { id: 'e1', atletaId: 'ana', fundamento: 'ataque', resultado: 'ACERTO', encerraRally: 'CASA', timestamp: '' },
      ]}],
    }],
  }
  const partidaEmAndamento = {
    id: 'p2', status: 'EM_ANDAMENTO', deletedAt: undefined,
    setsPartida: [{
      id: 's2', numero: 1, placarCasa: 10, placarAdversario: 5, finalizado: false,
      rallies: [{ id: 'r2', numero: 1, pontoCasa: true, placarCasaApos: 1, placarAdversarioApos: 0, eventos: [
        { id: 'e2', atletaId: 'ana', fundamento: 'ataque', resultado: 'ACERTO', encerraRally: 'CASA', timestamp: '' },
      ]}],
    }],
  }
  const partidaExcluida = {
    id: 'p3', status: 'FINALIZADA', deletedAt: '2026-01-01T00:00:00Z',
    setsPartida: [{
      id: 's3', numero: 1, placarCasa: 25, placarAdversario: 10, finalizado: true,
      rallies: [{ id: 'r3', numero: 1, pontoCasa: true, placarCasaApos: 1, placarAdversarioApos: 0, eventos: [
        { id: 'e3', atletaId: 'ana', fundamento: 'ataque', resultado: 'ACERTO', encerraRally: 'CASA', timestamp: '' },
      ]}],
    }],
  }
  const totais = agregarScoutAtleta('ana', [partidaFinalizada, partidaEmAndamento, partidaExcluida])
  assert(totais.ataque.total === 1, `agregarScoutAtleta só conta a partida finalizada e não excluída (deu ${totais.ataque.total})`)
}

// 7) Função secundária (pedido 30/10/2026): muda o rating porque os pesos
// ficam numa mistura 70% principal / 30% secundária.
{
  const dados = porFundamentoVazio()
  // Recepção excelente, bloqueio péssimo — bom pra Líbero (pesa recepção),
  // ruim pra Central (pesa bloqueio).
  dados.recepcao = { positivo: 40, neutro: 0, erro: 0, total: 40, eficiencia: 100 }
  dados.bloqueio = { positivo: 0, neutro: 0, erro: 40, total: 40, eficiencia: -100 }

  const soCentral = calcularRating(dados, 'CENTRAL')
  const centralComLiberoSecundaria = calcularRating(dados, 'CENTRAL', 'LIBERO')
  assert(
    centralComLiberoSecundaria.rating > soCentral.rating,
    `Central com função secundária de Líbero tem rating maior (${centralComLiberoSecundaria.rating}) que só Central (${soCentral.rating}), porque a recepção boa passa a pesar um pouco`
  )
}

// 8) Função secundária igual à principal não muda nada (não deveria "dobrar" o peso)
{
  const dados = porFundamentoVazio()
  dados.ataque = { positivo: 20, neutro: 0, erro: 0, total: 20, eficiencia: 100 }
  const r1 = calcularRating(dados, 'OPOSTO')
  const r2 = calcularRating(dados, 'OPOSTO', 'OPOSTO')
  assert(r1.rating === r2.rating, `Secundária igual à principal dá o mesmo rating (${r1.rating} vs ${r2.rating})`)
  assert(r2.posicaoSecundariaUsada === null, 'posicaoSecundariaUsada fica null quando é igual à principal (não conta como "secundária de verdade")')
}

// 9) Sem função secundária informada, comportamento idêntico ao de antes (só principal)
{
  const dados = porFundamentoVazio()
  dados.saque = { positivo: 10, neutro: 0, erro: 2, total: 12, eficiencia: 67 }
  const r = calcularRating(dados, 'PONTEIRO')
  assert(r.posicaoSecundariaUsada === null, 'Sem secundária informada, posicaoSecundariaUsada é null')
}

console.log(falhas === 0 ? '\nTudo passou.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
