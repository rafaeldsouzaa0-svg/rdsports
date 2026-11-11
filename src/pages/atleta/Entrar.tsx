import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Volleyball } from 'lucide-react'
import { Button, Field } from '../../components/ui'
import { entrarComCodigo } from '../../atletaAuth'

export default function AtletaEntrar() {
  const navigate = useNavigate()
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const resultado = await entrarComCodigo(codigo)
    setCarregando(false)
    if (resultado.ok) navigate('/atleta/painel')
    else setErro(resultado.erro)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="rd-card p-6 w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-2xl rd-header-gold flex items-center justify-center mb-3">
            <Volleyball size={26} />
          </div>
          <h1 className="text-xl font-black tracking-tight">Portal da Atleta</h1>
          <p className="text-sm text-[var(--rd-text-dim)] mt-1">Digite o código que seu professor te passou pra ver seu rating e seu scout.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Field label="Código de acesso">
            <input
              className="rd-input text-center text-2xl font-black tracking-widest uppercase"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              maxLength={12}
              autoFocus
              placeholder="ABC123"
            />
          </Field>
          {erro && <p className="text-sm text-[var(--rd-erro)] mb-3">{erro}</p>}
          <Button variant="gold" className="w-full justify-center" disabled={carregando}>
            <KeyRound size={16} /> {carregando ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
