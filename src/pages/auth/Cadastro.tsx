import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cloud } from 'lucide-react'
import { useAuthStore } from '../../authStore'
import { PageTitle, Card, Button, Field } from '../../components/ui'

export default function Cadastro() {
  const { cadastrar } = useAuthStore()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const r = await cadastrar(email, senha)
    setCarregando(false)
    if (!r.ok) { setErro(r.erro ?? 'Erro ao cadastrar.'); return }
    setSucesso(true)
  }

  return (
    <div className="max-w-md mx-auto">
      <PageTitle icon={<Cloud size={22} />} title="Criar conta na nuvem" />
      <Card>
        {sucesso ? (
          <p className="text-sm">Conta criada! Verifique seu e-mail pra confirmar antes de entrar.</p>
        ) : (
          <form onSubmit={onSubmit}>
            <Field label="E-mail">
              <input className="rd-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Senha (mínimo 6 caracteres)">
              <input className="rd-input" type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} />
            </Field>
            {erro && <p className="text-sm text-red-500 mb-3">{erro}</p>}
            <Button variant="gold" type="submit" disabled={carregando}>{carregando ? 'Criando…' : 'Criar conta'}</Button>
          </form>
        )}
        <Link to="/auth/login" className="inline-block mt-4 text-sm text-[var(--rd-text-dim)] underline">Já tenho conta — entrar</Link>
      </Card>
    </div>
  )
}
