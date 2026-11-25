import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMyCard, type ApiError, type Card as CardT } from '../../lib/api'
import { ensureSession } from '../../lib/session'
import { publicBaseUrl } from '../../lib/supabase'
import { useI18n } from '../../i18n'
import { Button, Panel, Shell, Spinner } from '../../components/Shell'
import { SignupForm } from '../../components/SignupForm'
import { StampGrid } from '../../components/StampGrid'

/** /k/:shopCode – müşterinin kartı (ödüller + davet). /d/:shopCode/:refCode – davetle kayıt. */
export default function Card() {
  const { shopCode = '', refCode } = useParams()
  const { t, pick } = useI18n()
  const [card, setCard] = useState<CardT | null | undefined>(undefined)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { await ensureSession(); setCard(await getMyCard(shopCode)) }
    catch (e) { setErr((e as ApiError).code === 'SHOP_NOT_FOUND' ? t('errShop') : t('error')) }
  }, [shopCode, t])
  useEffect(() => { void load() }, [load])

  if (err) return <Shell><Panel><p role="alert">{err}</p></Panel></Shell>
  if (card === undefined) return <Shell><Spinner label={t('loading')} /></Shell>
  if (card === null) return (
    <Shell><Panel><SignupForm shopCode={shopCode} refCode={refCode ?? null} onDone={() => void load()} /></Panel>
      <p className="mt-4 text-center text-sm text-white/70">{t('scanHint')}</p></Shell>
  )

  return (
    <Shell title={card.shop.name}>
      <Panel className="mb-4">
        <p className="mb-3 text-sm text-stone-500">{card.customer.name}</p>
        <StampGrid card={card} />
        <p className="mt-4 text-center text-sm text-stone-500">{t('scanHint')}</p>
      </Panel>
      <Panel className="mb-4">
        <h2 className="mb-3 text-lg font-extrabold">{t('myRewards')}</h2>
        {card.available.length === 0 ? <p className="text-stone-500">{t('noRewards')}</p> : (
          <ul className="space-y-2">
            {card.available.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 rounded-2xl bg-amber-100 p-3">
                <span className="font-bold">🎁 {pick(g)}</span>
                <Link to={`/k/${shopCode}/use/${g.id}`} className="rounded-xl bg-brand px-4 py-2 font-bold text-white">{t('useReward')}</Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Invite card={card} shopCode={shopCode} />
    </Shell>
  )
}

function Invite({ card, shopCode }: { card: CardT; shopCode: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const url = `${publicBaseUrl}/d/${shopCode}/${card.customer.invite_code}`
  const text = t('shareMessage', { shop: card.shop.name })
  async function share() {
    try {
      if (navigator.share) { await navigator.share({ title: card.shop.name, text, url }); return }
      await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true)
    } catch { /* kullanıcı iptal etti */ }
  }
  return (
    <Panel>
      <h2 className="text-lg font-extrabold">{t('inviteTitle')}</h2>
      <p className="mb-3 text-sm text-stone-500">{t('inviteText')}</p>
      <div className="mb-3 truncate rounded-xl bg-stone-100 px-3 py-2 font-mono text-xs">{url}</div>
      <div className="flex gap-2">
        <Button onClick={share} className="flex-1">{copied ? t('copied') : t('share')}</Button>
        <a className="flex items-center rounded-2xl bg-[#06c755] px-4 font-bold text-white" target="_blank" rel="noreferrer"
          href={`https://line.me/R/share?text=${encodeURIComponent(`${text} ${url}`)}`}>LINE</a>
      </div>
    </Panel>
  )
}
