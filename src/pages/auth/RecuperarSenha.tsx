import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cloud } from 'lucide-react'
import { useAuthStore } from '../../authStore'
import { PageTitle, Card, Button, Field } from '../../components/ui'

export default function RecuperarSenha() {
  const { recuperarSenha } = useAuthStore()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    const r = await recuperarSenha(email)
    if (!r.ok) { setErro(r.erro ?? 'Erro ao enviar e-mail.'); return }
    setEnviado(true)
  }

  return (
    <div className="max-w-md mx-auto">
      <PageTitle icon={<Cloud size={22} />} title="Recuperar senha" />
      <Card>
        {enviado ? (
          <p className="text-sm">Enviamos um e-mail com o link pra redefinir sua senha.</p>
        ) : (
          <form onSubmit={onSubmit}>
            <Field label="E-mail">
              <input className="rd-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {erro && <p className="text-sm text-red-500 mb-3">{erro}</p>}
            <Button variant="gold" type="submit">Enviar link</Button>
          </form>
        )}
        <Link to="/auth/login" className="inline-block mt-4 text-sm text-[var(--rd-text-dim)] underline">← Voltar pro login</Link>
      </Card>
    </div>
  )
}
