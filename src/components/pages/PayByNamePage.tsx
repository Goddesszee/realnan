/**
 * PayByNamePage — public pay-by-NAN-name page.
 *
 * URL: nanarc.xyz/?nanpay=alice  (or ?nanpay=@alice)
 *
 * Flow:
 *  1. Resolve the NAN handle → wallet address via NANNameRegistry
 *  2. Show branded merchant card with amount input + note
 *  3. Payer chooses: Card (first), Wallet, Scan QR, Copy
 *  4. After wallet pay: shareable receipt screen
 *  5. After QR/Copy: tx hash confirmation field → /api/invoice-claim
 *  6. No NAN account required on either side
 */
import React, { useState, useEffect } from 'react'
import {
  Wallet, ArrowUpRight, AlertCircle,
  CheckCircle2, ExternalLink, Copy, Check, Loader2,
  Smartphone, AtSign, Share2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { OnrampCardPanel } from './OnrampCardPanel'
import {
  useWriteContract, useWaitForTransactionReceipt,
  useAccount, useChainId, useSwitchChain,
} from 'wagmi'
import { erc20Abi, isAddress } from 'viem'
import { ConnectKitButton } from 'connectkit'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { NanLogo } from '../NanLogo'
import { createPublicClient, http } from 'viem'
import { usePublicPage } from '../../hooks/usePublicPage'

// ── Constants ──────────────────────────────────────────────────────────────────
const F    = "'Inter', -apple-system, sans-serif"
const MONO = "'JetBrains Mono', Menlo, monospace"
const BLUE  = '#2563EB'
const BG    = '#F3F4F6'
const SURF  = '#FFFFFF'
const SURF2 = '#F9FAFB'
const BDR   = '#E5E7EB'
const TEXT  = '#111827'
const TEXT2 = '#6B7280'
const TEXT3 = '#9CA3AF'
const GREEN  = '#16A34A'
const GREEN_L = '#DCFCE7'

const ARC_ID        = 5042
const USDC_ADDRESS  = '0x3600000000000000000000000000000000000000' as `0x${string}`
const USDC_DECIMALS = 6
const ARC_RPC       = 'https://rpc.mainnet.arc.io'
const NAME_REGISTRY = (import.meta.env.VITE_NAME_REGISTRY as string | undefined) ?? ''


const RESOLVE_ABI = [
  { name: 'resolve',     type: 'function', stateMutability: 'view', inputs: [{ name: 'name', type: 'string' }], outputs: [{ name: '', type: 'address' }] },
  { name: 'primaryName', type: 'function', stateMutability: 'view', inputs: [{ name: 'addr', type: 'address' }], outputs: [{ name: '', type: 'string'  }] },
] as const

const ARC_CHAIN = {
  id: ARC_ID,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC] }, public: { http: [ARC_RPC] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' } },
} as const

let _publicClient: ReturnType<typeof createPublicClient> | null = null
function getPublicClient() {
  if (!_publicClient) _publicClient = createPublicClient({ transport: http(ARC_RPC), chain: ARC_CHAIN })
  return _publicClient
}

async function resolveNanName(handle: string): Promise<string | null> {
  if (!NAME_REGISTRY) return null
  const name = handle.startsWith('@') ? handle.slice(1) : handle
  if (!name) return null
  try {
    const addr = await getPublicClient().readContract({
      address: NAME_REGISTRY as `0x${string}`,
      abi: RESOLVE_ABI,
      functionName: 'resolve',
      args: [name],
    }) as string
    if (!addr || addr === '0x0000000000000000000000000000000000000000') return null
    return addr
  } catch { return null }
}

function fmt(n: number) {
  return n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Deterministic colour from a string (for avatar background)
function strColor(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue},60%,45%)`
}

// ── Identicon avatar ───────────────────────────────────────────────────────────
function Avatar({ handle, size = 56 }: { handle: string; size?: number }) {
  const bg = strColor(handle)
  const initials = handle.slice(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: size * 0.36,
      fontWeight: 800, color: '#fff', fontFamily: F, userSelect: 'none' }}>
      {initials}
    </div>
  )
}

// ── Share receipt helper ───────────────────────────────────────────────────────
function shareReceipt(txHash: string, handle: string, amount: number) {
  const url = `https://explorer.arc.io/tx/${txHash}`
  const text = `I just sent ${fmt(amount)} USDC to @${handle} on NAN ⚡`
  if (navigator.share) {
    void navigator.share({ title: 'NAN Payment Receipt', text, url }).catch(() => {})
  } else {
    void navigator.clipboard.writeText(`${text}\n${url}`)
    toast.success('Receipt link copied!')
  }
}

// ── Wallet pay panel ───────────────────────────────────────────────────────────
function WalletPayPanel({
  toAddress, amount, handle, note, onSuccess,
}: {
  toAddress: string; amount: number; handle: string; note: string
  onSuccess: (txHash: string) => void
}) {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [switching, setSwitching] = useState(false)

  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const onWrongChain = isConnected && chainId !== ARC_ID

  useEffect(() => {
    if (isSuccess && txHash) { onSuccess(txHash); toast.success('Payment sent!') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, txHash])

  const handlePay = () => {
    if (!isConnected || !address) return
    if (onWrongChain) { setSwitching(true); switchChain({ chainId: ARC_ID }, { onSettled: () => setSwitching(false) }); return }
    if (!isAddress(toAddress)) { toast.error('Invalid recipient address.'); return }
    writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [toAddress, BigInt(Math.round(amount * 10 ** USDC_DECIMALS))],
    })
  }

  const busy    = switching || isPending || isConfirming
  const noAmt   = amount <= 0

  if (!isConnected) return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <p style={{ fontSize: 13, color: TEXT2, marginBottom: 14, lineHeight: 1.5 }}>
        Connect any EVM wallet to pay with USDC on Arc.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <ConnectKitButton />
      </div>
      <p style={{ fontSize: 11, color: TEXT3, marginTop: 12 }}>MetaMask, Coinbase Wallet, WalletConnect &amp; more</p>
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: 12, color: TEXT2, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN, display: 'inline-block' }} />
        {address!.slice(0, 10)}…{address!.slice(-6)}
      </div>
      {onWrongChain && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A',
          borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400E', marginBottom: 12 }}>
          Wrong network — click Pay to switch to Arc automatically.
        </div>
      )}
      {writeError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>
          {writeError.message?.includes('rejected') ? 'Rejected in wallet.' : 'Transaction failed. Please try again.'}
        </div>
      )}
      {noAmt && (
        <div style={{ fontSize: 12, color: TEXT3, textAlign: 'center', marginBottom: 10 }}>
          Enter an amount above to pay.
        </div>
      )}
      {note && (
        <div style={{ background: SURF2, border: `1px solid ${BDR}`, borderRadius: 10,
          padding: '8px 14px', fontSize: 12, color: TEXT2, marginBottom: 12, lineHeight: 1.5 }}>
          Note: <span style={{ color: TEXT }}>{note}</span>
        </div>
      )}
      <button onClick={handlePay} disabled={busy || noAmt}
        style={{ width: '100%', height: 54, borderRadius: 14,
          background: (busy || noAmt) ? SURF2 : BLUE,
          border: (busy || noAmt) ? `1px solid ${BDR}` : 'none',
          color: (busy || noAmt) ? TEXT3 : '#fff',
          fontSize: 16, fontWeight: 700, cursor: (busy || noAmt) ? 'not-allowed' : 'pointer',
          fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: (busy || noAmt) ? 'none' : `0 4px 16px rgba(37,99,235,0.3)`,
          transition: 'all 0.15s' }}>
        {switching ? 'Switching to Arc…'
          : isPending ? 'Approve in wallet…'
          : isConfirming
            ? <><span style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block',
                animation: 'nbspin 0.8s linear infinite' }} />Confirming…</>
            : onWrongChain
              ? <><ArrowUpRight size={18} />Switch to Arc &amp; Pay</>
              : noAmt
                ? <><ArrowUpRight size={18} />Enter amount above</>
                : <><ArrowUpRight size={18} />Pay {fmt(amount)} USDC to @{handle}</>}
      </button>
      {writeError && (
        <button onClick={() => reset()}
          style={{ marginTop: 8, width: '100%', height: 40, borderRadius: 12, background: 'none',
            border: `1px solid ${BDR}`, color: TEXT2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F }}>
          Try again
        </button>
      )}
    </div>
  )
}

// ── QR tab ─────────────────────────────────────────────────────────────────────
function QrTab({ toAddress, amount, onConfirm }: { toAddress: string; amount: number; onConfirm: () => void }) {
  const hasAmt = amount > 0
  const amountHex = hasAmt ? `0x${(BigInt(Math.round(amount * 10 ** USDC_DECIMALS))).toString(16)}` : ''
  const qrValue   = hasAmt
    ? `ethereum:${USDC_ADDRESS}/transfer?address=${toAddress}&uint256=${amountHex}`
    : toAddress
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 14, border: `1px solid ${BDR}`, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <QRCodeSVG value={qrValue} size={180} bgColor="#ffffff" fgColor="#111111" level="M" />
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: TEXT2, lineHeight: 1.5 }}>
        {hasAmt
          ? <>Scan with MetaMask, Trust Wallet, or any EVM wallet.<br />Amount pre-fills automatically.</>
          : <>Scan to load the recipient address in your wallet.<br />Enter an amount above to pre-fill the payment.</>}
      </div>
      <TxConfirmField onConfirm={onConfirm} />
    </div>
  )
}

// ── Copy address panel ─────────────────────────────────────────────────────────
function CopyAddressPanel({ toAddress, amount, handle, onConfirm }: { toAddress: string; amount: number; handle: string; onConfirm: () => void }) {
  const [copiedAddr, setCopiedAddr] = useState(false)
  const [copiedAmt, setCopiedAmt]   = useState(false)

  const copy = (text: string, which: 'addr' | 'amt') => {
    void navigator.clipboard.writeText(text)
    if (which === 'addr') { setCopiedAddr(true); setTimeout(() => setCopiedAddr(false), 2000) }
    else                  { setCopiedAmt(true);  setTimeout(() => setCopiedAmt(false),  2000) }
    toast.success('Copied!')
  }

  const steps = [
    { n: '1', text: 'Open your wallet app or exchange' },
    { n: '2', text: amount > 0 ? `Send exactly ${fmt(amount)} USDC on Arc` : 'Enter an amount above, then send that exact amount in USDC on Arc' },
    { n: '3', text: 'Paste the address below as the recipient' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: SURF2, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BDR}` }}>
        {steps.map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i < steps.length - 1 ? 10 : 0 }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: BLUE, color: '#fff',
              fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{s.n}</span>
            <span style={{ fontSize: 13, color: TEXT2, lineHeight: 1.4 }}>{s.text}</span>
          </div>
        ))}
      </div>

      {amount > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Amount</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, background: SURF2, border: `1px solid ${BDR}`, borderRadius: 10,
              padding: '10px 14px', fontFamily: MONO, fontSize: 15, fontWeight: 700, color: TEXT }}>
              {fmt(amount)} USDC
            </div>
            <button onClick={() => copy(String(amount), 'amt')}
              style={{ width: 40, height: 40, borderRadius: 10,
                background: copiedAmt ? 'rgba(16,185,129,0.12)' : SURF2,
                border: `1px solid ${copiedAmt ? 'rgba(16,185,129,0.3)' : BDR}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}>
              {copiedAmt ? <Check size={15} color={GREEN} /> : <Copy size={15} color={TEXT2} />}
            </button>
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Recipient address (USDC · Arc)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, background: SURF2, border: `1px solid ${BDR}`, borderRadius: 10,
            padding: '10px 14px', fontFamily: MONO, fontSize: 12, color: TEXT, wordBreak: 'break-all', lineHeight: 1.5 }}>
            {toAddress}
          </div>
          <button onClick={() => copy(toAddress, 'addr')}
            style={{ width: 40, height: 40, borderRadius: 10,
              background: copiedAddr ? 'rgba(16,185,129,0.12)' : SURF2,
              border: `1px solid ${copiedAddr ? 'rgba(16,185,129,0.3)' : BDR}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}>
            {copiedAddr ? <Check size={15} color={GREEN} /> : <Copy size={15} color={TEXT2} />}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: TEXT3, textAlign: 'center', paddingTop: 4 }}>
        Paying @{handle} · USDC on Arc
      </div>

      <TxConfirmField onConfirm={onConfirm} />
    </div>
  )
}

// ── Tx hash confirm field (shared by QR + Copy) ────────────────────────────────
function TxConfirmField({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen]   = useState(false)
  const [hash, setHash]   = useState('')
  const [busy, setBusy]   = useState(false)

  const submit = async () => {
    if (!hash.trim()) return
    setBusy(true)
    try {
      await fetch('/api/invoice-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: hash.trim(), payerName: 'Payer' }),
      })
    } catch { /* best effort */ }
    setBusy(false)
    onConfirm()
  }

  return (
    <div style={{ width: '100%' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.20)', color: GREEN, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 7 }}>
        <CheckCircle2 size={15} />
        I've sent the payment
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={hash}
            onChange={e => setHash(e.target.value)}
            placeholder="Paste transaction hash (optional)"
            style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${BDR}`,
              background: SURF2, color: TEXT, fontSize: 13, fontFamily: MONO, outline: 'none',
              boxSizing: 'border-box' }}
          />
          <button onClick={() => void submit()} disabled={busy}
            style={{ height: 42, borderRadius: 10, background: busy ? SURF2 : '#16A34A',
              border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer', fontFamily: F,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            {busy
              ? <><Loader2 size={15} style={{ animation: 'nbspin 1s linear infinite' }} />Confirming…</>
              : <><CheckCircle2 size={15} />Confirm payment</>}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Amount editor ──────────────────────────────────────────────────────────────
const QUICK = [10, 25, 50, 100]

function AmountPicker({ value, onChange, fixed }: { value: number; onChange: (n: number) => void; fixed: boolean }) {
  const [raw, setRaw] = useState(value > 0 ? String(value) : '')
  if (fixed) return (
    <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
      <div style={{ fontSize: 11, color: TEXT3, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount</div>
      <div style={{ fontSize: 48, fontWeight: 900, color: TEXT, fontFamily: MONO, letterSpacing: '-0.04em', lineHeight: 1 }}>{fmt(value)}</div>
      <div style={{ fontSize: 14, color: BLUE, fontWeight: 700, marginTop: 4 }}>USDC</div>
    </div>
  )
  return (
    <div style={{ padding: '14px 0 8px' }}>
      <div style={{ fontSize: 11, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Enter amount</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        background: SURF, border: `1.5px solid ${BDR}`, borderRadius: 12, marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: TEXT3 }}>$</span>
        <input type="number" min={0} value={raw} placeholder="0.00"
          onChange={e => { setRaw(e.target.value); const n = parseFloat(e.target.value); if (!isNaN(n) && n > 0) onChange(n) }}
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 32, fontWeight: 800,
            color: TEXT, background: 'transparent', fontFamily: MONO, minWidth: 0, letterSpacing: '-0.02em' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: BLUE, flexShrink: 0 }}>USDC</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7 }}>
        {QUICK.map(a => (
          <button key={a} onClick={() => { setRaw(String(a)); onChange(a) }}
            style={{ height: 38, borderRadius: 9, background: value === a ? BLUE : SURF2,
              color: value === a ? '#fff' : TEXT2,
              border: `1px solid ${value === a ? BLUE : BDR}`,
              fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: F, transition: 'all 0.12s' }}>
            ${a}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Note input ─────────────────────────────────────────────────────────────────
function NoteInput({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <div style={{ padding: '0 0 8px' }}>
      <div style={{ fontSize: 11, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Note (optional)</div>
      <input
        type="text"
        placeholder="What's this for? e.g. dinner, rent…"
        value={value}
        maxLength={80}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${BDR}`,
          background: SURF, color: TEXT, fontSize: 13, fontFamily: F, outline: 'none',
          boxSizing: 'border-box', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      />
    </div>
  )
}

// ── Success screen ─────────────────────────────────────────────────────────────
function SuccessScreen({ txHash, handle, amount }: { txHash: string; handle: string; amount: number }) {
  const [copied, setCopied] = useState(false)

  const copyLink = () => {
    const url = `https://explorer.arc.io/tx/${txHash}`
    void navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Link copied!')
  }

  return (
    <Shell>
      <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
        {/* Confetti ring */}
        <div style={{ width: 84, height: 84, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(0,102,255,0.08) 100%)',
          border: '2px solid rgba(16,185,129,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle2 size={38} color={GREEN} />
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: TEXT, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Payment sent!
        </h2>
        <p style={{ fontSize: 15, color: TEXT2, lineHeight: 1.6, marginBottom: 6 }}>
          You sent <span style={{ color: TEXT, fontWeight: 700 }}>{fmt(amount)} USDC</span> to{' '}
          <span style={{ color: BLUE, fontWeight: 700 }}>@{handle}</span>.
        </p>
        <p style={{ fontSize: 12, color: TEXT3, marginBottom: 24 }}>
          Settled instantly on Arc.
        </p>

        {/* Receipt card */}
        <div style={{ background: SURF2, border: `1px solid ${BDR}`, borderRadius: 14,
          padding: '14px 18px', marginBottom: 20, textAlign: 'left' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEXT3, textTransform: 'uppercase',
            letterSpacing: '0.07em', marginBottom: 8 }}>Transaction</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: TEXT2, wordBreak: 'break-all', lineHeight: 1.5 }}>
            {txHash}
          </div>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 10 }}>
          <a href={`https://explorer.arc.io/tx/${txHash}`} target="_blank" rel="noreferrer"
            style={{ flex: 1, height: 46, borderRadius: 12, background: SURF2, border: `1px solid ${BDR}`,
              color: TEXT2, fontSize: 13, fontWeight: 600, textDecoration: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ExternalLink size={14} />View
          </a>
          <button onClick={() => shareReceipt(txHash, handle, amount)}
            style={{ flex: 1, height: 46, borderRadius: 12, background: BLUE, border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: F,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 4px 16px rgba(37,99,235,0.25)' }}>
            <Share2 size={14} />Share receipt
          </button>
          <button onClick={copyLink}
            style={{ width: 46, height: 46, borderRadius: 12,
              background: copied ? GREEN_L : SURF2,
              border: `1px solid ${copied ? '#86EFAC' : BDR}`,
              color: copied ? GREEN : TEXT2, cursor: 'pointer', fontFamily: F,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        <div style={{ marginTop: 24 }}>
          <a href="https://nanarc.xyz"
            style={{ display: 'inline-block', padding: '11px 24px', borderRadius: 12, background: SURF2,
              border: `1px solid ${BDR}`, color: TEXT2, fontSize: 13, fontWeight: 600,
              textDecoration: 'none', fontFamily: F }}>
            Get your own NAN name
          </a>
        </div>
      </div>
    </Shell>
  )
}

// ── Copy-confirm success (no tx hash) ─────────────────────────────────────────
function CopyConfirmSuccess({ handle, amount }: { handle: string; amount: number }) {
  return (
    <Shell>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <CheckCircle2 size={34} color={GREEN} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 8 }}>Payment claimed!</h2>
        <p style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6, marginBottom: 20 }}>
          Your payment of <strong style={{ color: TEXT }}>{fmt(amount)} USDC</strong> to{' '}
          <strong style={{ color: BLUE }}>@{handle}</strong> has been recorded.
        </p>
        <a href="https://nanarc.xyz"
          style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: BLUE,
            color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: F,
            boxShadow: '0 4px 16px rgba(0,102,255,0.30)' }}>
          Get your own NAN name
        </a>
      </div>
    </Shell>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
type PayMethod = 'card' | 'wallet' | 'qr' | 'copy'
type ResolveState = 'loading' | 'found' | 'notfound' | 'noregistry'

function getUrlAmount(): { amount: number; fixed: boolean } {
  try {
    const p = new URLSearchParams(window.location.search)
    const a = parseFloat(p.get('amount') ?? '0')
    if (a > 0) return { amount: a, fixed: true }
  } catch { /* ignore */ }
  return { amount: 0, fixed: false }
}

function getInitialResolveState(cleanHandle: string): ResolveState {
  if (!cleanHandle) return 'notfound'
  if (!NAME_REGISTRY) return 'noregistry'
  return 'loading'
}

export function PayByNamePage({ handle }: { handle: string }) {
  usePublicPage()

  const cleanHandle = handle.replace(/^@/, '')

  const [resolveState, setResolveState] = useState<ResolveState>(() => getInitialResolveState(cleanHandle))
  const [toAddress, setToAddress]       = useState('')
  const [amount, setAmount]             = useState(() => getUrlAmount().amount)
  const [fixedAmount]                   = useState(() => getUrlAmount().fixed)
  const [method, setMethod]             = useState<PayMethod>('card')
  const [note, setNote]                 = useState('')
  const [successHash, setSuccessHash]   = useState<string | null>(null)
  const [copyConfirmed, setCopyConfirmed] = useState(false)
  const [showMore, setShowMore]         = useState(false)

  useEffect(() => {
    if (resolveState !== 'loading') return
    void (async () => {
      const addr = await resolveNanName(cleanHandle)
      if (addr) { setToAddress(addr); setResolveState('found') }
      else setResolveState('notfound')
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanHandle])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (resolveState === 'loading') return (
    <Shell>
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Loader2 size={36} color={BLUE} style={{ animation: 'nbspin 1s linear infinite', marginBottom: 14 }} />
        <div style={{ fontSize: 15, color: TEXT2 }}>Resolving @{cleanHandle}…</div>
      </div>
    </Shell>
  )

  // ── Not found ──────────────────────────────────────────────────────────────
  if (resolveState === 'notfound' || resolveState === 'noregistry') return (
    <Shell>
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(239,68,68,0.10)',
          border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertCircle size={26} color="#EF4444" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 8 }}>@{cleanHandle} not found</h2>
        <p style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6 }}>
          {resolveState === 'noregistry'
            ? 'The NAN Name Registry is not configured on this deployment.'
            : "This NAN name doesn't exist or hasn't been registered yet."}
        </p>
        <a href="https://nanarc.xyz"
          style={{ display: 'inline-block', marginTop: 20, padding: '11px 24px', borderRadius: 12,
            background: BLUE, color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: F,
            boxShadow: '0 4px 16px rgba(0,102,255,0.30)' }}>
          Open NAN
        </a>
      </div>
    </Shell>
  )

  // ── Success (wallet pay) ───────────────────────────────────────────────────
  if (successHash) return <SuccessScreen txHash={successHash} handle={cleanHandle} amount={amount} />

  // ── Success (copy/QR confirm) ──────────────────────────────────────────────
  if (copyConfirmed) return <CopyConfirmSuccess handle={cleanHandle} amount={amount} />

  // ── Main pay page ──────────────────────────────────────────────────────────
  return (
    <Shell>
      {/* Recipient header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20,
        paddingBottom: 18, borderBottom: `1px solid ${BDR}` }}>
        <Avatar handle={cleanHandle} size={54} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            @{cleanHandle}
          </div>
          <div style={{ fontSize: 12, color: TEXT3, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <AtSign size={11} />
            NAN Pay · USDC on Arc
          </div>
        </div>
      </div>

      {/* Amount */}
      <AmountPicker value={amount} onChange={setAmount} fixed={fixedAmount} />

      {/* Note */}
      {!fixedAmount && (
        <div style={{ marginTop: 10 }}>
          <NoteInput value={note} onChange={setNote} />
        </div>
      )}

      {/* Primary CTA: Card */}
      <div style={{ marginTop: 16 }}>
        {method === 'card' && (
          <OnrampCardPanel toAddress={toAddress} amount={amount} recipientLabel={`@${cleanHandle}`} />
        )}
        {method === 'wallet' && (
          <WalletPayPanel toAddress={toAddress} amount={amount} handle={cleanHandle} note={note} onSuccess={setSuccessHash} />
        )}
        {method === 'qr' && (
          <QrTab toAddress={toAddress} amount={amount} onConfirm={() => setCopyConfirmed(true)} />
        )}
        {method === 'copy' && (
          <CopyAddressPanel toAddress={toAddress} amount={amount} handle={cleanHandle} onConfirm={() => setCopyConfirmed(true)} />
        )}

        {/* Primary method pills: Card + Wallet */}
        {method !== 'card' && method !== 'wallet' ? null : (
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            {(['card', 'wallet'] as PayMethod[]).map(id => (
              <button key={id} onClick={() => setMethod(id)}
                style={{ flex: 1, height: 40, borderRadius: 10,
                  background: method === id ? BLUE : SURF2,
                  color: method === id ? '#fff' : TEXT2,
                  border: `1px solid ${method === id ? BLUE : BDR}`,
                  fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: F,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.12s' }}>
                {id === 'card' ? <><CreditCard size={14} />Card</> : <><Wallet size={14} />Wallet</>}
              </button>
            ))}
          </div>
        )}

        {/* "More options" toggle */}
        {(method === 'card' || method === 'wallet') && (
          <button onClick={() => setShowMore(v => !v)}
            style={{ width: '100%', marginTop: 10, height: 36, borderRadius: 10, background: 'none',
              border: `1px solid ${BDR}`, color: TEXT3, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 5 }}>
            {showMore ? <><ChevronUp size={13} />Hide other options</> : <><ChevronDown size={13} />More options (QR, copy address)</>}
          </button>
        )}

        {/* Secondary options: QR + Copy */}
        {showMore && (method === 'card' || method === 'wallet') && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {(['qr', 'copy'] as PayMethod[]).map(id => (
              <button key={id} onClick={() => setMethod(id)}
                style={{ flex: 1, height: 40, borderRadius: 10, background: SURF2,
                  color: TEXT2, border: `1px solid ${BDR}`,
                  fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: F,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {id === 'qr' ? <><Smartphone size={14} />Scan QR</> : <><Copy size={14} />Copy</>}
              </button>
            ))}
          </div>
        )}

        {/* Back button when in QR/copy mode */}
        {(method === 'qr' || method === 'copy') && (
          <button onClick={() => { setMethod('card'); setShowMore(false) }}
            style={{ width: '100%', marginTop: 12, height: 36, borderRadius: 10, background: 'none',
              border: `1px solid ${BDR}`, color: TEXT3, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: F }}>
            ← Back to payment options
          </button>
        )}
      </div>

      <style>{`@keyframes nbspin { to { transform: rotate(360deg); } }`}</style>
    </Shell>
  )
}

// ── Shared shell ───────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start', padding: '28px 16px 56px',
      fontFamily: F, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
      {/* Card */}
      <div style={{ background: SURF, borderRadius: 24, border: `1px solid ${BDR}`,
        width: '100%', maxWidth: 460, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {/* Header bar */}
        <div style={{ background: BLUE, padding: '16px 22px', borderRadius: '24px 24px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <NanLogo height={20} showText={true} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: MONO, letterSpacing: '0.04em',
            background: 'rgba(255,255,255,0.15)', padding: '3px 8px', borderRadius: 999 }}>
            Arc · USDC
          </span>
        </div>
        {/* Body */}
        <div style={{ padding: '22px 24px 28px' }}>
          {children}
        </div>
      </div>
      {/* Footer */}
      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 7, opacity: 0.5 }}>
        <NanLogo height={13} />
        <span style={{ fontSize: 11, color: TEXT2 }}>Powered by NAN · Circle · Arc</span>
      </div>
    </div>
  )
}
