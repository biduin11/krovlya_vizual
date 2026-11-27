CREATE TABLE IF NOT EXISTS roof_accounts (
  email text PRIMARY KEY,
  granted boolean NOT NULL DEFAULT false,
  accepted_at timestamptz,
  last_mail_at timestamptz
);

CREATE TABLE IF NOT EXISTS roof_links (
  token_hash text PRIMARY KEY,
  email text NOT NULL REFERENCES roof_accounts(email),
  roof_config text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS roof_sessions (
  token_hash text PRIMARY KEY,
  email text NOT NULL REFERENCES roof_accounts(email),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS roof_links_email ON roof_links(email);
CREATE INDEX IF NOT EXISTS roof_sessions_email ON roof_sessions(email);
