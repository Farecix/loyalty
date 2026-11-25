import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { freshDb, uid, type Db } from './harness'
import { seedShop, seedCustomer, SHOP_LAT, SHOP_LNG } from './fixtures'

let db: Db
beforeAll(async () => { db = await freshDb() })
afterAll(async () => { await db.close() })

const claim = (user: string, code: string) =>
  db.asUser(user, q => q('select claim_stamp($1,$2,$3,10) as r', [code, SHOP_LAT, SHOP_LNG])).then(r => r.rows[0].r)
const age = (cid: string) => db.q(`update stamps set created_at = created_at - interval '1 day' where customer_id=$1;
  `, [cid]).then(() => db.q(`update customers set cycle_reset_at = cycle_reset_at - interval '1 day' where id=$1 and cycle_reset_at > '-infinity'`, [cid]))
async function claimN(user: string, cid: string, code: string, n: number) { let r; for (let i = 0; i < n; i++) { await age(cid); r = await claim(user, code) } return r }
const progress = async (cid: string) => (await db.q('select customer_progress($1) p', [cid])).rows[0].p
const grants = (cid: string) => db.q('select id, title_th, redeemed_at, voided_at from reward_grants where customer_id=$1 order by created_at', [cid]).then(r => r.rows)
const stampIds = (cid: string) => db.q('select id from stamps where customer_id=$1 order by created_at', [cid]).then(r => r.rows.map(x => x.id))
const asStaff = (staff: string, sql: string, p: unknown[]) => db.asUser(staff, q => q(sql, p))

describe('redeem_grant', () => {
  it('the owner redeems once; a second time → GRANT_NOT_AVAILABLE', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    const r = await claimN(c.user, c.customerId, cardCode, 5)
    const gid = r.new_grants[0].id
    await db.asUser(c.user, q => q('select redeem_grant($1)', [gid]))
    expect((await grants(c.customerId))[0].redeemed_at).not.toBeNull()
    await expect(db.asUser(c.user, q => q('select redeem_grant($1)', [gid]))).rejects.toThrow('GRANT_NOT_AVAILABLE')
  })
  it('another customer cannot redeem it', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId), other = await seedCustomer(db, shopId)
    const r = await claimN(c.user, c.customerId, cardCode, 5)
    await expect(db.asUser(other.user, q => q('select redeem_grant($1)', [r.new_grants[0].id]))).rejects.toThrow('GRANT_NOT_AVAILABLE')
  })
})

describe('cancel_stamp', () => {
  it('non-staff → NOT_STAFF', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    await claim(c.user, cardCode)
    const [sid] = await stampIds(c.customerId)
    await expect(db.asUser(c.user, q => q('select cancel_stamp($1)', [sid]))).rejects.toThrow('NOT_STAFF')
  })
  it('staff of another shop → NOT_STAFF', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const other = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    await claim(c.user, cardCode)
    const [sid] = await stampIds(c.customerId)
    await expect(asStaff(other.staff, 'select cancel_stamp($1)', [sid])).rejects.toThrow('NOT_STAFF')
  })
  it('cancelling the 5th stamp voids the unused wash and lowers progress', async () => {
    const { shopId, cardCode, staff } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    await claimN(c.user, c.customerId, cardCode, 5)
    const ids = await stampIds(c.customerId)
    await asStaff(staff, 'select cancel_stamp($1)', [ids[4]])
    expect(await progress(c.customerId)).toBe(4)
    expect((await grants(c.customerId))[0].voided_at).not.toBeNull()
  })
  it('a redeemed grant is left untouched when its stamp is cancelled', async () => {
    const { shopId, cardCode, staff } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    const r = await claimN(c.user, c.customerId, cardCode, 5)
    await db.asUser(c.user, q => q('select redeem_grant($1)', [r.new_grants[0].id]))
    const ids = await stampIds(c.customerId)
    await asStaff(staff, 'select cancel_stamp($1)', [ids[4]])
    const g = (await grants(c.customerId))[0]
    expect(g.redeemed_at).not.toBeNull()
    expect(g.voided_at).toBeNull()
  })
  it('cancelling the stamp that reset the cycle brings progress back to 9', async () => {
    const { shopId, cardCode, staff } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    await claimN(c.user, c.customerId, cardCode, 10)
    expect(await progress(c.customerId)).toBe(0)
    const ids = await stampIds(c.customerId)
    await asStaff(staff, 'select cancel_stamp($1)', [ids[9]])
    expect(await progress(c.customerId)).toBe(9)
  })
  it('cancelling the invitee\'s first stamp also cancels the inviter\'s referral stamp', async () => {
    const { shopId, cardCode, staff } = await seedShop(db)
    const a = await seedCustomer(db, shopId)
    const b = await seedCustomer(db, shopId, { referredBy: a.customerId })
    await claim(b.user, cardCode)
    expect(await progress(a.customerId)).toBe(1)
    const [sid] = await stampIds(b.customerId)
    await asStaff(staff, 'select cancel_stamp($1)', [sid])
    expect(await progress(a.customerId)).toBe(0)
  })
  it('cancelling twice is harmless', async () => {
    const { shopId, cardCode, staff } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    await claim(c.user, cardCode)
    const [sid] = await stampIds(c.customerId)
    await asStaff(staff, 'select cancel_stamp($1)', [sid])
    await asStaff(staff, 'select cancel_stamp($1)', [sid])
    expect(await progress(c.customerId)).toBe(0)
  })
  it('after a cancel the customer may claim again (cooldown follows active stamps)', async () => {
    const { shopId, cardCode, staff } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    await claim(c.user, cardCode)
    const [sid] = await stampIds(c.customerId)
    await asStaff(staff, 'select cancel_stamp($1)', [sid])
    expect((await claim(c.user, cardCode)).status).toBe('ok')
  })
})

describe('undo_redemption', () => {
  it('staff can undo; the grant becomes available again', async () => {
    const { shopId, cardCode, staff } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    const r = await claimN(c.user, c.customerId, cardCode, 5)
    const gid = r.new_grants[0].id
    await db.asUser(c.user, q => q('select redeem_grant($1)', [gid]))
    await asStaff(staff, 'select undo_redemption($1)', [gid])
    expect((await grants(c.customerId))[0].redeemed_at).toBeNull()
  })
  it('a customer cannot undo → NOT_STAFF', async () => {
    const { shopId, cardCode } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    const r = await claimN(c.user, c.customerId, cardCode, 5)
    await expect(db.asUser(c.user, q => q('select undo_redemption($1)', [r.new_grants[0].id]))).rejects.toThrow('NOT_STAFF')
  })
})

describe('login links', () => {
  it('staff creates a link; a new device consumes it once and owns the card', async () => {
    const { shopId, cardCode, staff } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    const token = (await asStaff(staff, 'select create_login_link($1) t', [c.customerId])).rows[0].t
    const device = uid()
    const r = await db.asUser(device, q => q('select consume_login_link($1) as code', [token]))
    expect(r.rows[0].code).toBe(cardCode)
    const card = (await db.asUser(device, q => q('select get_my_card($1) c', [cardCode]))).rows[0].c
    expect(card.customer.id).toBe(c.customerId)
    await expect(db.asUser(uid(), q => q('select consume_login_link($1)', [token]))).rejects.toThrow('LINK_INVALID')
  })
  it('an expired link → LINK_INVALID', async () => {
    const { shopId, staff } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    const token = (await asStaff(staff, 'select create_login_link($1) t', [c.customerId])).rows[0].t
    await db.q(`update login_links set expires_at = now() - interval '1 minute' where token=$1`, [token])
    await expect(db.asUser(uid(), q => q('select consume_login_link($1)', [token]))).rejects.toThrow('LINK_INVALID')
  })
  it('a customer cannot create links → NOT_STAFF', async () => {
    const { shopId } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    await expect(db.asUser(c.user, q => q('select create_login_link($1)', [c.customerId]))).rejects.toThrow('NOT_STAFF')
  })
})

describe('create_shop', () => {
  it('makes the caller staff and seeds the two default rewards', async () => {
    const u = uid()
    const id = (await db.asUser(u, q => q(`select create_shop('My Barber') id`))).rows[0].id
    const rules = (await db.q('select threshold, title_th, title_en from reward_rules where shop_id=$1 order by threshold', [id])).rows
    expect(rules).toEqual([
      { threshold: 5, title_th: 'ล้างผมฟรี', title_en: 'Free hair wash' },
      { threshold: 10, title_th: 'ตัดผมฟรี', title_en: 'Free haircut' },
    ])
    const mine = (await db.asUser(u, q => q('select my_shop() s'))).rows[0].s
    expect(mine.id).toBe(id)
    expect(mine.card_code).toMatch(/^[a-z0-9]{16}$/)
  })
  it('a second create_shop by the same user returns the existing shop', async () => {
    const u = uid()
    const a = (await db.asUser(u, q => q(`select create_shop('A') id`))).rows[0].id
    const b = (await db.asUser(u, q => q(`select create_shop('B') id`))).rows[0].id
    expect(b).toBe(a)
  })
})

describe('regenerate_card_code', () => {
  it('gives a new code and the old one stops working', async () => {
    const { shopId, cardCode, staff } = await seedShop(db)
    const c = await seedCustomer(db, shopId)
    const fresh = (await asStaff(staff, 'select regenerate_card_code() c', [])).rows[0].c
    expect(fresh).not.toBe(cardCode)
    await expect(claim(c.user, cardCode)).rejects.toThrow('SHOP_NOT_FOUND')
    expect((await claim(c.user, fresh)).status).toBe('ok')
  })
})

describe('shop_feed', () => {
  it('staff sees stamps and redemptions newest first; customers see nothing', async () => {
    const { shopId, cardCode, staff } = await seedShop(db)
    const c = await seedCustomer(db, shopId, { name: 'Malee' })
    const r = await claimN(c.user, c.customerId, cardCode, 5)
    await db.asUser(c.user, q => q('select redeem_grant($1)', [r.new_grants[0].id]))
    const feed = (await asStaff(staff, 'select * from shop_feed()', [])).rows
    expect(feed[0]).toMatchObject({ kind: 'redeem', customer_name: 'Malee', title_th: 'ล้างผมฟรี', cancelled: false })
    expect(feed.filter(f => f.kind === 'stamp')).toHaveLength(5)
    expect((await db.asUser(c.user, q => q('select * from shop_feed()'))).rows).toEqual([])
  })
})

describe('shop_customers', () => {
  it('lists customers with progress, searchable by name or phone; customers get NOT_STAFF', async () => {
    const { shopId, cardCode, staff } = await seedShop(db)
    const a = await seedCustomer(db, shopId, { name: 'Anan' })
    await seedCustomer(db, shopId, { name: 'Busaba' })
    await claimN(a.user, a.customerId, cardCode, 3)
    const all = (await asStaff(staff, 'select * from shop_customers(null)', [])).rows
    expect(all).toHaveLength(2)
    const found = (await asStaff(staff, 'select * from shop_customers($1)', ['ana'])).rows
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ name: 'Anan', progress: 3, available: 0 })
    const byPhone = (await asStaff(staff, 'select * from shop_customers($1)', [a.phone.slice(-4)])).rows
    expect(byPhone.map(r => r.name)).toContain('Anan')
    await expect(db.asUser(a.user, q => q('select * from shop_customers(null)'))).rejects.toThrow('NOT_STAFF')
  })
})
