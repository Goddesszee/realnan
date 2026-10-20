/**
 * InvoicePage — unified Invoices & Requests hub.
 *
 * Quick Request mode  — amount + recipient + note. 10 seconds to create.
 * Full Invoice mode   — business info, line items, tax, Net terms, PDF.
 *
 * Both save as Invoice records (mode: 'quick' | 'full').
 * Payment Requests page is retired; this page replaces it entirely.
 */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  FileText, Plus, Download, Share2, Printer, Copy,
  Trash2, ChevronRight, X, Check, AlertCircle,
  ArrowRight, CheckCircle2, Clock, ExternalLink,
  ChevronDown, Eye, Zap, MessageCircle, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore, type Invoice, type InvoiceLineItem, type InvoiceStatus, type RecurringTask } from '../../store/appStore'
import { downloadInvoicePdf, shareInvoice, printInvoice, invoicePaymentLink } from '../../lib/invoice-pdf'
import { useDisplayCurrency } from '../../lib/display-currency'
import { showIncomeStatement } from '../../lib/income-statement'
import { shareOnWhatsApp, invoiceChaseText, isInvoiceOverdue } from '../../lib/whatsapp'
import { useAccount } from 'wagmi'
import { TokenLogo } from '../ui/TokenLogo'
import { useNanTheme } from '../../hooks/useNanTheme'

const F = "'Inter', -apple-system, sans-serif"
const AMBER = '#F59E0B'

// ── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
function today() { return new Date().toISOString().slice(0, 10) }
function inDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function fmtDate(iso?: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}
function fmtAmt(n: number, cur = 'USDC') {
  return `${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`
}
function lineTotal(item: InvoiceLineItem) {
  const gross = item.quantity * item.unitPrice
  const disc  = gross * ((item.discount ?? 0) / 100)
  const after = gross - disc
  return after + after * ((item.tax ?? 0) / 100)
}
function computeTotals(items: InvoiceLineItem[]) {
  const subtotal      = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const discountTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice * ((i.discount ?? 0) / 100), 0)
  const taxBase       = subtotal - discountTotal
  const taxTotal      = items.reduce((s, i) => {
    const base = i.quantity * i.unitPrice * (1 - (i.discount ?? 0) / 100)
    return s + base * ((i.tax ?? 0) / 100)
  }, 0)
  return { subtotal, discountTotal, taxTotal, total: taxBase + taxTotal }
}

function makeStatusMeta(blue: string, green: string, red: string, t3: string, surf2: string): Record<InvoiceStatus, { label: string; color: string; bg: string }> {
  return {
    draft:          { label: 'Draft',     color: t3,    bg: surf2 },
    sent:           { label: 'Sent',      color: blue,  bg: 'rgba(37,99,235,0.10)' },
    viewed:         { label: 'Viewed',    color: blue,  bg: 'rgba(37,99,235,0.10)' },
    partially_paid: { label: 'Partial',   color: AMBER, bg: 'rgba(245,158,11,0.10)' },
    paid:           { label: 'Paid',      color: green, bg: 'rgba(34,197,94,0.10)' },
    overdue:        { label: 'Overdue',   color: red,   bg: 'rgba(239,68,68,0.10)' },
    cancelled:      { label: 'Cancelled', color: t3,    bg: surf2 },
  }
}

// ── Shared sub-components ────────────────────────────────────────────────────
function Field({ label, error, t2, red, children }: { label: string; error?: string; t2: string; red: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: t2, marginBottom: 6 }}>{label.replace(/ \*$/, '')}{/\*$/.test(label) && <span style={{ color: red }}> *</span>}</div>
      {children}
      {error && <div style={{ fontSize: 11, color: red, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={10} />{error}</div>}
    </div>
  )
}

function StatusBadge({ status, isQuick, statusMeta }: { status: InvoiceStatus; isQuick?: boolean; statusMeta: ReturnType<typeof makeStatusMeta> }) {
  const m = statusMeta[status] ?? statusMeta.draft
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, color: m.color, background: m.bg, border: `1px solid ${m.color}22`, whiteSpace: 'nowrap' }}>
      {isQuick && <Zap size={9} />}{m.label}
    </span>
  )
}

function emptyItem(): InvoiceLineItem {
  return { id: uid(), name: '', quantity: 1, unitPrice: 0 }
}

const CURRENCIES = ['USDC', 'EURC']

function CurrencyPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid var(--nan-border)', borderRadius: 10, fontFamily: F, fontSize: 14, outline: 'none', color: 'var(--nan-text)', background: 'var(--nan-surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        <TokenLogo symbol={value} size={20} />
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>{value}</span>
        <ChevronDown size={14} color="var(--nan-text-2)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: 'var(--nan-surface-2)', border: '1px solid var(--nan-border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
          {CURRENCIES.map(c => (
            <button key={c} type="button" onClick={() => { onChange(c); setOpen(false) }}
              style={{ width: '100%', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, background: c === value ? 'rgba(37,99,235,0.10)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: F, borderBottom: c !== CURRENCIES[CURRENCIES.length - 1] ? '1px solid var(--nan-border)' : 'none' }}>
              <TokenLogo symbol={c} size={22} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--nan-text)', flex: 1, textAlign: 'left' }}>{c}</span>
              {c === value && <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--nan-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--nan-blue)' }} /></div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Autopay toggle component ─────────────────────────────────────────────────
function AutopayToggle({ invoice, recurringTasks, addRecurringTask, updateRecurringTask, surf, surf2, bdr, blue, text, t3 }: {
  invoice: Invoice
  recurringTasks: RecurringTask[]
  addRecurringTask: (t: Omit<RecurringTask, 'id' | 'createdAt' | 'runCount'>) => string
  updateRecurringTask: (id: string, patch: Partial<RecurringTask>) => void
  surf: string; surf2: string; bdr: string; blue: string; text: string; t3: string
}) {
  // RecurringTask uses `name` as the identifier — encode invoice ID in name with a prefix
  const autopayTask = recurringTasks.find(t => t.name === `autopay:${invoice.id}`)
  const isEnabled = !!autopayTask && autopayTask.active === true

  const toggle = useCallback(() => {
    if (autopayTask) {
      updateRecurringTask(autopayTask.id, { active: !isEnabled })
      toast.success(isEnabled ? 'Autopay paused' : 'Autopay resumed')
    } else {
      if (!invoice.dueDate) { toast.error('Set a due date on this invoice first'); return }
      addRecurringTask({
        name: `autopay:${invoice.id}`,
        recipient: invoice.payToAddress ?? (invoice as Invoice & { payToNanHandle?: string }).payToNanHandle ?? '',
        amount: String(invoice.amountDue),
        active: true,
        frequency: 'monthly', // 'once' not a valid frequency — use monthly and cancel after first run
        nextRunAt: invoice.dueDate,
      })
      toast.success('Autopay enabled — agent wallet will pay on the due date')
    }
  }, [autopayTask, isEnabled, invoice, addRecurringTask, updateRecurringTask])

  return (
    <div style={{ background: surf, border: `1px solid ${isEnabled ? 'rgba(37,99,235,0.3)' : bdr}`, borderRadius: 14, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: isEnabled ? 'rgba(37,99,235,0.08)' : surf2, border: `1px solid ${isEnabled ? 'rgba(37,99,235,0.2)' : bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <RefreshCw size={17} color={isEnabled ? blue : t3} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: text }}>Autopay</div>
        <div style={{ fontSize: 12, color: t3, marginTop: 1 }}>
          {isEnabled
            ? `Scheduled: ${invoice.amountDue.toFixed(2)} ${invoice.currency} on ${fmtDate(invoice.dueDate)}`
            : 'Auto-pay this invoice from your Agent Wallet on the due date'}
        </div>
      </div>
      <button onClick={toggle} style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: isEnabled ? blue : t3, position: 'relative', transition: 'background 0.2s' }}>
        <div style={{ position: 'absolute', top: 3, left: isEnabled ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}

// ── Form state ────────────────────────────────────────────────────────────────
interface DraftForm {
  businessName: string; businessEmail: string; businessAddress: string
  customerName: string; customerEmail: string; customerAddress: string
  issueDate: string; dueDate: string; currency: string
  notes: string; paymentInstructions: string; payToAddress: string
  payToNanHandle: string
  items: InvoiceLineItem[]
  // quick mode fields
  quickAmount: string; quickNote: string; quickRecipient: string
}

function emptyForm(defaultAddress = ''): DraftForm {
  return {
    businessName: '', businessEmail: '', businessAddress: '',
    customerName: '', customerEmail: '', customerAddress: '',
    issueDate: today(), dueDate: inDays(30),
    currency: 'USDC', notes: '', paymentInstructions: '',
    payToAddress: defaultAddress,
    payToNanHandle: '',
    items: [emptyItem()],
    quickAmount: '', quickNote: '', quickRecipient: '',
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export function InvoicePage() {
  const C = useNanTheme()
  // Theme-reactive shorthand locals (replaces module-level static vars)
  const SURF  = C.surf
  const SURF2 = C.surf2
  const BDR   = C.bdr
  const BLUE  = C.blue
  const TEXT  = C.text
  const T2    = C.t2
  const T3    = C.t3
  const GREEN = C.green
  const RED   = C.red
  const STATUS_META = makeStatusMeta(BLUE, GREEN, RED, T3, SURF2)

  const inputBase: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '12px 14px', minHeight: 46,
    border: `1px solid ${BDR}`, borderRadius: 12,
    fontFamily: F, fontSize: 15, outline: 'none',
    color: TEXT, background: SURF2,
  }
  const btnPrimary: React.CSSProperties = {
    flex: 1, height: 50, background: BLUE, color: '#fff',
    border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700,
    cursor: 'pointer', fontFamily: F, display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  }
  const btnGhost: React.CSSProperties = {
    flex: 1, height: 50, background: 'transparent', color: T2,
    border: `1px solid ${BDR}`, borderRadius: 14, fontSize: 15,
    fontWeight: 600, cursor: 'pointer', fontFamily: F,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  }

  const localCcy = useDisplayCurrency()
  const { address: wagmiAddress } = useAccount()
  const { auth, profile, invoices, addInvoice, updateInvoice, removeInvoice, addContact, recurringTasks, addRecurringTask, updateRecurringTask } = useAppStore()
  const walletAddress = wagmiAddress ?? auth?.circleWalletAddress ?? auth?.walletAddress ?? ''

  type View = 'list' | 'new' | 'detail' | 'edit'
  type NewMode = 'choose' | 'quick' | 'full'

  const [view,        setView]        = useState<View>('list')
  const [newMode,     setNewMode]     = useState<NewMode>('choose')
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [form,        setForm]        = useState<DraftForm>(() => emptyForm(walletAddress))
  const [errors,      setErrors]      = useState<Partial<Record<keyof DraftForm | 'items', string>>>({})
  const [delConfirm,  setDelConfirm]  = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | 'all' | 'unpaid'>('all')

  const selected = useMemo(() => invoices.find(i => i.id === selectedId) ?? null, [invoices, selectedId])
  const totals   = useMemo(() => computeTotals(form.items), [form.items])
  const filtered = useMemo(() => {
    const list = [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (filterStatus === 'all') return list
    if (filterStatus === 'unpaid') return list.filter(i => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(i.status))
    return list.filter(i => i.status === filterStatus)
  }, [invoices, filterStatus])

  const stats = useMemo(() => ({
    total:   invoices.length,
    unpaid:  invoices.filter(i => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(i.status)).length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    revenue: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0),
  }), [invoices])

  // ── Validation ────────────────────────────────────────────────────────────
  const validateFull = (): boolean => {
    const e: typeof errors = {}
    if (!form.businessName.trim()) e.businessName = 'Required'
    if (!form.customerName.trim()) e.customerName = 'Required'
    if (!form.dueDate)             e.dueDate       = 'Required'
    const hasItems = form.items.some(i => i.name.trim() && i.unitPrice > 0)
    if (!hasItems) e.items = 'Add at least one item with a name and price'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateQuick = (): boolean => {
    const e: typeof errors = {}
    if (!form.quickRecipient.trim()) e.quickRecipient = 'Required'
    const n = parseFloat(form.quickAmount)
    if (!form.quickAmount || isNaN(n) || n <= 0) e.quickAmount = 'Enter a valid amount'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Create quick request ──────────────────────────────────────────────────
  const handleCreateQuick = () => {
    if (!validateQuick()) return
    const amount = parseFloat(form.quickAmount)
    const inv = addInvoice({
      businessName: profile?.displayName?.trim() || auth?.email || form.quickRecipient.trim(),
      businessEmail: auth?.email ?? '',
      customerName: form.quickRecipient.trim(),
      issueDate: today(), dueDate: inDays(30),
      currency: form.currency,
      notes: form.quickNote.trim() || undefined,
      payToAddress: walletAddress || undefined,
      payToNanHandle: form.payToNanHandle.trim().replace(/^@/, '') || undefined,
      items: [{ id: uid(), name: form.quickNote.trim() || 'Payment', quantity: 1, unitPrice: amount }],
      subtotal: amount, discountTotal: 0, taxTotal: 0, total: amount,
      payments: [], amountPaid: 0, amountDue: amount,
      status: 'sent',
      mode: 'quick' as const,
    })
    // Auto-save recipient as a contact (use name-derived id as pseudo-address for dedup)
    if (form.quickRecipient.trim()) {
      const seed = form.quickRecipient.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      const pseudoAddr = `0x${seed.padEnd(40, '0').slice(0, 40)}`
      addContact({ address: pseudoAddr, name: form.quickRecipient.trim(), note: form.quickNote.trim() || undefined })
    }
    toast.success('Payment request created')
    setSelectedId(inv.id)
    setView('detail')
  }

  // ── Create full invoice ───────────────────────────────────────────────────
  const handleCreate = (status: InvoiceStatus = 'draft') => {
    if (!validateFull()) return
    const t = computeTotals(form.items)
    const inv = addInvoice({
      businessName: form.businessName.trim(),
      businessEmail: form.businessEmail.trim() || undefined,
      businessAddress: form.businessAddress.trim() || undefined,
      customerName: form.customerName.trim(),
      customerEmail: form.customerEmail.trim() || undefined,
      customerAddress: form.customerAddress.trim() || undefined,
      issueDate: form.issueDate, dueDate: form.dueDate,
      currency: form.currency,
      notes: form.notes.trim() || undefined,
      paymentInstructions: form.paymentInstructions.trim() || undefined,
      payToAddress: form.payToAddress.trim() || undefined,
      payToNanHandle: form.payToNanHandle.trim().replace(/^@/, '') || undefined,
      items: form.items.filter(i => i.name.trim()),
      ...t, payments: [], amountPaid: 0, amountDue: t.total,
      status, mode: 'full' as const,
    })
    // Auto-add customer as a contact when they have a wallet address
    const custAddr = form.customerAddress.trim()
    if (custAddr && /^0x[0-9a-fA-F]{40}$/.test(custAddr) && form.customerName.trim()) {
      addContact({ address: custAddr, name: form.customerName.trim(), note: form.customerEmail.trim() || undefined })
    }
    toast.success(status === 'draft' ? 'Invoice saved as draft' : 'Invoice created')
    setSelectedId(inv.id)
    setView('detail')
  }

  // ── Update invoice ────────────────────────────────────────────────────────
  const handleUpdate = () => {
    if (!selectedId || !validateFull()) return
    const t = computeTotals(form.items)
    updateInvoice(selectedId, {
      businessName: form.businessName.trim(),
      businessEmail: form.businessEmail.trim() || undefined,
      businessAddress: form.businessAddress.trim() || undefined,
      customerName: form.customerName.trim(),
      customerEmail: form.customerEmail.trim() || undefined,
      customerAddress: form.customerAddress.trim() || undefined,
      issueDate: form.issueDate, dueDate: form.dueDate,
      currency: form.currency,
      notes: form.notes.trim() || undefined,
      paymentInstructions: form.paymentInstructions.trim() || undefined,
      payToAddress: form.payToAddress.trim() || undefined,
      payToNanHandle: form.payToNanHandle.trim().replace(/^@/, '') || undefined,
      items: form.items.filter(i => i.name.trim()),
      ...t, amountDue: Math.max(0, t.total - (selected?.amountPaid ?? 0)),
      updatedAt: new Date().toISOString(),
    })
    toast.success('Invoice updated')
    setView('detail')
  }

  const openEdit = (inv: Invoice) => {
    setForm({
      businessName: inv.businessName, businessEmail: inv.businessEmail ?? '',
      businessAddress: inv.businessAddress ?? '',
      customerName: inv.customerName, customerEmail: inv.customerEmail ?? '',
      customerAddress: inv.customerAddress ?? '',
      issueDate: inv.issueDate, dueDate: inv.dueDate, currency: inv.currency,
      notes: inv.notes ?? '', paymentInstructions: inv.paymentInstructions ?? '',
      payToAddress: inv.payToAddress ?? '',
      payToNanHandle: (inv as Invoice & { payToNanHandle?: string }).payToNanHandle ?? '',
      items: inv.items.length > 0 ? inv.items : [emptyItem()],
      quickAmount: '', quickNote: '', quickRecipient: '',
    })
    setErrors({})
    setSelectedId(inv.id)
    setView('edit')
  }

  const doShare = (inv: Invoice) => { void shareInvoice(inv) }

  const copyLink = (inv: Invoice) => {
    const link = invoicePaymentLink(inv)
    navigator.clipboard.writeText(link).then(() => toast.success('Pay link copied')).catch(() => toast.error('Copy failed'))
  }

  const updateItem = (id: string, patch: Partial<InvoiceLineItem>) =>
    setForm(f => ({ ...f, items: f.items.map(it => it.id === id ? { ...it, ...patch } : it) }))
  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }))
  const removeItem = (id: string) => setForm(f => ({ ...f, items: f.items.filter(it => it.id !== id) }))

  const openNew = () => {
    setForm(emptyForm(walletAddress))
    setErrors({})
    setNewMode('choose')
    setView('new')
  }

  const renderHeader = (title: string, onBack?: () => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0 14px', marginBottom: 16 }}>
      {onBack && (
        <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: 8, background: SURF2, border: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowRight size={14} color={T2} style={{ transform: 'rotate(180deg)' }} />
        </button>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, letterSpacing: '-0.02em' }}>{title}</div>
      </div>
      {view === 'list' && (
        <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 14px', height: 34, background: BLUE, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F, flexShrink: 0 }}>
          <Plus size={14} /> New
        </button>
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: LIST
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'list') return (
    <div style={{ fontFamily: F, width: '100%', paddingBottom: 96 }}>
      {renderHeader('Invoices & Requests')}

      {invoices.length > 0 && (() => {
        const openStatuses = ['sent', 'viewed', 'partially_paid', 'overdue']
        const outstanding = invoices.filter(i => openStatuses.includes(i.status)).reduce((s, i) => s + i.amountDue, 0)
        const fmt0 = (n: number) => n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const chips: { id: InvoiceStatus | 'all' | 'unpaid'; label: string; n: number }[] = [
          { id: 'all',     label: 'All',     n: stats.total },
          { id: 'unpaid',  label: 'Unpaid',  n: stats.unpaid },
          { id: 'paid',    label: 'Paid',    n: invoices.filter(i => i.status === 'paid').length },
          { id: 'overdue', label: 'Overdue', n: stats.overdue },
          { id: 'draft',   label: 'Drafts',  n: invoices.filter(i => i.status === 'draft').length },
        ]
        return (
          <>
            <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 14, padding: '14px 16px 12px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: T2 }}>Waiting to be paid</div>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: TEXT, letterSpacing: '-0.03em', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>{fmt0(outstanding)}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T3 }}>USDC</span>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BDR}`, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: T2 }}>
                <span><b style={{ color: TEXT, fontWeight: 700 }}>{stats.unpaid}</b> unpaid</span>
                <span><b style={{ color: stats.overdue > 0 ? RED : TEXT, fontWeight: 700 }}>{stats.overdue}</b> overdue</span>
                <span><b style={{ color: TEXT, fontWeight: 700 }}>{fmt0(stats.revenue)}</b> collected</span>
              </div>
              <button onClick={() => showIncomeStatement(invoices)} style={{ marginTop: 10, height: 30, padding: '0 10px', borderRadius: 8, border: `1px solid ${BDR}`, background: SURF2, color: T2, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: F }}><FileText size={12} /> Income statement</button>
            </div>

            <div role="tablist" aria-label="Filter" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -16px 14px', padding: '0 16px', scrollbarWidth: 'none' }}>
              {chips.map(c => {
                const on = filterStatus === c.id
                return (
                  <button key={c.id} role="tab" aria-selected={on} onClick={() => setFilterStatus(c.id)}
                    style={{ flexShrink: 0, height: 30, padding: '0 12px', borderRadius: 999, border: `1px solid ${on ? BLUE : BDR}`, background: on ? BLUE : 'transparent', color: on ? '#fff' : T2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: F, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                    {c.label} {c.n > 0 && <span style={{ fontSize: 11, fontWeight: 700, opacity: on ? 0.85 : 0.55 }}>{c.n}</span>}
                  </button>
                )
              })}
            </div>
          </>
        )
      })()}


      {invoices.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: SURF, border: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={24} color={T3} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>No invoices or requests yet</div>
          <div style={{ fontSize: 13, color: T2, maxWidth: 260, lineHeight: 1.5 }}>Create a quick payment request or a full invoice. Share a pay link — anyone can pay by card or crypto.</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={openNew} style={{ ...btnPrimary, flex: 'none', padding: '0 20px', width: 'auto' }}>
              <Zap size={14} /> Quick request
            </button>
            <button onClick={openNew} style={{ ...btnGhost, flex: 'none', padding: '0 20px', width: 'auto' }}>
              <FileText size={14} /> Full invoice
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(inv => {
          const isQuick = (inv as Invoice & { mode?: string }).mode === 'quick'
          const meta = STATUS_META[inv.status] ?? STATUS_META.draft
          const who = (inv.customerName || 'Customer').trim()
          const hue = [...who].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 360
          const amountStr = inv.total.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          const iconBg = `hsl(${hue},55%,${C.isDark ? '22%' : '88%'})`
          const iconColor = `hsl(${hue},60%,${C.isDark ? '72%' : '38%'})`
          const actionBtn: React.CSSProperties = {
            height: 32, padding: '0 10px', borderRadius: 8,
            border: `1px solid ${BDR}`, background: SURF2, color: T2,
            fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center',
            gap: 5, cursor: 'pointer', fontFamily: F, whiteSpace: 'nowrap', flexShrink: 0,
          }
          return (
            <div key={inv.id} style={{
              background: SURF, border: `1px solid ${BDR}`,
              borderRadius: 14, overflow: 'hidden',
            }}>
              {/* ── Clickable row ── */}
              <button
                onClick={() => { setSelectedId(inv.id); setView('detail') }}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 14px 12px', textAlign: 'left', fontFamily: F, display: 'flex', alignItems: 'center', gap: 12 }}
              >
                {/* Avatar */}
                <div style={{ position: 'relative', width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: iconColor }}>
                  {who[0]?.toUpperCase() ?? '?'}
                  {isQuick && (
                    <span style={{ position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: '50%', background: BLUE, border: `2px solid ${SURF}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Zap size={8} color="#fff" />
                    </span>
                  )}
                </div>
                {/* Name + ref */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.customerName}</div>
                  <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>{isQuick ? 'Request' : 'Invoice'} {inv.number}</div>
                </div>
                {/* Status dot */}
                <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: meta.color }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                  {meta.label}
                </span>
              </button>

              {/* ── Amount + due row ── */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '0 14px 10px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: inv.status === 'paid' ? GREEN : TEXT, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {amountStr} <span style={{ fontSize: 11, fontWeight: 500, color: T3 }}>{inv.currency}</span>
                </div>
                <div style={{ fontSize: 11, color: inv.status === 'overdue' ? RED : T3 }}>
                  {inv.amountDue > 0 && inv.amountDue < inv.total ? `${fmtAmt(inv.amountDue, inv.currency)} left · ` : ''}Due {fmtDate(inv.dueDate)}
                </div>
              </div>

              {/* ── Action row ── */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: delConfirm === inv.id ? 'wrap' : 'nowrap', gap: 6, padding: '8px 14px 10px', borderTop: `1px solid ${BDR}` }}>
                <button onClick={() => copyLink(inv)} style={{ ...actionBtn, flex: 1, padding: '0 6px', justifyContent: 'center', background: C.blueDim, borderColor: C.blueBd, color: BLUE }}>
                  <Copy size={13} style={{ flexShrink: 0 }} /> Copy link
                </button>
                <button onClick={() => doShare(inv)} style={{ ...actionBtn, flex: 1, padding: '0 6px', justifyContent: 'center' }}>
                  <Share2 size={13} style={{ flexShrink: 0 }} /> Share
                </button>
                <button onClick={() => printInvoice(inv)} aria-label="Print" style={{ ...actionBtn, padding: 0, width: 32, justifyContent: 'center' }}><Printer size={13} /></button>
                <button onClick={() => shareOnWhatsApp(invoiceChaseText(inv, invoicePaymentLink(inv)))} aria-label="Send on WhatsApp" style={{ ...actionBtn, padding: 0, width: 32, justifyContent: 'center', color: '#128C7E', borderColor: 'rgba(18,140,126,0.25)', background: 'rgba(18,140,126,0.08)' }}><MessageCircle size={13} /></button>
                {delConfirm === inv.id ? (
                  <>
                    <button onClick={() => setDelConfirm(null)} style={actionBtn}>Cancel</button>
                    <button onClick={() => { removeInvoice(inv.id); setDelConfirm(null); toast.success('Deleted') }} style={{ ...actionBtn, background: RED, borderColor: RED, color: '#fff' }}>Delete</button>
                  </>
                ) : (
                  <button onClick={() => setDelConfirm(inv.id)} aria-label="Delete" style={{ ...actionBtn, padding: 0, width: 32, justifyContent: 'center' }}><Trash2 size={13} /></button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {filtered.length === 0 && invoices.length > 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: T3, fontSize: 13 }}>No items match this filter.</div>
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: DETAIL
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'detail' && selected) {
    const payLink = invoicePaymentLink(selected)
    const isQuick = (selected as Invoice & { mode?: string }).mode === 'quick'
    return (
      <div style={{ fontFamily: F, width: '100%', paddingBottom: 96 }}>
        {renderHeader(isQuick ? `Request ${selected.number}` : selected.number, () => setView('list'))}

        {(() => {
          const meta = STATUS_META[selected.status] ?? STATUS_META.draft
          const who = (selected.customerName || 'Customer').trim()
          const hue = [...who].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 360
          const amountStr = selected.total.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          return (
            <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 14, padding: '16px 16px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: SURF2, border: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLUE, fontSize: 16, fontWeight: 700 }}>{who[0]?.toUpperCase() ?? '?'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{isQuick ? 'Requesting from' : 'Bill to'}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, overflowWrap: 'anywhere' }}>{selected.customerName}</div>
                  {selected.customerEmail && <div style={{ fontSize: 12, color: T3, overflowWrap: 'anywhere' }}>{selected.customerEmail}</div>}
                </div>
                <span style={{ flexShrink: 0, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: SURF2, border: `1px solid ${BDR}`, color: T2, fontSize: 12, fontWeight: 600 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: selected.status === 'paid' ? GREEN : selected.status === 'overdue' ? RED : BLUE }} />{meta.label}
                </span>
              </div>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'clamp(28px, 9vw, 36px)', fontWeight: 700, color: TEXT, letterSpacing: '-0.03em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{amountStr}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: T3 }}>{selected.currency}</span>
              </div>
              {(selected.currency === 'USDC' || selected.currency === 'USD') && localCcy.approx(selected.total) && (
                <div style={{ fontSize: 13, color: T3, marginTop: 2 }}>{localCcy.approx(selected.total)}</div>
              )}
              {selected.amountDue > 0 && selected.amountDue < selected.total && (
                <div style={{ fontSize: 13, color: '#F59E0B', marginTop: 4 }}>{fmtAmt(selected.amountDue, selected.currency)} remaining</div>
              )}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BDR}`, display: 'flex', gap: 28 }}>
                <div><div style={{ fontSize: 12, color: T3 }}>Issued</div><div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginTop: 2 }}>{fmtDate(selected.issueDate)}</div></div>
                <div><div style={{ fontSize: 12, color: T3 }}>Due</div><div style={{ fontSize: 14, fontWeight: 600, color: selected.status === 'overdue' ? RED : TEXT, marginTop: 2 }}>{fmtDate(selected.dueDate)}</div></div>
              </div>
            </div>
          )
        })()}

        <div style={{ background: 'rgba(37,99,235,0.06)', border: `1px solid rgba(37,99,235,0.12)`, borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Payment link</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, fontSize: 12, color: T2, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payLink}</div>
            <button onClick={() => copyLink(selected)} style={{ flexShrink: 0, height: 30, padding: '0 12px', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Copy size={11} /> Copy
            </button>
          </div>
          {((selected as Invoice & { payToNanHandle?: string }).payToNanHandle || selected.payToAddress) && (
            <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {(selected as Invoice & { payToNanHandle?: string }).payToNanHandle && (
                <span style={{ fontSize: 11, color: BLUE, fontWeight: 700 }}>
                  @{(selected as Invoice & { payToNanHandle?: string }).payToNanHandle}
                </span>
              )}
              {selected.payToAddress && (
                <span style={{ fontSize: 11, color: T3, fontFamily: 'monospace' }}>
                  {selected.payToAddress.slice(0, 10)}…{selected.payToAddress.slice(-6)}
                </span>
              )}
            </div>
          )}
        </div>

        {selected.notes && (
          <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T2, marginBottom: 4 }}>Note</div>
            <div style={{ fontSize: 13, color: T2, lineHeight: 1.5 }}>{selected.notes}</div>
          </div>
        )}

        {/* ── Autopay toggle ── */}
        {['sent', 'viewed', 'partially_paid', 'overdue'].includes(selected.status) && (
          <AutopayToggle
            invoice={selected}
            recurringTasks={recurringTasks}
            addRecurringTask={addRecurringTask}
            updateRecurringTask={updateRecurringTask}
            surf={SURF} surf2={SURF2} bdr={BDR} blue={BLUE} text={TEXT} t3={T3}
          />
        )}

        {!isQuick && selected.items.length > 0 && (
          <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${BDR}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Line Items</div>
            </div>
            {selected.items.map((item, i) => (
              <div key={item.id} style={{ padding: '12px 14px', borderBottom: i < selected.items.length - 1 ? `1px solid ${BDR}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: T2, marginTop: 2 }}>{item.quantity} × {fmtAmt(item.unitPrice, selected.currency)}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{fmtAmt(lineTotal(item), selected.currency)}</div>
                </div>
              </div>
            ))}
            <div style={{ padding: '12px 14px', background: SURF2 }}>
              {(selected.discountTotal > 0 || selected.taxTotal > 0) && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 12, color: T2 }}>Subtotal</span><span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{fmtAmt(selected.subtotal, selected.currency)}</span></div>
                  {selected.discountTotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 12, color: AMBER }}>Discount</span><span style={{ fontSize: 12, fontWeight: 600, color: AMBER }}>−{fmtAmt(selected.discountTotal, selected.currency)}</span></div>}
                  {selected.taxTotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 12, color: T2 }}>Tax</span><span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{fmtAmt(selected.taxTotal, selected.currency)}</span></div>}
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${BDR}` }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Total</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{fmtAmt(selected.total, selected.currency)}</span>
              </div>
            </div>
          </div>
        )}

        {selected.payments.length > 0 && (
          <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${BDR}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Payments Received</div>
            </div>
            {selected.payments.map(p => (
              <div key={p.id} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BDR}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: GREEN }}>{fmtAmt(p.amount, selected.currency)}</div>
                  <div style={{ fontSize: 11, color: T3 }}>{fmtDate(p.date)}{p.note ? ` · ${p.note}` : ''}</div>
                </div>
                {p.txHash && <a href={`https://explorer.arc.io/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: BLUE, textDecoration: 'none', fontWeight: 600 }}>Tx <ExternalLink size={10} /></a>}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          {selected.status === 'draft' && (
            <button onClick={() => updateInvoice(selected.id, { status: 'sent', updatedAt: new Date().toISOString() })} style={{ ...btnPrimary, gridColumn: '1 / -1' }}>
              <Eye size={15} /> Mark as Sent
            </button>
          )}
          {['sent', 'viewed', 'overdue'].includes(selected.status) && (
            <button onClick={() => updateInvoice(selected.id, { status: 'paid', amountPaid: selected.total, amountDue: 0, updatedAt: new Date().toISOString() })} style={btnPrimary}>
              <CheckCircle2 size={15} /> Mark Paid
            </button>
          )}
          {selected.status !== 'cancelled' && selected.status !== 'paid' && (
            <button onClick={() => updateInvoice(selected.id, { status: 'cancelled', updatedAt: new Date().toISOString() })} style={btnGhost}>
              <X size={15} /> Cancel
            </button>
          )}
        </div>

        {selected.status !== 'paid' && selected.status !== 'cancelled' && (
          <button onClick={() => shareOnWhatsApp(invoiceChaseText(selected, payLink))}
            style={{ width: '100%', height: 48, marginBottom: 10, background: '#128C7E', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <MessageCircle size={16} /> {isInvoiceOverdue(selected) ? 'Send reminder on WhatsApp' : 'Send on WhatsApp'}
          </button>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          {[
            { icon: <Download size={14} />, label: 'Download', action: () => downloadInvoicePdf(selected) },
            { icon: <Share2 size={14} />, label: 'Share', action: () => doShare(selected) },
            { icon: <Printer size={14} />, label: 'Print', action: () => printInvoice(selected) },
            { icon: <FileText size={14} />, label: 'Edit', action: () => openEdit(selected) },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action} style={{ height: 44, background: SURF, border: `1px solid ${BDR}`, borderRadius: 11, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: T2, cursor: 'pointer', fontFamily: F }}>
              {btn.icon} {btn.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: NEW — mode chooser + quick form + full form
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'new') {

    // ── Mode chooser ──────────────────────────────────────────────────────────
    if (newMode === 'choose') return (
      <div style={{ fontFamily: F, width: '100%', paddingBottom: 96 }}>
        {renderHeader('New', () => setView('list'))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 2 }}>What do you want to create?</div>

          {/* Quick request card */}
          <button onClick={() => setNewMode('quick')} style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 14, padding: 18, textAlign: 'left', cursor: 'pointer', fontFamily: F, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: SURF2, border: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Zap size={22} color={BLUE} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 3 }}>Quick request</div>
                <div style={{ fontSize: 13, color: T2, lineHeight: 1.5 }}>An amount and a note. Ready in seconds — great for splitting bills or a quick ask.</div>
              </div>
              <ChevronRight size={18} color={T3} />
            </div>
          </button>

          {/* Full invoice card */}
          <button onClick={() => setNewMode('full')} style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 14, padding: 18, textAlign: 'left', cursor: 'pointer', fontFamily: F, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: SURF2, border: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={22} color={BLUE} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 3 }}>Full invoice</div>
                <div style={{ fontSize: 13, color: T2, lineHeight: 1.5 }}>Line items, tax, due terms and a PDF — for formal billing to clients and companies.</div>
              </div>
              <ChevronRight size={18} color={T3} />
            </div>
          </button>
        </div>
      </div>
    )

    // ── Quick form ────────────────────────────────────────────────────────────
    if (newMode === 'quick') return (
      <div style={{ fontFamily: F, width: '100%', paddingBottom: 96 }}>
        {renderHeader('Quick Request', () => setNewMode('choose'))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <style>{`.nan-amt::placeholder{color:var(--nan-text3, rgba(255,255,255,0.4))} input.nan-amt{font-size:clamp(40px,13vw,56px) !important}`}</style>
          <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 14, padding: '20px 16px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: T2 }}>How much are you requesting?</div>
            <input className="nan-amt" type="number" inputMode="decimal" min="0" step="0.01" value={form.quickAmount}
              onChange={e => setForm(f => ({ ...f, quickAmount: e.target.value }))} placeholder="0.00" aria-label="Amount"
              style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: 'none', outline: 'none', textAlign: 'center', color: TEXT, fontSize: 'clamp(40px, 13vw, 56px)', fontWeight: 700, letterSpacing: '-0.04em', fontFamily: F, margin: '8px 0 12px', fontVariantNumeric: 'tabular-nums' }} />
            {errors.quickAmount && <div style={{ fontSize: 13, color: RED, marginBottom: 10 }}>{errors.quickAmount}</div>}
            <div style={{ maxWidth: 200, margin: '0 auto', textAlign: 'left' }}>
              <CurrencyPicker value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} />
            </div>
          </div>

          <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field t2={T2} red={RED} label="Who should pay? *" error={errors.quickRecipient}>
              <input value={form.quickRecipient} onChange={e => setForm(f => ({ ...f, quickRecipient: e.target.value }))}
                placeholder="Name or email" style={{ ...inputBase, borderColor: errors.quickRecipient ? 'rgba(239,68,68,0.5)' : BDR }} />
            </Field>
            <Field t2={T2} red={RED} label="What's it for? (optional)">
              <input value={form.quickNote} onChange={e => setForm(f => ({ ...f, quickNote: e.target.value }))}
                placeholder="Dinner, rent, design work…" style={inputBase} />
            </Field>
          </div>

          <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Where should the money go?</div>
              <div style={{ fontSize: 13, color: T2, marginTop: 3, lineHeight: 1.5 }}>Add your NAN handle, a wallet address, or both so payers can send crypto.</div>
            </div>
            <Field t2={T2} red={RED} label="Your NAN handle">
              <input value={form.payToNanHandle} onChange={e => setForm(f => ({ ...f, payToNanHandle: e.target.value }))}
                placeholder="@yourname" style={inputBase} />
            </Field>
            <Field t2={T2} red={RED} label="Your wallet address">
              <input value={form.payToAddress} onChange={e => setForm(f => ({ ...f, payToAddress: e.target.value }))}
                placeholder="0x…" style={{ ...inputBase, fontFamily: 'monospace', fontSize: 13 }} />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setNewMode('choose')} style={btnGhost}>Cancel</button>
            <button onClick={handleCreateQuick} style={btnPrimary}>
              <Zap size={15} /> Create & share
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: NEW (full) / EDIT — shared full invoice form
  // ═══════════════════════════════════════════════════════════════════════════
  const isEdit = view === 'edit'
  return (
    <div style={{ fontFamily: F, width: '100%', paddingBottom: 96 }}>
      {renderHeader(isEdit ? 'Edit Invoice' : 'New Invoice', () => isEdit ? setView('detail') : setNewMode('choose'))}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Your Business</div>
          <Field t2={T2} red={RED} label="Business name *" error={errors.businessName}>
            <input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Your name or company" style={{ ...inputBase, borderColor: errors.businessName ? 'rgba(239,68,68,0.5)' : BDR }} />
          </Field>
          <Field t2={T2} red={RED} label="Email">
            <input value={form.businessEmail} onChange={e => setForm(f => ({ ...f, businessEmail: e.target.value }))} placeholder="you@email.com" style={inputBase} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <Field t2={T2} red={RED} label="NAN handle (optional)">
              <input value={form.payToNanHandle} onChange={e => setForm(f => ({ ...f, payToNanHandle: e.target.value }))} placeholder="@yourname" style={inputBase} />
            </Field>
            <Field t2={T2} red={RED} label="Wallet address (optional)">
              <input value={form.payToAddress} onChange={e => setForm(f => ({ ...f, payToAddress: e.target.value }))} placeholder="0x…" style={{ ...inputBase, fontFamily: 'monospace', fontSize: 12 }} />
            </Field>
          </div>
          <div style={{ fontSize: 11, color: T3 }}>Payers can use either your NAN handle or wallet address.</div>
        </div>

        <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Bill To</div>
          <Field t2={T2} red={RED} label="Client name *" error={errors.customerName}>
            <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="Client name or company" style={{ ...inputBase, borderColor: errors.customerName ? 'rgba(239,68,68,0.5)' : BDR }} />
          </Field>
          <Field t2={T2} red={RED} label="Client email">
            <input value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} placeholder="client@email.com" style={inputBase} />
          </Field>
        </div>

        <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <Field t2={T2} red={RED} label="Issue date">
              <input type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} style={inputBase} />
            </Field>
            <Field t2={T2} red={RED} label="Due date *" error={errors.dueDate}>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={{ ...inputBase, borderColor: errors.dueDate ? 'rgba(239,68,68,0.5)' : BDR }} />
            </Field>
          </div>
          <Field t2={T2} red={RED} label="Currency">
            <CurrencyPicker value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} />
          </Field>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {[7, 14, 30, 60].map(d => (
              <button key={d} onClick={() => setForm(f => ({ ...f, dueDate: inDays(d) }))} style={{ height: 26, padding: '0 10px', background: SURF2, border: `1px solid ${BDR}`, borderRadius: 7, fontSize: 11, fontWeight: 600, color: T2, cursor: 'pointer', fontFamily: F, whiteSpace: 'nowrap' }}>
                Net {d}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Line Items</div>
            <button onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F }}>
              <Plus size={13} /> Add item
            </button>
          </div>
          {errors.items && <div style={{ padding: '8px 16px', fontSize: 12, color: RED, display: 'flex', alignItems: 'center', gap: 5 }}><AlertCircle size={12} />{errors.items}</div>}
          {form.items.map((item, idx) => (
            <div key={item.id} style={{ padding: 14, borderBottom: idx < form.items.length - 1 ? `1px solid ${BDR}` : 'none' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                <input value={item.name} onChange={e => updateItem(item.id, { name: e.target.value })} placeholder="Item name" style={{ ...inputBase, flex: 2 }} />
                {form.items.length > 1 && (
                  <button onClick={() => removeItem(item.id)} style={{ width: 34, height: 38, flexShrink: 0, background: SURF2, border: `1px solid ${BDR}`, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X size={13} color={T2} />
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 8 }}>
                <Field t2={T2} red={RED} label="Qty"><input type="number" min="1" value={item.quantity} onChange={e => updateItem(item.id, { quantity: Math.max(1, parseFloat(e.target.value) || 1) })} style={inputBase} /></Field>
                <Field t2={T2} red={RED} label={`Unit price (${form.currency})`}><input type="number" min="0" step="0.01" value={item.unitPrice || ''} onChange={e => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })} placeholder="0.00" style={inputBase} /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Field t2={T2} red={RED} label="Discount %"><input type="number" min="0" max="100" value={item.discount ?? ''} onChange={e => updateItem(item.id, { discount: parseFloat(e.target.value) || 0 })} placeholder="0" style={inputBase} /></Field>
                <Field t2={T2} red={RED} label="Tax %"><input type="number" min="0" max="100" value={item.tax ?? ''} onChange={e => updateItem(item.id, { tax: parseFloat(e.target.value) || 0 })} placeholder="0" style={inputBase} /></Field>
              </div>
              {item.name && item.unitPrice > 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: T2, textAlign: 'right' }}>
                  Line total: <strong style={{ color: TEXT }}>{fmtAmt(lineTotal(item), form.currency)}</strong>
                </div>
              )}
            </div>
          ))}
          <div style={{ padding: '12px 16px', background: SURF2, borderTop: `1px solid ${BDR}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: BLUE }}>{fmtAmt(totals.total, form.currency)}</span>
            </div>
          </div>
        </div>

        <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Notes & Instructions</div>
          <Field t2={T2} red={RED} label="Notes (optional)">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Thank you for your business!" rows={3} style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }} />
          </Field>
          <Field t2={T2} red={RED} label="Payment instructions">
            <textarea value={form.paymentInstructions} onChange={e => setForm(f => ({ ...f, paymentInstructions: e.target.value }))} placeholder="Pay via the link below, or send USDC directly to the address above." rows={2} style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }} />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => isEdit ? setView('detail') : setNewMode('choose')} style={btnGhost}>Cancel</button>
          {!isEdit && (
            <button onClick={() => handleCreate('draft')} style={{ ...btnGhost, flex: 1 }}>
              <Clock size={15} /> Save draft
            </button>
          )}
          <button onClick={() => isEdit ? handleUpdate() : handleCreate('sent')} style={btnPrimary}>
            <Check size={15} /> {isEdit ? 'Save changes' : 'Create & send'}
          </button>
        </div>
      </div>
    </div>
  )
}
