export type Position = { lat: number; lng: number; accuracy: number }

/** Konumu bir kez ister. İzin reddi → 'denied'; zaman aşımı / desteklenmiyor → 'unavailable'. */
export function getPosition(timeoutMs = 15000): Promise<Position | 'denied' | 'unavailable'> {
  return new Promise((resolve) => {
    const g = typeof navigator !== 'undefined' ? navigator.geolocation : undefined
    if (!g) return resolve('unavailable')
    g.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => resolve(e.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    )
  })
}
