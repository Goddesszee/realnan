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
