// Tamanho da Zona no desenho do treino (pedido 26/11/2026: "na hora de montar
// o treino eu gostaria de mudar o tamanho da zona"). A zona é guardada pelo
// centro (x, y) e pelo tamanho (largura, altura), tudo em % da quadra. Aqui
// ficam as contas de puxar um canto com o dedo e dos botões − / +.
// Funções puras, testadas em scripts/test-zona-desenho.mjs.

export const ZONA_MINIMO = 5
export const ZONA_MAXIMO = 100
export const ZONA_PASSO = 5

/** Quadra inteira: 18 m de comprimento (eixo x) × 9 m de largura (eixo y). */
const METROS_X = 18
const METROS_Y = 9

export type CantoZona = 'no' | 'ne' | 'so' | 'se'

export interface Zona { x: number; y: number; largura: number; altura: number }

const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** Posição de cada canto, em % da quadra. */
export function cantosDaZona(z: Zona): Record<CantoZona, { x: number; y: number }> {
  const l = z.largura / 2, a = z.altura / 2
  return {
    no: { x: z.x - l, y: z.y - a },
    ne: { x: z.x + l, y: z.y - a },
    so: { x: z.x - l, y: z.y + a },
    se: { x: z.x + l, y: z.y + a },
  }
}

const OPOSTO: Record<CantoZona, CantoZona> = { no: 'se', ne: 'so', so: 'ne', se: 'no' }

/** Arrastar um canto até `p`: o canto oposto fica parado no lugar. Se o dedo
 *  passar do canto oposto, a zona não "vira do avesso" — para no mínimo. */
export function redimensionarPeloCanto(z: Zona, canto: CantoZona, p: { x: number; y: number }): Zona {
  const fixo = cantosDaZona(z)[OPOSTO[canto]]
  const paraDireita = canto === 'ne' || canto === 'se'
  const paraBaixo = canto === 'so' || canto === 'se'
  // Distância do canto fixo até o dedo, só no sentido do canto puxado.
  const largura = limitar(paraDireita ? p.x - fixo.x : fixo.x - p.x, ZONA_MINIMO, ZONA_MAXIMO)
  const altura = limitar(paraBaixo ? p.y - fixo.y : fixo.y - p.y, ZONA_MINIMO, ZONA_MAXIMO)
  return {
    largura: arred(largura),
    altura: arred(altura),
    x: arred(paraDireita ? fixo.x + largura / 2 : fixo.x - largura / 2),
    y: arred(paraBaixo ? fixo.y + altura / 2 : fixo.y - altura / 2),
  }
}

/** Botões − / +: muda um lado em `passos` × 5%, mantendo o centro. */
export function ajustarTamanho(z: Zona, lado: 'largura' | 'altura', passos: number): Zona {
  const atual = z[lado]
  // Começa num múltiplo de 5 pra os números ficarem redondos (ex.: 23 → 25 ou 20).
  const base = passos > 0 ? Math.floor(atual / ZONA_PASSO) * ZONA_PASSO : Math.ceil(atual / ZONA_PASSO) * ZONA_PASSO
  return { ...z, [lado]: limitar(base + passos * ZONA_PASSO, ZONA_MINIMO, ZONA_MAXIMO) }
}

/** Tamanho em metros, pra mostrar ao treinador (ex.: "3,6 m × 1,4 m"). */
export function tamanhoEmMetros(z: Pick<Zona, 'largura' | 'altura'>): string {
  const m = (v: number) => (Math.round(v * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${m((z.largura * METROS_X) / 100)} m × ${m((z.altura * METROS_Y) / 100)} m`
}

function arred(v: number) {
  return Math.round(v * 10) / 10
}
