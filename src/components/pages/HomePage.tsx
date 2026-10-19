import React, { useState, useEffect } from 'react'
import { shareLink } from '../../lib/share-sheet'
import { useAccount, useReadContract } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { erc20Abi } from 'viem'
import {
  Eye, EyeOff, Plus, Send, ArrowLeftRight, Banknote,
  Activity as ActivityIcon,
  ArrowUpRight, ArrowDownLeft, ChevronRight,
  ArrowDownToLine, Sparkles, Bot,
  CheckCircle2, Clock, ShoppingBag,
  RefreshCw, Gift, Link2, Copy, Check as CheckIcon, AtSign, Share2,
  ExternalLink, Repeat2, X as XIcon,
} from 'lucide-react'
import { useAppStore, ActivityItem } from '../../store/appStore'
import { getUsdc } from '../../onchain-facts'
import { useNanTheme, NanTheme } from '../../hooks/useNanTheme'
import { NotificationBell } from '../ui/NotificationBell'
import { TokenLogo } from '../ui/TokenLogo'
import { useSyncMultiChainBalances } from '../../hooks/useMultiChainBalances'
import { usePortfolioBalances } from '../../hooks/usePortfolioBalances'
import { useFxRates } from '../../hooks/useFxRates'
import { nairaRampVisible } from '../../lib/naira-ramp'
import { showAddMoneySheet } from '../../lib/add-money-sheet'
import { useDisplayCurrency, currencyFlag } from '../../lib/display-currency'
import { TokenNetworkSheet } from './TokenNetworkSheet'
import { useNanName } from '../../hooks/useNanName'
import { RewardsSheet } from './RewardsSheet'

const F    = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace"
const ARC  = 5042

// ─── NAN Pay Link card ────────────────────────────────────────────────────────
function PayLinkCard({
  nanHandle, setActiveView, C,
}: {
  nanHandle: string
  setActiveView: (v: string) => void
  C: NanTheme
}) {
  const [copied, setCopied] = React.useState(false)
  const handle   = nanHandle ? nanHandle.replace(/^@/, '') : ''
  const payLink  = handle ? `https://nanarc.xyz/@${handle}` : ''

  const copy = () => {
    if (!payLink) return
    void navigator.clipboard.writeText(payLink).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500)
    })
  }

  const share = async () => {
    if (!payLink) return
    await shareLink({ title: `Pay @${handle} with NAN`, text: `Pay @${handle} on NAN, no account needed:`, url: payLink })
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {!handle ? (
        /* ── No NAN name yet — compact CTA ── */
        <button
          onClick={() => setActiveView('nan-name')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', borderRadius: 14,
            background: C.blueDim, border: `1px solid ${C.blueBd}`,
            cursor: 'pointer', fontFamily: F,
            WebkitTapHighlightColor: 'transparent', textAlign: 'left',
            boxSizing: 'border-box',
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: C.blue,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AtSign size={18} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Get your pay link</div>
            <div style={{ fontSize: 11, color: C.t2, marginTop: 1 }}>Claim a @name · anyone can pay you</div>
          </div>
          <ChevronRight size={15} color={C.blue} strokeWidth={2.5} />
        </button>
      ) : (
        /* ── Has NAN name — prominent pay link ── */
        <div style={{
          background: C.surf, border: `1px solid ${C.bdr}`,
          borderRadius: 14, overflow: 'hidden',
        }}>
          {/* top blue accent bar */}
          <div style={{ height: 3, background: C.blue }} />

          <div style={{ padding: '12px 14px' }}>
            {/* Link row — big and visible */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: C.blueDim, border: `1px solid ${C.blueBd}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Link2 size={16} color={C.blue} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  nanarc.xyz/<span style={{ color: C.blue }}>@{handle}</span>
                </div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 1 }}>Your pay link · anyone can pay with card or crypto</div>
              </div>
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={copy} style={{
                flex: 1, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: F,
                background: copied ? 'rgba(16,185,129,0.12)' : C.blue,
                color: copied ? '#10B981' : '#fff',
                fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
              }}>
                {copied ? <CheckIcon size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <button onClick={() => { void share() }} style={{
                flex: 1, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                borderRadius: 10, border: `1px solid ${C.bdr}`, cursor: 'pointer', fontFamily: F,
                background: 'transparent', color: C.text,
                fontSize: 13, fontWeight: 600,
              }}>
                <Share2 size={13} color={C.t2} /> Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Recent Activity helpers ──────────────────────────────────────────────────

type TxFilter = 'all' | 'sent' | 'received' | 'swaps' | 'agent'

function txLabel(item: ActivityItem): string {
  if (item.agentInitiated) return 'Agent payment'
  if (item.type === 'swap')           return 'Token swap'
  if (item.type === 'bridge')         return 'Bridge transfer'
  if (item.type === 'purchase')       return 'Purchase'
  if (item.type === 'agent_purchase') return 'Agent payment'
  if (item.type === 'request')        return item.sign === '+' ? 'Request paid' : 'Payment request'
  if (item.sign === '+')              return 'Payment received'
  return 'Payment sent'
}

function txIcon(item: ActivityItem, C: NanTheme): { icon: React.ReactNode; bg: string; iconColor: string } {
  if (item.agentInitiated || item.type === 'agent_purchase') return { icon: <Bot size={14} />, bg: C.blueDim, iconColor: C.blue }
  if (item.type === 'swap')    return { icon: <Repeat2 size={14} />, bg: 'rgba(139,92,246,0.10)', iconColor: '#8B5CF6' }
  if (item.type === 'bridge')  return { icon: <ArrowLeftRight size={14} />, bg: 'rgba(139,92,246,0.10)', iconColor: '#8B5CF6' }
  if (item.type === 'purchase') return { icon: <ShoppingBag size={14} />, bg: `rgba(245,158,11,0.10)`, iconColor: C.gold }
  if (item.sign === '+')       return { icon: <ArrowDownLeft size={14} />, bg: 'rgba(16,185,129,0.10)', iconColor: C.green }
  return { icon: <ArrowUpRight size={14} />, bg: 'rgba(239,68,68,0.08)', iconColor: C.red }
}

function txExplorerUrl(item: ActivityItem): string | null {
  if (!item.txHash) return null
  const base = item.chain?.toLowerCase().includes('base') ? 'https://sepolia.basescan.org'
    : item.chain?.toLowerCase().includes('eth') ? 'https://sepolia.etherscan.io'
    : 'https://explorer.arc.io'
  return `${base}/tx/${item.txHash}`
}

function StatusPill({ status, C }: { status: ActivityItem['status']; C: NanTheme }) {
  const map = {
    confirmed: { label: 'Completed', color: C.green,  bg: 'rgba(16,185,129,0.10)' },
    pending:   { label: 'Pending',   color: C.gold,   bg: 'rgba(245,158,11,0.10)' },
    failed:    { label: 'Failed',    color: C.red,    bg: 'rgba(239,68,68,0.08)'  },
  }
  const s = map[status] ?? map.confirmed
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: s.color,
      background: s.bg, borderRadius: 20,
      padding: '2px 7px', whiteSpace: 'nowrap', letterSpacing: '0.01em',
      fontFamily: F,
    }}>
      {s.label}
    </span>
  )
}

function TxRow({ item, C, last }: { item: ActivityItem; C: NanTheme; last: boolean }) {
  const [expanded, setExpanded] = React.useState(false)
  const isIn  = item.sign === '+'
  const isSwap = item.type === 'swap'
  const { icon, bg, iconColor } = txIcon(item, C)
  const ts        = new Date(item.timestamp)
  const timeLabel = ts.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
  const dateLabel = ts.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  const explorerUrl = txExplorerUrl(item)
  const amtStr = `${item.sign === '+' ? '+' : '−'}$${typeof item.amount === 'number' ? item.amount.toFixed(2) : item.amount}`

  // Parse swap description e.g. "Swapped 10 USDC → 9.2 EURC"
  const swapMatch = isSwap ? item.description.match(/(\d[\d.]*)\s+(\w+)\s*[→>]\s*(\d[\d.]*)\s+(\w+)/i) : null

  return (
    <div>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 16px',
          background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: (!expanded && !last) ? `1px solid ${C.bdr}` : 'none',
          fontFamily: F, WebkitTapHighlightColor: 'transparent',
          textAlign: 'left', transition: 'background 0.1s',
        }}
      >
        {/* Circle icon */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: iconColor,
        }}>
          {icon}
        </div>

        {/* Label + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
            {txLabel(item)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            {item.counterparty && (
              <span style={{ fontSize: 11, color: C.t2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{item.counterparty}</span>
            )}
            {item.counterparty && <span style={{ fontSize: 10, color: C.t3 }}>·</span>}
            <span style={{ fontSize: 11, color: C.t3, whiteSpace: 'nowrap' }}>{dateLabel}, {timeLabel}</span>
          </div>
        </div>

        {/* Amount + status */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {isSwap && swapMatch ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: MONO }}>{swapMatch[1]} {swapMatch[2]}</span>
              <ArrowLeftRight size={10} color={C.t3} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.green, fontFamily: MONO }}>{swapMatch[3]} {swapMatch[4]}</span>
            </div>
          ) : (
            <span style={{
              fontSize: 13, fontWeight: 700, fontFamily: MONO,
              color: isIn ? C.green : C.text,
            }}>{amtStr}</span>
          )}
          <StatusPill status={item.status} C={C} />
        </div>
      </button>

      {/* Expanded detail drawer */}
      {expanded && (
        <div style={{
          padding: '10px 16px 14px 64px',
          borderBottom: !last ? `1px solid ${C.bdr}` : 'none',
          background: C.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
        }}>
          {/* Description */}
          <div style={{ fontSize: 12, color: C.t2, marginBottom: 8, lineHeight: 1.5 }}>
            {item.description}
          </div>
          {/* txHash */}
          {item.txHash && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: C.t3, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                {item.txHash.slice(0, 18)}…{item.txHash.slice(-6)}
              </span>
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noreferrer" style={{
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  fontSize: 11, fontWeight: 700, color: C.blue,
                  textDecoration: 'none',
                  padding: '4px 8px', borderRadius: 6,
                  background: C.blueDim, border: `1px solid ${C.blueBd}`,
                }}>
                  <ExternalLink size={10} />
                  View on Arc
                </a>
              )}
            </div>
          )}
          {!item.txHash && (
            <div style={{ fontSize: 11, color: C.t3, fontStyle: 'italic' }}>No transaction hash available</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({ Icon, label, primary, ai, onClick, C }: {
  Icon: React.ElementType; label: string; primary?: boolean; ai?: boolean
  onClick: () => void; C: NanTheme
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      background: 'none', border: 'none', cursor: 'pointer', fontFamily: F,
      WebkitTapHighlightColor: 'transparent', flex: 1, padding: '4px 0', minWidth: 0,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 28,
        background: primary ? C.blue : C.surf,
        border: primary ? 'none' : `1.5px solid ${C.bdr2}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: primary ? `0 4px 16px ${C.blue}44` : C.isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
        flexShrink: 0, position: 'relative',
      }}>
        <Icon size={21} color={primary ? '#fff' : ai ? C.blue : C.text} strokeWidth={primary ? 2.2 : 1.8} />
        {ai && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            width: 14, height: 14, borderRadius: '50%',
            background: C.blue, border: `2px solid ${C.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={7} color="#fff" strokeWidth={2.5} />
          </div>
        )}
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: primary ? C.blue : C.t2, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

// ─── Card dimensions shared across the scroll row ────────────────────────────
const CARD_W = 150  // px — fits ~2.3 on a 375 px screen so next card peeks

// ─── Token card — logo + amount + label ──────────────────────────────────────

function TokenCard({
  symbol, quantity, usdValue, onClick, hidden, C, isLoading,
}: {
  symbol: 'USDC' | 'EURC'
  quantity: string; usdValue: string
  onClick: () => void; hidden: boolean; C: NanTheme; isLoading: boolean
}) {
  const isEurc     = symbol === 'EURC'
  const flag       = symbol === 'USDC' ? '🇺🇸' : '🇪🇺'
  const isZero     = !isLoading && parseFloat(quantity) === 0
  const isInert    = !onClick || onClick.toString() === '() => {}'
  return (
    <div
      onClick={onClick}
      style={{
        width: CARD_W, flexShrink: 0,
        background: C.surf, border: `1px solid ${C.bdr}`,
        borderRadius: 20, padding: '18px 16px 14px',
        cursor: isInert ? 'default' : 'pointer', fontFamily: F,
        WebkitTapHighlightColor: 'transparent', textAlign: 'left',
        boxShadow: C.isDark ? 'none' : '0 1px 6px rgba(0,0,0,0.05)',
      }}
    >
      {/* Flag icon */}
      <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 10 }}>{flag}</div>

      {isLoading ? (
        <div style={{ height: 22, width: 64, background: C.surf2, borderRadius: 6, marginBottom: 8 }} />
      ) : (
        <div style={{
          fontSize: 18, fontWeight: 800, color: C.text,
          letterSpacing: '-0.02em',
          marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {hidden ? '••••' : `${isEurc ? '€' : '$'}${quantity}`}
        </div>
      )}

      {/* "Get account" row — mirrors reference */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: C.surf2, border: `1px solid ${C.bdr}`,
        borderRadius: 8, padding: '5px 8px', marginTop: 4,
        width: 'fit-content',
      }}>
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
          <rect x="2" y="5" width="16" height="12" rx="2" stroke={C.t3} strokeWidth="1.6"/>
          <path d="M2 8h16" stroke={C.t3} strokeWidth="1.6"/>
          <path d="M6 14h2M10 14h4" stroke={C.t3} strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.t2, whiteSpace: 'nowrap' }}>
          {isZero && symbol === 'USDC' ? 'Get account' : `${symbol} · Arc`}
        </span>
      </div>
    </div>
  )
}

// ─── Cross-chain card ─────────────────────────────────────────────────────────

function CrossChainCard({
  networksWithBalance, totalUsd, hidden, isLoading, onClick, C,
}: {
  networksWithBalance: number; totalUsd: string
  hidden: boolean; isLoading: boolean
  onClick: () => void; C: NanTheme
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: CARD_W, flexShrink: 0,
        background: C.surf, border: `1px solid ${C.bdr}`,
        borderRadius: 16, padding: '14px 12px 12px',
        cursor: 'pointer', fontFamily: F,
        WebkitTapHighlightColor: 'transparent', textAlign: 'left',
      }}
    >
      {/* stacked dots as logo */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, height: 30 }}>
        {Array.from({ length: Math.min(networksWithBalance || 3, 4) }).map((_, i) => (
          <div key={i} style={{
            width: 18, height: 18, borderRadius: '50%',
            background: C.blue,
            border: `2px solid ${C.surf}`,
            marginLeft: i === 0 ? 0 : -6,
            opacity: 1 - i * 0.2,
          }} />
        ))}
      </div>
      {isLoading ? (
        <div style={{ height: 18, width: 54, background: C.surf2, borderRadius: 6, marginBottom: 6 }} />
      ) : (
        <div style={{
          fontSize: 14, fontWeight: 800, color: C.text,
          fontFamily: MONO, letterSpacing: '-0.02em',
          marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {hidden ? '••••' : `$${totalUsd}`}
        </div>
      )}
      <div style={{ fontSize: 10, fontWeight: 600, color: C.t2 }}>
        Other chains · {networksWithBalance}
      </div>
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function HomePage() {
  const C = useNanTheme()
  const { address: wagmiAddress, isConnected } = useAccount()
  const {
    activity, setActiveView, auth, profile, nanHandle, setNanHandle,
    setMainWalletBalance, setCrossChainBalances,
  } = useAppStore()

  const address   = wagmiAddress ?? (auth?.circleWalletAddress as `0x${string}` | undefined)
  const hasWallet = isConnected || !!auth?.circleWalletAddress

  // Resolve NAN handle on home page so the nudge hides immediately when a handle exists
  const { resolveName, registrySet } = useNanName()
  useEffect(() => {
    if (!address || !registrySet || nanHandle) return
    resolveName(address).then(h => { if (h) setNanHandle(h) }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, registrySet])

  // ── Store sync: single-chain Arc USDC read for setMainWalletBalance ──────────
  // The portfolio hook covers all chains, but the store setter expects the Arc balance
  // specifically for the "wallet address → balance" map used by the payment watcher.
  const usdcFact = getUsdc(ARC)
  const { data: rawBalance } = useReadContract({
    address: usdcFact?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC,
    query: { enabled: !!address && !!usdcFact, refetchInterval: 30_000 },
  })

  // ── Portfolio (multi-chain, multi-token) ──────────────────────────────────
  const portfolio = usePortfolioBalances(address)
  const { usdPerEur, rates, loading: fxLoading } = useFxRates()
  const localCcy = useDisplayCurrency()

  // Show the real multi-chain total once loaded; $0.00 while loading (skeleton covers it).
  const displayTotal     = portfolio.totalUsd
  const totalUsdNum      = Number(String(displayTotal).replace(/[^0-9.-]/g, ''))
  const totalLocalNumber = localCcy.code !== 'USD' ? localCcy.localNumber(totalUsdNum) : null
  // Skeleton shows whenever the portfolio batch is still in-flight.
  const isLoadingBalance = portfolio.isLoading

  // ── Sync store ────────────────────────────────────────────────────────────
  useEffect(() => {
    const arcBal = rawBalance !== undefined ? (Number(rawBalance) / 1e6).toFixed(2) : undefined
    if (address && arcBal) setMainWalletBalance(arcBal, address)
  }, [rawBalance, address, setMainWalletBalance])

  useSyncMultiChainBalances(address, setCrossChainBalances)

  // ── UI state ─────────────────────────────────────────────────────────────
  const [hidden,       setHidden]       = useState(false)
  const [hydrated,     setHydrated]     = useState(false)
  const [tokenSheet,   setTokenSheet]   = useState<'USDC' | 'EURC' | 'USDT' | null>(null)
  const [rewardsOpen,  setRewardsOpen]  = useState(false)

  /* eslint-disable react/set-state-in-effect */
  useEffect(() => { setHydrated(true) }, [])
  /* eslint-enable react/set-state-in-effect */

  // NAN handle always wins. Fall back to email prefix only if it looks like
  // an actual email (contains @), not a raw wallet address (0x…).
  const emailPrefix = auth?.email && auth.email.includes('@') && !auth.email.startsWith('0x')
    ? auth.email.split('@')[0]
    : null
  const firstName = nanHandle
    ? `@${nanHandle}`
    : emailPrefix || profile.displayName?.split(' ')[0] || 'there'
  // Only show the NAN name nudge once the page has hydrated AND we have confirmed
  // the user has no handle (nanHandle === '' not just undefined/loading).
  const hasHandle = !!nanHandle || !hydrated

  const [txFilter, setTxFilter] = useState<TxFilter>('all')

  const allSorted = [...activity]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const filterFn = (item: ActivityItem): boolean => {
    if (txFilter === 'sent')     return item.sign === '-' && !item.agentInitiated && item.type !== 'swap' && item.type !== 'bridge'
    if (txFilter === 'received') return item.sign === '+'
    if (txFilter === 'swaps')    return item.type === 'swap' || item.type === 'bridge'
    if (txFilter === 'agent')    return !!item.agentInitiated || item.type === 'agent_purchase'
    return true
  }

  const recent = allSorted.filter(filterFn).slice(0, 6)

  // Positions filtered by token for the sheet
  const positionsFor = (sym: 'USDC' | 'EURC' | 'USDT') =>
    portfolio.networks.flatMap(n => n.positions.filter(p => p.symbol === sym))

  return (
    <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', fontFamily: F, paddingBottom: 32 }}>

      {/* ── 1. HEADER ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20, gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            onClick={() => setActiveView('profile')}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: profile.avatarUrl ? 'transparent' : C.surf2,
              border: `2px solid ${C.bdr2}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
              WebkitTapHighlightColor: 'transparent', padding: 0,
            }}
          >
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} alt="avatar" style={{ width: 36, height: 36, objectFit: 'cover' }} />
              : <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
                  <circle cx="10" cy="7" r="3.2" stroke={C.t2} strokeWidth="1.6" />
                  <path d="M3.5 17c0-3.038 2.91-5.5 6.5-5.5s6.5 2.462 6.5 5.5" stroke={C.t2} strokeWidth="1.6" strokeLinecap="round" />
                </svg>
            }
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Hi, {firstName}
            </div>
            {!hasHandle && (
              <button
                onClick={() => setActiveView('nan-name')}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  cursor: 'pointer', fontFamily: F,
                  fontSize: 11, fontWeight: 600,
                  color: C.blue, marginTop: 1,
                  animation: 'nan-pulse 1.4s ease-in-out infinite',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                ✦ Get your NAN name
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <NotificationBell color={C.t2} />
          <button
            onClick={() => (nairaRampVisible() ? showAddMoneySheet(setActiveView) : setActiveView('onramp'))}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '9px 16px', borderRadius: 24,
              background: C.blue, border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: F,
              boxShadow: `0 4px 14px ${C.blue}44`,
              WebkitTapHighlightColor: 'transparent',
              letterSpacing: '-0.01em', whiteSpace: 'nowrap',
            }}
          >
            Add Money
          </button>
        </div>
      </div>

      {/* ── 2. TOTAL PORTFOLIO BALANCE ── */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          <span style={{ fontSize: 13, color: C.t2, fontWeight: 500 }}>Total balance</span>
          {portfolio.lastUpdated && (
            <button
              onClick={() => portfolio.refetch()}
              title={`Updated ${portfolio.lastUpdated.toLocaleTimeString()}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', lineHeight: 1, marginLeft: 2 }}
            >
              <RefreshCw size={11} color={C.t3} />
            </button>
          )}
        </div>

        {isLoadingBalance ? (
          <div style={{ height: 44, width: 180, background: C.surf2, borderRadius: 10, animation: 'nan-shimmer 1.4s ease infinite' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', color: C.text, lineHeight: 1.1, fontFamily: F }}>
              {hidden ? '••••••' : (totalLocalNumber ?? displayTotal)}
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: C.t2 }}>{totalLocalNumber ? `${currencyFlag(localCcy.code)} ${localCcy.code}` : 'USD'}</span>
            <button
              onClick={() => setHidden(h => !h)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, WebkitTapHighlightColor: 'transparent', flexShrink: 0 }}
              aria-label={hidden ? 'Show balance' : 'Hide balance'}
            >
              {hidden ? <EyeOff size={15} color={C.t3} /> : <Eye size={15} color={C.t3} />}
            </button>
          </div>
        )}

        {/* USD amount stays visible under the chosen currency */}
        {!isLoadingBalance && !hidden && totalLocalNumber && (
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t2, marginTop: 4, fontFamily: F }}>≈ ${displayTotal} USD</div>
        )}

        {/* FX timestamp */}
        {!fxLoading && portfolio.fxUpdatedAt && (
          <div style={{ fontSize: 10, color: C.t3, marginTop: 5 }}>
            Rates updated {portfolio.fxUpdatedAt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
            {' · '}EUR/USD {portfolio.eurUsdRate.toFixed(4)}
          </div>
        )}

        {hydrated && !hasWallet && (
          <div style={{ marginTop: 12 }}>
            <ConnectKitButton />
          </div>
        )}
      </div>

      {/* ── FX TICKER STRIP ── */}
      {!fxLoading && Object.keys(rates).length > 0 && (
        <div style={{
          display: 'flex', gap: 10, overflowX: 'auto', marginBottom: 18, marginTop: 14,
          paddingBottom: 2,
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {[
            { pair: 'EUR/USD', val: usdPerEur },
            ...['GBP','NGN','GHS','KES','ZAR','JPY'].map(c => ({
              pair: `${c}/USD`,
              val: rates[c] ? 1 / rates[c] : null,
            })).filter(r => r.val !== null),
          ].map(({ pair, val }) => (
            <div key={pair} style={{
              flexShrink: 0,
              background: C.surf, border: `1px solid ${C.bdr}`,
              borderRadius: 10, padding: '6px 10px',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <span style={{ fontSize: 9, color: C.t3, fontWeight: 600, letterSpacing: '0.04em' }}>{pair}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: MONO }}>
                {pair.startsWith('JPY') || pair.startsWith('NGN')
                  ? (val as number).toFixed(2)
                  : (val as number).toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── 3. HORIZONTAL SCROLL ROW: USDC (Arc) → EURC (Arc) → Cross-chain (non-Arc) ── */}
      {/* Gateway removed — accessible via bottom nav / sidebar.                         */}
      {/* Cross-chain shows only non-Arc chains so Arc isn't double-counted.              */}
      {/* Total portfolio = USDC card + EURC card + Cross-chain card (no overlap).        */}
      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto',
        marginBottom: 20, marginTop: fxLoading ? 18 : 0,
        paddingBottom: 4,
        msOverflowStyle: 'none', scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        <TokenCard
          symbol="USDC"
          quantity={portfolio.byToken.USDC.quantity}
          usdValue={portfolio.byToken.USDC.usdValue}
          onClick={() => {}}
          hidden={hidden} C={C} isLoading={portfolio.isLoading}
        />
        <TokenCard
          symbol="EURC"
          quantity={portfolio.byToken.EURC.quantity}
          usdValue={portfolio.byToken.EURC.usdValue}
          onClick={() => {}}
          hidden={hidden} C={C} isLoading={portfolio.isLoading}
        />
        {totalLocalNumber && (
          <div style={{ width: CARD_W, flexShrink: 0, background: C.surf, border: `1px solid ${C.bdr}`, borderRadius: 16, padding: '14px 12px 12px', fontFamily: F, textAlign: 'left' }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: C.surf2, border: `1px solid ${C.bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1 }}>{currencyFlag(localCcy.code)}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, fontFamily: MONO, letterSpacing: '-0.02em', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hidden ? '••••' : totalLocalNumber}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.blue }}>{localCcy.code} · Value</div>
          </div>
        )}
        <CrossChainCard
          networksWithBalance={portfolio.nonArcNetworksWithBalance}
          totalUsd={portfolio.nonArcTotalUsd}
          hidden={hidden} isLoading={portfolio.isLoading}
          onClick={() => setTokenSheet('USDC')}
          C={C}
        />
        {/* ── Rewards card — same size as token cards ── */}
        <button
          onClick={() => setRewardsOpen(true)}
          style={{
            width: CARD_W, flexShrink: 0,
            background: C.blueDim,
            border: `1px solid ${C.blueBd}`,
            borderRadius: 16, padding: '14px 12px 12px',
            cursor: 'pointer', fontFamily: F,
            WebkitTapHighlightColor: 'transparent', textAlign: 'left',
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: C.blue,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Gift size={15} color="#fff" strokeWidth={1.8} />
            </div>
          </div>
          <div style={{
            fontSize: 14, fontWeight: 800, color: C.text,
            fontFamily: MONO, letterSpacing: '-0.02em',
            marginBottom: 2,
          }}>
            {hidden ? '••••' : '$0.00'}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.blue }}>
            Rewards · USDC
          </div>
        </button>

        {/* trailing spacer so last card doesn't hug the right edge */}
        <div style={{ width: 6, flexShrink: 0 }} />
      </div>

      {/* ── 4. ACTION BUTTONS ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22, gap: 4 }}>
        <ActionBtn Icon={Send}            label="Send"      primary onClick={() => setActiveView('send')}    C={C} />
        <ActionBtn Icon={ArrowDownToLine} label="Receive"           onClick={() => setActiveView('receive')} C={C} />
        <ActionBtn Icon={ArrowLeftRight}  label="Trade"             onClick={() => setActiveView('trade')}   C={C} />
        {nairaRampVisible() && <ActionBtn Icon={Banknote} label="Cash out" onClick={() => setActiveView('cashout')} C={C} />}
        <ActionBtn Icon={Bot}             label="NAN AI"    ai      onClick={() => setActiveView('agent')}   C={C} />
      </div>

      {/* ── 4b. NAN PAY LINK — above the fold ── */}
      <PayLinkCard nanHandle={nanHandle} setActiveView={setActiveView} C={C} />





      {/* ── 6. RECENT ACTIVITY ── */}
      <div>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Recent Activity</span>
          <button
            onClick={() => setActiveView('activity')}
            style={{
              fontSize: 12, color: C.blue, background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: F,
              display: 'flex', alignItems: 'center', gap: 3,
              fontWeight: 600, WebkitTapHighlightColor: 'transparent',
            }}
          >
            View all <ChevronRight size={13} />
          </button>
        </div>

        {/* Filter pills */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 12,
          overflowX: 'auto', paddingBottom: 2,
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {([
            { key: 'all',      label: 'All' },
            { key: 'sent',     label: 'Sent' },
            { key: 'received', label: 'Received' },
            { key: 'swaps',    label: 'Swaps' },
            { key: 'agent',    label: 'Agent' },
          ] as { key: TxFilter; label: string }[]).map(({ key, label }) => {
            const active = txFilter === key
            return (
              <button
                key={key}
                onClick={() => setTxFilter(key)}
                style={{
                  flexShrink: 0, padding: '5px 12px', borderRadius: 20,
                  border: `1px solid ${active ? C.blue : C.bdr}`,
                  background: active ? C.blue : C.surf,
                  color: active ? '#fff' : C.t2,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: F, transition: 'all 0.12s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Transaction list */}
        <div style={{
          background: C.surf,
          border: `1px solid ${C.bdr}`,
          borderRadius: 16,
          overflow: 'hidden',
        }}>
          {recent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: C.surf2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
              }}>
                <ActivityIcon size={17} color={C.t3} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                {txFilter === 'all' ? 'No activity yet' : `No ${txFilter} transactions`}
              </div>
              <div style={{ fontSize: 12, color: C.t3 }}>
                {txFilter === 'all' ? 'Your transactions will appear here' : 'Try a different filter'}
              </div>
            </div>
          ) : (
            recent.map((item, idx) => (
              <TxRow key={item.id} item={item} C={C} last={idx === recent.length - 1} />
            ))
          )}
        </div>
      </div>


      {/* ── Rewards sheet ── */}
      {rewardsOpen && <RewardsSheet onClose={() => setRewardsOpen(false)} />}

      {/* ── Token network sheet (slide-up, opens on card tap) ── */}
      {tokenSheet && (
        <TokenNetworkSheet
          symbol={tokenSheet}
          positions={positionsFor(tokenSheet)}
          totalQuantity={portfolio.byToken[tokenSheet].quantity}
          totalUsdValue={portfolio.byToken[tokenSheet].usdValue}
          gatewayAvailable={portfolio.gatewayAvailable}
          gatewayPending={portfolio.gatewayPending}
          eurUsdRate={portfolio.eurUsdRate}
          hidden={hidden}
          onClose={() => setTokenSheet(null)}
        />
      )}

    </div>
  )
}
