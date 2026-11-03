CREATE TABLE IF NOT EXISTS site_state (
  id smallint PRIMARY KEY CHECK (id = 1),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_quotes (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  sid text PRIMARY KEY,
  sess jsonb NOT NULL,
  expire timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_expire_idx ON admin_sessions (expire);

CREATE TABLE IF NOT EXISTS rate_limits (
  rate_key text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_started timestamptz NOT NULL DEFAULT now()
);
