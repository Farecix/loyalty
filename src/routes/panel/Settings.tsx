import { useEffect, useState, type FormEvent } from 'react'
import { addRule, listRules, removeRule, updateShop, type RuleRow, type Shop } from '../../lib/api'
import { getPosition } from '../../lib/geo'
import { supabase } from '../../lib/supabase'
import { useI18n } from '../../i18n'
import { Button } from '../../components/Shell'

const box = 'rounded-2xl bg-white p-4 shadow-sm space-y-3'
const input = 'mt-1 w-full rounded-xl border border-stone-300 px-3 py-2'

export default function Settings({ shop, onSaved }: { shop: Shop; onSaved: () => void }) {
  const { t } = useI18n()
  const [f, setF] = useState({ name: shop.name, lat: shop.lat, lng: shop.lng, radius_m: shop.radius_m, cooldown_hours: shop.cooldown_hours })
  const [msg, setMsg] = useState<string | null>(null)
  const [check, setCheck] = useState(shop.location_check)

  async function save(e?: FormEvent, patch?: Partial<Shop>) {
    e?.preventDefault(); setMsg(null)
    try { await updateShop(shop.id, patch ?? f); setMsg(t('saved')); onSaved() } catch { setMsg(t('error')) }
  }
  async function useHere() {
    const p = await getPosition()
    if (p === 'denied') return setMsg(t('locationRequired'))
    if (p === 'unavailable') return setMsg(t('locationUnavailable'))
    setF((x) => ({ ...x, lat: p.lat, lng: p.lng }))
    await save(undefined, { lat: p.lat, lng: p.lng })
  }
  async function uploadLogo(file: File) {
    const path = `${shop.id}/logo-${Date.now()}.${file.name.split('.').pop() || 'png'}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { contentType: file.type })
    if (error) return setMsg(t('error'))
    const url = supabase.storage.from('logos').getPublicUrl(path).data.publicUrl
    await save(undefined, { logo_url: url })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className={box}>
        <label className="block"><span className="text-sm font-semibold">{t('shopName')}</span>
          <input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-sm font-semibold">{t('radius')}</span>
            <input className={input} type="number" min={10} max={5000} value={f.radius_m} onChange={(e) => setF({ ...f, radius_m: Number(e.target.value) })} /></label>
          <label className="block"><span className="text-sm font-semibold">{t('cooldown')}</span>
            <input className={input} type="number" min={0} max={168} value={f.cooldown_hours} onChange={(e) => setF({ ...f, cooldown_hours: Number(e.target.value) })} /></label>
        </div>
        <Button type="submit">{t('save')}</Button>
        {msg && <p role="status" className="text-sm text-stone-600">{msg}</p>}
      </form>

      <div className={box}>
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">{t('locationCheck')}</span>
          <input type="checkbox" role="checkbox" aria-label={t('locationCheck')} className="h-6 w-11 accent-brand" checked={check}
            onChange={(e) => { setCheck(e.target.checked); void save(undefined, { location_check: e.target.checked }) }} />
        </label>
        <p className="text-xs text-stone-500">{t('locationCheckHint')}</p>
        <hr className="border-stone-200" />
        <p className="font-semibold">{t('location')}</p>
        <p className="text-sm text-stone-500">{f.lat != null && f.lng != null ? `${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}` : t('noLocation')}</p>
        <Button type="button" variant="ghost" onClick={() => void useHere()}>📍 {t('useMyLocation')}</Button>
        <p className="text-xs text-stone-500">{t('locationHint')}</p>
      </div>

      <div className={box}>
        <p className="font-semibold">{t('logo')}</p>
        {shop.logo_url && <img src={shop.logo_url} alt="" className="h-16 w-16 rounded-full object-cover" />}
        <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadLogo(file) }} />
      </div>

      <Rules shopId={shop.id} />
    </div>
  )
}

function Rules({ shopId }: { shopId: string }) {
  const { t } = useI18n()
  const [rules, setRules] = useState<RuleRow[]>([])
  const [n, setN] = useState(''), [th, setTh] = useState(''), [en, setEn] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const reload = () => void listRules(shopId).then(setRules).catch(() => {})
  useEffect(reload, [shopId])
  async function add(e: FormEvent) {
    e.preventDefault(); setErr(null)
    try { await addRule(shopId, Number(n), th, en || null); setN(''); setTh(''); setEn(''); reload() } catch { setErr(t('error')) }
  }
  return (
    <div className={box}>
      <p className="font-semibold">{t('rewards')}</p>
      <ul className="space-y-2">
        {rules.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-xl bg-stone-100 px-3 py-2">
            <span><b>#{r.threshold}</b> · {r.title_th}{r.title_en ? ` / ${r.title_en}` : ''}</span>
            <button className="text-sm text-red-600 underline" onClick={() => void removeRule(r.id).then(reload)}>{t('remove')}</button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid grid-cols-[5rem_1fr] gap-2 sm:grid-cols-[5rem_1fr_1fr_auto]">
        <input className={input} type="number" min={1} max={100} required placeholder={t('threshold')} aria-label={t('threshold')} value={n} onChange={(e) => setN(e.target.value)} />
        <input className={input} required placeholder={t('titleTh')} aria-label={t('titleTh')} value={th} onChange={(e) => setTh(e.target.value)} />
        <input className={`${input} col-span-2 sm:col-span-1`} placeholder={t('titleEn')} aria-label={t('titleEn')} value={en} onChange={(e) => setEn(e.target.value)} />
        <Button type="submit" className="col-span-2 sm:col-span-1">{t('addReward')}</Button>
      </form>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
    </div>
  )
}
