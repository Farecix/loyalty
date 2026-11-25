import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { freshDb, type Db } from './harness'
import { seedShop, seedCustomer } from './fixtures'

let db: Db
beforeAll(async () => { db = await freshDb() })
afterAll(async () => { await db.close() })

describe('schema + RLS', () => {
  it('a customer cannot see another customer\'s stamps', async () => {
    const { shopId } = await seedShop(db)
    const a = await seedCustomer(db, shopId), b = await seedCustomer(db, shopId)
    await db.q(`insert into stamps(shop_id, customer_id, source) values ($1,$2,'card'), ($1,$3,'card')`, [shopId, a.customerId, b.customerId])
    const rows = await db.asUser(a.user, q => q('select customer_id from stamps'))
    expect(rows.rows.map(r => r.customer_id)).toEqual([a.customerId])
  })

  it('staff sees all stamps of their shop', async () => {
    const { shopId, staff } = await seedShop(db)
    const a = await seedCustomer(db, shopId), b = await seedCustomer(db, shopId)
    await db.q(`insert into stamps(shop_id, customer_id, source) values ($1,$2,'card'), ($1,$3,'card')`, [shopId, a.customerId, b.customerId])
    const rows = await db.asUser(staff, q => q('select count(*)::int n from stamps'))
    expect(rows.rows[0].n).toBe(2)
  })

  it('a non-staff user cannot insert reward rules', async () => {
    const { shopId } = await seedShop(db)
    const a = await seedCustomer(db, shopId)
    await expect(db.asUser(a.user, q => q(`insert into reward_rules(shop_id, threshold, title_th) values ($1, 3, 'x')`, [shopId])))
      .rejects.toThrow(/row-level security/)
  })

  it('staff can update their own shop settings', async () => {
    const { shopId, staff } = await seedShop(db)
    await db.asUser(staff, q => q('update shops set radius_m = 150 where id = $1', [shopId]))
    expect((await db.q('select radius_m from shops where id=$1', [shopId])).rows[0].radius_m).toBe(150)
  })

  it('a customer cannot read shops (card_code is secret)', async () => {
    const { shopId } = await seedShop(db)
    const a = await seedCustomer(db, shopId)
    const r = await db.asUser(a.user, q => q('select card_code from shops'))
    expect(r.rows).toEqual([])
  })

  it('anon cannot insert stamps', async () => {
    const { shopId } = await seedShop(db)
    const a = await seedCustomer(db, shopId)
    await expect(db.asUser(null, q => q(`insert into stamps(shop_id, customer_id, source) values ($1,$2,'card')`, [shopId, a.customerId])))
      .rejects.toThrow(/permission denied|row-level security/)
  })

  it('a customer cannot insert stamps directly', async () => {
    const { shopId } = await seedShop(db)
    const a = await seedCustomer(db, shopId)
    await expect(db.asUser(a.user, q => q(`insert into stamps(shop_id, customer_id, source) values ($1,$2,'card')`, [shopId, a.customerId])))
      .rejects.toThrow(/permission denied|row-level security/)
  })

  it('the same phone cannot be registered twice in one shop', async () => {
    const { shopId } = await seedShop(db)
    const a = await seedCustomer(db, shopId)
    await expect(db.q(`insert into customers(shop_id, name, phone, pdpa_accepted_at) values ($1,'X',$2,now())`, [shopId, a.phone]))
      .rejects.toThrow(/duplicate key/)
  })

  it('card_code and invite_code are generated and unique', async () => {
    const s1 = await seedShop(db), s2 = await seedShop(db)
    expect(s1.cardCode).toMatch(/^[a-z0-9]{16}$/)
    expect(s1.cardCode).not.toBe(s2.cardCode)
    const c = await seedCustomer(db, s1.shopId)
    expect(c.inviteCode).toMatch(/^[a-z0-9]{8}$/)
  })
})
