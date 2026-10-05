"""Integration tests. Requires disposable local PostgreSQL with vector installed.
Run with STEP2_PGHOST and STEP2_PGPORT; creates/drops ONLY randomly named test DBs.
Dependencies: backend Alembic/SQLAlchemy/asyncpg/pgvector/settings + psycopg2.
"""
import os
import subprocess
import sys
import unittest
import uuid
from pathlib import Path
import psycopg2
from psycopg2 import sql

ROOT = Path(__file__).resolve().parents[1]
SYLLABUS = ROOT / 'syllabus-check/backend'
JSOM = ROOT / 'jsom-planner/database'

class SchemaMigrations(unittest.TestCase):
    def setUp(self):
        self.host = os.environ['STEP2_PGHOST']
        self.port = os.environ['STEP2_PGPORT']
        self.name = 'step2_test_' + uuid.uuid4().hex[:12]
        self.admin = psycopg2.connect(host=self.host, port=self.port, dbname='postgres')
        self.admin.autocommit = True
        with self.admin.cursor() as cur:
            cur.execute(sql.SQL("CREATE DATABASE {} ENCODING 'UTF8' TEMPLATE template0").format(sql.Identifier(self.name)))
        self.db = psycopg2.connect(host=self.host, port=self.port, dbname=self.name)
        self.db.autocommit = True

    def tearDown(self):
        self.db.close()
        with self.admin.cursor() as cur:
            cur.execute(sql.SQL('DROP DATABASE {}').format(sql.Identifier(self.name)))
        self.admin.close()

    def query(self, statement, params=None):
        with self.db.cursor() as cur:
            cur.execute(statement, params)
            return cur.fetchall() if cur.description else None

    def migrate(self, revision='head', expect_success=True):
        env = dict(os.environ, DATABASE_URL=f'postgresql+asyncpg:///{self.name}?host={self.host}&port={self.port}')
        result = subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', revision],
                                cwd=SYLLABUS, env=env, capture_output=True, text=True)
        if expect_success:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        return result

    def test_syllabus_fresh_and_repeat(self):
        self.migrate()
        self.migrate()
        self.assertEqual(self.query('SELECT version_num FROM alembic_version')[0][0], '011_supabase_identity')
        self.assertEqual(self.query("SELECT data_type FROM information_schema.columns WHERE table_name='users' AND column_name='supabase_user_id'"), [('uuid',)])
        # Every model column must exist and be readable using its declared type.
        env = dict(os.environ, DATABASE_URL=f'postgresql+asyncpg:///{self.name}?host={self.host}&port={self.port}')
        check = '''import asyncio
from sqlalchemy import select
from core.database import AsyncSessionLocal, engine, Base
import models.models
async def main():
    async with AsyncSessionLocal() as db:
        for table in Base.metadata.sorted_tables:
            await db.execute(select(table).limit(1))
    await engine.dispose()
asyncio.run(main())
'''
        result=subprocess.run([sys.executable,'-c',check],cwd=SYLLABUS,env=env,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.query("INSERT INTO keywords(text, normalized, embedding) VALUES ('test','test',%s::vector)", ('['+','.join(['0']*384)+']',))
        self.assertEqual(self.query('SELECT vector_dims(embedding), is_emerging, importance FROM keywords')[0],(384,False,'required'))
        types=dict(self.query("SELECT column_name,udt_name FROM information_schema.columns WHERE table_name='courses'"))
        self.assertEqual(types['parsed_sections'],'jsonb')
        self.assertEqual(types['parsed_topics'],'jsonb')

    def test_syllabus_incompatible_vectors_preserved(self):
        self.migrate('009_programs')
        self.query("INSERT INTO keywords(text, normalized, embedding) VALUES ('legacy','legacy',%s::vector)", ('['+','.join(['0']*1536)+']',))
        failed=self.migrate(expect_success=False)
        self.assertIn('Incompatible keyword vectors',failed.stderr)
        self.assertEqual(self.query('SELECT vector_dims(embedding) FROM keywords')[0][0],1536)
        self.assertEqual(self.query('SELECT version_num FROM alembic_version')[0][0],'009_programs')

    def test_jsom_bootstrap_seed_and_nondestructive_repair(self):
        self.query((JSOM/'schema.sql').read_text())
        self.query((JSOM/'structural/001_core_or_groups.sql').read_text())
        # Original seed is deliberately destructive: only execute in this test DB.
        self.query((JSOM/'seed.sql').read_text())
        before = self.query('SELECT (SELECT count(*) FROM students), (SELECT count(*) FROM courses), (SELECT count(*) FROM program_core_courses)')[0]
        self.assertGreater(before[1],0)
        self.query('UPDATE program_core_courses SET or_group_id=7 WHERE id=(SELECT id FROM program_core_courses LIMIT 1)')
        self.query((JSOM/'structural/001_core_or_groups.sql').read_text())
        self.assertEqual(before,self.query('SELECT (SELECT count(*) FROM students), (SELECT count(*) FROM courses), (SELECT count(*) FROM program_core_courses)')[0])
        self.assertEqual(self.query('SELECT count(*) FROM program_core_courses WHERE or_group_id=7')[0][0],1)
        self.query('SELECT or_group_id FROM program_core_courses LIMIT 1')
        self.query('SELECT * FROM student_progress LIMIT 1')
        self.query('REFRESH MATERIALIZED VIEW course_graph')

if __name__ == '__main__': unittest.main(verbosity=2)
