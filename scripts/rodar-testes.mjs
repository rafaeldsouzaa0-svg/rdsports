// Roda todos os testes em scripts/test-*.mjs, um de cada vez, e para com erro
// se algum falhar. Usado por `npm test` e pelo workflow de publicação: se um
// teste quebrar (ex.: contagem de pontos), o site NÃO é publicado.
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pasta = dirname(fileURLToPath(import.meta.url))
const testes = readdirSync(pasta).filter((f) => /^test-.*\.mjs$/.test(f)).sort()

const falharam = []
for (const arquivo of testes) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', join(pasta, arquivo)], {
    encoding: 'utf8',
  })
  if (r.status === 0) {
    console.log(`✓ ${arquivo}`)
  } else {
    falharam.push(arquivo)
    console.log(`✗ ${arquivo}`)
    console.log((r.stdout + r.stderr).split('\n').filter((l) => /FALHOU|Error|erro/i.test(l)).slice(0, 10).join('\n'))
  }
}

console.log(`\n${testes.length - falharam.length}/${testes.length} testes passaram.`)
if (falharam.length > 0) process.exit(1)
