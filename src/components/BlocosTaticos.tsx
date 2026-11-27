// Blocos da análise tática "nível Data Volley" (Etapa 1, pedido 27/11/2026).
// Usados na aba Estatísticas (aba Tática) e no Relatório da partida.
import { useState } from 'react'
import { Gauge, Swords, RotateCw, Share2 } from 'lucide-react'
import type { Atleta, SetPartida } from '../types'
import { LABEL_POSICAO, normalizarPosicao } from '../types'
import { ataquePorRecepcao, ataquePorFase, desempenhoPorRodizio, distribuicaoAtaque } from '../analiseAvancada'
import { Secao, Kpi, corEf, corPct } from './estatisticaUi'
import { Card } from './ui'

const ROMANO = ['I', 'II', 'III', 'IV', 'V', 'VI']

/** Break point é naturalmente mais baixo que side-out (quem recebe tem
 *  vantagem): acima de 45% já é muito bom. */
function corBreak(pct: number): string {
  if (pct >= 45) return 'var(--rd-positivo)'
  if (pct >= 30) return 'var(--rd-neutro)'
  return 'var(--rd-erro)'
}

export function BlocoAtaquePorRecepcao({ sets }: { sets: SetPartida[] }) {
  const linhas = ataquePorRecepcao(sets)
  if (linhas.length === 0) return null
  return (
    <Secao titulo="Ataque conforme a recepção" icon={<Gauge size={16} />}
      dica="Quanto melhor a recepção, mais o ataque deveria render. Se a recepção boa não vira ponto, o problema está no levantamento ou no ataque; se a média derruba muito, vale treinar recepção.">
      <div className="grid gap-2">
        {linhas.map((l) => (
          <div key={l.qualidade} className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--rd-border)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold">{l.label}</span>
              <span className="text-[11px] text-[var(--rd-text-dim)] tabular-nums">{l.recepcoes} vez(es)</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-1.5 text-center">
              <div>
                <div className="text-[10px] font-bold uppercase text-[var(--rd-text-dim)]">Side-out</div>
                <div className="text-lg font-black tabular-nums" style={{ color: corPct(l.sideOutPct) }}>{l.sideOutPct}%</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-[var(--rd-text-dim)]">Ataque efic.</div>
                <div className="text-lg font-black tabular-nums" style={l.ataque.total ? { color: corEf(l.ataque.eficiencia) } : undefined}>{l.ataque.total ? `${l.ataque.eficiencia}%` : '—'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-[var(--rd-text-dim)]">Ataque ponto</div>
                <div className="text-lg font-black tabular-nums">{l.ataque.total ? `${l.killPct}%` : '—'}</div>
              </div>
            </div>
            {l.ataque.total > 0 && (
              <div className="text-[11px] text-[var(--rd-text-dim)] text-center tabular-nums">{l.ataque.positivo} pontos · {l.ataque.erro} erros em {l.ataque.total} ataques</div>
            )}
          </div>
        ))}
      </div>
    </Secao>
  )
}

export function BlocoAtaquePorFase({ sets }: { sets: SetPartida[] }) {
  const { k1, k2 } = ataquePorFase(sets)
  if (k1.ataque.total + k2.ataque.total === 0) return null
  const caixa = (titulo: string, sub: string, f: typeof k1) => (
    <Kpi label={titulo} valor={f.ataque.total ? `${f.ataque.eficiencia}%` : '—'} cor={f.ataque.total ? corEf(f.ataque.eficiencia) : undefined}
      sub={<>{sub}<br />{f.ataque.total ? `${f.killPct}% ponto · ${f.erroPct}% erro${f.bloqueados ? ` (${f.bloqueadoPct}% bloqueado)` : ''} · ${f.ataque.total} ataques` : 'sem ataques'}</>} />
  )
  return (
    <Secao titulo="Side-out × contra-ataque" icon={<Swords size={16} />}
      dica="Side-out (K1) = primeiro ataque depois da nossa recepção. Contra-ataque (K2) = ataque depois de defesa, bloqueio ou bola de graça. Times bons costumam ir bem no K1; o K2 mostra quem vence os rallies longos.">
      <div className="grid grid-cols-2 gap-2">
        {caixa('Side-out (K1)', 'depois da recepção', k1)}
        {caixa('Contra-ataque (K2)', 'depois da defesa', k2)}
      </div>
    </Secao>
  )
}

export function BlocoRodizios({ sets, atletas }: { sets: SetPartida[]; atletas: Atleta[] }) {
  const levantadoras = new Set(atletas.filter((a) => normalizarPosicao(a.posicaoPrincipal) === 'LEVANTADORA').map((a) => a.id))
  const r = desempenhoPorRodizio(sets, levantadoras)
  const comDados = r.linhas.filter((l) => l.sideOutOportunidades + l.breakOportunidades > 0)
  if (comDados.length === 0) return null
  const pior = [...comDados].sort((a, b) => a.saldo - b.saldo)[0]
  const melhor = [...comDados].sort((a, b) => b.saldo - a.saldo)[0]
  const nome = (i: number) => (r.modo === 'levantadora' ? `P${i + 1}` : `R${i + 1}`)
  const dica = r.modo === 'levantadora'
    ? 'P1 a P6 = em que posição a levantadora estava (P1 = levantadora na posição I, como no Data Volley).'
    : 'R1 = escalação de saída do set; R2 depois do 1º giro, e assim por diante. Cadastre a posição "Levantadora" no perfil da atleta pra ver P1 a P6, como no Data Volley.'
  return (
    <Secao titulo="Side-out e break por rodízio" icon={<RotateCw size={16} />}
      dica={`${dica}${r.ignorados ? ` ${r.ignorados} rally(s) sem papeleta ficaram de fora.` : ''}`}>
      {pior.saldo < 0 && pior.rodizio !== melhor.rodizio && (
        <p className="text-xs mb-3 p-2.5 rounded-lg" style={{ background: 'rgba(231,76,60,.1)', border: '1px solid rgba(231,76,60,.3)' }}>
          Rodízio que mais sofre: <b>{nome(pior.rodizio)}</b> (saldo {pior.saldo}). Melhor: <b>{nome(melhor.rodizio)}</b> ({melhor.saldo > 0 ? '+' : ''}{melhor.saldo}).
        </p>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[var(--rd-text-dim)]">
            <th className="text-left font-semibold py-1">Rodízio</th>
            <th className="text-center font-semibold">Side-out</th>
            <th className="text-center font-semibold">Break</th>
            <th className="text-right font-semibold">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {r.linhas.map((l) => {
            const vazio = l.sideOutOportunidades + l.breakOportunidades === 0
            return (
              <tr key={l.rodizio} className="border-t" style={{ borderColor: 'var(--rd-border)' }}>
                <td className="py-2 font-black">{nome(l.rodizio)}{r.modo === 'levantadora' && <span className="font-normal text-[10px] text-[var(--rd-text-dim)]"> lev. na {ROMANO[l.rodizio]}</span>}</td>
                <td className="text-center tabular-nums">
                  {l.sideOutOportunidades ? <><b style={{ color: corPct(l.sideOutPct) }}>{l.sideOutPct}%</b> <span className="text-[10px] text-[var(--rd-text-dim)]">{l.sideOutPontos}/{l.sideOutOportunidades}</span></> : '—'}
                </td>
                <td className="text-center tabular-nums">
                  {l.breakOportunidades ? <><b style={{ color: corBreak(l.breakPct) }}>{l.breakPct}%</b> <span className="text-[10px] text-[var(--rd-text-dim)]">{l.breakPontos}/{l.breakOportunidades}</span></> : '—'}
                </td>
                <td className="text-right font-bold tabular-nums" style={vazio ? undefined : { color: l.saldo >= 0 ? 'var(--rd-positivo)' : 'var(--rd-erro)' }}>
                  {vazio ? '—' : `${l.saldo > 0 ? '+' : ''}${l.saldo}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Secao>
  )
}

export function BlocoDistribuicao({ sets, atletas }: { sets: SetPartida[]; atletas: Atleta[] }) {
  const [porFuncao, setPorFuncao] = useState(false)
  const porId = new Map(atletas.map((a) => [a.id, a]))
  const grupos = distribuicaoAtaque(sets, (id) => normalizarPosicao(porId.get(id)?.posicaoPrincipal))
  if (grupos.length === 0) return null
  const rotulo = (chave: string) => {
    if (!porFuncao) return porId.get(chave)?.nome ?? 'Atleta removida'
    return chave === 'SEM_POSICAO' ? 'Sem posição' : LABEL_POSICAO[chave as keyof typeof LABEL_POSICAO] ?? chave
  }
  return (
    <Secao titulo="Distribuição do ataque" icon={<Share2 size={16} />}
      dica="Pra quem a bola foi atacada em cada situação. Ajuda a ver se a levantadora está previsível ou se uma atacante está sobrecarregada.">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl mb-3" style={{ background: 'var(--rd-bg)' }} role="group" aria-label="Ver por">
        {[false, true].map((v) => (
          <button key={String(v)} onClick={() => setPorFuncao(v)} aria-pressed={porFuncao === v}
            className="rounded-lg text-xs font-bold" style={{ minHeight: 36, background: porFuncao === v ? 'var(--rd-surface)' : 'transparent', color: porFuncao === v ? undefined : 'var(--rd-text-dim)' }}>
            {v ? 'Por posição' : 'Por atleta'}
          </button>
        ))}
      </div>
      <div className="grid gap-4">
        {grupos.map((g) => {
          const itens = porFuncao ? g.porFuncao : g.porAtleta
          return (
            <div key={g.situacao}>
              <div className="text-xs font-bold mb-1.5 flex justify-between"><span>{g.label}</span><span className="text-[var(--rd-text-dim)]">{g.total} ataques</span></div>
              <div className="grid gap-1.5">
                {itens.map((it) => (
                  <div key={it.chave}>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="truncate">{rotulo(it.chave)}</span>
                      <span className="shrink-0 tabular-nums">
                        <b>{it.pct}%</b> <span className="text-[var(--rd-text-dim)]">({it.total})</span> · <b style={{ color: corEf(it.eficiencia) }}>{it.eficiencia}%</b> <span className="text-[10px] text-[var(--rd-text-dim)]">efic.</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mt-0.5">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(3, it.pct)}%`, background: 'var(--rd-gold)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Secao>
  )
}

/** Todos os blocos táticos, na ordem. */
export default function BlocosTaticos({ sets, atletas }: { sets: SetPartida[]; atletas: Atleta[] }) {
  const temLances = sets.some((s) => s.rallies.some((r) => r.eventos.some((e) => e.ladoResponsavel !== 'ADVERSARIO' && (e.fundamento === 'ataque' || e.fundamento === 'recepcao'))))
  if (!temLances) {
    return <Card><p className="text-xs text-[var(--rd-text-dim)]">Ainda não há ataques ou recepções marcados pra montar a análise tática.</p></Card>
  }
  return (
    <div className="grid gap-4">
      <BlocoAtaquePorRecepcao sets={sets} />
      <BlocoAtaquePorFase sets={sets} />
      <BlocoRodizios sets={sets} atletas={atletas} />
      <BlocoDistribuicao sets={sets} atletas={atletas} />
    </div>
  )
}
