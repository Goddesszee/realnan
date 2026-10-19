/** Searchable language chooser (bottom sheet). Choosing a language reloads the page in that language. */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { LANGUAGES, languageByCode } from './languages'
import { getLang, setLang } from './i18n'

const F = "'Inter', -apple-system, sans-serif"

function Sheet({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const current = getLang()
  const needle = q.trim().toLowerCase()
  const shown = needle ? LANGUAGES.filter(l => l.en.toLowerCase().includes(needle) || l.native.toLowerCase().includes(needle) || l.code.toLowerCase() === needle) : LANGUAGES
  return (
    <div onClick={onClose} className="notranslate" translate="no"
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: F }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Choose language"
        style={{ width: '100%', maxWidth: 480, maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: 'var(--nan-surface, #151B2D)', color: 'var(--nan-text, #fff)', borderTopLeftRadius: 20, borderTopRightRadius: 20, border: '1px solid var(--nan-bdr, rgba(255,255,255,0.1))', padding: '16px 16px calc(16px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>🌐 Language</div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--nan-text3, rgba(255,255,255,0.5))', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search language" aria-label="Search language"
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--nan-bdr, rgba(255,255,255,0.1))', background: 'var(--nan-surface2, #1C2340)', color: 'inherit', fontSize: 15, fontFamily: F, outline: 'none', marginBottom: 8 }} />
        <div style={{ fontSize: 11, color: 'var(--nan-text3, rgba(255,255,255,0.5))', lineHeight: 1.5, marginBottom: 8 }}>
          Translations are made automatically and may contain mistakes. Until a translation is ready, English is shown.
        </div>
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {shown.map(l => (
            <button key={l.code} onClick={() => { onClose(); if (l.code !== current) setLang(l.code) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 6px', background: 'none', border: 'none', borderBottom: '1px solid var(--nan-bdr, rgba(255,255,255,0.08))', color: 'inherit', cursor: 'pointer', fontFamily: F, textAlign: 'left' }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{l.native}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--nan-text3, rgba(255,255,255,0.55))' }}>{l.en}</span>
              </span>
              {l.code === current && <span style={{ color: 'var(--nan-blue)', fontWeight: 800 }}>✓</span>}
            </button>
          ))}
          {shown.length === 0 && <div style={{ padding: 18, fontSize: 14, color: 'var(--nan-text3, rgba(255,255,255,0.5))' }}>No language found.</div>}
        </div>
      </div>
    </div>
  )
}

export function openLanguagePicker() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  root.render(<Sheet onClose={() => { root.unmount(); host.remove() }} />)
}

/** Short label for the current language, e.g. "Hausa". */
export function currentLanguageLabel(): string {
  const l = languageByCode(getLang())
  return l ? l.native : 'English'
}
