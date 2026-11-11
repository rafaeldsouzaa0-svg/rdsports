import type { Adversario, HorarioTreino, Partida, Rally } from './types'

/** Sempre usar isso pra formatar/comparar datas "YYYY-MM-DD" com "hoje" — nunca
 *  `new Date(str)` puro, que o JS interpreta em UTC e causa o bug de fuso horário
 *  (Brasil é UTC-3) já corrigido antes: um jogo "de hoje" desaparecia dos filtros. */
export function parseDataLocal(d: string): Date {
  return new Date(`${d}T00:00:00`)
}

export function isoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDate(d: string): string {
  const dt = parseDataLocal(d)
  return dt.toLocaleDateString('pt-BR')
}

export function gerarOcorrenciasTreino(horarios: HorarioTreino[], diasAFrente = 45) {
  const ocorrencias: { horarioId: string; turmaId: string; data: string; horario: string; local?: string }[] = []
  const hoje = new Date(new Date().toDateString())
  for (let i = 0; i < diasAFrente; i++) {
    const dia = new Date(hoje); dia.setDate(dia.getDate() + i)
    const diaSemana = dia.getDay()
    for (const h of horarios) {
      if (h.deletedAt) continue
      if (h.diaSemana === diaSemana) {
        ocorrencias.push({ horarioId: h.id, turmaId: h.turmaId, data: isoDia(dia), horario: h.horario, local: h.local })
      }
    }
  }
  return ocorrencias
}

export function uid(): string {
  return crypto.randomUUID()
}

export function nowISO(): string {
  return new Date().toISOString()
}

/** Conta pontos de um lado a partir dos rallies de um set — só o rally que
 *  efetivamente fecha o ponto (encerraRally) conta; fundamentos como Recepção e
 *  Levantamento nunca fecham rally sozinhos, então nunca aparecem aqui. */
export function totalPontos(rallies: Rally[], lado: 'CASA' | 'ADVERSARIO'): number {
  return rallies.filter((r) => (lado === 'CASA' ? r.pontoCasa : !r.pontoCasa)).length
}

export function aproveitamento(partidas: Partida[]): number {
  const finalizadas = partidas.filter((p) => p.tipo === 'JOGO' && p.status === 'FINALIZADA' && !p.deletedAt)
  if (finalizadas.length === 0) return 0
  const vitorias = finalizadas.filter((p) => p.setsGanhosCasa > p.setsGanhosAdversario).length
  return Math.round((vitorias / finalizadas.length) * 100)
}

/** Mesmo critério usado em `confrontoDireto` (scoutEngine.ts, Ciclo 9): nome
 *  sem espaços nas pontas e sem diferenciar maiúscula/minúscula — nunca por
 *  id, porque partidas criadas pelo "Novo Scout" da turma nunca recebem
 *  `adversarioId` (só pelo fluxo de jogo agendado do Calendário). */
export function normalizarNomeAdversario(nome: string): string {
  return nome.trim().toLowerCase()
}

/** Acha o logo cadastrado pra um adversário a partir só do nome (mesmo motivo
 *  acima — nunca id). Usado nas telas que mostram "vs Fulano" sem terem
 *  necessariamente o `adversarioId` da partida/jogo em mãos. */
export function encontrarLogoAdversario(adversarios: Adversario[], nome: string | undefined): string | undefined {
  if (!nome) return undefined
  const alvo = normalizarNomeAdversario(nome)
  return adversarios.find((a) => normalizarNomeAdversario(a.nome) === alvo)?.logoUrl
}
