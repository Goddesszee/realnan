import React from 'react'

type Variant = 'primary' | 'ghost' | 'danger' | 'success' | 'soft' | 'secondary'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  fullWidth?: boolean
}

const FONT = "'Inter', -apple-system, sans-serif"

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { fontSize: 12,  padding: '7px 13px',  borderRadius: 8,  minHeight: 32 },
  md: { fontSize: 14,  padding: '10px 18px', borderRadius: 10, minHeight: 40 },
  lg: { fontSize: 15,  padding: '13px 22px', borderRadius: 12, minHeight: 48 },
}

function getVariantStyle(variant: Variant): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        background: 'var(--nan-blue)',
        color: '#fff',
        border: 'none',
        boxShadow: '0 2px 10px rgba(37,99,235,0.25)',
      }
    case 'secondary':
      return {
        background: 'var(--nan-surface-2)',
        color: 'var(--nan-text)',
        border: '1px solid var(--nan-border-2)',
      }
    case 'ghost':
      return {
        background: 'transparent',
        color: 'var(--nan-text-2)',
        border: '1px solid var(--nan-border)',
      }
    case 'soft':
      return {
        background: 'var(--nan-blue-dim)',
        color: 'var(--nan-blue)',
        border: '1px solid rgba(37,99,235,0.20)',
      }
    case 'danger':
      return {
        background: 'var(--nan-red-dim)',
        color: 'var(--nan-red)',
        border: '1px solid rgba(239,68,68,0.22)',
      }
    case 'success':
      return {
        background: 'var(--nan-green-dim)',
        color: 'var(--nan-green)',
        border: '1px solid rgba(16,185,129,0.22)',
      }
  }
}

export function Button({
  variant = 'primary', size = 'md', loading = false,
  icon, iconRight, fullWidth = false, children, style, disabled, ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        fontFamily: FONT, fontWeight: 600, letterSpacing: '-0.01em',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.42 : 1,
        transition: 'opacity 0.15s, background 0.15s, transform 0.12s',
        width: fullWidth ? '100%' : undefined,
        WebkitTapHighlightColor: 'transparent',
        ...sizeStyles[size],
        ...getVariantStyle(variant),
        ...style,
      }}
    >
      {loading ? (
        <span style={{
          display: 'inline-block', width: 14, height: 14, flexShrink: 0,
          border: '2px solid currentColor', borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'nan-spin 0.7s linear infinite',
        }} />
      ) : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
}
