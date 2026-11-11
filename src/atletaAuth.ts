// Portal da Atleta (pedido 23/10/2026): login simples por código — decisão
// explícita do Henrique, SEM conta real de e-mail/senha por atleta (evita o
// problema recorrente de rate-limit de e-mail do Supabase Auth, documentado
// nas fases anteriores, e é mais simples pra atletas mais jovens).
//
// A sessão da atleta fica SÓ no sessionStorage (nunca no IndexedDB/Zustand
// principal do app, que é do treinador) — fecha a aba, precisa digitar o
// código de novo. Isso é intencional: o portal é uma área separada, read-only,
// que não deve se misturar com os dados locais do treinador no mesmo
// dispositivo.
//
// Importante (trade-off de segurança, avisar o Henrique): o código não tem
// limite de tentativas — é uma RPC pública (`atleta_login`) que qualquer um
// pode chamar. A proteção é só o código ser aleatório e difícil de adivinhar
// (6 caracteres, ~1 bilhão de combinações). Não é pra dados sigilosos de
// verdade, é visão do rating/scout esportivo da própria atleta.
import { supabase } from './supabaseClient'
import { normalizarPosicao, type FundamentoScout, type Posicao, type ResultadoEvento } from './types'

export interface AtletaPortalEvento {
  fundamento: FundamentoScout
  resultado: ResultadoEvento
}

export interface AtletaPortalPartida {
  id: string
  data: string
  adversarioNome: string | null
  turmaNome: string | null
  setsGanhosCasa: number
  setsGanhosAdversario: number
  eventos: AtletaPortalEvento[]
}

export interface AtletaPortalSessao {
  atleta: {
    id: string
    nome: string
    idade: number | null
    altura: number | null
    posicao: Posicao | null
    /** Função secundária (pedido 30/10/2026) — entra no cálculo do rating
     *  junto com a principal, ver `rating.ts`. */
    posicaoSecundaria: Posicao | null
  }
  partidas: AtletaPortalPartida[]
}

const CHAVE_SESSAO = 'rdsports_atleta_sessao'

function mensagemErro(codigo: string): string {
  if (codigo === 'codigo_vazio') return 'Digite o código de acesso.'
  if (codigo === 'nao_encontrado') return 'Código não encontrado. Confira com seu professor se o código está certo e ainda ativo.'
  return 'Não foi possível entrar agora. Tente de novo em alguns segundos.'
}

/** Tenta entrar no portal com o código informado. Em caso de sucesso, já
 *  salva a sessão (dados da atleta + partidas) no sessionStorage. */
export async function entrarComCodigo(codigoDigitado: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const codigo = codigoDigitado.trim().toUpperCase()
  if (!codigo) return { ok: false, erro: mensagemErro('codigo_vazio') }

  const { data, error } = await supabase.rpc('atleta_login', { p_codigo: codigo })
  if (error) return { ok: false, erro: 'Não foi possível conectar agora. Confira sua internet e tente de novo.' }
  if (!data?.ok) return { ok: false, erro: mensagemErro(data?.erro ?? '') }

  // Defensivo: a RPC `atleta_login` devolve o valor CRU das colunas
  // `posicao`/`posicao_secundaria` no Postgres — atletas recuperadas de antes
  // de 23/10/2026 ainda têm valores do formato antigo ("Ponteira", "Central",
  // "6x0" etc.), que travavam o painel da atleta com tela preta no cálculo
  // do rating (mesmo bug encontrado em produção no perfil do lado do
  // treinador).
  const atletaNormalizada = {
    ...data.atleta,
    posicao: normalizarPosicao(data.atleta?.posicao) ?? null,
    posicaoSecundaria: normalizarPosicao(data.atleta?.posicaoSecundaria) ?? null,
  }
  const sessao: AtletaPortalSessao = { atleta: atletaNormalizada, partidas: data.partidas ?? [] }
  try {
    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao))
  } catch {
    // sessionStorage indisponível (modo privado restrito etc.) — a tela de
    // painel vai simplesmente não achar sessão e mandar pro login de novo.
  }
  return { ok: true }
}

/** Lê a sessão atual do portal (ou null se não tiver nenhuma / tiver
 *  expirado por fechar a aba). Nunca lança — dado corrompido vira "sem
 *  sessão", não erro de tela. */
export function sessaoAtual(): AtletaPortalSessao | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO)
    if (!bruto) return null
    const sessao = JSON.parse(bruto)
    if (!sessao?.atleta?.id) return null
    return sessao as AtletaPortalSessao
  } catch {
    return null
  }
}

export function sairDoPortal(): void {
  try {
    sessionStorage.removeItem(CHAVE_SESSAO)
  } catch {
    // nada a fazer — sem sessionStorage, já não tinha sessão guardada mesmo.
  }
}
