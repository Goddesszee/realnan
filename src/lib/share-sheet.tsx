/**
 * Share a link to other apps. Uses the phone's own share sheet when the browser
 * allows it; otherwise (in-app browsers, desktop) shows a small NAN share sheet
 * with WhatsApp, Telegram, X, Email, SMS and Copy link. Never opens the page itself.
 */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { toast } from 'sonner'

export interface ShareOptions { title: string; text: string; url: string }

const F = "'Inter', -apple-system, sans-serif"

function openExternal(href: string) {
  if (/^(mailto:|sms:)/.test(href)) { window.location.href = href; return }
  window.open(href, '_blank', 'noopener,noreferrer')
}

async function copy(url: string) {
  try { await navigator.clipboard.writeText(url); toast.success('Link copied') }
  catch { toast.error('Could not copy. Long-press the link to copy it.') }
}

function Sheet({ opts, onClose }: { opts: ShareOptions; onClose: () => void }) {
  const [busy] = useState(false)
  const msg = `${opts.text}\n${opts.url}`
  const items: { label: string; color: string; glyph: string; run: () => void }[] = [
    { label: 'WhatsApp', color: '#128C7E', glyph: 'W', run: () => openExternal(`https://wa.me/?text=${encodeURIComponent(msg)}`) },
    { label: 'Telegram', color: '#229ED9', glyph: 'T', run: () => openExternal(`https://t.me/share/url?url=${encodeURIComponent(opts.url)}&text=${encodeURIComponent(opts.text)}`) },
    { label: 'X', color: '#111111', glyph: 'X', run: () => openExternal(`https://twitter.com/intent/tweet?text=${encodeURIComponent(opts.text)}&url=${encodeURIComponent(opts.url)}`) },
    { label: 'Email', color: '#EA4335', glyph: '@', run: () => openExternal(`mailto:?subject=${encodeURIComponent(opts.title)}&body=${encodeURIComponent(msg)}`) },
    { label: 'SMS', color: '#34A853', glyph: '✉', run: () => openExternal(`sms:?&body=${encodeURIComponent(msg)}`) },
    { label: 'Copy link', color: 'var(--nan-blue)', glyph: '⧉', run: () => { void copy(opts.url) } },
  ]
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: F }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Share"
        style={{ width: '100%', maxWidth: 480, background: 'var(--nan-surface, #151B2D)', color: 'var(--nan-text, #fff)', borderTopLeftRadius: 20, borderTopRightRadius: 20, border: '1px solid var(--nan-bdr, rgba(255,255,255,0.1))', padding: '16px 16px calc(20px + env(safe-area-inset-bottom))', opacity: busy ? 0.8 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Share</div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--nan-text3, rgba(255,255,255,0.5))', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {items.map(it => (
            <button key={it.label} onClick={() => { it.run(); onClose() }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 4px', background: 'var(--nan-surface2, #1C2340)', border: '1px solid var(--nan-bdr, rgba(255,255,255,0.1))', borderRadius: 14, cursor: 'pointer', fontFamily: F, color: 'inherit' }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: it.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>{it.glyph}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{it.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function showShareSheet(opts: ShareOptions) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const close = () => { root.unmount(); host.remove() }
  root.render(<Sheet opts={opts} onClose={close} />)
}

/** Phone share sheet first; our own sheet when that is not available. */
export async function shareLink(opts: ShareOptions): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share(opts); return }
    catch (e) { if ((e as Error)?.name === 'AbortError') return }
  }
  showShareSheet(opts)
}
