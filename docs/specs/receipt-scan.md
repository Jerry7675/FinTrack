# Receipt scan (AI): screen spec (Quick Add add-on)

Owner: Dom (UI/UX). Status: DRAFT for GO / Kho / Tom / Sandesh. Checked against `Jerry7675/FinTrack` main `1f8882f` and PR #10 (`cursor/fix/add-sheet-errors-43d2` @ `4baa243`).
**Depends on `quick-add.md`, which must merge first.** Scan adds a button and a fill step to that sheet and changes nothing else in it. Tokens and copy rules come from `design-system.md` (no new colours). Items marked **[DECISION: x]** are still open. Team decisions applied 2026-10-06: libraries approved, Vercel server function, IP sentence added to consent (v2), output caps, bundle key check.
Ownership: GO owns the extraction design (server function, model, prompt). This spec only fixes the **UI contract**: the fields the app gets back, how each one is validated, and the error kinds.

**Goal: one photo fills amount, date, merchant (title) and a suggested category. The user checks them and taps Save.** Nothing is ever saved without that tap.

## 1. What exists today (verified)
- **No scan feature.** Today there is only a placeholder button, `'Scan receipt (OCR soon)'`, in `add-sheet.tsx` (main and PR #10). `quick-add.md` §3 removes it. This spec adds the real button in a different place (§3).
- **No network code at all.** There is no `fetch`, no API client, no NetInfo/`expo-network`, no analytics, and no server URL in `app.json` `extra`. Receipt scan would be the app's **first network call**.
- **Receipts as attachments already exist.**
  - `pickImage` and `takePhoto` (`lib/media/index.ts`, `expo-image-picker`, quality 0.85) ask for permission and throw `'Photo library permission is required'` / `'Camera permission is required'` if it is refused.
  - `persistImage(uri,'receipt')` copies the picked image to `documentDirectory/fintrack-media/receipt/{id}.{ext}` and adds it to `pendingImages`.
  - On save, `addAttachments(db, txId, [{localPath}])` writes rows to `transaction_attachments`. `ReceiptThumb` shows the thumbnails. `deleteLocalImage` is at `lib/media/index.ts:70`. The limit is 8.
- **Form (PR #10 `formSchema` / `AddTransactionFormValues`).**
  - Fields: `mode`, `amount` (string), `title`, `note`, `tags`, `accountId`, `toAccountId`, `categoryId` (nullable).
  - There is **no `date` field yet**: `quick-add.md` adds the Date row (Task 3 `DateField`).
  - Currency is **not** a form field: it comes from the account (`from.currencyCode`).
  - Errors: field errors go through `setError` and appear inline. Other errors go through `showToast` inside `ModalToastProvider` (`components/ui/toast.tsx`, a toast host inside the native `Modal`).
- **Money.** `parseAmountToMinor(input, code)` (`lib/money/index.ts`) is strict: no floats, it rejects too many decimals and values `>= MAX_MINOR` (1e13), and returns `null` when it fails. It **accepts a leading `-` and returns a negative number**, so the scan path must reject values `<= 0` itself.
  - Note: `quick-add.md` calls this `parseAmountToMinor` (the Task 1 name). Main uses `parseAmountToMinor`, and this spec uses the real name.
- **Categories.** These have `kind`, `name` and `iconKey`. The default expense `iconKey`s are `food, transport, shopping, home, health, entertainment, bills, education, travel, saas, cloud, hardware, internet, office, contractor, marketing, training, domains, other` (`lib/categories/icons.ts`).
- **Settings.** The screen already uses `expo-secure-store` (`PIN_KEY`). It has a "Data & privacy" section. Toggles are `ListRow` + right-hand `AppText muted` "On/Off" + `onPress` (the App lock pattern).
- **Not installed:** `expo-image-manipulator`, `expo-network` (§2).

## 2. Files touched
| File | Change |
|---|---|
| `src/features/receipt-scan/fields.ts` (new) | `RECEIPT_FIELDS`: static field definitions sent to the server (§6.1). This is app code, not user data. |
| `src/features/receipt-scan/client.ts` (new) | `scanReceipt(imageUri, signal): Promise<ScanResponse>`: fetch, 30 s timeout, error sorting (§8), zod check of the response envelope. |
| `src/features/receipt-scan/apply.ts` (new, pure, unit-tested) | `applyScanToForm(fields, ctx)` returns `{ patch, aiFilled, notes }` (§7). |
| `src/features/receipt-scan/consent.ts` (new) | Read/write the SecureStore consent record (§4.3). |
| `src/features/receipt-scan/consent-sheet.tsx`, `source-sheet.tsx`, `scan-panel.tsx`, `scan-banner.tsx`, `ai-filled-badge.tsx` (new) | UI in §3–§9. |
| `src/features/transactions/add-sheet.tsx` (Quick Add) | Header scan button, scan state, `aiFilled` set, fill logic. Save logic is unchanged. |
| `src/features/settings/screen.tsx` | "Receipt scanning (AI)" row in Data & privacy (§4.2). |
| `src/lib/media/index.ts` | NEW `prepareReceiptForUpload(uri)`: resize, re-encode to JPEG and strip metadata (§5.2), written to `cacheDirectory`. |
| `package.json`, `bun.lock` | **Approved:** `bunx expo install expo-image-manipulator expo-network` (resize/strip EXIF; offline pre-check). Bun repo: never npm/npx, no `package-lock.json`; CI runs `bun install --frozen-lockfile`, so `bun.lock` must be committed. **Native modules:** test only on a **new EAS preview build** (`eas.json` `preview` profile). `runtimeVersion` policy is `appVersion` and CD publishes OTA (`eas update`), so **bump `app.json` `version` from `1.0.0` to `1.1.0` in the same PR** (Tom approved); otherwise an OTA could reach old binaries that lack these modules and crash. |
| `server/` (new top-level folder; Vercel project root = `server/`) | GO's server function (e.g. `server/api/scan-receipt.ts`). It is already covered by root Biome (`files.includes: "**"`), `tsc` (`include: **/*.ts`) and Jest (`testMatch **/__tests__/**`), so CI's `check`, `type-check` and `test` run on it; server tests use `@jest-environment node`. The app never imports from `server/`. Behaviour the UI relies on: §6.4. |
| `app.json` `extra` / `EXPO_PUBLIC_RECEIPT_SCAN_URL` | URL of our Vercel function. **No key in the app, ever.** If unset (forks, dev), scanning is hidden entirely (button and Settings row). |
| No DB schema change | Nothing about a scan is stored in the transaction except the photo, through the existing attachment path. |

## 3. Entry point (decided)
- **Where:** in the Quick Add header row, on the right, in the slot `quick-add.md` §3 leaves empty.
  - A `Button` (ghost, size sm) with the `scan-outline` icon and the visible text **"Scan"**, at least 44x44pt.
  - Why there: it can be reached before any typing, it doesn't push the keypad down, and it isn't hidden in "More details" (which is where the attach-only Gallery/Camera buttons stay).
- **When shown:** only in **Expense** mode and only when the scan URL is configured. It is hidden in Income and Transfer, because receipts are spending and an income receipt would need different rules.
- **Scanning off (the default):** the button is still shown. Tapping it opens the **consent sheet** (§4.1).
  - "Turn on scanning" saves consent and goes straight to the source sheet, with no extra tap.
  - "Not now" closes the consent sheet and stores nothing, so the next tap asks again. The tap is always the user's choice, so asking again isn't nagging.
  - Hiding the button would make an opt-in feature impossible to find.
- **Camera vs library:** a source sheet ("Scan a receipt"; overlay surface; rows 52pt):
  - **"Take photo"** (`camera-outline`) for paper receipts.
  - **"Choose from library"** (`images-outline`) for e-receipts and screenshots.
  - **"Cancel"**.
  - Both are needed, and both already exist as `takePhoto` / `pickImage` (single selection, one receipt per scan).
- **Offline:** the button stays enabled (connection state changes, and a greyed-out button can't explain itself).
  - On tap, before opening the camera, run `Network.getNetworkStateAsync()`. If `isConnected === false` or `isInternetReachable === false`, don't open the picker; show the offline banner (§8). This saves the user taking a photo that can't be sent.
  - The check is best effort. A failed request is still sorted as `offline` (§8).
- While a scan is running, the button is disabled.

## 4. Consent (opt-in)
### 4.1 First-use consent sheet (exact copy)
Bottom sheet, `surface-overlay`, radius 28, padding 20; icon `scan-outline` in accent.
- **Title:** `Scan receipts with AI?`
- **Body** (3 short paragraphs, `md`, `text-secondary`):
  1. `To read a receipt, FinTrack sends the photo over the internet through FinTrack's server to OpenRouter, a third-party AI service. It reads the amount, date, merchant and similar details and sends them back to fill in the form.`
  2. `Free AI models may keep what they receive. Only the receipt photo is sent. Like any web request, it carries your IP address, which FinTrack's server uses briefly to limit abuse and does not keep. Nothing else from your phone is sent: not your accounts, balances or other transactions.`
  3. `Scanning only happens when you tap Scan. You check everything before saving, and you can turn scanning off anytime in Settings.`
- **Buttons:** primary `Turn on scanning`; secondary `Not now`. Both are full width and at least 48pt. No glow, because Save keeps the screen's only glow.
- **Rules:**
  - No "secure", "private", "encrypted", "accurate" or "smart". No accuracy figure.
  - "Stored on this device" stays true: transactions and saved receipts are still only on the device. The scan sends a **copy** of one photo, once, when the user taps.
  - This is the only place the word "AI" appears, apart from the field badge (§7) and the Settings row. That is an exception to the "AI claim" removals in `design-system.md` §8 and §9: these are disclosures, not marketing.

### 4.2 Settings toggle (exact copy)
In Settings > "Data & privacy", the first row. It is a `ListRow` in the App lock pattern, with right-hand text `On` / `Off`. It is hidden if no scan URL is configured.
- **Title:** `Receipt scanning (AI)`
- **Subtitle when Off (the default):** `Off. Turn on to fill Quick Add from a receipt photo. Scanned photos go through FinTrack's server to OpenRouter, a third-party AI service.`
- **Subtitle when On:** `On. Scanned photos go through FinTrack's server to OpenRouter, a third-party AI service. Free AI models may keep what they receive. Your IP address is used briefly to limit abuse and not kept.` (Fits: `ListRow` subtitle has no `numberOfLines`, so it wraps.)
- Tapping when Off opens the same consent sheet (§4.1); "Turn on scanning" turns it on. Tapping when On turns it **off at once**, with no dialog.

### 4.3 Storage of the setting
- SecureStore key `fintrack_receipt_scan`, holding JSON `{ enabled: boolean, consentVersion: 2, consentedAt: number }`. If the key is missing, scanning is off.
- Why SecureStore and not a `settings` column:
  - consent is per device, and backups restore `settings` on other phones;
  - it needs no migration (`0005` is taken by presets);
  - Settings already uses SecureStore.
- `CONSENT_VERSION = 2` (v1 = the earlier draft without the IP sentence; never shipped). If the provider, data flow or retention changes, bump it; a stored record with a lower version counts as off and the user is asked again. **Server requirement for honesty:** the function stores nothing (no image, results or IPs) and takes no user/device identifier (§6.4). If that ever changes, the copy and the version must change too (GO/Tom).

## 5. Scanning state and the photo
### 5.1 Flow
1. The source sheet returns an asset.
2. `persistImage(asset.uri,'receipt')`, which adds it to `pendingImages`, exactly like the Camera/Gallery buttons. The "More details" row shows "1 receipt".
3. `prepareReceiptForUpload` creates the upload copy.
4. `scanReceipt`, then fill (§7) or show the error banner (§8).

### 5.2 Upload copy
- Steps: `expo-image-manipulator` resizes the long edge to at most 1600px and saves it as JPEG at quality 0.7 into `cacheDirectory`.
  - If the base64 is over 1.5 MB, encode once more at 1200px.
- Re-encoding **drops EXIF, including GPS location**. This is required, because the consent copy says nothing else is sent; a test checks it (§12).
- The copy is deleted in `finally` (success, error or cancel).
- HEIC and PNG are converted by the same step.

### 5.3 Scan panel (while waiting)
- It covers the scroll area and the keypad (on `surface-overlay`). The header stays visible.
- Contents:
  - a 72pt photo thumbnail;
  - text `Preparing photo…`, then `Reading receipt…` (`lg`);
  - helper text `This can take up to 30 seconds.` (`sm`, muted);
  - an OS `ActivityIndicator` in accent. With reduced motion, it is a static `hourglass-outline` icon instead.
  - **No percentage bar**: there is no real progress data, and fake progress would be a fake claim.
- **`Cancel`** (secondary, at least 44pt): aborts the request (`AbortController`). The form is unchanged; the persisted copy and the upload copy are both deleted (the user cancelled the whole action). Nothing is announced except `Scan cancelled` (polite).
- While scanning: Save, Save & new and the scan button are disabled. The close X and the Android back button cancel the scan first, then run the normal discard check (`quick-add.md` §8.6).
- One scan at a time. **No automatic retries**, because each one uses up the free quota.
- Timeout: 30 s, measured from the start of the upload.

### 5.4 What happens to the photo on the device (only what exists)
| Copy | Where | Fate |
|---|---|---|
| Original | camera: image-picker cache (OS-managed); library: the user's library | The app doesn't touch it (same as today). |
| Receipt copy | `documentDirectory/fintrack-media/receipt/` (`persistImage`) | On Save it is attached by `addAttachments` and shown as a receipt (removable, like any receipt). On discard or close-without-save it is deleted by `deleteLocalImage` (`quick-add.md` §8.6). If the user cancels during the scan, it is deleted. If the user taps "Retake photo" after an unreadable result, the failed copy is deleted. |
| Upload copy | `cacheDirectory` (resized, no EXIF) | Always deleted after the request. |
- **Default, pending Sandesh:** keep it, removable. The scanned photo is kept as a receipt by default. That reuses a feature that already exists and is "Stored on this device"; the user can remove the thumbnail.
- No new storage, no cloud copy and no scan history.

## 6. UI contract with GO's server function
### 6.1 Request
- `POST {SCAN_URL}`, JSON body `{ v: 1, image: { mime: 'image/jpeg', base64 }, fields: RECEIPT_FIELDS }`.
- `RECEIPT_FIELDS` (static):

  | Field | Expected value |
  |---|---|
  | `amount` | total paid, a decimal string with `.` and no grouping, e.g. `"1234.56"` |
  | `currency` | ISO 4217 code |
  | `date` | `YYYY-MM-DD` |
  | `merchant` | at most 120 characters |
  | `categoryHint` | one of the default expense `iconKey`s in §1 |

- **Nothing else is sent.** No account names, currencies, category names, locale, device or install id, location or other transactions.
  - The category hint uses the app's fixed `iconKey` list, so the user's own category names never leave the phone.
  - **Decided:** no user/device identifier. Abuse control uses only the request IP (§6.4), which the consent copy now discloses.

### 6.2 Response the app accepts (zod, all optional)
- Success: `200 { v: 1, fields: { amount?, currency?, date?, merchant?, categoryHint? } }`. Each value is a string or `null`.
- Error: `{ error: 'rate_limited' | 'too_large' | 'unreadable' | 'server', scope?: 'ip' | 'provider', retryAfterSec?: number }`. HTTP 429 = rate limited: `scope:'ip'` = our per-IP limit, `scope:'provider'` (or missing) = OpenRouter's limit or the key's credit cap. HTTP 413 = upload over the size cap.
- The server's opinion of a value is not trusted; the app validates every field itself (§7). There is no confidence score in the UI.

### 6.3 App types
```ts
type ScanErrorKind = 'offline' | 'rate_limited' | 'too_large' | 'timeout' | 'unreadable' | 'server';
type RateLimitScope = 'ip' | 'provider'; // sent with rate_limited
type FieldCheck<T> = { status: 'ok'; value: T } | { status: 'missing' }
  | { status: 'invalid'; reason: 'not_positive' | 'over_max' | 'bad_format' | 'future_date' | 'too_old' | 'currency_mismatch' | 'no_matching_category' };
type ScanResponse = { ok: true; fields: Record<'amount'|'currency'|'date'|'merchant'|'categoryHint', string | null> }
  | { ok: false; error: ScanErrorKind; retryAfterSec?: number } | { ok: false; error: 'cancelled' };
```

### 6.4 Server function facts the UI depends on (decided; GO designs the rest)
- Hosted on **Vercel**. Reads `OPENROUTER_API_KEY` from Vercel environment variables; the key is never in the app or the repo. Calls one specific free vision model (not `openrouter/free`).
- **Stores nothing.** No image, result or IP is written to disk, a database or the logs. No user or device identifier is accepted.
- **Per-IP rate limit held only in memory, never logged.** This is a speed bump only: Vercel instances have separate memory and get recycled, so it is not a guarantee. Over the limit → 429 `scope:'ip'` (+ `Retry-After` if known).
- **Upload size cap** → 413. The app resizes to 1600px / about 1.5 MB first (§5.2), so 413 should be rare.
- **Hard quota cap** = the credit limit set on the OpenRouter key. When it is used up, OpenRouter's limit/credit error is returned as 429 `rate_limited` with `scope:'provider'`; the per-IP limit uses `scope:'ip'` (§8 has copy for both).

## 7. Result handling (prefill, never save)
`applyScanToForm(fields, { account, expenseCategories, today, userTouched })` is pure. It **fills only fields that pass validation**, and **never fills a field the user already set** in this sheet session (RHF `dirtyFields`, a non-empty keypad `amountText`, or a category the user tapped; the automatic default category doesn't count as user-set).

| Scan field | Form field | Validation (all must pass, otherwise it isn't filled) |
|---|---|---|
| `currency` | none (check only) | Trim and upper-case. If it is missing or not a known ISO code, **use the account's currency**. If it is known but **different from the selected account's currency**, the amount isn't filled; the reason is `currency_mismatch` (no FX conversion). |
| `amount` | keypad `amountText` (`amount`) | Parse with `parseAmountToMinor(value, account.currencyCode)`. The result must not be `null`, must be `> 0` (refunds and negatives rejected) and must be `< MAX_MINOR`. The keypad shows the parsed value, re-formatted from minor units, so the parser stays the authority at Save. |
| `date` | Quick Add `date` (DateField) | Must be a valid `YYYY-MM-DD` with `2000-01-01 <= date <= today` (device local). If it is later than today it isn't filled (`future_date`). |
| `merchant` | `title` | Trim and collapse whitespace; remove control characters; 1–120 characters (§7.1). |
| `categoryHint` | `categoryId` (**suggestion only**) | The first live expense category (by `sortOrder`) whose `iconKey` equals the hint. `other`, no match, or a user-picked category means no change. It never creates or renames categories. |
- Mode stays Expense. Note, tags and the account are never changed by a scan.

### 7.1 Model output is untrusted
- Every value goes through a zod schema before `applyScanToForm`. Raw strings are capped **before** any processing: `amount` <= 32, `currency` <= 8, `date` <= 10, `merchant` <= 300, `categoryHint` <= 32 characters (longer → the field is `invalid`, not truncated).
- After cleaning, `title` must be 1–120 characters, matching `transactionInputSchema.title` `max(120)` in `lib/validation.ts` (PR #10's `formSchema.title` is a bare `z.string()` with no max; the 120 cap is enforced at save by `transactionInputSchema`). Nothing from the model goes into `note` (max 500) or `tags`.
- Control characters (`\p{Cc}`, plus `\u200B-\u200F`, `\u202A-\u202E`, `\u2066-\u2069` bidi overrides) are removed before the length check.
- Nothing from the model is executed, `eval`ed, used as a URL or path, interpolated into SQL (Drizzle parameters only), or rendered as markup/HTML/Markdown. It is shown only as plain `Text` values in the form fields.
- Unknown keys in the response are dropped (`z.object(...).strip()`); an envelope that fails zod is `server` (§8).
- **Currency mismatch helper**, under the amount (`sm`, `warning` icon and text):
  - `This receipt is in {CCY}. {account} uses {ACC_CCY}, so the amount wasn't filled.`
  - If a live account in `{CCY}` exists, also show the chip `Use {name} · {CCY}`. Tapping it switches the account and then fills the amount, with the badge.
- **AI-filled badge:**
  - a small pill next to each filled field's value: icon `scan-outline` 14 + text `AI-filled` (`xs`, 12px semibold, tabular), `accent` on `accent-soft`;
  - it shows on every filled field, including the category chip;
  - it is removed for that field on the user's first edit: a keypad key (amount), a text change (title), picking a date, or tapping a category chip.
  - It is not saved and not shown after Save.
- **Result banner** (below the amount block, `accent-soft`, icon `checkmark-circle-outline`, close X 44pt):
  - `Filled {n} of 4 details from the receipt. Check them before saving.`
  - Then one muted line for each skipped item, using only these exact texts:
    - `Date not filled: it was after today.`
    - `Amount not filled: it wasn't a valid amount.`
    - `Kept what you already entered for {Amount|Date|Title|Category}.`
  - When `n` is 0, it becomes the unreadable error (§8).
- **Never auto-save:** focus moves to the amount (the keypad). Save and Save & new work as in `quick-add.md` §8 (the title can be empty and falls back to the category name). A second scan replaces only fields that still have the AI-filled badge or are still empty.

## 8. Failure states (exact copy and actions)
- **Where:** an inline banner in the same place as the result banner. Fill `negative-soft`, icon `alert-circle-outline`, message text `negative` `#FB7185` (5.0:1 on its fill), polite live region.
- **Form:** unchanged on every failure.
- **Photo:** if a photo was taken, it stays as a pending receipt unless the copy below says otherwise.
- **"Enter manually":** closes the banner and focuses the amount.
- **"Try again":** re-sends the **same** upload copy; it is rebuilt from the receipt copy, with no new photo and no new consent.

| Kind | When (client sorting) | Message (exact) | Actions |
|---|---|---|---|
| `offline` (before photo) | pre-check fails (§3) | `You're offline. Scanning needs an internet connection.` | `Try again` (re-checks, then opens the source sheet) · `Enter manually` |
| `offline` (during request) | `fetch` rejects without an abort | `Connection lost while scanning. Your photo is kept as a receipt.` | `Try again` · `Enter manually` |
| `rate_limited` (server, per IP) | HTTP 429 with `scope:'ip'` (our Vercel function's limit) | `Too many scans from this connection. Wait a minute, then try again, or enter the details yourself.` | `Try again` (if `retryAfterSec`, from `Retry-After` or the body clamped to 1–600, the button reads `Try again in {s}s` and is disabled until 0) · `Enter manually` |
| `rate_limited` (AI service) | HTTP 429 with `scope:'provider'` or no scope (OpenRouter's limit or the key's credit cap) | `Scanning is busy right now (free AI limit reached). Try again later, or enter the details yourself.` | `Try again` (same countdown rule) · `Enter manually` |
| `timeout` | 30 s abort timer | `Reading the receipt took too long. Try again, or enter the details yourself.` | `Try again` · `Enter manually` |
| `unreadable` | HTTP 422, or `error:'unreadable'`, or 200 with **0** fields passing §7 | `Couldn't read this receipt. Try a sharper photo with the whole receipt in view.` | `Retake photo` (deletes this copy, reopens the source sheet) · `Enter manually` |
| `too_large` | HTTP 413 or `error:'too_large'` (rare: the app resizes first) | `This photo is too large to scan. Try again with a closer photo of just the receipt.` | `Retake photo` (deletes this copy, reopens the source sheet) · `Enter manually` |
| `server` | any other non-2xx, non-JSON reply, or envelope failing zod | `Scanning isn't working right now. Try again later, or enter the details yourself.` | `Try again` · `Enter manually` |
| photo can't be opened | `prepareReceiptForUpload` throws | `Couldn't open this photo. Try another one.` | `Retake photo` · `Enter manually` |
| camera permission refused | `takePhoto` permission refused | `Camera access is off for FinTrack. Allow it in your phone's Settings, or choose a photo from your library.` | `Choose from library` · `Enter manually` |
| library permission refused | `pickImage` permission refused | `Photo access is off for FinTrack. Allow it in your phone's Settings, or take a photo instead.` | `Take photo` · `Enter manually` |
| unexpected exception (a bug) | anything thrown outside the above | Toast (error) inside `ModalToastProvider`: `Something went wrong with scanning. Enter the details yourself.` | none (form unchanged) |
- Never show raw error strings, HTTP codes or the model name. Errors are logged with `console.error` and contain no image data. Permission handling should check the permission result, not the thrown message.

## 9. Accessibility and visuals
- **Scan button.**
  - `accessibilityLabel` `Scan a receipt`.
  - Hint when on: `Fills amount, date, merchant and category from a photo. Sends the photo to an AI service.`
  - Hint when off: `Asks before turning on receipt scanning.`
  - It reports `disabled` while scanning.
- **AI-filled badge.**
  - The badge itself is hidden from the screen reader (`importantForAccessibility='no'`) so it isn't read twice.
  - The field's label gets the suffix `, filled by AI from the receipt, check before saving`. For example: `Amount, 23 dollars 45 cents, filled by AI from the receipt, check before saving`.
  - The category chip reads `Food & Drink, suggested by AI, selected`.
- **Announcements:**
  - `Reading receipt`, then focus moves to Cancel;
  - the result banner text;
  - each error message.
  - Focus moves to the banner's first action on error, and to the amount on success.
- **Contrast** (design-system §1.2; text 4.5:1, icons and UI 3:1):
  - Dark:
    - badge `#38BDF8` on `#1D3646` 5.9:1;
    - error text `#FB7185` on `#3C2A34` 5.0:1, and on overlay `#1F242D` 5.8:1;
    - muted notes `#8F9AA3` on card 5.9:1;
    - warning helper `#F59E0B` on card 7.9:1;
    - consent body `#BDC8D1` on overlay at least 9:1.
  - Light (derived):
    - accent `#0369A1` on its 10% fill `#E6F0F6` 5.1:1;
    - negative `#BE123C` on `#F8E7EC` 5.3:1.
  - All checked.
- **Targets:** the scan button, source rows, banner actions, Cancel, the banner close X and the consent buttons are all at least 44pt (`Math.max(44, vs(n))`).
- **Colour is never the only signal:** the badge has text, errors have an icon and words, the warning helper has an icon.
- **Text size:** dynamic type wraps; the badge text is capped at 1.3x.
- **Motion:** reduced motion means no spinner and the consent and source sheets use `fade`.
- **Tokens only:** `surface-overlay`, `accent`, `accent-soft`, `negative`, `negative-soft`, `warning`, `text-secondary`, `text-muted`. No new colours, no glow (except Save), no sparkle or "magic" icons.

## 10. Out of scope
- Other AI uses: auto-categorising existing transactions, insights, chat, merchant clean-up and budgets.
- Multiple receipts per scan, or batch scanning.
- Line items: splitting one receipt into several transactions or categories, and tax or tip breakdown.
- Storing images anywhere off the device, scan history, or saving AI output beyond the form.
- Income, transfer or refund receipts. FX conversion of a foreign-currency receipt.
- On-device OCR. Choosing the model, the prompt, server design, or rate-limit tuning (GO/Tom).

## 11. Open items
1. Keep the scanned photo as a receipt (Sandesh; **default: keep it, removable**, §5.4). Pending.
2. Whether "Not now" should ever stop asking (default: ask on each tap of Scan).

## 12. Acceptance checklist (GO / Kho)
**Consent and settings**
- [ ] On a fresh install, scanning is off. The SecureStore key is missing and the Settings row reads `Off`.
- [ ] Tapping Scan while off shows the consent sheet with the §4.1 text exactly (snapshot test).
- [ ] "Not now" stores nothing; "Turn on scanning" stores `{enabled:true, consentVersion:2}` and opens the source sheet. A stored v1 record counts as off.
- [ ] Settings On to Off happens immediately. Off to On always goes through consent. A stored `consentVersion` below the current one counts as off.
- [ ] With no scan URL, there is no scan button and no Settings row.
- [ ] CI key check scans the **built JS bundle**, not just the source: `bunx expo export --platform all --output-dir dist` then fail if `dist/` contains `sk-or-`, `OPENROUTER_API_KEY` or `openrouter.ai` (the app talks only to our Vercel URL). Also run on `src/`.

**Request**
- [ ] The request body has exactly the keys `v`, `image`, `fields` (mocked-fetch test). There are no account, category or currency values, no ids and no locale.
- [ ] The uploaded JPEG has no EXIF/GPS (test with a fixture that has GPS tags). The long edge is at most 1600px.
- [ ] The upload copy in `cacheDirectory` is deleted after success, every error and cancel.
- [ ] Model output: a 301-char merchant → not filled; a merchant with control/bidi characters is cleaned; `<b>x</b>` shows literally as text; unknown response keys are dropped.
- [ ] Server (`server/__tests__`, node env): no identifier read from the request; the IP limiter is in memory only; no `console.*` call logs the IP, the image or results; oversize body → 413; over the limit → 429; missing `OPENROUTER_API_KEY` → 500 `server`.
- [ ] Tested on a new EAS **preview build** (not Expo Go / an OTA update), with `app.json` `version` bumped to `1.1.0`.

**Scanning state**
- [ ] The panel shows `Preparing photo…` and then `Reading receipt…`, and there is no percentage bar.
- [ ] Cancel aborts the request, leaves the form unchanged and deletes both copies.
- [ ] Save is disabled while scanning.
- [ ] The scan button only shows in Expense mode.

**Filling**
- [ ] `applyScanToForm` unit tests cover:
  - amounts: `"23.45"` USD → 2345; `"1,50"` EUR → 150; `"-5.00"` → not filled; `"0"` → not filled; `"12.345"` USD → not filled; `"1e13"`-sized → not filled;
  - currency: missing → account currency used; `EUR` on a USD account → amount not filled, warning shown, "Use {EUR account}" shown only if one exists;
  - dates: tomorrow → not filled; `1999-12-31` → not filled; `2026-02-30` → not filled;
  - merchant: 200 characters → not filled; whitespace only → not filled;
  - category hint: `food` → first live `iconKey:'food'` expense category; `other`, unknown or user-picked → unchanged;
  - fields the user already entered → never overwritten.
- [ ] Each filled field shows `AI-filled`. The badge disappears on the first edit of that field and only that field. The screen reader suffix is read.
- [ ] No auto-save: after a successful scan the transaction count is unchanged until Save is tapped. The saved row has no AI marker. The photo is attached through `addAttachments` and appears as a receipt.

**Failures**
- [ ] Each §8 kind (forced with a mock server, including 429 `scope:'ip'`, 429 `scope:'provider'` and 413) shows its exact message inline in `negative`, with its actions. `Try again` re-sends without a new photo. `Try again in {s}s` counts down. Only the unexpected-exception case uses a toast, rendered inside the Modal.
- [ ] Airplane mode: tapping Scan shows the offline banner and the camera does not open.

**Accessibility and copy**
- [ ] VoiceOver/TalkBack can finish consent, scan, cancel, error and fill flows. All targets are at least 44pt. Contrast values match §9 in dark and light.
- [ ] The words "secure", "private", "encrypted", "accurate" and "smart" don't appear in any scan copy (grep test).

## 13. What a user can do after this ships
Turn scanning on once (after reading exactly where the photo goes), tap **Scan** in Quick Add, and take or pick a receipt photo. Amount, date, merchant and a suggested category are filled in and marked "AI-filled". The user fixes anything that's wrong and taps Save. The photo stays on the phone as the receipt. When scanning fails or the phone is offline, the user is told why in plain words and can try again or type it in.
