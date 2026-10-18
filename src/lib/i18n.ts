/**
 * Language support. Choosing a language translates what is on screen automatically.
 * - English is the default and the original text: nothing runs when English is selected.
 * - Text is translated on the server (cached for everyone) and swapped in as it arrives.
 * - If a translation is not ready or something fails, the English text simply stays.
 * - Wallet addresses, emails, links, long numbers and code are never sent for translation.
 */
import { languageByCode } from './languages'

const KEY = 'nan_lang'
const CACHE_PREFIX = 'nan_tr1_'
const MAX_CACHED = 5000
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'] as const

export function getLang(): string {
  try { return localStorage.getItem(KEY) || 'en' } catch { return 'en' }
}

/** Saves the choice and reloads so the page starts cleanly in the new language. */
export function setLang(code: string) {
  try { localStorage.setItem(KEY, code) } catch { /* ignore */ }
  window.location.reload()
}

const SKIP_ANCESTORS = 'script,style,code,pre,textarea,noscript,[translate="no"],.notranslate'

function translatable(s: string): boolean {
  if (s.length < 2 || s.length > 400) return false
  if (!/\p{L}/u.test(s)) return false
  if (/@|https?:\/\/|www\.|0x[0-9a-fA-F]{6,}|\d{7,}/.test(s)) return false
  if (/^[A-Z0-9 ·.\-/]{1,8}$/.test(s)) return false // tickers and codes: USD, EURC, ARC
  return true
}

export function initTranslator() {
  const code = getLang()
  if (code === 'en' || typeof document === 'undefined') return
  const lang = languageByCode(code)
  if (!lang) return

  document.documentElement.lang = code
  document.documentElement.dir = lang.rtl ? 'rtl' : 'ltr'

  // ── cache ────────────────────────────────────────────────────────────────
  const cache = new Map<string, string>()
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + code)
    if (raw) Object.entries(JSON.parse(raw) as Record<string, string>).forEach(([k, v]) => cache.set(k, v))
  } catch { /* ignore */ }
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const persist = () => {
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      try {
        while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string)
        localStorage.setItem(CACHE_PREFIX + code, JSON.stringify(Object.fromEntries(cache)))
      } catch { /* storage full: fine */ }
    }, 1500)
  }

  // ── queue to the server ──────────────────────────────────────────────────
  const pending = new Set<string>()
  const attempts = new Map<string, number>()
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let inflight = 0
  let stopped = false

  const queue = (s: string) => {
    if (stopped || pending.has(s) || (attempts.get(s) ?? 0) >= 3) return
    pending.add(s)
    if (!flushTimer) flushTimer = setTimeout(flush, 250)
  }

  async function flush() {
    flushTimer = null
    if (stopped) return
    while (pending.size > 0 && inflight < 2) {
      const batch = [...pending].slice(0, 40)
      batch.forEach(s => pending.delete(s))
      inflight++
      void (async () => {
        try {
          const r = await fetch('/api/translate', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ lang: code, langName: lang!.en, strings: batch }),
          })
          const j = await r.json() as { translations?: Record<string, string>; limited?: boolean }
          if (j.limited) stopped = true
          let got = 0
          for (const s of batch) {
            const t = j.translations?.[s]
            if (typeof t === 'string' && t) { cache.set(s, t); got++ } else attempts.set(s, (attempts.get(s) ?? 0) + 1)
          }
          if (got > 0) { persist(); scheduleScan() }
        } catch {
          batch.forEach(s => attempts.set(s, (attempts.get(s) ?? 0) + 1))
        } finally {
          inflight--
          if (pending.size > 0 && !flushTimer) flushTimer = setTimeout(flush, 250)
        }
      })()
    }
  }

  // ── applying translations ────────────────────────────────────────────────
  const appliedText = new WeakMap<Node, string>()
  const appliedAttr = new WeakMap<Element, Record<string, string>>()

  const skip = (el: Element | null) => !el || !!el.closest(SKIP_ANCESTORS)

  function doText(node: Text) {
    const value = node.nodeValue ?? ''
    if (appliedText.get(node) === value) return
    const core = value.trim()
    if (!translatable(core) || skip(node.parentElement)) return
    const tr = cache.get(core)
    if (tr) {
      const next = value.replace(core, tr)
      appliedText.set(node, next)
      node.nodeValue = next
    } else queue(core)
  }

  function doAttrs(el: Element) {
    if (skip(el)) return
    for (const a of ATTRS) {
      const value = el.getAttribute(a)
      if (!value || appliedAttr.get(el)?.[a] === value) continue
      const core = value.trim()
      if (!translatable(core)) continue
      const tr = cache.get(core)
      if (tr) {
        const rec = appliedAttr.get(el) ?? {}
        rec[a] = tr
        appliedAttr.set(el, rec)
        el.setAttribute(a, tr)
      } else queue(core)
    }
  }

  function scan(root: Node) {
    if (root.nodeType === Node.TEXT_NODE) { doText(root as Text); return }
    if (root.nodeType !== Node.ELEMENT_NODE) return
    const el = root as Element
    if (skip(el)) return
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let n = walker.nextNode()
    while (n) { doText(n as Text); n = walker.nextNode() }
    doAttrs(el)
    el.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(doAttrs)
  }

  let scanTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleScan = () => {
    if (scanTimer) return
    scanTimer = setTimeout(() => { scanTimer = null; scan(document.body) }, 80)
  }

  const observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach(scan)
      else if (m.type === 'characterData') doText(m.target as Text)
      else if (m.type === 'attributes') doAttrs(m.target as Element)
    }
  })

  const start = () => {
    scan(document.body)
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
  }
  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start, { once: true })
}
