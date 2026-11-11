import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import type { Partida } from '../types'
import { formatDate } from '../utils'

export interface PontoEvolucao {
  partida: Partida
  /** Eficiência em % (-100 a 100). */
  eficiencia: number
  /** Linha extra no detalhe (ex.: "12 ações"). */
  detalhe?: string
}

/** Gráfico de barras da evolução jogo a jogo, TOCÁVEL (pedido 11/11/2026):
 *  tocar numa barra destaca o jogo e mostra o resumo dele com o botão pra
 *  abrir o relatório daquela partida. Usado no perfil da atleta e na
 *  Temporada. Sem biblioteca de gráfico — só divs, como antes. */
export default function GraficoEvolucao({ pontos, cor }: { pontos: PontoEvolucao[]; cor: (ef: number) => string }) {
  const navigate = useNavigate()
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const atual = pontos.find((p) => p.partida.id === selecionado)

  return (
    <div>
      <div className="flex items-end gap-1.5 h-28" role="group" aria-label="Evolução jogo a jogo — toque numa barra pra ver o jogo">
        {pontos.map(({ partida, eficiencia }, i) => {
          const alturaPct = Math.max(4, ((eficiencia + 100) / 200) * 100) // -100%..100% → 0..100%
          const ativo = selecionado === partida.id
          const apagado = selecionado !== null && !ativo
          return (
            <button
              key={partida.id}
              type="button"
              onClick={() => setSelecionado(ativo ? null : partida.id)}
              aria-pressed={ativo}
              aria-label={`${i + 1}º jogo: vs ${partida.adversarioNome ?? 'Adversário'}, ${formatDate(partida.data)}, eficiência ${eficiencia}%`}
              className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1 rounded-md transition-opacity"
              style={{ opacity: apagado ? 0.4 : 1, minWidth: 20 }}
            >
              <span className="text-[10px] font-bold" style={{ color: cor(eficiencia) }}>{eficiencia}%</span>
              <span
                className="w-full rounded-t transition-all"
                style={{
                  height: `${alturaPct}%`, background: cor(eficiencia), minHeight: 3,
                  outline: ativo ? '2px solid var(--rd-text)' : 'none', outlineOffset: 2,
                }}
              />
              <span className="text-[9px] text-[var(--rd-text-dim)]">{i + 1}º</span>
            </button>
          )
        })}
      </div>

      {atual ? (
        <div className="mt-3 rounded-lg px-3 py-2.5 flex items-center gap-3 flex-wrap" style={{ border: '1px solid var(--rd-border)' }} aria-live="polite">
          <div className="flex-1 min-w-[160px]">
            <div className="font-semibold text-sm">vs {atual.partida.adversarioNome ?? 'Adversário'}</div>
            <div className="text-xs text-[var(--rd-text-dim)]">
              {formatDate(atual.partida.data)} · {atual.partida.setsGanhosCasa}×{atual.partida.setsGanhosAdversario} sets
              {' · '}<span className="font-bold" style={{ color: cor(atual.eficiencia) }}>{atual.eficiencia}%</span>
              {atual.detalhe ? ` · ${atual.detalhe}` : ''}
            </div>
          </div>
          <button className="rd-btn rd-btn-gold text-sm" style={{ minHeight: 44 }} onClick={() => { navigate(`/relatorio/${atual.partida.id}`); window.scrollTo(0, 0) }}>
            <FileText size={16} /> Abrir relatório
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-[var(--rd-text-dim)] mt-2">Toque numa barra pra ver o jogo e abrir o relatório.</p>
      )}
    </div>
  )
}
