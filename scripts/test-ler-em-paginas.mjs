// Leitura da nuvem em páginas (11/11/2026): o Supabase devolve no máximo 1000
// linhas por consulta, e os lances de scout já passavam de 1500 — jogos
// chegavam incompletos no aparelho. Simula esse limite e confere que tudo
// chega, sem repetir nem pular nada.
import assert from 'node:assert'
import { lerEmPaginas } from '../src/syncTreinos.ts'

let ok = 0
function check(desc, cond) {
  assert.ok(cond, desc)
  ok++
  console.log('ok -', desc)
}

// "Banco" com limite de 1000 linhas por resposta, igual ao Supabase.
function bancoFalso(total, { limite = 1000, erroNaPagina } = {}) {
  const linhas = Array.from({ length: total }, (_, i) => ({ id: String(i).padStart(6, '0') }))
  const chamadas = []
  const buscar = async (de, ate) => {
    chamadas.push([de, ate])
    if (erroNaPagina !== undefined && chamadas.length - 1 === erroNaPagina) return { data: null, error: { message: 'falha de rede' } }
    return { data: linhas.slice(de, Math.min(ate + 1, de + limite)), error: null }
  }
  return { buscar, chamadas }
}

{
  const { buscar } = bancoFalso(1504)
  const semPaginas = (await buscar(0, 1e9)).data
  check('Sem páginas (como era antes): de 1504 lances só chegavam 1000', semPaginas.length === 1000)
}
{
  const { buscar, chamadas } = bancoFalso(1504)
  const tudo = await lerEmPaginas(buscar)
  check('Com páginas: chegam os 1504 lances', tudo.length === 1504)
  check('Nenhum lance repetido', new Set(tudo.map((l) => l.id)).size === 1504)
  check('Duas consultas (0–999 e 1000–1999)', chamadas.length === 2 && chamadas[1][0] === 1000)
}
{
  const { buscar, chamadas } = bancoFalso(2000)
  const tudo = await lerEmPaginas(buscar)
  check('Exatamente 2000: lê tudo e confirma que acabou com uma página vazia', tudo.length === 2000 && chamadas.length === 3)
}
{
  const { buscar, chamadas } = bancoFalso(5)
  const tudo = await lerEmPaginas(buscar)
  check('Tabela pequena: uma consulta só', tudo.length === 5 && chamadas.length === 1)
}
{
  const { buscar } = bancoFalso(0)
  check('Tabela vazia: lista vazia', (await lerEmPaginas(buscar)).length === 0)
}
{
  const { buscar } = bancoFalso(1504, { erroNaPagina: 1 })
  let falhou = false
  try { await lerEmPaginas(buscar) } catch { falhou = true }
  check('Erro numa página: a leitura inteira falha (nunca entrega jogo pela metade)', falhou)
}

console.log(`\n${ok} verificações passaram.`)
