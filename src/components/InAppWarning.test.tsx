import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { InAppWarning, isInAppBrowser } from './InAppWarning'

describe('InAppWarning', () => {
  it('detects the LINE in-app browser', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone) AppleWebKit Mobile Line/13.20.0')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (iPhone) Version/17.0 Mobile Safari/604.1')).toBe(false)
  })
  it('shows a warning inside LINE', () => {
    render(<I18nProvider initial="en"><InAppWarning ua="Mozilla/5.0 Line/13.20.0" /></I18nProvider>)
    expect(screen.getByRole('alert')).toHaveTextContent(en.openInBrowser)
  })
})
