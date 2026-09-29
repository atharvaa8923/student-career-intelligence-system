"""Focused public-feed collection for ITM and Business Analytics evidence."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from html import unescape
import re

import httpx

from services.reports.market_alignment import JOB_SOURCES, classify_job


SKILL_PATTERNS = {
    "SQL": (r"\bsql\b",),
    "Python": (r"\bpython\b",),
    "R": (r"\br programming\b", r"\busing r\b"),
    "Excel": (r"\bexcel\b", r"\bspreadsheets?\b"),
    "Tableau": (r"\btableau\b",),
    "Power BI": (r"\bpower\s*bi\b",),
    "SAP": (r"\bsap\b", r"\bs\/4hana\b"),
    "ERP": (r"\berp\b", r"enterprise resource planning"),
    "Salesforce": (r"\bsalesforce\b",),
    "AWS": (r"\baws\b", r"amazon web services"),
    "Azure": (r"\bazure\b",),
    "Google Cloud": (r"\bgcp\b", r"google cloud"),
    "Snowflake": (r"\bsnowflake\b",),
    "Databricks": (r"\bdatabricks\b",),
    "Data Visualization": (r"data visuali[sz]ation", r"visuali[sz]e data"),
    "Business Intelligence": (r"business intelligence", r"\bbi solutions?\b",),
    "Data Analysis": (r"data analy(?:sis|tics)", r"analy[sz]e data"),
    "Statistics": (r"\bstatistics?\b", r"statistical analysis"),
    "Machine Learning": (r"machine learning", r"\bml models?\b"),
    "ETL": (r"\betl\b", r"extract[, ]+transform[, ]+and load"),
    "Data Warehousing": (r"data warehouse", r"data warehousing"),
    "Data Governance": (r"data governance",),
    "Data Quality": (r"data quality",),
    "Requirements Gathering": (r"requirements gathering", r"gather(?:ing)? (?:business )?requirements"),
    "Business Process Modeling": (r"process model", r"\bbpmn\b", r"business process"),
    "UML": (r"\buml\b",),
    "Agile": (r"\bagile\b",),
    "Scrum": (r"\bscrum\b",),
    "Jira": (r"\bjira\b",),
    "Confluence": (r"\bconfluence\b",),
    "Project Management": (r"project management", r"manage projects"),
    "Stakeholder Management": (r"stakeholder management", r"manage stakeholders", r"stakeholder engagement"),
    "Change Management": (r"change management",),
    "Risk Management": (r"risk management", r"risk analysis"),
    "Communication": (r"communication skills", r"written and verbal communication"),
    "Presentation": (r"presentation skills", r"present findings"),
    "REST API": (r"\brest(?:ful)? api", r"\bapis?\b"),
    "Git": (r"\bgit\b", r"github"),
    "Java": (r"\bjava\b",),
    "Cloud Computing": (r"cloud computing", r"cloud platform"),
}

SKILL_CATEGORY = {
    "SQL": "Data", "Python": "Data", "R": "Data", "Excel": "Analytics",
    "Tableau": "Analytics", "Power BI": "Analytics", "Data Visualization": "Analytics",
    "Business Intelligence": "Analytics", "Data Analysis": "Analytics", "Statistics": "Analytics",
    "Machine Learning": "Analytics", "ETL": "Data Engineering", "Data Warehousing": "Data Engineering",
    "Data Governance": "Data Management", "Data Quality": "Data Management", "Snowflake": "Data Engineering",
    "Databricks": "Data Engineering", "SAP": "Enterprise Systems", "ERP": "Enterprise Systems",
    "Salesforce": "Enterprise Systems", "Requirements Gathering": "Business Analysis",
    "Business Process Modeling": "Business Analysis", "UML": "Business Analysis",
    "Agile": "Delivery", "Scrum": "Delivery", "Jira": "Delivery", "Confluence": "Delivery",
    "Project Management": "Delivery", "Stakeholder Management": "Professional Skills",
    "Change Management": "Professional Skills", "Risk Management": "Business Analysis",
    "Communication": "Professional Skills", "Presentation": "Professional Skills",
    "AWS": "Cloud", "Azure": "Cloud", "Google Cloud": "Cloud", "Cloud Computing": "Cloud",
    "REST API": "Technology", "Git": "Technology", "Java": "Technology",
}


def plain_text(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", unescape(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def extract_description_skills(description: str) -> list[dict]:
    """Extract only explicit description mentions; never infer from a title."""
    text = plain_text(description).lower()
    found = []
    for skill, patterns in SKILL_PATTERNS.items():
        if any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns):
            found.append({"skill": skill, "category": SKILL_CATEGORY.get(skill, "Other")})
    return found


def parse_datetime(value) -> datetime | None:
    if not value:
        return None
    if isinstance(value, (int, float)):
        if value > 100_000_000_000:
            value = value / 1000
        return datetime.fromtimestamp(value, tz=timezone.utc).replace(tzinfo=None)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def normalized_job(*, source: str, external_id, title, company, location, description,
                   url, posted_at=None, is_remote=False, role_type="unspecified", country="Unspecified") -> dict | None:
    """Normalize one source record and retain only explicit ITM/BA titles with substantive descriptions."""
    title = plain_text(str(title or ""))
    description = plain_text(str(description or ""))
    program, family = classify_job(title)
    if not external_id or not program or len(description) < 100:
        return None
    return {
        "external_id": str(external_id)[:500],
        "source": source,
        "title": title[:500],
        "company": plain_text(str(company or ""))[:255],
        "location": plain_text(str(location or "Unspecified"))[:255],
        "country": plain_text(str(country or "Unspecified"))[:100],
        "is_remote": bool(is_remote),
        "role_type": plain_text(str(role_type or "unspecified"))[:100],
        "domain": "Information Systems" if program == "itm" else "Organizations, Strategy & Intl Mgmt",
        "description": description[:20000],
        "url": str(url or "")[:1000],
        "posted_at": parse_datetime(posted_at),
        "scraped_at": datetime.now(timezone.utc).replace(tzinfo=None),
        "program": program,
        "role_family": family,
        "skills": extract_description_skills(description),
    }


async def collect_arbeitnow(client: httpx.AsyncClient, pages: int) -> list[dict]:
    responses = await asyncio.gather(*[
        client.get(JOB_SOURCES["arbeitnow"]["api_url"], params={"page": page})
        for page in range(1, pages + 1)
    ])
    jobs = []
    for response in responses:
        response.raise_for_status()
        for item in response.json().get("data", []):
            job = normalized_job(
                source="arbeitnow", external_id=item.get("slug") or item.get("url"),
                title=item.get("title"), company=item.get("company_name"), location=item.get("location"),
                description=item.get("description"), url=item.get("url"), posted_at=item.get("created_at"),
                is_remote=item.get("remote"), role_type="full-time",
            )
            if job: jobs.append(job)
    return jobs


async def collect_remotive(client: httpx.AsyncClient) -> list[dict]:
    response = await client.get(JOB_SOURCES["remotive"]["api_url"], params={"limit": 200})
    response.raise_for_status()
    jobs = []
    for item in response.json().get("jobs", []):
        job = normalized_job(
            source="remotive", external_id=item.get("id") or item.get("url"), title=item.get("title"),
            company=item.get("company_name"), location=item.get("candidate_required_location"),
            description=item.get("description"), url=item.get("url"), posted_at=item.get("publication_date"),
            is_remote=True, role_type=item.get("job_type"),
        )
        if job: jobs.append(job)
    return jobs


async def collect_remoteok(client: httpx.AsyncClient) -> list[dict]:
    response = await client.get(JOB_SOURCES["remoteok"]["api_url"], headers={"User-Agent": "SyllabusCheck/1.0"})
    response.raise_for_status()
    payload = response.json()
    jobs = []
    for item in payload if isinstance(payload, list) else []:
        if not isinstance(item, dict) or not item.get("position"):
            continue
        job = normalized_job(
            source="remoteok", external_id=item.get("id") or item.get("slug") or item.get("url"),
            title=item.get("position"), company=item.get("company"), location=item.get("location") or "Remote",
            description=item.get("description"), url=item.get("url") or item.get("apply_url"),
            posted_at=item.get("date") or item.get("epoch"), is_remote=True,
            role_type="remote",
        )
        if job: jobs.append(job)
    return jobs


async def collect_jobicy(client: httpx.AsyncClient) -> list[dict]:
    response = await client.get(JOB_SOURCES["jobicy"]["api_url"], params={"count": 200})
    response.raise_for_status()
    jobs = []
    for item in response.json().get("jobs", []):
        job_types = item.get("jobType") or []
        job = normalized_job(
            source="jobicy", external_id=item.get("id") or item.get("url"), title=item.get("jobTitle"),
            company=item.get("companyName"), location=item.get("jobGeo") or "Remote",
            description=item.get("jobDescription"), url=item.get("url"), posted_at=item.get("pubDate"),
            is_remote=True, role_type=", ".join(job_types) if isinstance(job_types, list) else job_types,
        )
        if job: jobs.append(job)
    return jobs


async def collect_himalayas(client: httpx.AsyncClient, pages: int) -> list[dict]:
    jobs = []
    cursor = None
    for _ in range(pages):
        params = {"limit": 20}
        if cursor:
            params["cursor"] = cursor
        response = await client.get(JOB_SOURCES["himalayas"]["api_url"], params=params)
        response.raise_for_status()
        payload = response.json()
        for item in payload.get("jobs", []):
            restrictions = item.get("locationRestrictions") or []
            locations = [entry.get("name", "") for entry in restrictions if isinstance(entry, dict)]
            job = normalized_job(
                source="himalayas", external_id=item.get("guid") or item.get("applicationLink"),
                title=item.get("title"), company=item.get("companyName"),
                location=", ".join(filter(None, locations)) or "Worldwide",
                description=item.get("description"), url=item.get("applicationLink"),
                posted_at=item.get("pubDate"), is_remote=True, role_type=item.get("employmentType"),
            )
            if job: jobs.append(job)
        cursor = payload.get("nextCursor")
        if not cursor:
            break
    return jobs


async def collect_focused_market_jobs(pages: int = 5, sources: tuple[str, ...] | None = None) -> list[dict]:
    """Collect attributed, description-backed ITM/BA listings from independent public feeds."""
    pages = max(1, min(pages, 10))
    requested = sources or tuple(JOB_SOURCES)
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        collector_factories = {
            "arbeitnow": lambda: collect_arbeitnow(client, pages),
            "remotive": lambda: collect_remotive(client),
            "remoteok": lambda: collect_remoteok(client),
            "jobicy": lambda: collect_jobicy(client),
            "himalayas": lambda: collect_himalayas(client, pages),
        }
        selected = [(name, collector_factories[name]()) for name in requested if name in collector_factories]
        results = await asyncio.gather(*(collector for _, collector in selected), return_exceptions=True)

    unique: dict[tuple[str, str], dict] = {}
    for (source, _), result in zip(selected, results):
        if isinstance(result, Exception):
            continue
        for job in result:
            unique[(source, job["external_id"])] = job
    return list(unique.values())
