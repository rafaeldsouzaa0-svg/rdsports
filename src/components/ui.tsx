import type { ReactNode } from 'react'
import { useSyncStatus, type SincronizacaoStatus } from '../syncStatus'

const SYNC_LABEL: Record<SincronizacaoStatus, string> = {
  desligado: 'Salvo neste aparelho',
  offline: 'Sem internet — salvo aqui',
  pendente: 'Salvando…',
  sincronizando: 'Enviando…',
  sincronizado: 'Sincronizado',
  erro: 'Não sincronizou — tentando de novo',
}
const SYNC_COR: Record<SincronizacaoStatus, string> = {
  desligado: 'var(--rd-text-dim)',
  offline: 'var(--rd-neutro)',
  pendente: 'var(--rd-neutro)',
  sincronizando: 'var(--rd-neutro)',
  sincronizado: 'var(--rd-positivo)',
  erro: 'var(--rd-erro)',
}

/** Indicador discreto de sincronização (pedido da auditoria 30/10/2026):
 *  mostra se a última ação registrada já chegou na nuvem ou ainda está só
 *  neste aparelho — nunca mostra "sincronizado" enquanto houver uma mudança
 *  pendente de enviar. Pensado pra caber no topo da tela de scout ao vivo,
 *  sem chamar atenção (só uma bolinha + texto pequeno). */
export function IndicadorSync({ className = '' }: { className?: string }) {
  const status = useSyncStatus((s) => s.status)
  if (status === 'desligado') return null // sem conta logada: não há o que indicar
  return (
    <div className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${className}`} style={{ color: SYNC_COR[status] }}>
      <span
        className="inline-block rounded-full shrink-0"
        style={{ width: 6, height: 6, background: SYNC_COR[status], animation: status === 'sincronizando' || status === 'pendente' ? 'rd-pulse 1s ease-in-out infinite' : undefined }}
      />
      {SYNC_LABEL[status]}
    </div>
  )
}

export function PageTitle({ icon, title, subtitle, action }: { icon?: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          {icon && <span className="inline-flex shrink-0 rd-accent-text">{icon}</span>}
          {title}
        </h1>
        {subtitle && <p className="text-sm text-[var(--rd-text-dim)] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ icon, text, action }: { icon: ReactNode; text: string; action?: ReactNode }) {
  return (
    <div className="rd-card p-10 text-center text-[var(--rd-text-dim)] flex flex-col items-center gap-3">
      <span className="text-4xl inline-flex items-center justify-center opacity-70">{icon}</span>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`rd-card p-4 ${className}`} style={style}>{children}</div>
}

export function Button({ children, variant = 'default', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'gold' | 'danger' }) {
  const cls = variant === 'gold' ? 'rd-btn rd-btn-gold' : variant === 'danger' ? 'rd-btn rd-btn-danger' : 'rd-btn'
  return <button className={`${cls} ${className}`} {...props}>{children}</button>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
    </label>
  )
}
