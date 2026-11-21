// Microfone do scout por voz (pedido 21/11/2026): usa o reconhecimento de voz
// do próprio navegador (Chrome no Android/computador, Safari no iPhone), em
// português. Toque no botão → fala → o texto volta em `aoOuvir`. Também fala
// a confirmação em voz alta (`falar`).
import { useCallback, useEffect, useRef, useState } from 'react'

interface ResultadoReconhecimento { 0: { transcript: string }; isFinal: boolean }
interface EventoReconhecimento { results: ArrayLike<ResultadoReconhecimento> }
interface Reconhecedor {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: EventoReconhecimento) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type ConstrutorReconhecedor = new () => Reconhecedor

function construtor(): ConstrutorReconhecedor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: ConstrutorReconhecedor; webkitSpeechRecognition?: ConstrutorReconhecedor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function vozDisponivel(): boolean {
  return construtor() !== null
}

export function useReconhecimentoVoz(aoOuvir: (texto: string) => void) {
  const [ouvindo, setOuvindo] = useState(false)
  const [parcial, setParcial] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const rec = useRef<Reconhecedor | null>(null)
  const callback = useRef(aoOuvir)
  useEffect(() => { callback.current = aoOuvir }, [aoOuvir])
  useEffect(() => () => rec.current?.abort(), [])

  const ouvir = useCallback(() => {
    const C = construtor()
    if (!C) { setErro('Este navegador não tem reconhecimento de voz. Use o Chrome (Android/computador) ou o Safari (iPhone).'); return }
    rec.current?.abort()
    const r = new C()
    r.lang = 'pt-BR'
    r.interimResults = true
    r.continuous = false
    r.maxAlternatives = 1
    let final = ''
    r.onresult = (e) => {
      let texto = ''
      for (let i = 0; i < e.results.length; i++) {
        texto += e.results[i][0].transcript
        if (e.results[i].isFinal) final = texto
      }
      setParcial(texto)
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setErro('O microfone está bloqueado. Libere o microfone para este site nas configurações do navegador.')
      else if (e.error === 'no-speech') setErro('Não ouvi nada. Toque e fale de novo.')
      else if (e.error === 'network') setErro('O reconhecimento de voz precisa de internet neste aparelho.')
      else if (e.error !== 'aborted') setErro('Não deu pra ouvir. Tente de novo.')
    }
    r.onend = () => {
      setOuvindo(false)
      rec.current = null
      if (final.trim()) callback.current(final.trim())
    }
    setErro(null)
    setParcial('')
    setOuvindo(true)
    rec.current = r
    try { r.start() } catch { setOuvindo(false); setErro('Não deu pra ligar o microfone. Tente de novo.') }
  }, [])

  const parar = useCallback(() => { rec.current?.stop() }, [])

  return { ouvindo, parcial, erro, ouvir, parar, disponivel: vozDisponivel() }
}

/** Fala uma frase curta em português (confirmação da marcação). */
export function falar(texto: string) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = 'pt-BR'
    u.rate = 1.15
    window.speechSynthesis.speak(u)
  } catch { /* sem voz no aparelho: segue só com a confirmação na tela */ }
}
