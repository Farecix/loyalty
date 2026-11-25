import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../i18n'
import { en } from '../../i18n/en'
import { SetupWarning } from './SetupWarning'

const wrap = (lat: number | null) => render(
  <I18nProvider initial="en"><MemoryRouter><SetupWarning shop={{ lat, lng: lat }} /></MemoryRouter></I18nProvider>)

describe('SetupWarning', () => {
  it('warns that stamps work from anywhere until the location is set', () => {
    wrap(null)
    expect(screen.getByRole('alert')).toHaveTextContent(en.setupLocationWarning)
  })
  it('renders nothing once a location is set', () => {
    wrap(13.7)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('SetupWarning – check off', () => {
  it('shows nothing when the location check is turned off', () => {
    render(<I18nProvider initial="en"><MemoryRouter><SetupWarning shop={{ lat: null, lng: null, location_check: false }} /></MemoryRouter></I18nProvider>)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
