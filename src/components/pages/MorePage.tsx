/**
 * MorePage — full-screen mobile "More" menu.
 * Replaces the slide-over drawer. Renders all secondary nav sections
 * as clean, tappable rows inside the normal page scroll area.
 */
import { ChevronRight } from 'lucide-react'
import { useNanTheme } from '../../hooks/useNanTheme'
import { useAppStore } from '../../store/appStore'
import { MOBILE_DRAWER_SECTIONS } from '../layout/AppShell'
import { NanLogo } from '../NanLogo'

const F = "'Inter', -apple-system, sans-serif"
export function MorePage() {
  const C = useNanTheme()
  const { setActiveView, profile, auth, nanHandle } = useAppStore()

  const name   = profile?.displayName || auth?.email?.split('@')[0] || 'Your account'
  const handle = nanHandle ? `@${nanHandle}` : auth?.email ?? ''

  const go = (id: string) => setActiveView(id)

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

    </div>
  )
}
