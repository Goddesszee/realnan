/**
 * useNanTheme — returns a reactive color palette that flips between
 * dark and light mode by reading the CSS custom properties set on
 * <html data-theme="dark|light">.
 *
 * Every component that previously hard-coded hex strings should import
 * this hook and destructure what it needs. When the user toggles the
 * theme in Settings the store calls setTheme(), which updates
 * data-theme on <html>, which triggers a re-render here, which
 * propagates the new values down.
 *
 * NAN Brand Direction
 * -------------------
 * Premium, professional, clean. Electric blue (#3B82F6) as the sole
 * accent. Deep navy backgrounds. Restrained use of color — only for
 * meaningful signals (actions, status, highlights).
 */
import { useSyncExternalStore } from 'react'

export interface NanTheme {
  bg:      string   // page background
  surf:    string   // card / panel surface
  surf2:   string   // elevated surface (inputs, secondary cards)
  surf3:   string   // highest elevation (tooltips, menus)
  bdr:     string   // default border
  bdr2:    string   // stronger border
  text:    string   // primary text
  t2:      string   // secondary text
  t3:      string   // muted / placeholder text
  blue:    string   // brand accent — electric blue
  blueDim: string   // low-opacity blue tint for backgrounds
  blueBd:  string   // blue border / outline
  green:   string   // success
  red:     string   // error / destructive
  gold:    string   // warning / pending
  isDark:  boolean
}

// ── DARK palette ─────────────────────────────────────────────────────────────
// Deep navy + electric blue. Restrained — no purple, no neon.
const DARK: NanTheme = {
  bg:      '#0B0F19',
  surf:    '#111827',
  surf2:   '#1A2235',
  surf3:   '#202C42',
  bdr:     'rgba(255,255,255,0.07)',
  bdr2:    'rgba(255,255,255,0.13)',
  text:    '#F9FAFB',
  t2:      '#9CA3AF',
  t3:      '#4B5563',
  blue:    '#3B82F6',
  blueDim: 'rgba(59,130,246,0.10)',
  blueBd:  'rgba(59,130,246,0.28)',
  green:   '#10B981',
  red:     '#EF4444',
  gold:    '#F59E0B',
  isDark:  true,
}

// ── LIGHT palette ─────────────────────────────────────────────────────────────
// Clean white + electric blue. High contrast, minimal shadows.
const LIGHT: NanTheme = {
  bg:      '#F5F7FA',
  surf:    '#FFFFFF',
  surf2:   '#F0F2F5',
  surf3:   '#E5E8EF',
  bdr:     'rgba(0,0,0,0.08)',
  bdr2:    'rgba(0,0,0,0.14)',
  text:    '#111827',
  t2:      '#4B5563',
  t3:      '#9CA3AF',
  blue:    '#2563EB',
  blueDim: 'rgba(37,99,235,0.08)',
  blueBd:  'rgba(37,99,235,0.22)',
  green:   '#059669',
  red:     '#DC2626',
  gold:    '#D97706',
  isDark:  false,
}

// subscribe to data-theme mutations on <html>
let listeners: Array<() => void> = []
if (typeof document !== 'undefined') {
  const obs = new MutationObserver(() => listeners.forEach(l => l()))
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
}

function subscribe(cb: () => void) {
  listeners.push(cb)
  return () => { listeners = listeners.filter(l => l !== cb) }
}

function getSnapshot() {
  return typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-theme') ?? 'dark'
    : 'dark'
}

export function useNanTheme(): NanTheme {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => 'dark')
  return raw === 'light' ? LIGHT : DARK
}
