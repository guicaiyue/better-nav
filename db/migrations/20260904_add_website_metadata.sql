ALTER TABLE ds_websites
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN ds_websites.metadata IS
  'Structured analysis metadata emitted by the TT-RSS classification workflow';
