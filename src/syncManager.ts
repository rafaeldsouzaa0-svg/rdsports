// Liga a sessão de autenticação (authStore) ao motor de sincronização (cloudSync)
// com o store principal (store.ts). Chamado uma vez em App.tsx.
//
// - Ao logar: puxa tudo da nuvem e mescla no local (recuperação dos dados antigos).
// - Enquanto logado: empurra qualquer mudança local pra nuvem (debounce de 3s) e
//   puxa periodicamente (a cada 25s) pra pegar o que outros aparelhos mandaram —
//   simples e "com o app aberto", mesmo espírito já usado nos Lembretes (Rodada 47).
//
// CORREÇÃO (auditoria 30/10/2026): o `flush` que rodava ao fechar/minimizar o
// app só CANCELAVA o timer do envio pendente — nunca chegou a existir um envio
// de verdade ali. Na prática, se o Henrique fechasse o app (ou trocasse de
// aba) nos 3s depois do último ponto marcado, aquela última mudança ficava
// só no aparelho dele até a próxima mudança acontecer (podia ser só no dia
// seguinte, ou nunca, se ele não abrisse o app de novo tão cedo) — ela nunca
// se perdia (o salvamento local do Zustand/IndexedDB é imediato, independente
// disso), mas não chegava na nuvem nem nos outros aparelhos/backup até lá.
// Agora o `flush` dispara o envio de verdade (não só cancela o timer).
import { useAuthStore } from './authStore'
import { useStore } from './store'
import { pullAll, pushAll } from './cloudSync'
import { useSyncStatus } from './syncStatus'

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let unsubscribeStore: (() => void) | null = null
let sincronizando = false
let logadoAtual = false
// CORREÇÃO (30/10/2026 — junto com o conserto do pushAll em lote): sem isso,
// toda vez que `mesclarDaNuvem` trazia algo novo da nuvem (inclusive durante
// o PRÓPRIO puxarEMesclar() chamado no início do executarPush), o
// `useStore.subscribe` disparava de novo e chamava agendarPush() — que
// sobrescrevia o status de volta pra "pendente" (mostrando "Salvando..." no
// app) bem no meio de um envio que já estava rolando. Isso fazia o indicador
// parecer travado em "Salvando..." pro resto da sincronização, mesmo com o
// envio de verdade em andamento por trás. Agora, enquanto uma mesclagem vinda
// da nuvem está sendo aplicada, mudanças de estado não reagendam um novo
// envio.
let aplicandoDaNuvem = false

async function puxarEMesclar() {
  try {
    const dados = await pullAll()
    if (dados) {
      aplicandoDaNuvem = true
      try {
        useStore.getState().mesclarDaNuvem(dados)
      } finally {
        aplicandoDaNuvem = false
      }
    }
  } catch (err) {
    console.warn('[sync] falha ao puxar da nuvem', err)
  }
}

async function executarPush() {
  if (sincronizando) return
  sincronizando = true
  useSyncStatus.getState().setStatus('sincronizando')
  try {
    // CORREÇÃO (pedido 30/10/2026, junto com o conserto do `mesclarPorId` em
    // store.ts): antes de empurrar, puxa e mescla o que tiver de mais novo na
    // nuvem primeiro. Sem isso, um aparelho que ficou um tempo sem abrir o
    // app podia empurrar de volta uma cópia ANTIGA de um registro que outro
    // aparelho já tinha atualizado na nuvem nesse meio tempo — já que o push
    // sempre manda o estado local inteiro, não só o que mudou agora. Puxando
    // primeiro, o que é enviado já é a versão mais atual conhecida (local +
    // nuvem mesclados), nunca uma versão desatualizada por cima de uma mais
    // nova.
    await puxarEMesclar()
    const s = useStore.getState()
    await pushAll({
      escolas: s.escolas, turmas: s.turmas, atletas: s.atletas, adversarios: s.adversarios,
      campeonatos: s.campeonatos, partidas: s.partidas, jogosAgendados: s.jogosAgendados, avaliacoes: s.avaliacoes,
      sessoesTreino: s.sessoesTreino, bibliotecaExercicios: s.bibliotecaExercicios,
    })
    useSyncStatus.getState().setStatus('sincronizado')
  } catch (err) {
    console.warn('[sync] falha ao empurrar pra nuvem', err)
    // Offline ou erro de rede: não é um problema permanente — o próximo ciclo
    // (nova mudança local, ou o polling de 25s) tenta de novo sozinho. Marca
    // "offline" quando o navegador já sabe que não tem internet (mais claro
    // pro usuário do que um "erro" genérico), senão "erro".
    useSyncStatus.getState().setStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'erro')
  } finally {
    sincronizando = false
  }
}

function agendarPush() {
  useSyncStatus.getState().setStatus('pendente')
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void executarPush()
  }, 3000)
}

function pararSync() {
  if (unsubscribeStore) { unsubscribeStore(); unsubscribeStore = null }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  useSyncStatus.getState().setStatus('desligado')
}

async function iniciarSync() {
  await puxarEMesclar()
  useSyncStatus.getState().setStatus('sincronizado')
  unsubscribeStore = useStore.subscribe(() => { if (!aplicandoDaNuvem) agendarPush() })
  pollTimer = setInterval(puxarEMesclar, 25000)

  // Dispara o envio de verdade (não só cancela o timer) quando o app vai pra
  // segundo plano ou a aba fecha — assim a última marcação do scout não fica
  // esperando a próxima mudança pra sair do aparelho.
  const flush = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
      void executarPush()
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush() })
  window.addEventListener('pagehide', flush)
  window.addEventListener('online', () => { void executarPush() })
  window.addEventListener('offline', () => { useSyncStatus.getState().setStatus('offline') })
}

export function initSyncManager() {
  useAuthStore.getState().init()
  useAuthStore.subscribe((state) => {
    const logado = !!state.user
    if (logado && !logadoAtual) {
      logadoAtual = true
      iniciarSync()
    } else if (!logado && logadoAtual) {
      logadoAtual = false
      pararSync()
    }
  })
  // Caso já exista sessão restaurada antes do primeiro subscribe disparar:
  setTimeout(() => {
    if (useAuthStore.getState().user && !logadoAtual) {
      logadoAtual = true
      iniciarSync()
    }
  }, 300)
}
