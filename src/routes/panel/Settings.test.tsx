import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '../../i18n'
import { en } from '../../i18n/en'

const api = vi.hoisted(() => ({ updateShop: vi.fn().mockResolvedValue(undefined), listRules: vi.fn().mockResolvedValue([]), addRule: vi.fn(), removeRule: vi.fn() }))
vi.mock('../../lib/api', async (orig) => ({ ...(await orig<object>()), ...api }))
import Settings from './Settings'

const shop = { id: 's1', name: 'TWOBOX', card_code: 'c', lat: null, lng: null, radius_m: 100, cooldown_hours: 20, logo_url: null, location_check: false }

describe('Settings – location check switch', () => {
  it('is off for a shop with the check off, and turning it on saves location_check: true', async () => {
    render(<I18nProvider initial="en"><Settings shop={shop} onSaved={() => {}} /></I18nProvider>)
    const sw = screen.getByRole('checkbox', { name: en.locationCheck })
    expect(sw).not.toBeChecked()
    fireEvent.click(sw)
    await waitFor(() => expect(api.updateShop).toHaveBeenCalledWith('s1', { location_check: true }))
  })
})
