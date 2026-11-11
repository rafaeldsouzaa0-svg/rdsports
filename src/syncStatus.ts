// Estado observável de sincronização (auditoria 30/10/2026): até aqui o app
// sincronizava com a nuvem em silêncio — nenhuma tela mostrava se uma ação
// recém-registrada no scout ao vivo já tinha sido salva na nuvem ou ainda
// estava só no aparelho. Pedido explícito da auditoria: "não mostre que uma
// ação está sincronizada se ela ainda estiver pendente" + indicador discreto
// na tela de scout. Esse módulo só guarda o estado; quem atualiza é o
// syncManager.ts, e quem lê é o componente <IndicadorSync /> (components/ui.tsx).
import { create } from 'zustand'

export type SincronizacaoStatus =
  | 'desligado'      // não logado — não há sincronização em nuvem (só local)
  | 'offline'        // logado, mas sem internet agora
  | 'pendente'       // mudança local feita, aguardando o debounce empurrar pra nuvem
  | 'sincronizando'  // enviando pra nuvem agora
  | 'sincronizado'   // última mudança já confirmada na nuvem
  | 'erro'           // a última tentativa de enviar falhou (vai tentar de novo)

interface SyncStatusState {
  status: SincronizacaoStatus
  atualizadoEm: string | null
  setStatus: (status: SincronizacaoStatus) => void
}

export const useSyncStatus = create<SyncStatusState>((set) => ({
  status: 'desligado',
  atualizadoEm: null,
  setStatus: (status) => set({ status, atualizadoEm: new Date().toISOString() }),
}))
