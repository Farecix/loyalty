import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { freshDb, type Db } from './harness'
import { seedShop, seedCustomer, SHOP_LAT, SHOP_LNG } from './fixtures'

let db: Db
beforeAll(async () => { db = await freshDb() })
afterAll(async () => { await db.close() })

const claim = (user: string, code: string) =>
  db.asUser(user, q => q('select claim_stamp($1,$2,$3,10) as r', [code, SHOP_LAT, SHOP_LNG])).then(r => r.rows[0].r)
const progress = async (cid: string) => (await db.q('select customer_progress($1) p', [cid])).rows[0].p

describe('review fixes', () => {
  it('referral credits are capped at one per cooldown window per referrer', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const a = await seedCustomer(db, shopId)
    const b = await seedCustomer(db, shopId, { referredBy: a.customerId })
    const c = await seedCustomer(db, shopId, { referredBy: a.customerId })
    await claim(b.user, cardCode)
    await claim(c.user, cardCode)
    expect(await progress(a.customerId)).toBe(1)
  })

  it('a referral after the cooldown window is credited again', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const a = await seedCustomer(db, shopId)
    const b = await seedCustomer(db, shopId, { referredBy: a.customerId })
    await claim(b.user, cardCode)
    await db.q(`update stamps set created_at = now() - interval '21 hours' where customer_id = $1`, [a.customerId])
    const c = await seedCustomer(db, shopId, { referredBy: a.customerId })
    await claim(c.user, cardCode)
    expect(await progress(a.customerId)).toBe(2)
  })

  it('staff phone search accepts local formats (081-…, 0812…)', async () => {
    const { shopId, staff } = await seedShop(db)
    const a = await seedCustomer(db, shopId, { name: 'Dao' }) // phone 66 8100000xx
    const local = '0' + a.phone.slice(2)                     // 08100000xx
    const dashed = local.slice(0, 3) + '-' + local.slice(3, 6) + '-' + local.slice(6)
    for (const q of [local, dashed, '+' + a.phone]) {
      const rows = (await db.asUser(staff, x => x('select name from shop_customers($1)', [q]))).rows
      expect(rows.map(r => r.name), q).toContain('Dao')
    }
  })

  it('shop_feed marks a redemption whose stamp was cancelled', async () => {
    const { shopId, cardCode, staff } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    let r
    for (let i = 0; i < 5; i++) {
      await db.q(`update stamps set created_at = created_at - interval '1 day' where customer_id=$1`, [c.customerId])
      r = await claim(c.user, cardCode)
    }
    await db.asUser(c.user, q => q('select redeem_grant($1)', [r.new_grants[0].id]))
    const stampId = (await db.q('select stamp_id from reward_grants where id=$1', [r.new_grants[0].id])).rows[0].stamp_id
    await db.asUser(staff, q => q('select cancel_stamp($1)', [stampId]))
    const feed = (await db.asUser(staff, q => q('select * from shop_feed()'))).rows
    expect(feed.find(f => f.kind === 'redeem')).toMatchObject({ stamp_cancelled: true })
  })
})
