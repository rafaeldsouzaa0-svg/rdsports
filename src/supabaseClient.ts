import { createClient } from '@supabase/supabase-js'

// Projeto Supabase do RDSports (ver claude/rdsports-supabase-fase0.md no histórico do projeto).
// URL e chave publicável — seguras para ficar no código do cliente (front-end), protegidas
// pelas políticas de RLS no banco (cada professor só lê/escreve as próprias linhas via owner_id).
const SUPABASE_URL = 'https://pqmpbecetxsdozypxqga.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_N9757KDL3bjVYmQLq_Pu1A_oq_BcGVo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
