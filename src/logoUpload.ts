// Upload de logo de escola/adversário/foto de atleta pro bucket público `logos` do Supabase
// Storage (criado na migração `criar_bucket_logos_publico`, 30/10/2026).
// RLS do bucket: leitura pública pra qualquer um, escrita só dentro da
// própria pasta do usuário (`<auth.uid()>/...`) — por isso sempre montamos o
// caminho começando pelo id do dono.
import { supabase } from './supabaseClient'

const TAMANHO_MAXIMO_BYTES = 2 * 1024 * 1024 // 2MB — suficiente pra um escudo/logo, sem pesar o app
const TIPOS_ACEITOS = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

export class ErroUploadLogo extends Error {}

function extensaoDoArquivo(arquivo: File): string {
  const peloNome = arquivo.name.split('.').pop()?.toLowerCase()
  if (peloNome && /^[a-z0-9]+$/.test(peloNome)) return peloNome
  if (arquivo.type === 'image/png') return 'png'
  if (arquivo.type === 'image/webp') return 'webp'
  if (arquivo.type === 'image/svg+xml') return 'svg'
  return 'jpg'
}

/** Envia o arquivo escolhido pro bucket `logos` e devolve a URL pública
 *  (com um parâmetro `?v=` pra não ficar presa em cache antigo do navegador
 *  depois de trocar o logo). `prefixo`+`id` identifica de quem é o logo
 *  (ex.: `escola-<id>`, `adversario-<id>`) — sempre o mesmo nome de arquivo
 *  pra uma mesma escola/adversário, então trocar o logo substitui o anterior
 *  em vez de acumular lixo no bucket. */
export async function enviarLogo(arquivo: File, prefixo: 'escola' | 'adversario' | 'atleta', id: string): Promise<string> {
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    throw new ErroUploadLogo('Formato não aceito — use PNG, JPG, WEBP ou SVG.')
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new ErroUploadLogo('Imagem muito grande — no máximo 2MB.')
  }
  const { data: userData } = await supabase.auth.getUser()
  const ownerId = userData.user?.id
  if (!ownerId) throw new ErroUploadLogo('É preciso estar conectado à conta na nuvem pra enviar um logo.')

  const caminho = `${ownerId}/${prefixo}-${id}.${extensaoDoArquivo(arquivo)}`
  const { error } = await supabase.storage.from('logos').upload(caminho, arquivo, { upsert: true, cacheControl: '3600' })
  if (error) throw new ErroUploadLogo(error.message || 'Não foi possível enviar a imagem.')

  const { data } = supabase.storage.from('logos').getPublicUrl(caminho)
  return `${data.publicUrl}?v=${Date.now()}`
}
