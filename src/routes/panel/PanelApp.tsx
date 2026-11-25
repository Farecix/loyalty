import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { createShop, myShop, type Shop } from '../../lib/api'
import { LangSwitch, useI18n } from '../../i18n'
import { Button } from '../../components/Shell'
import Login from './Login'
import Feed from './Feed'
import Customers from './Customers'
import Settings from './Settings'
import PrintCard from './PrintCard'
import { SetupWarning } from './SetupWarning'

export default function PanelApp() {
  const { t } = useI18n()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [shop, setShop] = useState<Shop | null | undefined>(undefined)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  const isStaffSession = session && !session.user.is_anonymous
  const loadShop = useCallback(async () => setShop(await myShop()), [])
  useEffect(() => { if (isStaffSession) void loadShop(); else setShop(undefined) }, [isStaffSession, loadShop])

  if (session === undefined) return null
  if (!isStaffSession) return <Login />
  if (shop === undefined) return <p className="p-6">{t('loading')}</p>
  if (shop === null) return <CreateShop onDone={loadShop} />

  const tab = ({ isActive }: { isActive: boolean }) => `rounded-full px-4 py-2 text-sm font-semibold ${isActive ? 'bg-ink text-white' : 'text-stone-600'}`
  return (
    <div className="min-h-dvh bg-stone-100 text-ink">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <p className="truncate font-extrabold">{shop.name}</p>
          <div className="flex items-center gap-2">
            <LangSwitch className="border-stone-300" />
            <button className="text-sm text-stone-500 underline" onClick={() => void supabase.auth.signOut()}>{t('signOut')}</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 pb-2">
          <NavLink end to="/panel" className={tab}>{t('feed')}</NavLink>
          <NavLink to="/panel/customers" className={tab}>{t('customers')}</NavLink>
          <NavLink to="/panel/settings" className={tab}>{t('settings')}</NavLink>
          <NavLink to="/panel/card" className={tab}>{t('card')}</NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl p-4">
        <div className="print:hidden"><SetupWarning shop={shop} /></div>
        <Routes>
          <Route index element={<Feed shop={shop} />} />
          <Route path="customers" element={<Customers />} />
          <Route path="settings" element={<Settings shop={shop} onSaved={loadShop} />} />
          <Route path="card" element={<PrintCard shop={shop} onChanged={loadShop} />} />
        </Routes>
      </main>
    </div>
  )
}

function CreateShop({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  async function submit(e: FormEvent) { e.preventDefault(); await createShop(name); onDone() }
  return (
    <div className="flex min-h-dvh items-center justify-center bg-stone-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-xl">
        <label className="block"><span className="text-sm font-semibold">{t('shopName')}</span>
          <input required className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <Button type="submit" className="w-full">{t('save')}</Button>
      </form>
    </div>
  )
}
