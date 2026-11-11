// Teste da correção do bug de sincronização entre aparelhos (pedido
// 30/10/2026: "no meu celular não atualizou as coisas que tem no tablet").
// Antes, `mesclarPorId` SEMPRE mantinha a versão local quando o id já
// existia, mesmo que a nuvem tivesse uma edição mais nova de outro aparelho
// — essas verificações garantem que isso não volta a acontecer.
import assert from 'node:assert'
import { mesclarPorId, maisRecente } from '../src/store.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

// --- maisRecente ---
check('maisRecente: datas iguais -> empate', maisRecente('2026-10-30T10:00:00Z', '2026-10-30T10:00:00Z') === 'empate')
check('maisRecente: A depois de B -> a', maisRecente('2026-10-30T11:00:00Z', '2026-10-30T10:00:00Z') === 'a')
check('maisRecente: B depois de A -> b', maisRecente('2026-10-30T10:00:00Z', '2026-10-30T11:00:00Z') === 'b')
check('maisRecente: sem nenhuma data dos dois lados -> empate (mantém local por segurança)', maisRecente(undefined, undefined) === 'empate')
check('maisRecente: só a nuvem tem data -> b (nuvem vence, local nunca teve essa info)', maisRecente(undefined, '2026-10-30T10:00:00Z') === 'b')
check('maisRecente: só o local tem data -> a', maisRecente('2026-10-30T10:00:00Z', undefined) === 'a')

// --- mesclarPorId: o bug relatado pelo Henrique ---
{
  // Cenário real: Henrique edita o nome de uma atleta no TABLET (updatedAt
  // mais novo na nuvem, depois de sincronizar). O CELULAR, que tinha uma
  // cópia mais velha (updatedAt mais antigo) do mesmo id, puxa da nuvem.
  const local = [{ id: 'a1', nome: 'Ana (antigo)', updatedAt: '2026-10-30T09:00:00Z' }]
  const daNuvem = [{ id: 'a1', nome: 'Ana (editado no tablet)', updatedAt: '2026-10-30T10:00:00Z' }]
  const resultado = mesclarPorId(local, daNuvem)
  check(
    'BUG CORRIGIDO: edição mais nova da nuvem substitui a versão local desatualizada',
    resultado.length === 1 && resultado[0].nome === 'Ana (editado no tablet)'
  )
}

// --- Local mais novo que a nuvem: o local continua vencendo (nunca perde dado mais novo) ---
{
  const local = [{ id: 'a1', nome: 'Ana (editado agora aqui)', updatedAt: '2026-10-30T12:00:00Z' }]
  const daNuvem = [{ id: 'a1', nome: 'Ana (versão velha na nuvem)', updatedAt: '2026-10-30T09:00:00Z' }]
  const resultado = mesclarPorId(local, daNuvem)
  check(
    'Local mais novo que a nuvem continua vencendo (não sobrescreve dado mais novo com um mais velho)',
    resultado[0].nome === 'Ana (editado agora aqui)'
  )
}

// --- Registro só na nuvem (criado em outro aparelho) entra normalmente ---
{
  const local = [{ id: 'a1', nome: 'Ana', updatedAt: '2026-10-30T09:00:00Z' }]
  const daNuvem = [
    { id: 'a1', nome: 'Ana', updatedAt: '2026-10-30T09:00:00Z' },
    { id: 'a2', nome: 'Beatriz (criada no tablet)', updatedAt: '2026-10-30T09:05:00Z' },
  ]
  const resultado = mesclarPorId(local, daNuvem)
  check('Registro novo (id que só existe na nuvem) entra na lista local', resultado.some((a) => a.id === 'a2' && a.nome === 'Beatriz (criada no tablet)'))
  check('Registro que já existia e é idêntico não é duplicado', resultado.filter((a) => a.id === 'a1').length === 1)
}

// --- Registro só local (ainda não sincronizado) nunca é removido ---
{
  const local = [{ id: 'a1', nome: 'Ana' }, { id: 'a2', nome: 'Beatriz (só local, ainda não sincronizou)' }]
  const daNuvem = [{ id: 'a1', nome: 'Ana' }]
  const resultado = mesclarPorId(local, daNuvem)
  check('Registro que só existe local (ainda não chegou na nuvem) nunca é apagado pela mesclagem', resultado.some((a) => a.id === 'a2'))
  check('Total de registros depois de mesclar está correto (2)', resultado.length === 2)
}

// --- Sem updatedAt nos dois lados (registros de antes dessa correção existir), cai pro createdAt ---
{
  const local = [{ id: 'a1', nome: 'Ana (local)', createdAt: '2026-10-29T10:00:00Z' }]
  const daNuvem = [{ id: 'a1', nome: 'Ana (nuvem, criada depois)', createdAt: '2026-10-30T10:00:00Z' }]
  const resultado = mesclarPorId(local, daNuvem)
  check('Sem updatedAt, usa createdAt como critério de desempate', resultado[0].nome === 'Ana (nuvem, criada depois)')
}

// --- Nada muda -> devolve a MESMA referência do array local (evita disparar sincronização à toa) ---
{
  const local = [{ id: 'a1', nome: 'Ana', updatedAt: '2026-10-30T10:00:00Z' }]
  const daNuvem = [{ id: 'a1', nome: 'Ana', updatedAt: '2026-10-30T10:00:00Z' }]
  const resultado = mesclarPorId(local, daNuvem)
  check('Sem nenhuma mudança real, mesclarPorId devolve a MESMA referência (não cria array novo à toa)', resultado === local)
}

console.log(`\n${ok}/${ok} testes passaram.`)
