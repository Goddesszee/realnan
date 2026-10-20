# NAN — Full Overview, Honest Feedback & Improvement Plan
*Reviewed: October 2026*

---

## What NAN Is

NAN (nanarc.xyz) is a mobile-first USDC payments app built on Arc (Circle's L2 where USDC is the native gas token). It combines a React/TypeScript/Vite frontend with a Bun/Express backend and deep Circle integrations. The core idea: an intelligent payment network where AI agents can execute financial actions on your behalf.

---

## What NAN Can Do Right Now

### Authentication
- Circle email OTP login (one-time password via email, user-controlled wallet created on Arc)
- Google social login (Circle UCW)
- Passkey / modular wallet (Circle Modular Wallets, WebAuthn)
- Browser wallet (MetaMask, WalletConnect, Coinbase via ConnectKit/wagmi)
- Session persistence, auto-restore on tab reload, Circle signing-key refresh on visibility change

### Payments (Core)
- Send USDC on Arc (wagmi, UCW, passkey — all paths covered)
- Receive USDC — shows wallet address + QR code
- NAN Names — `@handle` on-chain via `NANNameRegistry` (Arc mainnet, deployed)
- Pay by NAN name — public page `nanarc.xyz/@handle`, no NAN account needed for payer
- Payment links — `?nanpay=handle` URL parameter
- Payment requests — create, share, pay via link (`?pr=<id>`)
- Invoices — full invoice builder (line items, discount, tax, due date, PDF export), public pay page (`?invoice=<id>`)
- Batch payroll — send USDC to multiple recipients in one session
- Recurring payments — cron-based (Vercel Cron, hourly), stored in Redis

### Cross-Chain / DeFi
- CCTP bridge (USDC across Arc, Ethereum, Base, Arbitrum, Optimism, Polygon via Circle AppKit CCTP V2)
- Token swap (Circle AppKit Swap Kit — USDC, USDT, EURC, DAI)
- Universal pay panel — payer connects any EVM wallet, NAN auto-routes stablecoin to USDC on Arc (just wired)
- Circle Gateway — unified cross-chain USDC balance via depositFor/getBalances
- Currency converter — live FX rates for 50+ currencies

### Onramp / Offramp
- Circle Onramp Kit (buy USDC with card, Apple Pay, bank transfer) — inline widget on all public pay pages and Agent Wallet Fund drawer
- Naira ramp (NGN in/out) — visible based on `VITE_NAIRA_RAMP_ENABLED`

### AI Agent
- NAN Agent chat — Groq (llama-3.3-70b) or OpenAI (gpt-4o) LLM with full wallet context injected
- Structured action system (`nan-action` blocks) — 30+ actions: send_usdc, bridge_start, swap_start, create_invoice, create_payment_request, add_recurring, and more
- Offline intent detection — detects bridge/swap/send intent instantly without a server round-trip
- Agent Wallet (separate Circle UCW with `refId='agent'`) — dedicated USDC budget for agent use
- Spending guard — per-tx and daily limits enforced server-side before agent sends
- x402 nanopayments — pays for AI services via Circle Gateway (when `SELLER_ADDRESS` set)
- Bridge/swap via agent chat — type "bridge 10 USDC to Base" → agent executes via AppKit

### Admin Dashboard
- Password-protected (client-side, no server auth — suitable for low-stakes ops only)
- User presence (live connected wallets via SSE)
- Admin insights (transaction volume, active users, top wallets)
- Admin treasury — reads NANNameRegistry USDC balance, `withdraw(to, amount)` onchain call
- Support ticket management (view, reply, resolve)
- FAQ management (CRUD)
- Feedback review
- About content editor
- Admin access via `VITE_ADMIN_ADDRESS` wallet match or 5-tap on desktop sidebar logo

### UX / Infrastructure
- Light/dark mode with `useNanTheme`
- Multi-language support (i18n, language FAB)
- Push notifications (Web Push, VAPID keys, service worker)
- Activity feed (real-time SSE from server)
- Contacts (save addresses with names)
- Favorites (quick-access addresses)
- Referral system (earn $1 USDC when a friend joins and sends $100+)
- Merchant QR code page
- Exports (CSV of activity)
- Support tickets (create, reply, track)
- Feedback and suggestions
- PWA (manifest, service worker, install prompt)
- Error boundaries (per-page, resets on navigation)
- Lazy loading with auto-retry on stale CDN chunk

---

## Honest Feedback

### What's Working Well
1. **Breadth is impressive.** NAN covers payments, DeFi, AI agents, onramp, invoicing, payroll, and cross-chain in a single mobile app. Most fintech startups ship one of these.
2. **Circle integration depth.** UCW, AppKit (bridge + swap), CCTP V2, Onramp Kit, Modular Wallets, x402 — all wired. This is one of the most complete Circle integrations in the wild.
3. **NAN Names.** Deployed contract on Arc mainnet, working `/@handle` public pay pages, NAN-to-address resolution in the agent chat. Clean product idea executed well.
4. **Agent system prompt quality.** The chat server injects live wallet state, activity, recurring tasks, invoices, and contacts into every LLM call. The agent genuinely knows your financial context.
5. **Public pay pages.** All three (pay-by-name, payment request, invoice) now have inline Circle Onramp and the Universal Pay Panel. A payer with zero NAN account and zero USDC can still pay using a card or any EVM stablecoin.
6. **Mobile-first design.** The app looks clean and consistent on mobile. Recent redesigns brought the Agent Wallet into alignment with the rest of the app.

### What Needs Attention

**Critical (breaks real users):**
1. **Admin dashboard has no server-side auth.** The password check is purely client-side. Anyone can open DevTools and bypass it. `ADMIN_SECRET` guards the API routes, but the dashboard UI itself is unprotected. Should redirect to a server-verified login at minimum.
2. **x402 Path B (spend → challengeId) never settles on the server.** The agent `spend` action returns a `challengeId` that requires a Circle PIN popup — which only a browser can open. Server-side agent actions that go through Path B silently fail to settle. Either switch the agent wallet to developer-controlled wallets (no PIN needed for server-side signing) or surface a "Tap to approve" flow in the chat.
3. **Redis is required in production but not in dev.** The recurring cron, OTP rate limits, and referral tracking all need `KV_REST_API_URL`. Without it, cron silently skips, OTP has no rate limit, and referrals don't track. The server correctly fails at startup if Redis is missing in production — but the dev experience gives no warning.
4. **NANNameRegistry `withdraw` has no UI access control.** The treasury panel in admin reads and calls `withdraw` using a wagmi-connected wallet. If `VITE_ADMIN_ADDRESS` is not set (which is the current state in dev), the panel is reachable by any connected wallet. Set `VITE_ADMIN_ADDRESS` to your deployer wallet before going to production.

**High priority:**
5. **The email OTP in `sendOtpEmail` still says "Paywell" and "Paywell verification code" in the subject/body.** Users will receive a branded email from an old product name. Quick fix.
6. **`mockAgentReply` also says "Paywell".** The LLM fallback reply when no API key is set mentions "Paywell shopping assistant" and "Paywell marketplace". Should say NAN.
7. **The `openaiChat` and `groqChat` legacy functions say "Paywell".** These are no longer called (the main chat handler above them is used instead), but they're confusing.
8. **Server `circleGetWallet` uses developer-controlled wallets API format to read UCW balances.** It calls `circle.com/v1/w3s/wallets/:id/balances` which is the UCW endpoint — this is fine. But it ignores the `entitySecret` parameter and never validates it. The mock fallback in `getWallet` returns `"100.00"` balance to any session — real users in dev see fake money.
9. **`AGENT_WALLET_ID` and `AGENT_WALLET_ADDRESS` not set in production.** Without these, every x402 nanopayment path silently skips with `skipped_reason: 'Agent wallet credentials not configured'`. The agent "pays" for services but no USDC actually moves.
10. **Universal Pay Panel (just shipped) is unverified in production.** The bridge route using `createForwarder` requires `CIRCLE_API_KEY` on the server to estimate fees, and the swap route needs AppKit configured. These need end-to-end testing.

**Medium priority:**
11. **No loading skeleton on the Home page balance.** The balance shows `$0.00` for 1-2 seconds on every load before the real balance arrives. A shimmer skeleton would feel more polished.
12. **Agent chat has no message pagination.** Long conversations grow the DOM without limit. Should implement virtual scrolling or a "load earlier" button.
13. **No confirmation before logout.** One tap on the logout button ends the session with no "Are you sure?" prompt.
14. **Invoice PDF generation uses `window.print()`.** This works but is not a true PDF — it opens the browser print dialog. A real PDF (using jsPDF or a server-side generator) would be more professional.
15. **NAN Name fees (`REGISTRATION_FEE` in the contract) go to the contract but there's no automated withdrawal.** The admin treasury panel shows the balance and allows manual withdrawal, but there's no scheduled sweep. Fees accumulate and require manual action.

---

## What We Can Do to Make NAN Better

### Tier 1 — Fix broken things (do these first)
1. **Fix "Paywell" branding** in OTP emails, agent fallback replies, and legacy chat functions — 15 minutes of find/replace.
2. **Server-side admin auth** — add a simple `/api/admin/login` endpoint that validates `ADMIN_PASSWORD` and sets a cookie, check the cookie on the admin dashboard route in `App.tsx`.
3. **Switch agent wallet to developer-controlled wallets** for server-side spending — eliminates the challengeId/PIN problem. The `circleTransfer` function in `server/index.ts` already uses dev-controlled wallets; wire the agent `spend` action to it.
4. **Set `VITE_ADMIN_ADDRESS`** in Vercel to your deployer wallet.
5. **Set `AGENT_WALLET_ID` + `AGENT_WALLET_ADDRESS`** in Vercel after provisioning a dedicated agent wallet.

### Tier 2 — High-value product improvements
6. **NAN Pay Button (embeddable)** — a `<script>` tag that any merchant can paste on their website to add a "Pay with NAN" button. Opens `nanarc.xyz/@handle` in a popup. Zero integration cost for merchants. This is your distribution play.
7. **Scheduled invoice payments** — "Pay this invoice every month". Wire recurring payments into the invoice system so a client can set up autopay on a NAN invoice. No other USDC invoicing tool does this.
8. **Multi-sig payment requests** — for businesses: a payment request that requires approval from 2 of N wallet addresses before USDC is released. Uses PaywellEscrow (already deployed on testnet) as the basis.
9. **NAN Agent webhooks** — let users register a webhook URL that gets called when the agent completes an action. Businesses can integrate NAN agent payments into their own systems (e.g., "when agent pays for a SaaS service, update our CRM").
10. **Group payments / split bills** — one payment request that multiple people can contribute to, each paying their share via their preferred method (card, any chain, NAN wallet). The host sees a progress bar. Perfect for travel groups, shared expenses, event tickets.
11. **Merchant dashboard** — a separate view (or a `?merchant=1` mode) for businesses receiving payments. Shows incoming payments, outstanding invoices, total received this month, top payers. Distinct from the admin dashboard.
12. **NAN Name discovery / directory** — a public `nanarc.xyz/explore` page listing NAN name holders (opt-in). Searchable by handle. Makes NAN names valuable as a social primitive, not just a payment shortcut.
13. **Transaction receipts via WhatsApp** — the `whatsapp.ts` lib is already there. Auto-send a WhatsApp message to the recipient when a payment confirms. Most users in Nigeria/West Africa prefer WhatsApp over email.
14. **Onchain activity feed with real block explorer data** — currently the activity feed is server-side only (it only shows transactions NAN is aware of). Wire the onchain activity hook (`useOnchainActivity.ts` exists) to scan Arc for all USDC transfers to/from the user's address, so transfers made outside NAN still appear.
15. **EURC support** — the balance card already shows EURC. Wire EURC transfers, payment requests, and invoices to use EURC as the denomination when the user has EURC balance. NAN already has EURC on Arc via the address in `onchain-facts.ts`.

### Tier 3 — Growth and scale
16. **Circle Compliance / AML hooks** — before NAN goes to serious volume, integrate Circle's compliance screening APIs so large transfers can be flagged. Required for any regulated market.
17. **Vercel Edge Config for feature flags** — replace `nairaRampVisible()` and similar env-var-based feature flags with Vercel Edge Config, so you can toggle features per-region without a redeploy.
18. **Mobile app (PWA install prompt)** — the PWA manifest and service worker are already there. Add an `onbeforeinstallprompt` banner to prompt users to install to their home screen. On Android Chrome this creates a near-native experience.
19. **NAN for Business tier** — a separate login mode for businesses with: multi-user access (team members), role-based permissions (send only, admin only), monthly statement exports, and invoice branding customization.
20. **Agent marketplace (when ready)** — re-enable the services tab in the Agent Wallet, but make it NAN-curated rather than Circle API-dependent. Start with 5-10 real integrations (weather API, LinkedIn jobs, news feed) that actually accept USDC payment via x402.
