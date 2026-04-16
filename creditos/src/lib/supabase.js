import { createClient } from '@supabase/supabase-js'

// ─── PEGA AQUÍ TUS CLAVES DE SUPABASE ───────────────────────────────────────
const SUPABASE_URL = 'https://rmwklszrizxllladsczc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtd2tsc3pyaXp4bGxsYWRzY3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNjI5MDAsImV4cCI6MjA5MTkzODkwMH0.DUN5MXp0JpT5ZLE34TNpIwM9SArDGT0nhqQV2JrVzPQ'
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
