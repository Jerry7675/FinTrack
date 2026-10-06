# Quick Add: screen spec (restyle of `AddTransactionSheet`)

Owner: Dom (UI/UX). Status: DRAFT for GO / Kho / Tom / Sandesh. Built from the real `src/features/transactions/add-sheet.tsx` (431 lines) @ `Jerry7675/FinTrack` `0164fd9`. The Quick Add mockup is a reference only.
Tokens, components and glossary: `design-system.md` (use its token names; no new colours here). Money parsing: Task 1. Transfer fields and rate: `task4-cross-currency-transfer.md` (`TransferAmountFields`). Date field and category picker extraction: `task3-edit-transaction.md`.
Items marked **[DECISION: Sandesh]** are open.

**Goal: logging a typical expense takes under 5 seconds** (open, type amount, tap Save). Everything else is pre-filled from the user's own history (last-used account, last-used category, last title for that category) or one tap away (Repeat last, presets).

## 1. What exists today (verified)
- `AddTransactionSheet` is a `Modal` (`animationType='slide'`, `presentationStyle='pageSheet'`) rendered by `features/dashboard/screen.tsx:634` and opened from `BalanceCard`/`ActionTile` (`setAddOpen(true)`). It exists only on Home; other tabs cannot add.
- Form: `react-hook-form` + `zod` (`formSchema`). Mode `Chip`s Expense/Income/Transfer; `Field` Amount (system `decimal-pad`), Title, `Select` Account (labels `"{name} · {CCY}"`), `Select` To account (transfer), category row (`Pressable` + `CategoryGlyph` + name, **not** ordered by use; on every open/mode change it auto-selects `rows[0]` of `listCategories`, i.e. the first by `sortOrder`), Note, Tags (comma-separated text), Receipts (Gallery, Camera, up to 8, plus a placeholder button "Scan receipt (OCR soon)"), footer "Currency: {account ccy}", `Button` Save.
- Save: `Number.parseFloat(values.amount)` (so `1,50` becomes `1`), then `createTransaction` / `createTransfer`; title required for expense/income; attachments are added by a second call after the transaction is inserted (not atomic); no `catch` (only `try/finally`), so DB errors are unhandled; picked receipt files are copied to app storage immediately (`persistImage`) and are never deleted if the sheet is closed without saving.
- Account default = `settings.activeAccountId || accounts[0]` (Home scope, not last used). `useApp().accounts` contains live (non-deleted) accounts only.
- Budgets: `listBudgets` (`lib/db/queries.ts:541`), `getBudgetSpend` (`:583-619`, sums current-period `expense` rows for the budget's category and optional account), `budgetStatus` (`lib/planning.ts:48`: >= 80% `approaching`, >= 100% `exceeded`), `budgetPeriodBounds`. `getBudgetSpend` does **not** filter by currency (it will add EUR and USD expenses together).
- No presets, no category-usage data, no haptics (`expo-haptics` not installed), no custom keypad, no date picker (Task 3 adds `DateField`).
- Tags: stored (`tags`, `transaction_tags`, `attachTags`) but there is no UI to browse or filter them. Receipts: exist (add + detail screens).
- App is portrait-only (`app.json`).

## 2. Files touched
| File | Change |
|---|---|
| `src/features/transactions/add-sheet.tsx` | Rewrite into the layout below (keep file/export name `AddTransactionSheet` so `dashboard/screen.tsx` import survives; later mounted from `QuickAddProvider`). |
| `src/features/transactions/keypad.tsx` (new) | `Keypad`, `AmountDisplay`, pure `keypadReducer`, `formatKeypadDisplay` (unit-tested). |
| `src/features/transactions/category-picker.tsx` | Task 3 extracts it; here add `usage` ordering + "All categories" chip. |
| `src/features/transactions/transfer-amount-fields.tsx` | Task 3/4; reused in Transfer mode. |
| `src/components/ui/segmented.tsx`, `status-pill.tsx`, `date-field.tsx`, `money.tsx` | from `design-system.md` PR (a) / Task 3. |
| `src/providers/quick-add-provider.tsx` (new), `src/app/(tabs)/_layout.tsx` | Centre "+" tab button opens the sheet from any tab; `dashboard/screen.tsx` stops owning it. **[DECISION: Tom]** |
| `src/lib/db/queries.ts` | NEW `listCategoryUsage`, `getLastEntry`, `getLastEntryForCategory`, `loadBudgetFeedback`; presets CRUD; fix `getBudgetSpend` currency (below); atomic create+attachments. |
| `src/lib/db/schema.ts` + migration `0005` + `migrations.js` + `_journal.json` | NEW table `quick_presets` (below). Prerequisite: commit missing `meta/0004_snapshot.json` first (verified: otherwise `drizzle-kit generate` emits a spurious duplicate migration). |
| `src/lib/backup/index.ts` | Include `quickPresets` in backup payload as an OPTIONAL field; restore treats absence as `[]` (older backups must still import; `schemaVersion` check is strict equality today, so do not bump it). |
| `src/lib/validation.ts` | `quickAddSchema` operating on integer `amountMinor` (not `number`). |
| `src/lib/planning/materialize.ts:150`, `features/widgets/update.tsx:84`, `features/settings/screen.tsx:92`, `features/budgets/screen.tsx:72` | callers of `getBudgetSpend` updated for the currency filter. |
| `package.json` | `expo-haptics` via `bunx expo install expo-haptics`. |

## 3. Layout, top to bottom
`Modal` (keep `pageSheet`; `animationType` `'slide'`, or `'fade'` if reduced motion) > `surface` background > gutter 20. Portrait, safe-area top inset respected (existing `useSafeAreaInsets`). Zones:

**Pinned top** (never scrolls):
1. **Header row** (48): close `IconButton` (X, 44pt, left; if dirty asks "Discard this entry?" via `ConfirmDialog confirmLabel='Discard'`), title "Add" (`lg`), nothing on the right. (Mockup's avatar and "ENCRYPTED LOCAL VAULT / WAL Synced" status line are removed; design-system §9.)
2. **Segmented control** `SegmentedControl` Expense | Income | Transfer (icons arrow-up / arrow-down / swap). Replaces three `Chip`s. Selected = accent-soft fill + accent text + icon.
3. **Amount block**:
   - Left: **currency chip** showing the selected account's code (e.g. `USD`). Currency is derived from the account in this app, so the chip is a shortcut that opens the Account `Select`; label "Currency USD, from {account}. Double tap to change account". (Mockup's free currency dropdown and "≈ €114.28 FX LIVE" are removed: live FX is out.)
   - `AmountDisplay`: `display` size, tabular-nums, locale grouping and decimal separator, placeholder `0` in `text-muted`. Expense/income tint: none (neutral `ink`); mode is already visible in the segmented control. Cursor: static caret-line (no blink when reduced motion).
   - Helper/error line under it (`sm`): empty; or "Amount must be more than 0"; or "Largest amount is {format(MAX_MINOR)}".
4. **Budget pill** (`StatusPill`, expense mode only, only when a matching budget exists; otherwise the zone collapses to 0 height). Section 5.

**Scrollable middle** (`ScrollView`, `keyboardShouldPersistTaps='handled'`): 
5. **Quick row** (hidden if both parts are empty): `Chip`-style items, horizontal scroll: `Repeat last` (icon repeat, text `Repeat last · {title} {amount}`, only when a previous entry of this mode exists), then preset chips (§9). 44pt each.
6. **Category chips** (Expense/Income; hidden in Transfer): section label "Category" (`sm` muted); horizontal row of chips: `CategoryGlyph` 28 + name, 44pt min; selected = accent outline + accent-soft fill + check; last chip "All categories" opens a `Select` sheet with the full list. Order §6.
7. **Details card** (`SurfaceCard` padding 0, rows 52 with hairline dividers):
   - **Account** row (label "Paid from" for expense, "Deposit to" for income): value `"{name} · {CCY}"` + muted balance (`getAccountBalance`), chevron; opens `Select`.
   - **Date** row: "Today" / "Yesterday" / "Oct 1"; opens `DateField` (Task 3 component; future dates blocked).
   - **Title** row: inline `Field` (no label inside the card; placeholder "Where or what? (optional)"); beneath it, when the selected category has a previous entry: one suggestion chip `Last time: {title}` (fills the field). Optional in Quick Add: empty title is saved as the category name (e.g. "Food & Drink"); transfers default to "Transfer". **[DECISION: Sandesh]** (today title is required, `add-sheet.tsx` "Add a title").
   - **More details** row (collapsed by default; chevron). Expanded: `Note` (multiline, <= 500), `Tags` (comma-separated, <= 10 tags, each <= 40, as today; helper "e.g. trip, work"), `Receipts` (Gallery / Camera buttons, thumbs via `ReceiptThumb`, max 8, tap thumb to remove). **"Scan receipt (OCR soon)" is removed** (placeholder for a feature that does not exist).
   - There is no separate "Ledger / Personal-Studio Org" toggle: group is part of the account (Select options show `"{group} · {name} · {CCY}"`, sorted by group).
   - Split Bill: not in this restyle (future spec).
8. **Transfer mode** replaces items 6-7 with: From account `Select`, To account `Select`, `TransferAmountFields` (same currency: single amount; different: "You send ({FROM})", "They receive ({TO})", "Exchange rate" with the `1 FROM = r TO` caption, Wise-style), Date, Title (default "Transfer"), More details (Note only). Category, tags, receipts, budget pill and "Last time" hidden. Rules in `task4-cross-currency-transfer.md` §3-§5. In cross-currency mode the keypad types into whichever of the three fields is focused (tap a field to make it the active keypad target; active target has the accent outline).

**Pinned footer**:
9. **Keypad** 4 rows x 3: `1 2 3 / 4 5 6 / 7 8 9 / [decimal] 0 [backspace]`. Keys = `surfaceHigh` fill, radius 14, `lg` tabular digits; height `clamp(44, availableHeight/6, 56)`; gap 8. Decimal key shows the locale decimal separator (`.` or `,`) and is hidden (empty spacer) for currencies with 0 decimals (JPY). Backspace icon key (`backspace-outline`). Hidden while a text field (Title/Note/Tags/rate-less fields) has focus; the system keyboard is used there; tapping the amount hides it again.
10. **Action row** (44-52pt): `[bookmark]` icon button = Save as preset (44x44, secondary) | `Save & new` (secondary `Button`, ~110 wide) | `Save` (primary `Button`, flex; **the single soft glow on this screen**, design-system §3). Disabled states use `opacity .4` plus `accessibilityState={{disabled:true}}`. Buttons are in the footer so they stay above the system keyboard.
(Obsidian "gradient + glow + 'Commit to SQLite Ledger'" is replaced by solid accent `Save`.)

Height budget (iPhone SE 667pt, ~20 top inset): pinned top ~200 + keypad 4x44+24 = 200 + action row 52 = ~452, leaving ~195pt scroll area for chips and the details card (scrolls). On tall phones the keypad keys grow to 56. If the content area would be < 120pt, the keypad collapses behind an "Open keypad" handle.

## 4. Amount entry (keypad) rules
State: `amountText` canonical string with `.` as the decimal separator, regardless of locale. Reducer rules (pure, unit-tested):
- Digit: `""` + `0` -> `"0"`; `"0"` + `d` (1-9) -> `d` (no leading zeros); otherwise append.
- Decimal: ignored if currency decimals = 0 or already present; `""` -> `"0."`.
- Fraction digits capped at the account currency's decimals (`getCurrency(code).decimals`, `lib/money/index.ts`); extra taps ignored with error haptic.
- Integer digits capped so the value never exceeds Task 1's `MAX_MINOR` (11 integer digits for 2-decimal currencies at the recommended 10^13 minor, 13 for JPY); extra taps ignored with error haptic and the "Largest amount is ..." line.
- Backspace removes the last character; result `"0"` becomes `""`. **Long-press backspace (>= 500ms) clears everything** (medium impact haptic).
- Display: `formatKeypadDisplay(amountText, currency, locale)` groups the integer part with locale separators, uses the locale decimal separator (from `Intl.NumberFormat().formatToParts(1.1)`, fallback `.`), shows only the fraction digits typed so far, and shows a trailing separator after the decimal key ("12,").
- Parsing for save: `parseAmountToMinor(amountText, currencyCode)` (Task 1) is the only path to minor units; keypad output is canonical, but the parser stays the authority (decimal string -> integer minor units, no floats). Locale input `1,50` is covered because the system keyboard is never used for the amount.
- Changing the account to a currency with fewer decimals while a fraction is typed (e.g. USD 12.50 -> JPY): the fraction is cleared (never rounded) and a toast says "JPY has no decimals, amount adjusted".
- Haptics (`expo-haptics`, if the Settings toggle is on): key press `selectionAsync`; blocked press `notificationAsync(Error)`; Save success `notificationAsync(Success)`; clear `impactAsync(Medium)`.
- Accessibility: the amount is a non-editable `Text` with `accessibilityRole='text'`, `accessibilityLiveRegion='polite'` and label "Amount, 12.50 US dollars". Keys: `accessibilityRole='button'`, labels "1".."9", "0", "decimal point" / "comma", "Delete last digit" (hint "Long press to clear all"). Keys >= 44pt; `maxFontSizeMultiplier=1.2`.

## 5. Budget feedback pill (real data only)
Data (loaded once on open and after each save): `listBudgets(db)` + `getBudgetSpend(db, b)` for budgets whose `categoryId` is an expense category -> `Map<categoryId, {budget, spentMinor}[]>` (`loadBudgetFeedback`). No per-keystroke queries; the pill recomputes synchronously from the map.
Which budget: expense mode, selected category `C`, selected account `A`, currency `K` (A's currency). Candidates = budgets with `categoryId == C` and (`accountId == null` or `== A`). Among candidates in currency `K` pick the one with the **least remaining** (limit - projected). If candidates exist but none are in `K`: show the neutral info pill "Your {name} budget is in {BUD}. This entry isn't counted." (no FX conversion, ever). No candidates: no pill.
Projected spend = `spentMinor + amountMinor` if the amount is valid, else `spentMinor`. Status = `budgetStatus(projected, limit)` (reuse; thresholds 80% / 100%). All integer minor-unit math; "left" = `limit - projected`.
| State | Condition | Tone / icon | Copy (period word = this week / month / year) |
|---|---|---|---|
| Within | projected < 80% | `income` soft / check-circle | amount typed: "Within your {name} budget. {left} left after this." No amount yet: "{left} left in your {name} budget this month." |
| Near limit | 80% <= projected < 100% | `warning` soft / alert-circle | "Close to your {name} budget. {left} left after this." |
| Over | projected >= 100% | `expense` soft / warning triangle | "This puts you {over} over your {name} budget." If already over before typing: "Already {over} over your {name} budget this month." |
| Other currency | see above | info soft / information-circle | text above |
Never blocks saving. Colour is never the only signal (icon + text; also announced via live region). Name = `budget.name` (falls back to the category name). Pill is a `StatusPill`, wraps to 2 lines at large font sizes.
Bug fix required here: `getBudgetSpend` (`queries.ts:583-619`) must also filter `transactions.currencyCode = budget.currencyCode` (extend the param type with `currencyCode`; update the four callers listed in §2). Without it the pill and every budget screen mix currencies.

## 6. Category chips: recent / most-used first
Query `listCategoryUsage(db, kind, sinceDays = 90)`: per non-deleted category, `count(*)` and `max(occurredAt)` of non-deleted transactions of that type in the last 90 days (index `tx_account_occurred_idx` / table is local and small; fine to scan). Order: (1) the category of the most recent entry of this type, (2) remaining by `count` desc then `lastUsedAt` desc, (3) never-used categories by `sortOrder` (existing). The first chip is **pre-selected** (replaces today's silent `rows[0]`), shown clearly selected; the user sees and can change it. Ideas: Copilot / Revolut ordering. Deleted categories are excluded (`listCategories` already filters `deletedAt`); a deleted last-used category falls through to the next. If no category exists for the kind: row shows "No categories yet" + "Add category" (`/categories`), Save is allowed with `categoryId = null`.
Per-category memory (no new storage, derived from history): selecting a category sets Account to the account last used with that category (`getLastEntryForCategory`) unless the user already changed the account manually in this session, and offers the "Last time: {title}" suggestion.

## 7. Defaults (the "under 5 seconds" part)
- **Account**: if Home is scoped to one account (`settings.activeAccountId`), use it (explicit user intent); otherwise the account of the most recent non-deleted entry of the same mode (`getLastEntry`); otherwise the first account. A soft-deleted last-used account is skipped. Transfer: From = last transfer's from-account (or active/first), To = last transfer's to-account if still valid.
- **Type**: Expense. **Date**: today (time-of-day = now when saved). **Category**: first chip (§6). **Title**: empty (-> category name). **More details**: collapsed.
- **Repeat last**: prefills type-specific fields from the last entry of this mode (amount, category, account, title; not note, receipts, or tags). Does NOT save; the user taps Save (2 taps total).
- **Save & new**: saves, toast "Saved", clears amount/title/note/tags/receipts, keeps mode, account, category and date, refreshes budget map, keeps keypad focus. Haptic success.

## 8. Save behaviour
1. Validate (§10). On failure: haptic error, inline message, no write.
2. `saving = true` (buttons disabled; ignore re-taps).
3. Expense/income: one DB transaction = insert transaction + tags + attachments (today these are separate calls). Transfer: `createTransfer` per Task 4 (`sentMinor`, `receivedMinor`). Title fallback applied. `occurredAt` = selected date + now's time-of-day (or exact now for today).
4. Success: toast "Saved" (success tone), `bumpData()`, `refresh()`, widget snapshot refresh (`updateWidgetSnapshot`, as `dashboard/screen.tsx:641-644` does), close sheet (Save) or reset (Save & new). Presets: if the entry was started from a preset, `use_count += 1`, `last_used_at = now`.
5. Failure: `catch` -> toast "Couldn't save. Your entry is still here." (error tone), fields preserved, `saving=false` in `finally`. If receipts fail, the transaction is rolled back with the DB transaction (no half-saved state).
6. Close without saving: if `amountText` non-empty or any field changed -> "Discard this entry?" ; on discard, delete pending receipt files (`deleteLocalImage`, `lib/media/index.ts:70`) that were copied but never attached.

## 9. Presets ("Save as preset")
Idea source: Copilot/Revolut recurring-style quick entries, kept local and manual.
- **Bookmark button** (footer, 44pt): enabled when a category is chosen (or both accounts in Transfer mode). Opens a small dialog (`ConfirmDialog` style, overlay surface): `Field` Name (prefilled with title or category name, <= 30 chars), `Switch` "Include amount" (default on when amount > 0; disabled with note "Cross-currency amounts aren't saved" for cross-currency transfers), buttons Cancel / Save preset. Max **12** presets; at 12: toast "You can keep up to 12 presets. Long-press one to delete."
- **Stored** in NEW table `quick_presets`: `id` text pk, `name` text, `type` ('expense'|'income'|'transfer'), `account_id`, `to_account_id`, `category_id` (nullable), `amount_minor` (nullable integer), `currency_code`, `title`, `note`, `use_count` int default 0, `last_used_at` (ms, nullable), `sort_order` int default 0, plus the standard `created_at/updated_at/deleted_at` timestamps; index on `type`. SQL hand-written for `0005` (+ journal + `migrations.js`). **[DECISION: Tom]** table vs JSON in `settings`; table recommended (queryable, restorable, soft-delete consistent). Included in backups as optional `quickPresets`.
- **Chips**: in the Quick row after Repeat last, ordered `use_count` desc, `last_used_at` desc; chip text = name (+ amount when stored, `Money`). Tap = apply fields (type switches to preset type). Long-press = ConfirmDialog "Delete preset?" (soft delete).
- **Stale references**: if the preset's account/category was removed, apply the valid parts, leave the invalid field empty with an error highlight and toast "Some details in this preset were removed. Check the highlighted fields."

## 10. Validation rules
| Field | Rule |
|---|---|
| Amount | `parseAmountToMinor` result must be an integer `> 0` and `<= MAX_MINOR`; zero and empty disable Save; no negatives (keypad has no sign); decimals <= currency decimals. |
| Account | required, live (`useApp().accounts`); For Transfer both required and different (Task 4). |
| Category | required when >= 1 category of the kind exists; else `null` allowed. |
| Date | valid, <= end of today, >= 2000-01-01 (same as Task 3). |
| Title | <= 120; empty -> category name (transfer: "Transfer"). |
| Note | <= 500, trimmed, empty -> `null`. |
| Tags | <= 10, each 1-40 chars, lower-cased and de-duplicated (matches `attachTags` and `transactionInputSchema.tagNames`). |
| Receipts | <= 8 images (existing cap). |
| Transfer | sent > 0, received > 0 (cross-currency), rate rules per Task 4 §4. |
Zod schema works on integer `amountMinor` + strings; no `z.number()` for money.

## 11. States
- **EMPTY**
  - No accounts (all removed): replace body with `EmptyState` "Add an account to start" + `Button` "Add account" (closes the sheet, `router.push('/accounts')`).
  - Transfer with < 2 accounts: `EmptyState` "You need two accounts to transfer" + "Add account" (Task 4 §8).
  - No categories for the kind: see §6. No budgets: no pill. No history: no "Repeat last", no suggestions. No presets: nothing extra.
- **LOADING**: sheet, segmented control, amount and keypad render immediately (accounts come from context). Category chips, budget map, usage, last entry load together (one `Promise.all`, typically < 50ms locally): chip zone shows 4 `Skeleton` chips; **Save is disabled until the context has loaded** (prevents saving under a wrong default category). Saving state: `Button loading` on the pressed button, others disabled.
- **ERROR**: context load failed -> inline `negative-soft` banner in the chip zone: "Couldn't load your categories." with `Try again` and `Continue without category`; amount entry still works. Save failure: toast + preserved input (§8). Validation: inline text + haptic error. Never show raw error strings.
- **Offline**: not applicable; Quick Add makes no network calls. No analytics or tracking calls are added (the app has none).

## 12. Edge cases
- No accounts yet / all accounts removed: §11 EMPTY. Account removed while sheet is open: `accounts` context updates; if the selected account vanished, fall back to §7 default and toast "That account was removed".
- Archived account: the app has no archive, only soft-delete (`accounts.deletedAt`); same handling as removed. Presets/last-used pointing to it are skipped.
- Zero amount: Save disabled, helper "Amount must be more than 0". Entering `0.00` stays zero.
- Huge amount: keypad blocks digits beyond `MAX_MINOR`; message shown; no overflow reaches the DB.
- Category deleted: excluded from chips; pre-select falls to next; presets with a removed category: §9.
- Budget in another currency: info pill, not counted (§5). Budget bound to a different account: ignored for this account. Several budgets for one category: tightest one shown.
- Currency change by switching account: §4 decimals rule; budget pill recomputed.
- Rapid double tap on Save / Save & new: `saving` guard, single insert.
- Mode switch with data entered: amount and account kept if valid, category re-picked from the new kind's first chip, To account cleared when leaving Transfer; no data is silently discarded (title/note kept).
- Date: defaults to today; changing it does not alter budget pill (pill uses current-period spend; an entry dated outside the current period shows a muted note "Dated outside this budget period; not counted" and no status). 
- Large font / small phone: keypad keys keep >= 44pt; scroll area shrinks; amount scales to a 1.2x cap; pill wraps.
- Landscape: app is portrait-only.
- Back button (Android) / swipe-down: same discard confirm as the X.

## 13. Accessibility
- All targets >= 44pt (`Math.max(44, vs(n))`; see design-system §3 on `vs()` shrinking below 44pt on short phones).
- Reading order: close, mode, currency, amount, budget status, quick row, category, details, keypad, actions.
- Budget status and errors announced via live regions; status is icon + text, never colour alone; selected chip shows a check, not only a colour.
- Dynamic type: amount/keypad/chips capped at 1.2-1.3x, the rest wraps; test at 200% on a 667pt device.
- Reduced motion: no slide, no shake, no spring; haptics unaffected.
- VoiceOver/TalkBack can complete the whole flow with the keypad (it is buttons, not a gesture surface).

## 14. Open items needing Sandesh
1. Optional title with category-name fallback (§3).
2. Expenses/income are not tinted on the amount (neutral) and expense rows are neutral in lists (design-system §6).
3. Centre "+" tab button and Quick Add available from every tab (§2).
4. Presets: max 12, stored in a new table (§9); "include amount" default.
5. Haptics dependency and a Settings toggle (default on).
6. Whether "Save & new" keeps the date (currently yes) or resets to today.
7. Split Bill and merchant autocomplete are future specs, not in this restyle.

## 15. Acceptance checklist (GO)
Layout & style
- [ ] Order top to bottom exactly as §3; pinned top, scrollable middle, pinned keypad + actions; solid accent `Save` with the single soft glow; no glow on pill, chips, or cards; only tokens from `design-system.md`.
- [ ] Segmented control replaces the three `Chip`s; all touch targets >= 44pt on a 667pt-high device.
- [ ] "Scan receipt (OCR soon)", "FX LIVE", "ENCRYPTED/WAL Synced", "Commit to SQLite Ledger" strings do not exist in `src/`.
Keypad & amount
- [ ] `keypadReducer` unit tests: leading zero, `0.`, decimals cap per currency (USD 2, JPY 0), 11-digit cap, backspace to empty, long-press clear, decimal ignored for JPY.
- [ ] `formatKeypadDisplay` tests: `en-US` ("1,234.5"), `de-DE` ("1.234,5"), trailing separator, empty placeholder.
- [ ] Saved `amountMinor` equals `parseAmountToMinor(canonicalText)` for 100 random values; no `parseFloat`/`toMinorUnits` in the quick-add path.
- [ ] Zero keeps Save disabled with helper; max value blocks digits with message and error haptic.
- [ ] Keypad hides while a text field is focused and returns when the amount is tapped; hardware back/close shows discard confirm when dirty.
Budget pill
- [ ] With a Dining budget of 700 and 542 spent: empty amount shows "158 left"; typing 120 (542+120=662, 94.6%) shows the near-limit state "Close to your Dining budget. 38 left after this."; typing 200 -> over by 42 (verified by unit test against `budgetStatus`).
- [ ] 79.99% vs 80.00% and 99.99% vs 100.00% boundaries use integer math and match `budgetStatus`.
- [ ] Pill shows icon + text for every state; absent when no budget; info pill for other-currency budget; account-bound budget ignored for other accounts; tightest of several budgets chosen.
- [ ] `getBudgetSpend` filters by currency; its 5 call sites compile and tests cover mixed-currency data.
Chips, defaults, speed
- [ ] Category chips ordered per §6 (last used, then 90-day count, then `sortOrder`); first chip pre-selected and visibly selected; deleted categories excluded; "All categories" opens the full list.
- [ ] Default account follows §7 precedence (scoped account > last used for the mode > first); soft-deleted last-used account skipped.
- [ ] Selecting a category sets the account to that category's last-used account unless the user already changed it; "Last time: {title}" fills the title.
- [ ] Opening the sheet, typing 4 digits and tapping Save logs an expense with no other taps (timed manual test under 5 seconds recorded in the PR).
- [ ] `Repeat last` prefills (does not save); `Save & new` keeps mode/account/category/date and clears the rest.
Presets
- [ ] Bookmark creates a preset (name, optional amount); 12 max with message; chips ordered by use; tap applies, long-press deletes with confirm; stale references handled (§9).
- [ ] Migration `0005` creates `quick_presets`; `meta/0004_snapshot.json` exists first; `drizzle-kit generate` reports no pending changes afterwards; backup export includes presets and older backups without them still restore.
Transfer
- [ ] Transfer mode uses `TransferAmountFields` per Task 4 (same currency: one amount; different: sent, received, rate; no auto-copy); needs >= 2 accounts else the EmptyState; budget pill/category/receipts hidden.
Save & errors
- [ ] Expense/income + tags + attachments written in one DB transaction (forced failure leaves nothing behind); `catch` shows the error toast and keeps input; double tap inserts once.
- [ ] Closing with unsaved receipts deletes the copied files; closing dirty asks to discard.
- [ ] After save: `bumpData()`, `refresh()`, `updateWidgetSnapshot()` run; Home updates without manual refresh.
States & a11y
- [ ] EMPTY (no accounts, <2 accounts for transfer, no categories), LOADING (skeleton chips, Save disabled until loaded), ERROR (banner with Try again / Continue without category; save toast) all implemented and screenshot-tested.
- [ ] Screen reader pass: amount label, key labels, budget status live region, segmented control state, all buttons labelled; 200% font scale does not clip.
- [ ] Reduced motion honoured (no slide/shake/spring); haptics gated by the Settings toggle.
- [ ] No network calls and no analytics added; `bun run check` and `bun run type-check` pass; light and dark verified.

## 16. What a user can do after this ships
Open Quick Add from any tab and log a typical entry in a few taps (amount on a big keypad, with last-used account and category already chosen), see right away whether it fits their category budget, repeat their last entry or tap a saved preset, and add several entries in a row without leaving the screen.
