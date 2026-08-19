# Adapter Interfaces V1

Executable TypeScript contracts live in `packages/shared/src/ports.ts`.

Required ports:

- `DatabaseRepository`
- `StorageProvider`
- `OriginalFileProvider`
- `ThumbnailProvider`
- `VectorStore`
- `NotificationProvider`
- `JobQueue`
- `AuthSessionStore`

Initial provider mapping:

| Port | V1 provider | Fallback / migration path |
|---|---|---|
| DatabaseRepository | D1 | SQLite/Postgres |
| OriginalFileProvider | Google Drive | S3/R2-compatible originals only if business storage changes |
| StorageProvider | R2 optional | static/CDN/other object store |
| ThumbnailProvider | Drive thumbnails first | R2 derivative cache |
| VectorStore | Vectorize when quota fits | static compressed project index / another vector DB |
| NotificationProvider | admin UI / Gmail/n8n later | any email/webhook provider |
| JobQueue | Cloudflare Queue when useful | D1 checkpoint + explicit continuation / other queue |
| AuthSessionStore | D1 | Redis/other KV-compatible session store |
