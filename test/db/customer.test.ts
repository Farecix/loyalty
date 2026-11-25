import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { freshDb, uid, type Db } from './harness'
import { seedShop } from './fixtures'

let db: Db
beforeAll(async () => { db = await freshDb() })
afterAll(async () => { await db.close() })

const register = (user: string, code: string, phone: string, ref: string | null = null, pdpa = true) =>
  db.asUser(user, q => q('select register_customer($1, $2, $3, $4, $5) as id', [code, 'Somchai', phone, ref, pdpa]))
const card = (user: string, code: string) =>
  db.asUser(user, q => q('select get_my_card($1) as c', [code])).then(r => r.rows[0].c)

describe('normalize_phone', () => {
  it.each(['081-234-5678', '+66 81 234 5678', '812345678', '66812345678'])('%s → 66812345678', async (p) => {
    expect((await db.q('select normalize_phone($1) p', [p])).rows[0].p).toBe('66812345678')
  })
})

describe('register_customer + get_my_card', () => {
  it('registers and returns an empty card with default rules', async () => {
    const { cardCode } = await seedShop(db)
    const u = uid()
    await register(u, cardCode, '0811111111')
    const c = await card(u, cardCode)
    expect(c.progress).toBe(0)
    expect(c.cycle_length).toBe(10)
    expect(c.shop.name).toBe('Test Barber')
    expect(c.rules).toEqual([
      { threshold: 5, title_th: 'ล้างผมฟรี', title_en: 'Free hair wash' },
      { threshold: 10, title_th: 'ตัดผมฟรี', title_en: 'Free haircut' },
    ])
    expect(c.available).toEqual([])
    expect(c.customer.invite_code).toMatch(/^[a-z0-9]{8}$/)
    expect(c.next_allowed_at).toBeNull()
  })

  it('get_my_card returns null when not registered', async () => {
    const { cardCode } = await seedShop(db)
    expect(await card(uid(), cardCode)).toBeNull()
  })

  it('the same number in another format is PHONE_TAKEN', async () => {
    const { cardCode } = await seedShop(db)
    await register(uid(), cardCode, '082-222-3333')
    await expect(register(uid(), cardCode, '+66 82 222 3333')).rejects.toThrow('PHONE_TAKEN')
    await expect(register(uid(), cardCode, '822223333')).rejects.toThrow('PHONE_TAKEN')
  })

  it('the same number can register at a different shop', async () => {
    const s1 = await seedShop(db), s2 = await seedShop(db)
    await register(uid(), s1.cardCode, '0833333333')
    await expect(register(uid(), s2.cardCode, '0833333333')).resolves.toBeTruthy()
  })

  it('without PDPA consent → PDPA_REQUIRED', async () => {
    const { cardCode } = await seedShop(db)
    await expect(register(uid(), cardCode, '0844444444', null, false)).rejects.toThrow('PDPA_REQUIRED')
  })

  it('a wrong shop code → SHOP_NOT_FOUND', async () => {
    await expect(register(uid(), 'nope', '0855555555')).rejects.toThrow('SHOP_NOT_FOUND')
  })

  it('an invalid phone number → PHONE_INVALID', async () => {
    const { cardCode } = await seedShop(db)
    await expect(register(uid(), cardCode, '12')).rejects.toThrow('PHONE_INVALID')
  })

  it('registering again with the same user returns the existing id', async () => {
    const { cardCode } = await seedShop(db)
    const u = uid()
    const a = (await register(u, cardCode, '0866666666')).rows[0].id
    const b = (await register(u, cardCode, '0866666666')).rows[0].id
    expect(b).toBe(a)
  })

  it('an invite code sets referred_by; an invalid one is ignored', async () => {
    const { cardCode } = await seedShop(db)
    const a = uid()
    const aId = (await register(a, cardCode, '0877777777')).rows[0].id
    const inv = (await card(a, cardCode)).customer.invite_code
    const bId = (await register(uid(), cardCode, '0877777778', inv)).rows[0].id
    const cId = (await register(uid(), cardCode, '0877777779', 'zzzzzzzz')).rows[0].id
    const rows = (await db.q('select id, referred_by from customers where id = any($1)', [[bId, cId]])).rows
    expect(rows.find(r => r.id === bId).referred_by).toBe(aId)
    expect(rows.find(r => r.id === cId).referred_by).toBeNull()
  })

  it('anon (no session) cannot register', async () => {
    const { cardCode } = await seedShop(db)
    await expect(db.asUser(null, q => q('select register_customer($1,$2,$3,null,true)', [cardCode, 'X', '0888888888'])))
      .rejects.toThrow(/NOT_AUTHENTICATED|permission denied/)
  })
})
