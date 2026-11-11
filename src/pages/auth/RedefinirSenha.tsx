import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cloud } from 'lucide-react'
import { useAuthStore } from '../../authStore'
import { PageTitle, Card, Button, Field, BotaoVoltar } from '../../components/ui'

export default function RedefinirSenha() {
  const navigate = useNavigate()
  const { redefinirSenha } = useAuthStore()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    const r = await redefinirSenha(senha)
    if (!r.ok) { setErro(r.erro ?? 'Erro ao redefinir senha.'); return }
    setOk(true)
    setTimeout(() => navigate('/configuracoes'), 1500)
  }

  return (
    <div className="max-w-md mx-auto">
      <BotaoVoltar to="/configuracoes" label="Configurações" />
      <PageTitle icon={<Cloud size={22} />} title="Definir nova senha" />
      <Card>
        {ok ? (
          <p className="text-sm">Senha atualizada! Levando você de volta…</p>
        ) : (
          <form onSubmit={onSubmit}>
            <Field label="Nova senha (mínimo 6 caracteres)">
              <input className="rd-input" type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} />
            </Field>
            {erro && <p className="text-sm text-red-500 mb-3">{erro}</p>}
            <Button variant="gold" type="submit">Salvar nova senha</Button>
          </form>
        )}
      </Card>
    </div>
  )
}
