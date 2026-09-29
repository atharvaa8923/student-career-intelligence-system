"""Idempotently import a focused ITM/BA public-feed sample and explicit skills."""
import asyncio
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from core.config import settings
from services.scraper.focused_market import collect_focused_market_jobs


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


async def main():
    jobs = await collect_focused_market_jobs(pages=5)
    inserted = updated = links = 0
    sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    sync_engine = create_engine(
        sync_url,
        pool_pre_ping=True,
        connect_args={"sslmode": "verify-full", "sslrootcert": settings.DB_SSL_CA} if settings.DB_SSL_CA else {},
    )
    with Session(sync_engine) as db:
        for payload in jobs:
            fields = {key: value for key, value in payload.items() if key not in {"skills", "program", "role_family"}}
            existed = db.execute(text(
                "SELECT 1 FROM syllabus.job_postings WHERE source=:source AND external_id=:external_id"
            ), fields).first() is not None
            job_id = db.execute(text("""
                INSERT INTO syllabus.job_postings
                  (source,external_id,title,company,location,city,state,country,is_remote,role_type,domain,description,url,posted_at,scraped_at)
                VALUES
                  (:source,:external_id,:title,:company,:location,NULL,NULL,:country,:is_remote,:role_type,:domain,:description,:url,:posted_at,:scraped_at)
                ON CONFLICT (source,external_id) DO UPDATE SET
                  title=excluded.title,company=excluded.company,location=excluded.location,country=excluded.country,
                  is_remote=excluded.is_remote,role_type=excluded.role_type,domain=excluded.domain,
                  description=excluded.description,url=excluded.url,posted_at=excluded.posted_at,scraped_at=excluded.scraped_at
                RETURNING id
            """), fields).scalar_one()
            if existed: updated += 1
            else: inserted += 1
            for item in payload["skills"]:
                key = normalized(item["skill"])
                keyword_id = db.execute(text("""
                    INSERT INTO syllabus.keywords
                      (normalized_keyword,text,category,domain,importance,is_emerging,frequency)
                    VALUES (:normalized,:skill,:category,:domain,'explicit',false,0)
                    ON CONFLICT (normalized_keyword) DO UPDATE SET
                      text=excluded.text,category=excluded.category
                    RETURNING id
                """), {
                    "normalized": key, "skill": item["skill"],
                    "category": item["category"], "domain": fields["domain"],
                }).scalar_one()
                link = db.execute(text("""
                    INSERT INTO syllabus.job_keywords(job_id,keyword_id,relevance)
                    VALUES (:job_id,:keyword_id,1.0)
                    ON CONFLICT DO NOTHING
                    RETURNING keyword_id
                """), {"job_id": job_id, "keyword_id": keyword_id}).first()
                if link:
                    db.execute(text(
                        "UPDATE syllabus.keywords SET frequency=frequency+1 WHERE id=:id"
                    ), {"id": keyword_id})
                    links += 1
        db.commit()
    print({"qualified_jobs": len(jobs), "inserted": inserted, "updated": updated, "skill_links_added": links})


if __name__ == "__main__":
    asyncio.run(main())
