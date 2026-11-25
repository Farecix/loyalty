import { useEffect, useState } from 'react'
import { createLoginLink, shopCustomers, type CustomerRow } from '../../lib/api'
import { publicBaseUrl } from '../../lib/supabase'
import { formatTime, useI18n } from '../../i18n'

export default function Customers() {
  const { t, lang } = useI18n()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [link, setLink] = useState<{ id: string; url: string } | null>(null)
  useEffect(() => {
    const h = setTimeout(() => void shopCustomers(q || null).then(setRows).catch(() => {}), 250)
    return () => clearTimeout(h)
  }, [q])

  async function makeLink(id: string) {
    const token = await createLoginLink(id)
    setLink({ id, url: `${publicBaseUrl}/g/${token}` })
  }

  return (
    <div className="space-y-3">
      <input type="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3" />
      <ul className="divide-y divide-stone-200 rounded-2xl bg-white shadow-sm">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.name}</p>
                <p className="text-xs text-stone-500">+{r.phone} · {r.last_visit ? `${t('lastVisit')}: ${formatTime(r.last_visit, lang)}` : '—'}
                  {r.referred_count > 0 && ` · ${t('invitedCount', { n: r.referred_count })}`}</p>
              </div>
              <div className="text-right text-sm">
                <p><b>{r.progress}</b> {t('progressCol')}</p>
                {r.available > 0 && <p className="text-green-700">🎁 {r.available}</p>}
              </div>
            </div>
            {link?.id === r.id ? (
              <div className="mt-2 rounded-xl bg-stone-100 p-2 text-xs">
                <p className="mb-1 text-stone-500">{t('loginLinkHint')}</p>
                <div className="flex gap-2"><code className="flex-1 truncate">{link.url}</code>
                  <button className="font-semibold underline" onClick={() => void navigator.clipboard?.writeText(link.url)}>{t('copy')}</button></div>
              </div>
            ) : (
              <button className="mt-1 text-xs text-stone-500 underline" onClick={() => void makeLink(r.id)}>{t('loginLink')}</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
