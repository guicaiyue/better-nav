-- Website keywords and evaluation update rules.
BEGIN;
CREATE TABLE IF NOT EXISTS ds_website_search_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES ds_websites(id) ON DELETE CASCADE,
  keyword text NOT NULL CHECK (length(btrim(keyword)) > 0),
  normalized_keyword text NOT NULL CHECK (length(btrim(normalized_keyword)) > 0),
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  click_count bigint NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  UNIQUE (website_id, normalized_keyword)
);
CREATE TABLE IF NOT EXISTS ds_website_update_rules (
  category text PRIMARY KEY CHECK (category = 'evaluate'),
  interval_days integer NOT NULL CHECK (interval_days > 0),
  agent_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true
);
INSERT INTO ds_website_update_rules(category, interval_days, agent_id, enabled)
VALUES ('evaluate', 30, '8f6bd668-2f11-4404-a740-69081d67a2d2', true)
ON CONFLICT (category) DO NOTHING;
COMMIT;
