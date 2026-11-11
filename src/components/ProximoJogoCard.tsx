import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Users, Play, Plus, X, Check, MapPin, Trophy } from 'lucide-react'
import { useStore } from '../store'
import { Card, Button } from './ui'
import { LogoExibicao } from './LogoUpload'
import { encontrarLogoAdversario, parseDataLocal } from '../utils'
import { atletasDaPartida } from '../convocacao'
import { proximoJogo, contagemRegressiva, checklistDoJogo, alternarItem, adicionarItem, removerItem, type ItemChecklist } from '../proximoJogo'

/** Cartão "Próximo jogo" no topo do Início (pedido 11/11/2026): contagem
 *  regressiva ao vivo, quem foi convocada e o checklist do que levar. O
 *  checklist é guardado no próprio jogo agendado (e sincroniza com a nuvem). */
export default function ProximoJogoCard() {
  const navigate = useNavigate()
  const { jogosAgendados, turmas, escolas, atletas, adversarios, updateJogoAgendado } = useStore()
  const [agora, setAgora] = useState(() => new Date())
  const [novoItem, setNovoItem] = useState('')

  // Atualiza a contagem a cada 30 s enquanto a tela está aberta.
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const jogo = proximoJogo(jogosAgendados, agora)
  if (!jogo) return null

  const turma = turmas.find((t) => t.id === jogo.turmaId)
  const escola = turma ? escolas.find((e) => e.id === turma.escolaId) : undefined
  const contagem = contagemRegressiva(jogo.data, jogo.horario, agora)
  const convocadas = jogo.convocadas?.length ? atletasDaPartida({ turmaId: jogo.turmaId, convocadas: jogo.convocadas }, atletas, turmas) : []
  const checklist = checklistDoJogo(jogo)
  const feitos = checklist.filter((i) => i.feito).length
  const dataTexto = parseDataLocal(jogo.data).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })

  function salvar(lista: ItemChecklist[]) {
    updateJogoAgendado(jogo!.id, { checklist: lista })
  }

  const blocos = contagem.partes
    ? [
        { valor: contagem.partes.dias, rotulo: contagem.partes.dias === 1 ? 'dia' : 'dias' },
        { valor: contagem.partes.horas, rotulo: 'horas' },
        { valor: contagem.partes.minutos, rotulo: 'min' },
      ]
    : null

  return (
    <Card className="mb-6" style={{ borderColor: 'var(--rd-gold)' }}>
      <div className="text-xs font-bold uppercase tracking-wide rd-accent-text mb-3">Próximo jogo</div>

      <div className="flex items-center gap-3 mb-4">
        <LogoExibicao logoUrl={encontrarLogoAdversario(adversarios, jogo.adversarioNome)} nome={jogo.adversarioNome} tamanho={44} />
        <div className="min-w-0">
          <div className="text-lg font-black leading-tight">vs {jogo.adversarioNome}</div>
          <div className="text-sm text-[var(--rd-text-dim)]">
            {turma?.nome ?? 'Turma'}{escola ? ` · ${escola.nome}` : ''}
          </div>
        </div>
      </div>

      {/* Contagem regressiva */}
      <div className="rounded-xl p-3 mb-4" style={{ background: 'color-mix(in srgb, var(--rd-gold) 12%, transparent)' }}>
        {blocos && !contagem.comecou ? (
          <div className="flex gap-2 justify-center" role="timer" aria-label={contagem.texto}>
            {blocos.map((b) => (
              <div key={b.rotulo} className="flex-1 max-w-[96px] text-center rounded-lg py-2" style={{ background: 'var(--rd-surface)' }}>
                <div className="text-3xl font-black tabular-nums">{b.valor}</div>
                <div className="text-[11px] text-[var(--rd-text-dim)] font-semibold">{b.rotulo}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-2xl font-black" role="timer">{contagem.texto}</div>
        )}
        <div className="text-center text-sm mt-2">
          <span className="font-semibold">{dataTexto}</span>
          {jogo.horario ? ` · ${jogo.horario.slice(0, 5)}` : ''}
        </div>
        {(jogo.local || jogo.campeonatoNome) && (
          <div className="flex justify-center gap-3 flex-wrap text-xs text-[var(--rd-text-dim)] mt-1">
            {jogo.local && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {jogo.local}</span>}
            {jogo.campeonatoNome && <span className="inline-flex items-center gap-1"><Trophy size={12} /> {jogo.campeonatoNome}</span>}
          </div>
        )}
      </div>

      {/* Convocadas */}
      <div className="mb-4">
        <div className="font-bold text-sm mb-2 flex items-center gap-1.5"><Users size={16} /> Convocadas ({convocadas.length})</div>
        {convocadas.length === 0 ? (
          <p className="text-xs text-[var(--rd-text-dim)]">Ainda sem convocação — no dia, entra a turma inteira.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {convocadas.map(({ atleta, reforcoDe }) => (
              <span key={atleta.id} className="text-xs px-2 py-1 rounded-full" style={{ border: '1px solid var(--rd-border)' }}>
                {atleta.numero ? `#${atleta.numero} ` : ''}{atleta.nome.split(' ')[0]}
                {reforcoDe && <span className="ml-1 font-bold rd-accent-text">· {reforcoDe}</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <div className="font-bold text-sm">O que levar</div>
          <div className="text-xs text-[var(--rd-text-dim)]">{feitos} de {checklist.length}</div>
        </div>
        <div className="h-1.5 rounded-full mb-2 overflow-hidden" style={{ background: 'var(--rd-border)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${checklist.length ? (feitos / checklist.length) * 100 : 0}%`, background: 'var(--rd-positivo)' }} />
        </div>
        <div className="grid gap-1.5">
          {checklist.map((it, i) => (
            <div key={`${it.item}-${i}`} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => salvar(alternarItem(checklist, i))}
                aria-pressed={it.feito}
                className="flex-1 flex items-center gap-3 text-left text-sm rounded-lg px-3 transition-colors"
                style={{ minHeight: 44, border: '1px solid var(--rd-border)', background: it.feito ? 'color-mix(in srgb, var(--rd-positivo) 12%, transparent)' : 'transparent' }}
              >
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ border: `2px solid ${it.feito ? 'var(--rd-positivo)' : 'var(--rd-border)'}`, background: it.feito ? 'var(--rd-positivo)' : 'transparent', color: '#fff' }}
                  aria-hidden="true"
                >
                  {it.feito && <Check size={14} strokeWidth={3} />}
                </span>
                <span className={it.feito ? 'line-through text-[var(--rd-text-dim)]' : ''}>{it.item}</span>
              </button>
              <button type="button" className="rd-btn !p-2" style={{ minHeight: 44 }} onClick={() => salvar(removerItem(checklist, i))} aria-label={`Tirar "${it.item}" da lista`}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <form
          className="flex gap-2 mt-2"
          onSubmit={(e) => { e.preventDefault(); salvar(adicionarItem(checklist, novoItem)); setNovoItem('') }}
        >
          <input className="rd-input" placeholder="Adicionar item (ex.: joelheiras)" value={novoItem} onChange={(e) => setNovoItem(e.target.value)} aria-label="Novo item do checklist" />
          <Button type="submit" aria-label="Adicionar item"><Plus size={16} /></Button>
        </form>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant={contagem.ehHoje ? 'gold' : 'default'} onClick={() => navigate('/calendario', { state: { abrirDia: jogo.data } })}>
          {contagem.ehHoje ? <><Play size={16} /> Ir para o scout</> : <><CalendarDays size={16} /> Ver no calendário</>}
        </Button>
        <Button onClick={() => navigate(`/turmas/${jogo.turmaId}`)}><Users size={16} /> Convocação</Button>
      </div>
    </Card>
  )
}
