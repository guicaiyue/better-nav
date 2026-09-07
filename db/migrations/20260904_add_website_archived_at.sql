ALTER TABLE ds_websites
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS ds_websites_active_idx
  ON ds_websites (sort DESC, created_at DESC)
  WHERE archived_at IS NULL;
