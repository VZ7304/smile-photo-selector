# HANDOVER — SMILE MEDIA Photo Selector V1

## Source of truth

This repository implements the new product independently from the Apps Script demo. The demo is behavioral reference only. Google Drive remains the only source of truth for original image bytes.

## Frozen decisions — 2026-08-19

1. Frontend: React 19 + Vite 8 + TypeScript strict; PWA/mobile-first in later Phase 4.
2. API: Cloudflare Worker + Hono; REST `/api/v1`.
3. Database: Cloudflare D1 with version-controlled SQL migrations and repository abstraction.
4. Originals: Google Drive only. Never copy all originals to Cloudflare; never proxy bulk original downloads through Worker.
5. Derivatives: thumbnail/preview provider abstraction. Drive thumbnail is fallback; R2 is optional cache only.
6. Visual search: shared index per project + manifest revision. Compute/build index on studio/admin machine when necessary to keep 0đ. Vectorize is a provider, never a dependency without fallback.
7. Jobs: resumable/idempotent. Queue/Workflow use is optional and must fit current free quota; core business logic is not coupled to them.
8. Auth: ADMIN/CUSTOMER, server-side authorization, issued passwords shown once in UI, hashes only on server, session revocation on reset.
9. Assignment: exactly one ACTIVE project per CUSTOMER at a time.
10. Order: immutable snapshot + idempotent `clientRequestId`.
11. Downloader: browser ADMIN → Google Drive API original stream → File System Access API / local disk. Worker returns plan/metadata, not bytes.

## Current implementation state

### DONE in skeleton
- monorepo scaffold
- web shell
- worker API shell
- D1 migration V1
- `GET /api/v1/health`
- D1 health probe
- business-rule tests for LARGE/SMALL fundamentals
- adapter interface contracts
- architecture/data/API/test/backup docs

### Phase 1 deployment status — 2026-08-19
- GitHub repository created and source pushed to `VZ7304/smile-photo-selector`.
- Cloudflare D1 database created: `smile-photo-selector-dev`.
- D1 database ID wired into `apps/worker/wrangler.toml`.
- Remote D1 migration V1 executed successfully from Cloudflare Dashboard.
- Remote schema verification PASS: 11 tables present (`app_logs`, `drafts`, `images`, `jobs`, `order_items`, `orders`, `project_users`, `projects`, `sessions`, `users`, `visual_index_items`).
- Remaining Phase 1 gate: deploy Worker and verify `/api/v1/health` returns `status=ok` with D1 reachable; then deploy/connect web shell if needed for final browser verification.

### NOT YET BUILT
Auth, users UI, assignment UI, Drive importer, manifest, gallery, PWA cache, draft/autosave, order submit, admin order UI, direct downloader, filename-file search, visual search, notifications, cleanup, backup automation.

## Hard rule

Do not start the next feature phase until Phase 0/1 acceptance gate passes. Phase 1 is not complete until the deployed Worker health check confirms D1 connectivity.

## Phase order

0. Freeze spec/docs
1. Scaffold + health + D1
2. Auth + accounts + assignment
3. Project + Drive import
4. Manifest + gallery
5. Selection + draft + order
6. Direct original downloader
7. Tìm bằng tệp
8. Visual search production
9. Hardening
10. Cutover
