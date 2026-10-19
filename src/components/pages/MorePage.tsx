/**
 * MorePage — full-screen mobile "More" menu.
 * Replaces the slide-over drawer. Renders all secondary nav sections
 * as clean, tappable rows inside the normal page scroll area.
 */
import { useEffect, useState } from 'react'
import { ChevronRight, AtSign } from 'lucide-react'
import { useNanTheme } from '../../hooks/useNanTheme'
import { useAppStore } from '../../store/appStore'
import { MOBILE_DRAWER_SECTIONS } from '../layout/AppShell'
import { NanLogo } from '../NanLogo'

const F = "'Inter', -apple-system, sans-serif"

// Blinking dot indicator
function BlinkDot() {
  const [on, setOn] = useState(true)
  useEffect(() => {
    const t = setInterval(() => setOn(v => !v), 600)
    return () => clearInterval(t)
  }, [])
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: '#F59E0B', marginRight: 5, flexShrink: 0,
      opacity: on ? 1 : 0.15, transition: 'opacity 0.2s',
      verticalAlign: 'middle',
    }} />
  )
}

export function MorePage() {
  const C = useNanTheme()
  const { setActiveView, nanHandle } = useAppStore()

  const go = (id: string) => setActiveView(id)
  const hasName = Boolean(nanHandle)

  return (
    <div style={{ fontFamily: F, paddingBottom: 24 }}>

      {/* ── Profile row ── */}
      <button
        onClick={() => go(hasName ? 'profile' : 'nan-name')}
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
          {hasName ? (
            /* Has NAN name — show it prominently */
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <AtSign size={14} color={C.blue} strokeWidth={2.5} />
              <span style={{ fontSize: 16, fontWeight: 700, color: C.blue, letterSpacing: '-0.01em' }}>{nanHandle}</span>
            </div>
          ) : (
            /* No NAN name — blinking CTA */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 700, color: '#F59E0B' }}>
                <BlinkDot />
                Get your NAN name
              </div>
              <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Tap to claim your @name</div>
            </div>
          )}
        </div>
        <ChevronRight size={16} color={hasName ? C.t3 : '#F59E0B'} style={{ flexShrink: 0 }} />
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
