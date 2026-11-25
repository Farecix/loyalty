import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

export type Q = (sql: string, params?: unknown[]) => Promise<pg.QueryResult>
export interface Db {
  url: string
  /** Süper kullanıcı olarak (RLS yok) sorgu. */
  q: Q
  /** Bir transaction içinde verilen kullanıcı olarak çalıştırır (uid null → anon). */
  asUser<T>(uid: string | null, fn: (q: Q) => Promise<T>): Promise<T>
  /** Yeni bağlantı aç (eşzamanlılık testleri için). */
  connect(): Promise<pg.Client>
  close(): Promise<void>
}

const ROOT = join(__dirname, '..', '..')

export async function freshDb(): Promise<Db> {
  const base = process.env.TEST_PG_URL!
  const name = 't_' + Math.random().toString(36).slice(2, 10)
  const admin = new pg.Client(base); await admin.connect()
  await admin.query(`create database ${name}`); await admin.end()
  const url = base.replace(/\/postgres$/, '/' + name)
  const pool = new pg.Pool({ url, connectionString: url, max: 5 } as pg.PoolConfig)
  const files = [join(ROOT, 'test/db/stubs.sql'),
    ...readdirSync(join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort().map(f => join(ROOT, 'supabase/migrations', f))]
  for (const f of files) {
    try { await pool.query(readFileSync(f, 'utf8')) } catch (e) { throw new Error(`${f}: ${(e as Error).message}`) }
  }
  const q: Q = (sql, params) => pool.query(sql, params as unknown[])
  return {
    url, q,
    async asUser(uid, fn) {
      const c = await pool.connect()
      try {
        await c.query('begin')
        if (uid) await c.query('insert into auth.users(id) values ($1) on conflict do nothing', [uid])
        await c.query(`set local role ${uid ? 'authenticated' : 'anon'}`)
        await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ''])
        const r = await fn((s, p) => c.query(s, p as unknown[]))
        await c.query('commit')
        return r
      } catch (e) { await c.query('rollback').catch(() => {}); throw e } finally { c.release() }
    },
    async connect() { const c = new pg.Client(url); await c.connect(); return c },
    async close() { await pool.end() },
  }
}

/** Test yardımcısı: yeni kullanıcı uuid'i. */
export const uid = () => crypto.randomUUID()
