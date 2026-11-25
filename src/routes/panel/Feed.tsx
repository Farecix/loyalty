import { useCallback, useEffect, useState } from 'react'
import { cancelStamp, shopFeed, undoRedemption, type FeedItem, type Shop } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { formatTime, useI18n } from '../../i18n'

export function FeedList({ items, onCancel, onUndo }:
  { items: FeedItem[]; onCancel: (id: string) => void; onUndo: (id: string) => void }) {
  const { t, lang, pick } = useI18n()
  if (items.length === 0) return <p className="py-10 text-center text-stone-500">{t('emptyFeed')}</p>
  return (
    <ul className="divide-y divide-stone-200 rounded-2xl bg-white shadow-sm">
      {items.map((f) => (
        <li key={f.kind + f.id} className={`flex items-center gap-3 px-4 py-3 ${f.cancelled ? 'line-through opacity-50' : ''}`}>
          <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold
            ${f.kind === 'redeem' ? 'bg-green-100 text-green-700' : f.source === 'referral' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-brand-dark'}`}>
            {f.kind === 'redeem' ? '🎁' : '+1'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{f.customer_name}</p>
            <p className="text-xs text-stone-500">
              {formatTime(f.at, lang)} · {f.kind === 'redeem' ? t('redeemEvent', { title: pick({ title_th: f.title_th ?? '', title_en: f.title_en }) })
                : f.source === 'referral' ? t('referralEvent') : t('stampEvent')}
            </p>
          </div>
          {f.cancelled ? <span className="text-xs no-underline">{t('cancelled')}</span>
            : f.kind === 'stamp' ? (
              <button type="button" className="rounded-lg border border-stone-300 px-3 py-1 text-sm"
                onClick={() => { if (window.confirm(t('confirmCancel'))) onCancel(f.id) }}>{t('cancelStamp')}</button>
            ) : (
              <button type="button" className="rounded-lg border border-stone-300 px-3 py-1 text-sm" onClick={() => onUndo(f.id)}>{t('undo')}</button>
            )}
        </li>
      ))}
    </ul>
  )
}

export default function Feed({ shop }: { shop: Shop }) {
  const [items, setItems] = useState<FeedItem[]>([])
  const reload = useCallback(async () => { try { setItems(await shopFeed()) } catch { /* sonraki denemede */ } }, [])
  useEffect(() => {
    void reload()
    const ch = supabase.channel('feed-' + shop.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stamps', filter: `shop_id=eq.${shop.id}` }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_grants', filter: `shop_id=eq.${shop.id}` }, () => void reload())
      .subscribe()
    const poll = setInterval(() => void reload(), 30000)
    return () => { void supabase.removeChannel(ch); clearInterval(poll) }
  }, [shop.id, reload])
  return <FeedList items={items}
    onCancel={(id) => void cancelStamp(id).then(reload)}
    onUndo={(id) => void undoRedemption(id).then(reload)} />
}
