// Modelo de dados do RDSports. Nomes de campo mantidos compatíveis com as versões
// anteriores do app (mesma estrutura já usada nos dados salvos no IndexedDB/nuvem
// dos aparelhos do Henrique), para que a reconstrução continue lendo os dados reais.

export type FundamentoScout =
  | 'saque' | 'recepcao' | 'ataque' | 'bloqueio' | 'levantamento' | 'defesa'
  // "Pontos específicos" (pedido 23/10/2026, ajustado): não são um fundamento
  // normal com Bom/Médio/Erro, só acontecem ou não. Bola de graça e bola de
  // 2ª/largada são jogadas que dão certo (ponto pra quem fez); não deslocou é
  // erro de posicionamento (ponto pro outro lado) — ver `encerraRallyDe` em
  // scoutEngine.ts. Entram nos mesmos relatórios (equipe, por atleta, erros
  // do adversário) que os fundamentos de sempre, através de FUNDAMENTOS_SCOUT.
  | 'bola_de_graca' | 'bola_de_segunda' | 'nao_deslocou'

export type ResultadoEvento = 'ACERTO' | 'BOM' | 'MEDIO' | 'ERRO' | 'EM_JOGO'

// Posição que a atleta joga (pedido 23/10/2026: cadastro completo da atleta) —
// as 5 posições do vôlei que o Henrique pediu, usadas tanto pro cadastro quanto
// pros pesos do rating por posição (ver src/rating.ts).
export type Posicao = 'LEVANTADORA' | 'CENTRAL' | 'PONTEIRO' | 'LIBERO' | 'OPOSTO'

export const POSICOES: { valor: Posicao; label: string }[] = [
  { valor: 'LEVANTADORA', label: 'Levantadora' },
  { valor: 'CENTRAL', label: 'Central' },
  { valor: 'PONTEIRO', label: 'Ponteiro' },
  { valor: 'LIBERO', label: 'Líbero' },
  { valor: 'OPOSTO', label: 'Oposto' },
]

export const LABEL_POSICAO: Record<Posicao, string> = {
  LEVANTADORA: 'Levantadora', CENTRAL: 'Central', PONTEIRO: 'Ponteiro', LIBERO: 'Líbero', OPOSTO: 'Oposto',
}

/** Converte um valor de posição antigo/estranho (ex.: "Ponteira", "Central",
 *  "6x0" — valores do enum anterior a 23/10/2026, ou dados recuperados do
 *  Supabase de antes dessa troca) pro enum atual de 5 valores, ou `undefined`
 *  se não houver equivalente (ex.: "6x0"/"SEIS_POR_ZERO", posição livre sem
 *  correspondente hoje). Usado tanto ao puxar da nuvem (`cloudSync.ts`)
 *  quanto defensivamente onde `posicaoPrincipal` é lido pra exibição/cálculo
 *  (`AtletaPerfil.tsx`, `rating.ts`, Portal da Atleta) — porque atletas com
 *  dados antigos já salvos localmente (de antes da normalização existir)
 *  continuam tendo a string velha até serem re-salvas, e sem essa segunda
 *  camada de defesa o app trava com tela preta (bug real de 23/10/2026: as
 *  169 atletas recuperadas do Supabase tinham só valores antigos). */
export function normalizarPosicao(valor: string | null | undefined): Posicao | undefined {
  if (!valor) return undefined
  const chave = valor.trim().toUpperCase()
  const mapa: Record<string, Posicao> = {
    LEVANTADORA: 'LEVANTADORA',
    CENTRAL: 'CENTRAL',
    CENTRAL1: 'CENTRAL',
    CENTRAL2: 'CENTRAL',
    PONTEIRO: 'PONTEIRO',
    PONTEIRA: 'PONTEIRO',
    PONTA1: 'PONTEIRO',
    PONTA2: 'PONTEIRO',
    LIBERO: 'LIBERO',
    'LÍBERO': 'LIBERO',
    OPOSTO: 'OPOSTO',
    OPOSTA: 'OPOSTO',
  }
  return mapa[chave]
}

export interface Escola {
  id: string
  nome: string
  /** Logo/escudo da escola (pedido 30/10/2026: "mexer no visual") — URL
   *  pública no bucket `logos` do Supabase Storage. */
  logoUrl?: string
  createdAt: string
  /** Marcada pelo próprio banco (Supabase), não pelo relógio do aparelho —
   *  pedido 30/10/2026, usada só pra decidir qual versão é mais nova ao
   *  mesclar dados de dois aparelhos (ver `mesclarPorId` em store.ts).
   *  Registro ainda não sincronizado não tem isso preenchido. */
  updatedAt?: string
  deletedAt?: string
}

export interface Turma {
  id: string
  escolaId: string
  nome: string
  createdAt: string
  updatedAt?: string
  deletedAt?: string
}

export interface Equipe {
  id: string
  turmaId: string
  nome: string
  createdAt: string
  deletedAt?: string
}

export interface Categoria {
  id: string
  equipeId: string
  nome: string
  createdAt: string
}

export interface Atleta {
  id: string
  turmaId: string
  categoriaId?: string
  nome: string
  numero?: string
  posicaoPrincipal?: Posicao
  /** Função secundária da atleta (pedido 30/10/2026) — pra quem joga mais de
   *  uma posição (ex.: ponteiro que também bloqueia de central em algumas
   *  rotações). Opcional: a maioria das atletas só tem a principal. Entra no
   *  cálculo do rating com peso menor que a principal (ver `rating.ts`). */
  posicaoSecundaria?: Posicao
  fotoUrl?: string
  status?: 'ATIVA' | 'AFASTADA' | 'TRANSFERIDA' | 'INATIVA'
  /** Cadastro completo da atleta (pedido 23/10/2026). */
  idade?: number
  alturaCm?: number
  /** Código de acesso pro Portal da Atleta (login simples, sem e-mail/conta de
   *  verdade — decisão explícita do Henrique) — undefined/vazio = portal
   *  desativado pra essa atleta. Nunca mostrar isto em lugar nenhum além da
   *  tela de perfil de quem já está logado como treinador. */
  codigoAcesso?: string
  createdAt: string
  updatedAt?: string
  deletedAt?: string
}

export interface Adversario {
  id: string
  nome: string
  /** Logo/escudo do adversário (pedido 30/10/2026) — URL pública no bucket
   *  `logos` do Supabase Storage. */
  logoUrl?: string
  createdAt: string
  updatedAt?: string
}

export interface Campeonato {
  id: string
  nome: string
  turmaId?: string
  createdAt: string
  updatedAt?: string
  deletedAt?: string
}

/** Formato de disputa da partida — item pedido pelo Henrique em 27/09/2026:
 *  cada campeonato tem uma quantidade diferente de sets, então isso precisa ser
 *  configurável por partida (ou por padrão do professor), não fixo no código. */
export type FormatoPartida = 'MELHOR_DE_3' | 'TRES_OBRIGATORIOS_25' | 'MELHOR_DE_5'

export const FORMATOS_PARTIDA: { valor: FormatoPartida; label: string; descricao: string }[] = [
  { valor: 'MELHOR_DE_5', label: 'Melhor de 5 sets', descricao: 'Formato padrão: joga até um dos times fazer 3 sets (o 5º set, se houver, decide)' },
  { valor: 'MELHOR_DE_3', label: 'Melhor de 3 sets', descricao: 'Joga até um dos times fazer 2 sets' },
  { valor: 'TRES_OBRIGATORIOS_25', label: '3 sets obrigatórios de 25', descricao: 'Sempre disputa os 3 sets, todos até 25 pontos, mesmo se um time já tiver vencido antes' },
]

export const CONFIG_FORMATO: Record<FormatoPartida, { setsParaVencer: number; totalSets: number; pontosDecisivo: number; obrigaTodosOsSets: boolean }> = {
  MELHOR_DE_5: { setsParaVencer: 3, totalSets: 5, pontosDecisivo: 15, obrigaTodosOsSets: false },
  MELHOR_DE_3: { setsParaVencer: 2, totalSets: 3, pontosDecisivo: 15, obrigaTodosOsSets: false },
  TRES_OBRIGATORIOS_25: { setsParaVencer: 2, totalSets: 3, pontosDecisivo: 25, obrigaTodosOsSets: true },
}

export interface RallyEvento {
  id: string
  atletaId?: string
  fundamento: FundamentoScout
  resultado: ResultadoEvento
  encerraRally: 'CASA' | 'ADVERSARIO' | null
  tipoErro?: string
  tipoPontoAtaqueAdversario?: string
  zona?: string
  timestamp: string
  /** Quem foi responsável pela ação registrada — ausente/omitido significa
   *  'CASA' (nosso time, o caso de sempre). 'ADVERSARIO' marca um erro do
   *  time adversário anotado pelo treinador (ex.: "saque fora"), pedido em
   *  22/10/2026 pra melhorar a análise do outro time — nesse caso `atletaId`
   *  nunca é preenchido (não é uma das nossas atletas) e `numeroAdversario`
   *  pode opcionalmente dizer qual jogadora do outro time errou. */
  ladoResponsavel?: 'CASA' | 'ADVERSARIO'
  numeroAdversario?: string
}

export interface Rally {
  id: string
  numero: number
  eventos: RallyEvento[]
  pontoCasa: boolean
  placarCasaApos: number
  placarAdversarioApos: number
}

/** Posições 1 a 6 do rodízio (regra oficial do vôlei), com o id da atleta que
 *  começa o set em cada uma — índice 0 = posição I (que saca primeiro quando
 *  é a vez do nosso time), até índice 5 = posição VI. Segue a numeração oficial
 *  da FIVB: I=saque/fundo-direita, II=frente-direita, III=frente-centro,
 *  IV=frente-esquerda, V=fundo-esquerda, VI=fundo-centro — é a mesma ordem
 *  usada na "ficha de posição" impressa que o Henrique usa em quadra. */
export type EscalacaoSet = string[]

/** Troca de atleta em quadra no meio do set (pedido 23/10/2026: reservas podem
 *  entrar no meio do set) — marca QUANDO aconteceu (quantos rallies já tinham
 *  fechado naquele momento) pra entrar no lugar certo do histórico do rodízio. */
export interface Substituicao {
  id: string
  aposRallyFechado: number
  posicaoIndex: number // 0 (posição I) a 5 (posição VI)
  atletaEntraId: string
  timestamp: string
}

/** Registro de uma correção feita num evento JÁ EXISTENTE do set (pedido
 *  30/10/2026 — "melhorar o desfazer": poder corrigir qualquer lançamento do
 *  passado, não só o último). Nunca é apagado nem sobrescrito — cada
 *  correção vira uma entrada nova em `SetPartida.correcoes`, formando um
 *  histórico auditável de "antes → depois" (nunca alteramos estatística
 *  histórica sem deixar rastro). `antes`/`depois` guardam só os campos que
 *  podem ser corrigidos. */
export interface CorrecaoEvento {
  id: string
  eventoId: string
  antes: { atletaId?: string; fundamento: FundamentoScout; resultado: ResultadoEvento; numeroAdversario?: string }
  depois: { atletaId?: string; fundamento: FundamentoScout; resultado: ResultadoEvento; numeroAdversario?: string }
  timestamp: string
}

export interface SetPartida {
  id: string
  numero: number
  placarCasa: number
  placarAdversario: number
  rallies: Rally[]
  finalizado: boolean
  vencedor?: 'CASA' | 'ADVERSARIO'
  /** Escalação titular do set (6 atletaIds, posições I→VI) e quem saca primeiro
   *  — preenchidos na "papeleta" antes do set começar (pedido 22/10/2026). Um
   *  set sem isso ainda está "aguardando escalação" na tela do Scout ao vivo. */
  escalacaoInicial?: EscalacaoSet
  primeiroSaque?: 'CASA' | 'ADVERSARIO'
  substituicoes?: Substituicao[]
  /** Histórico de correções feitas em eventos deste set (ver `CorrecaoEvento`
   *  e `corrigirEvento` em scoutEngine.ts). Ausente/vazio = nenhuma correção
   *  feita ainda. */
  correcoes?: CorrecaoEvento[]
}

export interface Partida {
  id: string
  tipo: 'JOGO' | 'TREINO'
  turmaId: string
  adversarioId?: string
  adversarioNome?: string
  campeonato?: string
  campeonatoId?: string
  formato: FormatoPartida
  data: string
  local?: string
  status: 'EM_ANDAMENTO' | 'FINALIZADA'
  setsPartida: SetPartida[]
  setsGanhosCasa: number
  setsGanhosAdversario: number
  /** Pontuação configurável por set — pedido 22/10/2026 (ex.: "21 pontos, mas
   *  pode passar se precisar", mantendo a regra de vencer por 2 de diferença
   *  que já existia). Ausente = usa os valores padrão do `formato`
   *  (CONFIG_FORMATO). Valores separados pro set normal e pro decisivo,
   *  porque cada campeonato costuma jogar os dois de um jeito diferente. */
  pontosSetNormal?: number
  pontosSetDecisivo?: number
  observacoes?: string
  videoUrl?: string
  marcacoesVideo?: { tempo: string; nota: string }[]
  createdAt: string
  updatedAt?: string
  deletedAt?: string
}

export interface HorarioTreino {
  id: string
  turmaId: string
  diaSemana: number // 0-6, domingo=0
  horario: string // "HH:MM"
  local?: string
  deletedAt?: string
}

export interface JogoAgendado {
  id: string
  turmaId: string
  adversarioId?: string
  adversarioNome: string
  campeonatoId?: string
  data: string
  horario?: string
  local?: string
  checklist?: { item: string; feito: boolean }[]
  createdAt: string
  updatedAt?: string
  deletedAt?: string
}

export interface RegistroPresenca {
  id: string
  turmaId: string
  atletaId: string
  data: string
  presente: boolean
}

export interface AvaliacaoPeriodica {
  id: string
  atletaId: string
  data: string
  periodo: 'MENSAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'PERSONALIZADA'
  notas: Record<string, number>
  observacoes?: string
  updatedAt?: string
}

export const CRITERIOS_AVALIACAO_PADRAO = [
  'Saque', 'Recepção', 'Levantamento', 'Ataque', 'Bloqueio', 'Defesa',
  'Tática', 'Tomada de decisão', 'Comunicação', 'Posicionamento',
]

// ---------------------------------------------------------------------------
// Editor de sessão de treino (pedido 29/10/2026) — reproduz a ficha de treino
// de vôlei que o Henrique mostrou em vídeo (app "H10 Academy"): formulário
// com temas/condicionantes + 11 "quadros" (um por parte do treino) + registro
// pedagógico, tudo exportável em PDF/HTML igual o resto do app. Fase 1: cada
// quadro guarda só nome/objetivo/tempo (o desenho animado de quadra fica pra
// uma 2ª entrega) — a quadra em branco sai no PDF pra desenhar à mão, igual
// o próprio H10 faz quando o quadro não foi preenchido.

/** Catálogo de temas do treino, igual à estrutura do H10: KI = Side-out
 *  (complexo I), KII = Transição (complexo II), JC = Jogo completo,
 *  OUT = Outros. O primeiro tema marcado pelo treinador vira o "principal". */
export const GRUPOS_TEMAS_TREINO: { id: 'KI' | 'KII' | 'JC' | 'OUT'; label: string }[] = [
  { id: 'KI', label: 'Side-out (complexo I)' },
  { id: 'KII', label: 'Transição (complexo II)' },
  { id: 'JC', label: 'Jogo completo' },
  { id: 'OUT', label: 'Outros' },
]

export const TEMAS_TREINO: { id: string; grupo: 'KI' | 'KII' | 'JC' | 'OUT'; label: string }[] = [
  { id: 'KI_manter_romper', grupo: 'KI', label: 'Manter × romper' },
  { id: 'KI_construir_neutralizar', grupo: 'KI', label: 'Construir × neutralizar' },
  { id: 'KI_ocupar_explorar', grupo: 'KI', label: 'Ocupar × explorar' },
  { id: 'KI_antecipar_reagir', grupo: 'KI', label: 'Antecipar × reagir' },
  { id: 'KI_recepcao', grupo: 'KI', label: 'Recepção' },
  { id: 'KI_levantamento', grupo: 'KI', label: 'Levantamento' },
  { id: 'KI_ataque', grupo: 'KI', label: 'Ataque' },
  { id: 'KII_manter_romper', grupo: 'KII', label: 'Manter × romper' },
  { id: 'KII_construir_neutralizar', grupo: 'KII', label: 'Construir × neutralizar' },
  { id: 'KII_ocupar_explorar', grupo: 'KII', label: 'Ocupar × explorar' },
  { id: 'KII_antecipar_reagir', grupo: 'KII', label: 'Antecipar × reagir' },
  { id: 'KII_saque', grupo: 'KII', label: 'Saque' },
  { id: 'KII_bloqueio', grupo: 'KII', label: 'Bloqueio' },
  { id: 'KII_defesa', grupo: 'KII', label: 'Defesa' },
  { id: 'KII_contra_ataque', grupo: 'KII', label: 'Contra-ataque no vôlei' },
  { id: 'JC_jogo_completo', grupo: 'JC', label: 'Jogo completo' },
  { id: 'OUT_superioridade', grupo: 'OUT', label: 'Superioridade numérica' },
  { id: 'OUT_inferioridade', grupo: 'OUT', label: 'Inferioridade numérica' },
]

/** Sugestões rápidas pro campo "Problema de jogo da sessão" — clicar preenche
 *  o texto, mas o campo continua livre (o treinador pode escrever outra coisa). */
export const PROBLEMAS_JOGO_SUGERIDOS = [
  'Saque e recepção', 'Passe e levantamento', 'Ataque e cobertura', 'Bloqueio e defesa',
  'Rodízio e posicionamento', 'Jogo com transição defesa-ataque',
]

export const CONDICIONANTES_TREINO: { id: string; label: string }[] = [
  { id: 'espaco_quadra', label: 'espaço/quadra' },
  { id: 'numero_jogadores', label: 'número (2×2, 3×3...)' },
  { id: 'altura_rede', label: 'altura da rede' },
  { id: 'numero_toques', label: 'nº de toques' },
  { id: 'entrada_bola_saque', label: 'entrada de bola/saque' },
  { id: 'alvo_zona', label: 'alvo/zona' },
  { id: 'pontuacao', label: 'pontuação' },
  { id: 'tempo_informacao', label: 'tempo/informação' },
]

export type GrupoQuadroTreino = 'AQ_JOGO' | 'AQUEC_TECNICO' | 'PARTE1' | 'PARTE2' | 'JOGO_FINAL'

/** Os 11 quadros fixos da ficha, na ordem e quantidade exatas do H10:
 *  AQ/Jogo (1) + Aquec. Técnico (2) + Parte 1 (3) + Parte 2 (3) + Jogo Final (2). */
export const QUADRO_SLOTS: { chave: string; grupo: GrupoQuadroTreino; grupoLabel: string }[] = [
  { chave: 'aq_jogo', grupo: 'AQ_JOGO', grupoLabel: 'AQ / Jogo' },
  { chave: 'aquec_tecnico_1', grupo: 'AQUEC_TECNICO', grupoLabel: 'Aquec. Técnico' },
  { chave: 'aquec_tecnico_2', grupo: 'AQUEC_TECNICO', grupoLabel: 'Aquec. Técnico' },
  { chave: 'parte1_1', grupo: 'PARTE1', grupoLabel: 'Parte 1' },
  { chave: 'parte1_2', grupo: 'PARTE1', grupoLabel: 'Parte 1' },
  { chave: 'parte1_3', grupo: 'PARTE1', grupoLabel: 'Parte 1' },
  { chave: 'parte2_1', grupo: 'PARTE2', grupoLabel: 'Parte 2' },
  { chave: 'parte2_2', grupo: 'PARTE2', grupoLabel: 'Parte 2' },
  { chave: 'parte2_3', grupo: 'PARTE2', grupoLabel: 'Parte 2' },
  { chave: 'jogo_final_1', grupo: 'JOGO_FINAL', grupoLabel: 'Jogo Final' },
  { chave: 'jogo_final_2', grupo: 'JOGO_FINAL', grupoLabel: 'Jogo Final' },
]

/** Elementos do desenho estático de um quadro (pedido 29/10/2026, Fase 2) —
 *  posições em % (0–100) da largura/altura da quadra, pra ficar responsivo
 *  tanto no editor quanto no HTML/PDF exportado. Atletas levam `numero`
 *  (opcional, mostrado dentro do círculo); o marcador `texto` leva `texto`. */
export type ElementoDesenhoTipo = 'atleta_azul' | 'atleta_amarelo' | 'curinga' | 'bola' | 'cone' | 'arco' | 'escada' | 'texto' | 'zona'

export interface ElementoDesenho {
  id: string
  tipo: ElementoDesenhoTipo
  x: number
  y: number
  numero?: string
  texto?: string
  /** só pro tipo `zona` (pedido 30/10/2026, rework do editor) — tamanho da
   *  área marcada, em % da largura/altura da quadra. Ausente = tamanho
   *  padrão (20x15), pra não quebrar zonas antigas que não existem ainda. */
  largura?: number
  altura?: number
}

/** Setas de movimento/jogada entre dois pontos da quadra — mesmas 3
 *  categorias do H10 (Toque/Passe = tracejada, Deslocar = contínua fina,
 *  Saque/Ataque = contínua grossa), só que sem animação (Fase 2 estática). */
export type LinhaDesenhoTipo = 'toque_passe' | 'deslocar' | 'saque_ataque'

export interface LinhaDesenho {
  id: string
  tipo: LinhaDesenhoTipo
  x1: number
  y1: number
  x2: number
  y2: number
  /** Ponto de controle da curva (pedido 30/10/2026: "traço curvo"), em % da
   *  quadra — ausente/undefined = linha reta (comportamento de sempre,
   *  compatível com todas as setas já salvas). Quando presente, a linha vira
   *  uma curva quadrática passando perto desse ponto. */
  cx?: number
  cy?: number
}

/** Um "passo" da animação por quadros (pedido 31/10/2026, fase 2) — cada
 *  passo é um desenho completo (elementos + linhas), igual o `QuadroDesenho`
 *  estático de sempre, mais uma legenda opcional mostrada durante a
 *  animação. */
export interface QuadroDesenhoPasso {
  id: string
  elementos: ElementoDesenho[]
  linhas: LinhaDesenho[]
  legenda?: string
}

export interface QuadroDesenho {
  elementos: ElementoDesenho[]
  linhas: LinhaDesenho[]
  /** Estilo visual dos jogadores no desenho (pedido 30/10/2026) — "boneco" é
   *  o padrão de sempre; ausente = "boneco", pra não alterar nada já salvo. */
  estiloJogador?: 'boneco' | 'circulo'
  /** Qual parte da quadra o editor mostra (pedido 30/10/2026) — não afeta
   *  onde os elementos ficam salvos (sempre em % da quadra inteira), só o
   *  enquadramento/zoom do editor e da prévia. Ausente = quadra inteira. */
  meiaQuadra?: 'inteira' | 'ataque' | 'defesa'
  /** Sequência de passos da animação (pedido 31/10/2026, fase 2) — quando
   *  presente com 2+ passos, o quadro vira uma animação (o editor anima
   *  movendo os elementos de um passo pro outro). `elementos`/`linhas` acima
   *  sempre ficam uma cópia do 1º passo, pra telas antigas que só conhecem
   *  desenho estático (prévia, ficha impressa de outras versões) continuarem
   *  mostrando algo correto. Ausente = desenho estático de sempre (só 1
   *  passo, nenhuma mudança de comportamento ou aparência). */
  passos?: QuadroDesenhoPasso[]
  /** Velocidade da animação — 0.5 (lenta), 1 (normal, padrão) ou 2 (rápida). */
  velocidade?: 0.5 | 1 | 2
  /** Repetir a animação em loop, em vez de parar no último passo. */
  repetir?: boolean
}

export interface QuadroTreino {
  chave: string
  nome?: string
  objetivo?: string
  tempoMin?: number
  comoFunciona?: string
  desenho?: QuadroDesenho
}

/** Os 11 quadros fixos da ficha, por grupo e ordem de exibição (pedido
 *  29/10/2026) — exportado daqui pra ser a MESMA lista usada na ficha
 *  (SessaoTreinoForm) e na Biblioteca de exercícios (filtro por "parte do
 *  treino"), em vez de duas cópias que podiam desalinhar. */
export const GRUPOS_QUADRO_ORDEM: { grupo: GrupoQuadroTreino; label: string }[] = [
  { grupo: 'AQ_JOGO', label: 'AQ / Jogo' },
  { grupo: 'AQUEC_TECNICO', label: 'Aquec. Técnico' },
  { grupo: 'PARTE1', label: 'Parte 1' },
  { grupo: 'PARTE2', label: 'Parte 2' },
  { grupo: 'JOGO_FINAL', label: 'Jogo Final' },
]

/** Exercício salvo na Biblioteca (pedido 31/10/2026: "banco de exercícios",
 *  reaproveitar em qualquer sessão) — mesmos campos de um quadro da ficha
 *  (nome/objetivo/tempo/como funciona/desenho) mais as marcações que
 *  descrevem QUANDO ele serve (tema, problema de jogo, condicionantes),
 *  pra filtrar e sugerir na hora de montar uma sessão nova. Biblioteca é
 *  única pro treinador (não separada por escola/turma) e fica só neste
 *  aparelho por enquanto, igual `sessoesTreino` (ainda sem sincronização
 *  com a nuvem). */
export interface ExercicioBiblioteca {
  id: string
  nome: string
  objetivo?: string
  tempoMin?: number
  comoFunciona?: string
  desenho?: QuadroDesenho
  /** A que parte do treino este exercício costuma servir — ausente/undefined
   *  = serve pra qualquer parte (aparece como opção em todos os quadros,
   *  sem ser priorizado em nenhum). Quando marcado, só pesa na ordenação
   *  (fica em primeiro nos quadros daquela parte); nunca esconde o
   *  exercício das outras partes. */
  grupo?: GrupoQuadroTreino
  /** ids de TEMAS_TREINO marcados nesse exercício. */
  temas: string[]
  problemaJogo?: string
  /** ids de CONDICIONANTES_TREINO marcados nesse exercício. */
  condicionantes: string[]
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

/** As 6 perguntas de reflexão do final da ficha (seção "Registro
 *  pedagógico") — preenchidas pelo treinador depois do treino. Os campos de
 *  escolha única (1 e 3) usam as mesmas opções do H10; os demais são texto
 *  livre (Fase 1 — sem um seletor por atleta/estágio ainda). */
export interface RegistroPedagogico {
  comportamentoApareceu?: 'sozinho' | 'com_pergunta' | 'so_com_instrucao' | 'nao_apareceu'
  problemaResolvido?: string
  camadaObservada?: 'leitura_ajuste' | 'execucao' | 'decisao' | 'cooperacao_conduta'
  alunosObservados?: string
  condicionanteMudaria?: string
  compromissoProximoTreino?: string
  ajustesFeitos?: string
}

export interface SessaoTreino {
  id: string
  turmaId: string
  data: string
  numeroSessao?: string
  numeroAlunos?: number
  materiais?: string
  /** ids de TEMAS_TREINO, na ordem em que foram marcados — o primeiro é o "principal". */
  temas: string[]
  problemaJogo?: string
  /** ids de CONDICIONANTES_TREINO */
  condicionantes: string[]
  quadros: QuadroTreino[]
  registroPedagogico: RegistroPedagogico
  createdAt: string
  updatedAt: string
  deletedAt?: string
}
