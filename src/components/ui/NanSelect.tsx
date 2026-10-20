/**
 * NanSelect — mobile-friendly custom select using a bottom sheet.
 * Replaces native <select> which is unreliable on Android WebView.
 *
 * NanDatePicker — month/day/year bottom sheet date picker.
 */
import { useState } from 'react'
import { ChevronDown, Check, X, Calendar } from 'lucide-react'
import { useNanTheme } from '../../hooks/useNanTheme'

// ── NanSelect ────────────────────────────────────────────────────────────────
export interface NanSelectOption {
  value: string
  label: string
  sub?: string
}

interface NanSelectProps {
  value: string
  onChange: (v: string) => void
  options: NanSelectOption[]
  placeholder?: string
  label?: string
  style?: React.CSSProperties
}

export function NanSelect({ value, onChange, options, placeholder = 'Select…', label, style }: NanSelectProps) {
  const C = useNanTheme()
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)

  const triggerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '10px 12px', borderRadius: 10,
    border: `1px solid ${C.bdr}`, background: C.surf2,
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
    fontSize: 14, fontWeight: 600, color: selected ? C.text : C.t3,
    fontFamily: "'Inter', sans-serif", minHeight: 42,
    ...style,
  }

  return (
    <>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
          {label}
        </div>
      )}
      <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDown size={14} color={C.t3} />
      </button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: C.surf, borderRadius: '20px 20px 0 0', padding: '0 0 max(20px, env(safe-area-inset-bottom)) 0', fontFamily: "'Inter', sans-serif", maxHeight: '70vh', overflowY: 'auto' }}
          >
            {/* Handle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{label ?? placeholder}</div>
              <button type="button" onClick={() => setOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, background: C.surf2, border: `1px solid ${C.bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} color={C.t3} />
              </button>
            </div>
            <div style={{ height: 1, background: C.bdr }} />
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: `1px solid ${C.bdr}`, WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: opt.value === value ? C.blue : C.text }}>{opt.label}</div>
                  {opt.sub && <div style={{ fontSize: 12, color: C.t3, marginTop: 1 }}>{opt.sub}</div>}
                </div>
                {opt.value === value && <Check size={16} color={C.blue} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── NanDatePicker ─────────────────────────────────────────────────────────────
interface NanDatePickerProps {
  value: string          // ISO: YYYY-MM-DD or ''
  onChange: (v: string) => void
  label?: string
  placeholder?: string
  style?: React.CSSProperties
  minYear?: number
  maxYear?: number
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function NanDatePicker({ value, onChange, label, placeholder = 'Select date', style, minYear, maxYear }: NanDatePickerProps) {
  const C = useNanTheme()
  const [open, setOpen] = useState(false)

  const curYear = new Date().getFullYear()
  const minY = minYear ?? curYear - 1
  const maxY = maxYear ?? curYear + 5

  const parsed = value ? value.split('-') : ['', '', '']
  const initYear  = parseInt(parsed[0] ?? '') || curYear
  const initMonth = parseInt(parsed[1] ?? '') || new Date().getMonth() + 1
  const initDay   = parseInt(parsed[2] ?? '') || 1

  const [selYear,  setSelYear]  = useState(() => initYear)
  const [selMonth, setSelMonth] = useState(() => initMonth)
  const [selDay,   setSelDay]   = useState(() => initDay)

  const maxDay = daysInMonth(selYear, selMonth)
  const safeDay = Math.min(selDay, maxDay)

  const displayValue = value
    ? `${MONTHS_SHORT[selMonth - 1]} ${safeDay}, ${selYear}`
    : ''

  const handleConfirm = () => {
    const d = Math.min(selDay, daysInMonth(selYear, selMonth))
    onChange(`${selYear}-${String(selMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
    setOpen(false)
  }

  const scrollRow = (items: { value: number; label: string }[], current: number, onSelect: (v: number) => void) => (
    <div style={{ flex: 1, overflowY: 'auto', maxHeight: 200, borderRadius: 10, background: C.surf2, border: `1px solid ${C.bdr}` }}>
      {items.map(item => (
        <button
          key={item.value}
          type="button"
          onClick={() => onSelect(item.value)}
          style={{
            width: '100%', padding: '11px 10px', background: item.value === current ? C.blue + '18' : 'none',
            border: 'none', borderBottom: `1px solid ${C.bdr}`, cursor: 'pointer',
            fontSize: 14, fontWeight: item.value === current ? 700 : 500,
            color: item.value === current ? C.blue : C.text,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )

  const triggerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '10px 12px', borderRadius: 10,
    border: `1px solid ${C.bdr}`, background: C.surf2,
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
    fontSize: 14, fontWeight: 600, color: displayValue ? C.text : C.t3,
    fontFamily: "'Inter', sans-serif", minHeight: 42, width: '100%',
    ...style,
  }

  return (
    <>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
          {label}
        </div>
      )}
      <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>
        <span>{displayValue || placeholder}</span>
        <Calendar size={14} color={C.t3} />
      </button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: C.surf, borderRadius: '20px 20px 0 0', padding: '16px 20px max(24px, env(safe-area-inset-bottom))', fontFamily: "'Inter', sans-serif" }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{label ?? 'Select date'}</div>
              <button type="button" onClick={() => setOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, background: C.surf2, border: `1px solid ${C.bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} color={C.t3} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {scrollRow(
                MONTHS.map((m, i) => ({ value: i + 1, label: m })),
                selMonth, setSelMonth
              )}
              {scrollRow(
                Array.from({ length: maxDay }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
                safeDay, (v) => { setSelDay(v) }
              )}
              {scrollRow(
                Array.from({ length: maxY - minY + 1 }, (_, i) => ({ value: minY + i, label: String(minY + i) })),
                selYear, setSelYear
              )}
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              style={{ width: '100%', padding: '14px', borderRadius: 12, background: C.blue, color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </>
  )
}
