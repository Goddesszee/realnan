/**
 * PayByInvoicePage — public invoice payment page (premium light mode).
 * Accessed via ?invoice=<id> — no NAN account needed.
 */
import React, { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  FileText, CreditCard, CheckCircle2, ExternalLink,
  Copy, Check, AlertCircle, Loader, QrCode,
  ChevronRight, Share2, Wallet, Globe,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore, type Invoice } from '../../store/appStore'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { usePublicPage } from '../../hooks/usePublicPage'
import { OnrampCardPanel } from './OnrampCardPanel'
import { UniversalPayPanel } from './UniversalPayPanel'

const F     = "'Inter', -apple-system, sans-serif"
const MONO  = "'JetBrains Mono', 'SF Mono', Menlo, monospace"
const BLUE  = '#2563EB'
const BLUE_L = '#EFF4FF'
const BLUE_M = '#DBEAFE'
const GREEN = '#16A34A'
const GREEN_L = '#DCFCE7'
const AMBER = '#D97706'
const AMBER_L = '#FEF3C7'
const RED   = '#DC2626'
const GREY  = '#6B7280'
const BORDER = '#E5E7EB'
const SURF  = '#F9FAFB'
const ARC   = 5042

function fmtAmt(n: number, cur = 'USDC') {
  return `${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`
}
function fmtDate(iso?: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}
function shortAddr(a: string) {
  return a && a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}
function avatarColors(seed: string): [string, string] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const hue = h % 360
  return [`hsl(${hue} 72% 52%)`, `hsl(${(hue + 48) % 360} 76% 44%)`]
}

interface Props { invoiceId: string; isRequest?: boolean }

function NotFound() {
  return (
    <div style={{ minHeight: '100dvh', background: '#F3F4F6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: F, padding: '48px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#fff', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <FileText size={24} color={GREY} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Invoice not found</div>
        <div style={{ fontSize: 13, color: GREY, lineHeight: 1.5 }}>This invoice link may have expired or doesn't exist.</div>
        <a href="https://nanarc.xyz" style={{ display: 'inline-block', marginTop: 20, fontSize: 13, fontWeight: 600, color: BLUE }}>Go to NAN →</a>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100dvh', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <Loader size={28} color={BLUE} style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 13, color: GREY }}>Loading invoice…</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

type Tab = 'card' | 'address' | 'nan' | 'universal'

export function PayByInvoicePage({ invoiceId, isRequest = false }: Props) {
  usePublicPage()

  const { invoices, updateInvoice, recordInvoicePayment } = useAppStore()
  const localInvoice: Invoice | undefined = invoices.find(i => i.id === invoiceId)
  const [remoteInvoice, setRemoteInvoice] = useState<Invoice | null>(null)
  const [fetchDone, setFetchDone] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/invoices/${invoiceId}`)
      .then(r => r.json())
      .then((data: { success: boolean; invoice?: Invoice }) => {
        if (data.success && data.invoice) setRemoteInvoice(data.invoice)
        else if (!localInvoice) setNotFound(true)
      })
      .catch(() => { if (!localInvoice) setNotFound(true) })
      .finally(() => setFetchDone(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  const loading = !localInvoice && !fetchDone
  const invoice: Invoice | undefined = remoteInvoice ?? localInvoice ?? undefined

  const [tab, setTab] = useState<Tab>('card')
  const [showQr, setShowQr] = useState(false)
  const [nanPaid, setNanPaid] = useState(false)
  const [paid, setPaid] = useState(false)
  const [paidTx, setPaidTx] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState<{ matched: boolean; txHash?: string; aiSummary: string } | null>(null)
  const [txHashInput, setTxHashInput] = useState('')
  const [txCopied, setTxCopied] = useState(false)
  const [addrCopied, setAddrCopied] = useState(false)

  const shareReceipt = (txHash: string) => {
    const url = buildTxExplorerUrl(ARC, txHash)
    const text = `Payment confirmed for ${invoice?.businessName ?? 'invoice'} — settled on Arc USDC`
    if (navigator.share) void navigator.share({ title: 'NAN Payment Receipt', text, url }).catch(() => {})
    else { void navigator.clipboard.writeText(`${text}\n${url}`); toast.success('Receipt link copied!') }
  }

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr).then(() => { setAddrCopied(true); setTimeout(() => setAddrCopied(false), 2000) }).catch(() => {})
  }

  const markPaid = async (txHash?: string) => {
    if (!invoice) return
    setClaiming(true)
    try {
      const res = await fetch('/api/invoice-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id, txHash, payerName: invoice.customerName }),
      })
      const data = await res.json() as { matched?: boolean; txHash?: string; aiSummary?: string }
      const result = {
        matched: data.matched ?? false,
        txHash: data.txHash ?? txHash,
        aiSummary: data.aiSummary ?? (data.matched ? 'Payment confirmed onchain — funds are on their way.' : 'Payment claimed — the merchant has been notified.'),
      }
      setClaimResult(result)
      if (result.txHash) setPaidTx(result.txHash)
      if (invoice && localInvoice && result.matched) {
        recordInvoicePayment(invoice.id, { date: new Date().toISOString(), amount: invoice.amountDue, txHash: result.txHash ?? '', note: 'Paid via pay link' })
        updateInvoice(invoice.id, { status: 'paid', amountPaid: invoice.total, amountDue: 0, updatedAt: new Date().toISOString() })
      }
    } catch {
      setClaimResult({ matched: false, aiSummary: 'Payment claimed — the merchant has been notified.' })
    } finally {
      setClaiming(false)
      setPaid(true)
    }
  }

  if (loading) return <LoadingScreen />
  if (notFound || !invoice) return <NotFound />

  const isPaidAlready = invoice.status === 'paid' || invoice.amountDue <= 0

  // ── Success screen ─────────────────────────────────────────────────────────
  if (paid || isPaidAlready || nanPaid) {
    const isConfirmed = claimResult?.matched || isPaidAlready
    return (
      <div style={{ minHeight: '100dvh', background: '#F3F4F6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', fontFamily: F, padding: '48px 20px 80px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 440, width: '100%' }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 324 480" width="10" height="15"><path d="M255,0 L84,167 L71,163 L0,97 L0,378 L246,132 L255,110 Z" fill="#fff"/><path d="M69,480 L240,313 L253,317 L324,383 L324,102 L78,348 L69,370 Z" fill="#fff"/></svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>NAN</span>
          </div>

          <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '32px 28px', textAlign: 'center', marginBottom: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: isConfirmed ? GREEN_L : AMBER_L, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle2 size={32} color={isConfirmed ? GREEN : AMBER} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 6, letterSpacing: '-0.02em' }}>
              {isConfirmed ? 'Payment confirmed!' : 'Payment claimed!'}
            </div>
            <div style={{ fontSize: 14, color: GREY, lineHeight: 1.5 }}>
              {fmtAmt(invoice.total, invoice.currency)} to {invoice.businessName}
            </div>
          </div>

          {claimResult && (
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>NAN AI Reconciliation</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{claimResult.aiSummary}</div>
              {isConfirmed && (
                <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: GREEN_L, borderRadius: 20, padding: '4px 10px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} />
                  <span style={{ fontSize: 11, color: GREEN, fontWeight: 600 }}>Confirmed onchain</span>
                </div>
              )}
            </div>
          )}

          {paidTx && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <a href={buildTxExplorerUrl(ARC, paidTx)} target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, height: 46, borderRadius: 12, background: BLUE_L, border: `1px solid ${BLUE_M}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: BLUE, fontWeight: 600, textDecoration: 'none' }}>
                <ExternalLink size={13} /> View tx
              </a>
              <button onClick={() => shareReceipt(paidTx)}
                style={{ flex: 1, height: 46, borderRadius: 12, background: BLUE, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                <Share2 size={13} /> Share receipt
              </button>
            </div>
          )}

          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '14px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: GREY, marginBottom: 4 }}>The merchant has been notified</div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{invoice.businessName} received a payment notification with this reconciliation report.</div>
          </div>

          <a href="https://nanarc.xyz" style={{ display: 'block', padding: '14px', background: BLUE, color: '#fff', borderRadius: 14, fontSize: 14, fontWeight: 700, textDecoration: 'none', textAlign: 'center', boxShadow: '0 4px 16px rgba(37,99,235,0.25)' }}>
            Get your own NAN wallet
          </a>
        </div>
      </div>
    )
  }

  // ── Main invoice page ──────────────────────────────────────────────────────
  const looksLikeAddr = /^0x[0-9a-fA-F]{20,}$/.test(invoice.businessName ?? '')
  const senderName = looksLikeAddr ? shortAddr(invoice.businessName) : (invoice.businessName || 'NAN user')
  const initial = looksLikeAddr ? '0x' : (senderName.trim()[0] ?? 'N').toUpperCase()
  const [c1, c2] = avatarColors(invoice.businessName || invoice.number || 'nan')
  const amountStr = invoice.amountDue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const hasBreakdown = invoice.discountTotal > 0 || invoice.taxTotal > 0

  return (
    <div style={{ minHeight: '100dvh', background: '#F3F4F6', fontFamily: F, overflowY: 'auto', overflowX: 'hidden' }}>
      {/* ── Top bar ── */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 324 480" width="11" height="16"><path d="M255,0 L84,167 L71,163 L0,97 L0,378 L246,132 L255,110 Z" fill="#fff"/><path d="M69,480 L240,313 L253,317 L324,383 L324,102 L78,348 L69,370 Z" fill="#fff"/></svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>NAN</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: GREEN_L, borderRadius: 20, padding: '5px 12px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: GREEN }}>Secure payment</span>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* ── Invoice card ── */}
        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 20 }}>

          {/* Card header — blue gradient */}
          <div style={{ background: `linear-gradient(135deg, #1D4ED8 0%, #2563EB 60%, #3B82F6 100%)`, padding: '28px 24px 24px', position: 'relative', overflow: 'hidden' }}>
            {/* Decorative circles */}
            <div aria-hidden style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
            <div aria-hidden style={{ position: 'absolute', bottom: -30, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

            {/* Sender avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, position: 'relative' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: `linear-gradient(135deg, ${c1}, ${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: looksLikeAddr ? 13 : 20, fontWeight: 800, color: '#fff', border: '2px solid rgba(255,255,255,0.25)', boxShadow: `0 4px 16px -4px rgba(0,0,0,0.3)` }}>
                {initial}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 2 }}>{isRequest ? 'Payment request from' : 'Invoice from'}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{senderName}</div>
                {invoice.payToNanHandle && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>@{invoice.payToNanHandle}</div>}
              </div>
            </div>

            {/* Amount */}
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Amount due</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'clamp(36px, 11vw, 48px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{amountStr}</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{invoice.currency}</span>
              </div>
              {invoice.dueDate && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '5px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>Due {fmtDate(invoice.dueDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Invoice details ── */}
          <div style={{ padding: '20px 24px 4px' }}>
            {isRequest ? (
              <>
                {invoice.customerName && <DetailRow label="For" value={invoice.customerName} />}
                {(invoice.notes || invoice.items[0]?.name) && <DetailRow label="Note" value={invoice.notes || invoice.items[0]?.name || ''} muted />}
                <DetailRow label="Reference" value={invoice.number} mono last />
              </>
            ) : (
              <>
                <DetailRow label="Bill to" value={invoice.customerName} />
                <DetailRow label="Invoice #" value={invoice.number} mono />
                {invoice.businessEmail && <DetailRow label="Email" value={invoice.businessEmail} />}

                {/* Line items */}
                {invoice.items.length > 0 && (
                  <div style={{ margin: '16px 0 4px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Items</div>
                    {invoice.items.map((item, i) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingBottom: 12, marginBottom: i < invoice.items.length - 1 ? 0 : 4, borderBottom: i < invoice.items.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: GREY }}>{item.quantity} × {fmtAmt(item.unitPrice, invoice.currency)}</div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', fontFamily: MONO, flexShrink: 0, whiteSpace: 'nowrap' }}>{(item.quantity * item.unitPrice).toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals */}
                {hasBreakdown && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12, marginTop: 8 }}>
                    <SummaryRow label="Subtotal" value={fmtAmt(invoice.subtotal, invoice.currency)} />
                    {invoice.discountTotal > 0 && <SummaryRow label="Discount" value={`−${fmtAmt(invoice.discountTotal, invoice.currency)}`} green />}
                    {invoice.taxTotal > 0 && <SummaryRow label="Tax" value={fmtAmt(invoice.taxTotal, invoice.currency)} />}
                  </div>
                )}

                {/* Total due */}
                <div style={{ borderTop: `2px solid ${BORDER}`, margin: '12px 0', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Total due</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: BLUE, fontFamily: MONO, letterSpacing: '-0.02em' }}>{fmtAmt(invoice.amountDue, invoice.currency)}</span>
                </div>

                {invoice.notes && (
                  <div style={{ margin: '0 0 16px', padding: '12px 14px', borderRadius: 10, background: SURF, border: `1px solid ${BORDER}`, fontSize: 13, color: GREY, lineHeight: 1.55 }}>
                    {invoice.notes}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Payment section ── */}
        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 14 }}>Pay with</div>
            {/* Tab bar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              {([
                ['card',      <CreditCard key="c" size={14} />, 'Card'],
                ['address',   <QrCode     key="q" size={14} />, 'Crypto'],
                ['universal', <Globe      key="u" size={14} />, 'Any chain'],
                ['nan',       <Wallet     key="n" size={14} />, 'NAN'],
              ] as const).map(([id, icon, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  height: 46, borderRadius: 12,
                  background: tab === id ? BLUE : SURF,
                  color: tab === id ? '#fff' : GREY,
                  border: `1.5px solid ${tab === id ? BLUE : BORDER}`,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s',
                  boxShadow: tab === id ? '0 4px 12px rgba(37,99,235,0.25)' : 'none',
                }}>
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '20px' }}>

            {/* ── Card tab ── */}
            {tab === 'card' && (
              invoice.payToAddress ? (
                <OnrampCardPanel
                  toAddress={invoice.payToAddress}
                  amount={invoice.amountDue}
                  recipientLabel={invoice.businessName || 'merchant'}
                  currency={invoice.currency}
                />
              ) : (
                <div style={{ fontSize: 13, color: RED, textAlign: 'center', padding: '12px 0' }}>No wallet address on this invoice.</div>
              )
            )}

            {/* ── Any chain tab ── */}
            {tab === 'universal' && (
              invoice.payToAddress ? (
                <UniversalPayPanel
                  toAddress={invoice.payToAddress}
                  amount={invoice.amountDue}
                  handle={invoice.businessName || `Invoice ${invoice.number}`}
                />
              ) : (
                <div style={{ fontSize: 13, color: RED, textAlign: 'center', padding: '12px 0' }}>No wallet address on this invoice.</div>
              )
            )}

            {/* ── Crypto / address tab ── */}
            {tab === 'address' && (
              <div>
                {invoice.payToAddress ? (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Wallet address</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: SURF, borderRadius: 12, padding: '12px 14px', marginBottom: 4, border: `1px solid ${BORDER}` }}>
                      <div style={{ flex: 1, fontSize: 12, color: '#111827', fontFamily: MONO, wordBreak: 'break-all', lineHeight: 1.6 }}>{invoice.payToAddress}</div>
                      <button onClick={() => copyAddress(invoice.payToAddress!)}
                        style={{ flexShrink: 0, background: addrCopied ? GREEN_L : '#fff', border: `1px solid ${addrCopied ? GREEN : BORDER}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: addrCopied ? GREEN : GREY, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, fontFamily: F, transition: 'all 0.15s' }}>
                        {addrCopied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: GREY, marginBottom: 16 }}>
                      Network: <span style={{ color: BLUE, fontWeight: 600 }}>Arc (USDC)</span>
                    </div>

                    {/* Steps */}
                    <div style={{ background: SURF, borderRadius: 12, padding: '14px 16px', marginBottom: 16, border: `1px solid ${BORDER}` }}>
                      {['Open your wallet (MetaMask, Trust, etc.)',
                        `Send exactly ${fmtAmt(invoice.amountDue, invoice.currency)}`,
                        'Paste the address above as recipient',
                        'Select Arc network and confirm',
                      ].map((step, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < 3 ? 10 : 0 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: BLUE, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{step}</div>
                        </div>
                      ))}
                    </div>

                    {/* QR */}
                    <button onClick={() => setShowQr(v => !v)}
                      style={{ width: '100%', height: 44, background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 12, color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: showQr ? 16 : 16 }}>
                      <QrCode size={15} color={BLUE} /> {showQr ? 'Hide QR code' : 'Show QR to scan'}
                    </button>
                    {showQr && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ background: '#fff', padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 8 }}>
                          <QRCodeSVG value={invoice.payToAddress} size={180} level="M" includeMargin={false} />
                        </div>
                        <div style={{ fontSize: 11, color: GREY, textAlign: 'center' }}>Scan to auto-fill the address</div>
                      </div>
                    )}

                    {/* Tx confirm */}
                    <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Already sent? Confirm here</div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <input value={txHashInput} onChange={e => setTxHashInput(e.target.value)}
                          placeholder="Paste transaction hash (0x…)"
                          style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `1px solid ${BORDER}`, background: SURF, color: '#111827', fontSize: 12, fontFamily: MONO, outline: 'none' }} />
                        <button onClick={() => { void navigator.clipboard.readText().then(t => { setTxHashInput(t); setTxCopied(true); setTimeout(() => setTxCopied(false), 1500) }).catch(() => {}) }}
                          style={{ width: 42, height: 42, borderRadius: 10, background: txCopied ? GREEN_L : '#fff', border: `1px solid ${txCopied ? GREEN : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                          {txCopied ? <Check size={14} color={GREEN} /> : <Copy size={14} color={GREY} />}
                        </button>
                      </div>
                      <button onClick={() => void markPaid(txHashInput.trim() || undefined)} disabled={claiming}
                        style={{ width: '100%', height: 48, background: claiming ? GREEN_L : GREEN, border: 'none', borderRadius: 12, color: claiming ? GREEN : '#fff', fontSize: 14, fontWeight: 700, cursor: claiming ? 'not-allowed' : 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: claiming ? 'none' : '0 4px 12px rgba(22,163,74,0.25)', transition: 'all 0.15s' }}>
                        {claiming
                          ? <><Loader size={15} color={GREEN} style={{ animation: 'spin 1s linear infinite' }} /> Verifying…</>
                          : <><CheckCircle2 size={15} /> I've sent the payment</>}
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '16px 0' }}>
                    <AlertCircle size={16} color={AMBER} style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: 13, color: GREY, lineHeight: 1.5 }}>The invoice issuer hasn't added a wallet address yet.</div>
                  </div>
                )}
              </div>
            )}

            {/* ── NAN tab ── */}
            {tab === 'nan' && (
              <div>
                {!nanPaid ? (
                  <>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', background: BLUE_L, borderRadius: 14, marginBottom: 20, border: `1px solid ${BLUE_M}` }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 324 480" width="12" height="18"><path d="M255,0 L84,167 L71,163 L0,97 L0,378 L246,132 L255,110 Z" fill="#fff"/><path d="M69,480 L240,313 L253,317 L324,383 L324,102 L78,348 L69,370 Z" fill="#fff"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1E40AF', marginBottom: 2 }}>Pay with your NAN wallet</div>
                        <div style={{ fontSize: 13, color: '#3B82F6', lineHeight: 1.5 }}>Instant USDC payment — no card needed.</div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontSize: 12, color: GREY }}>To</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0, marginLeft: 12 }}>{invoice.businessName}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                        <div style={{ fontSize: 12, color: GREY }}>Amount</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: BLUE }}>{fmtAmt(invoice.amountDue, invoice.currency)}</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      {['Tap "Open NAN" below', 'Log in or create a free wallet (30 sec)', 'Send payment — arrives instantly', 'Come back and tap "I\'ve paid"'].map((step, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < 3 ? 10 : 0 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: BLUE, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{step}</div>
                        </div>
                      ))}
                    </div>

                    {(invoice.payToNanHandle || invoice.payToAddress) ? (
                      <a href={invoice.payToNanHandle
                          ? `https://nanarc.xyz/@${invoice.payToNanHandle}?amount=${invoice.amountDue}&note=${encodeURIComponent(`${isRequest ? 'Payment Request' : 'Invoice'} ${invoice.number ?? ''} — ${invoice.businessName ?? ''}`)}`
                          : `https://nanarc.xyz/?send=1&to=${encodeURIComponent(invoice.payToAddress!)}&amount=${invoice.amountDue}&note=${encodeURIComponent(`${isRequest ? 'Payment Request' : 'Invoice'} ${invoice.number ?? ''} — ${invoice.businessName ?? ''}`)}&currency=${invoice.currency ?? 'USDC'}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 52, background: BLUE, color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxSizing: 'border-box', marginBottom: 12, boxShadow: '0 4px 16px rgba(37,99,235,0.3)' }}>
                        Open NAN to pay <ChevronRight size={17} />
                      </a>
                    ) : (
                      <div style={{ fontSize: 13, color: RED, textAlign: 'center', marginBottom: 12 }}>No wallet address on this invoice.</div>
                    )}

                    <button onClick={() => setNanPaid(true)}
                      style={{ width: '100%', height: 46, background: GREEN_L, border: `1.5px solid #86EFAC`, borderRadius: 12, color: GREEN, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                      <CheckCircle2 size={15} /> I've paid
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: GREEN_L, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                      <CheckCircle2 size={28} color={GREEN} />
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Thanks!</div>
                    <div style={{ fontSize: 13, color: GREY, lineHeight: 1.5 }}>Your payment to {invoice.businessName} is on its way.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: GREY }}>
          Powered by <a href="https://nanarc.xyz" style={{ color: BLUE, textDecoration: 'none', fontWeight: 600 }}>NAN</a> · Circle · Arc
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        input::placeholder { color: #9CA3AF }
      `}</style>
    </div>
  )
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function DetailRow({ label, value, mono, muted, last }: { label: string; value: string; mono?: boolean; muted?: boolean; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '10px 0', borderBottom: last ? 'none' : `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 13, color: GREY, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: muted ? 400 : 600, color: muted ? GREY : '#111827', textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0, fontFamily: mono ? MONO : "'Inter', sans-serif" }}>{value}</span>
    </div>
  )
}

function SummaryRow({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ fontSize: 13, color: GREY }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: green ? GREEN : '#374151', fontFamily: MONO }}>{value}</span>
    </div>
  )
}
