/**
 * MorePage — full-screen mobile "More" menu.
 * Replaces the slide-over drawer. Renders all secondary nav sections
 * as clean, tappable rows inside the normal page scroll area.
 */
import { useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useNanTheme } from '../../hooks/useNanTheme'
import { useAppStore } from '../../store/appStore'
import { MOBILE_DRAWER_SECTIONS } from '../layout/AppShell'
import { NanLogo } from '../NanLogo'

const F = "'Inter', -apple-system, sans-serif"
const ADMIN_ADDRESS = (import.meta.env.VITE_ADMIN_ADDRESS as string ?? '').toLowerCase()

export function MorePage() {
  const C = useNanTheme()
  const { setActiveView, profile, auth, nanHandle } = useAppStore()

  const name   = profile?.displayName || auth?.email?.split('@')[0] || 'Your account'
  const handle = nanHandle ? `@${nanHandle}` : auth?.email ?? ''

  const go = (id: string) => setActiveView(id)

  // 5-tap logo → admin (mirrors AppShell logic)
  const walletAddress = auth?.walletAddress ?? auth?.circleWalletAddress ?? ''
  const isAdmin = ADMIN_ADDRESS === '' ? true : (!!walletAddress && walletAddress.toLowerCase() === ADMIN_ADDRESS)
  const tapCount = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [adminToast, setAdminToast] = useState(false)
  const handleLogoTap = () => {
    if (!isAdmin) return
    tapCount.current += 1
    if (tapTimer.current) clearTimeout(tapTimer.current)
    if (tapCount.current >= 5) {
      tapCount.current = 0
      setActiveView('admin')
      setAdminToast(true)
      setTimeout(() => setAdminToast(false), 2000)
      return
    }
    tapTimer.current = setTimeout(() => { tapCount.current = 0 }, 1500)
  }

  return (
    <div style={{ fontFamily: F, paddingBottom: 24 }}>

      {/* ── Profile row ── */}
      <button
        onClick={() => go('profile')}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 0 14px', background: 'none', border: 'none',
          borderBottom: `1px solid ${C.bdr}`, cursor: 'pointer',
          fontFamily: F, textAlign: 'left', marginBottom: 8,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <NanLogo height={44} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          {handle && <div style={{ fontSize: 12, color: C.t2, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{handle}</div>}
        </div>
        <ChevronRight size={16} color={C.t3} style={{ flexShrink: 0 }} />
      </button>

      {adminToast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#2563EB', color: '#fff', padding: '7px 18px', borderRadius: 20, fontSize: 12, fontWeight: 600, zIndex: 300, pointerEvents: 'none' }}>Admin unlocked</div>
      )}

      {/* ── Sections ── */}
      {MOBILE_DRAWER_SECTIONS.map((section, si) => (
        <div key={section.title} style={{ marginTop: si === 0 ? 0 : 16 }}>
          {/* Section label */}
          <div style={{
            fontSize: 11, fontWeight: 600, color: C.t3,
            textTransform: 'uppercase', letterSpacing: '0.07em',
            marginBottom: 4,
          }}>{section.title}</div>

          {/* Item rows */}
          <div style={{
            background: C.surf, border: `1px solid ${C.bdr}`,
            borderRadius: 14, overflow: 'hidden',
          }}>
            {section.items.map(({ id, label, Icon, desc }, idx) => {
              const isLast = idx === section.items.length - 1
              return (
                <button
                  key={id}
                  onClick={() => go(id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: F, textAlign: 'left',
                    borderBottom: isLast ? 'none' : `1px solid ${C.bdr}`,
                    WebkitTapHighlightColor: 'transparent',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background: C.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={15} color={C.t2} strokeWidth={1.8} />
                  </div>
                  {/* Label + desc */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text, lineHeight: 1.3 }}>{label}</div>
                    {desc && <div style={{ fontSize: 11, color: C.t3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</div>}
                  </div>
                  <ChevronRight size={14} color={C.t3} style={{ flexShrink: 0 }} />
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* ── NAN logo footer — tap 5× to unlock admin ── */}
      <div
        onClick={handleLogoTap}
        style={{
          marginTop: 32, display: 'flex', justifyContent: 'center', alignItems: 'center',
          paddingBottom: 8, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          opacity: 0.45,
        }}
      >
        <NanLogo height={32} showText />
      </div>
    </div>
  )
}
