// Cartão "Próximo jogo" do Início (pedido 11/11/2026): contagem regressiva e
// checklist do jogo agendado. Funções puras, testadas em
// scripts/test-proximo-jogo.mjs.
import type { JogoAgendado } from './types'

export type ItemChecklist = { item: string; feito: boolean }

/** Itens que aparecem num jogo que ainda não teve o checklist mexido. */
export const CHECKLIST_PADRAO: readonly string[] = [
  'Uniformes completos',
  'Bolas',
  'Documentos com foto das atletas',
  'Autorizações dos responsáveis',
  'Água e kit de primeiros socorros',
]

export function checklistDoJogo(jogo: Pick<JogoAgendado, 'checklist'>): ItemChecklist[] {
  return jogo.checklist ?? CHECKLIST_PADRAO.map((item) => ({ item, feito: false }))
}

export function alternarItem(lista: ItemChecklist[], indice: number): ItemChecklist[] {
  return lista.map((it, i) => (i === indice ? { ...it, feito: !it.feito } : it))
}

export function adicionarItem(lista: ItemChecklist[], texto: string): ItemChecklist[] {
  const t = texto.trim()
  if (!t || lista.some((it) => it.item.toLowerCase() === t.toLowerCase())) return lista
  return [...lista, { item: t, feito: false }]
}

export function removerItem(lista: ItemChecklist[], indice: number): ItemChecklist[] {
  return lista.filter((_, i) => i !== indice)
}

/** Primeiro jogo agendado de hoje em diante (hoje conta até o fim do dia). */
export function proximoJogo(jogos: JogoAgendado[], agora: Date): JogoAgendado | undefined {
  const hoje = isoLocal(agora)
  return jogos
    .filter((j) => !j.deletedAt && j.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.horario ?? '').localeCompare(b.horario ?? ''))[0]
}

export interface Contagem {
  /** Frase pronta pra mostrar ("Faltam 2 dias", "É hoje!", "Já começou"). */
  texto: string
  ehHoje: boolean
  /** Horário do jogo já chegou (só dá pra saber quando tem horário). */
  comecou: boolean
  /** Partes pros "blocos" do cartão; ausente quando não há horário. */
  partes?: { dias: number; horas: number; minutos: number }
}

function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function diasEntre(deISO: string, ateISO: string): number {
  const [a, b] = [deISO, ateISO].map((s) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  })
  return Math.round((b - a) / 86400000)
}

export function contagemRegressiva(data: string, horario: string | undefined, agora: Date): Contagem {
  const hojeISO = isoLocal(agora)
  const dias = diasEntre(hojeISO, data)
  const ehHoje = dias === 0
  const hm = horario ? /^(\d{1,2}):(\d{2})/.exec(horario) : null

  if (!hm) {
    if (dias < 0) return { texto: 'Já passou', ehHoje: false, comecou: true }
    if (ehHoje) return { texto: 'É hoje!', ehHoje, comecou: false }
    if (dias === 1) return { texto: 'É amanhã', ehHoje, comecou: false }
    return { texto: `Faltam ${dias} dias`, ehHoje, comecou: false }
  }

  const [y, m, d] = data.split('-').map(Number)
  const inicio = new Date(y, m - 1, d, Number(hm[1]), Number(hm[2]))
  const ms = inicio.getTime() - agora.getTime()
  if (ms <= 0) return { texto: ehHoje ? 'Já começou' : 'Já passou', ehHoje, comecou: true }

  const totalMin = Math.ceil(ms / 60000)
  const partes = { dias: Math.floor(totalMin / 1440), horas: Math.floor((totalMin % 1440) / 60), minutos: totalMin % 60 }
  let texto: string
  if (partes.dias >= 1) {
    texto = `Faltam ${partes.dias} ${partes.dias === 1 ? 'dia' : 'dias'}${partes.horas ? ` e ${partes.horas} h` : ''}`
  } else if (partes.horas >= 1) {
    texto = `Faltam ${partes.horas} h${partes.minutos ? ` ${partes.minutos} min` : ''}`
  } else {
    texto = `Faltam ${partes.minutos} min`
  }
  if (ehHoje) texto = `É hoje! ${texto}`
  return { texto, ehHoje, comecou: false, partes }
}
