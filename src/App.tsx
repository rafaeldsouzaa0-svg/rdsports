import { useEffect } from 'react'
import { HashRouter, Routes, Route, useLocation, matchPath } from 'react-router-dom'
import { SidebarNav, TopoMobile } from './components/Nav'
import Dashboard from './pages/Dashboard'
import Escolas from './pages/Escolas'
import EscolaDetalhe from './pages/EscolaDetalhe'
import TurmaDetalhe from './pages/TurmaDetalhe'
import AtletaPerfil from './pages/AtletaPerfil'
import ModoJogo from './pages/ModoJogo'
import Relatorio from './pages/Relatorio'
import Historico from './pages/Historico'
import Estatisticas from './pages/Estatisticas'
import Calendario from './pages/Calendario'
import Temporada from './pages/Temporada'
import Configuracoes from './pages/Configuracoes'
import Lixeira from './pages/Lixeira'
import Treinos from './pages/Treinos'
import SessaoTreinoForm from './pages/SessaoTreinoForm'
import Login from './pages/auth/Login'
import Cadastro from './pages/auth/Cadastro'
import RecuperarSenha from './pages/auth/RecuperarSenha'
import RedefinirSenha from './pages/auth/RedefinirSenha'
import AtletaEntrar from './pages/atleta/Entrar'
import AtletaPainel from './pages/atleta/Painel'
import { initSyncManager } from './syncManager'

/** Layout do app do treinador (sidebar no desktop, barra com menu ☰ no
 *  celular — pedido 30/10/2026, substituiu a barra de abas embaixo). O
 *  Portal da Atleta
 *  (rotas /atleta/*) fica FORA desse layout de propósito: é uma área pública,
 *  sem login de treinador, acessada pela própria atleta — não deve mostrar a
 *  navegação de escolas/turmas do treinador nem nada relacionado a ela. */
function LayoutTreinador() {
  const location = useLocation()
  // Scout ao vivo (pedido 30/10/2026: "deixar em tela cheia"): esconde a
  // navegação lateral/inferior nessa tela só, pra sobrar mais espaço pros
  // botões do jogo — a navegação continua acessível pelo menu (☰) dentro da
  // própria tela de scout (ver <MenuGaveta /> em ModoJogo.tsx).
  const telaCheia = !!matchPath('/scout/:id', location.pathname)

  return (
    <div className="flex min-h-screen">
      {!telaCheia && <SidebarNav />}
      <div className="flex-1 flex flex-col min-w-0">
        {!telaCheia && <TopoMobile />}
        <main className={telaCheia ? 'flex-1 w-full p-3 pb-6' : 'flex-1 p-4 pb-6 max-w-5xl mx-auto w-full'}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/escolas" element={<Escolas />} />
          <Route path="/escolas/:id" element={<EscolaDetalhe />} />
          <Route path="/turmas/:id" element={<TurmaDetalhe />} />
          <Route path="/atletas/:id" element={<AtletaPerfil />} />
          <Route path="/scout/:id" element={<ModoJogo />} />
          <Route path="/relatorio/:id" element={<Relatorio />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/estatisticas" element={<Estatisticas />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/temporada" element={<Temporada />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/lixeira" element={<Lixeira />} />
          <Route path="/treinos" element={<Treinos />} />
          <Route path="/treinos/:id" element={<SessaoTreinoForm />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/cadastro" element={<Cadastro />} />
          <Route path="/auth/recuperar-senha" element={<RecuperarSenha />} />
          <Route path="/auth/redefinir-senha" element={<RedefinirSenha />} />
        </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  useEffect(() => {
    initSyncManager()
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route path="/atleta/entrar" element={<AtletaEntrar />} />
        <Route path="/atleta/painel" element={<AtletaPainel />} />
        <Route path="/*" element={<LayoutTreinador />} />
      </Routes>
    </HashRouter>
  )
}
