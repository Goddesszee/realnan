/**
 * OnrampCardPanel — shared inline Circle Onramp widget for public pay pages.
 * Calls /api/onramp-session, embeds the Circle iframe, and reports success.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { CreditCard, Loader2, CheckCircle2 } from 'lucide-react'

const F    = "'Inter', -apple-system, sans-serif"
const BLUE = '#2563EB'
const GREEN = '#16A34A'
const GREEN_L = '#DCFCE7'

type OnrampState = 'idle' | 'loading' | 'widget' | 'success' | 'error'

async function mintOnrampSession(
  destinationAddress: string,
  amount: number,
): Promise<{ widgetUrl?: string; error?: string }> {
  try {
    const res = await fetch('/api/onramp-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        destinationAddress,
        amount: String(amount),
        appUserId: destinationAddress,
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { message?: string }
      return { error: j.message ?? `HTTP ${res.status}` }
    }
    const d = await res.json() as { widgetUrl?: string }
    return d
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Network error' }
  }
}

interface Props {
  toAddress: string
  amount: number
  recipientLabel: string   // e.g. "@alice" or "Hoperite Nigeria Ltd"
  currency?: string
}

export function OnrampCardPanel({ toAddress, amount, recipientLabel, currency = 'USDC' }: Props) {
  const [state, setState]     = useState<OnrampState>('idle')
  const [widgetUrl, setUrl]   = useState('')
  const [widgetReady, setRdy] = useState(false)
  const [error, setError]     = useState('')

  const start = useCallback(async () => {
    setState('loading'); setError('')
    const { widgetUrl: url, error: err } = await mintOnrampSession(toAddress, amount)
    if (err || !url) { setError(err ?? 'Could not start checkout'); setState('error'); return }
    setUrl(url); setState('widget')
  }, [toAddress, amount])

  useEffect(() => {
    if (state !== 'widget') return
    const onMsg = (evt: MessageEvent) => {
      try {
        const msg = evt.data as { event?: string; code?: string }
        if (!msg?.event) return
        if (msg.event === 'INITIALIZATION_SUCCESS') setRdy(true)
        if (msg.event === 'DEPOSIT_SUBMITTED' || msg.event === 'DEPOSIT_SETTLED') setState('success')
        if (msg.event === 'DEPOSIT_NOT_COMPLETED' && msg.code === 'CANCELED_BY_CUSTOMER') setState('idle')
      } catch { /* ignore */ }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [state])

  if (state === 'success') return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: GREEN_L,
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <CheckCircle2 size={30} color={GREEN} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 6 }}>
        Purchase submitted!
      </div>
      <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
        USDC will arrive in {recipientLabel}'s wallet once Circle settles the payment.
      </div>
      <button onClick={() => setState('idle')}
        style={{ marginTop: 20, padding: '11px 28px', borderRadius: 12,
          background: '#F9FAFB', border: '1px solid #E5E7EB',
          color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F }}>
        Done
      </button>
    </div>
  )

  if (state === 'widget') return (
    <div style={{ position: 'relative' }}>
      {!widgetReady && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#fff', zIndex: 5,
          gap: 12, borderRadius: 14 }}>
          <Loader2 size={28} color={BLUE} style={{ animation: 'onramp-spin 1s linear infinite' }} />
          <div style={{ fontSize: 13, color: '#6B7280' }}>Loading checkout…</div>
        </div>
      )}
      <iframe
        src={widgetUrl}
        title="Circle Onramp"
        onLoad={() => setRdy(true)}
        allow="camera; microphone; payment; clipboard-write"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ width: '100%', height: 600, border: 'none', borderRadius: 14, display: 'block' }}
      />
      <button onClick={() => setState('idle')}
        style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 12, background: 'none',
          border: '1px solid #E5E7EB', color: '#9CA3AF', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: F }}>
        ← Back
      </button>
      <style>{`@keyframes onramp-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // idle or error
  return (
    <div>
      {state === 'error' && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#DC2626', marginBottom: 14 }}>
          {error}
        </div>
      )}
      <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 16 }}>
        Pay with debit or credit card. Circle converts your payment to {currency} and sends it
        directly to <strong style={{ color: '#111827' }}>{recipientLabel}</strong>. No crypto wallet needed.
      </p>
      {amount <= 0 && (
        <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 10 }}>
          Enter an amount above to continue.
        </div>
      )}
      <button
        onClick={() => { void start() }}
        disabled={state === 'loading' || amount <= 0}
        style={{ width: '100%', height: 54, borderRadius: 14,
          background: (state === 'loading' || amount <= 0) ? '#F9FAFB' : BLUE,
          border: (state === 'loading' || amount <= 0) ? '1px solid #E5E7EB' : 'none',
          color: (state === 'loading' || amount <= 0) ? '#9CA3AF' : '#fff',
          fontSize: 16, fontWeight: 700,
          cursor: (state === 'loading' || amount <= 0) ? 'not-allowed' : 'pointer',
          fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          boxShadow: (state === 'loading' || amount <= 0) ? 'none' : '0 4px 24px rgba(37,99,235,0.30)',
          transition: 'all 0.15s' }}>
        {state === 'loading'
          ? <><Loader2 size={18} style={{ animation: 'onramp-spin 1s linear infinite' }} />Opening checkout…</>
          : amount <= 0
            ? <><CreditCard size={18} />Enter amount above</>
            : <><CreditCard size={18} />Pay {amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency} with Card</>}
      </button>
      <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
        Powered by Circle · Debit, credit &amp; bank transfer · Fees shown at checkout
      </p>
      <style>{`@keyframes onramp-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
