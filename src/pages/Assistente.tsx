// Assistente com IA (pedido 21/11/2026 — "braço direito" pra 2027).
// FASE 2: só LEITURA. O treinador pergunta (digitando ou falando) e a IA
// responde olhando os dados dele na nuvem (agenda, jogos, scout, treinos).
// Quem conversa com a IA é a Edge Function `assistente` no Supabase — a chave
// da IA fica lá, nunca no aparelho. A função usa o login do treinador, então
// só enxerga os dados dele (mesma regra do resto do app: owner_id).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Mic, Square, Send, CalendarDays, ListTodo, Swords, Dumbbell, RotateCcw } from 'lucide-react'
import { PageTitle, Button } from '../components/ui'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../authStore'
import { useReconhecimentoVoz } from '../useReconhecimentoVoz'

export interface MensagemAssistente { role: 'user' | 'assistant'; content: string }

const ATALHOS = [
  { rotulo: 'Minha semana', Icon: CalendarDays, pergunta: 'Como está a minha semana? Liste jogos e compromissos dos próximos 7 dias.' },
  { rotulo: 'Pendências', Icon: ListTodo, pergunta: 'Quais são as minhas pendências? (jogos sem scout, partidas não finalizadas, jogos sem convocadas)' },
  { rotulo: 'Preparar próximo jogo', Icon: Swords, pergunta: 'Me ajude a preparar o próximo jogo: histórico contra o adversário e o que a turma precisa cuidar.' },
  { rotulo: 'Montar treino', Icon: Dumbbell, pergunta: 'Monte um treino para a turma do próximo jogo, focado nos pontos fracos dos últimos jogos.' },
]

/** Negrito simples (**texto**) — a IA responde em texto com listas e destaques. */
function TextoFormatado({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span className="whitespace-pre-wrap">
      {partes.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
    </span>
  )
}

export default function Assistente() {
  const session = useAuthStore((s) => s.session)
  const [mensagens, setMensagens] = useState<MensagemAssistente[]>([])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [mensagens, pensando])

  async function enviar(pergunta: string) {
    const limpa = pergunta.trim()
    if (!limpa || pensando) return
    const conversa: MensagemAssistente[] = [...mensagens, { role: 'user', content: limpa }]
    setMensagens(conversa)
    setTexto('')
    setErro(null)
    setPensando(true)
    try {
      const { data, error } = await supabase.functions.invoke('assistente', {
        body: { mensagens: conversa, hoje: new Date().toISOString().slice(0, 10) },
      })
      if (error) throw error
      const resposta = (data as { resposta?: string })?.resposta?.trim()
      setMensagens([...conversa, { role: 'assistant', content: resposta || 'Não consegui responder agora. Tente perguntar de outro jeito.' }])
    } catch {
      setErro(navigator.onLine ? 'O assistente não respondeu. Tente de novo daqui a pouco.' : 'Sem internet — o assistente precisa de internet pra olhar seus dados.')
    } finally {
      setPensando(false)
    }
  }

  const voz = useReconhecimentoVoz((falado) => enviar(falado))

  return (
    <div className="flex flex-col min-h-[calc(100dvh-7rem)]">
      <PageTitle
        icon={<Sparkles size={24} />}
        title="Assistente"
        subtitle="Pergunte sobre sua agenda, jogos, scout e treinos"
        action={mensagens.length > 0 ? (
          <Button onClick={() => { setMensagens([]); setErro(null) }} className="text-sm"><RotateCcw size={16} /> Nova conversa</Button>
        ) : undefined}
      />

      {!session && (
        <div className="rd-card p-4 mb-4 text-sm">
          O assistente usa os dados da sua conta na nuvem. <Link to="/auth/login" className="font-semibold underline">Entre na sua conta</Link> para usar.
        </div>
      )}

      <div className="flex-1 flex flex-col gap-3 pb-3">
        {mensagens.length === 0 && (
          <div className="rd-card p-4">
            <p className="text-sm text-[var(--rd-text-dim)] mb-3">Toque num atalho ou escreva/fale sua pergunta. Por enquanto o assistente só <strong>consulta</strong> — não muda nada no app.</p>
            <div className="grid grid-cols-2 gap-2">
              {ATALHOS.map(({ rotulo, Icon, pergunta }) => (
                <button
                  key={rotulo}
                  onClick={() => enviar(pergunta)}
                  disabled={!session || pensando}
                  className="rd-btn flex-col !items-start text-left gap-1.5 !py-3 disabled:opacity-50"
                  style={{ minHeight: 72 }}
                >
                  <Icon size={20} className="rd-accent-text" />
                  <span className="text-sm font-semibold">{rotulo}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug ${m.role === 'user' ? 'bg-[var(--rd-gold)] text-[#1a1300] rounded-br-md' : 'rd-card rounded-bl-md'}`}
            >
              <TextoFormatado texto={m.content} />
            </div>
          </div>
        ))}

        {pensando && (
          <div className="flex justify-start">
            <div className="rd-card rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm text-[var(--rd-text-dim)] inline-flex items-center gap-2">
              <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: 'var(--rd-gold)', animation: 'rd-pulse 1s ease-in-out infinite' }} />
              Olhando seus dados…
            </div>
          </div>
        )}
        {erro && <p className="text-sm text-[var(--rd-erro)]">{erro}</p>}
        {voz.erro && <p className="text-sm text-[var(--rd-erro)]">{voz.erro}</p>}
        <div ref={fim} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); enviar(texto) }}
        className="sticky bottom-0 -mx-4 px-4 pt-2 pb-3 flex items-end gap-2 border-t"
        style={{ background: 'var(--rd-bg)', borderColor: 'var(--rd-border)' }}
      >
        <textarea
          className="rd-input flex-1 resize-none"
          rows={1}
          placeholder={voz.ouvindo ? (voz.parcial || 'Ouvindo…') : 'Pergunte algo…'}
          value={texto}
          disabled={!session}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(texto) } }}
          style={{ minHeight: 44, maxHeight: 140 }}
        />
        {voz.disponivel && (
          <button
            type="button"
            onClick={voz.ouvindo ? voz.parar : voz.ouvir}
            disabled={!session || pensando}
            className={`rd-btn !px-3 disabled:opacity-50 ${voz.ouvindo ? 'rd-btn-danger' : ''}`}
            style={{ minHeight: 44 }}
            aria-label={voz.ouvindo ? 'Parar de ouvir' : 'Falar a pergunta'}
          >
            {voz.ouvindo ? <Square size={18} /> : <Mic size={18} />}
          </button>
        )}
        <button type="submit" disabled={!session || pensando || !texto.trim()} className="rd-btn rd-btn-gold !px-3 disabled:opacity-50" style={{ minHeight: 44 }} aria-label="Enviar">
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
