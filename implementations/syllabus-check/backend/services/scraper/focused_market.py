"""Focused public-feed collection for ITM and Business Analytics evidence."""
from __future__ import annotations

from datetime import datetime, timezone
from html import unescape
import re

import httpx

from services.reports.market_alignment import classify_job


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


async def collect_focused_market_jobs(pages: int = 5) -> list[dict]:
    """Collect description-backed ITM/BA listings from Arbeitnow's public API."""
    pages = max(1, min(pages, 10))
    async with httpx.AsyncClient(timeout=45, follow_redirects=True) as client:
        responses = [await client.get("https://www.arbeitnow.com/api/job-board-api", params={"page": page}) for page in range(1, pages + 1)]
    unique = {}
    for response in responses:
        response.raise_for_status()
        for item in response.json().get("data", []):
            external_id = str(item.get("slug") or item.get("url") or "")
            title = item.get("title") or ""
            description = plain_text(item.get("description") or "")
            program, family = classify_job(title)
            if not external_id or not program or len(description) < 100:
                continue
            unique[external_id] = {
                "external_id": external_id,
                "source": "arbeitnow",
                "title": title[:500],
                "company": (item.get("company_name") or "")[:255],
                "location": (item.get("location") or "")[:255],
                "country": "Unspecified",
                "is_remote": bool(item.get("remote")),
                "role_type": "full-time",
                "domain": "Information Systems" if program == "itm" else "Organizations, Strategy & Intl Mgmt",
                "description": description[:20000],
                "url": (item.get("url") or "")[:1000],
                "posted_at": None,
                "scraped_at": datetime.now(timezone.utc).replace(tzinfo=None),
                "program": program,
                "role_family": family,
                "skills": extract_description_skills(description),
            }
    return list(unique.values())
