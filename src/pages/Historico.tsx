import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Pencil, Trash2, X, Check } from 'lucide-react'
import { useStore } from '../store'
import { PageTitle, Card, Button, EmptyState, Field } from '../components/ui'
import { LogoExibicao } from '../components/LogoUpload'
import { encontrarLogoAdversario } from '../utils'
import { FORMATOS_PARTIDA } from '../types'
import type { FormatoPartida, Partida } from '../types'

function EdicaoPartida({ partida, onFechar }: { partida: Partida; onFechar: () => void }) {
  const { atualizarPartida } = useStore()
  const [adversarioNome, setAdversarioNome] = useState(partida.adversarioNome ?? '')
  const [data, setData] = useState(partida.data)
  const [local, setLocal] = useState(partida.local ?? '')
  const [formato, setFormato] = useState<FormatoPartida>(partida.formato)
  const [observacoes, setObservacoes] = useState(partida.observacoes ?? '')

  function salvar() {
    atualizarPartida(partida.id, {
      adversarioNome: partida.tipo === 'JOGO' ? adversarioNome.trim() || undefined : undefined,
      data,
      local: local.trim() || undefined,
      formato,
      observacoes: observacoes.trim() || undefined,
    })
    onFechar()
  }

  return (
    <Card className="mb-3">
      <div className="grid sm:grid-cols-2 gap-2">
        {partida.tipo === 'JOGO' && (
          <Field label="Adversário">
            <input className="rd-input" value={adversarioNome} onChange={(e) => setAdversarioNome(e.target.value)} />
          </Field>
        )}
        <Field label="Data">
          <input className="rd-input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
        <Field label="Local">
          <input className="rd-input" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Formato">
          <select className="rd-input" value={formato} onChange={(e) => setFormato(e.target.value as FormatoPartida)}>
            {FORMATOS_PARTIDA.map((f) => <option key={f.valor} value={f.valor}>{f.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Observações">
        <textarea className="rd-input" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
      </Field>
      <div className="flex gap-2">
        <Button variant="gold" onClick={salvar}><Check size={16} /> Salvar</Button>
        <Button onClick={onFechar}><X size={16} /> Cancelar</Button>
      </div>
    </Card>
  )
}

export default function Historico() {
  const { partidas, excluirPartida, turmas, adversarios } = useStore()
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const lista = partidas.filter((p) => !p.deletedAt).sort((a, b) => b.data.localeCompare(a.data))

  function excluir(p: Partida) {
    const rotulo = p.tipo === 'JOGO' ? `vs ${p.adversarioNome ?? 'Adversário'}` : 'este treino'
    if (!window.confirm(`Excluir ${rotulo} (${p.data})? Dá pra restaurar depois pela Lixeira.`)) return
    excluirPartida(p.id)
  }

  return (
    <div>
      <PageTitle icon={<Trophy size={22} />} title="Histórico" subtitle={`${lista.length} registro(s)`} />
      {lista.length === 0 ? (
        <EmptyState icon={<Trophy size={40} />} text="Nenhum jogo ou treino registrado ainda." />
      ) : (
        <div className="grid gap-3">
          {lista.map((p) => (
            editandoId === p.id ? (
              <EdicaoPartida key={p.id} partida={p} onFechar={() => setEditandoId(null)} />
            ) : (
              <Card key={p.id} className="flex items-center justify-between gap-2 flex-wrap">
                {p.tipo === 'JOGO' && (
                  <LogoExibicao logoUrl={encontrarLogoAdversario(adversarios, p.adversarioNome)} nome={p.adversarioNome ?? 'Adversário'} tamanho={32} />
                )}
                <Link to={p.status === 'EM_ANDAMENTO' ? `/scout/${p.id}` : `/relatorio/${p.id}`} className="flex-1 min-w-0 hover:opacity-80">
                  <div className="font-semibold truncate">
                    {turmas.find((t) => t.id === p.turmaId)?.nome ?? 'Nosso time'}
                    {p.tipo === 'JOGO' ? ` vs ${p.adversarioNome ?? 'Adversário'}` : ' • Treino'}
                    {p.status === 'EM_ANDAMENTO' && (
                      <span className="ml-2 text-xs font-bold rd-accent-text align-middle">● em andamento</span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--rd-text-dim)]">{p.data}{p.local ? ` • ${p.local}` : ''}</div>
                </Link>
                <span className="text-sm font-semibold">{p.setsGanhosCasa} × {p.setsGanhosAdversario}</span>
                <span className="flex gap-1">
                  <button className="rd-btn !p-2" title="Editar" onClick={() => setEditandoId(p.id)}>
                    <Pencil size={14} />
                  </button>
                  <button className="rd-btn !p-2 rd-btn-danger" title="Excluir" onClick={() => excluir(p)}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </Card>
            )
          ))}
        </div>
      )}
    </div>
  )
}
