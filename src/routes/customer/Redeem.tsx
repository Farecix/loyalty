import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMyCard, redeemGrant, type ApiError, type GrantRef } from '../../lib/api'
import { ensureSession } from '../../lib/session'
import { useI18n } from '../../i18n'
import { Button, Panel, Shell, Spinner } from '../../components/Shell'

/** /k/:shopCode/use/:grantId – ödülü berberin önünde kullanma. */
export default function Redeem() {
  const { shopCode = '', grantId = '' } = useParams()
  const { t, pick } = useI18n()
  const [grant, setGrant] = useState<GrantRef | null | undefined>(undefined)
  const [usedAt, setUsedAt] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { void (async () => {
    try { await ensureSession(); const c = await getMyCard(shopCode); setGrant(c?.available.find((g) => g.id === grantId) ?? null) }
    catch { setErr(t('error')) }
  })() }, [shopCode, grantId, t])

  async function use() {
    setBusy(true)
    try { setUsedAt(await redeemGrant(grantId)) }
    catch (e) { setErr((e as ApiError).code === 'GRANT_NOT_AVAILABLE' ? t('noRewards') : t('error')) }
    finally { setBusy(false) }
  }

  if (usedAt && grant) return <UsedScreen title={pick(grant)} shopCode={shopCode} />
  if (err) return <Shell><Panel><p role="alert">{err}</p><Back code={shopCode} /></Panel></Shell>
  if (grant === undefined) return <Shell><Spinner label={t('loading')} /></Shell>
  if (grant === null) return <Shell><Panel><p>{t('noRewards')}</p><Back code={shopCode} /></Panel></Shell>
  return (
    <Shell>
      <Panel>
        <p className="text-3xl font-extrabold">🎁 {pick(grant)}</p>
        <p className="my-4 text-stone-600">{t('confirmUse')}</p>
        <Button onClick={use} disabled={busy} className="w-full py-5 text-xl">{t('useReward')}</Button>
        <Back code={shopCode} />
      </Panel>
    </Shell>
  )
}

function Back({ code }: { code: string }) {
  const { t } = useI18n()
  return <Link to={`/k/${code}`} className="mt-4 block text-center text-stone-500 underline">{t('back')}</Link>
}

/** Tam ekran yeşil "KULLANILDI": canlı saat + sürekli hareket, ekran görüntüsüyle kandırmayı zorlaştırır. */
export function UsedScreen({ title, shopCode }: { title: string; shopCode: string }) {
  const { t, lang } = useI18n()
  const [now, setNow] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 250); return () => clearInterval(i) }, [])
  return (
    <div className="fixed inset-0 overflow-hidden bg-green-600 text-white">
      <div aria-hidden className="absolute -inset-1/2 animate-[spinbg_6s_linear_infinite] bg-[conic-gradient(from_0deg,#16a34a,#22c55e,#15803d,#16a34a)] opacity-70" />
      <div className="relative flex h-full flex-col items-center justify-center p-6 text-center">
        <p className="text-7xl font-black tracking-wider">✓ {t('used')}</p>
        <p className="mt-4 text-3xl font-extrabold">{title}</p>
        <p className="mt-8 font-mono text-5xl font-bold tabular-nums" aria-live="off">
          {now.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-GB', { hour12: false })}
        </p>
        <p className="mt-2 text-lg">{now.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'full' })}</p>
        <p className="mt-10 opacity-80">{t('showBarber')}</p>
        <Link to={`/k/${shopCode}`} className="mt-6 rounded-full bg-white/20 px-6 py-2">{t('back')}</Link>
      </div>
    </div>
  )
}
