/** "Add Money" method chooser, shown only when the naira flag is on. */
import { createRoot } from 'react-dom/client'

const F = "'Inter', -apple-system, sans-serif"

export function showAddMoneySheet(go: (view: string) => void) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const close = () => { root.unmount(); host.remove() }
  const items = [
    { view: 'onramp', icon: '💳', title: 'Card', sub: 'Buy USDC with a debit or credit card' },
    { view: 'naira-in', icon: '🏦', title: 'Naira bank transfer', sub: 'Send naira from any Nigerian bank' },
    { view: 'naira-opay', icon: '📱', title: 'OPay', sub: 'Pay with your OPay app' },
  ]
  root.render(
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: F }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Add money"
        style={{ width: '100%', maxWidth: 480, background: 'var(--nan-surface, #151B2D)', color: 'var(--nan-text, #fff)', borderTopLeftRadius: 20, borderTopRightRadius: 20, border: '1px solid var(--nan-bdr, rgba(255,255,255,0.1))', padding: '16px 16px calc(20px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Add money</div>
          <button onClick={close} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--nan-text3, rgba(255,255,255,0.5))', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        {items.map(it => (
          <button key={it.view} onClick={() => { close(); go(it.view) }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 12px', marginBottom: 8, background: 'var(--nan-surface2, #1C2340)', border: '1px solid var(--nan-bdr, rgba(255,255,255,0.1))', borderRadius: 14, color: 'inherit', cursor: 'pointer', fontFamily: F, textAlign: 'left' }}>
            <span style={{ fontSize: 22 }}>{it.icon}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{it.title}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--nan-text3, rgba(255,255,255,0.55))', marginTop: 2 }}>{it.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
