// Teste do scout pelo vídeo (pedido 21/11/2026).
import { idYoutube, formatarTempo, lancesComVideo, carimbarVideo } from '../src/videoJogo.ts'
import { criarSet, registrarEventoTime, desfazerUltimoEvento } from '../src/scoutEngine.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const ID = 'dQw4w9WgXcQ'
for (const link of [
  `https://www.youtube.com/watch?v=${ID}`,
  `https://youtube.com/watch?v=${ID}&t=120s`,
  `https://m.youtube.com/watch?v=${ID}&list=PL123`,
  `https://youtu.be/${ID}`,
  `https://youtu.be/${ID}?si=abc`,
  `https://www.youtube.com/shorts/${ID}`,
  `https://www.youtube.com/live/${ID}?feature=share`,
  `https://www.youtube.com/embed/${ID}`,
  `youtube.com/watch?v=${ID}`,
  `  https://youtu.be/${ID}  `,
]) assert(idYoutube(link) === ID, `Link do YouTube reconhecido: ${link.trim()}`)
assert(idYoutube('https://vimeo.com/123') === null, 'Link que não é do YouTube: recusa')
assert(idYoutube('qualquer coisa') === null, 'Texto qualquer: recusa')
assert(idYoutube('') === null, 'Vazio: recusa')

assert(formatarTempo(0) === '0:00', '0 s = 0:00')
assert(formatarTempo(754) === '12:34', '754 s = 12:34')
assert(formatarTempo(3725.9) === '1:02:05', '3725 s = 1:02:05')

// Lance marcado com vídeo guarda o segundo; desfazer leva junto.
let set = { ...criarSet(1) }
set = carimbarVideo(registrarEventoTime(set, 'CASA', 'recepcao', 'BOM', 'ma'), 61.23)
set = carimbarVideo(registrarEventoTime(set, 'CASA', 'ataque', 'ACERTO', 'ma'), 65)
set = carimbarVideo(registrarEventoTime(set, 'CASA', 'saque', 'ERRO', 'ju'), 80)
set = registrarEventoTime(set, 'ADVERSARIO', 'ataque', 'ACERTO') // sem vídeo
set = carimbarVideo(registrarEventoTime(set, 'CASA', 'ataque', 'ERRO', 'ma'), 30) // vídeo voltado pra trás
const partida = { setsPartida: [set] }

const todos = lancesComVideo(partida)
assert(todos.length === 4, 'Só os lances com minuto do vídeo entram (4 de 5)')
assert(todos[0].videoSeg === 30 && todos[3].videoSeg === 80, 'Ordem do vídeo, não da marcação')
assert(todos.find((l) => l.fundamento === 'recepcao').videoSeg === 61.2, 'Guarda o segundo com 1 casa decimal')
const daMarina = lancesComVideo(partida, { atletaId: 'ma' })
assert(daMarina.length === 3 && daMarina.every((l) => l.atletaId === 'ma'), 'Filtro por atleta')
const errosMarina = lancesComVideo(partida, { atletaId: 'ma', soErros: true })
assert(errosMarina.length === 1 && errosMarina[0].videoSeg === 30, 'Só os erros da atleta')
assert(lancesComVideo(partida, { soErros: true }).every((l) => l.lado === 'CASA'), 'Erros = só do nosso time')
assert(todos.find((l) => l.videoSeg === 65).placarCasa === 1, 'Lance sabe o placar depois dele')

assert(carimbarVideo(set, null) === set, 'Sem vídeo aberto: nada muda')
const antes = set
const desfeito = desfazerUltimoEvento(set)
assert(lancesComVideo({ setsPartida: [desfeito] }).length === 3, 'Desfazer apaga o lance e o minuto dele')
assert(lancesComVideo({ setsPartida: [antes] }).length === 4, 'Estado anterior intacto')

if (falhas > 0) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nTodos os testes do vídeo passaram.')
