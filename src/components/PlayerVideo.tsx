// Player do vídeo do jogo (pedido 21/11/2026): link do YouTube ou arquivo do
// próprio aparelho, com os mesmos controles nos dois casos (voltar/avançar
// 5 s, play/pausa, câmera lenta) e uma barra com um risquinho em cada lance
// já marcado (verde = ponto nosso, vermelho = deles).
import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Play, Pause, Rewind, FastForward, ChevronLeft, ChevronRight, GripHorizontal, Maximize2, Minimize2, X } from 'lucide-react'
import { formatarTempo, acaoDaTecla, PASSO_QUADRO_SEG } from '../videoJogo'

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

// ---------- Janela flutuante (21/11/2026, só celular e tablet) ----------
// No scout pelo vídeo, ao descer até os botões de fundamento o vídeo sumia da
// tela. Com `flutuarAoRolar`, quando o player sai da tela ele vira uma janela
// pequena por cima, que dá pra arrastar, aumentar e fechar. Só em aparelho de
// toque (no computador a tela é grande e tem os atalhos de teclado).
const CHAVE_JANELA = 'rdsports_video_janela'
type Tamanho = 'p' | 'g'
interface JanelaSalva { x?: number; y?: number; tamanho?: Tamanho }
function lerJanela(): JanelaSalva {
  try { return JSON.parse(localStorage.getItem(CHAVE_JANELA) ?? '{}') as JanelaSalva } catch { return {} }
}
function salvarJanela(patch: JanelaSalva) {
  try { localStorage.setItem(CHAVE_JANELA, JSON.stringify({ ...lerJanela(), ...patch })) } catch { /* sem armazenamento: só não lembra */ }
}
function ehAparelhoDeToque(): boolean {
  try { return window.matchMedia('(pointer: coarse)').matches } catch { return false }
}
/** Largura da janela: pequena ~45% da tela (máx. 340 px), grande ~70% (máx. 560 px). */
export function larguraDaJanela(tamanho: Tamanho, larguraTela: number): number {
  return Math.round(tamanho === 'g' ? Math.min(larguraTela * 0.7, 560) : Math.min(larguraTela * 0.45, 340))
}
/** Mantém a janela inteira dentro da tela. */
export function prenderNaTela(x: number, y: number, largura: number, altura: number, telaL: number, telaA: number) {
  const m = 8
  return {
    x: Math.min(Math.max(m, x), Math.max(m, telaL - largura - m)),
    y: Math.min(Math.max(m, y), Math.max(m, telaA - altura - m)),
  }
}

export default function PlayerVideo({ fonte, marcas = [], ref, flutuarAoRolar = false }: { fonte: FonteVideo; marcas?: MarcaVideo[]; ref?: React.Ref<ControlePlayer>; flutuarAoRolar?: boolean }) {
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
  function definirVelocidade(v: number) {
    setVelocidade(v)
    if (fonte.tipo === 'youtube') { try { yt.current?.setPlaybackRate(v) } catch { /* ainda carregando */ } }
    else if (videoEl.current) videoEl.current.playbackRate = v
  }
  function trocarVelocidade() {
    definirVelocidade(VELOCIDADES[(VELOCIDADES.indexOf(velocidade) + 1) % VELOCIDADES.length])
  }
  /** Quadro a quadro (21/11/2026): pausa e anda ~1 quadro. No vídeo do
   *  aparelho é preciso; no YouTube o próprio YouTube arredonda, então anda
   *  um pouco mais (passo maior pra sempre mexer). */
  function quadro(direcao: 1 | -1) {
    pausar()
    const passo = fonte.tipo === 'youtube' ? 0.1 : PASSO_QUADRO_SEG
    irPara(tempo() + direcao * passo)
  }

  // Atalhos de teclado no computador (21/11/2026). Não atrapalham quem está
  // digitando (campo de texto, lista etc.) nem atalhos do navegador.
  const acoes = useRef({ tocarOuPausar: () => {}, irPara, tempo, quadro, definirVelocidade })
  useEffect(() => {
    acoes.current = { tocarOuPausar: () => (tocando ? pausar() : tocar()), irPara, tempo, quadro, definirVelocidade }
  })
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const alvo = e.target as HTMLElement | null
      if (alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))) return
      const acao = acaoDaTecla(e.key)
      if (!acao) return
      e.preventDefault()
      const a = acoes.current
      if (acao === 'tocar_pausar') a.tocarOuPausar()
      else if (acao === 'voltar') a.irPara(a.tempo() - 5)
      else if (acao === 'avancar') a.irPara(a.tempo() + 5)
      else if (acao === 'quadro_tras') a.quadro(-1)
      else if (acao === 'quadro_frente') a.quadro(1)
      else a.definirVelocidade(acao === 'velocidade_1' ? 1 : acao === 'velocidade_05' ? 0.5 : 0.25)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  useImperativeHandle(ref, () => ({ tempo, pausar, irPara }))

  // ----- Janela flutuante -----
  const ancora = useRef<HTMLDivElement>(null)
  const alturaAncora = useRef(0)
  const [foraDaTela, setForaDaTela] = useState(false)
  const [fechada, setFechada] = useState(false)
  const [tamanho, setTamanho] = useState<Tamanho>(() => lerJanela().tamanho ?? 'p')
  const [telaL, setTelaL] = useState(() => (typeof window === 'undefined' ? 375 : window.innerWidth))
  const [telaA, setTelaA] = useState(() => (typeof window === 'undefined' ? 700 : window.innerHeight))
  const podeFlutuar = flutuarAoRolar && ehAparelhoDeToque()
  const flutuando = podeFlutuar && foraDaTela && !fechada
  const larguraJanela = larguraDaJanela(tamanho, telaL)
  // Altura aproximada da janela (barra + vídeo 16:9 + botões), pra não sair da tela.
  const alturaJanela = 28 + larguraJanela * (9 / 16) + 44
  const salva = lerJanela()
  const [posBruta, setPosBruta] = useState(() => ({ x: salva.x ?? telaL - larguraJanela - 12, y: salva.y ?? 12 }))
  const pos = prenderNaTela(posBruta.x, posBruta.y, larguraJanela, alturaJanela, telaL, telaA)

  useEffect(() => {
    const aoRedimensionar = () => { setTelaL(window.innerWidth); setTelaA(window.innerHeight) }
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [])

  useEffect(() => {
    if (!podeFlutuar || !ancora.current || typeof IntersectionObserver === 'undefined') return
    const el = ancora.current
    const obs = new IntersectionObserver(([entrada]) => {
      // Guarda a altura do player no lugar dele, pra página não "pular"
      // quando ele vira janela.
      if (entrada.isIntersecting) { alturaAncora.current = el.offsetHeight; setFechada(false) }
      setForaDaTela(!entrada.isIntersecting)
    }, { threshold: 0 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [podeFlutuar])

  const arrasto = useRef<{ dx: number; dy: number } | null>(null)
  function comecarArrastar(e: React.PointerEvent<HTMLDivElement>) {
    arrasto.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function arrastar(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrasto.current) return
    setPosBruta({ x: e.clientX - arrasto.current.dx, y: e.clientY - arrasto.current.dy })
  }
  function soltar() {
    if (!arrasto.current) return
    arrasto.current = null
    salvarJanela({ x: pos.x, y: pos.y })
  }

  return (
    <div ref={ancora} style={flutuando ? { minHeight: alturaAncora.current } : undefined}>
    <div
      className={flutuando ? 'rd-video-flutuante' : undefined}
      style={flutuando ? { left: pos.x, top: pos.y, width: larguraJanela } : undefined}
    >
      {/* Barra da janela flutuante (21/11/2026 — só celular/tablet): arrastar,
          aumentar/diminuir e fechar. Sempre no mesmo lugar da árvore pra o
          vídeo do YouTube não recarregar quando a janela abre ou fecha. */}
      <div
        className={flutuando ? 'flex items-center gap-1 mb-1 select-none' : 'hidden'}
        style={{ touchAction: 'none' }}
        onPointerDown={comecarArrastar}
        onPointerMove={arrastar}
        onPointerUp={soltar}
        onPointerCancel={soltar}
      >
        <GripHorizontal size={16} className="text-[var(--rd-text-dim)] shrink-0" />
        <span className="text-[11px] text-[var(--rd-text-dim)] flex-1 truncate">Arraste pra mudar de lugar</span>
        <button className="rd-btn !p-1" onPointerDown={(e) => e.stopPropagation()} onClick={() => setTamanho((t) => { const n = t === 'p' ? 'g' : 'p'; salvarJanela({ tamanho: n }); return n })} aria-label={tamanho === 'p' ? 'Aumentar a janela do vídeo' : 'Diminuir a janela do vídeo'}>
          {tamanho === 'p' ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
        </button>
        <button className="rd-btn !p-1" onPointerDown={(e) => e.stopPropagation()} onClick={() => setFechada(true)} aria-label="Fechar a janela do vídeo (volta quando subir até o vídeo)">
          <X size={14} />
        </button>
      </div>
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
        className={flutuando ? 'hidden' : 'relative h-7 mt-2 mx-1 cursor-pointer'}
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

      <div className={`grid grid-cols-4 ${flutuando ? 'gap-1 mt-1' : 'gap-2 mt-1'}`}>
        <button className={`rd-btn ${flutuando ? 'text-xs !px-1 !py-1.5' : 'text-sm'}`} onClick={() => irPara(tempo() - 5)}><Rewind size={flutuando ? 14 : 16} /> 5s</button>
        <button className={`rd-btn rd-btn-gold ${flutuando ? 'text-xs !px-1 !py-1.5' : 'text-sm'}`} onClick={() => (tocando ? pausar() : tocar())} aria-label={tocando ? 'Pausar' : 'Tocar'}>
          {tocando ? <Pause size={flutuando ? 16 : 18} /> : <Play size={flutuando ? 16 : 18} />}
        </button>
        <button className={`rd-btn ${flutuando ? 'text-xs !px-1 !py-1.5' : 'text-sm'}`} onClick={() => irPara(tempo() + 5)}>5s <FastForward size={flutuando ? 14 : 16} /></button>
        <button className={`rd-btn ${flutuando ? 'text-xs !px-1 !py-1.5' : 'text-sm'}`} onClick={trocarVelocidade}>{String(velocidade).replace('.', ',')}×</button>
      </div>

      {/* Quadro a quadro: só aparece com o vídeo pausado, pra não ocupar
          espaço enquanto o jogo roda. */}
      {!tocando && duracao > 0 && (
        <div className={`grid grid-cols-2 ${flutuando ? 'gap-1 mt-1' : 'gap-2 mt-2'}`}>
          <button className={`rd-btn text-xs ${flutuando ? '!py-1' : ''}`} onClick={() => quadro(-1)} aria-label="Voltar um quadro"><ChevronLeft size={14} /> Quadro</button>
          <button className={`rd-btn text-xs ${flutuando ? '!py-1' : ''}`} onClick={() => quadro(1)} aria-label="Avançar um quadro">Quadro <ChevronRight size={14} /></button>
        </div>
      )}
    </div>
    </div>
  )
}
