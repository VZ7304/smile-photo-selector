# REST API V1

Base: `/api/v1`

## Implemented now

- `GET /health` — process + D1 probe.

## Auth

- `POST /auth/login`
- `POST /auth/logout`
- `GET /me`

## Customer

- `GET /projects/current`
- `GET /projects/:projectId/manifest-meta`
- `GET /projects/:projectId/manifest`
- `GET /drafts/:projectId`
- `PUT /drafts/:projectId`
- `POST /orders`
- `POST /visual-search`

## Admin

- `GET /admin/projects`
- `POST /admin/projects`
- `GET /admin/projects/:id`
- `POST /admin/projects/:id/import`
- `GET /admin/projects/:id/jobs`
- `POST /admin/projects/:id/visual-index`
- `POST /admin/projects/:id/rescan` (maintenance only)
- `GET /admin/users`
- `POST /admin/users`
- `POST /admin/users/:id/assign-project`
- `POST /admin/users/:id/reset-password`
- `GET /admin/orders`
- `GET /admin/orders/:id`
- `GET /admin/orders/:id/download-plan`

## API rules

- JSON only for business APIs.
- Mutations validated server-side.
- Cookie-based session mutations require CSRF protection.
- Admin routes always authorize ADMIN on server.
- Customer project scope is derived from ACTIVE assignment, never trusted from client input.
- `POST /orders` requires UUID `clientRequestId`; duplicate request returns existing order rather than creating a second order.
- `download-plan` returns metadata/original IDs only, never image bytes.
