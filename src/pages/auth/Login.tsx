import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Cloud } from 'lucide-react'
import { useAuthStore } from '../../authStore'
import { PageTitle, Card, Button, Field, BotaoVoltar } from '../../components/ui'

export default function Login() {
  const navigate = useNavigate()
  const { entrar } = useAuthStore()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const r = await entrar(email, senha)
    setCarregando(false)
    if (!r.ok) { setErro(r.erro ?? 'Erro ao entrar.'); return }
    navigate('/configuracoes')
  }

  return (
    <div className="max-w-md mx-auto">
      <BotaoVoltar to="/configuracoes" label="Configurações" />
      <PageTitle icon={<Cloud size={22} />} title="Entrar na conta na nuvem" subtitle="Sincroniza seus dados entre todos os seus aparelhos" />
      <Card>
        <form onSubmit={onSubmit}>
          <Field label="E-mail">
            <input className="rd-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Senha">
            <input className="rd-input" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Field>
          {erro && <p className="text-sm text-red-500 mb-3">{erro}</p>}
          <Button variant="gold" type="submit" disabled={carregando}>{carregando ? 'Entrando…' : 'Entrar'}</Button>
        </form>
        <div className="flex justify-between mt-4 text-sm text-[var(--rd-text-dim)]">
          <Link to="/auth/recuperar-senha" className="underline">Esqueci minha senha</Link>
          <Link to="/auth/cadastro" className="underline">Criar conta</Link>
        </div>
      </Card>
      <p className="mt-6 text-xs text-center text-[var(--rd-text-dim)]">
        É atleta e recebeu um código de acesso? <Link to="/atleta/entrar" className="underline">Entre no Portal da Atleta</Link>
      </p>
    </div>
  )
}
