// Sincronização dos Treinos e da Biblioteca entre aparelhos (pedido do
// Rafael 11/11/2026: treino montado no celular não aparecia no tablet).
// Simula a nuvem (com a mesma regra do banco: `updated_at` só muda quando
// `dados` ou `deleted_at` mudam de verdade) e dois aparelhos fazendo o ciclo
// do app: puxar → mesclar → enviar.
import assert from 'node:assert'
import { paraLinha, daLinha, normalizarData } from '../src/syncTreinos.ts'
import { mesclarPorId } from '../src/store.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

// Relógio único (aparelhos e banco andam juntos, um "tique" por ação).
let tique = 0
const agora = () => new Date(Date.UTC(2026, 10, 11, 20, 0, 0) + 1000 * ++tique).toISOString()
// O banco devolve datas nesse formato (microssegundos e +00:00).
const formatoBanco = (iso) => iso.replace('Z', '').replace(/\.(\d{3})$/, '.$1123+00:00')

// --- Nuvem simulada ---
const OWNER = 'dono-1'
const nuvem = new Map()
function upsert(linha) {
  const antiga = nuvem.get(linha.id)
  const mudou = !antiga || JSON.stringify(antiga.dados) !== JSON.stringify(linha.dados) || antiga.deleted_at_valor !== linha.deleted_at
  nuvem.set(linha.id, {
    id: linha.id, dados: linha.dados, deleted_at_valor: linha.deleted_at,
    deleted_at: linha.deleted_at ? formatoBanco(new Date(linha.deleted_at).toISOString()) : null,
    updated_at: mudou ? formatoBanco(agora()) : antiga.updated_at,
  })
}

// --- Aparelho simulado ---
function aparelho(sessoes) {
  return { sessoes }
}
function sincronizar(ap) {
  // 1. puxa e mescla (igual executarPush → puxarEMesclar)
  const daNuvem = [...nuvem.values()].map((l) => daLinha(l))
  ap.sessoes = mesclarPorId(ap.sessoes, daNuvem)
  // 2. envia tudo
  for (const s of ap.sessoes) upsert(paraLinha(s, OWNER))
}
const visiveis = (ap) => ap.sessoes.filter((s) => !s.deletedAt).map((s) => s.turma).sort()
const novaSessao = (id, turma) => {
  const t = agora()
  return { id, turmaId: 't-' + id, turma, data: '2026-11-13', temas: [], condicionantes: [], quadros: [], registroPedagogico: {}, createdAt: t, updatedAt: t }
}
const editar = (ap, id, patch) => { ap.sessoes = ap.sessoes.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: agora() } : s)) }
const apagar = (ap, id) => { const t = agora(); ap.sessoes = ap.sessoes.map((s) => (s.id === id ? { ...s, deletedAt: t, updatedAt: t } : s)) }
const restaurar = (ap, id) => { ap.sessoes = ap.sessoes.map((s) => (s.id === id ? { ...s, deletedAt: undefined, updatedAt: agora() } : s)) }

// --- Formato das linhas ---
{
  const s = { ...novaSessao('x', 'Teste'), deletedAt: '2026-11-11T20:00:00.000Z' }
  const linha = paraLinha(s, OWNER)
  check('paraLinha: data de atualização e de exclusão NÃO vão dentro de "dados"', !('updatedAt' in linha.dados) && !('deletedAt' in linha.dados))
  check('paraLinha: exclusão vai na coluna deleted_at', linha.deleted_at === '2026-11-11T20:00:00.000Z')
  check('paraLinha: resto do treino vai inteiro em "dados"', linha.dados.turma === 'Teste' && linha.dados.createdAt === s.createdAt && linha.owner_id === OWNER)
  const volta = daLinha({ id: 'x', dados: linha.dados, updated_at: '2026-11-11T23:41:26.20496+00:00', deleted_at: null })
  check('daLinha: data do banco convertida pro formato do aparelho', volta.updatedAt === '2026-11-11T23:41:26.204Z')
  check('daLinha: sem deleted_at = treino não apagado', !('deletedAt' in volta))
  check('normalizarData: valor vazio ou inválido vira undefined', normalizarData(null) === undefined && normalizarData('xx') === undefined)
}

// --- O caso relatado: cada aparelho com os próprios treinos ---
const celular = aparelho([novaSessao('s10', 'Sub-10 masc')])
const tablet = aparelho([novaSessao('7a', '7º ano A'), novaSessao('6', '6º ano')])
sincronizar(celular)
sincronizar(tablet)
sincronizar(celular)
check('CASO DO RAFAEL: celular passa a ver os treinos do tablet', JSON.stringify(visiveis(celular)) === JSON.stringify(['6º ano', '7º ano A', 'Sub-10 masc']))
check('CASO DO RAFAEL: tablet passa a ver o treino do celular', JSON.stringify(visiveis(tablet)) === JSON.stringify(['6º ano', '7º ano A', 'Sub-10 masc']))
check('Nada duplicado na nuvem (3 treinos)', nuvem.size === 3)

// --- Reenvio sem mudança não muda a data na nuvem ---
{
  const antes = nuvem.get('s10').updated_at
  sincronizar(tablet); sincronizar(celular); sincronizar(tablet)
  check('Reenvios sem mudança não "renovam" o treino na nuvem', nuvem.get('s10').updated_at === antes)
}

// --- Edição num aparelho chega no outro ---
editar(tablet, '7a', { problemaJogo: 'Cobertura de ataque' })
sincronizar(tablet)
sincronizar(celular)
check('Edição feita no tablet aparece no celular', celular.sessoes.find((s) => s.id === '7a').problemaJogo === 'Cobertura de ataque')

// --- Edição ainda não enviada não é atropelada pelo reenvio do outro aparelho ---
editar(celular, 's10', { recadoSubstituto: 'Bolas no armário 3' })
sincronizar(tablet) // tablet reenvia a cópia antiga (sem mudança) antes do celular subir a edição
sincronizar(celular)
sincronizar(tablet)
check('Edição do celular sobrevive ao reenvio da cópia antiga do tablet', celular.sessoes.find((s) => s.id === 's10').recadoSubstituto === 'Bolas no armário 3')
check('...e chega no tablet', tablet.sessoes.find((s) => s.id === 's10').recadoSubstituto === 'Bolas no armário 3')

// --- Apagar num aparelho some do outro e não volta ---
apagar(celular, '6')
sincronizar(celular)
sincronizar(tablet)
check('Treino apagado no celular some do tablet', !visiveis(tablet).includes('6º ano'))
sincronizar(tablet); sincronizar(celular); sincronizar(tablet)
check('Treino apagado não volta sozinho depois de várias sincronizações', !visiveis(celular).includes('6º ano') && !visiveis(tablet).includes('6º ano'))
check('Treino apagado continua guardado (pode ser restaurado da Lixeira)', tablet.sessoes.some((s) => s.id === '6' && s.deletedAt))

// --- Restaurar da Lixeira também sincroniza ---
restaurar(tablet, '6')
sincronizar(tablet)
sincronizar(celular)
check('Treino restaurado no tablet volta a aparecer no celular', visiveis(celular).includes('6º ano'))

// --- Biblioteca usa as mesmas regras ---
{
  const ex = { id: 'e1', nome: 'Duplas com bola', temas: [], condicionantes: [], createdAt: agora(), updatedAt: agora() }
  const linha = paraLinha(ex, OWNER)
  const volta = daLinha({ ...linha, updated_at: formatoBanco(agora()) })
  check('Biblioteca: exercício vai e volta inteiro', volta.nome === 'Duplas com bola' && volta.id === 'e1' && Array.isArray(volta.temas))
}

console.log(`\n${ok} verificações passaram.`)
