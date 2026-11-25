import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { freshDb, uid, type Db } from './harness'
import { seedShop, seedCustomer, SHOP_LAT, SHOP_LNG } from './fixtures'

let db: Db
beforeAll(async () => { db = await freshDb() })
afterAll(async () => { await db.close() })

const reclaim = (user: string, code: string, phone: string, lat = SHOP_LAT, lng = SHOP_LNG) =>
  db.asUser(user, q => q('select reclaim_card($1,$2,$3,$4,10) r', [code, phone, lat, lng])).then(r => r.rows[0].r)
const card = (user: string, code: string) =>
  db.asUser(user, q => q('select get_my_card($1) c', [code])).then(r => r.rows[0].c)

describe('reclaim_card (same customer, new browser, at the shop)', () => {
  it('at the shop with a registered phone (any format) → this browser now owns the card', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId, { name: 'Malee' })
    const newBrowser = uid()
    const local = '0' + c.phone.slice(2)
    expect(await reclaim(newBrowser, cardCode, local)).toBe('ok')
    expect((await card(newBrowser, cardCode)).customer.id).toBe(c.customerId)
    expect(await card(c.user, cardCode)).toBeNull()
  })

  it('far from the shop → too_far, nothing changes', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    const other = uid()
    expect(await reclaim(other, cardCode, c.phone, SHOP_LAT + 0.05, SHOP_LNG)).toBe('too_far')
    expect(await card(other, cardCode)).toBeNull()
    expect((await card(c.user, cardCode)).customer.id).toBe(c.customerId)
  })

  it('a shop without a location refuses reclaim (location_not_set)', async () => {
    const { shopId, cardCode } = await seedShop(db, { lat: null, lng: null })
    const c = await seedCustomer(db, shopId)
    expect(await reclaim(uid(), cardCode, c.phone)).toBe('location_not_set')
  })

  it('an unknown phone → not_found', async () => {
    const { cardCode } = await seedShop(db)
    expect(await reclaim(uid(), cardCode, '0890000123')).toBe('not_found')
  })

  it('stamps keep their owner: after reclaim the cooldown still applies to the same card', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    await db.asUser(c.user, q => q('select claim_stamp($1,$2,$3,10)', [cardCode, SHOP_LAT, SHOP_LNG]))
    const nb = uid()
    await reclaim(nb, cardCode, c.phone)
    const r = (await db.asUser(nb, q => q('select claim_stamp($1,$2,$3,10) r', [cardCode, SHOP_LAT, SHOP_LNG]))).rows[0].r
    expect(r.status).toBe('cooldown')
    expect(r.card.progress).toBe(1)
  })
})
