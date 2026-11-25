import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'

/** Dükkân konumu girilmeden konum kontrolü çalışmaz; berberi uyar. */
export function SetupWarning({ shop }: { shop: { lat: number | null; lng: number | null } }) {
  const { t } = useI18n()
  if (shop.lat != null && shop.lng != null) return null
  return (
    <Link to="/panel/settings" role="alert" className="mb-4 block rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
      ⚠️ {t('setupLocationWarning')}
    </Link>
  )
}
