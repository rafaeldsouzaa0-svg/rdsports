// Modo banco (pedido 27/11/2026): tela pro técnico no banco acompanhar o jogo
// ao vivo num 2º aparelho, enquanto outra pessoa faz o scout. Só leitura —
// ver src/modoBanco.ts.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MonitorSmartphone, RefreshCw, Repeat, Flame, Users, Target, FileText, Volleyball } from 'lucide-react'
import { useStore } from '../store'
import { useAuthStore } from '../authStore'
import { PageTitle, Card, EmptyState, BotaoVoltar } from '../components/ui'
import { Secao, Kpi, BarraHorizontal, corEf, corPct } from '../components/estatisticaUi'
import { listarJogosEmAndamento, lerJogoAoVivo, INTERVALO_ATUALIZACAO_MS, type JogoEmAndamento } from '../modoBanco'
import { scoutEquipe, sideOutBreakPoint, calcularRotacao, FUNDAMENTOS_SCOUT, LABEL_FUNDAMENTO, pontoAPontoDoSet } from '../scoutEngine'
import { alertasTendencia, textoAlerta, desempenhoPorRodizio } from '../analiseAvancada'
import { origemDosPontos, estatisticasPorAtleta } from '../estatisticasCompletas'
import { normalizarPosicao, type Partida, type SetPartida } from '../types'
import { formatDate } from '../utils'

const ROMANO = ['I', 'II', 'III', 'IV', 'V', 'VI']

function ListaJogos() {
  const { turmas } = useStore()
  const [jogos, setJogos] = useState<JogoEmAndamento[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(() => {
    setErro(null)
    listarJogosEmAndamento().then(setJogos).catch(() => setErro('Não deu pra buscar os jogos. Confira a internet e tente de novo.'))
  }, [])
  useEffect(() => { carregar() }, [carregar])
  return (
    <div>
      <PageTitle icon={<MonitorSmartphone size={22} />} title="Modo banco" subtitle="Acompanhe ao vivo o jogo que outra pessoa está marcando" />
      <Card className="mb-4">
        <p className="text-xs text-[var(--rd-text-dim)]">
          Abra esta tela num 2º celular ou tablet, <b>com a mesma conta</b> de quem está fazendo o scout. Os números se atualizam sozinhos a cada poucos segundos. Esta tela só mostra; não marca nem muda nada no jogo.
        </p>
      </Card>
      {erro && <Card className="mb-3"><p className="text-sm" style={{ color: 'var(--rd-erro)' }}>{erro}</p></Card>}
      {jogos === null && !erro && <p className="text-sm text-[var(--rd-text-dim)]">Procurando jogos em andamento…</p>}
      {jogos && jogos.length === 0 && (
        <EmptyState icon={<Volleyball size={40} />} text="Nenhum jogo em andamento agora. Quando alguém começar o scout de um jogo, ele aparece aqui."
          action={<button className="rd-btn" onClick={carregar} style={{ minHeight: 44 }}><RefreshCw size={16} /> Procurar de novo</button>} />
      )}
      <div className="grid gap-2">
        {jogos?.map((j) => (
          <Link key={j.id} to={`/banco/${j.id}`} className="rd-card flex items-center gap-3 px-4 py-3" style={{ minHeight: 64 }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--rd-erro)', animation: 'rd-pulse 1s ease-in-out infinite' }} />
            <span className="flex-1 min-w-0">
              <span className="block font-bold truncate">vs {j.adversario}</span>
              <span className="block text-xs text-[var(--rd-text-dim)]">{turmas.find((t) => t.id === j.turmaId)?.nome ?? ''} · {formatDate(j.data)}</span>
            </span>
            <span className="font-black tabular-nums">{j.placarSets}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function PainelAoVivo({ partida, recorte }: { partida: Partida; recorte: 'set' | 'jogo' }) {
  const { atletas } = useStore()
  const nome = (id?: string) => (id ? atletas.find((a) => a.id === id)?.nome.split(' ')[0] ?? '—' : '—')
  const setAtual: SetPartida | undefined = partida.setsPartida[partida.setsPartida.length - 1]
  const sets = recorte === 'set' && setAtual ? [setAtual] : partida.setsPartida
  const rot = setAtual ? calcularRotacao(setAtual) : null
  const sb = sideOutBreakPoint(sets)
  const equipe = scoutEquipe(sets)
  const alertas = alertasTendencia(partida.setsPartida)
  const origem = origemDosPontos(sets)
  const levs = new Set(atletas.filter((a) => normalizarPosicao(a.posicaoPrincipal) === 'LEVANTADORA').map((a) => a.id))
  const rod = desempenhoPorRodizio(sets, levs)
  const piorRod = rod.linhas.filter((l) => l.pontosFeitos + l.pontosSofridos >= 3).sort((a, b) => a.saldo - b.saldo)[0]
  const porAtleta = estatisticasPorAtleta([{ ...partida, setsPartida: sets }]).sort((a, b) => b.saldo - a.saldo)
  const pontos = setAtual ? pontoAPontoDoSet(setAtual).slice(-12) : []

  return (
    <div className="grid gap-3">
      {alertas.length > 0 && (
        <div className="grid gap-1.5">
          {alertas.slice(0, 4).map((a) => (
            <div key={`${a.atletaId}-${a.fundamento}`} className="text-sm px-3 py-2.5 rounded-xl flex items-center gap-2"
              style={a.tipo === 'alerta'
                ? { background: 'rgba(231,76,60,.12)', border: '1px solid rgba(231,76,60,.35)' }
                : { background: 'rgba(46,204,113,.12)', border: '1px solid rgba(46,204,113,.35)' }}>
              <span aria-hidden>{a.tipo === 'alerta' ? '⚠️' : '🔥'}</span>
              <span><b>{nome(a.atletaId)}</b> {textoAlerta(a)}</span>
            </div>
          ))}
        </div>
      )}

      {rot && (
        <Secao titulo={rot.servindo === 'CASA' ? 'Em quadra · nós sacando' : 'Em quadra · eles sacando'} icon={<Users size={16} />}>
          <div className="grid grid-cols-3 rounded-xl overflow-hidden" style={{ border: '2px solid #d4af37', background: '#0b0a08' }}>
            {[3, 2, 1, 4, 5, 0].map((idx) => (
              <div key={idx} className="text-center py-2.5" style={{ border: '1px dashed rgba(212,175,55,.45)', background: idx === 0 && rot.servindo === 'CASA' ? 'rgba(241,196,15,.25)' : undefined }}>
                <div className="text-[10px] font-black" style={{ color: '#d4af37' }}>{ROMANO[idx]}</div>
                <div className="text-sm font-bold text-white truncate px-1">{nome(rot.posicoes[idx])}</div>
              </div>
            ))}
          </div>
          {piorRod && piorRod.saldo < 0 && (
            <p className="text-xs mt-2">🔄 Rodízio que mais sofre {recorte === 'set' ? 'no set' : 'no jogo'}: <b>{rod.modo === 'levantadora' ? `P${piorRod.rodizio + 1}` : `R${piorRod.rodizio + 1}`}</b> · {piorRod.pontosFeitos} × {piorRod.pontosSofridos}</p>
          )}
        </Secao>
      )}

      <Secao titulo="Side-out e break" icon={<Repeat size={16} />}>
        <div className="grid grid-cols-2 gap-2">
          <Kpi label="Side-out" valor={sb.sideOutOportunidades ? `${sb.sideOutPct}%` : '—'} cor={sb.sideOutOportunidades ? corPct(sb.sideOutPct) : undefined} sub={`${sb.sideOutPontos} de ${sb.sideOutOportunidades}`} />
          <Kpi label="Break point" valor={sb.breakOportunidades ? `${sb.breakPct}%` : '—'} sub={`${sb.breakPontos} de ${sb.breakOportunidades}`} />
        </div>
      </Secao>

      <Secao titulo="Fundamentos" icon={<Target size={16} />}>
        <div className="grid grid-cols-2 gap-2">
          {FUNDAMENTOS_SCOUT.filter((f) => equipe[f].total > 0 && ['saque', 'recepcao', 'ataque', 'bloqueio', 'defesa', 'levantamento'].includes(f)).map((f) => (
            <Kpi key={f} label={LABEL_FUNDAMENTO[f]} valor={`${equipe[f].eficiencia}%`} cor={corEf(equipe[f].eficiencia)} sub={`${equipe[f].positivo}+ · ${equipe[f].erro}− · ${equipe[f].total}`} />
          ))}
        </div>
      </Secao>

      {(origem.totalGanhos > 0 || origem.totalPerdidos > 0) && (
        <Secao titulo="De onde vêm os pontos" icon={<Flame size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            {[{ t: 'Nossos', itens: origem.ganhos, cor: 'var(--rd-positivo)' }, { t: 'Deles', itens: origem.perdidos, cor: 'var(--rd-erro)' }].map((g) => {
              const max = Math.max(1, ...g.itens.map((i) => i.valor))
              return (
                <div key={g.t} className="grid gap-1.5">
                  <div className="text-xs font-bold">{g.t}</div>
                  {g.itens.slice(0, 4).map((i) => <BarraHorizontal key={i.chave} label={i.label.replace('Nosso erro: ', 'erro ').replace('Ponto deles: ', '')} valor={i.valor} max={max} cor={g.cor} direita={i.valor} />)}
                </div>
              )
            })}
          </div>
        </Secao>
      )}

      {porAtleta.length > 0 && (
        <Secao titulo="Atletas" icon={<Users size={16} />}>
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] text-[var(--rd-text-dim)]"><th className="text-left font-semibold py-1">Atleta</th><th className="font-semibold">Pts</th><th className="font-semibold">Erros</th><th className="text-right font-semibold">Efic.</th></tr></thead>
            <tbody>
              {porAtleta.map((l) => (
                <tr key={l.atletaId} className="border-t" style={{ borderColor: 'var(--rd-border)' }}>
                  <td className="py-2 font-semibold">{nome(l.atletaId)}</td>
                  <td className="text-center tabular-nums" style={{ color: 'var(--rd-positivo)' }}>{l.pontos}</td>
                  <td className="text-center tabular-nums" style={{ color: 'var(--rd-erro)' }}>{l.errosQueDeramPonto}</td>
                  <td className="text-right font-bold tabular-nums" style={{ color: corEf(l.totalGeral.eficiencia) }}>{l.totalGeral.eficiencia}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Secao>
      )}

      {pontos.length > 0 && (
        <Card>
          <div className="text-xs font-bold mb-2">Últimos pontos do set</div>
          <div className="flex flex-wrap gap-1">
            {pontos.map((p) => (
              <span key={p.numero} className="text-[11px] font-bold px-1.5 py-1 rounded tabular-nums" style={{ background: 'rgba(255,255,255,.06)', color: p.ganhouCasa ? 'var(--rd-positivo)' : 'var(--rd-erro)' }}>{p.placarCasa}-{p.placarAdversario}</span>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function JogoAoVivo({ id }: { id: string }) {
  const navigate = useNavigate()
  const { turmas } = useStore()
  const [partida, setPartida] = useState<Partida | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [atualizadoEm, setAtualizadoEm] = useState<number | null>(null)
  const [agora, setAgora] = useState(() => Date.now())
  const [recorte, setRecorte] = useState<'set' | 'jogo'>('set')
  const buscando = useRef(false)

  const buscar = useCallback(async () => {
    if (buscando.current) return
    buscando.current = true
    try {
      const p = await lerJogoAoVivo(id)
      if (!p) { setErro('Esse jogo não foi encontrado.'); return }
      setPartida(p); setErro(null); setAtualizadoEm(Date.now())
    } catch {
      setErro('Sem conexão agora — tentando de novo…')
    } finally {
      buscando.current = false
    }
  }, [id])

  useEffect(() => {
    void buscar()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void buscar() }, INTERVALO_ATUALIZACAO_MS)
    const relogio = setInterval(() => setAgora(Date.now()), 1000)
    const aoVoltar = () => { if (document.visibilityState === 'visible') void buscar() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => { clearInterval(t); clearInterval(relogio); document.removeEventListener('visibilitychange', aoVoltar) }
  }, [buscar])

  const setAtual = partida?.setsPartida[partida.setsPartida.length - 1]
  const segundos = atualizadoEm ? Math.max(0, Math.round((agora - atualizadoEm) / 1000)) : null

  return (
    <div>
      <BotaoVoltar to="/banco" label="Jogos ao vivo" />
      {!partida ? (
        <p className="text-sm text-[var(--rd-text-dim)]">{erro ?? 'Carregando o jogo…'}</p>
      ) : (
        <>
          <div className="rd-card p-4 mb-3 text-center" style={{ borderColor: '#d4af37' }}>
            <div className="text-xs text-[var(--rd-text-dim)] font-semibold">{turmas.find((t) => t.id === partida.turmaId)?.nome ?? 'Nós'} × {partida.adversarioNome ?? 'Adversário'}</div>
            <div className="text-5xl font-black tabular-nums my-1">{setAtual?.placarCasa ?? 0} <span className="text-[var(--rd-text-dim)] text-3xl">×</span> {setAtual?.placarAdversario ?? 0}</div>
            <div className="text-sm font-bold">Set {setAtual?.numero ?? 1} · sets {partida.setsGanhosCasa} × {partida.setsGanhosAdversario}</div>
            <div className="flex justify-center gap-1.5 mt-2 flex-wrap">
              {partida.setsPartida.filter((s) => s.finalizado).map((s) => (
                <span key={s.id} className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums" style={{ background: s.placarCasa > s.placarAdversario ? 'rgba(46,204,113,.15)' : 'rgba(231,76,60,.15)' }}>{s.placarCasa}-{s.placarAdversario}</span>
              ))}
            </div>
            <div className="text-[11px] mt-2 flex items-center justify-center gap-1.5" style={{ color: erro ? 'var(--rd-erro)' : 'var(--rd-text-dim)' }}>
              {partida.status === 'EM_ANDAMENTO' && <span className="w-2 h-2 rounded-full" style={{ background: erro ? 'var(--rd-erro)' : 'var(--rd-positivo)', animation: 'rd-pulse 1.2s ease-in-out infinite' }} />}
              {partida.status === 'FINALIZADA' ? 'Jogo encerrado' : erro ?? `Ao vivo · atualizado há ${segundos ?? 0}s`}
              <button onClick={() => void buscar()} className="ml-1 p-1" aria-label="Atualizar agora"><RefreshCw size={12} /></button>
            </div>
          </div>

          {partida.status === 'FINALIZADA' && (
            <button className="rd-btn rd-btn-gold w-full mb-3" style={{ minHeight: 44 }} onClick={() => navigate(`/relatorio/${partida.id}`)}><FileText size={16} /> Abrir relatório do jogo</button>
          )}

          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl mb-3" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }} role="group" aria-label="Recorte">
            {(['set', 'jogo'] as const).map((r) => (
              <button key={r} onClick={() => setRecorte(r)} aria-pressed={recorte === r} className="rounded-lg text-xs font-bold"
                style={{ minHeight: 38, background: recorte === r ? 'var(--rd-gold)' : 'transparent', color: recorte === r ? '#1a1300' : 'var(--rd-text-dim)' }}>
                {r === 'set' ? 'Set atual' : 'Jogo todo'}
              </button>
            ))}
          </div>
          <PainelAoVivo partida={partida} recorte={recorte} />
        </>
      )}
    </div>
  )
}

export default function ModoBanco() {
  const { id } = useParams()
  const session = useAuthStore((s) => s.session)
  const carregando = useAuthStore((s) => s.carregando)
  if (carregando) return <p className="text-sm text-[var(--rd-text-dim)]">Carregando…</p>
  if (!session) {
    return (
      <div>
        <PageTitle icon={<MonitorSmartphone size={22} />} title="Modo banco" />
        <EmptyState icon={<MonitorSmartphone size={40} />} text="Pra usar o modo banco, entre com a sua conta nos dois aparelhos (o do scout e o do banco). Assim o jogo vai pra nuvem e aparece aqui ao vivo."
          action={<Link to="/auth/login" className="rd-btn rd-btn-gold" style={{ minHeight: 44 }}>Entrar</Link>} />
      </div>
    )
  }
  return id ? <JogoAoVivo id={id} /> : <ListaJogos />
}
