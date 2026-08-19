# SMILE MEDIA Photo Selector — V1 Skeleton

Production-oriented replacement for the Apps Script demo. Google Drive remains the only source of truth for original photos. Cloudflare hosts the API/static product layer and metadata; visual compute is designed to be provider-agnostic and can run on the studio/admin machine.

## Prerequisites

- Node.js 22+
- npm 10+
- Cloudflare account (Free is enough for Phase 1)
- Wrangler authenticated with Cloudflare

## 1. Install

```bash
npm install
```

## 2. Create D1 database

```bash
npx wrangler d1 create smile-photo-selector-dev
```

Copy the returned `database_id` into `apps/worker/wrangler.toml` and replace the placeholder UUID.

## 3. Apply local migration

```bash
npm run db:migrate:local
```

Expected: migration `0001_init.sql` is applied successfully.

## 4. Start Worker

```bash
npm run dev:worker
```

Expected: API on `http://localhost:8787`.

Test:

```bash
curl http://localhost:8787/api/v1/health
```

Expected JSON contains `"status":"ok"` and `"d1":"ok"`.

## 5. Start Web

Open a second terminal:

```bash
npm run dev:web
```

Expected: Vite UI on `http://localhost:5173`, showing API and D1 as healthy.

## Acceptance gate for Phase 0/1 skeleton

- [ ] `npm install` succeeds
- [ ] D1 migration applies locally
- [ ] Worker boots
- [ ] `GET /api/v1/health` returns HTTP 200
- [ ] D1 probe returns `ok`
- [ ] Web boots and displays health response
- [ ] `npm run check` succeeds

Do not build Auth, Drive import, gallery, order, download, or visual search before this gate passes.

See `docs/HANDOVER.md` for the frozen product/architecture state.
