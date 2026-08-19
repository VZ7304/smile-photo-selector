# Acceptance Roadmap — Phase 0 → Phase 10

## Phase 0 — Freeze spec
Gate: architecture, Mermaid, schema, API, adapters, acceptance checklist committed.

## Phase 1 — Scaffold
Gate: install → local D1 migration → Worker boot → `/api/v1/health` 200 with D1 `ok` → web health screen → typecheck/tests PASS.

## Phase 2 — Auth + Accounts
Gate: ADMIN/CUSTOMER authorization; create/reset password shown once; hash only server-side; reset revokes sessions; one ACTIVE assignment; customer detects reassignment without relogin.

## Phase 3 — Project + Drive Import
Gate: recursive 5,000-image import, resumable, idempotent, deterministic sequence, no duplicates, per-file failure isolation, real progress.

## Phase 4 — Manifest + Gallery
Gate: immutable revisioned manifest, IndexedDB cache, 5k virtualized gallery, fast local filename search, fullscreen preview, mobile test.

## Phase 5 — Selection + Draft + Order
Gate: LARGE max 1/optional; SMALL rule; no dual type; autosave restore; backend quota validation; empty submit rejected; double click produces one immutable order.

## Phase 6 — Direct Original Downloader
Gate: 1 LARGE + 90 SMALL → one root folder + two subfolders; 91/91 original bytes; 6 default concurrent; retry/resume/skip completed; byte-count verification; no Worker proxy/ZIP.

## Phase 7 — Tìm bằng tệp
Gate: selecting a downloaded original uses `file.name`, sends no bytes, returns exact normalized filename match immediately.

## Phase 8 — Visual Search
Gate: shared index per project/revision; one bad image does not fail batch; benchmark exact/downscale/recompress/screenshot/crops; confidence-aware top results; fallback vector store works.

## Phase 9 — Hardening
Gate: rate limits, CSRF, CORS, logs, cleanup, backup/restore drill, 5k load test, multi-job test, mobile/browser matrix, security tests.

## Phase 10 — Cutover
Gate: required demo metadata migrated/imported, parallel verification complete, all acceptance tests pass before production switch.
