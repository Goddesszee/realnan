/**
 * Live currency converter for every currency we have a rate for.
 * Estimate only: rates are mid-market and refresh about every minute while this screen is open.
 */
import { useMemo, useState } from 'react'
import { ArrowUpDown, ChevronDown } from 'lucide-react'
import { useFxRates, currencyList, currencyFlag, type DisplayCurrency } from '../../lib/display-currency'
import { openCurrencyPicker } from '../../lib/currency-picker'

const F     = "'Inter', -apple-system, sans-serif"
const SURF  = 'var(--nan-surface)'
const SURF2 = 'var(--nan-surface2)'
const BDR   = 'var(--nan-bdr)'
const TEXT  = 'var(--nan-text)'
const T2    = 'var(--nan-text2)'
const T3    = 'var(--nan-text3)'
const BLUE  = '#0866F5'

const SAVED = 'nan_converter_pair'
const QUICK = ['NGN', 'GHS', 'KES', 'ZAR', 'GBP', 'EUR', 'CAD', 'INR']

function loadPair(): [string, string] {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED) || 'null')
    if (Array.isArray(v) && /^[A-Z]{3}$/.test(v[0]) && /^[A-Z]{3}$/.test(v[1])) return [v[0], v[1]]
  } catch { /* ignore */ }
  return ['USD', 'NGN']
}

function money(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const abs = Math.abs(n)
  const d = abs >= 1000 ? 0 : abs >= 1 ? 2 : abs === 0 ? 0 : 6
  return n.toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: abs >= 1 && abs < 1000 ? 2 : 0 })
}

export function CurrencyConverterPage() {
  const { rates, updatedAt } = useFxRates()
  const [[from, to], setPair] = useState<[string, string]>(loadPair)
  const [amount, setAmount] = useState('100')

  const list: DisplayCurrency[] = useMemo(
    () => currencyList(rates).map(c => c.code === 'USD' ? { code: 'USD', name: 'US dollar' } : c),
    [rates],
  )
  const nameOf = (c: string) => list.find(x => x.code === c)?.name ?? c
  const rateOf = (c: string) => (c === 'USD' ? 1 : rates?.[c])
  const rFrom = rateOf(from), rTo = rateOf(to)
  const ready = Boolean(rFrom && rTo)
  const value = parseFloat(amount.replace(/,/g, ''))
  const result = ready && Number.isFinite(value) ? (value / rFrom!) * rTo! : null
  const unit = ready ? rTo! / rFrom! : null

  const save = (a: string, b: string) => {
    setPair([a, b])
    try { localStorage.setItem(SAVED, JSON.stringify([a, b])) } catch { /* ignore */ }
  }
  const pick = (which: 'from' | 'to') => openCurrencyPicker(list, which === 'from' ? from : to,
    c => (which === 'from' ? save(c, to) : save(from, c)), which === 'from' ? 'Convert from' : 'Convert to')

  const chip = (code: string, which: 'from' | 'to') => (
    <button onClick={() => pick(which)} aria-label={which === 'from' ? 'Choose currency to convert from' : 'Choose currency to convert to'}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, border: `1px solid ${BDR}`, background: SURF2, color: TEXT, cursor: 'pointer', fontFamily: F, flexShrink: 0 }}>
      <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>{currencyFlag(code)}</span>
      <span style={{ fontSize: 15, fontWeight: 800 }}>{code}</span>
      <ChevronDown size={14} color={T3} />
    </button>
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', fontFamily: F, color: TEXT, padding: '4px 0 24px' }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Currency converter</div>
      <div style={{ fontSize: 13, color: T2, marginBottom: 16 }}>Live rates for every currency. Estimate only; your balance and payments are not affected.</div>

      <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>You have</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {chip(from, 'from')}
          <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} inputMode="decimal" aria-label="Amount"
            style={{ flex: 1, minWidth: 0, textAlign: 'right', background: 'transparent', border: 'none', outline: 'none', color: TEXT, fontFamily: F, fontSize: 24, fontWeight: 700 }} />
        </div>
        <div style={{ fontSize: 12, color: T3, marginTop: 6 }}>{nameOf(from)}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
          <div style={{ flex: 1, height: 1, background: BDR }} />
          <button onClick={() => save(to, from)} aria-label="Swap currencies"
            style={{ width: 36, height: 36, borderRadius: 18, border: `1px solid ${BDR}`, background: SURF2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowUpDown size={16} color={BLUE} />
          </button>
          <div style={{ flex: 1, height: 1, background: BDR }} />
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>They get</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {chip(to, 'to')}
          <div style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 24, fontWeight: 800, overflowWrap: 'anywhere' }} aria-live="polite">
            {result !== null ? money(result) : (rates ? '—' : 'Loading…')}
          </div>
        </div>
        <div style={{ fontSize: 12, color: T3, marginTop: 6 }}>{nameOf(to)}</div>
      </div>

      <div style={{ fontSize: 13, color: T2, textAlign: 'center', marginBottom: 18 }}>
        {unit !== null ? <>1 {from} = <b style={{ color: TEXT }}>{money(unit)} {to}</b></> : (rates ? 'No rate for this pair' : 'Getting live rates…')}
        {updatedAt && unit !== null && <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
      </div>

      {ready && Number.isFinite(value) && (
        <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 16, padding: '6px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '10px 0 4px' }}>{money(value)} {from} in other currencies</div>
          {QUICK.filter(c => c !== from && rateOf(c)).map(c => (
            <button key={c} onClick={() => save(from, c)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', background: 'none', border: 'none', borderTop: `1px solid ${BDR}`, color: TEXT, cursor: 'pointer', fontFamily: F, textAlign: 'left' }}>
              <span aria-hidden style={{ fontSize: 20 }}>{currencyFlag(c)}</span>
              <span style={{ fontSize: 14, fontWeight: 800, width: 40 }}>{c}</span>
              <span style={{ flex: 1, textAlign: 'right', fontSize: 15, fontWeight: 600 }}>{money((value / rFrom!) * rateOf(c)!)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
