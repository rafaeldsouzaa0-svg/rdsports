// Lances ligados ao vídeo, no relatório do jogo (pedido 21/11/2026): toca
// "▶ ver" e o vídeo abre uns segundos antes do lance. Dá pra filtrar por
// atleta e ver só os erros, um atrás do outro ("Próximo"), pra mostrar pra
// atleta no treino.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Film, FolderOpen, SkipForward } from 'lucide-react'
import { Card } from './ui'
import PlayerVideo, { type ControlePlayer, type FonteVideo } from './PlayerVideo'
import { idYoutube, lancesComVideo, formatarTempo, RECUO_LANCE_SEG, type LanceVideo } from '../videoJogo'
import { LABEL_FUNDAMENTO } from '../scoutEngine'
import type { Atleta, Partida, ResultadoEvento } from '../types'

const LABEL_RES: Record<ResultadoEvento, string> = { ACERTO: 'Ponto', BOM: 'Boa', MEDIO: 'Média', ERRO: 'Erro', EM_JOGO: 'Em jogo' }

function corDoLance(l: LanceVideo): string {
  const bomPraNos = l.lado === 'CASA' ? l.resultado === 'ACERTO' || l.resultado === 'BOM' : l.resultado === 'ERRO'
  const ruimPraNos = l.lado === 'CASA' ? l.resultado === 'ERRO' : l.resultado === 'ACERTO'
  return bomPraNos ? 'var(--rd-positivo)' : ruimPraNos ? 'var(--rd-erro)' : 'var(--rd-neutro)'
}

export default function LancesVideo({ partida, atletas }: { partida: Partida; atletas: Atleta[] }) {
  const [atletaId, setAtletaId] = useState('')
  const [soErros, setSoErros] = useState(false)
  const [atual, setAtual] = useState<string | null>(null)
  const [arquivo, setArquivo] = useState<FonteVideo | null>(null)
  const playerRef = useRef<ControlePlayer>(null)
  const pendente = useRef<number | null>(null)

  const idYt = idYoutube(partida.videoUrl)
  const fonteYt = useMemo<FonteVideo | null>(() => (idYt ? { tipo: 'youtube', id: idYt } : null), [idYt])
  const fonte = arquivo ?? fonteYt
  useEffect(() => () => { if (arquivo?.tipo === 'arquivo') URL.revokeObjectURL(arquivo.url) }, [arquivo])

  const todos = lancesComVideo(partida)
  const lances = lancesComVideo(partida, { atletaId: atletaId || undefined, soErros })
  const nome = (id?: string) => atletas.find((a) => a.id === id)?.nome.split(' ')[0]
  const atletasComLance = [...new Set(todos.map((l) => l.atletaId).filter(Boolean))] as string[]

  // O player do YouTube demora um pouco pra ficar pronto na primeira vez.
  useEffect(() => {
    if (pendente.current === null || !fonte) return
    const t = setTimeout(() => { if (pendente.current !== null) { playerRef.current?.irPara(pendente.current, true); pendente.current = null } }, 1200)
    return () => clearTimeout(t)
  }, [fonte, atual])

  if (todos.length === 0) return null

  function ver(l: LanceVideo) {
    setAtual(l.eventoId)
    const alvo = Math.max(0, l.videoSeg - RECUO_LANCE_SEG)
    if (playerRef.current) playerRef.current.irPara(alvo, true)
    else pendente.current = alvo
  }
  const idx = lances.findIndex((l) => l.eventoId === atual)
  const proximo = idx >= 0 ? lances[idx + 1] : lances[0]

  return (
    <Card className="mb-5">
      <div className="font-bold text-sm mb-1 flex items-center gap-2"><Film size={16} className="rd-accent-text" /> Lances no vídeo</div>
      <p className="text-xs text-[var(--rd-text-dim)] mb-3">Toque em ▶ pra ver o lance (o vídeo começa {RECUO_LANCE_SEG} s antes).</p>

      {atual && (
        <div className="mb-3">
          {fonte ? (
            <PlayerVideo ref={playerRef} fonte={fonte} marcas={todos.map((l) => ({ seg: l.videoSeg, cor: corDoLance(l) }))} />
          ) : (
            <label className="rd-btn w-full cursor-pointer">
              <FolderOpen size={16} /> Escolher o vídeo do jogo no aparelho
              <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setArquivo({ tipo: 'arquivo', url: URL.createObjectURL(f), nome: f.name })
              }} />
            </label>
          )}
          {proximo && (
            <button className="rd-btn rd-btn-gold w-full mt-2" onClick={() => ver(proximo)}>
              <SkipForward size={16} /> Próximo lance ({formatarTempo(proximo.videoSeg)})
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-2">
        <select className="rd-input !w-auto" value={atletaId} onChange={(e) => setAtletaId(e.target.value)}>
          <option value="">Todas as atletas</option>
          {atletasComLance.map((id) => <option key={id} value={id}>{atletas.find((a) => a.id === id)?.nome ?? '—'}</option>)}
        </select>
        <button className={`rd-btn text-xs ${soErros ? 'rd-btn-gold' : ''}`} onClick={() => setSoErros((v) => !v)}>Só os erros</button>
        {lances.length > 0 && (
          <button className="rd-btn text-xs" onClick={() => ver(lances[0])}>▶ Ver em sequência</button>
        )}
      </div>

      {lances.length === 0 ? (
        <p className="text-xs text-[var(--rd-text-dim)]">Nenhum lance com esse filtro.</p>
      ) : (
        <div>
          {lances.map((l) => (
            <div key={l.eventoId} className="grid grid-cols-[52px_1fr_auto] items-center gap-2 py-2 border-b last:border-b-0 text-sm"
              style={{ borderColor: 'var(--rd-border)', background: l.eventoId === atual ? 'rgba(212,175,55,.12)' : undefined }}>
              <span className="font-black text-xs rd-accent-text">{formatarTempo(l.videoSeg)}</span>
              <span className="min-w-0 truncate">
                {l.lado === 'ADVERSARIO' ? 'Adversário' : nome(l.atletaId) ?? '—'} · {LABEL_FUNDAMENTO[l.fundamento]} ·{' '}
                <b style={{ color: corDoLance(l) }}>{LABEL_RES[l.resultado]}</b>
                <span className="text-[var(--rd-text-dim)] text-xs"> · set {l.setNumero}, {l.placarCasa}×{l.placarAdversario}</span>
              </span>
              <button className="rd-btn text-xs !px-2 !py-1" onClick={() => ver(l)}>▶ ver</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
