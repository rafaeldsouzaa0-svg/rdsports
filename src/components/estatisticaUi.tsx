// Peças visuais das telas de estatística (aba Estatísticas e Relatório).
import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Card } from './ui'

export function corEf(ef: number): string {
  if (ef >= 50) return 'var(--rd-positivo)'
  if (ef >= 0) return 'var(--rd-neutro)'
  return 'var(--rd-erro)'
}
export function corPct(pct: number): string {
  if (pct >= 55) return 'var(--rd-positivo)'
  if (pct >= 40) return 'var(--rd-neutro)'
  return 'var(--rd-erro)'
}

export function Secao({ titulo, icon, children, dica }: { titulo: string; icon?: ReactNode; children: ReactNode; dica?: string }) {
  return (
    <Card>
      <h2 className="text-sm font-black mb-3 flex items-center gap-2">
        {icon && <span className="rd-accent-text inline-flex">{icon}</span>}
        {titulo}
      </h2>
      {children}
      {dica && <p className="text-[11px] text-[var(--rd-text-dim)] mt-3 flex gap-1.5"><Info size={12} className="shrink-0 mt-0.5" />{dica}</p>}
    </Card>
  )
}

export function Kpi({ label, valor, sub, cor }: { label: string; valor: ReactNode; sub?: ReactNode; cor?: string }) {
  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--rd-border)' }}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--rd-text-dim)]">{label}</div>
      <div className="text-xl font-black leading-tight mt-0.5 tabular-nums" style={cor ? { color: cor } : undefined}>{valor}</div>
      {sub && <div className="text-[11px] text-[var(--rd-text-dim)] mt-0.5">{sub}</div>}
    </div>
  )
}

export function BarraHorizontal({ label, valor, max, cor, direita }: { label: string; valor: number; max: number; cor: string; direita: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1 gap-2">
        <span className="truncate">{label}</span>
        <span className="font-bold tabular-nums shrink-0">{direita}</span>
      </div>
      <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${max > 0 ? Math.max(3, (valor / max) * 100) : 0}%`, background: cor }} />
      </div>
    </div>
  )
}
