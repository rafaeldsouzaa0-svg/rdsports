// Mapa de calor das zonas de destino do ataque e do saque (pedido 27/11/2026).
// Mesmo desenho da quadrinha do scout ao vivo: rede em cima, 4 3 2 / 7 8 9 / 5 6 1.
import { useState } from 'react'
import { Grid3x3 } from 'lucide-react'
import type { Atleta, FundamentoScout, SetPartida } from '../types'
import { DESENHO_QUADRA, desempenhoPorZona } from '../zonas'
import { Secao, corPct } from './estatisticaUi'

/** Ace é raro: 15% de aces numa zona já é muito bom. */
function corAce(pct: number): string {
  if (pct >= 15) return 'var(--rd-positivo)'
  if (pct >= 7) return 'var(--rd-neutro)'
  return 'rgba(255,255,255,.85)'
}

export default function MapaZonas({ sets, atletas }: { sets: SetPartida[]; atletas: Atleta[] }) {
  const [fundamento, setFundamento] = useState<FundamentoScout>('ataque')
  const [atletaId, setAtletaId] = useState('')
  const algumaZona = (['ataque', 'saque'] as FundamentoScout[]).some((f) => desempenhoPorZona(sets, f).comZona > 0)
  if (!algumaZona) return null

  const d = desempenhoPorZona(sets, fundamento, atletaId || undefined)
  const maxPct = Math.max(1, ...Object.values(d.porZona).map((l) => l.pct))
  // Só aparece no filtro quem tem bola com zona nesse fundamento.
  const comZona = new Set<string>()
  for (const s of sets) for (const r of s.rallies) for (const e of r.eventos) {
    if (e.ladoResponsavel !== 'ADVERSARIO' && e.fundamento === fundamento && e.zona && e.atletaId) comZona.add(e.atletaId)
  }
  const opcoes = atletas.filter((a) => comZona.has(a.id)).sort((a, b) => a.nome.localeCompare(b.nome))

  return (
    <Secao titulo="Pra onde vai a bola" icon={<Grid3x3 size={16} />}
      dica="Zonas marcadas na quadrinha do scout ao vivo. O número grande é a parte das bolas que foi pra cada zona; embaixo, quantas viraram ponto. Quanto mais dourada a zona, mais bolas foram pra lá.">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl mb-2" style={{ background: 'var(--rd-bg)' }} role="group" aria-label="Fundamento">
        {(['ataque', 'saque'] as FundamentoScout[]).map((f) => (
          <button key={f} onClick={() => { setFundamento(f); setAtletaId('') }} aria-pressed={fundamento === f}
            className="rounded-lg text-xs font-bold" style={{ minHeight: 36, background: fundamento === f ? 'var(--rd-surface)' : 'transparent', color: fundamento === f ? undefined : 'var(--rd-text-dim)' }}>
            {f === 'ataque' ? 'Ataque' : 'Saque'}
          </button>
        ))}
      </div>
      <select className="rd-input mb-3" value={atletaId} onChange={(e) => setAtletaId(e.target.value)} style={{ minHeight: 44 }} aria-label="Atleta">
        <option value="">Time todo</option>
        {opcoes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
      </select>

      {d.comZona === 0 ? (
        <p className="text-xs text-[var(--rd-text-dim)]">Nenhuma bola com zona marcada aqui.</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '2px solid #d4af37', background: '#0b0a08' }}>
          <div className="h-2" style={{ background: 'repeating-linear-gradient(90deg, #d4af37 0 8px, #f1c40f 8px 16px)' }} aria-label="Rede" />
          <div className="grid grid-cols-3">
            {DESENHO_QUADRA.flat().map((z) => {
              const l = d.porZona[z]
              const forca = l.total ? 0.25 + 0.75 * (l.pct / maxPct) : 0
              return (
                <div key={z} className="text-center py-2.5 relative" style={{ background: `rgba(212,175,55,${forca * 0.55})`, border: '1px dashed rgba(212,175,55,.55)', minHeight: 74 }}>
                  <div className="absolute top-1 left-1.5 text-[10px] font-black" style={{ color: '#d4af37' }}>{z}</div>
                  {l.total ? (
                    <>
                      <div className="text-lg font-black tabular-nums leading-tight" style={{ color: '#f1c40f' }}>{l.pct}%</div>
                      <div className="text-[10px] text-white/90 tabular-nums">{l.total} bola(s)</div>
                      <div className="inline-block mt-0.5 px-1.5 rounded text-[10px] font-black tabular-nums" style={{ background: 'rgba(0,0,0,.6)', color: fundamento === 'saque' ? corAce(l.pctPonto) : corPct(l.pctPonto) }}>{l.pontos} pts · {l.pctPonto}%</div>
                    </>
                  ) : <div className="text-sm mt-3" style={{ color: 'rgba(212,175,55,.45)' }}>—</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}
      <p className="text-[11px] text-[var(--rd-text-dim)] mt-2 tabular-nums">{d.comZona} bola(s) com zona · {d.semZona} sem zona</p>
    </Secao>
  )
}
