import type { Invoice } from '../store/appStore'

/** Opens WhatsApp's contact picker with a ready-made message (works on phones and WhatsApp Web). */
export function shareOnWhatsApp(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
}

const money = (n: number) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Friendly WhatsApp message for an invoice / quick payment request pay link. */
export function invoiceWhatsAppText(inv: Invoice, link: string): string {
  const isQuick = (inv as Invoice & { mode?: string }).mode === 'quick'
  const amount = inv.amountDue > 0 ? inv.amountDue : inv.total
  const who = inv.customerName ? `Hi ${inv.customerName}, ` : 'Hi, '
  const from = inv.businessName ? `${inv.businessName} has sent you` : 'You have'
  const what = isQuick ? 'a payment request' : 'an invoice'
  return `${who}${from} ${what} (${inv.number}) for ${money(amount)} ${inv.currency}.\nPay securely here: ${link}`
}

const OPEN_STATUSES = ['sent', 'viewed', 'partially_paid', 'overdue']

/** True when the invoice is unpaid and its due date has passed (or it is already marked overdue). */
export function isInvoiceOverdue(inv: Invoice): boolean {
  if (inv.status === 'overdue') return true
  if (!OPEN_STATUSES.includes(inv.status) || !(inv.amountDue > 0)) return false
  const due = new Date(inv.dueDate).getTime()
  return Number.isFinite(due) && due < Date.now() - 86_400_000
}

/** Polite payment reminder for WhatsApp. */
export function invoiceReminderText(inv: Invoice, link: string): string {
  const amount = inv.amountDue > 0 ? inv.amountDue : inv.total
  const who = inv.customerName ? `Hi ${inv.customerName}, ` : 'Hi, '
  let due = ''
  try { due = new Date(inv.dueDate).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { /* ignore */ }
  const from = inv.businessName ? ` from ${inv.businessName}` : ''
  return `${who}a friendly reminder that invoice ${inv.number}${from} for ${money(amount)} ${inv.currency}${due ? ` was due on ${due}` : ' is still unpaid'}.\nYou can pay securely here: ${link}\nThank you!`
}

/** Reminder when overdue, otherwise the normal invoice message. */
export function invoiceChaseText(inv: Invoice, link: string): string {
  return isInvoiceOverdue(inv) ? invoiceReminderText(inv, link) : invoiceWhatsAppText(inv, link)
}
