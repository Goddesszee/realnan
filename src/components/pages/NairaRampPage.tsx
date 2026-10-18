/**
 * Naira on-ramp (bank transfer, OPay) and off-ramp (cash out to a Nigerian bank account).
 * Both sit behind the naira flag and stay in "launching soon" mode until a licensed partner is
 * connected on the server. The screens show a live estimate; the partner confirms the final rate.
 */
import { useEffect, useState } from 'react'
import { ArrowLeft, Landmark, Smartphone, Info } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useFxRate, currencyFlag } from '../../lib/display-currency'
import { fetchRampStatus } from '../../lib/naira-ramp'

const F     = "'Inter', -apple-system, sans-serif"
const SURF  = 'var(--nan-surface)'
const SURF2 = 'var(--nan-surface2)'
const BDR   = 'var(--nan-bdr)'
const BLUE  = '#0866F5'
const TEXT  = 'var(--nan-text)'
const T2    = 'var(--nan-text2)'
const T3    = 'var(--nan-text3)'

const NGN_PRESETS  = [5000, 20000, 50000, 100000]
const USDC_PRESETS = [10, 25, 50, 100]
const BANKS = ['Access Bank', 'Citibank', 'Ecobank', 'Fidelity Bank', 'First Bank', 'FCMB', 'GTBank', 'Kuda', 'Moniepoint', 'OPay', 'PalmPay', 'Polaris Bank', 'Stanbic IBTC', 'Sterling Bank', 'UBA', 'Union Bank', 'Wema Bank', 'Zenith Bank']

const fmt = (n: number, d = 2) => n.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d })

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>{children}</div>
}
const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', minHeight: 46, borderRadius: 12, border: `1px solid ${BDR}`, background: SURF2, color: TEXT, fontFamily: F, fontSize: 15, outline: 'none' }

export function NairaRampPage({ mode, initialMethod = 'bank' }: { mode: 'in' | 'out'; initialMethod?: 'bank' | 'opay' }) {
  const { setActiveView, mainWalletBalance } = useAppStore()
  const rate = useFxRate('NGN') // naira per 1 USD (display estimate)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [method, setMethod] = useState<'bank' | 'opay'>(initialMethod)
  const [amount, setAmount] = useState('')
  const [bank, setBank] = useState('')
  const [acct, setAcct] = useState('')

  useEffect(() => { let live = true; void fetchRampStatus().then(s => { if (live) setConfigured(s.configured) }); return () => { live = false } }, [])

  const n = parseFloat(amount) || 0
  const estimate = rate && n > 0 ? (mode === 'in' ? n / rate : n * rate) : null
  const available = parseFloat(String(mainWalletBalance ?? '0')) || 0
  const acctOk = /^\d{10}$/.test(acct)
  const title = mode === 'in' ? 'Add money with naira' : 'Cash out to naira'
  const presets = mode === 'in' ? NGN_PRESETS : USDC_PRESETS

  return (
    <div style={{ width: '100%', fontFamily: F, paddingBottom: 96 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button onClick={() => setActiveView('home')} aria-label="Back"
          style={{ width: 32, height: 32, borderRadius: 8, background: SURF, border: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={15} color={T2} />
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', color: TEXT, margin: 0 }}>{title}</h1>
          <div style={{ fontSize: 13, color: T3 }}>{currencyFlag('NGN')} Nigerian naira · USDC on Arc</div>
        </div>
      </div>

      {mode === 'in' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {([['bank', 'Bank transfer', Landmark], ['opay', 'OPay', Smartphone]] as const).map(([id, name, Icon]) => {
            const on = method === id
            return (
              <button key={id} onClick={() => setMethod(id)} aria-pressed={on}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 12, cursor: 'pointer', fontFamily: F, fontSize: 14, fontWeight: 600, border: `1px solid ${on ? BLUE : BDR}`, background: on ? 'rgba(8,102,245,0.12)' : SURF, color: on ? BLUE : T2 }}>
                <Icon size={16} /> {name}
              </button>
            )
          })}
        </div>
      )}

      <Card>
        <div style={label}>{mode === 'in' ? 'Amount in naira' : 'Amount in USDC'}</div>
        <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" aria-label="Amount"
          style={{ ...input, fontSize: 26, fontWeight: 700, minHeight: 56 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {presets.map(p => (
            <button key={p} onClick={() => setAmount(String(p))}
              style={{ height: 34, padding: '0 12px', borderRadius: 999, border: `1px solid ${BDR}`, background: SURF2, color: T2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F }}>
              {mode === 'in' ? `₦${fmt(p, 0)}` : `$${p}`}
            </button>
          ))}
        </div>
        {mode === 'out' && <div style={{ fontSize: 12, color: T3, marginTop: 10 }}>Available on Arc: {fmt(available)} USDC</div>}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BDR}`, fontSize: 14, color: T2 }}>
          {mode === 'in' ? 'You get about ' : 'You receive about '}
          <b style={{ color: TEXT }}>{estimate === null ? '—' : mode === 'in' ? `${fmt(estimate)} USDC` : `₦${fmt(estimate, 0)}`}</b>
          {rate ? <div style={{ fontSize: 12, color: T3, marginTop: 4 }}>At today's rate: $1 ≈ ₦{fmt(rate, 0)}</div> : null}
        </div>
      </Card>

      {mode === 'out' && (
        <Card>
          <div style={label}>Pay out to</div>
          <input value={bank} onChange={e => setBank(e.target.value)} list="nan-banks" placeholder="Bank name" aria-label="Bank name" style={{ ...input, marginBottom: 10 }} />
          <datalist id="nan-banks">{BANKS.map(b => <option key={b} value={b} />)}</datalist>
          <input value={acct} onChange={e => setAcct(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="Account number (10 digits)" aria-label="Account number" style={input} />
          {acct.length > 0 && !acctOk && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>Account numbers have 10 digits.</div>}
          <div style={{ fontSize: 12, color: T3, marginTop: 10 }}>Our partner checks that the account name matches yours before paying out.</div>
        </Card>
      )}

      {mode === 'in' && (
        <Card>
          <div style={label}>How it works</div>
          <div style={{ fontSize: 13, color: T2, lineHeight: 1.6 }}>
            {method === 'bank'
              ? 'You get a one-time Nigerian bank account number to send the naira to. Once it arrives, the USDC lands in your NAN wallet.'
              : 'You pay from your OPay app. Once the payment is confirmed, the USDC lands in your NAN wallet.'}
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: 'rgba(8,102,245,0.08)', border: '1px solid rgba(8,102,245,0.20)', marginBottom: 16 }}>
        <Info size={16} color={BLUE} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: T2, lineHeight: 1.55 }}>
          {configured === false
            ? 'Naira payments are being set up with a licensed partner and are launching soon. This screen shows an estimate only.'
            : 'The exact rate and any fees are shown by our licensed partner before you confirm.'}
        </div>
      </div>

      <button disabled
        style={{ width: '100%', height: 50, borderRadius: 14, border: 'none', background: BLUE, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: F, opacity: 0.45, cursor: 'not-allowed' }}>
        {configured === null ? 'Checking…' : 'Launching soon'}
      </button>
    </div>
  )
}
