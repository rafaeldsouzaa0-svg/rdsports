import { useRef, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { enviarLogo } from '../logoUpload'

/** Botão circular com o logo atual (ou um ícone neutro se ainda não tem) —
 *  toca pra escolher uma imagem do aparelho e enviar pro bucket `logos`.
 *  Reaproveitado pra escola e adversário (pedido 30/10/2026: "Logo das
 *  escolas/adversários nas telas"). */
export function LogoUpload({
  logoUrl, prefixo, id, nome, onEnviado, tamanho = 56, mostrarTexto = true,
}: {
  logoUrl?: string
  prefixo: 'escola' | 'adversario' | 'atleta'
  id: string
  nome: string
  onEnviado: (url: string) => void
  tamanho?: number
  mostrarTexto?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function arquivoEscolhido(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    setErro(null)
    setEnviando(true)
    try {
      const url = await enviarLogo(arquivo, prefixo, id)
      onEnviado(url)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
        className="rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-[var(--rd-surface)] border border-[var(--rd-border)]"
        style={{ width: tamanho, height: tamanho }}
        title={logoUrl ? 'Trocar logo' : 'Adicionar logo'}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={nome} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={Math.round(tamanho * 0.4)} className="text-[var(--rd-text-dim)]" />
        )}
      </button>
      <input
        ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden" onChange={arquivoEscolhido}
      />
      {(mostrarTexto || enviando || erro) && (
        <div className="text-xs">
          {enviando ? (
            <span className="text-[var(--rd-text-dim)]">Enviando…</span>
          ) : erro ? (
            <span className="text-[var(--rd-erro)]">{erro}</span>
          ) : mostrarTexto ? (
            <span className="text-[var(--rd-text-dim)]">Toque pra {logoUrl ? 'trocar' : 'adicionar'} o logo</span>
          ) : null}
        </div>
      )}
    </div>
  )
}

/** Versão só de exibição (sem botão de upload) — pro logo de um adversário
 *  aparecer ao lado de "vs Fulano" em Dashboard/Calendário/Histórico/Relatório,
 *  sem precisar de nenhum dado de autenticação ali. Cai pro ícone neutro
 *  quando não há logo cadastrado, nunca quebra o layout. */
export function LogoExibicao({ logoUrl, nome, tamanho = 28 }: { logoUrl?: string; nome: string; tamanho?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-[var(--rd-surface)] border border-[var(--rd-border)]"
      style={{ width: tamanho, height: tamanho }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={nome} className="w-full h-full object-cover" />
      ) : (
        <ImageIcon size={Math.round(tamanho * 0.5)} className="text-[var(--rd-text-dim)]" />
      )}
    </span>
  )
}
