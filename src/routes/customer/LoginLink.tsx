import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { consumeLoginLink } from '../../lib/api'
import { ensureSession } from '../../lib/session'
import { useI18n } from '../../i18n'
import { Panel, Shell, Spinner } from '../../components/Shell'

/** /g/:token – berberin verdiği tek kullanımlık giriş linki. */
export default function LoginLink() {
  const { token = '' } = useParams()
  const { t } = useI18n()
  const nav = useNavigate()
  const [bad, setBad] = useState(false)
  useEffect(() => { void (async () => {
    try { await ensureSession(); const code = await consumeLoginLink(token); nav(`/k/${code}`, { replace: true }) }
    catch { setBad(true) }
  })() }, [token, nav])
  return <Shell>{bad ? <Panel><p role="alert">{t('linkInvalid')}</p></Panel> : <Spinner label={t('loading')} />}</Shell>
}
