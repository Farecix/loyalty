import { supabase } from './supabase'

/** Müşteri için anonim oturum: yoksa oluşturur. */
export async function ensureSession(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return
  const { error } = await supabase.auth.signInAnonymously()
  if (error) throw error
}
