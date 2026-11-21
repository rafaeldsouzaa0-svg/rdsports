// Chamada do treino (pedido 21/11/2026): marcar quem veio e quem faltou em
// cada dia de treino da turma. A frequência de cada atleta aparece na lista
// de atletas da turma e na convocação.
import { useState } from 'react'
import { ClipboardCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '../store'
import { Card, Button } from './ui'
import { chamadaDoDia, historicoChamadas } from '../chamada'
import { isoDia, formatDate } from '../utils'
import type { Atleta } from '../types'

// Lista vazia fixa: aparelho com dados salvos antes da chamada existir ainda
// não tem `chamadas` — e um `[]` novo a cada leitura faria a tela redesenhar
// sem parar.
const SEM_CHAMADAS: never[] = []

export default function ChamadaCard({ turmaId, atletas }: { turmaId: string; atletas: Atleta[] }) {
  const chamadas = useStore((s) => s.chamadas ?? SEM_CHAMADAS)
  const marcarChamada = useStore((s) => s.marcarChamada)
  const marcarTodasNaChamada = useStore((s) => s.marcarTodasNaChamada)
  const hoje = isoDia(new Date())
  const [aberta, setAberta] = useState(false)
  const [data, setData] = useState(hoje)

  const doDia = chamadaDoDia(chamadas, turmaId, data)?.presencas ?? {}
  const vieram = atletas.filter((a) => doDia[a.id] === true).length
  const faltaram = atletas.filter((a) => doDia[a.id] === false).length
  const semMarcar = atletas.length - vieram - faltaram
  const ultimas = historicoChamadas(chamadas, turmaId).slice(0, 5)

  function alternar(atletaId: string, valor: boolean) {
    // Tocar de novo no mesmo botão desmarca (caso tenha marcado errado).
    marcarChamada(turmaId, data, atletaId, doDia[atletaId] === valor ? null : valor)
  }

  return (
    <Card className="mb-5">
      <button type="button" className="w-full flex items-center justify-between gap-2 text-left" onClick={() => setAberta((v) => !v)}>
        <span className="font-bold text-sm flex items-center gap-2"><ClipboardCheck size={18} /> Chamada do treino</span>
        <span className="text-xs text-[var(--rd-text-dim)] flex items-center gap-1">
          {data === hoje ? 'Hoje' : formatDate(data)}: {vieram}/{atletas.length} vieram
          {aberta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {aberta && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--rd-border)' }}>
          <div className="flex items-end gap-2 flex-wrap mb-3">
            <label className="text-xs text-[var(--rd-text-dim)] flex flex-col gap-1">
              Dia do treino
              <input type="date" className="rd-input" value={data} max={hoje} onChange={(e) => e.target.value && setData(e.target.value)} />
            </label>
            {semMarcar > 0 && (
              <Button onClick={() => marcarTodasNaChamada(turmaId, data, atletas.map((a) => a.id))}>
                ✓ Marcar as outras {semMarcar} como presentes
              </Button>
            )}
          </div>

          {atletas.length === 0 ? (
            <p className="text-sm text-[var(--rd-text-dim)]">Cadastre as atletas da turma pra fazer a chamada.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {atletas.map((a) => {
                const valor = doDia[a.id]
                return (
                  <div key={a.id} className="flex items-center justify-between gap-2 py-1">
                    <span className="text-sm font-semibold truncate">{a.nome}</span>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button" onClick={() => alternar(a.id, true)} aria-pressed={valor === true}
                        className="rd-btn text-xs"
                        style={valor === true ? { background: 'var(--rd-positivo)', borderColor: 'var(--rd-positivo)', color: '#fff' } : undefined}
                      >✓ Veio</button>
                      <button
                        type="button" onClick={() => alternar(a.id, false)} aria-pressed={valor === false}
                        className="rd-btn text-xs"
                        style={valor === false ? { background: 'var(--rd-erro)', borderColor: 'var(--rd-erro)', color: '#fff' } : undefined}
                      >✗ Faltou</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-xs text-[var(--rd-text-dim)] mt-3">
            {vieram} vieram · {faltaram} faltaram{semMarcar > 0 ? ` · ${semMarcar} sem marcar` : ''}. Salva sozinho.
          </p>

          {ultimas.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--rd-border)' }}>
              <div className="text-xs font-semibold mb-1.5 text-[var(--rd-text-dim)]">Últimas chamadas (toque pra abrir)</div>
              <div className="flex flex-wrap gap-1.5">
                {ultimas.map((c) => {
                  const v = Object.values(c.presencas).filter(Boolean).length
                  const total = Object.keys(c.presencas).length
                  return (
                    <button key={c.id} type="button" className={`rd-btn text-xs ${c.data === data ? 'rd-btn-gold' : ''}`} onClick={() => setData(c.data)}>
                      {formatDate(c.data)} · {v}/{total}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
