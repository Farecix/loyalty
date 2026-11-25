import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { Button } from './Shell'

type NdefRecord = { recordType: string; data?: DataView | ArrayBufferView | ArrayBuffer }
type NdefReader = { scan: () => Promise<void>; onreading: ((e: { message: { records: NdefRecord[] } }) => void) | null; onreadingerror: (() => void) | null }

function recordUrl(r: NdefRecord): string | null {
  if (!r.data || (r.recordType !== 'url' && r.recordType !== 'absolute-url')) return null
  const d = r.data as ArrayBufferView
  return new TextDecoder().decode(d.buffer ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : new Uint8Array(r.data as ArrayBuffer))
}

/** "Puan al": Android'de Web NFC ile dükkân kartını okur; iPhone'da karta dokunmayı anlatır. Puanı yalnız /s/<kod> sayfası verir. */
export function CollectStamp({ shopCode }: { shopCode: string }) {
  const { t } = useI18n()
  const nav = useNavigate()
  const [mode, setMode] = useState<'idle' | 'hint' | 'scanning' | 'wrong' | 'error'>('idle')

  async function start() {
    const Ctor = (window as unknown as { NDEFReader?: new () => NdefReader }).NDEFReader
    if (!Ctor) return setMode('hint')
    try {
      const reader = new Ctor()
      reader.onreading = (e) => {
        const url = e.message.records.map(recordUrl).find((u) => u && /\/s\/[^/?#]+/.test(u))
        const code = url?.match(/\/s\/([^/?#]+)/)?.[1]
        if (code === shopCode) nav(`/s/${code}`)
        else setMode('wrong')
      }
      reader.onreadingerror = () => setMode('error')
      await reader.scan()
      setMode('scanning')
    } catch { setMode('hint') }
  }

  return (
    <div className="text-center">
      <Button onClick={() => void start()} className="w-full py-4 text-xl"><span aria-hidden>📲 </span>{t('getStamp')}</Button>
      {mode === 'hint' && <p className="mt-3 text-sm text-stone-600">{t('nfcTapHint')}</p>}
      {mode === 'scanning' && <p className="mt-3 animate-pulse text-sm font-semibold text-brand">{t('nfcScanning')}</p>}
      {mode === 'wrong' && <p role="alert" className="mt-3 text-sm text-red-700">{t('nfcWrongTag')}</p>}
      {mode === 'error' && <p role="alert" className="mt-3 text-sm text-red-700">{t('nfcError')}</p>}
    </div>
  )
}
