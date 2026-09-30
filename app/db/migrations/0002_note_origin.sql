-- cluster_notes'un web arayüzünden mi yoksa MCP (AI aracı) üzerinden mi eklendiğini işaretler.
ALTER TABLE cluster_notes ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'web';
