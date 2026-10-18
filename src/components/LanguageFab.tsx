import { openLanguagePicker, currentLanguageLabel } from '../lib/language-picker'

/** Small floating language button for public pages (pay links, landing, sign-in). */
export function LanguageFab() {
  return (
    <button onClick={openLanguagePicker} aria-label="Language" className="notranslate" translate="no"
      style={{ position: 'fixed', top: 12, right: 12, zIndex: 9000, display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 999, background: 'rgba(20,24,40,0.85)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', -apple-system, sans-serif", backdropFilter: 'blur(6px)', WebkitTapHighlightColor: 'transparent' }}>
      🌐 {currentLanguageLabel()}
    </button>
  )
}
