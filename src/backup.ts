// Backup completo do app (pedido 30/10/2026): baixar um arquivo .json com
// TUDO que tá guardado no aparelho (escolas, turmas, atletas, partidas,
// scout, sessões de treino, presenças, avaliações, campeonatos...) e poder
// restaurar esse arquivo depois — útil antes de trocar de celular, limpar o
// navegador, ou só por segurança. Isso é separado da sincronização com a
// nuvem: funciona mesmo sem conta/internet, é um arquivo que fica com o
// próprio Henrique.
import type {
  Escola, Turma, Equipe, Categoria, Atleta, Adversario, Campeonato,
  Partida, HorarioTreino, JogoAgendado, RegistroPresenca, AvaliacaoPeriodica,
  SessaoTreino, ExercicioBiblioteca,
} from './types'

export interface BackupDados {
  escolas: Escola[]
  turmas: Turma[]
  equipes: Equipe[]
  categorias: Categoria[]
  atletas: Atleta[]
  adversarios: Adversario[]
  campeonatos: Campeonato[]
  partidas: Partida[]
  horariosTreino: HorarioTreino[]
  jogosAgendados: JogoAgendado[]
  presencas: RegistroPresenca[]
  avaliacoes: AvaliacaoPeriodica[]
  sessoesTreino: SessaoTreino[]
  bibliotecaExercicios?: ExercicioBiblioteca[]
}

export interface ArquivoBackup {
  app: 'rdsports'
  versao: 1
  exportadoEm: string
  dados: BackupDados
}

const CHAVES_BACKUP: (keyof BackupDados)[] = [
  'escolas', 'turmas', 'equipes', 'categorias', 'atletas', 'adversarios',
  'campeonatos', 'partidas', 'horariosTreino', 'jogosAgendados', 'presencas',
  'avaliacoes', 'sessoesTreino', 'bibliotecaExercicios',
]

export function montarArquivoBackup(dados: BackupDados): ArquivoBackup {
  return { app: 'rdsports', versao: 1, exportadoEm: new Date().toISOString(), dados }
}

/** Baixa o backup como um arquivo .json de verdade, pro Henrique guardar
 *  onde quiser (Drive, e-mail pra ele mesmo, pendrive etc.). */
export function baixarBackup(arquivo: ArquivoBackup): void {
  const nomeArquivo = `rdsports-backup-${arquivo.exportadoEm.slice(0, 10)}.json`
  const blob = new Blob([JSON.stringify(arquivo, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Conta rápida pra mostrar pro usuário o que tem dentro do backup (tela de
 *  confirmação antes de baixar ou de restaurar). */
export function resumoBackup(dados: BackupDados): { label: string; total: number }[] {
  return [
    { label: 'escolas', total: dados.escolas?.length ?? 0 },
    { label: 'turmas', total: dados.turmas?.length ?? 0 },
    { label: 'atletas', total: dados.atletas?.length ?? 0 },
    { label: 'partidas', total: dados.partidas?.length ?? 0 },
    { label: 'sessões de treino', total: dados.sessoesTreino?.length ?? 0 },
    { label: 'exercícios na biblioteca', total: dados.bibliotecaExercicios?.length ?? 0 },
  ]
}

/** Lê e valida um arquivo .json escolhido pelo usuário. Checagem é só
 *  estrutural (formato esperado, cada chave sendo uma lista) — não tenta
 *  validar o conteúdo de cada item, pra não travar a restauração por causa
 *  de um backup de uma versão um pouco diferente do app. */
export function lerArquivoBackup(texto: string): ArquivoBackup {
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    throw new Error('Esse arquivo não é um JSON válido.')
  }
  if (!json || typeof json !== 'object') throw new Error('Arquivo de backup inválido.')
  const obj = json as Record<string, unknown>
  if (obj.app !== 'rdsports' || !obj.dados || typeof obj.dados !== 'object') {
    throw new Error('Esse arquivo não parece ser um backup do RDSports.')
  }
  const dadosBrutos = obj.dados as Record<string, unknown>
  const dados = {} as BackupDados
  for (const chave of CHAVES_BACKUP) {
    const valor = dadosBrutos[chave]
    dados[chave] = (Array.isArray(valor) ? valor : []) as never
  }
  return { app: 'rdsports', versao: 1, exportadoEm: typeof obj.exportadoEm === 'string' ? obj.exportadoEm : new Date().toISOString(), dados }
}
