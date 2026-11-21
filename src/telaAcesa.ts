// Tela sempre acesa durante o scout ao vivo (pedido 21/11/2026): o celular
// apagava a tela no meio do set e o professor perdia lances desbloqueando.
// Usa o "Wake Lock" do navegador — só vale enquanto a tela do scout está
// aberta e o app está na frente. O celular solta a trava sozinho quando o
// app vai pro segundo plano, então ela é pedida de novo ao voltar.
// Aparelho sem suporte (navegador antigo): segue funcionando como antes.
import { useEffect } from 'react'

interface TravaTela { release: () => Promise<void> }
interface NavegadorComTrava { wakeLock?: { request: (tipo: 'screen') => Promise<TravaTela> } }

export function useTelaAcesa(ativo: boolean) {
  useEffect(() => {
    if (!ativo || typeof navigator === 'undefined') return
    const wakeLock = (navigator as unknown as NavegadorComTrava).wakeLock
    if (!wakeLock) return

    let trava: TravaTela | null = null
    let desligado = false

    async function pedir() {
      if (desligado || document.visibilityState !== 'visible') return
      try {
        const nova = await wakeLock!.request('screen')
        if (desligado) { void nova.release().catch(() => {}); return }
        trava = nova
      } catch { /* ex.: bateria fraca — o celular recusa, segue sem a trava */ }
    }

    function aoVoltar() { if (document.visibilityState === 'visible') void pedir() }

    void pedir()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      desligado = true
      document.removeEventListener('visibilitychange', aoVoltar)
      if (trava) void trava.release().catch(() => {})
      trava = null
    }
  }, [ativo])
}
