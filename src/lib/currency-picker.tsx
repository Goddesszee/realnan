/** Searchable bottom sheet to choose the display currency. */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { currencyFlag, type DisplayCurrency } from './display-currency'

const F = "'Inter', -apple-system, sans-serif"

function Sheet({ list, current, onPick, onClose }: { list: DisplayCurrency[]; current: string; onPick: (c: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const shown = needle ? list.filter(c => c.code.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle)) : list
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: F }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Choose currency"
        style={{ width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--nan-surface, #151B2D)', color: 'var(--nan-text, #fff)', borderTopLeftRadius: 20, borderTopRightRadius: 20, border: '1px solid var(--nan-bdr, rgba(255,255,255,0.1))', padding: '16px 16px calc(16px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Show balance in</div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--nan-text3, rgba(255,255,255,0.5))', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search currency or country" aria-label="Search currency"
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--nan-bdr, rgba(255,255,255,0.1))', background: 'var(--nan-surface2, #1C2340)', color: 'inherit', fontSize: 15, fontFamily: F, outline: 'none', marginBottom: 10 }} />
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {shown.map(c => (
            <button key={c.code} onClick={() => { onPick(c.code); onClose() }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 6px', background: 'none', border: 'none', borderBottom: '1px solid var(--nan-bdr, rgba(255,255,255,0.08))', color: 'inherit', cursor: 'pointer', fontFamily: F, textAlign: 'left' }}>
              <span aria-hidden style={{ width: 30, fontSize: 22, lineHeight: 1, textAlign: 'center' }}>{currencyFlag(c.code)}</span>
              <span style={{ width: 40, fontSize: 14, fontWeight: 800 }}>{c.code}</span>
              <span style={{ flex: 1, fontSize: 14, color: 'var(--nan-text2, rgba(255,255,255,0.7))' }}>{c.name}</span>
              {c.code === current && <span style={{ color: '#0866F5', fontWeight: 800 }}>✓</span>}
            </button>
          ))}
          {shown.length === 0 && <div style={{ padding: 18, fontSize: 14, color: 'var(--nan-text3, rgba(255,255,255,0.5))' }}>No currency found.</div>}
        </div>
      </div>
    </div>
  )
}

export function openCurrencyPicker(list: DisplayCurrency[], current: string, onPick: (code: string) => void) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const close = () => { root.unmount(); host.remove() }
  root.render(<Sheet list={list} current={current} onPick={onPick} onClose={close} />)
}
