// Canlı Supabase'e karşı duman testi: node e2e/smoke.mjs <baseUrl> <cardCode>
import { chromium } from 'playwright'
const [base, code] = process.argv.slice(2)
const SHOP = { latitude: 13.7455, longitude: 100.5340 }
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined
const browser = await chromium.launch({ proxy, executablePath: process.env.PW_CHROMIUM || undefined })
const fails = []
const seen = (loc) => loc.first().waitFor({ state: 'visible', timeout: 20000 }).then(() => true, () => false)
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails.push(msg) }

async function ctx(geo = SHOP) {
  const c = await browser.newContext({ locale: 'en-US', geolocation: geo, permissions: ['geolocation'], viewport: { width: 390, height: 844 } })
  const p = await c.newPage(); p.setDefaultTimeout(20000); return { c, p }
}
async function signup(p, name, phone) {
  await p.getByLabel('Name').fill(name)
  await p.getByLabel('Phone number').fill(phone)
  await p.getByRole('checkbox').check()
  await p.getByRole('button', { name: 'Create card' }).click()
}

const A = await ctx()
await A.p.goto(`${base}/s/${code}`)
await signup(A.p, 'E2E Anan', '0899000001')
check(await seen(A.p.getByText('+1')), 'A: signup at the shop gives +1')
await A.p.goto(`${base}/k/${code}`)
const invite = (await A.p.locator('div.font-mono').innerText()).trim()
check(invite.includes(`/d/${code}/`), 'A: card shows an invite link')
check(await seen(A.p.getByText('1 / 10 stamps')), 'A: card shows 1 / 10')

const B = await ctx()
await B.p.goto(invite.replace(/^https?:\/\/[^/]+/, base))
check(await seen(B.p.getByText('A friend invited you')), 'B: invite page says a friend invited you')
await signup(B.p, 'E2E Busaba', '0899000002')
await seen(B.p.getByText('My rewards'))
await B.p.goto(`${base}/s/${code}`)
check(await seen(B.p.getByText('+1')), 'B: first scan gives +1')

await A.p.goto(`${base}/k/${code}`)
check(await seen(A.p.getByText('2 / 10 stamps')), 'A: referral raised A to 2 / 10')
await A.p.goto(`${base}/s/${code}`)
check(await seen(A.p.getByText(/already got a stamp today/)), 'A: second scan today → cooldown')

const C = await ctx({ latitude: 13.80, longitude: 100.60 })
await C.p.goto(`${base}/s/${code}`)
await signup(C.p, 'E2E Chai', '0899000003')
check(await seen(C.p.getByText(/not at the shop/)), 'C: 9 km away → too far')

const D = await ctx()
await D.p.goto(`${base}/s/${code}`)
await signup(D.p, 'E2E Anan', '+66 89 900 0001')
check(await seen(D.p.getByText(/already got a stamp today/)), "D: A's number in a new browser at the shop → back into A's card (cooldown, no 2nd stamp)")
check(await seen(D.p.getByText('2 / 10 stamps')), "D: sees A's 2 / 10")
await D.p.goto(`${base}/k/${code}`)
check(await seen(D.p.getByRole('button', { name: 'Get a stamp' })), 'D: card page has a Get a stamp button')

const E = await ctx({ latitude: 13.80, longitude: 100.60 })
await E.p.goto(`${base}/k/${code}`)
await E.p.getByRole('button', { name: 'Already have a card? Log in with your phone' }).click()
await E.p.getByLabel('Phone number').fill('089-900-0001')
await E.p.getByRole('button', { name: 'Log in' }).click()
check(await seen(E.p.getByText('2 / 10 stamps')), "E: logs in with A's phone from 9 km away and sees A's card")
await E.p.goto(`${base}/s/${code}`)
check(await seen(E.p.getByText(/not at the shop/)), 'E: but cannot collect a stamp away from the shop')

await A.p.screenshot({ path: process.env.SHOT_DIR + '/live-cooldown.png' })
await browser.close()
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED')
process.exit(fails.length ? 1 : 0)
