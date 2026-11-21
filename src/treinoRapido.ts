// Registro rápido de treino (pedido 21/11/2026: "quando eu não conseguir
// montar o treino, gostaria de só selecionar o que teve no treino"). Em vez
// de preencher a ficha inteira, o treinador marca os temas trabalhados e os
// exercícios da biblioteca que usou; isso vira uma sessão de treino normal
// (aparece em Treinos, no Calendário e alimenta a sugestão de foco).
// Funções puras, testadas em scripts/test-treino-rapido.mjs.
import { QUADRO_SLOTS, type ExercicioBiblioteca, type QuadroTreino } from './types'

/** Coloca os exercícios escolhidos nos 11 quadros da ficha: cada um no
 *  primeiro quadro livre da parte do treino dele (ex.: Aquec. Técnico); se
 *  não tiver parte marcada ou a parte estiver cheia, no primeiro quadro livre.
 *  Mais de 11 exercícios: os que sobram ficam de fora. */
export function quadrosComExercicios(exercicios: ExercicioBiblioteca[]): QuadroTreino[] {
  const quadros: QuadroTreino[] = QUADRO_SLOTS.map((q) => ({ chave: q.chave }))
  const ocupado = new Set<string>()
  for (const ex of exercicios) {
    const livreDaParte = ex.grupo ? QUADRO_SLOTS.find((q) => q.grupo === ex.grupo && !ocupado.has(q.chave)) : undefined
    const slot = livreDaParte ?? QUADRO_SLOTS.find((q) => !ocupado.has(q.chave))
    if (!slot) break
    ocupado.add(slot.chave)
    const i = quadros.findIndex((q) => q.chave === slot.chave)
    quadros[i] = { chave: slot.chave, nome: ex.nome, objetivo: ex.objetivo, tempoMin: ex.tempoMin, comoFunciona: ex.comoFunciona, desenho: ex.desenho }
  }
  return quadros
}

/** Temas da sessão: os marcados pelo treinador (na ordem — o 1º é o
 *  principal) e, depois, os temas dos exercícios usados que ainda não estão. */
export function temasDoRegistro(temasMarcados: string[], exercicios: ExercicioBiblioteca[]): string[] {
  const temas = [...temasMarcados]
  for (const ex of exercicios) for (const t of ex.temas) if (!temas.includes(t)) temas.push(t)
  return temas
}
