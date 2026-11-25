import type { ReactNode } from 'react'
import { LangSwitch } from '../i18n'

/** Müşteri ekranlarının ortak çerçevesi: koyu üst bant + içerik kartı. */
export function Shell({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink text-white">
      <div className="mx-auto max-w-md px-4 pb-10">
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2 min-w-0">
            <span aria-hidden className="h-6 w-2 rounded-full bg-[repeating-linear-gradient(135deg,#dc2626_0_6px,#fff_6px_12px,#1d4ed8_12px_18px,#fff_18px_24px)]" />
            <span className="truncate font-extrabold tracking-wide">{title ?? ''}</span>
          </div>
          <LangSwitch />
        </header>
        {children}
      </div>
    </div>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-stone-50 p-5 text-ink shadow-xl ${className}`}>{children}</section>
}

export function Spinner({ label }: { label: string }) {
  return <p role="status" className="py-16 text-center text-white/70">{label}</p>
}

export function Button({ children, variant = 'primary', className = '', ...p }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const v = variant === 'primary' ? 'bg-brand text-white hover:bg-brand-dark'
    : variant === 'danger' ? 'bg-red-600 text-white' : 'bg-stone-200 text-ink hover:bg-stone-300'
  return <button {...p} className={`rounded-2xl px-5 py-3 font-bold disabled:opacity-50 ${v} ${className}`}>{children}</button>
}
