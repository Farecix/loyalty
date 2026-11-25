import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { freshDb, uid, type Db } from './harness'
import { seedShop, seedCustomer } from './fixtures'

let db: Db
beforeAll(async () => { db = await freshDb() })
afterAll(async () => { await db.close() })

const login = (user: string, code: string, phone: string) =>
  db.asUser(user, q => q('select login_by_phone($1,$2) r', [code, phone])).then(r => r.rows[0].r)
const card = (user: string, code: string) =>
  db.asUser(user, q => q('select get_my_card($1) c', [code])).then(r => r.rows[0].c)

describe('login_by_phone', () => {
  it('a registered phone (any format) logs this browser into the card, from anywhere', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId, { name: 'Malee' })
    const nb = uid()
    expect(await login(nb, cardCode, '+66 ' + c.phone.slice(2))).toBe('ok')
    expect((await card(nb, cardCode)).customer.name).toBe('Malee')
  })
  it('works for a shop that has no location set', async () => {
    const { shopId, cardCode } = await seedShop(db, { lat: null, lng: null })
    const c = await seedCustomer(db, shopId)
    expect(await login(uid(), cardCode, '0' + c.phone.slice(2))).toBe('ok')
  })
  it('an unknown phone → not_found', async () => {
    const { cardCode } = await seedShop(db)
    expect(await login(uid(), cardCode, '0890000777')).toBe('not_found')
  })
  it('a phone from another shop is not found here', async () => {
    const s1 = await seedShop(db), s2 = await seedShop(db)
    const c = await seedCustomer(db, s1.shopId)
    expect(await login(uid(), s2.cardCode, c.phone)).toBe('not_found')
  })
  it('anon (no session) cannot log in', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    await expect(db.asUser(null, q => q('select login_by_phone($1,$2)', [cardCode, c.phone]))).rejects.toThrow(/NOT_AUTHENTICATED|permission denied/)
  })
})
