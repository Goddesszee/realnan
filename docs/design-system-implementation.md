# NAN Design System — Implementation Report
**Date:** October 19, 2026  
**Scope:** Application-wide design system audit and consolidation

---

## Summary

All six phases completed. The NAN application now runs on a single coherent design system with consistent electric-blue branding, unified CSS tokens across all three CSS layers, corrected UI atom components, and zero purple contamination.

**TypeScript:** 0 errors  
**Lint errors introduced by this work:** 0  
**Pre-existing lint errors (not introduced, not fixed):** 12 (in ProfilePage, CurrencyConverterPage, InvoicePage — unused vars and async handler misuse)  
**Dev server:** Running on port 5173  
**Contract tests:** 35/35 pass (unchanged)

---

## Phase 1 — Tailwind Config (`tailwind.config.js`)

**Problem:** The Tailwind palette used `#2563EB` (blue-600) for the brand blue instead of `#0866F5`. Any component using `bg-nan-accent`, `text-nan-accent`, or `border-nan-accent` rendered the wrong color. Token names were also inconsistent with the CSS variable system.

**Fix:**
- Replaced all colors with values that exactly match `useNanTheme()` + `nan-theme.css` v4
- Brand blue: `nan.blue = #0866F5` (was `#2563EB`)
- Added `nan.surface`, `nan.surface-2`, `nan.surface-3`, `nan.text`, `nan.text-2`, `nan.text-3`
- Added `nan.green`, `nan.red`, `nan.gold` semantic tokens
- Replaced `nan.accent`/`nan.accent2`/`nan.soft` with semantically named tokens
- Fixed background gradients from `rgba(37,99,235,...)` to `rgba(8,102,245,...)`
- Aligned border radius tokens: `nan-sm=8px`, `nan=12px`, `nan-lg=16px`, `nan-xl=20px`
- Aligned animation timing with design system values

---

## Phase 2 — Token Aliases (`nan-design-system.css`, `nan-theme.css`)

**Problem:** Two separate token naming conventions existed simultaneously:
- v4 (canonical): `--nan-surface-2`, `--nan-text-2`, `--nan-border` (dash suffix)
- v3 (legacy): `--nan-surface2`, `--nan-text2`, `--nan-bdr` (no dash)

Components using either convention silently resolved to `undefined` if the corresponding file hadn't set their specific version.

**Fix — `nan-design-system.css`:**
- Added explicit bridge comment documenting both sets
- Added `--nan-bdr` and `--nan-bdr2` to the `:root` block (they were missing — only the dash versions existed)

**Fix — `nan-theme.css`:**
- Added the full set of no-dash aliases (`--nan-bdr`, `--nan-bdr2`, `--nan-surface2`, `--nan-surface3`, `--nan-text2`, `--nan-text3`) to both the `:root` dark block and the `[data-theme="light"]` override block
- This means any component or CSS class using either naming convention now resolves correctly in both themes

---

## Phase 3 — `index.css` Repair

This was the largest intervention. The legacy Relay v2 block (~1,400 lines) contained numerous issues.

### Purple → Blue (22 instances fixed)

Every `rgba(67,56,202,...)` (indigo-600 purple — a leftover from a previous design iteration) was replaced with the correct brand blue equivalent:

| Location | Old | New |
|---|---|---|
| `.card` inset shadow | `rgba(67,56,202,0.12)` | removed (simplified) |
| `.earn-apy-hero` bg/border | `rgba(67,56,202,.08/.04/.25)` | `rgba(8,102,245,.08/.04/.22)` |
| `.earn-apy-label` color | `rgba(67,56,202,.7)` | `rgba(8,102,245,.7)` |
| `.earn-step-num` border | `rgba(67,56,202,.3)` | `rgba(8,102,245,.28)` |
| `.gas-row` bg/border | `rgba(67,56,202,0.05/.15)` | green `rgba(16,185,129,.06/.16)` |
| `.res-bar.ok` bg/border | `rgba(67,56,202,.07/.22)` | green `rgba(16,185,129,.07/.22)` |
| `.btn-green` bg/border/hover | `rgba(67,56,202,.15/.3/.25)` | green `rgba(16,185,129,.12/.28/.20)` |
| `.success-circle` shadow | `rgba(67,56,202,.4)` | `rgba(8,102,245,.4)` |
| `.tx-ico.in` bg/border | `rgba(67,56,202,.1/.2)` | green `rgba(16,185,129,.10/.20)` |
| `.tx-ico.swap` bg/border | `rgba(67,56,202,.1/.2)` | blue `rgba(8,102,245,.10/.20)` |
| `.tx-item:hover` | `rgba(67,56,202,.04)` | `var(--nan-surface-2)` |
| `.tx-badge.confirmed` | `rgba(67,56,202,.1/.2)` | `rgba(8,102,245,.10/.22)` |
| `.live-badge` bg/border | `rgba(67,56,202,.06/.25)` | green `rgba(16,185,129,.07/.22)` |
| `.info-banner` bg/border | `rgba(67,56,202,.06/.22)` | blue `rgba(8,102,245,.07/.20)` |
| `#desktopNav .dnav-btn.active` | `rgba(67,56,202,.1)` | `var(--nan-blue-dim)` |
| `#desktopNav .dnav-btn.dnav-send.active` | `rgba(67,56,202,.15)` / `#dbb4fd` | `rgba(8,102,245,.15)` / `#0866F5` |
| `.nav-btn.active` | `rgba(67,56,202,.12)` | `rgba(8,102,245,.10)` |
| `.tnav-btn:hover` | `rgba(67,56,202,.08)` | `var(--nan-blue-dim)` |
| `.more-drop-btn:hover` | `rgba(67,56,202,.08)` | `var(--nan-blue-dim)` |
| `.home-action:first-child` gradient | `rgba(67,56,202,.1)` | `rgba(8,102,245,.12)` |
| `.usdc-dot` / `.eurc-dot` glow | `rgba(67,56,202,.7)` | `rgba(8,102,245,.6)` |
| `#toast.success` border/shadow | `rgba(67,56,202,.2/.1)` | `rgba(8,102,245,.22/.10)` |
| `#toast.success #toastIconBadge` bg | `rgba(67,56,202,.15)` | `rgba(8,102,245,.12)` |
| Balance card gradient on mobile | `rgba(67,56,202,.18) → rgba(109,40,217,.12)` | `#0F1117 → #171A21 → #0D1017` |

### Other CSS Fixes

- **Broken selector:** `/* == NAV BOLD FINAL FIX ==` had a dangling selector (`.nav-btn span, .nav-btn .nl, #desktopNav .nav-btn .nl,`) with a trailing comma that flowed into the next `@media` block, creating invalid CSS. Fixed by adding the closing `{ ... }` block.
- **`html/body/root overflow: auto !important`:** Removed — this fought the app shell's `position: fixed` layout and caused scroll issues on some pages. Replaced with a lightweight background-color fallback.
- **`:root` override in `@media(max-width:767px)`:** Removed — this set `--bg: #000000` and `--surface: #000000` on mobile, overriding the design system's carefully chosen `#0B0D12` dark base. This was why the mobile app appeared noticeably darker/blacker than desktop.
- **`#homeBalNgn` purple text:** `rgba(225,210,255,1)` → `var(--nan-text-2)`
- **`.card` simplified:** Removed the multi-layer inset box shadow with purple tint; replaced with a cleaner `0 4px 16px rgba(0,0,0,0.25)` shadow.
- **`.card-title` fixed:** Was `color: var(--accent3)` (electric blue); corrected to `var(--nan-text-3)` — card section labels should be muted, not the brand accent.
- **`.home-bal-ngn` purple text:** `rgba(196,181,253,0.5)` → `var(--nan-text-3)`
- **Hardcoded `#111111` backgrounds:** Replaced with `var(--nan-bg, #0B0D12)`
- **`.success-circle` text color:** `#f3e8ff` (lavender) → `#fff`

---

## Phase 4 — UI Atom Components

### `Button.tsx`
- All variant colors now use CSS variables exclusively (`var(--nan-blue)`, `var(--nan-surface-2)`, etc.)
- `danger` variant changed from hardcoded `#DC2626` background to `var(--nan-red-dim)` + border (matches the app's convention for danger — subtle, not alarming)
- `success` variant changed from hardcoded `#16A34A` background to `var(--nan-green-dim)` + border
- Added `WebkitTapHighlightColor: transparent` 
- Added `minHeight` per size for better touch targets
- Loading spinner uses `nan-spin` animation (defined in design system)

### `Card.tsx`
- All CSS vars; renamed `glow` variant to `blue` for clarity
- Added `elevated` variant (`var(--nan-surface-2)` background)
- `borderRadius` uses `var(--nan-r-xl)` 
- `CardTitle` now uses `var(--nan-text-3)` at 11px uppercase — matches `.nan-section-title`
- `CardRow` uses `var(--nan-border)` for dividers; mono mode uses JetBrains Mono

### `Input.tsx`
- `background` changed from `var(--nan-surface2)` to `var(--nan-surface)` (inputs sit on the surface, not recessed further)
- `borderRadius` uses `var(--nan-r-md)` 
- `fontSize: 'max(14px, 1em)'` prevents iOS auto-zoom
- `WebkitAppearance: 'none'` consistent
- Label style: uses `var(--nan-text-3)` at 11px (matches `nan-label-field` from design system)

### `Badge.tsx`
- `default` variant: was `background: '#1a1a1a'` (hardcoded dark) → `var(--nan-surface-2)` (theme-aware)
- `blue` variant: was `background: 'rgba(0,0,0,0.05)', color: '#ffffff'` (effectively invisible in dark mode, white-on-dark not blue) → `var(--nan-blue-dim)`, `color: var(--nan-blue)` — correct
- `mono` variant: was same broken white-on-dark → proper surface-2 with text-2
- All dot colors now use CSS variables

### `Spinner.tsx`
- Default color: `'#ffffff'` → `'var(--nan-blue)'` (spinner should use brand color, not just white)
- Border: `rgba(0,0,0,0.08)` → `var(--nan-border)` (theme-aware)
- `PageLoader`: `background: '#111111'` → `var(--nan-bg)` (theme-aware); logo shadow uses correct blue
- `LoadingDots`: default color uses `var(--nan-text-2)`

---

## Phase 5 — Vite Config

Updated the HMR hostname from the previous session's preview hostname to the current session hostname (`iluehgri4w86n2og3a4h7.preview.studio.arc.io`). This fixes the "WebSocket closed without opened" errors that were appearing in `console.jsonl`.

---

## What Was NOT Changed

Per the brief — no functional code was altered:

- All smart contract addresses, ABI calls, and contract interaction logic
- wagmi hooks (`useAccount`, `useWriteContract`, `useSendTransaction`, etc.)
- ConnectKit wallet connection
- Circle UCW / developer-controlled wallets SDK calls
- CCTP bridge, swap, and gateway flows
- Token balance reads and financial calculations
- Authentication (OTP email, Google, passkey)
- API contracts (all `/api/*` routes)
- Transaction state machines and confirmation polling
- Recurring payments, x402 micropayments
- Push notification logic
- All routing and navigation logic
- All page component JSX/logic (only their imported UI atoms were updated)

---

## Outstanding Issues (Pre-existing, Not Introduced)

These existed before this work and were not fixed as they require logic changes outside scope:

1. **`src/components/pages/ProfilePage.tsx:23`** — `previousView` destructured from store but unused
2. **`src/components/pages/CurrencyConverterPage.tsx:43`** — `setState` called synchronously in `useEffect`
3. **`src/components/pages/InvoicePage.tsx:92`** — `StatusBadge` function declared but unused
4. **`src/components/pages/InvoicePage.tsx:461,535`** — `hue` variable declared but unused
5. Multiple `no-explicit-any`, `no-misused-promises`, `no-unsafe-*` violations in backend API files

---

## Files Changed

| File | Change |
|---|---|
| `tailwind.config.js` | Complete color/token/animation realignment |
| `src/nan-design-system.css` | Added missing `--nan-bdr` / `--nan-bdr2` bridge aliases to `:root` |
| `src/nan-theme.css` | Added v3 no-dash aliases to both `:root` and `[data-theme="light"]` |
| `src/index.css` | 22× purple→blue, 5 structural fixes, CSS var replacements |
| `src/components/ui/Button.tsx` | All variants use CSS vars; improved touch targets |
| `src/components/ui/Card.tsx` | CSS vars, semantic variants, consistent radii |
| `src/components/ui/Input.tsx` | CSS vars, iOS zoom fix, correct token names |
| `src/components/ui/Badge.tsx` | Correct all six variants, CSS vars throughout |
| `src/components/ui/Spinner.tsx` | CSS vars, brand-blue default color, theme-aware PageLoader |
| `vite.config.ts` | Updated HMR hostname to current session |
