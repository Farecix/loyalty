import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { freshDb, uid, type Db } from './harness'
import { seedShop, seedCustomer, SHOP_LAT, SHOP_LNG } from './fixtures'

let db: Db
beforeAll(async () => { db = await freshDb() })
afterAll(async () => { await db.close() })

const AT_SHOP = { lat: SHOP_LAT, lng: SHOP_LNG, acc: 20 }
const claim = (user: string, code: string, p = AT_SHOP) =>
  db.asUser(user, q => q('select claim_stamp($1,$2,$3,$4) as r', [code, p.lat, p.lng, p.acc])).then(r => r.rows[0].r)
/** Bekleme süresini atlatmak için müşterinin tüm puanlarını 1 gün geriye çeker. */
const ageStamps = (customerId: string) =>
  db.q(`update stamps set created_at = created_at - interval '1 day' where customer_id = $1`, [customerId])
    .then(() => db.q(`update customers set cycle_reset_at = cycle_reset_at - interval '1 day' where id = $1 and cycle_reset_at > '-infinity'`, [customerId]))
async function claimN(user: string, customerId: string, code: string, n: number) {
  let r
  for (let i = 0; i < n; i++) { await ageStamps(customerId); r = await claim(user, code) }
  return r
}
/** Bir noktadan kuzeye d metre. */
const north = (m: number) => SHOP_LAT + m / 111_320

describe('claim_stamp', () => {
  it('first claim → ok, progress 1', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    const r = await claim(c.user, cardCode)
    expect(r.status).toBe('ok')
    expect(r.card.progress).toBe(1)
    expect(r.new_grants).toEqual([])
  })

  it('not registered → not_registered', async () => {
    const { cardCode } = await seedShop(db)
    expect((await claim(uid(), cardCode)).status).toBe('not_registered')
  })

  it('5th stamp grants the wash, 10th the haircut, then progress resets to 0', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    const r5 = await claimN(c.user, c.customerId, cardCode, 5)
    expect(r5.new_grants.map((g: any) => g.title_th)).toEqual(['ล้างผมฟรี'])
    expect(r5.card.progress).toBe(5)
    const r10 = await claimN(c.user, c.customerId, cardCode, 5)
    expect(r10.new_grants.map((g: any) => g.title_th)).toEqual(['ตัดผมฟรี'])
    expect(r10.card.progress).toBe(0)
    expect(r10.card.available).toHaveLength(2)
    const r11 = await claimN(c.user, c.customerId, cardCode, 1)
    expect(r11.card.progress).toBe(1)
  })

  it('a second claim within 20 hours → cooldown, no extra stamp', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    await claim(c.user, cardCode)
    const r = await claim(c.user, cardCode)
    expect(r.status).toBe('cooldown')
    expect(new Date(r.next_allowed_at).getTime()).toBeGreaterThan(Date.now() + 19 * 3600_000)
    expect(r.card.progress).toBe(1)
  })

  it('after the cooldown passes → ok', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    await claim(c.user, cardCode)
    await db.q(`update stamps set created_at = now() - interval '20 hours 1 minute' where customer_id = $1`, [c.customerId])
    expect((await claim(c.user, cardCode)).status).toBe('ok')
  })

  it('500 m away with 50 m accuracy → too_far', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    const r = await claim(c.user, cardCode, { lat: north(500), lng: SHOP_LNG, acc: 50 })
    expect(r.status).toBe('too_far')
    expect(r.card.progress).toBe(0)
  })

  it('150 m away with 80 m accuracy → ok (circles overlap)', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    expect((await claim(c.user, cardCode, { lat: north(150), lng: SHOP_LNG, acc: 80 })).status).toBe('ok')
  })

  it('accuracy is capped at 1000 m: 3 km away with 5000 m accuracy → too_far', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    expect((await claim(c.user, cardCode, { lat: north(3000), lng: SHOP_LNG, acc: 5000 })).status).toBe('too_far')
  })

  it('a null location → too_far when the shop has a location', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    const r = await db.asUser(c.user, q => q('select claim_stamp($1,null,null,null) as r', [cardCode])).then(r => r.rows[0].r)
    expect(r.status).toBe('too_far')
  })

  it('a shop with no location skips the location check', async () => {
    const { shopId, cardCode } = await seedShop(db, { lat: null, lng: null })
    const c = await seedCustomer(db, shopId)
    expect((await claim(c.user, cardCode, { lat: 0, lng: 0, acc: 10 })).status).toBe('ok')
  })

  it('referral: the invitee\'s first stamp gives the inviter +1, the second gives nothing', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const a = await seedCustomer(db, shopId)
    const b = await seedCustomer(db, shopId, { referredBy: a.customerId })
    await claim(b.user, cardCode)
    const prog = async () => (await db.q('select customer_progress($1) p', [a.customerId])).rows[0].p
    expect(await prog()).toBe(1)
    await claimN(b.user, b.customerId, cardCode, 1)
    expect(await prog()).toBe(1)
    const src = (await db.q('select source from stamps where customer_id=$1', [a.customerId])).rows
    expect(src).toEqual([{ source: 'referral' }])
  })

  it('a referral stamp does not start the inviter\'s cooldown', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const a = await seedCustomer(db, shopId)
    const b = await seedCustomer(db, shopId, { referredBy: a.customerId })
    await claim(b.user, cardCode)
    expect((await claim(a.user, cardCode)).status).toBe('ok')
  })

  it('a referral can trigger a reward for the inviter', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const a = await seedCustomer(db, shopId)
    await claimN(a.user, a.customerId, cardCode, 4)
    const b = await seedCustomer(db, shopId, { referredBy: a.customerId })
    await claim(b.user, cardCode)
    const g = (await db.q('select title_th from reward_grants where customer_id=$1', [a.customerId])).rows
    expect(g).toEqual([{ title_th: 'ล้างผมฟรี' }])
  })

  it('two concurrent claims write only one stamp', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    const conns = await Promise.all([db.connect(), db.connect()])
    const run = async (cl: any) => {
      await cl.query('begin'); await cl.query('set local role authenticated')
      await cl.query(`select set_config('request.jwt.claim.sub',$1,true)`, [c.user])
      const r = await cl.query('select claim_stamp($1,$2,$3,$4) r', [cardCode, SHOP_LAT, SHOP_LNG, 10])
      await cl.query('commit'); return r.rows[0].r.status
    }
    const statuses = await Promise.all(conns.map(run))
    await Promise.all(conns.map(c => c.end()))
    expect(statuses.sort()).toEqual(['cooldown', 'ok'])
    expect((await db.q('select count(*)::int n from stamps where customer_id=$1', [c.customerId])).rows[0].n).toBe(1)
  })

  it('rules shrink mid-cycle (progress 8, max 10 → 5): the next stamp gives exactly one grant and resets', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    await claimN(c.user, c.customerId, cardCode, 8)
    await db.q(`update reward_rules set active = false where shop_id = $1 and threshold = 10`, [shopId])
    const r = await claimN(c.user, c.customerId, cardCode, 1)
    expect(r.status).toBe('ok')
    expect(r.new_grants.map((g: any) => g.title_th)).toEqual(['ล้างผมฟรี'])
    expect(r.card.progress).toBe(0)
    expect(r.card.cycle_length).toBe(5)
  })
})
