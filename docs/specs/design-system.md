# FinTrack restyle: design system + per-screen notes

Owner: Dom (UI/UX). Status: DRAFT for Tom / GO / Kho / Sandesh. Read-only against `Jerry7675/FinTrack` @ `0164fd9` (`/workspace/fintrack`).
Mockups (Accounts, Analytics, Overview, Quick Add) and the "FinTrack Obsidian Pro" token file are **references, not strict specs**. Where they conflict with the real app or with "no fake claims", the app wins.
Companion files: `quick-add.md` (full Quick Add spec), `palette.png` (swatches + contrast sheet), `task3-edit-transaction.md`, `task4-cross-currency-transfer.md`.
Items marked **[DECISION: Sandesh]** are open; everything else is decided here.

## 0. Principles
1. Audience = ordinary people and small organisations, not traders. Plain words, no telemetry jargon.
2. Local-first, manual entry. The app has no server, no live data, no sync. Never imply otherwise (see §9).
3. Logging an entry takes under 5 seconds (Quick Add, `quick-add.md`).
4. One accent, calm surfaces. At most one soft shadow per screen, and only on the primary action. No glow on cards, dots or status pills.
5. Status is never colour alone: icon + words + colour.
6. Reuse before inventing: every change below names the real file/component it extends.

Patterns borrowed (idea sources only; nothing is copied visually):
| Idea | Source app | Where used |
|---|---|---|
| Category chips ordered by last-used / most-used | Copilot Money, Revolut | Quick Add category row |
| "Available to spend" per category with colour state + text | YNAB | Budget pill, BudgetBar |
| Send / receive amounts with the rate shown between | Wise | Quick Add transfer (Task 4 spec) |
| Grouped accounts + net-worth trend | Monarch | Accounts, Overview |
| Keypad-first amount entry | Cash App | Quick Add keypad |
| Merchant + date row, signed amounts, nothing else | Apple Wallet | Activity list rows |
| Simple "what you own / what you owe" and month spend by category | Mint (legacy) | Overview bar, Insights |
| Quick "who owes who" entry (future only) | Splitwise | Future spec: split bill |

## 1. Colour

### 1.1 Decision (one pair)
The Obsidian file lists two blues and two greens (frontmatter `primary #8ed5ff` / `primary-container #38bdf8`, `secondary-container #03f59b`; prose `#38BDF8`, `#00F59B`).
**Chosen: accent `#38BDF8`, positive `#00F59B`.** Reason: they are the values the prose spec and all four mockups actually use for fills/CTAs, both clear WCAG AA on every dark surface (8.7:1 and 12.9:1 on the page background), and one pair avoids two near-identical blues in the code. `#8ed5ff` and `#03f59b` are dropped. Surfaces use the frontmatter ladder (`#0f131c` family, lifted slightly from the prose `#030712`, which is harsher on OLED and leaves no room for 3 distinct card layers).
Negative: the prose `#F43F5E` is 4.65:1 on cards but only 4.45:1 on overlays and 3.9:1 on `surface-high`, below AA for small text, so **negative = `#FB7185`** (6.3:1 on card).

### 1.2 Dark tokens (default)
Contrast = against the stated surface (WCAG 2.x). "AA" = 4.5:1 body, 3:1 large text / UI graphics.
| Token | Hex | Use | Contrast |
|---|---|---|---|
| background | `#0F131C` | screen background | ink 14.4:1 |
| surface-sunken | `#0A0E16` | input wells, keypad well, chart well | ink 15.0:1 |
| surface (card) | `#181C24` | cards, list groups, tab bar | ink 13.2:1 |
| surface-overlay | `#1F242D` | bottom sheets, select sheet, dialogs | ink 12.6:1 |
| surface-high | `#262A33` | inactive chips, pressed rows, keypad keys | ink 11.1:1 |
| border (hairline) | `#2B3038` | card/list dividers (decorative, no contrast requirement) | 1.3:1 |
| border-strong | `#66727C` | input outlines, focus-less control boundaries | 3.5:1 on card (meets 1.4.11 non-text 3:1) |
| text-primary | `#DFE2EE` | body, amounts | 13.2:1 card |
| text-secondary | `#BDC8D1` | supporting text | 10.0:1 card |
| text-muted | `#8F9AA3` | captions, placeholders, inactive tabs | 5.9:1 card, 5.0:1 surface-high |
| accent-primary | `#38BDF8` | primary button fill, selected chip, links, focus | 8.0:1 card; text-on-accent `#04141F` 8.7:1 |
| accent-soft | `#1D3646` | selected-chip tint, info pill fill (accent @16% on card) | accent text on it 5.9:1 |
| positive | `#00F59B` | income, "within budget", gains | 11.8:1 card |
| positive-soft | `#153A35` | pill fill | positive on it 8.6:1 |
| negative | `#FB7185` | over budget, debts / amounts owed, errors, delete | 6.3:1 card; on its soft fill 5.0:1 |
| negative-soft | `#3C2A34` | pill / error banner fill | |
| warning | `#F59E0B` | "near limit", low-data warnings | 7.9:1 card |
| warning-soft | `#3B3120` | pill fill | 5.9:1 |
Rules: no text below 12px uses `text-muted` on `surface-high`; `text-on-accent` only on accent/positive/negative solid fills (12.9:1 / 6.9:1).

### 1.3 Chart palette (categorical)
Contrast vs card `#181C24` (all >= 3:1 for graphics). Order matters (adjacent slices differ in hue AND lightness):
`#38BDF8` Sky 8.0 | `#F59E0B` Amber 7.9 | `#A78BFA` Violet 6.3 | `#2DD4BF` Teal 9.2 | `#FB7185` Rose 6.3 | `#A3E635` Lime 11.3 | `#94A3B8` Slate = "Other" 6.7.
Rules: donut/bars always have text legend rows with the number (colour is not the only key); slices separated by a card-coloured stroke (the existing `Pie.SliceAngularInset` already does this, `components/charts/widgets.tsx`); never red/green as the only pair. Line/area charts use accent `#38BDF8` at 2px with a 15% fill, no glow.
Category colours are user data (`categories.color`). Seeded colours (`lib/categories/icons.ts`) on the dark card: all >= 3:1 except **`#6A4C93` (2.49:1)**; on the light card nine seeded colours are below 3:1 (`#F4A261` 2.06, `#F59E0B` 2.15, `#3DDB8A` 1.80, etc.). Therefore NEW helper `ensureContrast(hex, bgHex, min=3)` in `src/lib/color.ts` (shift lightness only) applied to category glyph icons, donut slices and bar fills at render time. Stored colours are not rewritten.

### 1.4 Light theme: exists today, decision needed
Verified: a light theme exists. `settings.theme` is `'system' | 'light' | 'dark'` (`lib/db/schema.ts`, default `system`), `constants/palette.ts` has `palette.light` (green on white), Settings has an Appearance chip row (`features/settings/screen.tsx`). Users on a light phone currently get light.
**Recommendation (A): keep it and derive it from the same token names** so nothing is lost and no screen is dark-only. Light values (all AA on their surfaces, see `palette.png`): background `#F5F7FA`, sunken `#E9EDF2`, card `#FFFFFF`, overlay `#FFFFFF`, high `#E3E8EE`, border `#D9DFE6`, border-strong `#7A8590`, text-primary `#0F131C`, secondary `#3B4650`, muted `#5B6670` (5.9:1), accent `#0369A1` (white text 5.9:1), positive `#047857`, negative `#BE123C`, warning `#92400E`; soft fills = colour @10% on card. Dark is designed first and is what mockups show; light is verified, not art-directed.
Alternative (B): remove light (force dark, delete Appearance). Cheaper, but surprises light-mode users. **[DECISION: Sandesh]** default recommendation = A.

### 1.5 Mapping to the repo (extend, do not rewrite)
Theme lives in two hand-synced places: `src/constants/palette.ts` (consumed through `useThemeColors()` in `components/ui/primitives.tsx`) and `tailwind.config.js` (NativeWind classes such as `bg-surface-dark-raised`, selected with `colorScheme` ternaries; there is no CSS-variable dark mode).
| Existing key (`palette.ts`) | New dark value | New light value | Notes |
|---|---|---|---|
| `surface` | `#0F131C` | `#F5F7FA` | background |
| `surfaceRaised` | `#181C24` | `#FFFFFF` | card |
| `surfaceSunken` | `#0A0E16` | `#E9EDF2` | wells |
| `ink` | `#DFE2EE` | `#0F131C` | |
| `inkMuted` | `#8F9AA3` | `#5B6670` | |
| `inkInverse` | `#04141F` | `#FFFFFF` | = text-on-accent |
| `accent` | `#38BDF8` | `#0369A1` | **brand colour changes green -> sky** |
| `accentSoft` | `#1D3646` | `#E6F0F6` | |
| `accentBright` | remove (unused outside palette) | remove | |
| `income` | `#00F59B` | `#047857` | now a distinct colour from `accent` (today they are the same green) |
| `expense` | `#FB7185` | `#BE123C` | |
| `line` | `#2B3038` | `#D9DFE6` | |
| `chart` / `chartFill` | `#38BDF8` / rgba(56,189,248,.15) | `#0369A1` / rgba(3,105,161,.12) | |
| NEW `inkSecondary` | `#BDC8D1` | `#3B4650` | |
| NEW `surfaceOverlay` | `#1F242D` | `#FFFFFF` | sheets, Select modal (`primitives.tsx` Select uses `surfaceRaised` today) |
| NEW `surfaceHigh` | `#262A33` | `#E3E8EE` | inactive `Chip`, keypad keys |
| NEW `lineStrong` | `#66727C` | `#7A8590` | |
| NEW `warning`, `warningSoft`, `incomeSoft`, `expenseSoft` | see 1.2 | see 1.4 | |
`tailwind.config.js`: keep `ink / surface / accent / income / expense / line` groups; update hex values and add `warning`, `surface.dark-overlay`, `surface.dark-high`, `ink.secondary`, `line.strong` entries. Add a unit test (Task 2 harness) asserting `palette.ts` and `tailwind.config.js` hold identical hex values so they cannot drift.
Hard-coded hexes to replace by tokens in PR (a) (verified by grep): `app/(tabs)/_layout.tsx:9-21` (tab colours), `components/ui/cards.tsx:61-139` (BalanceCard, ActionTile gradients, `#3DDB8A` FAB glow), `components/ui/primitives.tsx:158,769,791`, `components/ui/toast.tsx:68-76`, `components/charts/calendar.tsx:90`, `features/categories/screen.tsx:76,170`, `features/widgets/FinTrackBalance.tsx:33`, `lib/db/schema.ts:54` (default category colour), `lib/categories/icons.ts:128,134`.
Semantics check for PR (a): today `c.accent` is also used to mean "good/positive" (17 `c.accent`, 4 `bg-accent`, 1 `border-accent` usages, e.g. default `ProgressBar` colour, account scope accent border). Since accent and income now differ, each usage must be classified as "interactive/selected" (stays accent) or "good/positive" (becomes `income`).

## 2. Typography
Decision: **keep the system font** (`tailwind.config.js` `fontFamily.sans = ['System']`; no `useFonts` call exists; `expo-font` is installed but unused). Hanken Grotesk (from the Obsidian file) would need `@expo-google-fonts/hanken-grotesk` + font gating in `app/_layout.tsx` and tabular-figure support must be verified for the shipped weights. **[DECISION: Sandesh]** adopt Hanken later as a separate small PR; nothing in this system depends on it.
Existing `AppText` sizes (`primitives.tsx`): xs 12, sm 13, base 15, lg 17, xl 22, display 34 (scaled by `fontSize()` in `lib/layout.ts`). Mapping from Obsidian:
| Role | Obsidian | `AppText` size | px / weight | Use |
|---|---|---|---|---|
| Hero money | display-hero-mobile 32/40 | `display` | 34 / 700, tracking -0.8 (existing) | total balance, Quick Add amount |
| Screen title | headline-lg-mobile 24 | `xl` | 22 / 700 | "Accounts", "Insights" |
| Section title | headline-sm 18 | `lg` | 17 / 600 | card titles |
| Body | body-lg 16 / body-md 14 | `base` | 15 / 400-500 | rows, fields |
| Secondary | body-sm 12-13 | `sm` | 13 / 400 | subtitles |
| Caption | label-data-sm 11, caption-caps 10 | `xs` | 12 / 500 | captions. **No text below 12px**; Obsidian's 10-11px caps are not used |
| Money in rows | label-data-md 14 | `base` | 15 / 600 | |
Changes: `SectionHeader` (currently UPPERCASE 13 muted) becomes sentence case 13/600 `text-secondary` (caps are kept only for 3-letter currency codes). Letter-spacing 0 except hero.
**Tabular numbers**: `fontVariant: ['tabular-nums']` is not used anywhere in the repo today (grep). Add to NEW `Money` component and `AppText` prop `numeric` and apply to every amount, percentage, date count and the keypad.
**Dynamic type**: RN scales `Text` by default; keep it. Cap `maxFontSizeMultiplier` at 1.3 for hero money, Quick Add amount, keypad keys, tab labels, chips (layout would break); all other text uncapped up to the OS maximum with wrapping (no fixed heights; use `minHeight`). Verify at 200% on a 667pt-high device.

## 3. Spacing, radii, elevation
- **4pt grid**: 4, 8, 12, 16, 20, 24, 32, 40. Screen gutter stays `layout.gutter = scale(20)`; card padding 16; gap between cards 12; section gap 24.
- **Min touch target 44pt** (Obsidian: input height 44; repo `Button` and `Field` use `minHeight: vs(48)`). Verified problem: `vs()` scales by screen height (`lib/layout.ts`), so `vs(48)` is ~39pt on a 667pt-high phone. Rule: all tappable minimums use `Math.max(44, vs(n))`. Other verified shortfalls: `IconButton` is `h-10 w-10` (40pt), `Chip` is ~36pt tall (`py-2` + 13px text). Fix by `minHeight 44` or `hitSlop` that reaches 44.
- **Radii** (reduce slightly from today's 24/28; mockups ~16-20): control (button, field, select) 14; chip/pill full; card 20; hero card 24; bottom sheet top 28; keypad key 14. (Today: `SurfaceCard` 24, `BalanceCard` 28, `Button`/`Field` `rounded-2xl` 16, `ActionTile` 22.)
- **Elevation (dark)**: tonal layers (background -> card -> overlay -> high) + 1px hairline border. No blur, no glass (Obsidian's backdrop-blur and bevel highlight are dropped: opaque surfaces are cheaper, easier to keep AA, and `expo-glass-effect` is not cross-platform). Shadows: floating sheets only (`shadowOpacity .4`, radius 24). **One glow per screen, on the primary action only**: `shadowColor accent, opacity .30, radius 14, offset 0/4`. Never on cards, dots, pills, the tab bar or charts. Remove today's FAB glow `cards.tsx:102` from BalanceCard and the `SurfaceCard` shadow (`shadowOpacity .35`, radius 16) in dark mode (use border only).
- **Elevation (light)**: card shadow `opacity .08, radius 12` as today.

## 4. Core components (name -> real file -> change)
| Component | File | Status | Props / change |
|---|---|---|---|
| `Screen`, `FormScroll`, `GoBack`, `ScreenHeader`, `SectionHeader`, `ListRow`, `EmptyState`, `Card`, `ProgressBar`, `GoalRing`, `ConfirmDialog` | `components/ui/primitives.tsx` | EXISTING, restyle via tokens | `SectionHeader` sentence case; `ProgressBar` default colour -> `accent` and accepts `state?: 'ok'|'near'|'over'` (colour from tokens) |
| `AppText` | `primitives.tsx` | EXISTING + prop | `numeric?: boolean` (tabular-nums), `maxScale?: number` |
| `Button` | `primitives.tsx` | EXISTING | variants primary/secondary/danger/ghost keep; primary text colour = `inkInverse`; min height 44; glow only when `prominent` prop (one per screen); `danger` = tinted `expenseSoft` fill + `expense` text (Obsidian destructive style) |
| `Chip` | `primitives.tsx` | EXISTING | min 44pt touch; `icon?`; selected = accent fill + `inkInverse` text; unselected = `surfaceHigh` |
| `Field`, `Select` | `primitives.tsx` | EXISTING | sunken fill + `lineStrong` 1px outline; focus = accent outline (no halo glow); error = `expense` outline + text + icon; Select sheet uses `surfaceOverlay` |
| `SurfaceCard`, `BalanceCard`, `SummaryStrip`, `TransactionCard`, `AccountCard`, `ActionTile` | `components/ui/cards.tsx` | EXISTING, restyle | `BalanceCard`: flat `surface` card (drop LinearGradient and green FAB), takes `lines: {label, amount}[]` for per-currency totals (Task 4 §12) and no glow; `TransactionCard` -> Apple-Wallet row (§7); `AccountCard` shows balance (§11.2); `ActionTile` drop gradients, flat `surfaceHigh` |
| `Toast` | `components/ui/toast.tsx` | EXISTING | tokens only; add icon per tone |
| `CategoryGlyph` | `primitives.tsx` | EXISTING | colour passes through `ensureContrast` |
| `CategoryDonut`, `SpendAreaChart`, `SpendBarChart`, `RangeFilters` | `components/charts/widgets.tsx` | EXISTING | palette §1.3; donut centre label slot; animations off with reduced motion |
| `Money` | `components/ui/money.tsx` | **NEW** | `{minor: number, currency: string, tone?: 'auto'|'neutral'|'income'|'expense', size?, showSign?, icon?}`. Wraps `formatMoney`, applies tabular-nums, right-aligns in rows, builds the accessibility label ("minus 12 dollars 50") |
| `SegmentedControl` | `components/ui/segmented.tsx` | **NEW** | `{options: {value,label,icon?}[], value, onChange}`; 44pt, selected = accent-soft fill + accent text + icon; replaces `Chip` rows for Expense/Income/Transfer and Appearance |
| `StatusPill` | `components/ui/status-pill.tsx` | **NEW** | `{tone: 'ok'|'near'|'over'|'info'|'neutral', icon, text}`; soft fill, icon + text always; `accessibilityLiveRegion='polite'` |
| `BudgetBar` | `components/ui/budget-bar.tsx` | **NEW** | `{spentMinor, limitMinor, currency}` -> bar + text "$158 left" / "Over by $18" + icon, states from `budgetStatus()` in `lib/planning.ts` (healthy <80%, approaching >=80%, exceeded >=100%) |
| `StackedBar` | `components/ui/stacked-bar.tsx` | **NEW** | "What you own / What you owe" two-segment bar with text values |
| `Keypad`, `AmountDisplay` | `features/transactions/keypad.tsx` | **NEW** | see `quick-add.md` |
| `CategoryChipRow`, `PresetChip` | `features/transactions/category-picker.tsx` (Task 3 creates it) | **NEW/extend** | see `quick-add.md` |
| `DateField`, `TransferAmountFields` | `components/ui/date-field.tsx`, `features/transactions/transfer-amount-fields.tsx` | NEW in Task 3 / Task 4 | reused as is |
| `Skeleton` | `components/ui/skeleton.tsx` | **NEW** | static `surfaceHigh` blocks (no shimmer when reduced motion) |
| `StoredOnDevice` | `components/ui/stored-on-device.tsx` | **NEW** | footer line, see §9 |
| `QuickAddProvider` + tab-bar centre button | `providers/quick-add-provider.tsx`, `app/(tabs)/_layout.tsx` | **NEW** | lifts `AddTransactionSheet` out of `features/dashboard/screen.tsx:634` so the centre "+" works on every tab |

## 5. State patterns (all screens)
- **Loading**: first paint shows real chrome (header, tab bar) + `Skeleton` blocks sized like the content; no full-screen spinner except cold start (`LoadingScreen`). Buttons use `Button loading`. Lists never flash "empty" before the first query resolves (today `DashboardScreen` shows `EmptyState` when `txns.length === 0`, including while loading).
- **Empty**: `EmptyState` (title, one-line help, optional primary action; character image optional via `constants/characters.ts`). Copy says what to do: "No transactions yet. Tap + to add your first one."
- **Error**: inline `StatusPill`/banner (negative-soft, icon + message + "Try again") inside the failed card, not a blocking alert. Mutations: `Toast` error + keep user input. Never show raw `String(e)` to users (today: `detail-screen.tsx` `Alert.alert('Could not add photo', String(e))`).
- **Partial data / different currency**: neutral muted note ("2 entries in other currencies not shown").

## 6. Money display rules
1. Every amount: `Money` / tabular-nums, right-aligned in rows, never truncated (wrap labels, not amounts).
2. Minor units -> display only through `formatMoney` (`lib/money/index.ts`); no float arithmetic (Task 1).
3. **Per-currency grouping**: totals are shown per currency, never summed across currencies, no implicit conversion (Task 4 §12 Home). Order: scope/default currency first, then by absolute value, then code.
4. **Sign, colour, icon** (colour never alone):
   - Income: `+$1,200.00`, `income` colour, arrow-down-left icon in the row glyph tooltip/label ("Income").
   - Expense: `-$12.50` in **primary text colour** (not red). Reason: a list of red numbers reads as alarm for ordinary users; the minus sign carries the meaning (Apple Wallet / Mint pattern). **[DECISION: Sandesh]** (today expenses are red, `dashboard/screen.tsx:528`).
   - Transfer: neutral `text-secondary`, sign shown per leg, swap icon (fixes outgoing leg shown green; Task 3 bug 2).
   - Negative **balances / debts / amounts owed**: `expense` colour with `-` sign and "owed" wording where applicable.
   - Over-budget: `expense` + warning icon + "Over by $X"; near limit: `warning` + alert icon + "$X left"; within: `income` + check icon + "$X left".
5. Negative formatting: ASCII hyphen-minus as `formatMoney` produces today (keeps CSV/widget strings stable); `-$0.00` never shown (zero is unsigned).
6. Zero balances shown as `$0.00`, not blank. Large values never abbreviated in rows; hero uses full value; chart axes may abbreviate (`1.2k`).
7. Hero: `display` size, `Money` with currency symbol; secondary currencies as `sm` lines below.
8. Accessibility label always spells sign and currency; decorative icons hidden from screen readers.

## 7. Row pattern (activity list)
Apple-Wallet style, 56pt min: `CategoryGlyph` (36) | title (`base`, 1 line) over "MMM d · {account}{ · Recurring/Subscription}" (`sm`, muted) | `Money` right-aligned. No status tags ("Instant Settled", "Tax Deductible" in the mockup are removed). Transfers: title + "{from} -> {to}" subtitle (Task 4 §7). Real source badges only: `sourceType` recurring/subscription (exists: `dashboard/screen.tsx:516-523`).

## 8. Label glossary (mockup term -> our label)
| Mockup term | Our label | Note |
|---|---|---|
| Consolidated Net Liquidity | **Total balance** | per currency |
| Gross Assets | **What you own** | accounts with positive balance |
| Liabilities (Term Debt) | **What you owe** | debts where `kind='i_owe'` + negative-balance accounts |
| Debt-to-Asset Leverage 23.7% (Optimal) | "Owed is 24% of what you own" | number only, no "Optimal" verdict |
| Net Liquidity / Net worth | **Net worth** (only on the existing Net worth screen) | |
| Personal Ledger / Active Ledger Scope / Target Ledger | **Group** (user-named: Personal, Business...) | code copy still says "ledger" in places (`accounts.tsx`: "Groups hold ledgers"); replace by "account" |
| Ledger (account) | **Account** | |
| Fund Source | **Account** ("Paid from" on expenses, "Deposit to" on income) | |
| Merchant | **Title** (placeholder "Where or what?") | the app has only `title` |
| Category Allocation | **Category** | |
| Commit to SQLite Ledger | **Save** | |
| Overview / Ledgers / Analytics (tabs) | **Home / Accounts / Insights / More** | existing tab names kept |
| Outflow Radar / Total Outflow | **Spending by category** / **Total spent** | |
| Inflow / Outflow (30D) | **Money in / Money out** (last 30 days) | |
| Velocity Index, Pacing -14% | removed | invented score |
| Pacing Guardrails | **Budgets** | |
| "Healthy - $158 buffer left" | "$158 left" | |
| Over by $18.15 / ADJUST LIMIT | "Over by $18.15" / "Change limit" | |
| Recurring Radar, Committed | **Subscriptions**, "per month" | |
| Audit & Cancel Unused Subs | removed (future spec) | no cancellation capability |
| Upcoming Commitments | **Upcoming bills** | |
| Entity Activity Stream | **Recent activity** | |
| Net Savings Retained 54.8% (Top Tier) | "Saved 55% of income this month" | existing `savingsRate`; no rank label |
| Smart Velocity Insight | removed | AI claim |
| Rebalance | removed | no such feature |
| Pay Now (credit card) | **Record payment** (debts only) | uses `recordDebtPayment`; no payment rail exists |
| Fixed / Deductible tag chips | removed (user tags only, if any) | tax claim |
| Safe | **Safe to spend** (see §11.1) | formula defined |
| Reorder (categories) | removed | future |
| Split Bill | removed | future spec |
| Save-as-preset (bookmark) | **Save as preset** | |

## 9. True-status copy rules (checked against the repo)
What the repo actually does:
- Data is a local SQLite file (`lib/db/client.ts` `openDatabaseSync('fintrack.db')`). There is no server, sync, API, analytics or live data (no such dependency in `package.json`). The database file is **not encrypted by the app**.
- App lock: optional, biometric/device credential via `expo-local-authentication` (`features/lock/screen.tsx`), **but it unlocks anyway when the device has no hardware or no enrolled credential** (`lines 15-31`).
- Backups: JSON export, plus "Export encrypted backup" (password, AES via `expo-crypto`, key derived by 2000 SHA-256 rounds, `lib/backup/index.ts`). Encryption applies only to the exported `.ftenc` file.
- **Last backup date does not exist**: `grep lastBackup` finds nothing; nothing records when an export happened.
Allowed copy:
| Allowed | Where |
|---|---|
| "Stored on this device" | footer on Home/Accounts, Settings |
| "Last backup exported: Oct 3" / "No backup exported yet" | Settings > Data & privacy, Home footer when > 30 days. Requires NEW data (see below) |
| "App lock: On/Off" | Settings only |
| "Password-protected backup" | Settings export row |
| "Receipt photos stay on this device" | already in `settings/screen.tsx:518` |
Forbidden (remove from mockups): `Synced (4ms)`, `WAL Synced`, `ENCRYPTED LOCAL VAULT`, `V1.4.2 ENCRYPTED 12MS`, `Zero-knowledge ledger synchronized SHA-256 Verified`, `6 Verified endpoints`, `AES-256-GCM hardware key`, `NYSE: Live`, `Multi-Sig`, `FX LIVE` / `≈ €114.28`, `Brokerage`, `Hardware Wallet`, BTC/ETH, `4.40% APY`, accrued interest, "unrealized gains", "autopay pacing", AI/"Smart" insights, "Tax Deductible"/"Instant Settled" tags. Do not describe the lock or database as "secure/encrypted".
Last-backup data: add nullable `settings.last_backup_at` (timestamp ms) set by `exportBackupJson` / `exportEncryptedBackup` after `Sharing.shareAsync` resolves. Copy must say **exported** (the share sheet cannot confirm the user saved the file). Needs migration `0005`; prerequisite is the missing `meta/0004_snapshot.json` (otherwise `drizzle-kit generate` emits a duplicate migration, verified earlier). Lighter alternative with no migration: `expo-secure-store` key (already a dependency; used in `features/widgets/update.tsx`). **[DECISION: Tom]**.
Live FX: out. Cross-currency amounts use the user-entered received amount/rate from `task4-cross-currency-transfer.md`; the UI never shows a market rate or "≈ converted" figure.

## 10. Motion, haptics, accessibility
- Durations: 120ms (press/selection), 200ms (fade/expand), 300ms (sheet). Easing: standard ease-out. No looping or pulsing animations (the "live dot" is removed). Chart/donut animate once on first mount.
- **Reduced motion**: read `AccessibilityInfo.isReduceMotionEnabled()` once in a `useReducedMotion()` hook (NEW, `hooks/`); when on: no spring on `Pie.Slice animate`, sheets use `fade`, expand/collapse instant, skeleton static. (Reanimated 4 `ReduceMotion.System` where animations use it.)
- **Haptics**: NEW dependency `expo-haptics` (`bunx expo install expo-haptics`; none installed today). Keypad key: `selectionAsync`; Save success: `notificationAsync(Success)`; validation failure: `Error`; long-press clear: `impactAsync(Medium)`. A Settings toggle "Haptic feedback" (default on) **[DECISION: Sandesh]**; OS-level haptics setting is respected by the OS.
- Touch targets >= 44pt (see §3). Chips and icon buttons fixed in PR (a).
- Status is never colour alone (icon + text), including budget states, over/under, errors, selected chips (selected chip also gets a check icon).
- Screen reader: every `Money` has a spoken label; segmented control exposes `accessibilityRole='tab'` + selected state; charts get a text summary (`accessibilityLabel`) and the legend list below is the accessible representation.
- Focus order = visual order. Keyboard avoidance already exists via `FormScroll`.
- Contrast verified in `palette.png`.

## 11. Per-screen restyle notes
Legend: KEEP / CHANGE / REMOVE with the reason; file = real file.

### 11.1 Overview (mockup) = Home (`app/(tabs)/index.tsx` -> `features/dashboard/screen.tsx`)
Real today: header (avatar + scope switcher modal), `BalanceCard` (+ add), `ActionTile`s, "Money moving" upcoming (7 days, from `listUpcomingPlanning`), Spent/Income/Transfers strip, goals, spend chart (`CHART_RANGES` 1W/2W/1M/3M/1Y; it is a **spend** chart, not a balance chart), activity dots, filters + search + `TransactionCard` list, configurable via `lib/dashboard-layout.ts` (new ids are auto-appended by `parseDashboardLayout`).
| Mockup element | Decision | Reason / how |
|---|---|---|
| Greeting "Good evening" | KEEP | local clock only |
| "V1.4.2 ENCRYPTED • 12MS" pill, "Personal Ledger" dropdown | REMOVE pill; KEEP dropdown as **Group switcher** (existing `Modal` in `dashboard/screen.tsx`) | fake status; scope switch is real |
| Net Liquidity hero + "+$3,240 (+7.1%)" | CHANGE: **Total balance**, per-currency lines (Task 4 §12). Delta pill only when computable: change in the displayed currency over the selected range from transactions, else hidden | real data only |
| Line chart 1D/1W/1M/YTD/ALL | CHANGE (v1): keep the existing **spending** chart with ranges 1W/1M/3M/1Y; add YTD/All to `CHART_RANGES`. A **balance-over-time** line (Monarch idea) is computable client-side (running sum of `transactions`, single currency) and is a stretch item in PR (d); 1D is dropped (manual entries, too sparse) | avoid fake precision |
| Assets vs Debts bar ($64k / 81% vs $15k / 19%) | CHANGE: `StackedBar` **What you own / What you owe** for the primary currency (accounts > 0 vs debts `i_owe` + negative accounts, `getNetWorthSnapshot`), link to the existing Net worth screen | real |
| 30D Inflow / Outflow cards | KEEP as **Money in / Money out (last 30 days)** in primary currency; REMOVE "Salary + 2 Invoices" and "Burn optimal / Safe" labels unless computed from a budget | invented text |
| Net savings ring "54.8% Top Tier" | MOVE to Insights as "Saved X% of income"; remove rank | |
| Smart Velocity Insight | REMOVE | AI claim |
| Upcoming Commitments | KEEP as **Upcoming bills**: horizontal cards (title, amount, "Due tomorrow"/date) from `listUpcomingPlanning` (exists); expenses only in the title "bills", incomes labelled "Expected" | |
| **Safe to spend** (new, KEEP per decision) | NEW card under the hero. **Definition** (all primary-currency, computed locally): `spendable = sum of balances of accounts with type cash/bank/wallet (credit excluded)`, `committed = sum of upcoming expense items (recurring + subscriptions) due from today to end of the current month`, `safe = spendable - committed`; also show per day = `safe / days left in month` (floored at 0). Copy: "Safe to spend this month: $X ($Y a day)". If `safe < 0`: negative state "Bills due this month exceed your balance by $X" (icon + text). Footnote "Based on your balances and recurring items." Pure fn `computeSafeToSpend` in `lib/planning.ts` with tests. **[DECISION: Sandesh]** confirm formula (goal set-asides and expected income are NOT included in v1) |
| Activity list + filter chips (All / Personal / Studio Org / Transfers) | KEEP list; filters = existing type chips (All/Expense/Income/Transfer, `typeFilter`) + the Group switcher; rows per §7; tags/status chips REMOVE | |
| Footer "ZERO-KNOWLEDGE LEDGER SYNCHRONIZED" | REPLACE by `StoredOnDevice` ("Stored on this device · Last backup exported: Oct 3") | §9 |
| Tab bar with centre "+" | CHANGE: centre Quick Add button (accent fill, the screen's single glow), tabs Home / Accounts / Insights / More; implemented with `QuickAddProvider` | |
Also remove from Home: `BalanceCard` green FAB and gradient; `ActionTile` gradients; Spent/Income/Transfers strip stays but follows Task 4 §12 rules.

### 11.2 Accounts (`app/(tabs)/accounts.tsx` -> `features/accounts/screen.tsx`, `detail-screen.tsx`)
Real today: title + help text, "Add group" / "Add account" buttons, inline create forms, groups with `AccountCard` (name + "CCY · type", **no balance**), separate edit/trash `IconButton` row under each card, confirm dialog. Account types: cash, bank, wallet, credit, other. Debts, goals and net worth are separate screens under `app/planning/`.
| Mockup element | Decision | Reason / how |
|---|---|---|
| Consolidated card, "+3.4% 30d" | CHANGE: **Total balance** per currency (reuse `BalanceCard lines`); drop the % pill | no history query |
| Gross assets / Liabilities boxes + Debt-to-Asset bar | CHANGE: **What you own / What you owe** + `StackedBar`; subtitle "Owed is N% of what you own" | real: `getNetWorthSnapshot`, `debts` |
| Group pills "Personal / Studio Org" | KEEP as the existing group sections (one section per `account_groups` row, collapsible) | data model = groups |
| Accordion by type (Cash, HY savings, Brokerage, Liabilities) | CHANGE: accordion **per group**, subtotal per currency in the header; type shown as small label (cash/bank/wallet/credit/other) | no savings/brokerage types exist |
| Account row balance, currency tag | ADD: balance via `getAccountBalance` (today missing) + currency chip; credit/negative balances in `expense` colour with `-` | |
| "FX Active", APY pill, accrued interest, live market pill, BTC/ETH, hardware wallet | REMOVE | fake/unsupported |
| Goal row "80% reached" | KEEP as **Goals** section using `goals` (`currentMinor/targetMinor`, `ProgressBar`, text "80% saved"); goal is not an account | |
| Credit card "Pay Now", utilisation % | REMOVE; debts get **Record payment** (opens `planning/debts`, uses `recordDebtPayment`) | no credit limit / due data stored |
| "Autopay pacing" loan bar | REMOVE; debts show `remaining / principal` bar from `debts` | |
| Buttons: + Add Account, Transfer, Rebalance | KEEP Add account, Transfer (opens Quick Add in Transfer mode); REMOVE Rebalance | |
| Footer "Local SQLite Ledger, JSON/CSV" | REPLACE: `StoredOnDevice` + link "Back up or export" to Settings > Data & privacy | |
| Per-card edit/trash icon row | CHANGE: tap row = detail (edit + delete there, existing), long-press = delete confirm (existing); remove the extra icon row (40pt targets, noisy) | |
States: empty ("Create a group to get started" exists -> `EmptyState` + button), loading skeleton rows, error inline.

### 11.3 Insights / Analytics (`app/(tabs)/insights.tsx` -> `features/insights/screen.tsx`)
Real today: Spent/Earned card with savings rate + prior-period delta, "Recurring vs flexible" (matches transaction titles to recurring templates), "vs prior period" category deltas, spend area chart, day-by-day bars, calendar, **by-category donut already exists** (`CategoryDonut` + legend). Range chips 7d/14d/30d/90d/1y plus month/year. Budgets live on `planning/budgets` (with `getBudgetSpend`, `budgetStatus`); subscriptions on `planning/subscriptions` (`subscriptionMonthlyMinor` in `lib/forecast.ts`).
| Mockup element | Decision | Reason / how |
|---|---|---|
| Month selector "October 2024" + FILTERS, Monthly/Quarterly/YTD/Custom tabs | CHANGE (small): keep existing ranges; relabel month/year chips "This month"/"This year"; month prev/next arrows are a stretch item | exists in part |
| Velocity Index 92/100, Pacing -14%, projected surplus | REMOVE | invented score, forecast claim |
| Outflow Radar donut + category rows | CHANGE -> **Spending by category**: keep `CategoryDonut`; add centre label "Total spent $X"; rows = `CategoryGlyph`, name, amount, % of total, delta vs prior period chip (`categoryDelta` exists, text "+12%" with arrow icon). "Fixed"/"Deductible" tags REMOVE. Secondary small cards -> list rows (top 6 + "Other") |
| Pacing Guardrails | CHANGE -> **Budgets** section (top 3 by ratio) using `BudgetBar` (within / near >=80% / over, icon+text), "N over budget" summary pill, "Change limit" -> `planning/budgets`. Real data only; empty state "Set a budget to see it here" |
| Recurring Radar grid | CHANGE -> **Subscriptions**: total "$X per month · N active" (`subscriptionMonthlyMinor`), 2-col cards (name, price, "Renews Nov 2" from `nextBillingAt`). REMOVE "Save 20%" and the "Audit & Cancel Unused Subs" CTA (future spec) |
| Net Savings ring | KEEP as small card "Saved X% of income" (existing `savingsRate`) |
| Existing "Recurring vs flexible", trend, day-by-day, calendar | KEEP, restyle with tokens; rename "Recurring vs flexible" -> "Repeating vs one-off" and keep its footnote ("matched by title") |
| Header avatar + "Trends, categories, calendar" | CHANGE subtitle -> "Where your money goes" |
States: no data -> `EmptyState`; each section independently handles empty; charts have text summaries.

## 12. PR breakdown (restyle)
Order and dependencies. Each PR small, reviewable by Kho, no behaviour change unless stated. Prereqs: Task 1 (money parser) before (b); Task 3 (`DateField`, `category-picker`) before (b); Task 4 (`TransferAmountFields`, Home grouping) before (b)'s transfer mode and (c)/(d); `meta/0004_snapshot.json` before any migration.

### (a) Theme tokens + shared components
Scope: `constants/palette.ts`, `tailwind.config.js`, palette/tailwind drift test, replace hard-coded hexes (§1.5), `AppText numeric`, NEW `Money`, `SegmentedControl`, `StatusPill`, `BudgetBar`, `StackedBar`, `Skeleton`, `StoredOnDevice`, `useReducedMotion`, `lib/color.ts ensureContrast`; restyle `primitives.tsx`/`cards.tsx`/`toast.tsx`/tab bar colours; 44pt targets; `SectionHeader` casing; classify `accent` usages; light theme derived.
Acceptance:
- [ ] Palette values match §1.2/§1.4 exactly; unit test asserts `palette.ts` == `tailwind.config.js`.
- [ ] No hard-coded hex remains in the files listed in §1.5 (grep check in the PR).
- [ ] Every `c.accent`/`bg-accent` usage reviewed: selected/interactive stays accent, "good" uses `income`.
- [ ] Contrast unit test: all text/surface pairs in `palette.png` >= 4.5:1 (graphics >= 3:1) in both schemes.
- [ ] `Chip`, `IconButton`, `Select` rows, tab items >= 44pt on a 667pt-high screen; test with `Math.max(44, vs())`.
- [ ] No glow/shadow on `SurfaceCard`/`BalanceCard` in dark; only `Button prominent` has the one soft shadow.
- [ ] `Money` renders tabular-nums and a spoken label; used by `TransactionCard` and `BalanceCard`.
- [ ] Reduced motion disables donut spring and sheet slide.
- [ ] `bun run check`, `bun run type-check` pass; light and dark both smoke-tested.
User after: sees the new dark look (and a matching light look) across the app with consistent, readable numbers, bigger tap targets, and no flashy glows.

### (b) Quick Add
Scope per `quick-add.md` (add-sheet rewrite, keypad, budget pill, chips, presets, transfer mode via Task 4, `QuickAddProvider` + centre tab button, `expo-haptics`, migrations for presets if approved).
Acceptance: see `quick-add.md` §15.
User after: logs an expense in under 5 seconds with last-used account/category, sees whether it fits the budget before saving, repeats the last entry or saves a preset, from any tab.

### (c) Accounts
Scope: `features/accounts/screen.tsx`, `detail-screen.tsx`, `cards.tsx` `AccountCard`, `BalanceCard lines`, `StackedBar`, goals/debts sections, `StoredOnDevice`.
Acceptance:
- [ ] Each account row shows its balance (`getAccountBalance`) and currency; credit/negative balances use `expense` + `-`.
- [ ] Group header shows per-currency subtotal; no cross-currency sums anywhere on the screen.
- [ ] "What you own / What you owe" bar uses `getNetWorthSnapshot`; text values present; hidden when both zero.
- [ ] None of the removed items from §11.2 appear (Pay Now, APY, FX Active, Rebalance, Synced, etc.); grep for the strings in §9 returns nothing in `src/`.
- [ ] Edit/trash icon row removed; row tap -> detail; long-press -> confirm remove (existing behaviour kept).
- [ ] Empty (no groups, group without accounts), loading skeleton and error states implemented.
- [ ] "Transfer" button opens Quick Add in Transfer mode.
User after: sees every account's balance at a glance, grouped by currency, what they own vs owe, and can jump straight to adding an account or a transfer.

### (d) Overview (Home)
Scope: `features/dashboard/screen.tsx`, `lib/dashboard-layout.ts` (new card ids `safeToSpend`, `ownOwe`; rename labels), `computeSafeToSpend`, upcoming bills restyle, Money in / Money out, `StackedBar`, footer, range chips (YTD/All), Task 4 §12 grouping (if not already merged), optional balance-over-time line.
Acceptance:
- [ ] Hero shows per-currency balances; Safe to spend card matches the §11.1 formula (unit tests: credit accounts excluded, bills after month end excluded, negative result state, zero-days-left guard).
- [ ] "Upcoming bills" lists `listUpcomingPlanning` items with plain due labels; empty state "No bills coming up".
- [ ] Money in / Money out (30 days) match the sum of income/expense rows in the primary currency.
- [ ] Activity rows follow §7; transfer rows neutral colour; no status tags.
- [ ] No fake status text anywhere (grep list in §9); footer shows only true statuses.
- [ ] `parseDashboardLayout` still loads layouts saved before this PR (old ids kept, new ids appended).
- [ ] Skeleton while loading; empty states for no accounts / no transactions; one glow only (centre +).
User after: opens the app and immediately sees total balance per currency, how much is safe to spend, bills coming up, and a clean recent activity list.

### (e) Insights
Scope: `features/insights/screen.tsx`, `components/charts/widgets.tsx`, `BudgetBar`, subscriptions grid.
Acceptance:
- [ ] "Spending by category": donut with centre total, rows with amount, % and delta vs previous period (icon + text); colours pass `ensureContrast`.
- [ ] "Budgets" shows top budgets with correct state thresholds (>=80% near, >=100% over, reuse `budgetStatus`), icon + text, "Change limit" opens budgets.
- [ ] "Subscriptions" shows monthly total and renewal dates from `subscriptions`; no cancel/audit CTA.
- [ ] No Velocity Index, no "Smart/AI" text, no "Fixed/Deductible" tags.
- [ ] Charts respect reduced motion; each chart has a text summary for screen readers.
- [ ] Amounts in a single (scope) currency; entries in other currencies are excluded with a muted count (consistent with Task 4 §12).
User after: sees where the money went this period, which budgets are on track or over, and what subscriptions cost per month.

## 13. Future specs (stubs only, not part of this restyle)
- **Analytics page** (full): month navigator, quarterly/custom range, trends per category, saved reports.
- **Subscriptions audit**: flag unused/duplicate subscriptions (needs usage signals the app does not have), cancel reminders only.
- **Split bill** (Splitwise idea): participants, shares, "who owes whom", settle-up as transfers/debts.
- **Tags beyond today**: today tags are only stored via a comma-separated field in Add (`features/transactions/add-sheet.tsx`) with `listTags`/`tagId` filter in queries but **no tag UI** anywhere; needs tag chips, filter and management.
- **Merchant autocomplete** from the user's own history ("last time: Food & Drink").
- **Balance over time / net-worth history** chart (Monarch) with snapshots.
- **Category reorder** and category budgets inline.
- **Month navigator** and quarterly/YTD/custom ranges.

## 14. Open decisions
| # | Decision | Owner | Default if no answer |
|---|---|---|---|
| 1 | Keep light theme derived from tokens (A) or drop it (B) | Sandesh | A |
| 2 | Brand accent changes green -> sky blue (app icon/splash/logo under `assets/images/brand/` are the old brand; unchanged unless asked) | Sandesh | Accept blue in-app; leave assets |
| 3 | Expenses shown in primary text colour (not red) in lists | Sandesh | Neutral |
| 4 | Adopt Hanken Grotesk (font dependency) | Sandesh | Keep system font |
| 5 | Haptics dependency + Settings toggle | Sandesh | Add, default on |
| 6 | Safe to spend formula (§11.1) | Sandesh | As written |
| 7 | `last_backup_at` column vs SecureStore key | Tom | Column after `0004` snapshot is committed |
| 8 | Centre "+" tab button and lifting Quick Add into a provider | Tom | Yes |
