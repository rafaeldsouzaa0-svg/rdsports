// Modo apresentação da ficha de treino (pedido 31/10/2026) — passa o treino
// no celular durante a prática sem precisar imprimir: tela cheia, um
// exercício por vez (os quadros PREENCHIDOS, na mesma ordem da ficha), com
// botões grandes de Próximo/Anterior e um cronômetro regressivo opcional
// pro tempo de cada exercício.
import { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Play, Pause, RotateCcw } from 'lucide-react'
import { QUADRO_SLOTS, type SessaoTreino, type Escola } from '../types'
import { QuadroDesenhoPreview, QuadroDesenhoAnimado } from './QuadroDesenhoEditor'

function formatarTempo(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ModoApresentacao({ sessao, escola, onFechar }: { sessao: SessaoTreino; escola?: Escola; onFechar: () => void }) {
  const quadros = QUADRO_SLOTS
    .map((slot) => ({ slot, q: sessao.quadros.find((x) => x.chave === slot.chave)! }))
    .filter(({ q }) => q.nome || q.objetivo || (q.desenho && q.desenho.elementos.length > 0))

  const [indice, setIndice] = useState(0)
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null)
  const [rodando, setRodando] = useState(false)
  const avisouFimRef = useRef(false)

  const atual = quadros[indice]
  const tempoTotalSeg = atual?.q.tempoMin ? atual.q.tempoMin * 60 : null

  // Troca de quadro: reseta o cronômetro pro tempo desse exercício (ou
  // null, se ele não tem tempo definido) e para a contagem — o treinador
  // decide quando começar, tocando em "Iniciar".
  useEffect(() => {
    setSegundosRestantes(tempoTotalSeg)
    setRodando(false)
    avisouFimRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice])

  useEffect(() => {
    if (!rodando || segundosRestantes === null) return
    if (segundosRestantes <= 0) {
      if (!avisouFimRef.current) {
        avisouFimRef.current = true
        setRodando(false)
        try { navigator.vibrate?.([200, 100, 200, 100, 200]) } catch { /* sem suporte a vibração, segue sem avisar */ }
      }
      return
    }
    const id = setTimeout(() => setSegundosRestantes((s) => (s !== null ? s - 1 : s)), 1000)
    return () => clearTimeout(id)
  }, [rodando, segundosRestantes])

  if (quadros.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-center">Nenhum quadro preenchido nessa sessão ainda.</p>
        <button className="rd-btn" onClick={onFechar}><X size={16} /> Fechar</button>
      </div>
    )
  }

  const temAnimacao = !!(atual.q.desenho?.passos && atual.q.desenho.passos.length > 1)
  const emAlerta = segundosRestantes !== null && segundosRestantes <= 10 && segundosRestantes > 0
  const zerado = segundosRestantes === 0

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="text-xs font-bold uppercase tracking-wide text-white/60">{atual.slot.grupoLabel} · {indice + 1} de {quadros.length}</div>
        <button className="rd-btn !p-2" onClick={onFechar}><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
        <h1 className="text-2xl font-black">{atual.q.nome || '(sem nome)'}</h1>
        {atual.q.objetivo && <p className="text-base text-white/80">{atual.q.objetivo}</p>}

        {atual.q.desenho && atual.q.desenho.elementos.length > 0 && (
          <div className="rounded-xl overflow-hidden bg-white/5 max-w-md mx-auto w-full">
            {temAnimacao ? (
              <QuadroDesenhoAnimado
                passos={atual.q.desenho.passos!}
                estiloJogador={atual.q.desenho.estiloJogador}
                velocidade={atual.q.desenho.velocidade}
                repetir
                logoEscolaUrl={escola?.logoUrl}
              />
            ) : (
              <QuadroDesenhoPreview desenho={atual.q.desenho} logoEscolaUrl={escola?.logoUrl} />
            )}
          </div>
        )}

        {atual.q.comoFunciona && (
          <div className="rounded-lg bg-white/5 p-3 text-sm text-white/80 whitespace-pre-wrap">{atual.q.comoFunciona}</div>
        )}

        {tempoTotalSeg !== null && (
          <div className="mt-2 flex flex-col items-center gap-2">
            <div
              className="text-5xl font-black tabular-nums"
              style={{ color: zerado ? 'var(--rd-erro, #e5484d)' : emAlerta ? 'var(--rd-gold)' : 'white' }}
            >
              {formatarTempo(Math.max(segundosRestantes ?? 0, 0))}
            </div>
            <div className="flex gap-2">
              <button className="rd-btn !p-3" title="Reiniciar" onClick={() => { setSegundosRestantes(tempoTotalSeg); setRodando(false); avisouFimRef.current = false }}>
                <RotateCcw size={18} />
              </button>
              <button className="rd-btn rd-btn-gold !p-3 !px-5" onClick={() => setRodando((r) => !r)}>
                {rodando ? <><Pause size={18} /> Pausar</> : <><Play size={18} /> {segundosRestantes === tempoTotalSeg ? 'Iniciar' : 'Continuar'}</>}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-4 shrink-0 border-t border-white/10">
        <button className="rd-btn !py-3 !px-4 flex-1" disabled={indice === 0} onClick={() => setIndice((i) => Math.max(0, i - 1))}>
          <ChevronLeft size={20} /> Anterior
        </button>
        <button
          className="rd-btn rd-btn-gold !py-3 !px-4 flex-1"
          disabled={indice === quadros.length - 1}
          onClick={() => setIndice((i) => Math.min(quadros.length - 1, i + 1))}
        >
          Próximo <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
