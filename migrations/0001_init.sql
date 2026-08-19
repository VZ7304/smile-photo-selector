PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash_params TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'CUSTOMER')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  user_agent TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  original_folder_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','IMPORTING','FINALIZING','READY','INDEXING','ACTIVE','COMPLETED','PURGING','PURGED','ERROR')),
  student_count INTEGER NOT NULL DEFAULT 0 CHECK (student_count >= 0),
  large_limit INTEGER NOT NULL DEFAULT 1 CHECK (large_limit = 1),
  small_limit INTEGER,
  selection_deadline TEXT,
  notes TEXT,
  image_count INTEGER NOT NULL DEFAULT 0 CHECK (image_count >= 0),
  manifest_revision TEXT,
  manifest_location TEXT,
  visual_index_revision TEXT,
  visual_index_status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (visual_index_status IN ('NOT_STARTED','BUILDING','READY','PARTIAL','ERROR')),
  retention_days INTEGER,
  created_by TEXT NOT NULL REFERENCES users(user_id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  purge_at TEXT,
  CHECK ((student_count = 0 AND small_limit IS NULL) OR (student_count > 0 AND small_limit = student_count * 2))
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS project_users (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
  assigned_at TEXT NOT NULL,
  assigned_by TEXT NOT NULL REFERENCES users(user_id),
  PRIMARY KEY (project_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_one_active_project_per_customer
  ON project_users(user_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS images (
  image_key TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  original_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER,
  md5_checksum TEXT,
  width INTEGER,
  height INTEGER,
  original_drive_url TEXT,
  sequence INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REMOVED','ERROR')),
  thumb_ref TEXT,
  preview_ref TEXT,
  source_created_at TEXT,
  source_modified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, original_file_id),
  UNIQUE(project_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_images_project_status_seq ON images(project_id, status, sequence);
CREATE INDEX IF NOT EXISTS idx_images_project_normalized_name ON images(project_id, normalized_name);

CREATE TABLE IF NOT EXISTS drafts (
  draft_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  selected_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUBMITTED')),
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, project_id)
);

CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  client_request_id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  user_id TEXT NOT NULL REFERENCES users(user_id),
  selected_count INTEGER NOT NULL CHECK (selected_count > 0),
  large_count INTEGER NOT NULL CHECK (large_count BETWEEN 0 AND 1),
  small_count INTEGER NOT NULL CHECK (small_count >= 0),
  customer_note TEXT,
  submitted_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (selected_count = large_count + small_count)
);
CREATE INDEX IF NOT EXISTS idx_orders_project_submitted ON orders(project_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_submitted ON orders(user_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  image_key TEXT NOT NULL,
  file_name_snapshot TEXT NOT NULL,
  original_file_id_snapshot TEXT NOT NULL,
  size_snapshot INTEGER,
  selection_type TEXT NOT NULL CHECK (selection_type IN ('LARGE','SMALL')),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sequence_snapshot INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(order_id, image_key)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_type ON order_items(order_id, selection_type);

CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(project_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('DRIVE_IMPORT','MANIFEST_BUILD','THUMBNAIL_CACHE','VISUAL_INDEX','CLEANUP','NOTIFICATION_RETRY')),
  status TEXT NOT NULL CHECK (status IN ('QUEUED','RUNNING','PAUSED','DONE','PARTIAL','ERROR','CANCELLED')),
  cursor TEXT,
  processed INTEGER NOT NULL DEFAULT 0 CHECK (processed >= 0),
  total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  success INTEGER NOT NULL DEFAULT 0 CHECK (success >= 0),
  failed INTEGER NOT NULL DEFAULT 0 CHECK (failed >= 0),
  retry INTEGER NOT NULL DEFAULT 0 CHECK (retry >= 0),
  error TEXT,
  started_at TEXT,
  updated_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_project_type_status ON jobs(project_id, type, status);

CREATE TABLE IF NOT EXISTS visual_index_items (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  manifest_revision TEXT NOT NULL,
  model_version TEXT NOT NULL,
  feature_version TEXT NOT NULL,
  image_key TEXT NOT NULL REFERENCES images(image_key) ON DELETE CASCADE,
  vector_id TEXT,
  phash TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING','READY','FAILED')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, manifest_revision, model_version, feature_version, image_key)
);
CREATE INDEX IF NOT EXISTS idx_visual_revision_status
  ON visual_index_items(project_id, manifest_revision, model_version, feature_version, status);

CREATE TABLE IF NOT EXISTS app_logs (
  log_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('DEBUG','INFO','WARN','ERROR')),
  event_type TEXT NOT NULL,
  user_id TEXT,
  project_id TEXT,
  order_id TEXT,
  job_id TEXT,
  message TEXT NOT NULL,
  details_json TEXT,
  execution_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON app_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_project_timestamp ON app_logs(project_id, timestamp DESC);
