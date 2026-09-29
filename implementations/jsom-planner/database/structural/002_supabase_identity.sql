BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_supabase_user_id ON users(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
COMMENT ON COLUMN users.supabase_user_id IS 'Stable link to auth.users.id; existing application primary keys remain unchanged.';
COMMIT;
