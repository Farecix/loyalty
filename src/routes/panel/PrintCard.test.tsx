import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../../i18n'
import { th } from '../../i18n/th'
import { en } from '../../i18n/en'
import PrintCard from './PrintCard'

const shop = { id: 's', name: 'Bangkok Barber', card_code: 'abc123', lat: 1, lng: 1, radius_m: 100, cooldown_hours: 20, logo_url: null, location_check: false }

describe('PrintCard', () => {
  it('is NFC-only: no QR code, a bilingual "tap your phone" card, and the NFC URL', () => {
    render(<I18nProvider initial="en"><PrintCard shop={shop} onChanged={() => {}} /></I18nProvider>)
    expect(screen.queryByAltText('QR')).toBeNull()
    expect(screen.getByText(th.tapToCollect)).toBeInTheDocument()
    expect(screen.getByText(en.tapToCollect)).toBeInTheDocument()
    expect(screen.getByText(/\/s\/abc123$/)).toBeInTheDocument()
  })
})
