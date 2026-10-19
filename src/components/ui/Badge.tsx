import React from 'react'

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'blue' | 'mono'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  dot?: boolean
  size?: 'sm' | 'md'
}

const styles: Record<BadgeVariant, React.CSSProperties> = {
  default: { background: 'var(--nan-surface-2)', color: 'var(--nan-text-2)', border: '1px solid var(--nan-border)' },
  success: { background: 'var(--nan-green-dim)',  color: 'var(--nan-green)', border: '1px solid rgba(16,185,129,0.22)' },
  danger:  { background: 'var(--nan-red-dim)',    color: 'var(--nan-red)',   border: '1px solid rgba(239,68,68,0.22)' },
  warning: { background: 'var(--nan-gold-dim)',   color: 'var(--nan-gold)',  border: '1px solid rgba(245,158,11,0.22)' },
  blue:    { background: 'var(--nan-blue-dim)',   color: 'var(--nan-blue)',  border: '1px solid rgba(59,130,246,0.20)' },
  mono:    { background: 'var(--nan-surface-2)',  color: 'var(--nan-text-2)', border: '1px solid var(--nan-border)',
             fontFamily: "'JetBrains Mono','SF Mono',Menlo,monospace", letterSpacing: '0.04em' },
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'var(--nan-text-3)',
  success: 'var(--nan-green)',
  danger:  'var(--nan-red)',
  warning: 'var(--nan-gold)',
  blue:    'var(--nan-blue)',
  mono:    'var(--nan-text-3)',
}

export function Badge({ variant = 'default', children, dot, size = 'md' }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: size === 'sm' ? '2px 7px' : '3px 9px', borderRadius: 100,
        fontSize: size === 'sm' ? 11 : 12, fontWeight: 600,
        fontFamily: "'Inter', -apple-system, sans-serif",
        whiteSpace: 'nowrap',
        ...styles[variant],
      }}
    >
      {dot && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: dotColors[variant], flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  )
}
