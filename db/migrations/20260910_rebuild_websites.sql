-- DESTRUCTIVE: execute only during the primary operator's authorized production cutover.
-- No backup or legacy data migration. This file is deliberately NOT auto-run by Docker.
BEGIN;
DELETE FROM ds_websites;
ALTER TABLE ds_websites
  DROP CONSTRAINT ds_websites_name_key,
  DROP CONSTRAINT ds_websites_category_id_fkey,
  DROP COLUMN url, DROP COLUMN "desc", DROP COLUMN metadata,
  DROP COLUMN logo, DROP COLUMN sort, DROP COLUMN pinned,
  DROP COLUMN recommend, DROP COLUMN vpn, DROP COLUMN "commonlyUsed", DROP COLUMN "visitCount",
  ADD COLUMN official_url text,
  ADD COLUMN github_url text,
  ADD COLUMN related_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN self_description text NOT NULL DEFAULT '',
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN features text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN ai_review text,
  ADD COLUMN ai_reviewed_at timestamptz,
  ADD COLUMN github_snapshot jsonb,
  ADD COLUMN github_fetched_at timestamptz,
  ADD CONSTRAINT ds_websites_category_id_fkey FOREIGN KEY(category_id) REFERENCES ds_categorys(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ds_websites_address_check CHECK (official_url IS NOT NULL OR github_url IS NOT NULL),
  ADD CONSTRAINT ds_websites_name_check CHECK (length(btrim(name)) > 0),
  ADD CONSTRAINT ds_websites_links_check CHECK (jsonb_typeof(related_links) = 'object'),
  ADD CONSTRAINT ds_websites_review_check CHECK ((ai_review IS NULL) = (ai_reviewed_at IS NULL)),
  ADD CONSTRAINT ds_websites_snapshot_check CHECK ((github_snapshot IS NULL) = (github_fetched_at IS NULL) AND (github_snapshot IS NULL OR jsonb_typeof(github_snapshot) = 'object')),
  ADD CONSTRAINT ds_websites_tags_check CHECK (tags <@ ARRAY['开源','可自部署','无需注册','离线可用','本地处理','中文支持','提供API','浏览器扩展','命令行','需付费']::text[]);
CREATE UNIQUE INDEX ds_websites_official_url_key ON ds_websites(official_url) WHERE official_url IS NOT NULL;
CREATE UNIQUE INDEX ds_websites_github_url_key ON ds_websites(github_url) WHERE github_url IS NOT NULL;
CREATE INDEX ds_websites_active_created_idx ON ds_websites(created_at DESC, id) WHERE archived_at IS NULL;
-- Preserve existing IDs of the six known categories; discard no other service data.
DELETE FROM ds_categorys WHERE name NOT IN ('AI 与智能','开发与开源','创作与设计','学习与知识','媒体与内容','隐私与安全','其它');
INSERT INTO ds_categorys(name, sort) VALUES
 ('AI 与智能',70),('开发与开源',60),('创作与设计',50),('学习与知识',40),('媒体与内容',30),('隐私与安全',20),('其它',0)
ON CONFLICT(name) DO UPDATE SET sort = EXCLUDED.sort;
COMMIT;
