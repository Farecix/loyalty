import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { LangSwitch, useI18n } from '../../i18n'
import { Button } from '../../components/Shell'

export default function Login() {
  const { t } = useI18n()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null), [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg(null); setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setMsg(error.message)
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + '/panel' } })
        if (error) setMsg(error.message); else if (!data.session) setMsg(t('checkEmail'))
      }
    } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-stone-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between"><h1 className="text-xl font-extrabold">{t('panel')}</h1><LangSwitch className="border-stone-300 text-ink" /></div>
        <label className="block"><span className="text-sm font-semibold">{t('email')}</span>
          <input type="email" required autoComplete="email" className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="block"><span className="text-sm font-semibold">{t('password')}</span>
          <input type="password" required minLength={8} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {msg && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">{msg}</p>}
        <Button type="submit" disabled={busy} className="w-full">{mode === 'in' ? t('signIn') : t('signUp')}</Button>
        <button type="button" className="w-full text-sm text-stone-500 underline" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? t('noAccount') : t('haveAccount')}</button>
      </form>
    </div>
  )
}
