-- Maps an authenticated user's email to a role and (for crew users) a crew.
-- backend/access.ts reads this table on every call; nothing the client sends
-- can change a user's role or crew.
CREATE TABLE IF NOT EXISTS app_users (
  email   TEXT PRIMARY KEY,
  role    TEXT NOT NULL CHECK (role IN ('manager', 'crew')),
  crew_id INT REFERENCES crews (id),
  -- crew users must be tied to exactly one crew; managers have no crew
  CHECK ((role = 'crew' AND crew_id IS NOT NULL) OR (role = 'manager' AND crew_id IS NULL))
);

-- Example rows (fictional addresses)
INSERT INTO app_users (email, role, crew_id) VALUES
  ('manager@summitridge.example.com', 'manager', NULL),
  ('crew1@summitridge.example.com',   'crew',    1)
ON CONFLICT (email) DO NOTHING;
