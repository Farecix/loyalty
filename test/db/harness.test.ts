import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { freshDb, type Db } from './harness'

let db: Db
beforeAll(async () => { db = await freshDb() })
afterAll(async () => { await db.close() })

describe('harness', () => {
  it('asUser sets auth.uid() to the given user', async () => {
    const uid = '11111111-1111-1111-1111-111111111111'
    const r = await db.asUser(uid, (q) => q('select auth.uid() as u'))
    expect(r.rows[0].u).toBe(uid)
  })
  it('asUser(null) runs as anon with no uid', async () => {
    const r = await db.asUser(null, (q) => q('select auth.uid() as u, current_user as role'))
    expect(r.rows[0].u).toBeNull()
    expect(r.rows[0].role).toBe('anon')
  })
})
