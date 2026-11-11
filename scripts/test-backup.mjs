// Sanity check do backup completo (pedido 30/10/2026): o arquivo .json
// exportado tem que voltar exatamente como veio ao ser lido de novo, e um
// arquivo que não é um backup do RDSports tem que ser rejeitado com uma
// mensagem clara (em vez de travar ou apagar os dados do usuário à toa).
import { montarArquivoBackup, lerArquivoBackup, resumoBackup } from '../src/backup.ts'

let falhas = 0
function assert(cond, msg) {
  if (!cond) { console.error('FALHOU:', msg); falhas++ }
  else console.log('OK:', msg)
}

const dados = {
  escolas: [{ id: 'e1', nome: 'Escola X', createdAt: '2026-01-01T00:00:00.000Z' }],
  turmas: [{ id: 't1', escolaId: 'e1', nome: 'Sub-15' }],
  equipes: [],
  categorias: [],
  atletas: [{ id: 'a1', turmaId: 't1', nome: 'Ana' }],
  adversarios: [],
  campeonatos: [],
  partidas: [{ id: 'p1', turmaId: 't1', tipo: 'JOGO', status: 'FINALIZADA', setsPartida: [] }],
  horariosTreino: [],
  jogosAgendados: [],
  presencas: [],
  avaliacoes: [],
  sessoesTreino: [{ id: 's1', turmaId: 't1', data: '2026-10-30', temas: [], condicionantes: [], quadros: [], registroPedagogico: {}, createdAt: '', updatedAt: '' }],
}

const arquivo = montarArquivoBackup(dados)
assert(arquivo.app === 'rdsports', 'Arquivo montado marca o app como "rdsports"')

const texto = JSON.stringify(arquivo)
const lido = lerArquivoBackup(texto)
assert(lido.dados.escolas.length === 1 && lido.dados.escolas[0].id === 'e1', 'Escola volta certinha depois de ler o arquivo')
assert(lido.dados.atletas[0].nome === 'Ana', 'Atleta volta certinha depois de ler o arquivo')
assert(lido.dados.sessoesTreino.length === 1, 'Sessão de treino volta certinha depois de ler o arquivo')

const resumo = resumoBackup(dados)
assert(resumo.find((r) => r.label === 'atletas').total === 1, 'Resumo do backup conta 1 atleta')
assert(resumo.find((r) => r.label === 'sessões de treino').total === 1, 'Resumo do backup conta 1 sessão de treino')

let rejeitouLixo = false
try { lerArquivoBackup('{"foo":"bar"}') } catch { rejeitouLixo = true }
assert(rejeitouLixo, 'Um JSON que não é backup do RDSports é rejeitado')

let rejeitouInvalido = false
try { lerArquivoBackup('isso não é json') } catch { rejeitouInvalido = true }
assert(rejeitouInvalido, 'Um arquivo que não é JSON válido é rejeitado')

// backup de uma chave faltando (versão mais nova/antiga do app) não deve
// quebrar — só entra como lista vazia nessa chave
const parcial = JSON.stringify({ app: 'rdsports', versao: 1, exportadoEm: '2026-01-01T00:00:00.000Z', dados: { escolas: [{ id: 'e1' }] } })
const lidoParcial = lerArquivoBackup(parcial)
assert(Array.isArray(lidoParcial.dados.atletas) && lidoParcial.dados.atletas.length === 0, 'Chave faltando no backup vira lista vazia em vez de quebrar')

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
