import { create } from 'zustand'
import { supabase } from './supabaseClient'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  carregando: boolean
  erro: string | null

  init: () => void
  entrar: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>
  cadastrar: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>
  recuperarSenha: (email: string) => Promise<{ ok: boolean; erro?: string }>
  redefinirSenha: (novaSenha: string) => Promise<{ ok: boolean; erro?: string }>
  sair: () => Promise<void>
}

function traduzErro(msg: string): string {
  if (msg.includes('email rate limit') || msg.includes('rate limit')) {
    return 'Muitos e-mails enviados em pouco tempo — aguarde alguns minutos e tente de novo.'
  }
  if (msg.includes('Invalid login credentials')) {
    return 'E-mail ou senha incorretos.'
  }
  if (msg.includes('already registered') || msg.includes('already exists')) {
    return 'Já existe uma conta com esse e-mail. Tente entrar em vez de cadastrar.'
  }
  if (msg.includes('Password should be')) {
    return 'A senha precisa ter pelo menos 6 caracteres.'
  }
  return msg
}

export const useAuthStore = create<AuthState>()((setState) => ({
  session: null,
  user: null,
  carregando: true,
  erro: null,

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, user: data.session?.user ?? null, carregando: false })
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null, carregando: false })
    })
  },

  entrar: async (email, senha) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) return { ok: false, erro: traduzErro(error.message) }
    return { ok: true }
  },

  cadastrar: async (email, senha) => {
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}#/auth/login` },
    })
    if (error) return { ok: false, erro: traduzErro(error.message) }
    return { ok: true }
  },

  recuperarSenha: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}#/auth/redefinir-senha`,
    })
    if (error) return { ok: false, erro: traduzErro(error.message) }
    return { ok: true }
  },

  redefinirSenha: async (novaSenha) => {
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (error) return { ok: false, erro: traduzErro(error.message) }
    return { ok: true }
  },

  sair: async () => {
    await supabase.auth.signOut()
  },
}))
