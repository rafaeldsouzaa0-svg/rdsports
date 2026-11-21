// Assistente (pedido 21/11/2026 — "braço direito" pra 2027), versão GRÁTIS:
// sem IA. Os 4 atalhos (Minha semana, Pendências, Preparar próximo jogo,
// Montar treino) são respondidos pelo próprio app com os dados do aparelho
// (ver `assistenteLocal.ts`) — custo zero, resposta na hora, funciona sem
// internet. Dá pra escrever ou falar a pergunta: o app reconhece qual dos 4
// assuntos ela pede. Perguntas livres o Rafael faz no Claude (fora do app).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Mic, Square, Send, CalendarDays, ListTodo, Swords, Dumbbell, RotateCcw, ChevronRight } from 'lucide-react'
import { PageTitle, Button } from '../components/ui'
import { useStore } from '../store'
import { useReconhecimentoVoz } from '../useReconhecimentoVoz'
import { responder, entenderPergunta, type RespostaAssistente, type TipoPergunta } from '../assistenteLocal'
import { isoDia } from '../utils'

type Mensagem = { de: 'treinador'; texto: string } | { de: 'assistente'; resposta: RespostaAssistente }

const ATALHOS: { tipo: TipoPergunta; rotulo: string; Icon: typeof CalendarDays }[] = [
  { tipo: 'semana', rotulo: 'Minha semana', Icon: CalendarDays },
  { tipo: 'pendencias', rotulo: 'Pendências', Icon: ListTodo },
  { tipo: 'jogo', rotulo: 'Preparar próximo jogo', Icon: Swords },
  { tipo: 'treino', rotulo: 'Montar treino', Icon: Dumbbell },
]

const NAO_ENTENDI: RespostaAssistente = {
  titulo: 'Essa eu ainda não sei responder',
  linhas: [
    'Eu respondo sobre: **sua semana**, **pendências**, **o próximo jogo** e **montar treino**. Toque num botão abaixo ou pergunte usando uma dessas palavras.',
    'Para perguntas livres (ex.: "quem errou mais saque em outubro?"), pergunte no app do Claude.',
  ],
}

/** Negrito simples (**texto**). */
function TextoFormatado({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span className="whitespace-pre-wrap">
      {partes.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
    </span>
  )
}

function BotoesAtalho({ onEscolher, compacto = false }: { onEscolher: (t: TipoPergunta) => void; compacto?: boolean }) {
  return (
    <div className={compacto ? 'flex gap-2 overflow-x-auto -mx-4 px-4 pb-1' : 'grid grid-cols-2 gap-2'}>
      {ATALHOS.map(({ tipo, rotulo, Icon }) => (
        <button
          key={tipo}
          onClick={() => onEscolher(tipo)}
          className={compacto ? 'rd-btn shrink-0 text-sm !py-1.5' : 'rd-btn flex-col !items-start text-left gap-1.5 !py-3'}
          style={compacto ? undefined : { minHeight: 72 }}
        >
          <Icon size={compacto ? 16 : 20} className="rd-accent-text" />
          <span className="text-sm font-semibold">{rotulo}</span>
        </button>
      ))}
    </div>
  )
}

export default function Assistente() {
  const dados = useStore()
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => { if (mensagens.length) fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [mensagens])

  function perguntar(pergunta: string, tipo: TipoPergunta | null) {
    const hoje = isoDia(new Date())
    const resposta = tipo ? responder(tipo, dados, hoje) : NAO_ENTENDI
    setMensagens((m) => [...m, { de: 'treinador', texto: pergunta }, { de: 'assistente', resposta }])
    setTexto('')
  }

  function atalho(tipo: TipoPergunta) {
    perguntar(ATALHOS.find((a) => a.tipo === tipo)!.rotulo, tipo)
  }

  function enviarTexto(t: string) {
    const limpo = t.trim()
    if (limpo) perguntar(limpo, entenderPergunta(limpo))
  }

  const voz = useReconhecimentoVoz((falado) => enviarTexto(falado))

  return (
    <div className="flex flex-col min-h-[calc(100dvh-7rem)]">
      <PageTitle
        icon={<Sparkles size={24} />}
        title="Assistente"
        subtitle="Sua agenda, pendências, próximo jogo e treino"
        action={mensagens.length > 0 ? (
          <Button onClick={() => setMensagens([])} className="text-sm"><RotateCcw size={16} /> Nova conversa</Button>
        ) : undefined}
      />

      <div className="flex-1 flex flex-col gap-3 pb-3">
        {mensagens.length === 0 && (
          <div className="rd-card p-4">
            <p className="text-sm text-[var(--rd-text-dim)] mb-3">Toque num atalho ou escreva/fale sua pergunta. O assistente só <strong>consulta</strong> seus dados — não muda nada no app.</p>
            <BotoesAtalho onEscolher={atalho} />
          </div>
        )}

        {mensagens.map((m, i) => m.de === 'treinador' ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[88%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[15px] leading-snug bg-[var(--rd-gold)] text-[#1a1300]">{m.texto}</div>
          </div>
        ) : (
          <div key={i} className="flex justify-start">
            <div className="max-w-[92%] rd-card rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[15px] leading-snug">
              <p className="font-bold mb-1.5">{m.resposta.titulo}</p>
              <div className="flex flex-col gap-1.5">
                {m.resposta.linhas.map((l, j) => <p key={j}><TextoFormatado texto={l} /></p>)}
              </div>
              {m.resposta.acoes && m.resposta.acoes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {m.resposta.acoes.map((a) => (
                    <Link key={a.para + a.rotulo} to={a.para} className="rd-btn text-sm !py-1.5">
                      {a.rotulo} <ChevronRight size={16} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {voz.erro && <p className="text-sm text-[var(--rd-erro)]">{voz.erro}</p>}
        {mensagens.length > 0 && <BotoesAtalho onEscolher={atalho} compacto />}
        <div ref={fim} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); enviarTexto(texto) }}
        className="sticky bottom-0 -mx-4 px-4 pt-2 pb-3 flex items-end gap-2 border-t"
        style={{ background: 'var(--rd-bg)', borderColor: 'var(--rd-border)' }}
      >
        <textarea
          className="rd-input flex-1 resize-none"
          rows={1}
          placeholder={voz.ouvindo ? (voz.parcial || 'Ouvindo…') : 'Pergunte algo…'}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarTexto(texto) } }}
          style={{ minHeight: 44, maxHeight: 140 }}
        />
        {voz.disponivel && (
          <button
            type="button"
            onClick={voz.ouvindo ? voz.parar : voz.ouvir}
            className={`rd-btn !px-3 ${voz.ouvindo ? 'rd-btn-danger' : ''}`}
            style={{ minHeight: 44 }}
            aria-label={voz.ouvindo ? 'Parar de ouvir' : 'Falar a pergunta'}
          >
            {voz.ouvindo ? <Square size={18} /> : <Mic size={18} />}
          </button>
        )}
        <button type="submit" disabled={!texto.trim()} className="rd-btn rd-btn-gold !px-3 disabled:opacity-50" style={{ minHeight: 44 }} aria-label="Enviar">
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
