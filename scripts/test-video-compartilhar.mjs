// Vídeo (21/11/2026): link do lance pro WhatsApp e atalhos de teclado.
import { linkLanceYoutube, mensagemLance, acaoDaTecla, RECUO_LANCE_SEG } from '../src/videoJogo.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const ID = 'dQw4w9WgXcQ'
assert(linkLanceYoutube(ID, 125.7) === `https://youtu.be/${ID}?t=${125 - RECUO_LANCE_SEG}`, 'Link abre uns segundos antes do lance')
assert(linkLanceYoutube(ID, 2) === `https://youtu.be/${ID}?t=0`, 'Lance no começo do vídeo não fica com tempo negativo')

const msg = mensagemLance({ nome: 'Ana', fundamento: 'Ataque', resultado: 'Ponto', setNumero: 2, placarCasa: 18, placarAdversario: 14, link: 'L' })
assert(msg === 'Lance da Ana — Ataque, ponto (set 2, 18×14): L', 'Mensagem com nome, fundamento, resultado e placar')
assert(mensagemLance({ fundamento: 'Saque', resultado: 'Ponto', setNumero: 1, placarCasa: 0, placarAdversario: 1, link: 'L' }).startsWith('Lance — Saque'), 'Lance do adversário: sem nome')

assert(acaoDaTecla(' ') === 'tocar_pausar' && acaoDaTecla('k') === 'tocar_pausar', 'Espaço/K = play/pausa')
assert(acaoDaTecla('ArrowLeft') === 'voltar' && acaoDaTecla('ArrowRight') === 'avancar', 'Setas = voltar/avançar 5 s')
assert(acaoDaTecla(',') === 'quadro_tras' && acaoDaTecla('.') === 'quadro_frente', 'Vírgula/ponto = quadro a quadro')
assert(acaoDaTecla('1') === 'velocidade_1' && acaoDaTecla('2') === 'velocidade_05' && acaoDaTecla('3') === 'velocidade_025', '1/2/3 = velocidade')
assert(acaoDaTecla('a') === null && acaoDaTecla('Enter') === null, 'Outras teclas não fazem nada')

if (falhas) { console.error(`${falhas} falha(s)`); process.exit(1) }
