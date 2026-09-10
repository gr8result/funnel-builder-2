-- Reload PostgREST's schema cache so the freedom_* tables created by
-- 20260910120000 become visible to the REST API. Without this the API reports
-- PGRST205 ("could not find the table") even though the tables exist.
--
-- Same pattern as 20260901000200 after the client portal migration.
notify pgrst, 'reload schema';
