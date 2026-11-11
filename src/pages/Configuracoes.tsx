import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings, Cloud, LogOut, RefreshCw, Trash2, Download, Upload, Shield } from 'lucide-react'
import { PageTitle, Card, Button, IndicadorSync } from '../components/ui'
import { LogoUpload } from '../components/LogoUpload'
import { useAuthStore } from '../authStore'
import { useStore } from '../store'
import { pullAll } from '../cloudSync'
import { montarArquivoBackup, baixarBackup, lerArquivoBackup, resumoBackup } from '../backup'

export default function Configuracoes() {
  const { user, carregando, sair } = useAuthStore()
  const mesclarDaNuvem = useStore((s) => s.mesclarDaNuvem)
  const restaurarBackupCompleto = useStore((s) => s.restaurarBackupCompleto)
  const adversarios = useStore((s) => s.adversarios)
  const updateAdversario = useStore((s) => s.updateAdversario)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [mensagemBackup, setMensagemBackup] = useState<string | null>(null)
  const inputRestaurarRef = useRef<HTMLInputElement>(null)

  function baixarBackupCompleto() {
    const s = useStore.getState()
    const arquivo = montarArquivoBackup({
      escolas: s.escolas, turmas: s.turmas, equipes: s.equipes, categorias: s.categorias,
      atletas: s.atletas, adversarios: s.adversarios, campeonatos: s.campeonatos, partidas: s.partidas,
      horariosTreino: s.horariosTreino, jogosAgendados: s.jogosAgendados, presencas: s.presencas,
      avaliacoes: s.avaliacoes, sessoesTreino: s.sessoesTreino, bibliotecaExercicios: s.bibliotecaExercicios,
    })
    baixarBackup(arquivo)
    const resumo = resumoBackup(arquivo.dados).map((r) => `${r.total} ${r.label}`).join(', ')
    setMensagemBackup(`Backup baixado (${resumo}).`)
  }

  function escolherArquivoRestaurar() {
    setMensagemBackup(null)
    inputRestaurarRef.current?.click()
  }

  async function arquivoEscolhido(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const texto = await file.text()
      const arquivo = lerArquivoBackup(texto)
      const resumo = resumoBackup(arquivo.dados).map((r) => `${r.total} ${r.label}`).join(', ')
      const confirmou = window.confirm(
        `Restaurar este backup (de ${new Date(arquivo.exportadoEm).toLocaleString('pt-BR')}, com ${resumo})?\n\n` +
        'Isso vai SUBSTITUIR todos os dados que estão no app agora por esses do arquivo. O que tiver aqui hoje e não estiver no backup será perdido.'
      )
      if (!confirmou) return
      restaurarBackupCompleto(arquivo.dados)
      setMensagemBackup('Backup restaurado.')
    } catch (err) {
      setMensagemBackup(err instanceof Error ? err.message : 'Não foi possível ler esse arquivo.')
    }
  }

  async function buscarAgora() {
    setSincronizando(true)
    setMensagem(null)
    try {
      const dados = await pullAll()
      if (dados) {
        mesclarDaNuvem(dados)
        setMensagem('Dados atualizados a partir da nuvem.')
      }
    } catch {
      setMensagem('Não foi possível buscar agora — verifique a conexão.')
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div>
      <PageTitle icon={<Settings size={22} />} title="Configurações" />

      <Card className="mb-5">
        <div className="flex items-center gap-2 font-semibold mb-2">
          <Cloud size={18} className="rd-accent-text" /> Conta na nuvem
        </div>
        {carregando ? (
          <p className="text-sm text-[var(--rd-text-dim)]">Carregando…</p>
        ) : user ? (
          <div>
            <p className="text-sm mb-1">Conectado como <strong>{user.email}</strong>. Seus dados estão sincronizados com todos os aparelhos logados nesta conta.</p>
            {/* Indicador de sincronização (pedido 30/10/2026: antes só aparecia
               dentro do Scout ao vivo — colocado aqui também pra dar pra
               conferir "está sincronizado?" sem precisar estar numa partida,
               útil pra diagnosticar se um aparelho está ou não enviando/
               recebendo da nuvem. */}
            <IndicadorSync className="mb-3" />
            <div className="flex gap-2 flex-wrap">
              <Button onClick={buscarAgora} disabled={sincronizando}>
                <RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} /> Buscar atualização agora
              </Button>
              <Button variant="danger" onClick={() => sair()}><LogOut size={16} /> Sair</Button>
            </div>
            {mensagem && <p className="text-xs text-[var(--rd-text-dim)] mt-2">{mensagem}</p>}
          </div>
        ) : (
          <div>
            <p className="text-sm text-[var(--rd-text-dim)] mb-3">
              Entre com sua conta pra sincronizar os dados entre todos os seus aparelhos e recuperar os dados
              que já existiam na nuvem.
            </p>
            <div className="flex gap-2">
              <Link to="/auth/login"><Button variant="gold">Entrar</Button></Link>
              <Link to="/auth/cadastro"><Button>Criar conta</Button></Link>
            </div>
          </div>
        )}
      </Card>

      <Card className="mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-semibold">
            <Trash2 size={18} className="rd-accent-text" /> Lixeira
          </div>
          <Link to="/lixeira"><Button>Ver itens apagados</Button></Link>
        </div>
        <p className="text-sm text-[var(--rd-text-dim)] mt-2">
          Atletas, turmas e partidas apagadas ficam guardadas aqui — dá pra restaurar quando quiser.
        </p>
      </Card>

      <Card className="mb-5">
        <div className="flex items-center gap-2 font-semibold mb-2">
          <Download size={18} className="rd-accent-text" /> Backup completo
        </div>
        <p className="text-sm text-[var(--rd-text-dim)] mb-3">
          Baixa um arquivo com todas as informações do app nesse aparelho — escolas, turmas, atletas, partidas
          com o scout, sessões de treino, presenças e avaliações. Guarda esse arquivo em algum lugar seguro
          (Drive, e-mail pra você mesmo etc.) e, se precisar, use "Restaurar backup" pra trazer tudo de volta.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="gold" onClick={baixarBackupCompleto}><Download size={16} /> Baixar backup completo</Button>
          <Button onClick={escolherArquivoRestaurar}><Upload size={16} /> Restaurar backup</Button>
          <input ref={inputRestaurarRef} type="file" accept="application/json,.json" className="hidden" onChange={arquivoEscolhido} />
        </div>
        {mensagemBackup && <p className="text-xs text-[var(--rd-text-dim)] mt-2">{mensagemBackup}</p>}
      </Card>

      {adversarios.length > 0 && (
        <Card className="mb-5">
          <div className="flex items-center gap-2 font-semibold mb-2">
            <Shield size={18} className="rd-accent-text" /> Logos dos adversários
          </div>
          <p className="text-sm text-[var(--rd-text-dim)] mb-3">
            Toque no escudo de um adversário pra adicionar ou trocar o logo dele — aparece no Calendário,
            Histórico, Relatório e na tela inicial sempre que ele for o rival do jogo.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[...adversarios].sort((a, b) => a.nome.localeCompare(b.nome)).map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <LogoUpload
                  logoUrl={a.logoUrl} prefixo="adversario" id={a.id} nome={a.nome} tamanho={40}
                  mostrarTexto={false}
                  onEnviado={(url) => updateAdversario(a.id, { logoUrl: url })}
                />
                <span className="text-sm font-medium">{a.nome}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <p className="text-sm text-[var(--rd-text-dim)]">
          Versão reconstruída do RDSports após a perda do código-fonte original. Algumas páginas das rodadas
          anteriores (lembretes, documentos, avaliações periódicas detalhadas, campeonatos avançados e busca
          global) ainda serão trazidas de volta nas próximas atualizações.
        </p>
      </Card>
    </div>
  )
}
