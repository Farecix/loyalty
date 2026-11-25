import { useState, type FormEvent } from 'react'
import { loginByPhone, registerCustomer, type ApiError } from '../lib/api'
import { useI18n, type Key } from '../i18n'
import { Button } from './Shell'

const errKey: Partial<Record<ApiError['code'], Key>> = {
  PHONE_INVALID: 'errPhoneInvalid', PDPA_REQUIRED: 'errPdpa', NAME_REQUIRED: 'errName', SHOP_NOT_FOUND: 'errShop',
}
const input = 'mt-1 w-full rounded-xl border border-stone-300 px-4 py-3 text-lg'

/** Kayıt ya da (ilk kayıttan sonra) telefon numarasıyla giriş. Kayıtlı numarayla kayıt denenirse doğrudan giriş yapılır. */
export function SignupForm({ shopCode, refCode, onDone }: { shopCode: string; refCode?: string | null; onDone: () => void }) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [pdpa, setPdpa] = useState(false)
  const [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false), [showPolicy, setShowPolicy] = useState(false)

  async function login() {
    const r = await loginByPhone(shopCode, phone)
    if (r === 'ok') onDone(); else setErr(t('phoneNotFound'))
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null)
    if (mode === 'signup') {
      if (!name.trim()) return setErr(t('errName'))
      if (!pdpa) return setErr(t('errPdpa'))
    }
    setBusy(true)
    try {
      if (mode === 'login') return await login()
      try { await registerCustomer(shopCode, name, phone, refCode ?? null, pdpa); onDone() }
      catch (e) { if ((e as ApiError).code === 'PHONE_TAKEN') await login(); else throw e }
    } catch (e) { setErr(t(errKey[(e as ApiError).code] ?? 'error')) }
    finally { setBusy(false) }
  }

  const switchTo = (m: 'signup' | 'login') => { setMode(m); setErr(null) }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">{mode === 'login' ? t('loginTitle') : t('signupTitle')}</h1>
        {mode === 'signup' && <p className="text-stone-500">{refCode ? t('invitedBy') : t('signupSubtitle')}</p>}
      </div>
      {mode === 'signup' && (
        <label className="block">
          <span className="text-sm font-semibold">{t('name')}</span>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={80} />
        </label>
      )}
      <label className="block">
        <span className="text-sm font-semibold">{t('phone')}</span>
        <input className={input} value={phone} type="tel" inputMode="tel" placeholder={t('phonePlaceholder')}
          onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
      </label>
      {mode === 'signup' && (
        <>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-brand" checked={pdpa} onChange={(e) => setPdpa(e.target.checked)} />
            <span>{t('pdpaConsent')} · <button type="button" className="underline" onClick={() => setShowPolicy((v) => !v)}>{t('pdpaRead')}</button></span>
          </label>
          {showPolicy && <div className="rounded-xl bg-stone-100 p-3 text-xs text-stone-600"><b>{t('pdpaTitle')}</b><p className="mt-1">{t('pdpaBody')}</p></div>}
        </>
      )}
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      <Button type="submit" disabled={busy} className="w-full">{mode === 'login' ? t('logIn') : t('createCard')}</Button>
      <button type="button" className="w-full text-center text-sm font-semibold text-brand underline"
        onClick={() => switchTo(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? t('newCard') : t('haveCard')}</button>
    </form>
  )
}
