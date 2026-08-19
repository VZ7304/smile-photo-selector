# Data Model V1

The executable schema is `migrations/0001_init.sql`.

## Core entities

- `users`: ADMIN/CUSTOMER identities; password hash/salt/parameters only.
- `sessions`: hashed session tokens, expiry and revocation.
- `projects`: album/job settings, limits, manifest and visual-index revision pointers.
- `project_users`: assignment history; partial unique index enforces one ACTIVE project per user.
- `images`: stable `image_key` + canonical `original_file_id`; idempotent import key is `(project_id, original_file_id)`.
- `drafts`: one mutable draft per user/project with version.
- `orders`: immutable idempotent order header.
- `order_items`: immutable snapshot of filename/original ID/size/type.
- `jobs`: resumable job checkpoint/progress state.
- `visual_index_items`: mapping/status for model+feature+manifest revisions.
- `app_logs`: structured operational/audit events; never secrets or plaintext password/token.

## Business invariants encoded in SQL

- one ACTIVE project per customer/user
- project `large_limit = 1`
- `small_limit = student_count * 2` when student count > 0; NULL means unlimited
- one `(project, original_file_id)` image
- max order header `large_count <= 1`
- order selected count equals large + small
- one image once per order
- immutable order items retain `original_file_id_snapshot`
