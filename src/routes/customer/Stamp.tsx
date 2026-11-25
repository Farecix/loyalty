import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { claimStamp, getMyCard, reclaimCard, shopPublic, type ApiError, type Card, type GrantRef } from '../../lib/api'
import { getPosition } from '../../lib/geo'
import { ensureSession } from '../../lib/session'
import { formatTime, useI18n } from '../../i18n'
import { Button, Panel, Shell, Spinner } from '../../components/Shell'
import { SignupForm } from '../../components/SignupForm'
import { StampGrid } from '../../components/StampGrid'
import { InAppWarning } from '../../components/InAppWarning'

type State =
  | { s: 'loading' } | { s: 'signup'; shopName: string } | { s: 'locating' }
  | { s: 'denied' } | { s: 'unavailable' } | { s: 'too_far'; card: Card }
  | { s: 'cooldown'; card: Card; next: string } | { s: 'ok'; card: Card; grants: GrantRef[] }
  | { s: 'error'; msg: string }

/** /s/:shopCode – dükkândaki kart okutulunca açılır ve puanı alır. */
export default function Stamp() {
  const { shopCode = '' } = useParams()
  const { t, lang, pick } = useI18n()
  const [st, setSt] = useState<State>({ s: 'loading' })

  const claim = useCallback(async () => {
    setSt({ s: 'locating' })
    const pos = await getPosition()
    if (pos === 'denied') return setSt({ s: 'denied' })
    if (pos === 'unavailable') return setSt({ s: 'unavailable' })
    const r = await claimStamp(shopCode, pos)
    if (r.status === 'ok') setSt({ s: 'ok', card: r.card, grants: r.new_grants })
    else if (r.status === 'cooldown') setSt({ s: 'cooldown', card: r.card, next: r.next_allowed_at })
    else if (r.status === 'too_far') setSt({ s: 'too_far', card: r.card })
    else setSt({ s: 'signup', shopName: '' })
  }, [shopCode])

  const start = useCallback(async () => {
    try {
      setSt({ s: 'loading' })
      await ensureSession()
      const card = await getMyCard(shopCode)
      if (!card) { const shop = await shopPublic(shopCode); return setSt({ s: 'signup', shopName: shop.name }) }
      await claim()
    } catch (e) {
      setSt({ s: 'error', msg: (e as ApiError).code === 'SHOP_NOT_FOUND' ? t('errShop') : t('error') })
    }
  }, [shopCode, claim, t])

  // Okutma bir kez yapılmalı (StrictMode efekti iki kez çalıştırır).
  const started = useRef('')
  useEffect(() => { if (started.current === shopCode) return; started.current = shopCode; void start() }, [start, shopCode])

  const safeClaim = useCallback(() => { void claim().catch(() => setSt({ s: 'error', msg: t('error') })) }, [claim, t])
  const onPhoneTaken = useCallback(async (phone: string) => {
    const pos = await getPosition()
    if (pos === 'denied') return t('locationRequired')
    if (pos === 'unavailable') return t('locationUnavailable')
    const r = await reclaimCard(shopCode, phone, pos)
    return r === 'ok' ? null : r === 'location_not_set' ? t('reclaimNoLocation') : r === 'not_found' ? t('error') : t('reclaimTooFar')
  }, [shopCode, t])
  const shopName = 'card' in st ? st.card.shop.name : st.s === 'signup' ? st.shopName : ''
  const retry = <Button onClick={safeClaim} className="mt-4 w-full">{t('retry')}</Button>

  return (
    <Shell title={shopName} logo={'card' in st ? st.card.shop.logo_url : null}>
      <InAppWarning />
      {st.s === 'loading' && <Spinner label={t('loading')} />}
      {st.s === 'locating' && <Spinner label={t('gettingLocation')} />}
      {st.s === 'signup' && <Panel><SignupForm shopCode={shopCode} onDone={safeClaim} onPhoneTaken={onPhoneTaken} /></Panel>}
      {st.s === 'denied' && <Panel><p role="alert" className="text-lg">{t('locationRequired')}</p>{retry}</Panel>}
      {st.s === 'unavailable' && <Panel><p role="alert" className="text-lg">{t('locationUnavailable')}</p>{retry}</Panel>}
      {st.s === 'error' && <Panel><p role="alert" className="text-lg">{st.msg}</p></Panel>}
      {st.s === 'too_far' && <Panel><p role="alert" className="mb-4 text-lg">{t('tooFar')}</p><StampGrid card={st.card} />{retry}</Panel>}
      {st.s === 'cooldown' && (
        <Panel>
          <p className="mb-4 text-lg">{t('nextStampAt', { time: formatTime(st.next, lang) })}</p>
          <StampGrid card={st.card} />
          <CardLink code={shopCode} />
        </Panel>
      )}
      {st.s === 'ok' && (
        <>
          <div className="relative my-6 flex flex-col items-center">
            <span aria-hidden className="absolute h-32 w-32 rounded-full bg-brand animate-[pulse-ring_1.2s_ease-out_infinite]" />
            <span className="relative flex h-32 w-32 items-center justify-center rounded-full bg-brand text-5xl font-extrabold shadow-2xl">+1</span>
            <p className="mt-4 text-xl font-bold">{t('stampAdded')}</p>
          </div>
          {st.grants.length > 0 && (
            <Panel className="mb-4 bg-amber-100">
              <p className="font-semibold">{t('newReward')}</p>
              {st.grants.map((g) => <p key={g.id} className="text-2xl font-extrabold">🎁 {pick(g)}</p>)}
            </Panel>
          )}
          <Panel><StampGrid card={st.card} highlight /><CardLink code={shopCode} /></Panel>
        </>
      )}
    </Shell>
  )
}

function CardLink({ code }: { code: string }) {
  const { t } = useI18n()
  return <Link to={`/k/${code}`} className="mt-5 block rounded-2xl bg-ink py-3 text-center font-bold text-white">{t('myRewards')} →</Link>
}
