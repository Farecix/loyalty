import { useI18n } from '../i18n'

/** LINE / Facebook / Instagram uygulama içi tarayıcıları: oturum orada kalır, NFC Safari/Chrome açar. */
export function isInAppBrowser(ua: string) {
  return /\bLine\/|FBAN|FBAV|Instagram/i.test(ua)
}

export function InAppWarning({ ua = typeof navigator !== 'undefined' ? navigator.userAgent : '' }: { ua?: string }) {
  const { t } = useI18n()
  if (!isInAppBrowser(ua)) return null
  return <p role="alert" className="mb-4 rounded-2xl bg-amber-300 p-3 text-sm font-semibold text-ink">⚠️ {t('openInBrowser')}</p>
}
