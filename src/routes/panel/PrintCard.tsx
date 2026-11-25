import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { regenerateCardCode, type Shop } from '../../lib/api'
import { publicBaseUrl } from '../../lib/supabase'
import { useI18n } from '../../i18n'
import { th } from '../../i18n/th'
import { en } from '../../i18n/en'
import { Button } from '../../components/Shell'

export default function PrintCard({ shop, onChanged }: { shop: Shop; onChanged: () => void }) {
  const { t } = useI18n()
  const url = `${publicBaseUrl}/s/${shop.card_code}`
  const [qr, setQr] = useState('')
  useEffect(() => { void QRCode.toDataURL(url, { margin: 1, width: 600, errorCorrectionLevel: 'M' }).then(setQr) }, [url])

  async function regen() {
    if (!window.confirm(t('confirmRegenerate'))) return
    await regenerateCardCode(); onChanged()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm print:hidden">
        <p className="font-semibold">{t('cardTitle')}</p>
        <p className="text-sm text-stone-500">{t('cardHint')}</p>
        <p className="mt-3 text-sm font-semibold">{t('nfcUrl')}</p>
        <code className="block break-all rounded-xl bg-stone-100 p-2 text-xs">{url}</code>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => window.print()}>{t('print')}</Button>
          <Button variant="ghost" onClick={() => void navigator.clipboard?.writeText(url)}>{t('copy')}</Button>
          <Button variant="danger" onClick={() => void regen()}>{t('regenerate')}</Button>
        </div>
      </div>

      {/* 85×55 mm basılabilir kart (iki dilli) */}
      <div className="flex justify-center">
        <div id="print-card" className="flex h-[55mm] w-[85mm] items-center gap-[4mm] overflow-hidden rounded-[3mm] bg-ink p-[4mm] text-white shadow-xl print:shadow-none">
          <div className="flex h-full flex-1 flex-col justify-between">
            <div className="flex items-center gap-[2mm]">
              {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-[9mm] w-[9mm] rounded-full object-cover" />
                : <span className="h-[8mm] w-[2.5mm] rounded-full bg-[repeating-linear-gradient(135deg,#dc2626_0_2mm,#fff_2mm_4mm,#1d4ed8_4mm_6mm,#fff_6mm_8mm)]" />}
              <span className="text-[4mm] font-extrabold leading-tight">{shop.name}</span>
            </div>
            <div>
              <p className="text-[3.6mm] font-bold leading-tight">{th.scanToCollect}</p>
              <p className="text-[2.8mm] leading-tight opacity-80">{en.scanToCollect}</p>
              <p className="mt-[1.5mm] text-[2.4mm] opacity-60">📱 QR · NFC</p>
            </div>
          </div>
          {qr && <img src={qr} alt="QR" className="h-[45mm] w-[45mm] rounded-[2mm] bg-white p-[1.5mm]" />}
        </div>
      </div>
    </div>
  )
}
