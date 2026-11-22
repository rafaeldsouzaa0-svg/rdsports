// Scout pelo vídeo (pedido 21/11/2026): funções sem tela, testadas em
// scripts/test-video-jogo.mjs.
// - O vídeo pode ser um link do YouTube (fica em `partida.videoUrl` e vai pra
//   nuvem) ou um arquivo do aparelho (NÃO vai pra nuvem: o professor escolhe
//   o arquivo de novo quando for assistir).
// - Cada lance marcado com o vídeo aberto guarda o segundo do vídeo
//   (`RallyEvento.videoSeg`), pra depois abrir o vídeo exatamente no lance.
import type { FundamentoScout, Partida, ResultadoEvento } from './types'

/** Tira o id do vídeo de qualquer link comum do YouTube (watch, youtu.be,
 *  shorts, live, embed, com ou sem tempo/playlist). `null` se não for link
 *  do YouTube. */
export function idYoutube(link: string | null | undefined): string | null {
  if (!link) return null
  const texto = link.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(texto)) return texto
  let url: URL
  try { url = new URL(texto.startsWith('http') ? texto : `https://${texto}`) } catch { return null }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const m = url.pathname.match(/^\/(?:shorts|live|embed|v)\/([^/?#]+)/)
      id = m ? m[1] : null
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

/** 754 → "12:34"; 3725 → "1:02:05". */
export function formatarTempo(seg: number): string {
  const s = Math.max(0, Math.floor(seg))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Quantos segundos ANTES do lance o vídeo começa ao tocar "▶ ver" — o
 *  professor toca no botão depois que a jogada aconteceu. */
export const RECUO_LANCE_SEG = 5

/** Link do YouTube que já abre no lance (uns segundos antes), pra mandar
 *  pela atleta/pais pelo WhatsApp (21/11/2026). */
export function linkLanceYoutube(idVideo: string, videoSeg: number): string {
  return `https://youtu.be/${idVideo}?t=${Math.max(0, Math.floor(videoSeg - RECUO_LANCE_SEG))}`
}

/** Mensagem pronta pro WhatsApp: "Lance da Ana — Ataque, ponto (set 1, 5×3): link". */
export function mensagemLance(o: { nome?: string; fundamento: string; resultado: string; setNumero: number; placarCasa: number; placarAdversario: number; link: string }): string {
  const quem = o.nome ? `Lance da ${o.nome}` : 'Lance'
  return `${quem} — ${o.fundamento}, ${o.resultado.toLowerCase()} (set ${o.setNumero}, ${o.placarCasa}×${o.placarAdversario}): ${o.link}`
}

/** Passo do "quadro a quadro": ~1 quadro de vídeo de 30 fps. */
export const PASSO_QUADRO_SEG = 1 / 30

export type AcaoTecla = 'tocar_pausar' | 'voltar' | 'avancar' | 'quadro_tras' | 'quadro_frente' | 'velocidade_1' | 'velocidade_05' | 'velocidade_025'

/** Atalhos do player no computador (21/11/2026): espaço/K = play/pausa,
 *  ←/→ = 5 s, vírgula/ponto = quadro a quadro, 1/2/3 = velocidade. */
export function acaoDaTecla(tecla: string): AcaoTecla | null {
  switch (tecla) {
    case ' ': case 'k': case 'K': return 'tocar_pausar'
    case 'ArrowLeft': case 'j': case 'J': return 'voltar'
    case 'ArrowRight': case 'l': case 'L': return 'avancar'
    case ',': case '<': return 'quadro_tras'
    case '.': case '>': return 'quadro_frente'
    case '1': return 'velocidade_1'
    case '2': return 'velocidade_05'
    case '3': return 'velocidade_025'
    default: return null
  }
}

export interface LanceVideo {
  eventoId: string
  setNumero: number
  videoSeg: number
  fundamento: FundamentoScout
  resultado: ResultadoEvento
  lado: 'CASA' | 'ADVERSARIO'
  atletaId?: string
  numeroAdversario?: string
  placarCasa: number
  placarAdversario: number
}

/** Lances da partida que têm minuto do vídeo, em ordem do vídeo.
 *  `atletaId` filtra por atleta; `soErros` deixa só os erros (do nosso time). */
export function lancesComVideo(
  partida: Pick<Partida, 'setsPartida'>,
  filtro: { atletaId?: string; soErros?: boolean } = {},
): LanceVideo[] {
  const lances: LanceVideo[] = []
  for (const set of partida.setsPartida) {
    for (const rally of set.rallies) {
      for (const ev of rally.eventos) {
        if (ev.videoSeg === undefined || ev.videoSeg === null) continue
        const lado = ev.ladoResponsavel === 'ADVERSARIO' ? 'ADVERSARIO' : 'CASA'
        if (filtro.atletaId && ev.atletaId !== filtro.atletaId) continue
        if (filtro.soErros && (lado !== 'CASA' || ev.resultado !== 'ERRO')) continue
        lances.push({
          eventoId: ev.id, setNumero: set.numero, videoSeg: ev.videoSeg, fundamento: ev.fundamento, resultado: ev.resultado,
          lado, atletaId: ev.atletaId, numeroAdversario: ev.numeroAdversario,
          placarCasa: rally.placarCasaApos, placarAdversario: rally.placarAdversarioApos,
        })
      }
    }
  }
  return lances.sort((a, b) => a.videoSeg - b.videoSeg)
}

/** Coloca o minuto do vídeo no lance que ACABOU de ser marcado (o último
 *  evento do último rally do set). */
export function carimbarVideo<T extends { rallies: { eventos: { videoSeg?: number }[] }[] }>(set: T, videoSeg: number | null | undefined): T {
  if (videoSeg === null || videoSeg === undefined || !Number.isFinite(videoSeg)) return set
  const rallies = set.rallies
  if (rallies.length === 0) return set
  const ultimo = rallies[rallies.length - 1]
  if (ultimo.eventos.length === 0) return set
  const eventos = ultimo.eventos.map((e, i) => (i === ultimo.eventos.length - 1 ? { ...e, videoSeg: Math.round(videoSeg * 10) / 10 } : e))
  return { ...set, rallies: [...rallies.slice(0, -1), { ...ultimo, eventos }] }
}
