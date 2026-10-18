/**
 * Display currency: shows an approximate local-currency value next to USD/USDC amounts.
 * Display only. It never changes any balance, payment or on-chain amount.
 * The choice is stored on this device; rates are cached for a few hours.
 */
import { useEffect, useState, useCallback } from 'react'

export interface DisplayCurrency { code: string; name: string }

/** Currencies offered in Settings. 'USD' means "off" (show dollars only). */
export const DISPLAY_CURRENCIES: DisplayCurrency[] = [
  { code: 'USD', name: 'None (US dollars only)' },
  { code: 'NGN', name: 'Nigerian naira (₦)' },
  { code: 'GHS', name: 'Ghanaian cedi' },
  { code: 'KES', name: 'Kenyan shilling' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'UGX', name: 'Ugandan shilling' },
  { code: 'TZS', name: 'Tanzanian shilling' },
  { code: 'EGP', name: 'Egyptian pound' },
  { code: 'XOF', name: 'West African CFA franc' },
  { code: 'GBP', name: 'British pound (£)' },
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'BRL', name: 'Brazilian real' },
  { code: 'PHP', name: 'Philippine peso' },
]

const KEY_CODE  = 'nan_display_currency'
const KEY_RATES = 'nan_fx_rates_v1'
const MAX_AGE   = 6 * 60 * 60 * 1000 // 6 hours

interface RateCache { at: number; rates: Record<string, number> }

function readCode(): string {
  try {
    const v = localStorage.getItem(KEY_CODE)
    if (v && DISPLAY_CURRENCIES.some(c => c.code === v)) return v
    // First visit: people in Nigeria see naira by default; everyone else starts with it off.
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Africa/Lagos') return 'NGN'
  } catch { /* ignore */ }
  return 'USD'
}

function readCache(): RateCache | null {
  try {
    const raw = localStorage.getItem(KEY_RATES)
    if (!raw) return null
    const c = JSON.parse(raw) as RateCache
    return c && typeof c.at === 'number' && c.rates ? c : null
  } catch { return null }
}

/** Rates per 1 USD from the first source that answers; each is tried in turn. */
async function fetchRates(): Promise<Record<string, number> | null> {
  const attempts: Array<() => Promise<Record<string, number>>> = [
    async () => {
      const r = await fetch('https://open.er-api.com/v6/latest/USD')
      const j = await r.json() as { result?: string; rates?: Record<string, number> }
      if (j.result !== 'success' || !j.rates) throw new Error('bad')
      return j.rates
    },
    async () => {
      const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
      const j = await r.json() as { usd?: Record<string, number> }
      if (!j.usd) throw new Error('bad')
      return Object.fromEntries(Object.entries(j.usd).map(([k, v]) => [k.toUpperCase(), v]))
    },
  ]
  for (const go of attempts) {
    try {
      const rates = await go()
      if (rates && typeof rates.NGN === 'number' && rates.NGN > 0) return rates
    } catch { /* try next */ }
  }
  return null
}

let inflight: Promise<RateCache | null> | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(l => l())

async function ensureRates(): Promise<RateCache | null> {
  const cached = readCache()
  if (cached && Date.now() - cached.at < MAX_AGE) return cached
  if (!inflight) {
    inflight = fetchRates().then(rates => {
      if (rates) {
        const c = { at: Date.now(), rates }
        try { localStorage.setItem(KEY_RATES, JSON.stringify(c)) } catch { /* ignore */ }
        return c
      }
      return readCache() // fall back to older cached rates if the network failed
    }).finally(() => { inflight = null })
  }
  return inflight
}

export function formatLocal(usd: number, code: string, perUsd: number): string {
  const v = usd * perUsd
  const digits = perUsd >= 50 || v >= 1000 ? 0 : 2
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)
  } catch {
    return `${code} ${v.toLocaleString('en', { maximumFractionDigits: digits })}`
  }
}

export function useDisplayCurrency() {
  const [code, setCodeState] = useState<string>(readCode)
  const [cache, setCache]    = useState<RateCache | null>(readCache)

  useEffect(() => {
    const sync = () => { setCodeState(readCode()); setCache(readCache()) }
    listeners.add(sync)
    return () => { listeners.delete(sync) }
  }, [])

  useEffect(() => {
    if (code === 'USD') return
    let live = true
    void ensureRates().then(c => { if (live && c) setCache(c) })
    return () => { live = false }
  }, [code])

  const setCode = useCallback((next: string) => {
    try { localStorage.setItem(KEY_CODE, next) } catch { /* ignore */ }
    notify()
  }, [])

  const perUsd = code !== 'USD' ? cache?.rates[code] : undefined
  /** "≈ ₦402,500", or null when off or no rate is available yet. */
  const approx = useCallback((usd: number): string | null => {
    if (!perUsd || !Number.isFinite(usd)) return null
    return `≈ ${formatLocal(usd, code, perUsd)}`
  }, [perUsd, code])

  return { code, setCode, approx, ready: Boolean(perUsd), updatedAt: cache ? new Date(cache.at) : null }
}
