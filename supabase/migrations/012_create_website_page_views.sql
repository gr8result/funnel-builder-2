-- Track page views for published websites
CREATE TABLE IF NOT EXISTS website_page_views (
  id bigserial PRIMARY KEY,
  project_id text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wpv_project ON website_page_views(project_id);
