import React from 'react'

export function Spinner({ size = 20, color = 'var(--nan-blue)' }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid var(--nan-border)`,
        borderTopColor: color,
        animation: 'nan-spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

export function LoadingDots({ color = 'var(--nan-text-2)' }: { color?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 4, height: 4, borderRadius: '50%', background: color,
            display: 'inline-block',
            animation: `nanTyping 1.2s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
    </span>
  )
}

export function PageLoader() {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14,
      background: 'var(--nan-bg)', zIndex: 999,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 11,
        background: 'var(--nan-blue)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 800, color: '#fff',
        boxShadow: '0 8px 24px rgba(37,99,235,0.30)',
        marginBottom: 4,
      }}>N</div>
      <Spinner size={22} />
      <p style={{
        fontSize: 12, color: 'var(--nan-text-3)',
        fontFamily: "'Inter', sans-serif",
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        loading
      </p>
    </div>
  )
}
