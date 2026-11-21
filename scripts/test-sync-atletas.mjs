// Teste da correção 21/11/2026: atleta sem posição (ex.: valor antigo "6x0",
// que vira undefined) NUNCA pode ir pra nuvem com `posicao` nula — a coluna
// é NOT NULL e um único null fazia o banco recusar o lote inteiro de atletas.
import { linhaAtletaNuvem, POSICAO_VAZIA_NUVEM } from '../src/atletaSync.ts'
import { normalizarPosicao } from '../src/types.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const base = { id: 'a1', nome: 'Ana', turmaId: 't1', createdAt: '2026-01-01T00:00:00Z' }
const owner = 'dono'

const sem = linhaAtletaNuvem({ ...base, posicaoPrincipal: normalizarPosicao('6x0') }, owner)
assert(sem.posicao != null, 'atleta com posição antiga "6x0" não vai com posicao nula')
assert(sem.posicao === POSICAO_VAZIA_NUVEM, 'atleta sem posição vai como SEM_POSICAO')
assert(normalizarPosicao(sem.posicao) === undefined, 'SEM_POSICAO volta da nuvem como "sem posição"')

const semNada = linhaAtletaNuvem({ ...base }, owner)
assert(semNada.posicao === POSICAO_VAZIA_NUVEM, 'atleta sem campo de posição também vai como SEM_POSICAO')
assert(semNada.status === 'ativa', 'status padrão vai como "ativa" (minúsculo, aceito pelo banco)')

const com = linhaAtletaNuvem({ ...base, posicaoPrincipal: 'CENTRAL', posicaoSecundaria: 'OPOSTO', numero: '7' }, owner)
assert(com.posicao === 'CENTRAL', 'posição preenchida vai igual')
assert(normalizarPosicao(com.posicao) === 'CENTRAL', 'posição preenchida volta igual da nuvem')
assert(com.numero === 7 && com.owner_id === owner, 'número e dono vão certos')

const lote = [sem, semNada, com]
assert(lote.every((l) => l.posicao != null && l.nome != null && l.status != null), 'nenhuma linha do lote tem campo obrigatório nulo')

if (falhas) { console.error(`${falhas} falha(s)`); process.exit(1) }
