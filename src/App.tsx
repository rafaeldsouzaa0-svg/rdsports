import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, useLocation, matchPath } from 'react-router-dom'
import { SidebarNav, TopoMobile } from './components/Nav'
import { initSyncManager } from './syncManager'

// Cada tela é carregada só quando é aberta (code-splitting), pra o app abrir
// mais rápido no celular. O service worker (PWA) continua guardando todas as
// telas no cache, então o app segue funcionando offline durante o jogo.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Escolas = lazy(() => import('./pages/Escolas'))
const EscolaDetalhe = lazy(() => import('./pages/EscolaDetalhe'))
const TurmaDetalhe = lazy(() => import('./pages/TurmaDetalhe'))
const AtletaPerfil = lazy(() => import('./pages/AtletaPerfil'))
const ModoJogo = lazy(() => import('./pages/ModoJogo'))
const Relatorio = lazy(() => import('./pages/Relatorio'))
const Historico = lazy(() => import('./pages/Historico'))
const Estatisticas = lazy(() => import('./pages/Estatisticas'))
const Calendario = lazy(() => import('./pages/Calendario'))
const Temporada = lazy(() => import('./pages/Temporada'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const Lixeira = lazy(() => import('./pages/Lixeira'))
const Treinos = lazy(() => import('./pages/Treinos'))
const SessaoTreinoForm = lazy(() => import('./pages/SessaoTreinoForm'))
const Login = lazy(() => import('./pages/auth/Login'))
const Cadastro = lazy(() => import('./pages/auth/Cadastro'))
const RecuperarSenha = lazy(() => import('./pages/auth/RecuperarSenha'))
const RedefinirSenha = lazy(() => import('./pages/auth/RedefinirSenha'))
const AtletaEntrar = lazy(() => import('./pages/atleta/Entrar'))
const AtletaPainel = lazy(() => import('./pages/atleta/Painel'))

/** Mostrado por um instante enquanto a tela é carregada pela primeira vez. */
function Carregando() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Carregando">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent opacity-40" />
    </div>
  )
}

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
        <Suspense fallback={<Carregando />}>
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
        </Suspense>
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
      <Suspense fallback={<Carregando />}>
      <Routes>
        <Route path="/atleta/entrar" element={<AtletaEntrar />} />
        <Route path="/atleta/painel" element={<AtletaPainel />} />
        <Route path="/*" element={<LayoutTreinador />} />
      </Routes>
      </Suspense>
    </HashRouter>
  )
}
