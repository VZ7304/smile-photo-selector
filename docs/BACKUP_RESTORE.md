# Backup / Restore V1

## What must be recoverable

- D1 schema from Git migrations
- project/user/assignment/order metadata from D1 export
- manifests rebuilt from Drive metadata
- visual index rebuilt from Drive + pinned model/preprocessing versions
- original bytes remain in Google Drive and are never dependent on Cloudflare cache

## Phase 1

No automated backup job yet. The required property now is **rebuildability** and version-controlled migrations.

## Later hardening

1. export D1 on schedule/manual trigger within free-tier constraints;
2. store export artifact in a configured backup provider (Drive or R2 if quota permits);
3. test restore into a fresh D1 database;
4. rebuild manifests and visual indexes from Drive;
5. verify order snapshots and original file IDs.

Never store plaintext passwords, session tokens, OAuth access tokens, or secrets in backup artifacts/logs.
