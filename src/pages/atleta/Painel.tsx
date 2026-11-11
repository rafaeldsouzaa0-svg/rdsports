import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Volleyball } from 'lucide-react'
import { Card } from '../../components/ui'
import { sessaoAtual, sairDoPortal, type AtletaPortalSessao } from '../../atletaAuth'
import { calcularRating } from '../../rating'
import { linhaDeEventos, FUNDAMENTOS_SCOUT, LABEL_FUNDAMENTO } from '../../scoutEngine'
import { POSICOES } from '../../types'
import { formatDate } from '../../utils'

function corEficiencia(ef: number): string {
  if (ef >= 50) return 'text-[var(--rd-positivo)]'
  if (ef >= 0) return 'text-[var(--rd-neutro)]'
  return 'text-[var(--rd-erro)]'
}

// Escala 6.0-10.0 (pedido 30/10/2026) — mesmos limiares do perfil do lado do
// treinador (AtletaPerfil.tsx).
function corRating(rating: number): string {
  if (rating >= 8) return 'var(--rd-positivo)'
  if (rating >= 7) return 'var(--rd-neutro)'
  return 'var(--rd-erro)'
}

export default function AtletaPainel() {
  const navigate = useNavigate()
  const [sessao, setSessao] = useState<AtletaPortalSessao | null>(null)

  useEffect(() => {
    const s = sessaoAtual()
    if (!s) { navigate('/atleta/entrar'); return }
    setSessao(s)
  }, [navigate])

  if (!sessao) return null

  const { atleta, partidas } = sessao
  const todosEventos = partidas.flatMap((p) => p.eventos)
  const scoutAgregado = linhaDeEventos(todosEventos)
  const rating = calcularRating(scoutAgregado, atleta.posicao, atleta.posicaoSecundaria)
  const fundamentosComDados = FUNDAMENTOS_SCOUT.filter((f) => scoutAgregado[f].total > 0)

  function sair() {
    sairDoPortal()
    navigate('/atleta/entrar')
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-2">
          <Volleyball size={22} className="rd-accent-text" />
          <div>
            <h1 className="text-lg font-black tracking-tight">{atleta.nome}</h1>
            {atleta.posicao && (
              <p className="text-xs text-[var(--rd-text-dim)]">
                {POSICOES.find((p) => p.valor === atleta.posicao)?.label}
                {atleta.posicaoSecundaria && atleta.posicaoSecundaria !== atleta.posicao && ` + ${POSICOES.find((p) => p.valor === atleta.posicaoSecundaria)?.label}`}
              </p>
            )}
          </div>
        </div>
        <button className="rd-btn text-xs" onClick={sair}><LogOut size={14} /> Sair</button>
      </div>

      <Card className="mb-5 text-center">
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--rd-text-dim)]">Seu rating</div>
        <div className="text-5xl font-black tracking-tight mt-1" style={{ color: corRating(rating.rating) }}>{rating.rating.toFixed(1)}</div>
        <div className="text-xs text-[var(--rd-text-dim)] mt-1">
          {rating.totalAcoes} ações registradas
          {rating.confianca < 1 && rating.totalAcoes > 0 && ` • amostra ainda pequena (confiança ${Math.round(rating.confianca * 100)}%)`}
          {rating.totalAcoes === 0 && ' • sem partidas finalizadas ainda'}
        </div>
      </Card>

      {fundamentosComDados.length > 0 && (
        <Card className="mb-5">
          <div className="font-bold text-sm mb-3">📊 Seu scout acumulado</div>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[420px]">
              <thead>
                <tr className="text-[var(--rd-text-dim)] text-left uppercase text-[10px]">
                  <th className="py-1 px-1 font-bold">Fundamento</th>
                  <th className="py-1 px-1 font-bold text-center">Positivo</th>
                  <th className="py-1 px-1 font-bold text-center">Neutro</th>
                  <th className="py-1 px-1 font-bold text-center">Erro</th>
                  <th className="py-1 px-1 font-bold text-center">Total</th>
                  <th className="py-1 px-1 font-bold text-center">Efic.</th>
                </tr>
              </thead>
              <tbody>
                {fundamentosComDados.map((f) => {
                  const l = scoutAgregado[f]
                  return (
                    <tr key={f} className="border-t border-[var(--rd-border)]">
                      <td className="py-1.5 px-1 font-medium">{LABEL_FUNDAMENTO[f]}</td>
                      <td className="py-1.5 px-1 text-center" style={{ color: 'var(--rd-positivo)' }}>{l.positivo}</td>
                      <td className="py-1.5 px-1 text-center" style={{ color: 'var(--rd-neutro)' }}>{l.neutro}</td>
                      <td className="py-1.5 px-1 text-center" style={{ color: 'var(--rd-erro)' }}>{l.erro}</td>
                      <td className="py-1.5 px-1 text-center">{l.total}</td>
                      <td className={`py-1.5 px-1 text-center font-bold ${corEficiencia(l.eficiencia)}`}>{l.eficiencia}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <div className="font-bold text-sm mb-3">🏐 Suas partidas</div>
        {partidas.length === 0 ? (
          <p className="text-xs text-[var(--rd-text-dim)]">Nenhuma partida finalizada com suas ações registradas ainda.</p>
        ) : (
          <div className="grid gap-2">
            {partidas.map((p) => {
              const resumo = Object.values(linhaDeEventos(p.eventos)).reduce(
                (acc, l) => ({ positivo: acc.positivo + l.positivo, neutro: acc.neutro + l.neutro, erro: acc.erro + l.erro, total: acc.total + l.total, eficiencia: 0 }),
                { positivo: 0, neutro: 0, erro: 0, total: 0, eficiencia: 0 },
              )
              resumo.eficiencia = resumo.total > 0 ? Math.round(((resumo.positivo - resumo.erro) / resumo.total) * 100) : 0
              return (
                <div key={p.id} className="flex items-center justify-between text-xs border-t border-[var(--rd-border)] pt-2 first:border-t-0 first:pt-0">
                  <span>
                    <strong>vs {p.adversarioNome ?? 'Adversário'}</strong>
                    <span className="text-[var(--rd-text-dim)]"> — {formatDate(p.data)} — {p.setsGanhosCasa}×{p.setsGanhosAdversario}</span>
                  </span>
                  <span className={`font-bold ${corEficiencia(resumo.eficiencia)}`}>{resumo.total} ações • {resumo.eficiencia}%</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
