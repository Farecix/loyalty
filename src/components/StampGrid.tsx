import type { Card } from '../lib/api'
import { useI18n } from '../i18n'

/** Damga ızgarası: dolu damgalar makas, ödül eşikleri hediye ile işaretli. */
export function StampGrid({ card, highlight = false }: { card: Card; highlight?: boolean }) {
  const { t, pick } = useI18n()
  const total = Math.max(card.cycle_length, 1)
  const ruleAt = new Map(card.rules.map((r) => [r.threshold, r]))
  const next = card.rules.find((r) => r.threshold > card.progress)
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-2xl font-extrabold">{t('stampsOf', { n: card.progress, total })}</p>
        {next && <p className="text-sm text-stone-500">{t('nextReward', { n: next.threshold - card.progress, title: pick(next) })}</p>}
      </div>
      <ol className="grid grid-cols-5 gap-2" aria-label={t('stampsOf', { n: card.progress, total })}>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1, filled = n <= card.progress, rule = ruleAt.get(n)
          const isNew = highlight && n === card.progress
          return (
            <li key={n} className={`relative flex aspect-square items-center justify-center rounded-full border-2 text-lg font-bold
              ${filled ? 'border-brand bg-brand text-white' : rule ? 'border-dashed border-brand text-brand' : 'border-stone-300 text-stone-300'}
              ${isNew ? 'animate-[pop_0.6s_ease-out]' : ''}`}>
              {filled ? '✂' : rule ? '🎁' : n}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
