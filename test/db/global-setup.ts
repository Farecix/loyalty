import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'

const BIN = '/usr/lib/postgresql/16/bin'
let proc: ChildProcess | undefined
let dir = ''

function asPg(cmd: string, args: string[]) {
  const isRoot = process.getuid?.() === 0
  return isRoot ? execFileSync('runuser', ['-u', 'postgres', '--', cmd, ...args]) : execFileSync(cmd, args)
}

export async function setup() {
  dir = mkdtempSync(join(tmpdir(), 'pgtest-'))
  chmodSync(dir, 0o777)
  const data = join(dir, 'data')
  asPg(`${BIN}/initdb`, ['-D', data, '-U', 'postgres', '--auth=trust', '-E', 'UTF8'])
  const port = String(20000 + Math.floor(Math.random() * 20000))
  const isRoot = process.getuid?.() === 0
  const args = ['-D', data, '-p', port, '-k', dir, '-c', 'listen_addresses=127.0.0.1', '-c', 'fsync=off', '-c', 'TimeZone=UTC']
  proc = isRoot ? spawn('runuser', ['-u', 'postgres', '--', `${BIN}/postgres`, ...args], { stdio: 'ignore', detached: true })
                : spawn(`${BIN}/postgres`, args, { stdio: 'ignore', detached: true })
  proc.unref()
  const url = `postgres://postgres@127.0.0.1:${port}/postgres`
  for (let i = 0; i < 100; i++) {
    try { const c = new pg.Client(url); await c.connect(); 
      await c.query(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;`)
      await c.end(); break } catch { await new Promise(r => setTimeout(r, 100)) }
  }
  process.env.TEST_PG_URL = url
}

export async function teardown() {
  try { asPg(`${BIN}/pg_ctl`, ['-D', join(dir, 'data'), 'stop', '-m', 'immediate']) } catch { proc?.kill('SIGKILL') }
  rmSync(dir, { recursive: true, force: true })
}
