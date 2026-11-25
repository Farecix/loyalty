import { useState, type FormEvent } from 'react'
import { registerCustomer, type ApiError } from '../lib/api'
import { useI18n, type Key } from '../i18n'
import { Button } from './Shell'

const errKey: Partial<Record<ApiError['code'], Key>> = {
  PHONE_TAKEN: 'errPhoneTaken', PHONE_INVALID: 'errPhoneInvalid', PDPA_REQUIRED: 'errPdpa',
  NAME_REQUIRED: 'errName', SHOP_NOT_FOUND: 'errShop',
}

export function SignupForm({ shopCode, refCode, onDone }: { shopCode: string; refCode?: string | null; onDone: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [pdpa, setPdpa] = useState(false)
  const [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false), [showPolicy, setShowPolicy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null)
    if (!name.trim()) return setErr(t('errName'))
    if (!pdpa) return setErr(t('errPdpa'))
    setBusy(true)
    try { await registerCustomer(shopCode, name, phone, refCode ?? null, pdpa); onDone() }
    catch (e) { setErr(t(errKey[(e as ApiError).code] ?? 'error')) }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">{t('signupTitle')}</h1>
        <p className="text-stone-500">{refCode ? t('invitedBy') : t('signupSubtitle')}</p>
      </div>
      <label className="block">
        <span className="text-sm font-semibold">{t('name')}</span>
        <input className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3 text-lg" value={name}
          onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={80} />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">{t('phone')}</span>
        <input className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3 text-lg" value={phone} type="tel"
          inputMode="tel" placeholder={t('phonePlaceholder')} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-brand" checked={pdpa} onChange={(e) => setPdpa(e.target.checked)} />
        <span>{t('pdpaConsent')} · <button type="button" className="underline" onClick={() => setShowPolicy((v) => !v)}>{t('pdpaRead')}</button></span>
      </label>
      {showPolicy && <div className="rounded-xl bg-stone-100 p-3 text-xs text-stone-600"><b>{t('pdpaTitle')}</b><p className="mt-1">{t('pdpaBody')}</p></div>}
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      <Button type="submit" disabled={busy} className="w-full">{t('createCard')}</Button>
    </form>
  )
}
