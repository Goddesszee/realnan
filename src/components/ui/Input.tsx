import React from 'react'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  error?: string
  helper?: string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  mono?: boolean
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helper?: string
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11, fontWeight: 600,
  color: 'var(--nan-text-3)',
  fontFamily: "'Inter', sans-serif",
  letterSpacing: '0.06em', textTransform: 'uppercase',
  marginBottom: 6,
}

const getInputStyle = (hasError?: string, mono?: boolean): React.CSSProperties => ({
  width: '100%',
  background: 'var(--nan-surface)',
  border: `1px solid ${hasError ? 'rgba(239,68,68,0.5)' : 'var(--nan-border-2)'}`,
  borderRadius: 'var(--nan-r-md)',
  padding: '11px 14px',
  fontSize: 'max(14px, 1em)',
  fontFamily: mono
    ? "'JetBrains Mono','SF Mono',Menlo,monospace"
    : "'Inter', sans-serif",
  fontVariantNumeric: mono ? 'tabular-nums' : undefined,
  color: 'var(--nan-text)',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  letterSpacing: '-0.01em',
  boxSizing: 'border-box',
  WebkitAppearance: 'none',
})

export function Input({ label, error, helper, prefix, suffix, mono, className, style, onFocus, onBlur, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && (
          <div style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--nan-text-3)', display: 'flex', alignItems: 'center', pointerEvents: 'none',
          }}>
            {prefix}
          </div>
        )}
        <input
          {...props}
          className={className}
          style={{
            ...getInputStyle(error, mono),
            paddingLeft: prefix ? 40 : 14,
            paddingRight: suffix ? 44 : 14,
            ...style,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--nan-blue)'
            e.target.style.boxShadow = '0 0 0 3px rgba(8,102,245,0.12)'
            onFocus?.(e)
          }}
          onBlur={(e) => {
            e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'var(--nan-border-2)'
            e.target.style.boxShadow = 'none'
            onBlur?.(e)
          }}
        />
        {suffix && (
          <div style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--nan-text-3)', display: 'flex', alignItems: 'center',
          }}>
            {suffix}
          </div>
        )}
      </div>
      {error  && <p style={{ marginTop: 4, fontSize: 12, color: 'var(--nan-red)', fontFamily: "'Inter', sans-serif" }}>{error}</p>}
      {helper && <p style={{ marginTop: 4, fontSize: 12, color: 'var(--nan-text-3)', fontFamily: "'Inter', sans-serif" }}>{helper}</p>}
    </div>
  )
}

export function Textarea({ label, error, helper, style, onFocus, onBlur, ...props }: TextareaProps) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={labelStyle}>{label}</label>}
      <textarea
        {...props}
        style={{
          ...getInputStyle(error),
          resize: 'vertical', minHeight: 80, paddingTop: 12,
          ...style,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--nan-blue)'
          e.target.style.boxShadow = '0 0 0 3px rgba(8,102,245,0.12)'
          onFocus?.(e)
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'var(--nan-border-2)'
          e.target.style.boxShadow = 'none'
          onBlur?.(e)
        }}
      />
      {error  && <p style={{ marginTop: 4, fontSize: 12, color: 'var(--nan-red)' }}>{error}</p>}
      {helper && <p style={{ marginTop: 4, fontSize: 12, color: 'var(--nan-text-3)' }}>{helper}</p>}
    </div>
  )
}
