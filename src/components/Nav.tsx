import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, School, BarChart3, Calendar, Trophy, Settings, CalendarRange, ClipboardList, X, Menu, Volleyball } from 'lucide-react'

const items = [
  { to: '/', label: 'Início', Icon: Home },
  { to: '/escolas', label: 'Escolas', Icon: School },
  { to: '/treinos', label: 'Treinos', Icon: ClipboardList },
  { to: '/estatisticas', label: 'Estatísticas', Icon: BarChart3 },
  { to: '/calendario', label: 'Calendário', Icon: Calendar },
  { to: '/historico', label: 'Histórico', Icon: Trophy },
  { to: '/temporada', label: 'Temporada', Icon: CalendarRange },
  { to: '/configuracoes', label: 'Config.', Icon: Settings },
]

export function SidebarNav() {
  return (
    <nav className="hidden md:flex flex-col gap-1 w-56 shrink-0 border-r border-[var(--rd-border)] p-3">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-[var(--rd-gold)] text-[#1a1300]' : 'hover:bg-black/5 dark:hover:bg-white/10'}`
          }
        >
          <it.Icon size={18} strokeWidth={2.25} />
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Gaveta de navegação (pedido 30/10/2026): usada nas telas em tela cheia
 *  (ex.: Scout ao vivo) onde a sidebar/bottom nav fica escondida pra não
 *  disputar espaço com o jogo — essa gaveta dá acesso às mesmas páginas sem
 *  precisar sair do fluxo. Fecha sozinha ao tocar num link. */
export function MenuGaveta({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  if (!aberto) return null
  return (
    <div
      className="fixed inset-0 z-[60] flex"
      style={{ background: 'rgba(0,0,0,.72)' }}
      onClick={onFechar}
    >
      <nav
        className="w-64 max-w-[80vw] h-full p-3 flex flex-col gap-1"
        style={{ background: 'var(--rd-surface)', borderRight: '1px solid var(--rd-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-2 py-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--rd-text-dim)]">Menu</span>
          <button onClick={onFechar} className="text-[var(--rd-text-dim)] p-1"><X size={18} /></button>
        </div>
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            onClick={onFechar}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? 'bg-[var(--rd-gold)] text-[#1a1300]' : 'hover:bg-black/5 dark:hover:bg-white/10'}`
            }
          >
            <it.Icon size={18} strokeWidth={2.25} />
            {it.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/** Navegação do celular (pedido 30/10/2026): antes era uma barra fixa embaixo
 *  com os 8 itens espremidos (ficava apertado e cortava texto). Agora é uma
 *  barra fina no topo, só com o botão de menu (☰) no canto superior
 *  esquerdo — toca pra abrir a mesma gaveta lateral que já existia pro Scout
 *  ao vivo (`MenuGaveta`), com os itens maiores e mais fáceis de tocar. */
export function TopoMobile() {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <header
        className="md:hidden sticky top-0 z-40 flex items-center gap-2 px-3 py-2.5 border-b"
        style={{ background: 'var(--rd-surface)', borderColor: 'var(--rd-border)' }}
      >
        <button onClick={() => setAberto(true)} className="p-1.5 -ml-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Abrir menu">
          <Menu size={22} strokeWidth={2.25} />
        </button>
        <Volleyball size={18} className="rd-accent-text" />
        <span className="font-black text-sm tracking-tight">RDSports</span>
      </header>
      <MenuGaveta aberto={aberto} onFechar={() => setAberto(false)} />
    </>
  )
}
