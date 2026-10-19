import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'blue' | 'flat'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const padMap = { none: 0, sm: 14, md: 20, lg: 28 }

export function Card({ variant = 'default', padding = 'md', className = '', style, children, ...props }: CardProps) {
  const base: React.CSSProperties = {
    borderRadius: 'var(--nan-r-xl)',
    background:
      variant === 'blue'     ? 'var(--nan-blue-dim)'   :
      variant === 'elevated' ? 'var(--nan-surface-2)'  :
      variant === 'flat'     ? 'transparent'           :
                               'var(--nan-surface)',
    border:
      variant === 'blue'  ? '1px solid rgba(37,99,235,0.20)' :
      variant === 'flat'  ? 'none'                           :
                            '1px solid var(--nan-border)',
    padding: padding === 'none' ? undefined : padMap[padding],
    ...style,
  }
  return (
    <div {...props} className={className} style={base}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14,
        fontFamily: "'Inter', sans-serif",
        fontSize: 11, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--nan-text-3)',
      }}
    >
      {children}
    </div>
  )
}

export function CardRow({ label, value, mono = false, className = '' }: {
  label: string; value: React.ReactNode; mono?: boolean; className?: string
}) {
  return (
    <div
      className={className}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 0', borderBottom: '1px solid var(--nan-border)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--nan-text-2)', fontFamily: "'Inter', sans-serif" }}>{label}</span>
      <span style={{
        fontSize: 14, fontWeight: 600, color: 'var(--nan-text)',
        fontFamily: mono ? "'JetBrains Mono','SF Mono',Menlo,monospace" : "'Inter', sans-serif",
        fontVariantNumeric: mono ? 'tabular-nums' : undefined,
      }}>{value}</span>
    </div>
  )
}
