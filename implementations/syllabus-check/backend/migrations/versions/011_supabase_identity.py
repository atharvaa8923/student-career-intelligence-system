"""Link legacy application users to Supabase Auth without changing local IDs."""
from alembic import op

revision = "011_supabase_identity"
down_revision = "010_schema_alignment"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id uuid")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_supabase_user_id ON users(supabase_user_id) WHERE supabase_user_id IS NOT NULL")
    op.execute("COMMENT ON COLUMN users.supabase_user_id IS 'Stable link to auth.users.id; existing application primary keys remain unchanged.'")


def downgrade():
    raise RuntimeError("Preserve identity links; restore a reviewed backup instead of dropping this column")
