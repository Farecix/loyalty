import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '../../i18n'
import { en } from '../../i18n/en'
import type { Card } from '../../lib/api'

const card: Card = {
  customer: { id: 'c1', name: 'Somchai', invite_code: 'abcd1234' }, shop: { name: 'Test Barber' },
  progress: 3, cycle_length: 10,
  rules: [{ threshold: 5, title_th: 'ล้างผมฟรี', title_en: 'Free hair wash' }, { threshold: 10, title_th: 'ตัดผมฟรี', title_en: 'Free haircut' }],
  available: [], last_stamp_at: null, next_allowed_at: null,
}
const api = vi.hoisted(() => ({
  getMyCard: vi.fn(), claimStamp: vi.fn(), shopPublic: vi.fn(), registerCustomer: vi.fn(),
}))
const geo = vi.hoisted(() => ({ getPosition: vi.fn() }))
vi.mock('../../lib/api', async (orig) => ({ ...(await orig<object>()), ...api }))
vi.mock('../../lib/geo', () => geo)
vi.mock('../../lib/session', () => ({ ensureSession: vi.fn().mockResolvedValue(undefined) }))

import Stamp from './Stamp'

function renderStamp() {
  return render(
    <I18nProvider initial="en">
      <MemoryRouter initialEntries={['/s/CODE']}>
        <Routes><Route path="/s/:shopCode" element={<Stamp />} /></Routes>
      </MemoryRouter>
    </I18nProvider>)
}

beforeEach(() => { vi.clearAllMocks(); api.getMyCard.mockResolvedValue(card) })

describe('Stamp', () => {
  it('shows the location-required message and does not claim when location is denied', async () => {
    geo.getPosition.mockResolvedValue('denied')
    renderStamp()
    expect(await screen.findByText(en.locationRequired)).toBeInTheDocument()
    expect(api.claimStamp).not.toHaveBeenCalled()
  })
  it('shows the next allowed time on cooldown', async () => {
    geo.getPosition.mockResolvedValue({ lat: 1, lng: 2, accuracy: 10 })
    api.claimStamp.mockResolvedValue({ status: 'cooldown', next_allowed_at: '2026-11-26T08:00:00Z', card })
    renderStamp()
    expect(await screen.findByText(new RegExp(en.nextStampAt.split('{time}')[0]))).toBeInTheDocument()
  })
  it('shows +1 and the new reward on success', async () => {
    geo.getPosition.mockResolvedValue({ lat: 1, lng: 2, accuracy: 10 })
    api.claimStamp.mockResolvedValue({ status: 'ok', new_grants: [{ id: 'g1', title_th: 'ล้างผมฟรี', title_en: 'Free hair wash' }], card: { ...card, progress: 5 } })
    renderStamp()
    expect(await screen.findByText('+1')).toBeInTheDocument()
    expect(await screen.findByText(/Free hair wash/)).toBeInTheDocument()
    expect(api.claimStamp).toHaveBeenCalledWith('CODE', { lat: 1, lng: 2, accuracy: 10 })
  })
  it('shows the signup form when not registered', async () => {
    api.getMyCard.mockResolvedValue(null)
    api.shopPublic.mockResolvedValue({ name: 'Test Barber' })
    renderStamp()
    expect(await screen.findByLabelText(en.phone)).toBeInTheDocument()
    expect(api.claimStamp).not.toHaveBeenCalled()
  })
})

describe('Stamp errors', () => {
  it('a network error on the claim right after signup shows an error instead of spinning forever', async () => {
    api.getMyCard.mockResolvedValue(null)
    api.shopPublic.mockResolvedValue({ name: 'Test Barber' })
    api.registerCustomer.mockResolvedValue('c1')
    geo.getPosition.mockResolvedValue({ lat: 1, lng: 2, accuracy: 10 })
    api.claimStamp.mockRejectedValue(new Error('network'))
    renderStamp()
    fireEvent.change(await screen.findByLabelText(en.name), { target: { value: 'Somchai' } })
    fireEvent.change(screen.getByLabelText(en.phone), { target: { value: '0811111111' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: en.createCard }))
    expect(await screen.findByText(en.error)).toBeInTheDocument()
  })
})
