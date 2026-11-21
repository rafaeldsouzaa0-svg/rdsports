// Player do vídeo do jogo (pedido 21/11/2026): link do YouTube ou arquivo do
// próprio aparelho, com os mesmos controles nos dois casos (voltar/avançar
// 5 s, play/pausa, câmera lenta) e uma barra com um risquinho em cada lance
// já marcado (verde = ponto nosso, vermelho = deles).
import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Play, Pause, Rewind, FastForward } from 'lucide-react'
import { formatarTempo } from '../videoJogo'

export type FonteVideo = { tipo: 'youtube'; id: string } | { tipo: 'arquivo'; url: string; nome: string }

export interface ControlePlayer {
  tempo: () => number
  pausar: () => void
  irPara: (seg: number, tocar?: boolean) => void
}

export interface MarcaVideo { seg: number; cor: string }

// ---------- API do YouTube (carregada uma vez só) ----------
interface YTPlayer {
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (s: number, permitir: boolean) => void
  setPlaybackRate: (v: number) => void
  destroy: () => void
}
interface YTNamespace { Player: new (el: HTMLElement, opcoes: Record<string, unknown>) => YTPlayer }
let promessaYT: Promise<YTNamespace> | null = null
function carregarYouTube(): Promise<YTNamespace> {
  const w = window as unknown as { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
  if (w.YT?.Player) return Promise.resolve(w.YT)
  if (!promessaYT) {
    promessaYT = new Promise((ok, falhou) => {
      w.onYouTubeIframeAPIReady = () => ok(w.YT!)
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      s.onerror = () => { promessaYT = null; falhou(new Error('youtube')) }
      document.head.appendChild(s)
    })
  }
  return promessaYT
}

const VELOCIDADES = [1, 0.5, 0.25]

export default function PlayerVideo({ fonte, marcas = [], ref }: { fonte: FonteVideo; marcas?: MarcaVideo[]; ref?: React.Ref<ControlePlayer> }) {
  const videoEl = useRef<HTMLVideoElement>(null)
  const ytEl = useRef<HTMLDivElement>(null)
  const yt = useRef<YTPlayer | null>(null)
  const [tocando, setTocando] = useState(false)
  const [atual, setAtual] = useState(0)
  const [duracao, setDuracao] = useState(0)
  const [velocidade, setVelocidade] = useState(1)
  const [erroYT, setErroYT] = useState(false)

  // Monta o player do YouTube quando a fonte é um link.
  useEffect(() => {
    if (fonte.tipo !== 'youtube' || !ytEl.current) return
    let cancelado = false
    const alvo = document.createElement('div')
    ytEl.current.innerHTML = ''
    ytEl.current.appendChild(alvo)
    setErroYT(false)
    carregarYouTube().then((YT) => {
      if (cancelado) return
      yt.current = new YT.Player(alvo, {
        videoId: fonte.id,
        width: '100%', height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e: { data: number }) => setTocando(e.data === 1),
          onError: () => setErroYT(true),
        },
      })
    }).catch(() => { if (!cancelado) setErroYT(true) })
    return () => { cancelado = true; try { yt.current?.destroy() } catch { /* já fechado */ } yt.current = null }
  }, [fonte])

  // Atualiza o relógio e a barra.
  useEffect(() => {
    const t = setInterval(() => {
      if (fonte.tipo === 'youtube' && yt.current?.getCurrentTime) {
        try { setAtual(yt.current.getCurrentTime() || 0); setDuracao(yt.current.getDuration() || 0) } catch { /* ainda carregando */ }
      } else if (videoEl.current) {
        setAtual(videoEl.current.currentTime || 0)
        setDuracao(Number.isFinite(videoEl.current.duration) ? videoEl.current.duration : 0)
      }
    }, 400)
    return () => clearInterval(t)
  }, [fonte])

  function tempo(): number {
    if (fonte.tipo === 'youtube') { try { return yt.current?.getCurrentTime() ?? 0 } catch { return 0 } }
    return videoEl.current?.currentTime ?? 0
  }
  function pausar() {
    if (fonte.tipo === 'youtube') { try { yt.current?.pauseVideo() } catch { /* ainda carregando */ } }
    else videoEl.current?.pause()
  }
  function tocar() {
    if (fonte.tipo === 'youtube') { try { yt.current?.playVideo() } catch { /* ainda carregando */ } }
    else void videoEl.current?.play().catch(() => {})
  }
  function irPara(seg: number, tocarDepois = false) {
    const s = Math.max(0, seg)
    if (fonte.tipo === 'youtube') { try { yt.current?.seekTo(s, true) } catch { /* ainda carregando */ } }
    else if (videoEl.current) videoEl.current.currentTime = s
    setAtual(s)
    if (tocarDepois) tocar()
  }
  function trocarVelocidade() {
    const v = VELOCIDADES[(VELOCIDADES.indexOf(velocidade) + 1) % VELOCIDADES.length]
    setVelocidade(v)
    if (fonte.tipo === 'youtube') { try { yt.current?.setPlaybackRate(v) } catch { /* ainda carregando */ } }
    else if (videoEl.current) videoEl.current.playbackRate = v
  }

  useImperativeHandle(ref, () => ({ tempo, pausar, irPara }))

  return (
    <div>
      <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--rd-border)', background: '#000', aspectRatio: '16 / 9' }}>
        {fonte.tipo === 'youtube' ? (
          <div ref={ytEl} className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" />
        ) : (
          <video
            ref={videoEl} src={fonte.url} playsInline preload="metadata" className="absolute inset-0 w-full h-full"
            onPlay={() => setTocando(true)} onPause={() => setTocando(false)} onClick={() => (tocando ? pausar() : tocar())}
          />
        )}
        {erroYT && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm" style={{ background: 'rgba(0,0,0,.8)' }}>
            Não deu pra abrir o vídeo do YouTube. Confira a internet e se o vídeo está público ou "não listado" (vídeo privado não abre).
          </div>
        )}
        <span className="absolute left-2 bottom-2 text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,.7)', color: '#fff' }}>
          {formatarTempo(atual)}{duracao ? ` / ${formatarTempo(duracao)}` : ''}
        </span>
        {velocidade !== 1 && (
          <span className="absolute right-2 bottom-2 text-xs font-black px-1.5 py-0.5 rounded" style={{ background: 'var(--rd-gold)', color: '#1a1300' }}>
            {String(velocidade).replace('.', ',')}×
          </span>
        )}
      </div>

      {/* Barra com os lances já marcados — toque pra pular pro ponto. */}
      <div
        className="relative h-7 mt-2 mx-1 cursor-pointer"
        onClick={(e) => {
          if (!duracao) return
          const r = e.currentTarget.getBoundingClientRect()
          irPara(((e.clientX - r.left) / r.width) * duracao)
        }}
      >
        <div className="absolute left-0 right-0 top-3 h-1 rounded" style={{ background: 'var(--rd-border)' }} />
        <div className="absolute left-0 top-3 h-1 rounded" style={{ background: 'var(--rd-gold)', width: duracao ? `${(atual / duracao) * 100}%` : 0 }} />
        {duracao > 0 && marcas.map((m, i) => (
          <div key={i} className="absolute top-1.5 w-1 h-3.5 rounded" style={{ left: `${(m.seg / duracao) * 100}%`, background: m.cor }} />
        ))}
        {duracao > 0 && <div className="absolute top-1 w-4 h-4 rounded-full bg-white" style={{ left: `calc(${(atual / duracao) * 100}% - 8px)` }} />}
      </div>

      <div className="grid grid-cols-4 gap-2 mt-1">
        <button className="rd-btn text-sm" onClick={() => irPara(tempo() - 5)}><Rewind size={16} /> 5s</button>
        <button className="rd-btn rd-btn-gold text-sm" onClick={() => (tocando ? pausar() : tocar())} aria-label={tocando ? 'Pausar' : 'Tocar'}>
          {tocando ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button className="rd-btn text-sm" onClick={() => irPara(tempo() + 5)}>5s <FastForward size={16} /></button>
        <button className="rd-btn text-sm" onClick={trocarVelocidade}>{String(velocidade).replace('.', ',')}×</button>
      </div>
    </div>
  )
}
