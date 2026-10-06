# FinTrack receipt scan (server)

Vercel serverless function that accepts a receipt JPEG and returns structured fields via OpenRouter vision.

## Deploy on Vercel

The Expo app lives at the **repository root**. This folder is a **separate Vercel project**:

1. Create a Vercel project linked to this repo.
2. Set **Root Directory** to `server/` (Project Settings → General). Only this folder is deployed.
3. Add environment variable **`OPENROUTER_API_KEY`** in the Vercel project (never in the app or git).
4. In [OpenRouter](https://openrouter.ai/), set a **credit limit** on that API key.
5. Optional: **`OPENROUTER_MODEL`** to override the default model (see below).

`vercel.json` configures the `api/scan-receipt` function (30s max duration). **No CORS headers** — the mobile app calls this URL natively, not from a browser.

## Model

Default: **`google/gemma-4-31b-it:free`** (pinned in `config.ts`). Verified on OpenRouter’s public `/api/v1/models` endpoint (2026-10-06): zero cost, supports **image** input and JSON-style responses.

Override with `OPENROUTER_MODEL` if this model is retired; pick another `:free` model whose `architecture.input_modalities` includes `image`.

## Limits

| Limit | Value |
|--------|--------|
| Request body | ~3 MB (`content-length` + parsed body) |
| Decoded JPEG | ~2 MB |
| Rate limit | 10 requests / 60 s per client IP (in-memory, per instance) |
| Provider timeout | 25 s |
| Output raw caps | amount 32, currency 8, date 10, merchant 300, categoryHint 32 chars |

Client IP for rate limiting: `x-real-ip`, else **rightmost** `x-forwarded-for`, else shared `unknown` bucket. IPs are not logged or stored.

## Local development

```bash
cd server
bun install
bun run type-check
```

Tests run from the repo root: `bun run test` (Jest, `@jest-environment node` under `server/__tests__/`).

## Security

- No image, model output, IP, or API key in logs (`logError` kinds only).
- Prompt is built from fixed server field definitions; client `fields[].description` is ignored.
- Model output is sanitized and re-validated before returning.
