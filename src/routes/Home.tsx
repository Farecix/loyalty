import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { Panel, Shell } from '../components/Shell'

export default function Home() {
  const { t } = useI18n()
  return (
    <Shell title={t('appName')}>
      <Panel>
        <h1 className="text-2xl font-extrabold">{t('appName')}</h1>
        <p className="mt-2 text-stone-600">{t('scanHint')}</p>
        <Link to="/panel" className="mt-6 inline-block text-sm text-stone-500 underline">{t('panel')}</Link>
      </Panel>
    </Shell>
  )
}
