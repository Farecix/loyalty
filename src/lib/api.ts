import { supabase } from './supabase'
import type { Position } from './geo'

export type Rule = { threshold: number; title_th: string; title_en: string | null }
export type GrantRef = { id: string; title_th: string; title_en: string | null; created_at?: string }
export type Card = {
  customer: { id: string; name: string; invite_code: string }
  shop: { name: string; logo_url?: string | null; location_check?: boolean }
  progress: number
  cycle_length: number
  rules: Rule[]
  available: GrantRef[]
  last_stamp_at: string | null
  next_allowed_at: string | null
}
export type ClaimResult =
  | { status: 'ok'; new_grants: GrantRef[]; card: Card }
  | { status: 'cooldown'; next_allowed_at: string; card: Card }
  | { status: 'too_far'; card: Card }
  | { status: 'not_registered' }

export type ErrorCode =
  | 'SHOP_NOT_FOUND' | 'PHONE_TAKEN' | 'PHONE_INVALID' | 'PDPA_REQUIRED' | 'NAME_REQUIRED'
  | 'NOT_REGISTERED' | 'NOT_STAFF' | 'GRANT_NOT_AVAILABLE' | 'LINK_INVALID' | 'NOT_AUTHENTICATED' | 'UNKNOWN'

const CODES: ErrorCode[] = ['SHOP_NOT_FOUND', 'PHONE_TAKEN', 'PHONE_INVALID', 'PDPA_REQUIRED', 'NAME_REQUIRED',
  'NOT_REGISTERED', 'NOT_STAFF', 'GRANT_NOT_AVAILABLE', 'LINK_INVALID', 'NOT_AUTHENTICATED']

export class ApiError extends Error {
  constructor(public code: ErrorCode, message: string) { super(message) }
}
export function toApiError(e: unknown): ApiError {
  const msg = (e as { message?: string })?.message ?? String(e)
  return new ApiError(CODES.find((c) => msg.includes(c)) ?? 'UNKNOWN', msg)
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw toApiError(error)
  return data as T
}

// ---- Müşteri ----
export const shopPublic = (code: string) => rpc<{ name: string; logo_url?: string | null; location_check?: boolean }>('shop_public', { p_shop_code: code })
export const registerCustomer = (code: string, name: string, phone: string, refCode: string | null, pdpa: boolean) =>
  rpc<string>('register_customer', { p_shop_code: code, p_name: name, p_phone: phone, p_ref_code: refCode, p_pdpa: pdpa })
export const getMyCard = (code: string) => rpc<Card | null>('get_my_card', { p_shop_code: code })
export const claimStamp = (code: string, p: Position | null) =>
  rpc<ClaimResult>('claim_stamp', { p_shop_code: code, p_lat: p?.lat ?? null, p_lng: p?.lng ?? null, p_accuracy: p?.accuracy ?? null })
export const loginByPhone = (code: string, phone: string) =>
  rpc<'ok' | 'not_found'>('login_by_phone', { p_shop_code: code, p_phone: phone })
export const redeemGrant = (grantId: string) => rpc<string>('redeem_grant', { p_grant_id: grantId })
export const consumeLoginLink = (token: string) => rpc<string>('consume_login_link', { p_token: token })

// ---- Personel ----
export type Shop = {
  id: string; name: string; card_code: string; lat: number | null; lng: number | null
  radius_m: number; cooldown_hours: number; logo_url: string | null; location_check: boolean
}
export type FeedItem = {
  kind: 'stamp' | 'redeem'; id: string; customer_id: string; customer_name: string
  title_th: string | null; title_en: string | null; source: 'card' | 'referral' | null; at: string; cancelled: boolean; stamp_cancelled?: boolean
}
export type CustomerRow = {
  id: string; name: string; phone: string; progress: number; available: number
  last_visit: string | null; created_at: string; referred_count: number
}
export type RuleRow = { id: string; threshold: number; title_th: string; title_en: string | null }

export const createShop = (name: string) => rpc<string>('create_shop', { p_name: name })
export const myShop = () => rpc<Shop | null>('my_shop')
export const shopFeed = () => rpc<FeedItem[]>('shop_feed')
export const shopCustomers = (search: string | null) => rpc<CustomerRow[]>('shop_customers', { p_search: search })
export const cancelStamp = (id: string) => rpc<void>('cancel_stamp', { p_stamp_id: id })
export const undoRedemption = (id: string) => rpc<void>('undo_redemption', { p_grant_id: id })
export const createLoginLink = (customerId: string) => rpc<string>('create_login_link', { p_customer_id: customerId })
export const regenerateCardCode = () => rpc<string>('regenerate_card_code')

export async function updateShop(id: string, patch: Partial<Omit<Shop, 'id' | 'card_code'>>) {
  const { error } = await supabase.from('shops').update(patch).eq('id', id)
  if (error) throw toApiError(error)
}
export async function listRules(shopId: string): Promise<RuleRow[]> {
  const { data, error } = await supabase.from('reward_rules').select('id, threshold, title_th, title_en')
    .eq('shop_id', shopId).eq('active', true).order('threshold')
  if (error) throw toApiError(error)
  return data as RuleRow[]
}
export async function addRule(shopId: string, threshold: number, title_th: string, title_en: string | null) {
  const { error } = await supabase.from('reward_rules').insert({ shop_id: shopId, threshold, title_th, title_en })
  if (error) throw toApiError(error)
}
export async function removeRule(id: string) {
  const { error } = await supabase.from('reward_rules').update({ active: false }).eq('id', id)
  if (error) throw toApiError(error)
}
