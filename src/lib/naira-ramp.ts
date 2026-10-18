/**
 * Naira on/off-ramp switch.
 * Hidden for everyone until a licensed partner is connected. To preview the screens on one device,
 * run localStorage.setItem('nan_flag_naira','1') in the browser; to turn on for all users, set the
 * Vercel env var VITE_NAIRA_RAMP=on.
 */
export function nairaRampVisible(): boolean {
  try {
    if (import.meta.env.VITE_NAIRA_RAMP === 'on') return true
    return localStorage.getItem('nan_flag_naira') === '1'
  } catch { return false }
}

export interface RampStatus { configured: boolean }

/** Asks the server whether a ramp partner is connected. Failure means "not connected". */
export async function fetchRampStatus(): Promise<RampStatus> {
  try {
    const r = await fetch('/api/naira-ramp?action=status')
    const j = await r.json() as { configured?: boolean }
    return { configured: j.configured === true }
  } catch { return { configured: false } }
}
