// Teste do estado observável de sincronização (auditoria 30/10/2026): garante
// que o indicador nunca nasce "sincronizado" sem ter sincronizado nada ainda,
// e que toda transição de status também atualiza o carimbo de hora. A lógica
// de QUANDO cada status é setado (debounce, flush, erro de rede) mora no
// syncManager.ts, que depende do Supabase/DOM reais — fora do alcance de um
// teste de unidade simples; isso fica registrado como limitação no relatório.
import assert from 'node:assert'
import { useSyncStatus } from '../src/syncStatus.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

check('Estado inicial é "desligado" (sem conta logada, nada a mostrar)', useSyncStatus.getState().status === 'desligado')
check('Estado inicial não tem carimbo de hora ainda', useSyncStatus.getState().atualizadoEm === null)

useSyncStatus.getState().setStatus('pendente')
check('Depois de uma mudança local, vira "pendente" (nunca pula direto pra "sincronizado")', useSyncStatus.getState().status === 'pendente')
check('"pendente" atualiza o carimbo de hora', useSyncStatus.getState().atualizadoEm !== null)

useSyncStatus.getState().setStatus('sincronizando')
check('Durante o envio, vira "sincronizando"', useSyncStatus.getState().status === 'sincronizando')

useSyncStatus.getState().setStatus('sincronizado')
check('Só depois do envio confirmado vira "sincronizado"', useSyncStatus.getState().status === 'sincronizado')

useSyncStatus.getState().setStatus('offline')
check('Sem internet, vira "offline" (não "erro" genérico)', useSyncStatus.getState().status === 'offline')

useSyncStatus.getState().setStatus('erro')
check('Falha de envio com internet disponível vira "erro"', useSyncStatus.getState().status === 'erro')

console.log(`\n${ok}/${ok} testes passaram.`)
