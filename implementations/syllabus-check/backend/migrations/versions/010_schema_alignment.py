"""Reconcile application columns and local embedding dimensions safely."""
from alembic import op

revision = "010_schema_alignment"
down_revision = "009_programs"
branch_labels = None
depends_on = None


def upgrade():
    # Refuse to discard or truncate historical vectors. Re-embedding requires
    # a separately reviewed export/rebuild workflow for an existing database.
    op.execute("""
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM keywords
                     WHERE embedding IS NOT NULL AND vector_dims(embedding) <> 384) THEN
            RAISE EXCEPTION 'Incompatible keyword vectors: export and re-embed to 384 dimensions before migration 010';
          END IF;
        END $$;
    """)
    op.execute("ALTER TABLE keywords ALTER COLUMN embedding TYPE vector(384) USING embedding::vector(384)")
    op.execute("ALTER TABLE courses ADD COLUMN IF NOT EXISTS parsed_sections jsonb")
    op.execute("ALTER TABLE keywords ADD COLUMN IF NOT EXISTS category varchar(100)")
    op.execute("ALTER TABLE keywords ADD COLUMN IF NOT EXISTS importance varchar(50) DEFAULT 'required'")
    op.execute("ALTER TABLE keywords ADD COLUMN IF NOT EXISTS is_emerging boolean DEFAULT false")
    op.execute("UPDATE keywords SET is_emerging = false WHERE is_emerging IS NULL")
    op.execute("ALTER TABLE keywords ALTER COLUMN is_emerging SET NOT NULL")
    for table, column in [('courses', 'parsed_topics'), ('courses', 'parsed_sections'),
                          ('reports', 'filters'), ('reports', 'summary')]:
        op.execute(f'ALTER TABLE {table} ALTER COLUMN {column} TYPE jsonb USING {column}::jsonb')


def downgrade():
    raise RuntimeError('010 contains application data; restore a reviewed backup rather than dropping columns or embeddings')
