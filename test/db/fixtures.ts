import type { Db } from './harness'
import { uid } from './harness'

/** Dükkân konumu (Bangkok, Siam civarı). */
export const SHOP_LAT = 13.7455, SHOP_LNG = 100.5340

export async function seedShop(db: Db, opts: { lat?: number | null; lng?: number | null } = {}) {
  const staff = uid()
  await db.q('insert into auth.users(id) values ($1)', [staff])
  const lat = opts.lat === undefined ? SHOP_LAT : opts.lat
  const lng = opts.lng === undefined ? SHOP_LNG : opts.lng
  const shop = (await db.q(`insert into shops(name, lat, lng) values ('Test Barber', $1, $2) returning id, card_code`, [lat, lng])).rows[0]
  await db.q('insert into shop_staff(shop_id, user_id) values ($1, $2)', [shop.id, staff])
  await db.q(`insert into reward_rules(shop_id, threshold, title_th, title_en) values
    ($1, 5, 'ล้างผมฟรี', 'Free hair wash'), ($1, 10, 'ตัดผมฟรี', 'Free haircut')`, [shop.id])
  return { shopId: shop.id as string, cardCode: shop.card_code as string, staff }
}

let phoneSeq = 810000000
export async function seedCustomer(db: Db, shopId: string, opts: { name?: string; referredBy?: string } = {}) {
  const user = uid()
  await db.q('insert into auth.users(id) values ($1)', [user])
  const phone = '66' + (phoneSeq++)
  const c = (await db.q(`insert into customers(shop_id, auth_user_id, name, phone, referred_by, pdpa_accepted_at)
     values ($1, $2, $3, $4, $5, now()) returning id, invite_code`, [shopId, user, opts.name ?? 'Somchai', phone, opts.referredBy ?? null])).rows[0]
  return { customerId: c.id as string, inviteCode: c.invite_code as string, user, phone }
}
