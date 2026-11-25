import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { I18nProvider } from '../../i18n'
import { en } from '../../i18n/en'
import type { FeedItem } from '../../lib/api'
import { FeedList } from './Feed'

const items: FeedItem[] = [
  { kind: 'stamp', id: 's1', customer_id: 'c1', customer_name: 'Anan', title_th: null, title_en: null, source: 'card', at: '2026-11-25T07:32:00Z', cancelled: false },
  { kind: 'stamp', id: 's2', customer_id: 'c2', customer_name: 'Busaba', title_th: null, title_en: null, source: 'card', at: '2026-11-25T07:00:00Z', cancelled: true },
  { kind: 'redeem', id: 'g1', customer_id: 'c3', customer_name: 'Chai', title_th: 'ล้างผมฟรี', title_en: 'Free hair wash', source: null, at: '2026-11-25T06:00:00Z', cancelled: false },
]
const renderFeed = (onCancel = vi.fn(), onUndo = vi.fn()) => {
  render(<I18nProvider initial="en"><FeedList items={items} onCancel={onCancel} onUndo={onUndo} /></I18nProvider>)
  return { onCancel, onUndo }
}

describe('FeedList', () => {
  it('a cancelled stamp is struck through and has no Cancel button', () => {
    renderFeed()
    const row = screen.getByText('Busaba').closest('li')!
    expect(row).toHaveClass('line-through')
    expect(within(row).queryByRole('button', { name: en.cancelStamp })).toBeNull()
    expect(within(row).getByText(en.cancelled)).toBeInTheDocument()
  })
  it('pressing Cancel (and confirming) calls onCancel with the stamp id', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { onCancel } = renderFeed()
    const row = screen.getByText('Anan').closest('li')!
    fireEvent.click(within(row).getByRole('button', { name: en.cancelStamp }))
    expect(onCancel).toHaveBeenCalledWith('s1')
  })
  it('declining the confirm does not cancel', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { onCancel } = renderFeed()
    fireEvent.click(within(screen.getByText('Anan').closest('li')!).getByRole('button', { name: en.cancelStamp }))
    expect(onCancel).not.toHaveBeenCalled()
  })
  it('a redemption shows the reward name and an Undo button', () => {
    const { onUndo } = renderFeed()
    const row = screen.getByText('Chai').closest('li')!
    expect(within(row).getByText(/Free hair wash/)).toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button', { name: en.undo }))
    expect(onUndo).toHaveBeenCalledWith('g1')
  })
})
