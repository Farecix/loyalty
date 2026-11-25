import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { freshDb, type Db } from './harness'
import { seedShop, seedCustomer, SHOP_LAT, SHOP_LNG } from './fixtures'

let db: Db
beforeAll(async () => { db = await freshDb() })
afterAll(async () => { await db.close() })

const claim = (user: string, code: string, lat: number | null, lng: number | null) =>
  db.asUser(user, q => q('select claim_stamp($1,$2,$3,10) r', [code, lat, lng])).then(r => r.rows[0].r)

describe('location check toggle', () => {
  it('new shops have the location check OFF by default', async () => {
    const r = (await db.q(`insert into shops(name) values ('X') returning location_check`)).rows[0]
    expect(r.location_check).toBe(false)
  })
  it('with the check OFF, a claim from 9 km away (or with no location) is ok', async () => {
    const { shopId, cardCode } = await seedShop(db, { locationCheck: false })
    const a = await seedCustomer(db, shopId), b = await seedCustomer(db, shopId)
    expect((await claim(a.user, cardCode, SHOP_LAT + 0.08, SHOP_LNG)).status).toBe('ok')
    expect((await claim(b.user, cardCode, null, null)).status).toBe('ok')
  })
  it('with the check OFF the cooldown still applies', async () => {
    const { shopId, cardCode } = await seedShop(db, { locationCheck: false })
    const a = await seedCustomer(db, shopId)
    await claim(a.user, cardCode, null, null)
    expect((await claim(a.user, cardCode, null, null)).status).toBe('cooldown')
  })
  it('with the check ON, 9 km away → too_far', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const a = await seedCustomer(db, shopId)
    expect((await claim(a.user, cardCode, SHOP_LAT + 0.08, SHOP_LNG)).status).toBe('too_far')
  })
  it('the card and the public shop info say whether location is checked', async () => {
    const { shopId, cardCode } = await seedShop(db, { locationCheck: false })
    const a = await seedCustomer(db, shopId)
    const card = (await db.asUser(a.user, q => q('select get_my_card($1) c', [cardCode]))).rows[0].c
    expect(card.shop.location_check).toBe(false)
    const pub = (await db.asUser(null, q => q('select shop_public($1) s', [cardCode]))).rows[0].s
    expect(pub.location_check).toBe(false)
  })
  it('staff can turn it on in settings', async () => {
    const { shopId, staff } = await seedShop(db, { locationCheck: false })
    await db.asUser(staff, q => q('update shops set location_check = true where id = $1', [shopId]))
    expect((await db.q('select location_check from shops where id=$1', [shopId])).rows[0].location_check).toBe(true)
  })
})
