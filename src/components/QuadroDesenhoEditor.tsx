// Editor de desenho estático de um quadro da ficha de treino (pedido
// 29/10/2026, Fase 2) — arrastar atletas (azul/amarelo/curinga), bola, cone,
// arco, escada e marcador de texto numa quadra, e desenhar setas de
// movimento/passe/ataque entre dois pontos. Sem animação (decisão do
// Henrique: desenho estático primeiro) — o resultado sai exatamente assim no
// HTML/PDF exportado (ver `treinoHtml.ts`).
import { useEffect, useRef, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import type { ElementoDesenho, ElementoDesenhoTipo, LinhaDesenho, LinhaDesenhoTipo, QuadroDesenho, QuadroDesenhoPasso } from '../types'
import { uid } from '../utils'

const FERRAMENTAS_ELEMENTO: { tipo: ElementoDesenhoTipo; label: string; cor: string }[] = [
  { tipo: 'atleta_azul', label: 'Azul', cor: '#2563eb' },
  { tipo: 'atleta_amarelo', label: 'Amarelo', cor: '#eab308' },
  { tipo: 'curinga', label: 'Curinga', cor: '#9ca3af' },
  { tipo: 'bola', label: 'Bola', cor: '#f97316' },
  { tipo: 'cone', label: 'Cone', cor: '#f97316' },
  { tipo: 'arco', label: 'Arco', cor: '#ec4899' },
  { tipo: 'escada', label: 'Escada', cor: '#8b5cf6' },
  { tipo: 'zona', label: 'Zona', cor: '#22c55e' },
  { tipo: 'texto', label: 'Texto', cor: '#f0f0f0' },
]

/** Tamanho padrão de uma Zona recém-criada, em % da quadra. */
const ZONA_LARGURA_PADRAO = 20
const ZONA_ALTURA_PADRAO = 15

const FERRAMENTAS_LINHA: { tipo: LinhaDesenhoTipo; label: string }[] = [
  { tipo: 'toque_passe', label: 'Toque/Passe' },
  { tipo: 'deslocar', label: 'Deslocar' },
  { tipo: 'saque_ataque', label: 'Saque/Ataque' },
]

/** Boneco visto de cima: ombros/mãos (bolinhas bege) + tronco (oval colorida)
 *  + cabeça (bolinha de pele com uma touca de cabelo castanha por cima),
 *  número em branco sobre o peito — mesmo estilo do app de referência. */
function BonecoSvg({ cor, numero }: { cor: string; numero?: string }) {
  return (
    <g>
      {/* sombra de contato */}
      <ellipse cx={0} cy={5.5} rx={7.5} ry={2} fill="#000" opacity={0.22} />
      {/* ombros/mãos */}
      <circle cx={-7.2} cy={-2.3} r={2.3} fill="#e8c39d" stroke="#16213f" strokeWidth={1} />
      <circle cx={7.2} cy={-2.3} r={2.3} fill="#e8c39d" stroke="#16213f" strokeWidth={1} />
      {/* tronco */}
      <ellipse cx={0} cy={2.6} rx={9} ry={6.6} fill={cor} stroke="#16213f" strokeWidth={1.2} />
      {/* cabeça (pele) */}
      <circle cx={0} cy={-6.6} r={3.4} fill="#e8c39d" stroke="#16213f" strokeWidth={1} />
      {/* cabelo por cima da cabeça */}
      <path d="M -3.4,-6.4 A 3.4,3.4 0 0 1 3.4,-6.4 Q 3.6,-2.6 0,-1.6 Q -3.6,-2.6 -3.4,-6.4 Z" fill="#4a2f1c" stroke="#16213f" strokeWidth={0.9} />
      {numero && <text x={0} y={5.2} fontSize={6.6} fontWeight={800} textAnchor="middle" fill="#fff" style={{ paintOrder: 'stroke' }} stroke="#00000055" strokeWidth={0.6}>{numero}</text>}
    </g>
  )
}

/** Jogador visto como círculo colorido com número (pedido 30/10/2026: "Boneco
 *  ou Círculo", igual no app de referência) — mais limpo quando a quadra tem
 *  muita gente, alternativa ao boneco de sempre. */
function CirculoJogadorSvg({ cor, numero }: { cor: string; numero?: string }) {
  return (
    <g>
      <ellipse cx={0} cy={6} rx={8} ry={2} fill="#000" opacity={0.2} />
      <circle cx={0} cy={0} r={9} fill={cor} stroke="#16213f" strokeWidth={1.3} />
      {numero && <text x={0} y={3.4} fontSize={8.5} fontWeight={800} textAnchor="middle" fill="#fff">{numero}</text>}
    </g>
  )
}

function BolaSvg() {
  return (
    <g>
      <ellipse cx={0} cy={3.6} rx={4.4} ry={1.3} fill="#000" opacity={0.2} />
      <circle cx={0} cy={0} r={4.8} fill="#fdfbf5" stroke="#16213f" strokeWidth={1.1} />
      <polygon points="0,-2.1 2,-0.65 1.25,1.7 -1.25,1.7 -2,-0.65" fill="#16213f" />
    </g>
  )
}

function ElementoSvg({ el, selecionado, estiloJogador = 'boneco' }: { el: ElementoDesenho; selecionado: boolean; estiloJogador?: 'boneco' | 'circulo' }) {
  if (el.tipo === 'zona') {
    const w = (el.largura ?? ZONA_LARGURA_PADRAO) * 3
    const h = (el.altura ?? ZONA_ALTURA_PADRAO) * 2
    return (
      <rect
        x={-w / 2} y={-h / 2} width={w} height={h} rx={4}
        fill="#22c55e26" stroke={selecionado ? '#d4af37' : '#22c55e'} strokeWidth={selecionado ? 2.6 : 2} strokeDasharray="6,4"
      />
    )
  }
  const anel = selecionado ? <circle cx={0} cy={-1} r={13.5} fill="none" stroke="#d4af37" strokeWidth={1.5} /> : null
  if (el.tipo === 'atleta_azul' || el.tipo === 'atleta_amarelo' || el.tipo === 'curinga') {
    const cor = el.tipo === 'atleta_azul' ? '#2563eb' : el.tipo === 'atleta_amarelo' ? '#eab308' : '#9ca3af'
    return <g>{anel}{estiloJogador === 'circulo' ? <CirculoJogadorSvg cor={cor} numero={el.numero} /> : <BonecoSvg cor={cor} numero={el.numero} />}</g>
  }
  if (el.tipo === 'bola') return <g>{anel}<BolaSvg /></g>
  if (el.tipo === 'cone') return <g>{anel}<polygon points="0,-7 6,6 -6,6" fill="#f97316" stroke="#000" strokeWidth={0.5} /></g>
  if (el.tipo === 'arco') return <g>{anel}<circle cx={0} cy={0} r={7} fill="none" stroke="#ec4899" strokeWidth={2.5} /></g>
  if (el.tipo === 'escada') return <g>{anel}<rect x={-9} y={-4} width={18} height={8} fill="none" stroke="#8b5cf6" strokeWidth={1.5} /></g>
  // texto
  return <g>{anel}<text x={0} y={3} fontSize={9} fontWeight={700} textAnchor="middle" fill="#f0f0f0">{el.texto || '?'}</text></g>
}

/** Logo da escola nos dois cantos da quadra (pedido 31/10/2026, fase 3 —
 *  "logo da escola na quadra", igual o escudo do clube no H10). Só nas
 *  vistas de cima (Planta/Preview/Animação), pra não complicar a projeção
 *  em trapézio da Perspectiva. */
function LogoNaQuadraSvg({ url }: { url?: string }) {
  if (!url) return null
  return (
    <>
      <image href={url} x={6} y={200 - 34} width={28} height={28} opacity={0.88} preserveAspectRatio="xMidYMid slice" />
      <image href={url} x={300 - 34} y={6} width={28} height={28} opacity={0.88} preserveAspectRatio="xMidYMid slice" />
    </>
  )
}

function corLinha(tipo: LinhaDesenhoTipo): string {
  return tipo === 'saque_ataque' ? '#e74c3c' : tipo === 'toque_passe' ? '#3498db' : '#d4af37'
}

/** Caminho SVG da linha — reta de sempre, ou curva quadrática quando a linha
 *  tem ponto de controle (`cx`/`cy`, pedido 30/10/2026: "traço curvo"). */
function pathDaLinha(linha: LinhaDesenho): string {
  const x1 = linha.x1 * 3, y1 = linha.y1 * 2, x2 = linha.x2 * 3, y2 = linha.y2 * 2
  if (linha.cx != null && linha.cy != null) {
    return `M ${x1},${y1} Q ${linha.cx * 3},${linha.cy * 2} ${x2},${y2}`
  }
  return `M ${x1},${y1} L ${x2},${y2}`
}

function LinhaSvg({ linha, markerId, selecionada, interativa, onSelecionar }: {
  linha: LinhaDesenho
  markerId: string
  selecionada?: boolean
  interativa?: boolean
  onSelecionar?: (id: string) => void
}) {
  const tracejado = linha.tipo === 'toque_passe' ? '3,2' : undefined
  const largura = linha.tipo === 'saque_ataque' ? 2.2 : 1.4
  const d = pathDaLinha(linha)
  return (
    <g>
      {interativa && (
        <path
          d={d} stroke="transparent" strokeWidth={14} fill="none" style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onSelecionar?.(linha.id) }}
        />
      )}
      <path
        d={d} fill="none"
        stroke={selecionada ? '#f4d873' : corLinha(linha.tipo)} strokeWidth={selecionada ? largura + 0.8 : largura}
        strokeDasharray={tracejado} markerEnd={`url(#${markerId})`}
      />
    </g>
  )
}

// --- Vista em Perspectiva (pedido 30/10/2026, câmeras extras 30/10/2026) --
// Mesma quadra e os mesmos elementos de sempre (x/y de 0 a 100, rede no meio
// em x=50), só que desenhados como se a câmera estivesse de pé olhando pra
// quadra: quadra em trapézio (mais largo perto, mais estreito longe) e os
// atletas "de pé" ao invés de vistos de cima. 3 ângulos fixos (sem girar):
// "De trás" (atrás da linha de fundo, olhando pra rede), "De frente" (atrás
// da quadra adversária, olhando de volta) e "Lateral" (do lado da rede,
// olhando o comprimento da quadra). Pra editar, continua sendo na Planta.
export type CameraPerspectiva = 'fundo' | 'frente' | 'lateral' | 'cima'

// "Lateral" removida da lista de botões (pedido 31/10/2026) — não ficou boa
// mesmo depois do ajuste; o tipo/lógica continuam existindo (câmera só não
// fica mais selecionável pela interface).
const CAMERAS_PERSPECTIVA: { id: CameraPerspectiva; label: string }[] = [
  { id: 'fundo', label: 'Fundo da quadra' },
  { id: 'cima', label: 'De cima' },
  { id: 'frente', label: 'Pelo ataque' },
]

const PERSP_FAR_Y = 35
const PERSP_NEAR_Y = 190
const PERSP_CENTER_X = 150
const PERSP_FAR_HALF_W = 55
const PERSP_NEAR_HALF_W = 135
const PERSP_SCALE_FAR = 0.32
const PERSP_SCALE_NEAR = 1.15
// pedido 31/10/2026: a câmera Lateral tava fechando demais perto da rede
// (virava um "X" apertado) — na referência (H10) as laterais ficam quase
// retas, só afinando um pouco perto da rede. Valor bem mais próximo da
// largura da borda (55 a 135) do que antes (30), pra suavizar o aperto.
const PERSP_NET_PINCH_W = 95

/** "Profundidade" (0=longe da câmera, 100=perto) de um ponto, de acordo com
 *  onde a câmera tá: "fundo" olha da linha de fundo própria pra rede (x
 *  cresce = mais perto); "frente" é o espelho, olhando da quadra adversária
 *  pra trás; "lateral" fica do lado da rede — aqui a profundidade continua
 *  sendo a distância até a linha de fundo própria (mesma inclinação geral da
 *  quadra na tela), mas a largura pinça perto da rede (ver projetarPerspectiva). */
function profundidade(xPct: number, camera: CameraPerspectiva): number {
  return camera === 'frente' ? 100 - xPct : xPct
}

function projetarPerspectiva(xPct: number, yPct: number, camera: CameraPerspectiva = 'fundo') {
  if (camera === 'cima') {
    // vista de cima (pedido 30/10/2026, 4ª câmera) — sem distorção em
    // trapézio, é o mapeamento direto da quadra (igual a Planta), só que
    // desenhada com o visual escuro/azulado da Perspectiva e os elementos
    // numa escala fixa e pequena, como se fosse vista de uma certa altura.
    return { x: xPct * 3, y: yPct * 2, scale: 0.6 }
  }
  const t = Math.max(0, Math.min(100, profundidade(xPct, camera))) / 100
  const y = PERSP_FAR_Y + t * (PERSP_NEAR_Y - PERSP_FAR_Y)
  const scale = PERSP_SCALE_FAR + t * (PERSP_SCALE_NEAR - PERSP_SCALE_FAR)
  const edgeHalfW = PERSP_FAR_HALF_W + t * (PERSP_NEAR_HALF_W - PERSP_FAR_HALF_W)

  let halfW: number
  let widthPct: number
  if (camera === 'lateral') {
    // vista de lado: a quadra "pincha" perto da rede (x perto de 50) e abre
    // pras duas linhas de fundo — visão em ampulheta, como quem tá de pé do
    // lado da rede olhando o comprimento todo da quadra. Usa raiz quadrada
    // em vez de interpolação reta: a largura cresce rápido saindo da rede,
    // então só quem tá bem em cima da rede fica espremido — o resto do
    // desenho (onde normalmente ficam os jogadores) tem espaço de sobra.
    const distDaRede = Math.sqrt(Math.abs(xPct - 50) / 50)
    halfW = PERSP_NET_PINCH_W + distDaRede * (edgeHalfW - PERSP_NET_PINCH_W)
    widthPct = yPct
  } else {
    halfW = edgeHalfW
    widthPct = yPct
  }

  const left = PERSP_CENTER_X - halfW
  const right = PERSP_CENTER_X + halfW
  const x = left + (Math.max(0, Math.min(100, widthPct)) / 100) * (right - left)
  return { x, y, scale }
}

function QuadraPerspectivaFundo({ camera }: { camera: CameraPerspectiva }) {
  const far = projetarPerspectiva(0, 0, camera)
  const farR = projetarPerspectiva(0, 100, camera)
  const near = projetarPerspectiva(100, 0, camera)
  const nearR = projetarPerspectiva(100, 100, camera)
  const linha1 = projetarPerspectiva(33.33, 0, camera)
  const linha1R = projetarPerspectiva(33.33, 100, camera)
  const linha2 = projetarPerspectiva(66.66, 0, camera)
  const linha2R = projetarPerspectiva(66.66, 100, camera)
  const netL = projetarPerspectiva(50, 0, camera)
  const netR = projetarPerspectiva(50, 100, camera)
  // cada poste tem sua própria altura na tela (escala pelo tamanho local) —
  // funciona tanto quando a rede fica deitada na tela (câmeras de trás/frente)
  // quanto em pé (câmera lateral, olhando o comprimento da quadra)
  const altL = 42 * netL.scale
  const altR = 42 * netR.scale
  const netLTopo = { x: netL.x, y: netL.y - altL }
  const netRTopo = { x: netR.x, y: netR.y - altR }
  const interp = (a: { x: number; y: number }, b: { x: number; y: number }, f: number) => ({ x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) })
  return (
    <g>
      {/* "paredes" do ginásio dos dois lados da quadra — da borda do desenho
         até a linha lateral da quadra, do topo até embaixo — dão a sensação
         de ambiente fechado (igual na referência), em vez da quadra flutuando
         sozinha num fundo liso. Mesma cor escura da Planta (pedido
         31/10/2026), não mais cinza-claro nem azul. */}
      <polygon points={`0,0 0,200 ${near.x},${near.y} ${netL.x},${netL.y} ${far.x},${far.y}`} fill="#141414" />
      <polygon points={`300,0 300,200 ${nearR.x},${nearR.y} ${netR.x},${netR.y} ${farR.x},${farR.y}`} fill="#141414" />
      {/* contorno em 6 pontos (passando pela rede) — nas câmeras de trás/
         frente isso cai bem em cima da borda reta de sempre. Mesma cor
         escura da Planta (pedido 31/10/2026), com o "R" discreto por cima
         (igual a Planta), antes das linhas de ataque/rede. */}
      <polygon
        points={`${far.x},${far.y} ${netL.x},${netL.y} ${near.x},${near.y} ${nearR.x},${nearR.y} ${netR.x},${netR.y} ${farR.x},${farR.y}`}
        fill="#141414" stroke="#ffffff" strokeWidth={1.8}
      />
      <text x={150} y={100} fontSize={92} fontWeight={900} textAnchor="middle" dominantBaseline="central" fill="#ffffff" fillOpacity={0.05}>R</text>
      <line x1={linha1.x} y1={linha1.y} x2={linha1R.x} y2={linha1R.y} stroke="#ffffff" strokeOpacity={0.75} strokeWidth={1.1} />
      <line x1={linha2.x} y1={linha2.y} x2={linha2R.x} y2={linha2R.y} stroke="#ffffff" strokeOpacity={0.75} strokeWidth={1.1} />
      {camera === 'lateral' ? (
        // câmera lateral olha a rede quase de perfil — na referência (H10) o
        // poste atravessa a imagem inteira de cima a baixo (pedido
        // 31/10/2026: "arrumar a rede"), não só uma alturinha de 42 — por
        // isso aqui, diferente das outras câmeras, vai do topo ao fundo do
        // quadro inteiro, na posição x onde a rede cai na tela.
        <line
          x1={interp(netL, netR, 0.5).x} y1={4}
          x2={interp(netL, netR, 0.5).x} y2={196}
          stroke="#e5e7eb" strokeWidth={2.4}
        />
      ) : (
        <>
          {/* poste + rede */}
          <line x1={netL.x} y1={netL.y} x2={netLTopo.x} y2={netLTopo.y} stroke="#d1d5db" strokeWidth={2.2} />
          <line x1={netR.x} y1={netR.y} x2={netRTopo.x} y2={netRTopo.y} stroke="#d1d5db" strokeWidth={2.2} />
          <path
            d={`M${netL.x},${netL.y} L${netR.x},${netR.y} L${netRTopo.x},${netRTopo.y} L${netLTopo.x},${netLTopo.y} Z`}
            fill="#e5e7eb" fillOpacity={0.12} stroke="none"
          />
          {Array.from({ length: 9 }).map((_, i) => {
            const f = (i + 1) / 10
            const p1 = interp(netL, netR, f)
            const p2 = interp(netLTopo, netRTopo, f)
            return <line key={`v${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#e5e7eb" strokeOpacity={0.5} strokeWidth={0.3} />
          })}
          {Array.from({ length: 4 }).map((_, i) => {
            const f = (i + 1) / 5
            const p1 = interp(netL, netLTopo, f)
            const p2 = interp(netR, netRTopo, f)
            return <line key={`h${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#e5e7eb" strokeOpacity={0.5} strokeWidth={0.3} />
          })}
          {/* fita branca no topo da rede, igual na referência */}
          <line x1={netLTopo.x} y1={netLTopo.y} x2={netRTopo.x} y2={netRTopo.y} stroke="#ffffff" strokeWidth={2} />
        </>
      )}
    </g>
  )
}

function BonecoDePeSvg({ cor, numero, scale }: { cor: string; numero?: string; scale: number }) {
  const s = scale
  return (
    <g>
      <ellipse cx={0} cy={2 * s} rx={9 * s} ry={2.2 * s} fill="#000" opacity={0.25} />
      <rect x={-4 * s} y={-12 * s} width={3 * s} height={12 * s} rx={1.4 * s} fill="#2b2b2b" />
      <rect x={1 * s} y={-12 * s} width={3 * s} height={12 * s} rx={1.4 * s} fill="#2b2b2b" />
      <rect x={-6 * s} y={-16 * s} width={12 * s} height={5 * s} rx={1.5 * s} fill="#16213f" />
      <rect x={-7 * s} y={-28 * s} width={14 * s} height={13 * s} rx={3 * s} fill={cor} stroke="#16213f" strokeWidth={1 * s} />
      {numero && <text x={0} y={-20 * s} fontSize={7 * s} fontWeight={800} textAnchor="middle" fill="#fff">{numero}</text>}
      <circle cx={0} cy={-32 * s} r={4.2 * s} fill="#e8c39d" stroke="#16213f" strokeWidth={0.9 * s} />
      <path
        d={`M ${-4.2 * s},${-31.8 * s} A ${4.2 * s},${4.2 * s} 0 0 1 ${4.2 * s},${-31.8 * s} Q ${4.4 * s},${-27.5 * s} 0,${-26.8 * s} Q ${-4.4 * s},${-27.5 * s} ${-4.2 * s},${-31.8 * s} Z`}
        fill="#4a2f1c" stroke="#16213f" strokeWidth={0.8 * s}
      />
    </g>
  )
}

function BolaDePeSvg({ scale }: { scale: number }) {
  const s = scale
  return (
    <g>
      <ellipse cx={0} cy={1.6 * s} rx={4 * s} ry={1.1 * s} fill="#000" opacity={0.2} />
      <circle cx={0} cy={-3 * s} r={4.4 * s} fill="#fdfbf5" stroke="#16213f" strokeWidth={1 * s} />
      <polygon points={`0,${-5 * s} ${1.8 * s},${-3.6 * s} ${1.1 * s},${-1.4 * s} ${-1.1 * s},${-1.4 * s} ${-1.8 * s},${-3.6 * s}`} fill="#16213f" />
    </g>
  )
}

function ElementoDePeSvg({ el, p, estiloJogador = 'boneco' }: { el: ElementoDesenho; p: { x: number; y: number; scale: number }; estiloJogador?: 'boneco' | 'circulo' }) {
  if (el.tipo === 'zona') {
    const w = (el.largura ?? ZONA_LARGURA_PADRAO) * 3 * p.scale
    const h = (el.altura ?? ZONA_ALTURA_PADRAO) * 2 * p.scale
    return (
      <g transform={`translate(${p.x}, ${p.y})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill="#22c55e26" stroke="#22c55e" strokeWidth={2} strokeDasharray="6,4" />
      </g>
    )
  }
  if (el.tipo === 'atleta_azul' || el.tipo === 'atleta_amarelo' || el.tipo === 'curinga') {
    const cor = el.tipo === 'atleta_azul' ? '#2563eb' : el.tipo === 'atleta_amarelo' ? '#eab308' : '#9ca3af'
    if (estiloJogador === 'circulo') {
      return <g transform={`translate(${p.x}, ${p.y}) scale(${p.scale})`}><CirculoJogadorSvg cor={cor} numero={el.numero} /></g>
    }
    return <g transform={`translate(${p.x}, ${p.y})`}><BonecoDePeSvg cor={cor} numero={el.numero} scale={p.scale} /></g>
  }
  if (el.tipo === 'bola') return <g transform={`translate(${p.x}, ${p.y})`}><BolaDePeSvg scale={p.scale} /></g>
  // cone/arco/escada/texto: marcador simples no chão, suficiente nesta vista
  return (
    <g transform={`translate(${p.x}, ${p.y}) scale(${p.scale})`}>
      <ellipse cx={0} cy={1} rx={6} ry={2} fill="#000" opacity={0.2} />
      {el.tipo === 'cone' && <polygon points="0,-9 5,1 -5,1" fill="#f97316" stroke="#000" strokeWidth={0.5} />}
      {el.tipo === 'arco' && <ellipse cx={0} cy={-2} rx={7} ry={3} fill="none" stroke="#ec4899" strokeWidth={2.2} />}
      {el.tipo === 'escada' && <rect x={-9} y={-4} width={18} height={4} fill="none" stroke="#8b5cf6" strokeWidth={1.5} />}
      {el.tipo === 'texto' && <text x={0} y={-2} fontSize={8} fontWeight={700} textAnchor="middle" fill="#f0f0f0">{el.texto || '?'}</text>}
    </g>
  )
}

/** Vista em perspectiva, só leitura — mostra o mesmo desenho da Planta com a
 *  quadra em trapézio e os atletas de pé, numa das 3 câmeras fixas. */
export function QuadroDesenhoPerspectiva({ desenho, camera = 'fundo' }: { desenho: QuadroDesenho; camera?: CameraPerspectiva }) {
  // desenha do mais longe pro mais perto, senão quem tá na frente fica atrás
  const elementosOrdenados = [...desenho.elementos].sort(
    (a, b) => profundidade(a.x, camera) - profundidade(b.x, camera)
  )
  const estiloJogador = desenho.estiloJogador ?? 'boneco'
  return (
    <svg viewBox="0 0 300 200" style={{ width: '100%', aspectRatio: '3/2', background: '#0c1430', borderRadius: 4 }}>
      <defs>
        <marker id="persp-seta-toque_passe" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={corLinha('toque_passe')} /></marker>
        <marker id="persp-seta-deslocar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={corLinha('deslocar')} /></marker>
        <marker id="persp-seta-saque_ataque" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill={corLinha('saque_ataque')} /></marker>
      </defs>
      <rect x={0} y={0} width={300} height={200} fill="#0c1430" />
      <QuadraPerspectivaFundo camera={camera} />
      {desenho.linhas.map((l) => {
        const p1 = projetarPerspectiva(l.x1, l.y1, camera)
        const p2 = projetarPerspectiva(l.x2, l.y2, camera)
        const tracejado = l.tipo === 'toque_passe' ? '3,2' : undefined
        const largura = (l.tipo === 'saque_ataque' ? 2.2 : 1.4) * ((p1.scale + p2.scale) / 2)
        const d = l.cx != null && l.cy != null
          ? (() => { const c = projetarPerspectiva(l.cx!, l.cy!, camera); return `M ${p1.x},${p1.y} Q ${c.x},${c.y} ${p2.x},${p2.y}` })()
          : `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`
        return (
          <path
            key={l.id} d={d} fill="none"
            stroke={corLinha(l.tipo)} strokeWidth={largura} strokeDasharray={tracejado} markerEnd={`url(#persp-seta-${l.tipo})`}
          />
        )
      })}
      {elementosOrdenados.map((el) => (
        <ElementoDePeSvg key={el.id} el={el} p={projetarPerspectiva(el.x, el.y, camera)} estiloJogador={estiloJogador} />
      ))}
    </svg>
  )
}

/** Prévia pequena e não-interativa de um desenho já salvo — usada no card do
 *  quadro (lista de quadros) e também reaproveitável pro HTML/PDF exportado. */
export function QuadroDesenhoPreview({ desenho, logoEscolaUrl }: { desenho: QuadroDesenho; logoEscolaUrl?: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox="0 0 300 200" style={{ width: '100%', aspectRatio: '3/2', background: '#141414', border: '1px solid #2a2a2a', borderRadius: 4 }}>
        <defs>
          <marker id="pv-seta-toque_passe" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={corLinha('toque_passe')} /></marker>
          <marker id="pv-seta-deslocar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={corLinha('deslocar')} /></marker>
          <marker id="pv-seta-saque_ataque" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill={corLinha('saque_ataque')} /></marker>
        </defs>
        <line x1={100} y1={0} x2={100} y2={200} stroke="#2a2a2a" strokeWidth={1} />
        <line x1={200} y1={0} x2={200} y2={200} stroke="#2a2a2a" strokeWidth={1} />
        <line x1={150} y1={0} x2={150} y2={200} stroke="#3a3a3a" strokeWidth={1} strokeDasharray="4,3" />
        <LogoNaQuadraSvg url={logoEscolaUrl} />
        {desenho.linhas.map((l) => <LinhaSvg key={l.id} linha={l} markerId={`pv-seta-${l.tipo}`} />)}
        {desenho.elementos.map((el) => (
          <g key={el.id} transform={`translate(${el.x * 3}, ${el.y * 2})`}><ElementoSvg el={el} selecionado={false} estiloJogador={desenho.estiloJogador} /></g>
        ))}
      </svg>
      {/* indicador de animação por quadros (pedido 31/10/2026, fase 2) — essa
         prévia mostra só o 1º passo, esse selo avisa que tem mais */}
      {desenho.passos && desenho.passos.length > 1 && (
        <span
          style={{ position: 'absolute', top: 4, right: 4, fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 999, background: 'var(--rd-gold)', color: '#1a1300' }}
        >
          ▶ {desenho.passos.length} quadros
        </span>
      )}
    </div>
  )
}

const MEIAS_QUADRA: { id: 'inteira' | 'ataque' | 'defesa'; label: string }[] = [
  { id: 'inteira', label: 'Inteiro' },
  { id: 'ataque', label: '½ Ataque' },
  { id: 'defesa', label: '½ Defesa' },
]

/** Faixa do viewBox (em unidades de 0 a 300, igual o resto do editor) que
 *  cada opção de meia-quadra mostra — "Ataque" é a metade mais perto da rede
 *  do lado direito do desenho, "Defesa" a metade esquerda (pedido
 *  30/10/2026). Os elementos continuam salvos em % da quadra inteira, só o
 *  enquadramento/zoom muda. */
const FAIXA_MEIA_QUADRA: Record<'inteira' | 'ataque' | 'defesa', { x: number; w: number }> = {
  inteira: { x: 0, w: 300 },
  ataque: { x: 150, w: 150 },
  defesa: { x: 0, w: 150 },
}

const DURACAO_PASSO_MS = 1100

/** Reprodução animada de uma sequência de quadros (pedido 31/10/2026, fase 2
 *  — "animação por quadros"). Interpola a posição de cada elemento (casando
 *  pelo `id`) entre o passo atual e o próximo, trocando as setas e a legenda
 *  na metade do caminho — simples e leve (sem depender de nenhuma
 *  biblioteca de animação), mas dá pra ver a jogada se movendo de verdade. */
export function QuadroDesenhoAnimado({ passos, estiloJogador = 'boneco', velocidade = 1, repetir = false, vista = 'planta', camera = 'fundo', logoEscolaUrl }: {
  passos: QuadroDesenhoPasso[]
  estiloJogador?: 'boneco' | 'circulo'
  velocidade?: number
  repetir?: boolean
  vista?: 'planta' | 'perspectiva'
  camera?: CameraPerspectiva
  logoEscolaUrl?: string
}) {
  const [progresso, setProgresso] = useState({ indice: 0, t: 0 })
  const rafRef = useRef<number | null>(null)
  const inicioRef = useRef<number | null>(null)

  useEffect(() => {
    inicioRef.current = null
    const ultimo = passos.length - 1
    const duracaoPasso = DURACAO_PASSO_MS / velocidade

    function tick(agora: number) {
      if (inicioRef.current == null) inicioRef.current = agora
      if (ultimo <= 0) { setProgresso({ indice: 0, t: 0 }); return }
      let decorrido = agora - inicioRef.current
      const duracaoTotal = duracaoPasso * ultimo
      if (decorrido >= duracaoTotal) {
        if (repetir) {
          decorrido = decorrido % duracaoTotal
          inicioRef.current = agora - decorrido
        } else {
          setProgresso({ indice: ultimo, t: 0 })
          return
        }
      }
      const indice = Math.min(ultimo - 1, Math.floor(decorrido / duracaoPasso))
      const t = (decorrido - indice * duracaoPasso) / duracaoPasso
      setProgresso({ indice, t })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }
  }, [passos, velocidade, repetir])

  const passoA = passos[progresso.indice]
  const passoB = passos[Math.min(progresso.indice + 1, passos.length - 1)]
  const t = passoA === passoB ? 0 : progresso.t

  const elementosInterp: ElementoDesenho[] = passoA.elementos.map((elA) => {
    const elB = passoB.elementos.find((e) => e.id === elA.id)
    if (!elB) return elA
    return { ...elA, x: elA.x + (elB.x - elA.x) * t, y: elA.y + (elB.y - elA.y) * t }
  })
  const linhasAtuais = t < 0.5 ? passoA.linhas : passoB.linhas
  const legendaAtual = t < 0.5 ? passoA.legenda : passoB.legenda

  if (vista === 'perspectiva') {
    // mesma interpolação de cima, só desenhada em perspectiva (pedido
    // 31/10/2026: "animar também na perspectiva") — reaproveita a mesma
    // projeção/câmera da vista Perspectiva de sempre.
    const elementosOrdenados = [...elementosInterp].sort(
      (a, b) => profundidade(a.x, camera) - profundidade(b.x, camera)
    )
    return (
      <div>
        <svg viewBox="0 0 300 200" style={{ width: '100%', aspectRatio: '3/2', background: '#141414', borderRadius: 4 }}>
          <defs>
            <marker id="anim-persp-seta-toque_passe" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={corLinha('toque_passe')} /></marker>
            <marker id="anim-persp-seta-deslocar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={corLinha('deslocar')} /></marker>
            <marker id="anim-persp-seta-saque_ataque" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill={corLinha('saque_ataque')} /></marker>
          </defs>
          <rect x={0} y={0} width={300} height={200} fill="#141414" />
          <QuadraPerspectivaFundo camera={camera} />
          {linhasAtuais.map((l) => {
            const p1 = projetarPerspectiva(l.x1, l.y1, camera)
            const p2 = projetarPerspectiva(l.x2, l.y2, camera)
            const tracejado = l.tipo === 'toque_passe' ? '3,2' : undefined
            const largura = (l.tipo === 'saque_ataque' ? 2.2 : 1.4) * ((p1.scale + p2.scale) / 2)
            const d = l.cx != null && l.cy != null
              ? (() => { const c = projetarPerspectiva(l.cx!, l.cy!, camera); return `M ${p1.x},${p1.y} Q ${c.x},${c.y} ${p2.x},${p2.y}` })()
              : `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`
            return (
              <path
                key={l.id} d={d} fill="none"
                stroke={corLinha(l.tipo)} strokeWidth={largura} strokeDasharray={tracejado} markerEnd={`url(#anim-persp-seta-${l.tipo})`}
              />
            )
          })}
          {elementosOrdenados.map((el) => (
            <ElementoDePeSvg key={el.id} el={el} p={projetarPerspectiva(el.x, el.y, camera)} estiloJogador={estiloJogador} />
          ))}
        </svg>
        <div className="text-center text-[11px] text-[var(--rd-text-dim)] mt-1 min-h-[14px]">{legendaAtual}</div>
      </div>
    )
  }

  return (
    <div>
      <svg viewBox="0 0 300 200" style={{ width: '100%', aspectRatio: '3/2', background: '#141414', border: '1.5px solid #3a3a3a', borderRadius: 6 }}>
        <defs>
          <marker id="anim-seta-toque_passe" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={corLinha('toque_passe')} /></marker>
          <marker id="anim-seta-deslocar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={corLinha('deslocar')} /></marker>
          <marker id="anim-seta-saque_ataque" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill={corLinha('saque_ataque')} /></marker>
        </defs>
        <text x={150} y={100} fontSize={92} fontWeight={900} textAnchor="middle" dominantBaseline="central" fill="#ffffff" fillOpacity={0.05}>R</text>
        <rect x={1} y={1} width={298} height={198} fill="none" stroke="#ffffff" strokeOpacity={0.3} strokeWidth={2} />
        <line x1={100} y1={0} x2={100} y2={200} stroke="#ffffff" strokeOpacity={0.22} strokeWidth={1.2} />
        <line x1={200} y1={0} x2={200} y2={200} stroke="#ffffff" strokeOpacity={0.22} strokeWidth={1.2} />
        <line x1={150} y1={0} x2={150} y2={200} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4,3" />
        <LogoNaQuadraSvg url={logoEscolaUrl} />
        {linhasAtuais.map((l) => <LinhaSvg key={l.id} linha={l} markerId={`anim-seta-${l.tipo}`} />)}
        {elementosInterp.map((el) => (
          <g key={el.id} transform={`translate(${el.x * 3}, ${el.y * 2})`}>
            <ElementoSvg el={el} selecionado={false} estiloJogador={estiloJogador} />
          </g>
        ))}
      </svg>
      <div className="text-center text-[11px] text-[var(--rd-text-dim)] mt-1 min-h-[14px]">{legendaAtual}</div>
    </div>
  )
}

export function QuadroDesenhoEditor({ titulo, desenhoInicial, onSalvar, onFechar, logoEscolaUrl, desenhosDisponiveis }: {
  titulo: string
  desenhoInicial?: QuadroDesenho
  onSalvar: (desenho: QuadroDesenho) => void
  onFechar: () => void
  /** Logo da escola (pedido 31/10/2026, fase 3) — mostrado nos cantos da
   *  quadra, como o escudo do clube no H10. */
  logoEscolaUrl?: string
  /** Outros quadros já desenhados na mesma sessão (pedido 31/10/2026, fase
   *  3: "copiar desenho entre quadros") — pra oferecer "Copiar desenho
   *  de..." em vez de redesenhar do zero quando dois quadros são parecidos. */
  desenhosDisponiveis?: { label: string; desenho: QuadroDesenho }[]
}) {
  // Sequência de passos (pedido 31/10/2026, fase 2: "animação por quadros")
  // — um desenho estático de sempre é só uma sequência de 1 passo só.
  // `elementos`/`linhas` abaixo são sempre derivados do passo ATUAL (igual
  // antes), então todo o resto do editor (arrastar, selecionar, desenhar
  // seta etc.) continua funcionando sem precisar saber de passos.
  const [passos, setPassos] = useState<QuadroDesenhoPasso[]>(
    desenhoInicial?.passos && desenhoInicial.passos.length > 0
      ? desenhoInicial.passos
      : [{ id: uid(), elementos: desenhoInicial?.elementos ?? [], linhas: desenhoInicial?.linhas ?? [] }]
  )
  const [passoAtual, setPassoAtual] = useState(0)
  const [velocidade, setVelocidade] = useState<0.5 | 1 | 2>(desenhoInicial?.velocidade ?? 1)
  const [repetir, setRepetir] = useState(desenhoInicial?.repetir ?? false)
  const [animando, setAnimando] = useState(false)

  const elementos = passos[passoAtual].elementos
  const linhas = passos[passoAtual].linhas
  function setElementos(atualizar: ElementoDesenho[] | ((prev: ElementoDesenho[]) => ElementoDesenho[])) {
    setPassos((ps) => ps.map((p, i) => (i === passoAtual ? { ...p, elementos: typeof atualizar === 'function' ? (atualizar as (prev: ElementoDesenho[]) => ElementoDesenho[])(p.elementos) : atualizar } : p)))
  }
  function setLinhas(atualizar: LinhaDesenho[] | ((prev: LinhaDesenho[]) => LinhaDesenho[])) {
    setPassos((ps) => ps.map((p, i) => (i === passoAtual ? { ...p, linhas: typeof atualizar === 'function' ? (atualizar as (prev: LinhaDesenho[]) => LinhaDesenho[])(p.linhas) : atualizar } : p)))
  }

  function irParaPasso(i: number) {
    setPassoAtual(i)
    setSelecionadoId(null)
    setLinhaSelecionadaId(null)
    setLinhaInicio(null)
  }
  function adicionarQuadro() {
    const base = passos[passos.length - 1]
    const novo: QuadroDesenhoPasso = { id: uid(), elementos: base.elementos.map((e) => ({ ...e })), linhas: base.linhas.map((l) => ({ ...l })) }
    const novoIndice = passos.length
    setPassos((ps) => [...ps, novo])
    irParaPasso(novoIndice)
  }
  function duplicarQuadroAtual() {
    const atual = passos[passoAtual]
    const copia: QuadroDesenhoPasso = { id: uid(), elementos: atual.elementos.map((e) => ({ ...e })), linhas: atual.linhas.map((l) => ({ ...l })), legenda: atual.legenda }
    const novoIndice = passoAtual + 1
    setPassos((ps) => [...ps.slice(0, novoIndice), copia, ...ps.slice(novoIndice)])
    irParaPasso(novoIndice)
  }
  function removerQuadroAtual() {
    if (passos.length <= 1) return
    const novoIndice = Math.max(0, passoAtual - 1)
    setPassos((ps) => ps.filter((_, i) => i !== passoAtual))
    irParaPasso(novoIndice)
  }
  const [estiloJogador, setEstiloJogador] = useState<'boneco' | 'circulo'>(desenhoInicial?.estiloJogador ?? 'boneco')
  const [meiaQuadra, setMeiaQuadra] = useState<'inteira' | 'ataque' | 'defesa'>(desenhoInicial?.meiaQuadra ?? 'inteira')
  const [copiarAberto, setCopiarAberto] = useState(false)

  /** Copia o desenho inteiro de outro quadro da mesma sessão (pedido
   *  31/10/2026, fase 3: "copiar desenho entre quadros") — refaz os ids de
   *  elementos/linhas/passos (nunca reaproveita os do quadro de origem, pra
   *  não confundir seleção/edição de um com o outro). Pergunta antes de
   *  substituir se o quadro atual já tinha algo desenhado. */
  function copiarDesenho(origem: QuadroDesenho) {
    const jaTemAlgo = passos.some((p) => p.elementos.length > 0 || p.linhas.length > 0)
    if (jaTemAlgo && !window.confirm('Isso substitui o desenho atual deste quadro. Continuar?')) return
    const passosOrigem = origem.passos && origem.passos.length > 0
      ? origem.passos
      : [{ id: uid(), elementos: origem.elementos, linhas: origem.linhas, legenda: undefined }]
    const novosPassos: QuadroDesenhoPasso[] = passosOrigem.map((p) => ({
      id: uid(),
      elementos: p.elementos.map((e) => ({ ...e, id: uid() })),
      linhas: p.linhas.map((l) => ({ ...l, id: uid() })),
      legenda: p.legenda,
    }))
    setPassos(novosPassos)
    setPassoAtual(0)
    setEstiloJogador(origem.estiloJogador ?? 'boneco')
    setMeiaQuadra(origem.meiaQuadra ?? 'inteira')
    setVelocidade(origem.velocidade ?? 1)
    setRepetir(origem.repetir ?? false)
    setSelecionadoId(null)
    setLinhaSelecionadaId(null)
    setLinhaInicio(null)
    setAnimando(false)
    setCopiarAberto(false)
  }

  const [vista, setVista] = useState<'planta' | 'perspectiva'>('planta')
  const [camera, setCamera] = useState<CameraPerspectiva>('fundo')
  const [ferramenta, setFerramenta] = useState<ElementoDesenhoTipo | LinhaDesenhoTipo | 'mover' | 'apagar'>('mover')
  const [linhaInicio, setLinhaInicio] = useState<{ x: number; y: number } | null>(null)
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [linhaSelecionadaId, setLinhaSelecionadaId] = useState<string | null>(null)
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const [arrastandoControleDe, setArrastandoControleDe] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const elTipos: ElementoDesenhoTipo[] = FERRAMENTAS_ELEMENTO.map((f) => f.tipo)
  const linhaTipos: LinhaDesenhoTipo[] = FERRAMENTAS_LINHA.map((f) => f.tipo)

  function pontoDoEvento(e: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const faixa = FAIXA_MEIA_QUADRA[meiaQuadra]
    const xSvg = ((e.clientX - rect.left) / rect.width) * faixa.w + faixa.x
    const ySvg = ((e.clientY - rect.top) / rect.height) * 200
    const x = xSvg / 3
    const y = ySvg / 2
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }

  function cliqueNaQuadra(e: React.MouseEvent) {
    if (arrastandoId || arrastandoControleDe) return
    const p = pontoDoEvento(e)
    if (!p) return

    if ((elTipos as string[]).includes(ferramenta)) {
      let texto: string | undefined
      if (ferramenta === 'texto') {
        texto = window.prompt('Texto do marcador:') ?? ''
        if (!texto) return
      }
      const novo: ElementoDesenho = {
        id: uid(), tipo: ferramenta as ElementoDesenhoTipo, x: p.x, y: p.y, texto,
        ...(ferramenta === 'zona' ? { largura: ZONA_LARGURA_PADRAO, altura: ZONA_ALTURA_PADRAO } : {}),
      }
      setElementos((ls) => [...ls, novo])
      setSelecionadoId(novo.id)
      return
    }

    if ((linhaTipos as string[]).includes(ferramenta)) {
      if (!linhaInicio) {
        setLinhaInicio(p)
      } else {
        const nova: LinhaDesenho = { id: uid(), tipo: ferramenta as LinhaDesenhoTipo, x1: linhaInicio.x, y1: linhaInicio.y, x2: p.x, y2: p.y }
        setLinhas((ls) => [...ls, nova])
        setLinhaInicio(null)
        setLinhaSelecionadaId(nova.id)
      }
      return
    }

    setSelecionadoId(null)
    setLinhaSelecionadaId(null)
  }

  function cliqueNoElemento(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (ferramenta === 'apagar') {
      setElementos((ls) => ls.filter((el) => el.id !== id))
      if (selecionadoId === id) setSelecionadoId(null)
      return
    }
    setSelecionadoId(id)
    setLinhaSelecionadaId(null)
  }

  function cliqueNaLinha(id: string) {
    if (ferramenta === 'apagar') {
      setLinhas((ls) => ls.filter((l) => l.id !== id))
      if (linhaSelecionadaId === id) setLinhaSelecionadaId(null)
      return
    }
    setLinhaSelecionadaId(id)
    setSelecionadoId(null)
  }

  function iniciarArrasto(e: React.PointerEvent, id: string) {
    if (ferramenta === 'apagar') return
    e.stopPropagation()
    setArrastandoId(id)
    setSelecionadoId(id)
    setLinhaSelecionadaId(null)
  }

  function iniciarArrastoControle(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    setArrastandoControleDe(id)
  }

  useEffect(() => {
    if (!arrastandoId) return
    function mover(e: PointerEvent) {
      const p = pontoDoEvento(e)
      if (!p) return
      setElementos((ls) => ls.map((el) => (el.id === arrastandoId ? { ...el, x: p.x, y: p.y } : el)))
    }
    function soltar() { setArrastandoId(null) }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastandoId, meiaQuadra])

  useEffect(() => {
    if (!arrastandoControleDe) return
    function mover(e: PointerEvent) {
      const p = pontoDoEvento(e)
      if (!p) return
      setLinhas((ls) => ls.map((l) => (l.id === arrastandoControleDe ? { ...l, cx: p.x, cy: p.y } : l)))
    }
    function soltar() { setArrastandoControleDe(null) }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastandoControleDe, meiaQuadra])

  const selecionado = elementos.find((el) => el.id === selecionadoId)
  const linhaSelecionada = linhas.find((l) => l.id === linhaSelecionadaId)
  const faixaAtual = FAIXA_MEIA_QUADRA[meiaQuadra]

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-3" onClick={onFechar}>
      <div className="bg-[var(--rd-surface)] rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-sm">{titulo}</div>
          <button className="rd-btn !p-2" onClick={onFechar}><X size={16} /></button>
        </div>

        {desenhosDisponiveis && desenhosDisponiveis.length > 0 && (
          <div className="relative mb-2">
            <button className="text-xs font-semibold px-3 py-1.5 rounded-full border border-[var(--rd-border)]" onClick={() => setCopiarAberto((a) => !a)}>
              Copiar desenho de...
            </button>
            {copiarAberto && (
              <div className="absolute z-10 mt-1 w-64 max-h-48 overflow-y-auto rounded-lg border bg-[var(--rd-surface)] shadow-lg" style={{ borderColor: 'var(--rd-border)' }}>
                {desenhosDisponiveis.map((d, i) => (
                  <button
                    key={i}
                    className="block w-full text-left text-xs px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10"
                    onClick={() => copiarDesenho(d.desenho)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mb-2">
          <button className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${ferramenta === 'mover' ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)]'}`} onClick={() => { setFerramenta('mover'); setLinhaInicio(null) }}>Mover</button>
          {FERRAMENTAS_ELEMENTO.map((f) => (
            <button key={f.tipo} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${ferramenta === f.tipo ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)]'}`} onClick={() => { setFerramenta(f.tipo); setLinhaInicio(null) }}>
              <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: f.cor }} />{f.label}
            </button>
          ))}
          <button className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${ferramenta === 'apagar' ? 'bg-[var(--rd-danger)] border-[var(--rd-danger)] text-white' : 'border-[var(--rd-border)]'}`} onClick={() => { setFerramenta('apagar'); setLinhaInicio(null) }}><Trash2 size={12} className="inline mr-1" />Apagar</button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {FERRAMENTAS_LINHA.map((f) => (
            <button key={f.tipo} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${ferramenta === f.tipo ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)]'}`} onClick={() => { setFerramenta(f.tipo); setLinhaInicio(null) }}>{f.label}</button>
          ))}
          {linhas.length > 0 && (
            <button className="text-xs font-semibold px-3 py-1.5 rounded-full border border-[var(--rd-border)]" onClick={() => { setLinhas((ls) => ls.slice(0, -1)); setLinhaSelecionadaId(null) }}>Desfazer última seta</button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <button className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${vista === 'planta' ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)]'}`} onClick={() => setVista('planta')}>Planta</button>
          <button className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${vista === 'perspectiva' ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)]'}`} onClick={() => setVista('perspectiva')}>Perspectiva</button>
          <span className="w-px h-4 bg-[var(--rd-border)] mx-0.5" />
          {MEIAS_QUADRA.map((m) => (
            <button key={m.id} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${meiaQuadra === m.id ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)]'}`} onClick={() => setMeiaQuadra(m.id)}>{m.label}</button>
          ))}
          <span className="w-px h-4 bg-[var(--rd-border)] mx-0.5" />
          <button className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${estiloJogador === 'boneco' ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)]'}`} onClick={() => setEstiloJogador('boneco')}>Boneco</button>
          <button className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${estiloJogador === 'circulo' ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)]'}`} onClick={() => setEstiloJogador('circulo')}>Círculo</button>
        </div>

        {/* Quadros/animação (pedido 31/10/2026, fase 2) — fica fora do
           "if vista === planta" de propósito: dá pra animar olhando tanto a
           Planta quanto a Perspectiva parada num passo específico. */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2 p-2 rounded-xl bg-black/20 border border-[var(--rd-border)]">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--rd-text-dim)] mr-0.5">Quadros</span>
          {passos.map((p, i) => (
            <button
              key={p.id}
              className={`text-xs font-bold w-7 h-7 rounded-full border ${passoAtual === i ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)]'}`}
              onClick={() => { setAnimando(false); irParaPasso(i) }}
            >
              {i + 1}
            </button>
          ))}
          <button className="text-xs font-semibold px-3 py-1.5 rounded-full border border-[var(--rd-border)]" onClick={() => { setAnimando(false); adicionarQuadro() }}>+ Quadro</button>
          <button className="text-xs font-semibold px-3 py-1.5 rounded-full border border-[var(--rd-border)]" onClick={() => { setAnimando(false); duplicarQuadroAtual() }}>Duplicar</button>
          {passos.length > 1 && (
            <button className="rd-btn !p-1.5 rd-btn-danger" onClick={() => { setAnimando(false); removerQuadroAtual() }} title="Apagar este quadro"><Trash2 size={13} /></button>
          )}
          {passos.length > 1 && (
            <>
              <span className="w-px h-4 bg-[var(--rd-border)] mx-0.5" />
              {[0.5, 1, 2].map((v) => (
                <button
                  key={v}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border ${velocidade === v ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)]'}`}
                  onClick={() => setVelocidade(v as 0.5 | 1 | 2)}
                >
                  {v}x
                </button>
              ))}
              <button className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${repetir ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)]'}`} onClick={() => setRepetir((r) => !r)}>Repetir</button>
              <button className={`text-xs font-bold px-3 py-1.5 rounded-full border ${animando ? 'bg-[var(--rd-danger)] border-[var(--rd-danger)] text-white' : 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]'}`} onClick={() => setAnimando((a) => !a)}>
                {animando ? 'Parar' : 'Animar'}
              </button>
            </>
          )}
          <div className="w-full flex items-center gap-2 mt-1">
            <span className="text-[11px] text-[var(--rd-text-dim)] shrink-0">Legenda do quadro {passoAtual + 1}:</span>
            <input
              className="rd-input text-xs flex-1" placeholder="ex.: Passe e corte"
              value={passos[passoAtual].legenda ?? ''}
              onChange={(e) => setPassos((ps) => ps.map((p, i) => (i === passoAtual ? { ...p, legenda: e.target.value } : p)))}
            />
          </div>
        </div>

        {vista === 'perspectiva' && (
          <div className="flex gap-1.5 mb-2">
            {CAMERAS_PERSPECTIVA.map((c) => (
              <button
                key={c.id}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${camera === c.id ? 'bg-[var(--rd-gold)] border-[var(--rd-gold)] text-[#1a1300]' : 'border-[var(--rd-border)]'}`}
                onClick={() => setCamera(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {animando ? (
          <QuadroDesenhoAnimado passos={passos} estiloJogador={estiloJogador} velocidade={velocidade} repetir={repetir} vista={vista} camera={camera} />
        ) : vista === 'planta' ? (
          <>
            <p className="text-[11px] text-[var(--rd-text-dim)] mb-2">
              {(elTipos as string[]).includes(ferramenta) && 'Toque na quadra pra colocar.'}
              {(linhaTipos as string[]).includes(ferramenta) && (linhaInicio ? 'Agora toque no ponto de chegada.' : 'Toque no ponto de partida da seta.')}
              {ferramenta === 'mover' && !linhaSelecionada && 'Arraste qualquer peça pra reposicionar. Toque numa peça ou seta pra selecionar.'}
              {ferramenta === 'mover' && linhaSelecionada && 'Arraste o pontinho verde pra curvar a seta.'}
              {ferramenta === 'apagar' && 'Toque numa peça ou seta pra apagar.'}
            </p>

            <svg
              ref={svgRef} viewBox={`${faixaAtual.x} 0 ${faixaAtual.w} 200`} onClick={cliqueNaQuadra}
              style={{ width: '100%', aspectRatio: '3/2', background: '#141414', border: '1.5px solid #3a3a3a', borderRadius: 6, cursor: ferramenta === 'mover' ? 'default' : 'crosshair', touchAction: 'none' }}
            >
              <defs>
                <marker id="seta-toque_passe" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={corLinha('toque_passe')} /></marker>
                <marker id="seta-deslocar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={corLinha('deslocar')} /></marker>
                <marker id="seta-saque_ataque" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill={corLinha('saque_ataque')} /></marker>
              </defs>
              {/* "Paredes"/linhas da quadra (pedido 30/10/2026: fundo continua
                 cinza, mas com as linhas da quadra visíveis igual na
                 Perspectiva) — contorno da quadra + linhas de ataque (3m) +
                 linha de rede, e um "R" grande e discreto no centro, como um
                 logo pintado no chão da quadra. */}
              <text x={150} y={100} fontSize={92} fontWeight={900} textAnchor="middle" dominantBaseline="central" fill="#ffffff" fillOpacity={0.05}>R</text>
              <rect x={1} y={1} width={298} height={198} fill="none" stroke="#ffffff" strokeOpacity={0.3} strokeWidth={2} />
              <line x1={100} y1={0} x2={100} y2={200} stroke="#ffffff" strokeOpacity={0.22} strokeWidth={1.2} />
              <line x1={200} y1={0} x2={200} y2={200} stroke="#ffffff" strokeOpacity={0.22} strokeWidth={1.2} />
              <line x1={150} y1={0} x2={150} y2={200} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4,3" />
              <LogoNaQuadraSvg url={logoEscolaUrl} />

              {linhas.map((l) => (
                <LinhaSvg
                  key={l.id} linha={l} markerId={`seta-${l.tipo}`}
                  selecionada={linhaSelecionadaId === l.id} interativa={ferramenta === 'mover' || ferramenta === 'apagar'}
                  onSelecionar={cliqueNaLinha}
                />
              ))}
              {linhaSelecionada && ferramenta !== 'apagar' && (() => {
                const meio = linhaSelecionada.cx != null && linhaSelecionada.cy != null
                  ? { x: linhaSelecionada.cx, y: linhaSelecionada.cy }
                  : { x: (linhaSelecionada.x1 + linhaSelecionada.x2) / 2, y: (linhaSelecionada.y1 + linhaSelecionada.y2) / 2 }
                return (
                  <circle
                    cx={meio.x * 3} cy={meio.y * 2} r={5} fill="#22c55e" stroke="#0a3d1e" strokeWidth={1.2}
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => iniciarArrastoControle(e, linhaSelecionada.id)}
                  />
                )
              })()}
              {linhaInicio && <circle cx={linhaInicio.x * 3} cy={linhaInicio.y * 2} r={3} fill="#d4af37" />}

              {elementos.map((el) => (
                <g
                  key={el.id} transform={`translate(${el.x * 3}, ${el.y * 2})`}
                  onClick={(e) => cliqueNoElemento(e, el.id)}
                  onPointerDown={(e) => iniciarArrasto(e, el.id)}
                  style={{ cursor: ferramenta === 'apagar' ? 'pointer' : 'grab' }}
                >
                  <ElementoSvg el={el} selecionado={selecionadoId === el.id} estiloJogador={estiloJogador} />
                </g>
              ))}
            </svg>

            {linhaSelecionada && (linhaSelecionada.cx != null || linhaSelecionada.cy != null) && (
              <div className="flex justify-end mt-1.5">
                <button
                  className="text-xs font-semibold px-3 py-1 rounded-full border border-[var(--rd-border)]"
                  onClick={() => setLinhas((ls) => ls.map((l) => (l.id === linhaSelecionada.id ? { ...l, cx: undefined, cy: undefined } : l)))}
                >
                  Endireitar
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-[11px] text-[var(--rd-text-dim)] mb-2">Vista só pra visualizar. Pra mexer nos jogadores e setas, volta pra Planta.</p>
            <QuadroDesenhoPerspectiva desenho={{ elementos, linhas, estiloJogador }} camera={camera} />
          </>
        )}

        {vista === 'planta' && selecionado && (selecionado.tipo === 'atleta_azul' || selecionado.tipo === 'atleta_amarelo' || selecionado.tipo === 'curinga') && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-semibold">Número da camisa:</span>
            <input
              className="rd-input text-xs w-20" value={selecionado.numero ?? ''}
              onChange={(e) => setElementos((ls) => ls.map((el) => (el.id === selecionado.id ? { ...el, numero: e.target.value } : el)))}
            />
            <button className="rd-btn !p-1.5 rd-btn-danger" onClick={() => { setElementos((ls) => ls.filter((el) => el.id !== selecionado.id)); setSelecionadoId(null) }}><Trash2 size={14} /></button>
          </div>
        )}

        {vista === 'planta' && selecionado && selecionado.tipo === 'zona' && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-semibold">Tamanho da zona:</span>
            <input
              type="number" min={5} max={100} className="rd-input text-xs w-16" value={selecionado.largura ?? ZONA_LARGURA_PADRAO}
              onChange={(e) => setElementos((ls) => ls.map((el) => (el.id === selecionado.id ? { ...el, largura: Number(e.target.value) || ZONA_LARGURA_PADRAO } : el)))}
            />
            <span className="text-[11px] text-[var(--rd-text-dim)]">×</span>
            <input
              type="number" min={5} max={100} className="rd-input text-xs w-16" value={selecionado.altura ?? ZONA_ALTURA_PADRAO}
              onChange={(e) => setElementos((ls) => ls.map((el) => (el.id === selecionado.id ? { ...el, altura: Number(e.target.value) || ZONA_ALTURA_PADRAO } : el)))}
            />
            <button className="rd-btn !p-1.5 rd-btn-danger" onClick={() => { setElementos((ls) => ls.filter((el) => el.id !== selecionado.id)); setSelecionadoId(null) }}><Trash2 size={14} /></button>
          </div>
        )}

        <div className="flex gap-2 mt-3 justify-end">
          <button className="rd-btn text-xs" onClick={onFechar}>Cancelar</button>
          <button
            className="rd-btn rd-btn-gold text-xs"
            onClick={() => onSalvar({
              elementos: passos[0].elementos, linhas: passos[0].linhas, estiloJogador, meiaQuadra,
              ...(passos.length > 1 ? { passos, velocidade, repetir } : {}),
            })}
          >
            Usar este desenho
          </button>
        </div>
      </div>
    </div>
  )
}
