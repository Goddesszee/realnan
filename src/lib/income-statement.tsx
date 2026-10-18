/**
 * Income statement: a clean, printable summary of payments recorded in NAN.
 * Useful as proof of income. It lists what NAN has on record, nothing more.
 */
import { createRoot } from 'react-dom/client'
import type { Invoice } from '../store/appStore'
import { printHtml } from './invoice-pdf'

export type StatementPeriod = 'month' | 'last-month' | 'year' | 'all'

const F = "'Inter', -apple-system, sans-serif"
const esc = (v: string) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const money = (n: number) => n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (d: Date) => d.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })

interface Row { date: Date; number: string; customer: string; amount: number; currency: string; tx?: string }

export function periodRange(p: StatementPeriod, now = new Date()): { from: Date; to: Date; label: string } {
  const y = now.getFullYear(), m = now.getMonth()
  if (p === 'month') return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1), label: now.toLocaleDateString('en', { month: 'long', year: 'numeric' }) }
  if (p === 'last-month') { const f = new Date(y, m - 1, 1); return { from: f, to: new Date(y, m, 1), label: f.toLocaleDateString('en', { month: 'long', year: 'numeric' }) } }
  if (p === 'year') return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1), label: String(y) }
  return { from: new Date(1970, 0, 1), to: new Date(9999, 0, 1), label: 'All time' }
}

/** Every payment received on the given invoices within the period. */
export function collectPayments(invoices: Invoice[], from: Date, to: Date): Row[] {
  const rows: Row[] = []
  for (const inv of invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft') continue
    const entries = inv.payments ?? []
    if (entries.length) {
      for (const p of entries) {
        const d = new Date(p.date)
        if (Number.isFinite(d.getTime()) && d >= from && d < to && p.amount > 0)
          rows.push({ date: d, number: inv.number, customer: inv.customerName, amount: p.amount, currency: inv.currency, tx: p.txHash })
      }
    } else if (inv.amountPaid > 0) {
      const d = new Date(inv.updatedAt || inv.createdAt)
      if (Number.isFinite(d.getTime()) && d >= from && d < to)
        rows.push({ date: d, number: inv.number, customer: inv.customerName, amount: inv.amountPaid, currency: inv.currency })
    }
  }
  return rows.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function buildStatementHtml(invoices: Invoice[], period: StatementPeriod): { html: string; count: number } {
  const { from, to, label } = periodRange(period)
  const rows = collectPayments(invoices, from, to)
  const latest = [...invoices].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0]
  const business = esc(latest?.businessName || 'NAN user')
  const totals = new Map<string, number>()
  rows.forEach(r => totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amount))
  const totalHtml = [...totals.entries()].map(([c, v]) => `<div style="font-size:26px;font-weight:800;letter-spacing:-0.03em">${money(v)} <span style="font-size:14px;color:#6B7280;font-weight:700">${esc(c)}</span></div>`).join('') || '<div style="font-size:18px;color:#6B7280">No payments recorded</div>'
  const body = rows.map(r => `<tr>
      <td>${esc(day(r.date))}</td><td>${esc(r.number)}</td><td>${esc(r.customer || '-')}</td>
      <td style="text-align:right;font-weight:700">${money(r.amount)} ${esc(r.currency)}</td>
      <td style="font-family:monospace;font-size:11px;color:#6B7280">${r.tx && /^0x[0-9a-fA-F]{8,}$/.test(r.tx) ? esc(r.tx.slice(0, 10)) + '…' + esc(r.tx.slice(-6)) : '-'}</td></tr>`).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Income statement ${esc(label)}</title>
<style>*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;margin:0;padding:32px;max-width:820px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;border-bottom:1px solid #E5E7EB;padding:8px 6px}
td{padding:9px 6px;border-bottom:1px solid #F3F4F6}.box{margin-top:18px;padding:16px 18px;background:#F3F6FF;border-radius:12px}
.note{margin-top:26px;font-size:11px;color:#6B7280;line-height:1.6}@media print{body{padding:0}}</style></head><body>
<div style="font-size:12px;font-weight:800;color:#0866F5;letter-spacing:.08em">NAN · INCOME STATEMENT</div>
<h1>${business}</h1><div style="font-size:13px;color:#6B7280">Period: ${esc(label)} · Generated ${esc(day(new Date()))}</div>
<div class="box"><div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Total received</div>${totalHtml}
<div style="font-size:12px;color:#6B7280;margin-top:6px">${rows.length} payment${rows.length === 1 ? '' : 's'}</div></div>
<table><thead><tr><th>Date</th><th>Invoice</th><th>From</th><th style="text-align:right">Amount</th><th>Transaction</th></tr></thead><tbody>${body || '<tr><td colspan="5" style="color:#6B7280;padding:18px 6px">No payments recorded in this period.</td></tr>'}</tbody></table>
<div class="note">This statement lists payments recorded in NAN for this account. Payments with a transaction reference were made on Arc with Circle USDC or EURC and can be checked on the Arc explorer. Payments marked paid by hand have no transaction reference. NAN is not a bank and this is not a tax document.</div>
</body></html>`
  return { html, count: rows.length }
}

function Sheet({ invoices, onClose }: { invoices: Invoice[]; onClose: () => void }) {
  const opts: { id: StatementPeriod; label: string }[] = [
    { id: 'month', label: 'This month' }, { id: 'last-month', label: 'Last month' },
    { id: 'year', label: 'This year' }, { id: 'all', label: 'All time' },
  ]
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: F }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Income statement"
        style={{ width: '100%', maxWidth: 480, background: 'var(--nan-surface, #151B2D)', color: 'var(--nan-text, #fff)', borderTopLeftRadius: 20, borderTopRightRadius: 20, border: '1px solid var(--nan-bdr, rgba(255,255,255,0.1))', padding: '16px 16px calc(20px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Income statement</div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--nan-text3, rgba(255,255,255,0.5))', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--nan-text2, rgba(255,255,255,0.65))', margin: '4px 0 14px', lineHeight: 1.5 }}>
          A printable summary of the payments you received, handy as proof of income. Choose a period.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {opts.map(o => (
            <button key={o.id} onClick={() => { printHtml(buildStatementHtml(invoices, o.id).html); onClose() }}
              style={{ padding: '14px 8px', background: 'var(--nan-surface2, #1C2340)', border: '1px solid var(--nan-bdr, rgba(255,255,255,0.1))', borderRadius: 12, color: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function showIncomeStatement(invoices: Invoice[]) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  root.render(<Sheet invoices={invoices} onClose={() => { root.unmount(); host.remove() }} />)
}
