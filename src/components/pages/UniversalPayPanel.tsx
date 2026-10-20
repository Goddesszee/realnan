/**
 * UniversalPayPanel
 *
 * Lets a payer use ANY stablecoin on ANY EVM chain to pay a NAN recipient
 * who always receives USDC on Arc.
 *
 * Route logic (auto-selected, shown to user before execution):
 *   1. Payer has USDC on Arc → plain ERC-20 transfer (cheapest, instant)
 *   2. Payer has USDC on another chain → CCTP bridge via AppKit.bridge()
 *   3. Payer has USDT/EURC/DAI/ETH on any chain → cross-chain swap via AppKit.swap()
 *
 * Security:
 *   - No kitKey (permissionless AppKit)
 *   - User sees full route + estimated output before any wallet prompt
 *   - swap()/bridge() called only from explicit button click
 *   - Swap is routed through LiFi (third-party aggregator) — user is informed
 */
import React, { useState, useCallback } from 'react'
import {
  Wallet, ArrowRight, RefreshCw, AlertCircle,
  CheckCircle2, ExternalLink, ChevronDown, Zap, Globe,
} from 'lucide-react'
import { useAccount, useChainId, useSwitchChain, useWalletClient } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { AppKit, SwapChain, BridgeChain } from '@circle-fin/app-kit'
type SwapChainId = typeof SwapChain[keyof typeof SwapChain]
type BridgeChainId = typeof BridgeChain[keyof typeof BridgeChain]
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'
import type { EIP1193Provider } from 'viem'
import { createPublicClient, http, erc20Abi, parseUnits, formatUnits } from 'viem'
import { toast } from 'sonner'

// ── Design tokens (match PayByNamePage light theme) ──────────────────────────
const F     = "'Inter', -apple-system, sans-serif"
const MONO  = "'JetBrains Mono', Menlo, monospace"
const BLUE  = '#2563EB'
const BLUE_L = '#EFF6FF'
const BLUE_M = '#BFDBFE'
const SURF  = '#FFFFFF'
const SURF2 = '#F9FAFB'
const BDR   = '#E5E7EB'
const TEXT  = '#111827'
const TEXT2 = '#6B7280'
const TEXT3 = '#9CA3AF'
const GREEN = '#16A34A'
const GREEN_L = '#DCFCE7'
const AMBER = '#D97706'
const AMBER_L = '#FFFBEB'
const RED   = '#DC2626'
const RED_L = '#FEF2F2'

// ── AppKit singleton ─────────────────────────────────────────────────────────
const kit = new AppKit()

// ── Supported source chains ──────────────────────────────────────────────────
// Maps Circle SDK chain name → { chainId, label, rpc, tokens }
const SOURCE_CHAINS: Record<string, {
  chainId: number
  label: string
  rpc: string
  nativeSymbol: string
  tokens: { symbol: string; address: `0x${string}`; decimals: number }[]
}> = {
  Ethereum: {
    chainId: 1,
    label: 'Ethereum',
    rpc: 'https://eth.llamarpc.com',
    nativeSymbol: 'ETH',
    tokens: [
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
      { symbol: 'EURC', address: '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c', decimals: 6 },
      { symbol: 'DAI',  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
    ],
  },
  Base: {
    chainId: 8453,
    label: 'Base',
    rpc: 'https://mainnet.base.org',
    nativeSymbol: 'ETH',
    tokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      { symbol: 'EURC', address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42', decimals: 6 },
      { symbol: 'DAI',  address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18 },
    ],
  },
  Arbitrum: {
    chainId: 42161,
    label: 'Arbitrum',
    rpc: 'https://arb1.arbitrum.io/rpc',
    nativeSymbol: 'ETH',
    tokens: [
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
      { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    ],
  },
  Polygon: {
    chainId: 137,
    label: 'Polygon',
    rpc: 'https://polygon-rpc.com',
    nativeSymbol: 'MATIC',
    tokens: [
      { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    ],
  },
  Optimism: {
    chainId: 10,
    label: 'Optimism',
    rpc: 'https://mainnet.optimism.io',
    nativeSymbol: 'ETH',
    tokens: [
      { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
      { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6 },
    ],
  },
  Arc: {
    chainId: 5042,
    label: 'Arc',
    rpc: 'https://rpc.mainnet.arc.io',
    nativeSymbol: 'USDC',
    tokens: [
      { symbol: 'USDC', address: '0x3600000000000000000000000000000000000000', decimals: 6 },
    ],
  },
}

// ── Types ────────────────────────────────────────────────────────────────────
type TokenBalance = {
  chainName: string
  chainId: number
  symbol: string
  address: `0x${string}`
  decimals: number
  balance: bigint
  balanceFormatted: number
  label: string
}

type RouteType = 'transfer' | 'bridge' | 'swap'

type Route = {
  type: RouteType
  sourceChain: string
  sourceChainId: number
  tokenIn: TokenBalance
  estimatedOut: number | null   // null until fetched
  label: string
  description: string
  steps: string[]
}

type ExecState =
  | { phase: 'idle' }
  | { phase: 'estimating' }
  | { phase: 'review'; route: Route; estimate: number }
  | { phase: 'switching' }
  | { phase: 'executing'; stepLabel: string }
  | { phase: 'success'; txHash: string; amountOut: number; explorerUrl?: string }
  | { phase: 'error'; message: string }

// ── Balance fetcher ──────────────────────────────────────────────────────────
async function fetchBalancesForChain(
  chainName: string,
  address: `0x${string}`,
): Promise<TokenBalance[]> {
  const chain = SOURCE_CHAINS[chainName]
  if (!chain) return []
  const client = createPublicClient({
    transport: http(chain.rpc),
    chain: {
      id: chain.chainId,
      name: chain.label,
      nativeCurrency: { name: chain.nativeSymbol, symbol: chain.nativeSymbol, decimals: 18 },
      rpcUrls: { default: { http: [chain.rpc] }, public: { http: [chain.rpc] } },
    },
  })
  const results: TokenBalance[] = []
  await Promise.allSettled(chain.tokens.map(async (token) => {
    try {
      const bal = await client.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })
      if (bal > 0n) {
        results.push({
          chainName,
          chainId: chain.chainId,
          symbol: token.symbol,
          address: token.address,
          decimals: token.decimals,
          balance: bal,
          balanceFormatted: Number(formatUnits(bal, token.decimals)),
          label: `${token.symbol} on ${chain.label}`,
        })
      }
    } catch { /* token not available on this chain, skip */ }
  }))
  return results
}

// ── Route picker ─────────────────────────────────────────────────────────────
function pickRoute(balances: TokenBalance[], amountUsdc: number): Route | null {
  if (amountUsdc <= 0) return null

  // 1. Direct USDC on Arc (cheapest, instant)
  const arcUsdc = balances.find(b => b.chainName === 'Arc' && b.symbol === 'USDC')
  if (arcUsdc && arcUsdc.balanceFormatted >= amountUsdc) {
    return {
      type: 'transfer',
      sourceChain: 'Arc',
      sourceChainId: SOURCE_CHAINS.Arc.chainId,
      tokenIn: arcUsdc,
      estimatedOut: amountUsdc,
      label: 'Direct · Arc',
      description: 'Instant ERC-20 transfer on Arc. No bridge or swap fees.',
      steps: ['Approve in wallet', 'Transfer USDC → recipient'],
    }
  }

  // 2. USDC on another chain (CCTP bridge, no swap)
  const otherUsdc = balances.find(b => b.chainName !== 'Arc' && b.symbol === 'USDC' && b.balanceFormatted >= amountUsdc)
  if (otherUsdc) {
    return {
      type: 'bridge',
      sourceChain: otherUsdc.chainName,
      sourceChainId: otherUsdc.chainId,
      tokenIn: otherUsdc,
      estimatedOut: amountUsdc, // 1:1, CCTP keeps full amount
      label: `Bridge · ${otherUsdc.chainName} → Arc`,
      description: `Circle CCTP burns USDC on ${otherUsdc.chainName} and mints USDC on Arc. ~8-20 seconds.`,
      steps: ['Approve USDC', 'Burn on source chain', 'Circle attestation (~8s)', 'Mint USDC on Arc'],
    }
  }

  // 3. Other stablecoin on any chain (cross-chain swap via LiFi)
  const best = balances
    .filter(b => b.balanceFormatted >= amountUsdc)
    .sort((a, b) => {
      // prefer stablecoins over volatile assets; prefer closer chains
      const stableScore = (s: string) => ['USDT', 'EURC', 'DAI'].includes(s) ? 0 : 1
      return stableScore(a.symbol) - stableScore(b.symbol)
    })[0]

  if (best) {
    return {
      type: 'swap',
      sourceChain: best.chainName,
      sourceChainId: best.chainId,
      tokenIn: best,
      estimatedOut: null, // fetched during estimate
      label: `Swap · ${best.symbol} on ${best.chainName} → USDC on Arc`,
      description: `Routes ${best.symbol} through LiFi DEX aggregator. You confirm the exact output before sending.`,
      steps: ['Quote from LiFi', 'Approve token', 'Swap + bridge to Arc'],
    }
  }

  return null
}

// ── Spinner ──────────────────────────────────────────────────────────────────
function Spin({ size = 18 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, border: `2.5px solid rgba(37,99,235,0.2)`,
      borderTopColor: BLUE, borderRadius: '50%', display: 'inline-block',
      animation: 'upSpin 0.8s linear infinite', flexShrink: 0 }} />
  )
}

// ── Chain badge ───────────────────────────────────────────────────────────────
function ChainBadge({ chain, token }: { chain: string; token: string }) {
  const CHAIN_COLORS: Record<string, string> = {
    Ethereum: '#627EEA', Base: '#0052FF', Arbitrum: '#28A0F0',
    Polygon: '#8247E5', Optimism: '#FF0420', Arc: '#2563EB',
  }
  const color = CHAIN_COLORS[chain] ?? '#6B7280'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
      borderRadius: 999, background: `${color}18`, border: `1px solid ${color}30`,
      fontSize: 11, fontWeight: 700, color, fontFamily: F }}>
      {token} · {chain}
    </span>
  )
}

// ── BalanceRow ────────────────────────────────────────────────────────────────
function BalanceRow({ bal, selected, onSelect }: {
  bal: TokenBalance; selected: boolean; onSelect: () => void
}) {
  return (
    <button onClick={onSelect}
      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderRadius: 10, background: selected ? BLUE_L : SURF2,
        border: `1px solid ${selected ? BLUE_M : BDR}`, cursor: 'pointer', marginBottom: 6,
        transition: 'all 0.12s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: selected ? BLUE : BDR,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: selected ? '#fff' : TEXT2 }}>
            {bal.symbol.slice(0, 2)}
          </span>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{bal.symbol}</div>
          <div style={{ fontSize: 11, color: TEXT3 }}>{bal.chainName}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: selected ? BLUE : TEXT, fontFamily: MONO }}>
          {bal.balanceFormatted.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ fontSize: 10, color: TEXT3 }}>{bal.symbol}</div>
      </div>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function UniversalPayPanel({
  toAddress,
  amount,
  handle,
  onSuccess,
}: {
  toAddress: string
  amount: number
  handle: string
  onSuccess?: (txHash: string) => void
}) {
  const { address, isConnected, connector } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { data: walletClient } = useWalletClient()

  const [scanning, setScanning]           = useState(false)
  const [balances, setBalances]           = useState<TokenBalance[]>([])
  const [scanned, setScanned]             = useState(false)
  const [selectedBal, setSelectedBal]     = useState<TokenBalance | null>(null)
  const [execState, setExecState]         = useState<ExecState>({ phase: 'idle' })
  const [showAllChains, setShowAllChains] = useState(false)

  // ── Scan balances ───────────────────────────────────────────────────────
  const scanBalances = useCallback(async () => {
    if (!address) return
    setScanning(true)
    setBalances([])
    setScanned(false)
    setSelectedBal(null)
    setExecState({ phase: 'idle' })

    const all = await Promise.all(
      Object.keys(SOURCE_CHAINS).map(c => fetchBalancesForChain(c, address))
    )
    const flat = all.flat()
    setBalances(flat)
    setScanned(true)
    setScanning(false)

    // Auto-select the best route token
    const route = pickRoute(flat, amount)
    if (route) setSelectedBal(route.tokenIn)
  }, [address, amount])

  // ── Review + estimate ───────────────────────────────────────────────────
  const reviewPayment = useCallback(async () => {
    if (!selectedBal || !connector || !address) return
    const route = pickRoute([selectedBal], amount)
    if (!route) return
    setExecState({ phase: 'estimating' })

    try {
      if (route.type === 'transfer') {
        // No estimation needed for direct transfer
        setExecState({ phase: 'review', route, estimate: amount })
        return
      }
      if (route.type === 'bridge') {
        // CCTP is 1:1 minus a small forwarder fee (~$0.10)
        setExecState({ phase: 'review', route, estimate: amount - 0.1 })
        return
      }
      // Swap — get an estimate from AppKit
      if (chainId !== route.sourceChainId) await switchChainAsync({ chainId: route.sourceChainId })
      const provider = (await connector.getProvider()) as EIP1193Provider
      const adapter = await createViemAdapterFromProvider({ provider })
      const est = await kit.estimateSwap({
        from: { adapter, chain: route.sourceChain as SwapChainId },
        to: { chain: SwapChain.Arc, recipientAddress: toAddress },
        tokenIn: route.tokenIn.symbol,
        tokenOut: 'USDC',
        amountIn: amount.toFixed(6),
        config: { slippageBps: 100 },
      })
      const estimatedOut = parseFloat(est.estimatedOutput?.amount ?? '0')
      setExecState({ phase: 'review', route, estimate: estimatedOut })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Estimation failed'
      setExecState({ phase: 'error', message: msg })
    }
  }, [selectedBal, connector, address, amount, chainId, switchChainAsync, toAddress])

  // ── Execute ─────────────────────────────────────────────────────────────
  const executePayment = useCallback(async () => {
    if (execState.phase !== 'review') return
    const { route, estimate } = execState
    if (!connector || !address) return

    try {
      setExecState({ phase: 'switching' })
      if (chainId !== route.sourceChainId) {
        await switchChainAsync({ chainId: route.sourceChainId })
      }

      const provider = (await connector.getProvider()) as EIP1193Provider
      const adapter = await createViemAdapterFromProvider({ provider })

      if (route.type === 'transfer') {
        setExecState({ phase: 'executing', stepLabel: 'Approve in wallet…' })
        if (!walletClient) throw new Error('Wallet client not ready')
        const hash = await walletClient.writeContract({
          address: route.tokenIn.address,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [toAddress as `0x${string}`, parseUnits(amount.toFixed(6), route.tokenIn.decimals)],
        })
        setExecState({ phase: 'success', txHash: hash, amountOut: estimate, explorerUrl: `https://explorer.arc.io/tx/${hash}` })
        onSuccess?.(hash)
        toast.success('Payment sent!')
        return
      }

      if (route.type === 'bridge') {
        setExecState({ phase: 'executing', stepLabel: 'Approve USDC…' })
        const result = await kit.bridge({
          from: { adapter, chain: route.sourceChain as BridgeChainId },
          to: {
            recipientAddress: toAddress,
            chain: BridgeChain.Arc,
            useForwarder: true,
          },
          amount: amount.toFixed(6),
        })
        const txHash = result.steps?.find(s => s.name === 'burn')?.txHash ?? result.steps?.[0]?.txHash ?? ''
        setExecState({ phase: 'success', txHash, amountOut: estimate, explorerUrl: result.steps?.find(s => s.name === 'mint')?.explorerUrl })
        onSuccess?.(txHash)
        toast.success('Bridge complete! USDC arriving on Arc.')
        return
      }

      // Swap (cross-chain via LiFi)
      setExecState({ phase: 'executing', stepLabel: 'Approving token…' })
      const result = await kit.swap({
        from: { adapter, chain: route.sourceChain as SwapChainId },
        to: { chain: SwapChain.Arc, recipientAddress: toAddress },
        tokenIn: route.tokenIn.symbol,
        tokenOut: 'USDC',
        amountIn: amount.toFixed(6),
        config: { slippageBps: 100 },
      })
      const txHash = result.txHash ?? ''
      setExecState({ phase: 'success', txHash, amountOut: estimate, explorerUrl: result.explorerUrl })
      onSuccess?.(txHash)
      toast.success('Swap complete! USDC arriving on Arc.')
    } catch (err) {
      const msg = err instanceof Error
        ? (err.message.includes('rejected') ? 'Rejected in wallet.' : err.message)
        : 'Transaction failed.'
      setExecState({ phase: 'error', message: msg })
    }
  }, [execState, connector, address, chainId, switchChainAsync, toAddress, amount, onSuccess, walletClient])

  const fmt = (n: number) => n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // ── Not connected ────────────────────────────────────────────────────────
  if (!isConnected) return (
    <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: BLUE_L, border: `1px solid ${BLUE_M}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <Globe size={24} color={BLUE} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 6 }}>
        Pay from any chain, any token
      </p>
      <p style={{ fontSize: 13, color: TEXT2, marginBottom: 16, lineHeight: 1.5 }}>
        Connect your wallet — NAN will detect what you have and pick the best route automatically.
        USDC, USDT, EURC, DAI on Ethereum, Base, Arbitrum, Polygon, Optimism, or Arc.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <ConnectKitButton />
      </div>
      <p style={{ fontSize: 11, color: TEXT3, marginTop: 10 }}>MetaMask · Coinbase · WalletConnect · and more</p>
    </div>
  )

  // ── Success ───────────────────────────────────────────────────────────────
  if (execState.phase === 'success') return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: GREEN_L,
        border: '2px solid rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', margin: '0 auto 16px' }}>
        <CheckCircle2 size={30} color={GREEN} />
      </div>
      <p style={{ fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 6 }}>Payment sent!</p>
      <p style={{ fontSize: 14, color: TEXT2, marginBottom: 16, lineHeight: 1.5 }}>
        <strong style={{ color: TEXT }}>{fmt(execState.amountOut)} USDC</strong> arriving on Arc for{' '}
        <strong style={{ color: BLUE }}>@{handle}</strong>
      </p>
      {execState.txHash && (
        <a href={execState.explorerUrl ?? `https://explorer.arc.io/tx/${execState.txHash}`}
          target="_blank" rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px',
            borderRadius: 10, background: SURF2, border: `1px solid ${BDR}`, color: TEXT2,
            fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          <ExternalLink size={13} /> View transaction
        </a>
      )}
    </div>
  )

  // ── Executing / switching ─────────────────────────────────────────────────
  if (execState.phase === 'executing' || execState.phase === 'switching') return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <Spin size={36} />
      <p style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginTop: 16 }}>
        {execState.phase === 'switching' ? 'Switching network…' : execState.stepLabel}
      </p>
      <p style={{ fontSize: 12, color: TEXT3, marginTop: 6 }}>Don't close this tab</p>
    </div>
  )

  // ── Review screen ─────────────────────────────────────────────────────────
  if (execState.phase === 'review') {
    const { route, estimate } = execState
    return (
      <div>
        {/* Route summary */}
        <div style={{ background: BLUE_L, border: `1px solid ${BLUE_M}`, borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
            {route.type === 'transfer' ? '⚡ Direct transfer' : route.type === 'bridge' ? '🌉 CCTP Bridge' : '🔄 Cross-chain Swap (via LiFi)'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: TEXT3, marginBottom: 4 }}>You send</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, fontFamily: MONO }}>{fmt(amount)}</div>
              <ChainBadge chain={route.sourceChain} token={route.tokenIn.symbol} />
            </div>
            <ArrowRight size={20} color={BLUE} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: TEXT3, marginBottom: 4 }}>@{handle} gets</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: GREEN, fontFamily: MONO }}>~{fmt(estimate)}</div>
              <ChainBadge chain="Arc" token="USDC" />
            </div>
          </div>
          <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.5 }}>{route.description}</div>
          {route.type === 'swap' && (
            <div style={{ marginTop: 8, fontSize: 11, color: AMBER, background: AMBER_L,
              border: '1px solid #FDE68A', borderRadius: 8, padding: '6px 10px' }}>
              Swap is routed through LiFi, a third-party DEX aggregator. You are subject to their terms of service.
              Output is estimated — actual may vary by up to 1%.
            </div>
          )}
        </div>

        {/* Steps */}
        <div style={{ marginBottom: 16 }}>
          {route.steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: BLUE,
                color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 13, color: TEXT2 }}>{step}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button onClick={() => void executePayment()}
          style={{ width: '100%', height: 54, borderRadius: 14, background: BLUE, border: 'none',
            color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: F,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 20px rgba(37,99,235,0.35)', transition: 'all 0.15s' }}>
          <Zap size={18} />
          {route.type === 'transfer' ? `Send ${fmt(amount)} USDC` : route.type === 'bridge' ? 'Bridge & Pay' : 'Swap & Pay'}
        </button>
        <button onClick={() => setExecState({ phase: 'idle' })}
          style={{ width: '100%', marginTop: 8, height: 38, borderRadius: 12, background: 'none',
            border: `1px solid ${BDR}`, color: TEXT3, fontSize: 13, cursor: 'pointer', fontFamily: F }}>
          ← Change
        </button>
      </div>
    )
  }

  // ── Estimating ────────────────────────────────────────────────────────────
  if (execState.phase === 'estimating') return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <Spin size={28} />
      <p style={{ fontSize: 13, color: TEXT2, marginTop: 12 }}>Getting the best route…</p>
    </div>
  )

  // ── Error ────────────────────────────────────────────────────────────────
  if (execState.phase === 'error') return (
    <div>
      <div style={{ background: RED_L, border: '1px solid #FECACA', borderRadius: 12,
        padding: '14px 16px', marginBottom: 14, display: 'flex', gap: 10 }}>
        <AlertCircle size={18} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: RED, lineHeight: 1.5 }}>{execState.message}</div>
      </div>
      <button onClick={() => setExecState({ phase: 'idle' })}
        style={{ width: '100%', height: 44, borderRadius: 12, background: SURF2,
          border: `1px solid ${BDR}`, color: TEXT2, fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: F }}>
        Try again
      </button>
    </div>
  )

  // ── Main: connect → scan → pick → review ─────────────────────────────────
  const displayedBalances = showAllChains ? balances : balances.slice(0, 5)
  const autoRoute = selectedBal ? pickRoute([selectedBal], amount) : null

  return (
    <div>
      {/* Connected wallet */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderRadius: 10, background: SURF2,
        border: `1px solid ${BDR}`, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: TEXT2, fontFamily: MONO }}>
            {address?.slice(0, 10)}…{address?.slice(-6)}
          </span>
        </div>
        <ConnectKitButton />
      </div>

      {/* Scan CTA */}
      {!scanned && (
        <button onClick={() => void scanBalances()} disabled={scanning}
          style={{ width: '100%', height: 50, borderRadius: 14, background: scanning ? SURF2 : BLUE,
            border: scanning ? `1px solid ${BDR}` : 'none', color: scanning ? TEXT3 : '#fff',
            fontSize: 15, fontWeight: 700, cursor: scanning ? 'not-allowed' : 'pointer',
            fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, boxShadow: scanning ? 'none' : '0 4px 16px rgba(37,99,235,0.3)',
            transition: 'all 0.15s' }}>
          {scanning ? <><Spin />Scanning 6 chains…</> : <><Globe size={17} />Scan my balances</>}
        </button>
      )}

      {/* Scanned balances */}
      {scanned && balances.length === 0 && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 13, color: TEXT3, marginBottom: 8 }}>No supported tokens found on any chain.</div>
          <div style={{ fontSize: 12, color: TEXT3, lineHeight: 1.5 }}>
            Supported: USDC, USDT, EURC, DAI on Ethereum, Base, Arbitrum, Polygon, Optimism, or Arc.
          </div>
          <button onClick={() => void scanBalances()} style={{ marginTop: 12, padding: '8px 18px',
            borderRadius: 10, background: SURF2, border: `1px solid ${BDR}`, color: TEXT2,
            fontSize: 12, cursor: 'pointer', fontFamily: F, display: 'inline-flex',
            alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} /> Scan again
          </button>
        </div>
      )}

      {scanned && balances.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Select token to pay with
            </div>
            <button onClick={() => void scanBalances()} style={{ background: 'none', border: 'none',
              color: BLUE, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={11} />Refresh
            </button>
          </div>

          {displayedBalances.map(bal => (
            <BalanceRow key={`${bal.chainName}-${bal.symbol}`} bal={bal}
              selected={selectedBal?.chainName === bal.chainName && selectedBal?.symbol === bal.symbol}
              onSelect={() => { setSelectedBal(bal); setExecState({ phase: 'idle' }) }} />
          ))}

          {balances.length > 5 && (
            <button onClick={() => setShowAllChains(v => !v)}
              style={{ width: '100%', height: 36, borderRadius: 10, background: 'none',
                border: `1px solid ${BDR}`, color: TEXT3, fontSize: 12, cursor: 'pointer',
                fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <ChevronDown size={13} />
              {showAllChains ? 'Show less' : `Show ${balances.length - 5} more`}
            </button>
          )}

          {/* Route preview */}
          {autoRoute && (
            <div style={{ background: BLUE_L, border: `1px solid ${BLUE_M}`, borderRadius: 12,
              padding: '12px 14px', marginTop: 12 }}>
              <div style={{ fontSize: 11, color: BLUE, fontWeight: 700, marginBottom: 4 }}>
                {autoRoute.label}
              </div>
              <div style={{ fontSize: 12, color: TEXT2 }}>{autoRoute.description}</div>
            </div>
          )}

          {/* Pay CTA */}
          {selectedBal && amount > 0 ? (
            <button onClick={() => void reviewPayment()}
              style={{ width: '100%', height: 52, borderRadius: 14, background: BLUE, border: 'none',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: F,
                marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, boxShadow: '0 4px 20px rgba(37,99,235,0.35)', transition: 'all 0.15s' }}>
              <Wallet size={17} />
              Review payment
            </button>
          ) : amount <= 0 ? (
            <div style={{ textAlign: 'center', fontSize: 12, color: TEXT3, marginTop: 12 }}>
              Enter an amount above to continue
            </div>
          ) : null}
        </div>
      )}

      <style>{`@keyframes upSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
