// Adaptador de storage do Zustand `persist` sobre IndexedDB (via idb-keyval),
// no mesmo nome de banco/loja usados pelas versões anteriores do app —
// "rdsports-storage" — pra continuar lendo os dados já salvos nos aparelhos.
import { get, set, del, createStore } from 'idb-keyval'
import type { StateStorage } from 'zustand/middleware'

const customStore = createStore('rdsports-storage', 'keyval')

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name, customStore)) ?? null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value, customStore)
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name, customStore)
  },
}
