import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Users } from 'lucide-react'
import { useStore } from '../store'
import { Button, Field } from './ui'
import { FORMATOS_PARTIDA } from '../types'
import type { FormatoPartida, JogoAgendado, Turma } from '../types'
import {
  montarListaConvocacao, convocacaoInicial, principaisDeForaComReforco,
  calcularIdade, formatarDataBR, nivelDaTurma,
} from '../convocacao'

/** Agendar um jogo da turma já com a convocação (pedido 11/11/2026).
 *  Usado na tela da turma pra criar um jogo novo e pra editar a convocação
 *  de um jogo já agendado. Turma principal vem toda marcada e primeiro;
 *  reforços das turmas de baixo da mesma escola ficam numa seção fechada,
 *  desmarcados, com a turma de origem ao lado do nome. */
export default function ConvocacaoForm({ turma, jogo, onPronto }: { turma: Turma; jogo?: JogoAgendado; onPronto: () => void }) {
  const { turmas, atletas, adversarios, campeonatos, addAdversario, addCampeonato, addJogoAgendado, updateJogoAgendado } = useStore()
  const lista = useMemo(() => montarListaConvocacao(turma, turmas, atletas), [turma, turmas, atletas])

  const [adversario, setAdversario] = useState(jogo?.adversarioNome ?? '')
  const [campeonato, setCampeonato] = useState(jogo?.campeonatoNome ?? '')
  const [data, setData] = useState(jogo?.data ?? '')
  const [horario, setHorario] = useState(jogo?.horario?.slice(0, 5) ?? '')
  const [local, setLocal] = useState(jogo?.local ?? '')
  const [formato, setFormato] = useState<FormatoPartida>(jogo?.formato ?? 'MELHOR_DE_5')
  const [convocadas, setConvocadas] = useState<string[]>(jogo?.convocadas ?? convocacaoInicial(lista))
  const temReforcoMarcado = lista.reforcos.some((g) => g.atletas.some((a) => convocadas.includes(a.id)))
  const [reforcosAbertos, setReforcosAbertos] = useState(temReforcoMarcado)
  const [erro, setErro] = useState('')

  const deFora = principaisDeForaComReforco(lista, convocadas)
  const nivel = nivelDaTurma(turma)

  function alternar(id: string) {
    setConvocadas((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  }

  function salvar() {
    if (!adversario.trim()) return setErro('Coloque o nome do adversário.')
    if (!data) return setErro('Escolha a data do jogo.')
    if (convocadas.length === 0) return setErro('Convoque pelo menos uma atleta.')
    const adv = addAdversario(adversario.trim())
    const nomeCamp = campeonato.trim()
    const camp = nomeCamp
      ? (campeonatos.find((c) => !c.deletedAt && c.nome.toLowerCase() === nomeCamp.toLowerCase()) ?? addCampeonato(nomeCamp, turma.id))
      : undefined
    // Guarda só ids que ainda existem na lista (atleta excluída some sozinha).
    const validas = new Set([...lista.principais, ...lista.reforcos.flatMap((g) => g.atletas)].map((a) => a.id))
    const dados = {
      turmaId: turma.id, adversarioId: adv.id, adversarioNome: adv.nome,
      campeonatoId: camp?.id, campeonatoNome: camp?.nome,
      data, horario: horario || undefined, local: local.trim() || undefined, formato,
      convocadas: convocadas.filter((id) => validas.has(id)),
    }
    if (jogo) updateJogoAgendado(jogo.id, dados)
    else addJogoAgendado(dados)
    onPronto()
  }

  function linhaAtleta({ id, nome, nascimento, idade, numero, origem }: { id: string; nome: string; nascimento?: string; idade?: number; numero?: string; origem?: string }) {
    const marcada = convocadas.includes(id)
    const idadeMostrada = calcularIdade(nascimento) ?? idade
    return (
      <label key={id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer" style={{ border: `1px solid ${marcada ? 'var(--rd-gold)' : 'var(--rd-border)'}`, minHeight: 48 }}>
        <input type="checkbox" checked={marcada} onChange={() => alternar(id)} className="w-5 h-5 shrink-0" style={{ accentColor: 'var(--rd-gold)' }} />
        <span className="flex-1 min-w-0">
          <span className="font-semibold block">{numero ? `#${numero} ` : ''}{nome}</span>
          <span className="text-xs text-[var(--rd-text-dim)]">
            {nascimento ? `Nasc. ${formatarDataBR(nascimento)}` : 'Sem data de nascimento'}
            {idadeMostrada !== undefined ? ` · ${idadeMostrada} anos` : ''}
          </span>
        </span>
        {origem && (
          <span className="text-xs font-bold px-2 py-1 rounded-md shrink-0" style={{ background: 'var(--rd-gold)', color: '#1a1300' }}>{origem}</span>
        )}
      </label>
    )
  }

  const totalReforcos = lista.reforcos.reduce((n, g) => n + g.atletas.filter((a) => convocadas.includes(a.id)).length, 0)

  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="Adversário">
          <input className="rd-input" list="rd-adversarios" value={adversario} onChange={(e) => setAdversario(e.target.value)} placeholder="Nome do time adversário" />
          <datalist id="rd-adversarios">{adversarios.map((a) => <option key={a.id} value={a.nome} />)}</datalist>
        </Field>
        <Field label="Campeonato (opcional)">
          <input className="rd-input" list="rd-campeonatos" value={campeonato} onChange={(e) => setCampeonato(e.target.value)} placeholder="Ex.: Copa Escolar" />
          <datalist id="rd-campeonatos">{campeonatos.filter((c) => !c.deletedAt).map((c) => <option key={c.id} value={c.nome} />)}</datalist>
        </Field>
        <Field label="Data">
          <input type="date" className="rd-input" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
        <Field label="Horário (opcional)">
          <input type="time" className="rd-input" value={horario} onChange={(e) => setHorario(e.target.value)} />
        </Field>
        <Field label="Local (opcional)">
          <input className="rd-input" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ginásio / endereço" />
        </Field>
        <Field label="Formato da partida">
          <select className="rd-input" value={formato} onChange={(e) => setFormato(e.target.value as FormatoPartida)}>
            {FORMATOS_PARTIDA.map((f) => <option key={f.valor} value={f.valor}>{f.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="flex items-baseline justify-between mt-2 mb-2">
        <div className="font-bold text-sm">Convocação · {turma.nome}</div>
        <div className="text-xs text-[var(--rd-text-dim)]">{convocadas.length} convocada(s){totalReforcos ? ` · ${totalReforcos} reforço(s)` : ''}</div>
      </div>

      {lista.principais.length === 0 ? (
        <p className="text-sm text-[var(--rd-text-dim)] mb-3">Esta turma ainda não tem atletas ativas.</p>
      ) : (
        <div className="grid gap-2 mb-3">
          {lista.principais.map((a) => (
            linhaAtleta({ id: a.id, nome: a.nome, nascimento: a.nascimento, idade: a.idade, numero: a.numero, })
          ))}
        </div>
      )}

      {deFora.length > 0 && (
        <div className="flex gap-2 items-start text-sm rounded-lg px-3 py-2 mb-3" style={{ background: 'color-mix(in srgb, var(--rd-neutro) 15%, transparent)', border: '1px solid var(--rd-neutro)' }} role="status">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>
            Prioridade da turma principal: {deFora.length === 1 ? 'ainda há 1 atleta' : `ainda há ${deFora.length} atletas`} do {turma.nome} fora da convocação
            ({deFora.map((a) => a.nome.split(' ')[0]).join(', ')}).
          </span>
        </div>
      )}

      {lista.reforcos.length > 0 ? (
        <div className="mb-3">
          <button type="button" className="flex items-center gap-2 font-bold text-sm py-2" style={{ minHeight: 44 }} onClick={() => setReforcosAbertos((v) => !v)} aria-expanded={reforcosAbertos}>
            {reforcosAbertos ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            Reforços das turmas de baixo
          </button>
          {reforcosAbertos && lista.reforcos.map((g) => (
            <div key={g.turma.id} className="mb-2">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--rd-text-dim)] mb-1.5">{g.turma.nome}</div>
              <div className="grid gap-2">
                {g.atletas.map((a) => (
                  linhaAtleta({ id: a.id, nome: a.nome, nascimento: a.nascimento, idade: a.idade, numero: a.numero, origem: g.turma.nome, })
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--rd-text-dim)] mb-3 flex items-center gap-1.5">
          <Users size={14} />
          {nivel === undefined
            ? 'Pra puxar reforço de turma de baixo, preencha o nível desta turma (ex.: 8 pro 8º ano).'
            : 'Nenhuma turma de baixo com atletas nesta escola.'}
        </p>
      )}

      {erro && <p className="text-sm mb-2" style={{ color: 'var(--rd-erro)' }} role="alert">{erro}</p>}
      <div className="flex gap-2 flex-wrap">
        <Button variant="gold" onClick={salvar}>{jogo ? 'Salvar convocação' : 'Agendar jogo'}</Button>
        <Button onClick={onPronto}>Cancelar</Button>
      </div>
    </div>
  )
}
