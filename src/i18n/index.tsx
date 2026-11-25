import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { th } from './th'
import { en } from './en'

export type Lang = 'th' | 'en'
export type Key = keyof typeof th
const dicts: Record<Lang, Record<Key, string>> = { th, en }

function detect(): Lang {
  try { const s = localStorage.getItem('lang'); if (s === 'th' || s === 'en') return s } catch { /* yok */ }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('th') ? 'th' : 'en'
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key, vars?: Record<string, string | number>) => string;
  pick: (o: { title_th: string | null; title_en: string | null }) => string }
const I18n = createContext<Ctx | null>(null)

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial ?? detect())
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('lang', l) } catch { /* yok */ }
    document.documentElement.lang = l
  }, [])
  const t = useCallback((k: Key, vars?: Record<string, string | number>) =>
    Object.entries(vars ?? {}).reduce((s, [a, b]) => s.split(`{${a}}`).join(String(b)), dicts[lang][k]), [lang])
  const pick = useCallback((o: { title_th: string | null; title_en: string | null }) =>
    (lang === 'en' && o.title_en) ? o.title_en : (o.title_th ?? ''), [lang])
  return <I18n.Provider value={{ lang, setLang, t, pick }}>{children}</I18n.Provider>
}

export function useI18n() {
  const c = useContext(I18n)
  if (!c) throw new Error('I18nProvider missing')
  return c
}

export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n()
  return (
    <div className={`inline-flex rounded-full border border-white/20 text-xs font-semibold overflow-hidden ${className}`}>
      {(['th', 'en'] as const).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`px-3 py-1 ${lang === l ? 'bg-white text-ink' : 'text-current opacity-70'}`}>{l.toUpperCase()}</button>
      ))}
    </div>
  )
}

export function formatTime(iso: string, lang: Lang) {
  return new Date(iso).toLocaleString(lang === 'th' ? 'th-TH' : 'en-GB',
    { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
