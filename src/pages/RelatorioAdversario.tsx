// Relatório do adversário (pedido 27/11/2026): escolhe o adversário e vê
// tudo o que já aconteceu contra ele, com dicas pro próximo jogo.
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Swords, Lightbulb, Shirt, ShieldAlert, Target, Users, Copy, Send, Search, FileText, Trophy } from 'lucide-react'
import { useStore } from '../store'
import { PageTitle, Card, EmptyState, BotaoVoltar } from '../components/ui'
import { Secao, Kpi, BarraHorizontal, corEf, corPct } from '../components/estatisticaUi'
import { adversariosComJogos, relatorioAdversario, textoRelatorioAdversario } from '../relatorioAdversario'
import { linkWhatsApp } from '../convocacao'
import { formatDate } from '../utils'
import { normalizarPosicao } from '../types'

function Lista() {
  const { partidas, turmas } = useStore()
  const [busca, setBusca] = useState('')
  const lista = adversariosComJogos(partidas)
  const filtrada = lista.filter((a) => a.chave.includes(busca.trim().toLowerCase()))
  return (
    <div>
      <PageTitle icon={<Swords size={22} />} title="Adversários" subtitle="Relatório de cada time que vocês já enfrentaram" />
      {lista.length === 0 ? (
        <EmptyState icon={<Swords size={40} />} text="Ainda não há jogos finalizados contra nenhum adversário." />
      ) : (
        <>
          <label className="relative block mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rd-text-dim)]" />
            <input className="rd-input w-full" style={{ paddingLeft: 36, minHeight: 44 }} placeholder="Procurar adversário" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
          <div className="grid gap-2">
            {filtrada.map((a) => (
              <Link key={a.chave} to={`/adversario?nome=${encodeURIComponent(a.nome)}`} className="rd-card flex items-center gap-3 px-4 py-3" style={{ minHeight: 60 }}>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold truncate">{a.nome}</span>
                  <span className="block text-xs text-[var(--rd-text-dim)]">{a.jogos} jogo(s) · último em {formatDate(a.ultimaData)}</span>
                </span>
                <span className="text-sm font-black tabular-nums"><span style={{ color: 'var(--rd-positivo)' }}>{a.vitorias}V</span> <span style={{ color: 'var(--rd-erro)' }}>{a.derrotas}D</span></span>
              </Link>
            ))}
          </div>
          {turmas.length > 0 && <p className="text-[11px] text-[var(--rd-text-dim)] mt-3">Jogos finalizados de todas as turmas. Dentro do relatório dá pra filtrar por turma.</p>}
        </>
      )}
    </div>
  )
}

function Relatorio({ nome }: { nome: string }) {
  const { partidas, turmas, atletas } = useStore()
  const [turmaId, setTurmaId] = useState('')
  const [copiado, setCopiado] = useState(false)
  const levantadoras = useMemo(() => new Set(atletas.filter((a) => normalizarPosicao(a.posicaoPrincipal) === 'LEVANTADORA').map((a) => a.id)), [atletas])
  const r = useMemo(() => relatorioAdversario(partidas, nome, { turmaId: turmaId || undefined, levantadoras }), [partidas, nome, turmaId, levantadoras])
  const turmasQueJogaram = useMemo(() => {
    const ids = new Set(relatorioAdversario(partidas, nome).jogos.map((p) => p.turmaId))
    return turmas.filter((t) => ids.has(t.id))
  }, [partidas, nome, turmas])
  const nomeAtleta = (id: string) => atletas.find((a) => a.id === id)?.nome ?? 'Atleta removida'
  const texto = textoRelatorioAdversario(r, turmaId ? turmas.find((t) => t.id === turmaId)?.nome : undefined)

  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { /* sem permissão: nada */ }
  }

  return (
    <div>
      <BotaoVoltar to="/adversario" label="Adversários" />
      <PageTitle icon={<Swords size={22} />} title={r.nome} subtitle={`${r.resumo.jogos} jogo(s) contra eles`} />

      {turmasQueJogaram.length > 1 && (
        <select className="rd-input w-full mb-3" value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={{ minHeight: 44 }} aria-label="Turma">
          <option value="">Todas as turmas</option>
          {turmasQueJogaram.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      )}

      {r.jogos.length === 0 ? (
        <EmptyState icon={<Swords size={40} />} text="Nenhum jogo finalizado contra esse adversário (com esse filtro)." />
      ) : (
        <div className="grid gap-4">
          <Secao titulo="Retrospecto" icon={<Trophy size={16} />}>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Jogos" valor={`${r.resumo.vitorias}V · ${r.resumo.derrotas}D`} sub={`${r.resumo.jogos} jogo(s)`} />
              <Kpi label="Sets" valor={`${r.resumo.setsGanhos} × ${r.resumo.setsPerdidos}`} />
              <Kpi label="Pontos" valor={`${r.resumo.pontosFeitos} × ${r.resumo.pontosSofridos}`} sub={`saldo ${r.resumo.saldoPontos > 0 ? '+' : ''}${r.resumo.saldoPontos}`} cor={r.resumo.saldoPontos >= 0 ? 'var(--rd-positivo)' : 'var(--rd-erro)'} />
              <Kpi label="Side-out / Break" valor={`${r.sideOutPct ?? '—'}% / ${r.breakPct ?? '—'}%`} cor={r.sideOutPct !== null ? corPct(r.sideOutPct) : undefined} />
            </div>
            <div className="grid gap-1.5 mt-3">
              {[...r.jogos].reverse().map((p) => (
                <Link key={p.id} to={`/relatorio/${p.id}`} className="flex items-center gap-2 text-sm rounded-lg border px-3 py-2" style={{ borderColor: 'var(--rd-border)', minHeight: 44 }}>
                  <span className="w-6 h-6 rounded grid place-items-center text-[11px] font-black text-white" style={{ background: p.setsGanhosCasa > p.setsGanhosAdversario ? 'var(--rd-positivo)' : 'var(--rd-erro)' }}>{p.setsGanhosCasa > p.setsGanhosAdversario ? 'V' : 'D'}</span>
                  <span className="flex-1">{formatDate(p.data)} · {turmas.find((t) => t.id === p.turmaId)?.nome ?? ''}</span>
                  <span className="font-bold tabular-nums">{p.setsGanhosCasa}×{p.setsGanhosAdversario}</span>
                  <FileText size={14} className="text-[var(--rd-text-dim)]" />
                </Link>
              ))}
            </div>
          </Secao>

          {r.dicas.length > 0 && (
            <Secao titulo="O que fazer no próximo jogo" icon={<Lightbulb size={16} />}>
              <ul className="grid gap-2">
                {r.dicas.map((d) => (
                  <li key={d} className="text-sm flex gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(212,175,55,.08)', border: '1px solid rgba(212,175,55,.3)' }}>
                    <span aria-hidden>👉</span><span>{d}</span>
                  </li>
                ))}
              </ul>
            </Secao>
          )}

          {r.pontosDeles.length > 0 && (
            <Secao titulo="Como eles fizeram ponto" icon={<ShieldAlert size={16} />} dica="Inclui os pontos que eles fizeram direto e os nossos erros (que viram ponto deles).">
              <div className="grid gap-2">
                {r.pontosDeles.map((i) => (
                  <BarraHorizontal key={i.chave} label={i.label} valor={i.valor} max={r.pontosDeles[0].valor} cor="var(--rd-erro)" direita={<>{i.valor} <span className="text-[var(--rd-text-dim)] font-normal">({i.pct}%)</span></>} />
                ))}
              </div>
            </Secao>
          )}

          {(r.camisasPerigosas.length > 0 || r.camisasQueErram.length > 0) && (
            <Secao titulo="Camisas deles" icon={<Shirt size={16} />} dica="Só aparecem as camisas que foram anotadas no scout (o número do adversário é opcional na hora de marcar).">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold mb-1.5">Mais pontuaram</div>
                  {r.camisasPerigosas.length === 0 ? <p className="text-xs text-[var(--rd-text-dim)]">—</p> : r.camisasPerigosas.map((c) => (
                    <div key={c.numero} className="flex justify-between text-sm py-1 border-b last:border-b-0" style={{ borderColor: 'var(--rd-border)' }}>
                      <span className="font-black">#{c.numero}</span><span className="tabular-nums" style={{ color: 'var(--rd-erro)' }}>{c.pontos} pts</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-bold mb-1.5">Mais erraram</div>
                  {r.camisasQueErram.length === 0 ? <p className="text-xs text-[var(--rd-text-dim)]">—</p> : r.camisasQueErram.map((c) => (
                    <div key={c.numero} className="flex justify-between text-sm py-1 border-b last:border-b-0" style={{ borderColor: 'var(--rd-border)' }}>
                      <span className="font-black">#{c.numero}</span><span className="tabular-nums" style={{ color: 'var(--rd-positivo)' }}>{c.erros} erros</span>
                    </div>
                  ))}
                </div>
              </div>
            </Secao>
          )}

          {r.errosDeles.length > 0 && (
            <Secao titulo="Onde eles mais erram" icon={<Target size={16} />}>
              <div className="grid gap-2">
                {r.errosDeles.map((e) => (
                  <BarraHorizontal key={e.fundamento} label={e.label} valor={e.total} max={r.errosDeles[0].total} cor="var(--rd-gold)"
                    direita={<>{e.total} <span className="text-[var(--rd-text-dim)] font-normal">({e.porJogo.toLocaleString('pt-BR')} por jogo)</span></>} />
                ))}
              </div>
            </Secao>
          )}

          {r.nossosFundamentos.length > 0 && (
            <Secao titulo="Nosso time contra eles" icon={<Users size={16} />}>
              <div className="grid grid-cols-2 gap-2">
                {r.nossosFundamentos.map((f) => (
                  <Kpi key={f.fundamento} label={f.label} valor={`${f.linha.eficiencia}%`} cor={corEf(f.linha.eficiencia)} sub={`${f.linha.positivo}+ · ${f.linha.erro}− · ${f.linha.total}`} />
                ))}
              </div>
              {r.destaques.length > 0 && (
                <>
                  <div className="text-xs font-bold mt-4 mb-1.5">Quem mais rendeu contra eles</div>
                  {r.destaques.map((l) => (
                    <div key={l.atletaId} className="flex justify-between text-sm py-1.5 border-b last:border-b-0" style={{ borderColor: 'var(--rd-border)' }}>
                      <span className="font-semibold truncate">{nomeAtleta(l.atletaId)}</span>
                      <span className="tabular-nums shrink-0">{l.pontos} pts · {l.errosQueDeramPonto} erros · <b style={{ color: corEf(l.totalGeral.eficiencia) }}>{l.totalGeral.eficiencia}%</b></span>
                    </div>
                  ))}
                </>
              )}
            </Secao>
          )}

          <Card>
            <div className="text-sm font-black mb-2">Mandar pra comissão</div>
            <pre className="text-xs whitespace-pre-wrap p-3 rounded-lg mb-3" style={{ background: 'var(--rd-bg)', fontFamily: 'inherit' }}>{texto}</pre>
            <div className="grid grid-cols-2 gap-2">
              <button className="rd-btn" style={{ minHeight: 44 }} onClick={copiar}><Copy size={16} /> {copiado ? 'Copiado!' : 'Copiar'}</button>
              <button className="rd-btn" style={{ minHeight: 44, background: '#25D366', borderColor: '#25D366', color: '#fff' }} onClick={() => window.open(linkWhatsApp(texto), '_blank')}><Send size={16} /> WhatsApp</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function RelatorioAdversario() {
  const [params] = useSearchParams()
  const nome = params.get('nome')
  return nome ? <Relatorio nome={nome} /> : <Lista />
}
