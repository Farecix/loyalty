import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { CollectStamp } from './CollectStamp'

function renderIt() {
  return render(
    <I18nProvider initial="en">
      <MemoryRouter initialEntries={['/k/CODE']}>
        <Routes>
          <Route path="/k/:shopCode" element={<CollectStamp shopCode="CODE" />} />
          <Route path="/s/:shopCode" element={<p>STAMP PAGE</p>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>)
}

type Reader = { scan: ReturnType<typeof vi.fn>; onreading: ((e: unknown) => void) | null; onreadingerror: (() => void) | null }
let reader: Reader
function mockWebNfc() {
  reader = { scan: vi.fn().mockResolvedValue(undefined), onreading: null, onreadingerror: null }
  ;(window as unknown as { NDEFReader: unknown }).NDEFReader = vi.fn(() => reader)
}
const urlRecord = (url: string) => ({ message: { records: [{ recordType: 'url', data: new TextEncoder().encode(url) }] } })
afterEach(() => { delete (window as unknown as { NDEFReader?: unknown }).NDEFReader })

describe('CollectStamp', () => {
  it('shows a "Get a stamp" button', () => {
    renderIt()
    expect(screen.getByRole('button', { name: en.getStamp })).toBeInTheDocument()
  })
  it('without Web NFC (iPhone) the button shows how to tap the shop card', () => {
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: en.getStamp }))
    expect(screen.getByText(en.nfcTapHint)).toBeInTheDocument()
  })
  it("with Web NFC, reading the shop's tag opens the stamp page", async () => {
    mockWebNfc()
    renderIt()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.getStamp })) })
    expect(reader.scan).toHaveBeenCalled()
    expect(screen.getByText(en.nfcScanning)).toBeInTheDocument()
    await act(async () => { reader.onreading!(urlRecord('https://barber.example/s/CODE')) })
    expect(await screen.findByText('STAMP PAGE')).toBeInTheDocument()
  })
  it("a tag from another shop is rejected", async () => {
    mockWebNfc()
    renderIt()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.getStamp })) })
    await act(async () => { reader.onreading!(urlRecord('https://barber.example/s/OTHER')) })
    expect(screen.getByText(en.nfcWrongTag)).toBeInTheDocument()
  })
})
