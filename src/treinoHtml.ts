// Exportação da Ficha de Treino em HTML autocontido (compartilhar/baixar/PDF),
// seguindo o mesmo padrão visual e os mesmos recursos de `htmlReport.ts`
// (fundo preto também ao compartilhar, botão "voltar ao app" na tela) —
// pedido 29/10/2026: reproduzir a ficha de treino que o Henrique mostrou em
// vídeo (app "H10 Academy"). Fase 1: os 11 quadros da ficha mostram só
// nome/objetivo/tempo — a quadra sai em branco pra desenhar à mão, igual o
// próprio H10 faz quando o quadro não foi preenchido digitalmente. O desenho
// animado de quadra (arrastar atleta/bola) fica pra uma 2ª entrega.
import type { SessaoTreino, Turma, Escola, QuadroDesenho, ElementoDesenho, LinhaDesenhoTipo } from './types'
import { QUADRO_SLOTS, TEMAS_TREINO, CONDICIONANTES_TREINO } from './types'
import { formatDate } from './utils'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

const CSS_TREINO = `
  *{box-sizing:border-box}
  html{background:#000;min-height:100%}
  body{margin:0;background:#000;color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;padding:20px;min-height:100vh}
  .wrap{max-width:900px;margin:0 auto}
  .header{background:linear-gradient(135deg,#0a0a0a,#d4af37);border-radius:20px;padding:24px;color:#fff;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
  .header h1{margin:0;font-size:20px;font-weight:900;letter-spacing:-.02em}
  .header p{margin:4px 0 0;font-size:12px;opacity:.85}
  .card{background:#111;border:1px solid #232323;border-radius:14px;padding:16px;margin-bottom:16px}
  .info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;font-size:12px}
  .info-grid .lbl{text-transform:uppercase;font-size:9px;font-weight:700;color:#999;letter-spacing:.03em}
  .info-grid .val{font-weight:700;margin-top:2px}
  h2{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.03em;color:#d4af37;margin:0 0 8px}
  .chip{display:inline-block;font-size:10px;font-weight:700;padding:3px 9px;border-radius:999px;background:rgba(212,175,55,.14);color:#d4af37;margin:0 4px 4px 0}
  .quadros-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .quadro-card{border:1px solid #232323;border-radius:12px;padding:8px;background:#0b0b0b}
  .quadro-como{font-size:9px;color:#d0d0d0;margin-top:4px;white-space:pre-wrap;line-height:1.45}
  /* Versão do auxiliar (pedido 11/11/2026): um exercício por linha, letra e desenho maiores pra ler no celular. */
  .quadros-grid.lista{grid-template-columns:1fr;gap:14px}
  .lista .quadro-card{padding:12px}
  .lista .quadro-head{font-size:11px}
  .lista .quadro-nome{font-size:16px;margin-bottom:8px}
  .lista .quadro-foot{font-size:13px;color:#bbb}
  .lista .quadro-como{font-size:14px;color:#f0f0f0;margin-top:8px}
  .quadro-head{display:flex;justify-content:space-between;font-size:9px;font-weight:700;color:#999;text-transform:uppercase;margin-bottom:6px}
  .quadro-nome{font-size:11px;font-weight:700;margin-bottom:4px;min-height:14px}
  .quadro-court{width:100%;aspect-ratio:3/2;border:1.5px solid #3a3a3a;border-radius:4px;position:relative;background:#141414}
  .quadro-court .net{position:absolute;left:50%;top:0;bottom:0;width:0;border-left:1px dashed #3a3a3a}
  .quadro-court .linha{position:absolute;top:0;bottom:0;width:0;border-left:1px solid #2a2a2a}
  .quadro-foot{font-size:9px;color:#999;margin-top:4px}
  .reg-pedagogico{font-size:11px;line-height:1.7}
  .reg-pedagogico .q{font-weight:700;color:#d4af37;margin-top:10px}
  .reg-pedagogico .q:first-child{margin-top:0}
  .reg-pedagogico .a{color:#f0f0f0}
  footer{text-align:center;font-size:11px;color:#666;margin-top:24px}
  .rd-voltar-wrap{position:sticky;top:0;z-index:50;margin:-20px -20px 16px;padding:10px 20px;background:rgba(10,10,10,.92);backdrop-filter:blur(6px);border-bottom:1px solid #232323}
  .rd-voltar-btn{display:inline-flex;align-items:center;gap:6px;background:#d4af37;color:#0a0a0a;font-weight:800;font-size:13px;padding:8px 16px;border-radius:999px;border:none;cursor:pointer}
  .rd-voltar-btn:active{opacity:.8}
  @media print{
    .rd-voltar-wrap{display:none}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
    body{padding:0;background:#000 !important;color:#f0f0f0}
    .header{background:linear-gradient(135deg,#0a0a0a,#d4af37)}
    .quadros-grid{break-inside:avoid}
    .quadro-card{break-inside:avoid}
  }
`

/** Quadra vazia, pra desenhar à mão na ficha impressa. */
function quadraVaziaSvg(): string {
  return `<div class="quadro-court"><div class="linha" style="left:33.33%"></div><div class="net" style="left:50%"></div><div class="linha" style="left:66.66%"></div></div>`
}

function corLinhaDesenho(tipo: LinhaDesenhoTipo): string {
  return tipo === 'saque_ataque' ? '#e74c3c' : tipo === 'toque_passe' ? '#3498db' : '#d4af37'
}

/** Caminho SVG reto ou curvo (pedido 30/10/2026: "traço curvo") — mesma
 *  lógica do editor (ver `pathDaLinha` em QuadroDesenhoEditor.tsx). */
function pathDaLinhaDesenho(x1: number, y1: number, x2: number, y2: number, cx?: number, cy?: number): string {
  if (cx != null && cy != null) return `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`
  return `M ${x1},${y1} L ${x2},${y2}`
}

function elementoDesenhoSvg(el: ElementoDesenho, estiloJogador: 'boneco' | 'circulo' = 'boneco'): string {
  const t = `translate(${el.x * 3}, ${el.y * 2})`
  if (el.tipo === 'zona') {
    const w = (el.largura ?? 20) * 3
    const h = (el.altura ?? 15) * 2
    return `<g transform="${t}"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="4" fill="#22c55e26" stroke="#22c55e" stroke-width="2" stroke-dasharray="6,4" /></g>`
  }
  if (el.tipo === 'atleta_azul' || el.tipo === 'atleta_amarelo' || el.tipo === 'curinga') {
    const cor = el.tipo === 'atleta_azul' ? '#2563eb' : el.tipo === 'atleta_amarelo' ? '#eab308' : '#9ca3af'
    if (estiloJogador === 'circulo') {
      const numeroC = el.numero
        ? `<text x="0" y="3.4" font-size="8.5" font-weight="800" text-anchor="middle" fill="#fff">${escapeHtml(el.numero)}</text>`
        : ''
      return `<g transform="${t}">`
        + `<ellipse cx="0" cy="6" rx="8" ry="2" fill="#000" opacity="0.2" />`
        + `<circle cx="0" cy="0" r="9" fill="${cor}" stroke="#16213f" stroke-width="1.3" />`
        + numeroC
        + `</g>`
    }
    const numero = el.numero
      ? `<text x="0" y="5.2" font-size="6.6" font-weight="800" text-anchor="middle" fill="#fff" paint-order="stroke" stroke="#00000055" stroke-width="0.6">${escapeHtml(el.numero)}</text>`
      : ''
    return `<g transform="${t}">`
      + `<ellipse cx="0" cy="5.5" rx="7.5" ry="2" fill="#000" opacity="0.22" />`
      + `<circle cx="-7.2" cy="-2.3" r="2.3" fill="#e8c39d" stroke="#16213f" stroke-width="1" />`
      + `<circle cx="7.2" cy="-2.3" r="2.3" fill="#e8c39d" stroke="#16213f" stroke-width="1" />`
      + `<ellipse cx="0" cy="2.6" rx="9" ry="6.6" fill="${cor}" stroke="#16213f" stroke-width="1.2" />`
      + `<circle cx="0" cy="-6.6" r="3.4" fill="#e8c39d" stroke="#16213f" stroke-width="1" />`
      + `<path d="M -3.4,-6.4 A 3.4,3.4 0 0 1 3.4,-6.4 Q 3.6,-2.6 0,-1.6 Q -3.6,-2.6 -3.4,-6.4 Z" fill="#4a2f1c" stroke="#16213f" stroke-width="0.9" />`
      + numero
      + `</g>`
  }
  if (el.tipo === 'bola') {
    return `<g transform="${t}">`
      + `<ellipse cx="0" cy="3.6" rx="4.4" ry="1.3" fill="#000" opacity="0.2" />`
      + `<circle cx="0" cy="0" r="4.8" fill="#fdfbf5" stroke="#16213f" stroke-width="1.1" />`
      + `<polygon points="0,-2.1 2,-0.65 1.25,1.7 -1.25,1.7 -2,-0.65" fill="#16213f" />`
      + `</g>`
  }
  if (el.tipo === 'cone') return `<g transform="${t}"><polygon points="0,-7 6,6 -6,6" fill="#f97316" stroke="#000" stroke-width="0.5" /></g>`
  if (el.tipo === 'arco') return `<g transform="${t}"><circle cx="0" cy="0" r="7" fill="none" stroke="#ec4899" stroke-width="2.5" /></g>`
  if (el.tipo === 'escada') return `<g transform="${t}"><rect x="-9" y="-4" width="18" height="8" fill="none" stroke="#8b5cf6" stroke-width="1.5" /></g>`
  return `<g transform="${t}"><text x="0" y="3" font-size="9" font-weight="700" text-anchor="middle" fill="#f0f0f0">${escapeHtml(el.texto || '')}</text></g>`
}

// --- Vista em Perspectiva no HTML/PDF exportado (pedido 30/10/2026) -------
// Mesma projeção usada no editor (ver QuadroDesenhoEditor.tsx) — quadra em
// trapézio com a câmera atrás da linha de fundo, atletas "de pé". Sai lado a
// lado com a vista de cima no quadro impresso, pra dar as duas referências.
const PERSP_FAR_Y = 35
const PERSP_NEAR_Y = 190
const PERSP_CENTER_X = 150
const PERSP_FAR_HALF_W = 55
const PERSP_NEAR_HALF_W = 135
const PERSP_SCALE_FAR = 0.32
const PERSP_SCALE_NEAR = 1.15

function projetarPerspectiva(xPct: number, yPct: number) {
  const t = Math.max(0, Math.min(100, xPct)) / 100
  const y = PERSP_FAR_Y + t * (PERSP_NEAR_Y - PERSP_FAR_Y)
  const halfW = PERSP_FAR_HALF_W + t * (PERSP_NEAR_HALF_W - PERSP_FAR_HALF_W)
  const left = PERSP_CENTER_X - halfW
  const right = PERSP_CENTER_X + halfW
  const x = left + (Math.max(0, Math.min(100, yPct)) / 100) * (right - left)
  const scale = PERSP_SCALE_FAR + t * (PERSP_SCALE_NEAR - PERSP_SCALE_FAR)
  return { x, y, scale }
}

function quadraPerspectivaFundoSvg(): string {
  const far = projetarPerspectiva(0, 0)
  const farR = projetarPerspectiva(0, 100)
  const near = projetarPerspectiva(100, 0)
  const nearR = projetarPerspectiva(100, 100)
  const linha1 = projetarPerspectiva(33.33, 0)
  const linha1R = projetarPerspectiva(33.33, 100)
  const linha2 = projetarPerspectiva(66.66, 0)
  const linha2R = projetarPerspectiva(66.66, 100)
  const netL = projetarPerspectiva(50, 0)
  const netR = projetarPerspectiva(50, 100)
  const postoAltura = 42 * netL.scale
  let malha = ''
  for (let i = 0; i < 7; i++) {
    const f = (i + 1) / 8
    const x = netL.x + f * (netR.x - netL.x)
    malha += `<line x1="${x}" y1="${netL.y}" x2="${x}" y2="${netL.y - postoAltura}" stroke="#9ca3af" stroke-width="0.3" />`
  }
  for (let i = 0; i < 3; i++) {
    const f = (i + 1) / 4
    const y = netL.y - f * postoAltura
    malha += `<line x1="${netL.x}" y1="${y}" x2="${netR.x}" y2="${y}" stroke="#9ca3af" stroke-width="0.3" />`
  }
  return `<polygon points="${far.x},${far.y} ${farR.x},${farR.y} ${nearR.x},${nearR.y} ${near.x},${near.y}" fill="#141414" stroke="#3a3a3a" stroke-width="1.5" />`
    + `<text x="150" y="100" font-size="92" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="#ffffff" fill-opacity="0.05">R</text>`
    + `<line x1="${linha1.x}" y1="${linha1.y}" x2="${linha1R.x}" y2="${linha1R.y}" stroke="#2a2a2a" stroke-width="1" />`
    + `<line x1="${linha2.x}" y1="${linha2.y}" x2="${linha2R.x}" y2="${linha2R.y}" stroke="#2a2a2a" stroke-width="1" />`
    + `<line x1="${netL.x}" y1="${netL.y}" x2="${netL.x}" y2="${netL.y - postoAltura}" stroke="#6b7280" stroke-width="2" />`
    + `<line x1="${netR.x}" y1="${netR.y}" x2="${netR.x}" y2="${netR.y - postoAltura}" stroke="#6b7280" stroke-width="2" />`
    + `<line x1="${netL.x}" y1="${netL.y - postoAltura}" x2="${netR.x}" y2="${netR.y - postoAltura}" stroke="#9ca3af" stroke-width="1.3" />`
    + malha
}

function elementoDesenhoSvgPerspectiva(el: ElementoDesenho, estiloJogador: 'boneco' | 'circulo' = 'boneco'): string {
  const p = projetarPerspectiva(el.x, el.y)
  const s = p.scale
  const t = `translate(${p.x}, ${p.y})`
  if (el.tipo === 'zona') {
    const w = (el.largura ?? 20) * 3 * s
    const h = (el.altura ?? 15) * 2 * s
    return `<g transform="${t}"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="4" fill="#22c55e26" stroke="#22c55e" stroke-width="2" stroke-dasharray="6,4" /></g>`
  }
  if (el.tipo === 'atleta_azul' || el.tipo === 'atleta_amarelo' || el.tipo === 'curinga') {
    if (estiloJogador === 'circulo') {
      const cor = el.tipo === 'atleta_azul' ? '#2563eb' : el.tipo === 'atleta_amarelo' ? '#eab308' : '#9ca3af'
      const numeroC = el.numero
        ? `<text x="0" y="${3.4 * s}" font-size="${8.5 * s}" font-weight="800" text-anchor="middle" fill="#fff">${escapeHtml(el.numero)}</text>`
        : ''
      return `<g transform="${t} scale(${s})">`
        + `<ellipse cx="0" cy="6" rx="8" ry="2" fill="#000" opacity="0.2" />`
        + `<circle cx="0" cy="0" r="9" fill="${cor}" stroke="#16213f" stroke-width="1.3" />`
        + numeroC
        + `</g>`
    }
    const cor = el.tipo === 'atleta_azul' ? '#2563eb' : el.tipo === 'atleta_amarelo' ? '#eab308' : '#9ca3af'
    const numero = el.numero
      ? `<text x="0" y="${-20 * s}" font-size="${7 * s}" font-weight="800" text-anchor="middle" fill="#fff">${escapeHtml(el.numero)}</text>`
      : ''
    return `<g transform="${t}">`
      + `<ellipse cx="0" cy="${2 * s}" rx="${9 * s}" ry="${2.2 * s}" fill="#000" opacity="0.25" />`
      + `<rect x="${-4 * s}" y="${-12 * s}" width="${3 * s}" height="${12 * s}" rx="${1.4 * s}" fill="#2b2b2b" />`
      + `<rect x="${1 * s}" y="${-12 * s}" width="${3 * s}" height="${12 * s}" rx="${1.4 * s}" fill="#2b2b2b" />`
      + `<rect x="${-6 * s}" y="${-16 * s}" width="${12 * s}" height="${5 * s}" rx="${1.5 * s}" fill="#16213f" />`
      + `<rect x="${-7 * s}" y="${-28 * s}" width="${14 * s}" height="${13 * s}" rx="${3 * s}" fill="${cor}" stroke="#16213f" stroke-width="${1 * s}" />`
      + numero
      + `<circle cx="0" cy="${-32 * s}" r="${4.2 * s}" fill="#e8c39d" stroke="#16213f" stroke-width="${0.9 * s}" />`
      + `<path d="M ${-4.2 * s},${-31.8 * s} A ${4.2 * s},${4.2 * s} 0 0 1 ${4.2 * s},${-31.8 * s} Q ${4.4 * s},${-27.5 * s} 0,${-26.8 * s} Q ${-4.4 * s},${-27.5 * s} ${-4.2 * s},${-31.8 * s} Z" fill="#4a2f1c" stroke="#16213f" stroke-width="${0.8 * s}" />`
      + `</g>`
  }
  if (el.tipo === 'bola') {
    return `<g transform="${t}">`
      + `<ellipse cx="0" cy="${1.6 * s}" rx="${4 * s}" ry="${1.1 * s}" fill="#000" opacity="0.2" />`
      + `<circle cx="0" cy="${-3 * s}" r="${4.4 * s}" fill="#fdfbf5" stroke="#16213f" stroke-width="${1 * s}" />`
      + `<polygon points="0,${-5 * s} ${1.8 * s},${-3.6 * s} ${1.1 * s},${-1.4 * s} ${-1.1 * s},${-1.4 * s} ${-1.8 * s},${-3.6 * s}" fill="#16213f" />`
      + `</g>`
  }
  // cone/arco/escada/texto: marcador simples no chão
  const corpo =
    el.tipo === 'cone' ? `<polygon points="0,-9 5,1 -5,1" fill="#f97316" stroke="#000" stroke-width="0.5" />`
    : el.tipo === 'arco' ? `<ellipse cx="0" cy="-2" rx="7" ry="3" fill="none" stroke="#ec4899" stroke-width="2.2" />`
    : el.tipo === 'escada' ? `<rect x="-9" y="-4" width="18" height="4" fill="none" stroke="#8b5cf6" stroke-width="1.5" />`
    : `<text x="0" y="-2" font-size="8" font-weight="700" text-anchor="middle" fill="#f0f0f0">${escapeHtml(el.texto || '')}</text>`
  return `<g transform="translate(${p.x}, ${p.y}) scale(${s})"><ellipse cx="0" cy="1" rx="6" ry="2" fill="#000" opacity="0.2" />${corpo}</g>`
}

function quadraPerspectivaSvg(desenho: QuadroDesenho): string {
  const elementosOrdenados = [...desenho.elementos].sort((a, b) => a.x - b.x)
  const linhasSvg = desenho.linhas.map((l) => {
    const p1 = projetarPerspectiva(l.x1, l.y1)
    const p2 = projetarPerspectiva(l.x2, l.y2)
    const tracejado = l.tipo === 'toque_passe' ? ' stroke-dasharray="3,2"' : ''
    const largura = (l.tipo === 'saque_ataque' ? 2.2 : 1.4) * ((p1.scale + p2.scale) / 2)
    const d = l.cx != null && l.cy != null
      ? (() => { const c = projetarPerspectiva(l.cx!, l.cy!); return pathDaLinhaDesenho(p1.x, p1.y, p2.x, p2.y, c.x, c.y) })()
      : pathDaLinhaDesenho(p1.x, p1.y, p2.x, p2.y)
    return `<path d="${d}" fill="none" stroke="${corLinhaDesenho(l.tipo)}" stroke-width="${largura}"${tracejado} marker-end="url(#persp-seta-${l.tipo})" />`
  }).join('')
  const elementosSvg = elementosOrdenados.map((el) => elementoDesenhoSvgPerspectiva(el, desenho.estiloJogador ?? 'boneco')).join('')
  return `<div class="quadro-court" style="padding:0;background:#0b1220">
    <svg viewBox="0 0 300 200" style="width:100%;height:100%;display:block">
      <defs>
        <marker id="persp-seta-toque_passe" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${corLinhaDesenho('toque_passe')}" /></marker>
        <marker id="persp-seta-deslocar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${corLinhaDesenho('deslocar')}" /></marker>
        <marker id="persp-seta-saque_ataque" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="${corLinhaDesenho('saque_ataque')}" /></marker>
      </defs>
      ${quadraPerspectivaFundoSvg()}
      ${linhasSvg}
      ${elementosSvg}
    </svg>
  </div>`
}

/** Prévia de um quadro na ficha impressa — desenho estático de sempre, ou,
 *  quando o quadro é uma animação por quadros (pedido 31/10/2026, fase 2),
 *  uma fileira de miniaturas (uma por passo) com a legenda embaixo de cada
 *  uma, já que não dá pra animar no papel. */
function quadraSequenciaHtml(desenho: QuadroDesenho): string {
  if (!desenho.passos || desenho.passos.length <= 1) {
    return `<div style="display:flex;flex-direction:column;gap:4px">
      <div>${quadraDesenhoSvg(desenho)}<div class="quadro-foot" style="margin-top:2px;text-align:center">De cima</div></div>
      <div>${quadraPerspectivaSvg(desenho)}<div class="quadro-foot" style="margin-top:2px;text-align:center">Perspectiva</div></div>
    </div>`
  }
  const miniaturas = desenho.passos.map((p, i) => `
    <div style="flex:1;min-width:0">
      ${quadraDesenhoSvg({ elementos: p.elementos, linhas: p.linhas, estiloJogador: desenho.estiloJogador, meiaQuadra: desenho.meiaQuadra })}
      <div class="quadro-foot" style="margin-top:2px;text-align:center">${i + 1}${p.legenda ? ` · ${escapeHtml(p.legenda)}` : ''}</div>
    </div>`).join('')
  return `<div style="display:flex;gap:4px;flex-wrap:wrap">${miniaturas}</div>`
}

function quadraDesenhoSvg(desenho: QuadroDesenho): string {
  const linhasSvg = desenho.linhas.map((l) => {
    const tracejado = l.tipo === 'toque_passe' ? ' stroke-dasharray="3,2"' : ''
    const largura = l.tipo === 'saque_ataque' ? 2.2 : 1.4
    const d = pathDaLinhaDesenho(l.x1 * 3, l.y1 * 2, l.x2 * 3, l.y2 * 2, l.cx != null ? l.cx * 3 : undefined, l.cy != null ? l.cy * 2 : undefined)
    return `<path d="${d}" fill="none" stroke="${corLinhaDesenho(l.tipo)}" stroke-width="${largura}"${tracejado} marker-end="url(#seta-${l.tipo})" />`
  }).join('')
  const elementosSvg = desenho.elementos.map((el) => elementoDesenhoSvg(el, desenho.estiloJogador ?? 'boneco')).join('')
  return `<div class="quadro-court" style="padding:0">
    <svg viewBox="0 0 300 200" style="width:100%;height:100%;display:block">
      <defs>
        <marker id="seta-toque_passe" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${corLinhaDesenho('toque_passe')}" /></marker>
        <marker id="seta-deslocar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${corLinhaDesenho('deslocar')}" /></marker>
        <marker id="seta-saque_ataque" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="${corLinhaDesenho('saque_ataque')}" /></marker>
      </defs>
      <line x1="100" y1="0" x2="100" y2="200" stroke="#2a2a2a" stroke-width="1" />
      <line x1="200" y1="0" x2="200" y2="200" stroke="#2a2a2a" stroke-width="1" />
      <line x1="150" y1="0" x2="150" y2="200" stroke="#3a3a3a" stroke-width="1" stroke-dasharray="4,3" />
      ${linhasSvg}
      ${elementosSvg}
    </svg>
  </div>`
}

function paginaHtmlTreino(conteudoBody: string, titulo: string, mostrarVoltar = true): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#000000">
<title>${escapeHtml(titulo)}</title>
<style>${CSS_TREINO}</style>
</head>
<body>
<div class="wrap">
${mostrarVoltar ? `<div class="rd-voltar-wrap">
<button class="rd-voltar-btn" onclick="rdVoltar()">‹ Voltar ao app</button>
</div>` : ''}
${conteudoBody}
<footer>Gerado por RDSports em ${new Date().toLocaleString('pt-BR')}</footer>
</div>
<script>
function rdVoltar(){
  try { window.close() } catch (e) {}
  setTimeout(function () {
    if (!window.closed) {
      if (window.history.length > 1) { window.history.back() }
      else { alert('Pra voltar: feche esta aba ou use o botão de voltar do navegador.') }
    }
  }, 250)
}
</script>
</body>
</html>`
}

const LABEL_COMPORTAMENTO: Record<string, string> = {
  sozinho: 'Sozinho', com_pergunta: 'Com pergunta', so_com_instrucao: 'Só com instrução', nao_apareceu: 'Não apareceu',
}
const LABEL_CAMADA: Record<string, string> = {
  leitura_ajuste: 'Leitura/ajuste', execucao: 'Execução', decisao: 'Decisão', cooperacao_conduta: 'Cooperação/conduta',
}

/** `paraSubstituto` (pedido 11/11/2026): versão da ficha que o Rafael manda
 *  pro auxiliar que vai dar o treino no lugar dele. Diferenças: aviso no topo
 *  com o recado, sem o botão "Voltar ao app" (o auxiliar abre o arquivo direto
 *  pelo WhatsApp, fora do app) e sem o Registro pedagógico (é a reflexão do
 *  próprio Rafael depois do treino, não faz parte do que o auxiliar aplica). */
export function gerarHtmlFichaTreino(
  sessao: SessaoTreino,
  turma: Pick<Turma, 'nome'>,
  escola: Pick<Escola, 'nome'>,
  opcoes: {
    paraSubstituto?: boolean
    /** Com os quadros em branco (pedido 11/11/2026: opção de compartilhar com
     *  e sem). Mostra os 11 quadros e uma quadra vazia nos exercícios sem
     *  desenho, pra desenhar à mão. Padrão: só o que foi preenchido. */
    incluirQuadrosEmBranco?: boolean
  } = {},
): string {
  const paraSubstituto = !!opcoes.paraSubstituto
  const comBranco = !!opcoes.incluirQuadrosEmBranco
  const temasSelecionados = sessao.temas.map((id) => TEMAS_TREINO.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t)
  const temaPrincipal = temasSelecionados[0]
  const condicionantesSelecionadas = sessao.condicionantes.map((id) => CONDICIONANTES_TREINO.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c)
  const duracaoTotal = sessao.quadros.reduce((soma, q) => soma + (q.tempoMin ?? 0), 0)

  const header = `
    <div class="header">
      <div>
        <h1>Ficha de Treino · Vôlei</h1>
        <p>Ensinamos pelo jogo, encantamos pelo ambiente e apaixonamos pela experiência.</p>
      </div>
      <div style="text-align:right;font-size:11px;font-weight:800;opacity:.9">${escapeHtml(escola.nome)}</div>
    </div>`

  const info = `
    <div class="card">
      <div class="info-grid">
        <div><div class="lbl">Data</div><div class="val">${formatDate(sessao.data)}</div></div>
        <div><div class="lbl">Turma/Categoria</div><div class="val">${escapeHtml(turma.nome)}</div></div>
        <div><div class="lbl">Sessão nº</div><div class="val">${escapeHtml(sessao.numeroSessao || '—')}</div></div>
        <div><div class="lbl">Nº de alunos(as)</div><div class="val">${sessao.numeroAlunos ?? '—'}</div></div>
        <div><div class="lbl">Materiais</div><div class="val">${escapeHtml(sessao.materiais || '—')}</div></div>
        <div><div class="lbl">Duração estimada</div><div class="val">${duracaoTotal > 0 ? `${duracaoTotal} min` : '—'}</div></div>
        <div style="grid-column:1/-1"><div class="lbl">Tema (★ principal)</div><div class="val">
          ${temasSelecionados.length === 0 ? '—' : temasSelecionados.map((t) => `${t === temaPrincipal ? '★ ' : ''}${escapeHtml(t.label)}`).join(' · ')}
        </div></div>
      </div>
    </div>`

  const problemaECondicionantes = `
    <div class="card">
      <div class="info-grid">
        <div>
          <h2 style="margin-bottom:4px">Problema de jogo da sessão</h2>
          <div style="font-size:12px">${escapeHtml(sessao.problemaJogo || '—')}</div>
        </div>
        <div style="grid-column:span 3">
          <h2 style="margin-bottom:4px">Condicionantes que vou manipular</h2>
          <div>${condicionantesSelecionadas.length === 0 ? '<span style="font-size:12px;color:#999">—</span>' : condicionantesSelecionadas.map((c) => `<span class="chip">${escapeHtml(c.label)}</span>`).join('')}</div>
        </div>
      </div>
    </div>`

  // Só os quadros preenchidos, nas duas fichas (pedido 11/11/2026: "os em
  // branco eu não quero que mande") — a não ser que peça com os em branco.
  const quadroPreenchido = (q: SessaoTreino['quadros'][number] | undefined) =>
    !!q && !!(q.nome?.trim() || q.objetivo?.trim() || q.comoFunciona?.trim() || q.tempoMin || (q.desenho && q.desenho.elementos.length > 0))
  const slotsVisiveis = comBranco
    ? QUADRO_SLOTS
    : QUADRO_SLOTS.filter((slot) => quadroPreenchido(sessao.quadros.find((x) => x.chave === slot.chave)))

  const quadrosHtml = slotsVisiveis.map((slot) => {
    const q = sessao.quadros.find((x) => x.chave === slot.chave)
    return `
      <div class="quadro-card">
        <div class="quadro-head"><span>${escapeHtml(slot.grupoLabel)}</span><span>${q?.tempoMin ? `${q.tempoMin} min` : ''}</span></div>
        <div class="quadro-nome">${q?.nome ? escapeHtml(q.nome) : ''}</div>
        ${q?.desenho && q.desenho.elementos.length > 0 ? quadraSequenciaHtml(q.desenho) : comBranco ? quadraVaziaSvg() : ''}
        ${q?.objetivo ? `<div class="quadro-foot">Obj.: ${escapeHtml(q.objetivo)}</div>` : ''}
        ${q?.comoFunciona?.trim() ? `<div class="quadro-como"><b>Como funciona:</b> ${escapeHtml(q.comoFunciona.trim())}</div>` : ''}
      </div>`
  }).join('')

  const quadros = `
    <div class="card">
      <h2>${paraSubstituto ? 'Exercícios' : 'Quadros do treino'}</h2>
      ${slotsVisiveis.length === 0
        ? '<div style="font-size:13px;color:#999">Nenhum exercício preenchido.</div>'
        : `<div class="quadros-grid${paraSubstituto ? ' lista' : ''}">${quadrosHtml}</div>`}
    </div>`

  const rp = sessao.registroPedagogico
  const registroPedagogico = `
    <div class="card">
      <h2>Registro pedagógico</h2>
      <div class="reg-pedagogico">
        <div class="q">1. O comportamento que eu queria ver apareceu?</div>
        <div class="a">${rp.comportamentoApareceu ? LABEL_COMPORTAMENTO[rp.comportamentoApareceu] : '—'}</div>
        <div class="q">2. O que a turma resolveu hoje que não resolvia antes?</div>
        <div class="a">${escapeHtml(rp.problemaResolvido || '—')}</div>
        <div class="q">3. Camada mais observada hoje</div>
        <div class="a">${rp.camadaObservada ? LABEL_CAMADA[rp.camadaObservada] : '—'}</div>
        <div class="q">4. Alunos(as) observados(as) e estágio</div>
        <div class="a">${escapeHtml(rp.alunosObservados || '—')}</div>
        <div class="q">5. Que condicionante eu mudaria?</div>
        <div class="a">${escapeHtml(rp.condicionanteMudaria || '—')}</div>
        <div class="q">6. Compromisso para o próximo treino</div>
        <div class="a">${escapeHtml(rp.compromissoProximoTreino || '—')}</div>
        <div class="q">Ajustes feitos durante o treino — o que eu mudei e por quê</div>
        <div class="a">${escapeHtml(rp.ajustesFeitos || '—')}</div>
      </div>
    </div>`

  const recado = (sessao.recadoSubstituto ?? '').trim()
  const avisoSubstituto = `
    <div class="card" style="border:2px solid #f5b800">
      <h2 style="margin-bottom:6px">Treino para você aplicar</h2>
      <div style="font-size:13px">${escapeHtml(turma.nome)} · ${escapeHtml(escola.nome)} · ${formatDate(sessao.data)}</div>
      ${recado ? `<div style="font-size:13px;margin-top:10px;white-space:pre-wrap"><b>Recado:</b> ${escapeHtml(recado)}</div>` : ''}
    </div>`

  if (paraSubstituto) {
    const body = header + avisoSubstituto + info + problemaECondicionantes + quadros
    return paginaHtmlTreino(body, `Treino — ${turma.nome} — ${formatDate(sessao.data)}`, false)
  }

  const body = header + info + problemaECondicionantes + quadros + registroPedagogico
  return paginaHtmlTreino(body, `Ficha de Treino — ${turma.nome} — ${formatDate(sessao.data)}`)
}
