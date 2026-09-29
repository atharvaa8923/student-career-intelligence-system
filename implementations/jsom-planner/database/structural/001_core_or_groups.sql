-- Structural repair only. Safe to replay; does not reset catalog/student data.
BEGIN;
ALTER TABLE program_core_courses
  ADD COLUMN IF NOT EXISTS or_group_id INTEGER DEFAULT 0;
UPDATE program_core_courses SET or_group_id = 0 WHERE or_group_id IS NULL;
ALTER TABLE program_core_courses ALTER COLUMN or_group_id SET DEFAULT 0;
ALTER TABLE program_core_courses ALTER COLUMN or_group_id SET NOT NULL;
COMMIT;
