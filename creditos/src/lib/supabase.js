import { createClient } from '@supabase/supabase-js'

// ─── PEGA AQUÍ TUS CLAVES DE SUPABASE ───────────────────────────────────────
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co'
const SUPABASE_ANON_KEY = 'TU_ANON_KEY'
// ────────────────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })
  if (error) console.error(error)
}

export async function signOut() {
  await supabase.auth.signOut()
}
