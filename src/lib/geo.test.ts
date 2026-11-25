import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPosition } from './geo'

function mockGeo(impl: (ok: PositionCallback, err: PositionErrorCallback) => void) {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: vi.fn(impl) } })
}
afterEach(() => { Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined }) })

describe('getPosition', () => {
  it('returns coordinates and accuracy', async () => {
    mockGeo(ok => ok({ coords: { latitude: 13.7, longitude: 100.5, accuracy: 25 } } as GeolocationPosition))
    expect(await getPosition()).toEqual({ lat: 13.7, lng: 100.5, accuracy: 25 })
  })
  it("returns 'denied' when permission is refused", async () => {
    mockGeo((_ok, err) => err({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError))
    expect(await getPosition()).toBe('denied')
  })
  it("returns 'unavailable' on timeout or other errors", async () => {
    mockGeo((_ok, err) => err({ code: 3, PERMISSION_DENIED: 1 } as GeolocationPositionError))
    expect(await getPosition()).toBe('unavailable')
  })
  it("returns 'unavailable' when the browser has no geolocation", async () => {
    expect(await getPosition()).toBe('unavailable')
  })
})
