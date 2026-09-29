"""Evidence-based ITM and Business Analytics market alignment reporting."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
import re
from typing import Any


PROGRAMS = {
    "itm": {
        "name": "Information Technology and Management (ITM)",
        "domains": {"Information Systems"},
        "roles": {
            "Business Systems Analyst": ("business systems analyst", "business system analyst"),
            "Systems Analyst": ("systems analyst", "system analyst", "application systems analyst", "computer systems analyst"),
            "IT Project / Program Manager": (
                "it project manager", "technical project manager", "technology project manager",
                "it program manager", "technical program manager", "technology program manager",
                "digital project manager", "implementation project manager",
            ),
            "ERP / Enterprise Systems": (
                "erp analyst", "erp consultant", "enterprise systems analyst", "enterprise applications analyst",
                "sap analyst", "sap consultant", "oracle applications consultant", "workday analyst",
            ),
            "Technology Consultant": (
                "technology consultant", "it consultant", "technical consultant", "digital transformation consultant",
                "information systems consultant", "solutions consultant", "implementation consultant",
            ),
            "IT Operations / Service Management": (
                "it operations analyst", "it operations manager", "information technology specialist", "it analyst",
                "it service manager", "it service management", "service delivery manager", "technology operations analyst",
            ),
            "Product / Technology Analyst": (
                "technology analyst", "technical analyst", "it product analyst", "product operations analyst",
                "digital product analyst",
            ),
            "Cloud / Solutions Architecture": (
                "cloud analyst", "cloud consultant", "cloud solutions architect", "solutions architect",
                "enterprise architect", "technology architect",
            ),
            "Cybersecurity / IT Risk": (
                "information security analyst", "cybersecurity analyst", "it risk analyst", "technology risk analyst",
                "governance risk and compliance analyst", "grc analyst",
            ),
            "Database / Data Systems": (
                "database administrator", "database analyst", "data systems analyst", "data platform analyst",
            ),
        },
    },
    "ba": {
        "name": "Business Analytics (BA)",
        "domains": {"Information Systems", "Organizations, Strategy & Intl Mgmt"},
        "roles": {
            "Business Analyst": ("business analyst", "business process analyst", "business requirements analyst"),
            "Data Analyst": ("data analyst", "analytics analyst", "reporting analyst", "insights analyst"),
            "Business Intelligence Analyst": (
                "business intelligence analyst", "bi analyst", "business intelligence developer", "bi developer",
                "business intelligence consultant",
            ),
            "Analytics Consultant": (
                "analytics consultant", "business analytics consultant", "data analytics consultant",
                "decision science consultant",
            ),
            "Product Analyst": ("product analyst", "product analytics analyst", "digital product analyst"),
            "Operations / Supply Chain Analyst": (
                "operations analyst", "operational analyst", "supply chain analyst", "logistics analyst",
                "workforce analyst", "planning analyst",
            ),
            "Risk / Decision Analyst": (
                "risk analyst", "decision analyst", "decision scientist", "fraud analyst", "credit risk analyst",
            ),
            "Marketing / Customer Analyst": (
                "marketing analyst", "customer insights analyst", "consumer insights analyst", "crm analyst",
                "growth analyst", "web analytics analyst",
            ),
            "Financial / Revenue Analyst": (
                "financial data analyst", "revenue analyst", "pricing analyst", "sales operations analyst",
                "commercial analyst",
            ),
            "People Analytics Analyst": ("people analytics analyst", "hr analytics analyst", "workforce analytics analyst"),
            "Data Visualization Analyst": ("data visualization analyst", "tableau analyst", "power bi analyst"),
        },
    },
}

JOB_SOURCES = {
    "arbeitnow": {
        "name": "Arbeitnow",
        "homepage": "https://www.arbeitnow.com/",
        "api_url": "https://www.arbeitnow.com/api/job-board-api",
        "attribution": "Public job-board API; retain the original listing URL.",
    },
    "remotive": {
        "name": "Remotive",
        "homepage": "https://remotive.com/remote-jobs",
        "api_url": "https://remotive.com/api/remote-jobs",
        "attribution": "Mention Remotive as the source and link to the Remotive listing.",
    },
    "remoteok": {
        "name": "Remote OK",
        "homepage": "https://remoteok.com/",
        "api_url": "https://remoteok.com/api",
        "attribution": "Credit Remote OK and retain the original job-post URL.",
    },
    "jobicy": {
        "name": "Jobicy",
        "homepage": "https://jobicy.com/",
        "api_url": "https://jobicy.com/api/v2/remote-jobs",
        "attribution": "Credit Jobicy and preserve the canonical Jobicy listing URL.",
    },
    "himalayas": {
        "name": "Himalayas",
        "homepage": "https://himalayas.app/jobs",
        "api_url": "https://himalayas.app/jobs/api",
        "attribution": "Mention Himalayas as the source and link back to the original listing.",
    },
}

STATUS_VALUE = {"missing": 0.0, "partial": 0.5, "covered": 1.0}


def classify_job(title: str) -> tuple[str | None, str | None]:
    """Classify a title using the most specific matching ITM/BA phrase."""
    normalized = re.sub(r"[^a-z0-9]+", " ", (title or "").lower()).strip()
    matches: list[tuple[int, int, str, str]] = []
    for program_key in ("itm", "ba"):
        for family, phrases in PROGRAMS[program_key]["roles"].items():
            for phrase in phrases:
                if re.search(rf"\b{re.escape(phrase)}\b", normalized):
                    program_priority = 1 if program_key == "itm" else 0
                    matches.append((len(phrase.split()), program_priority, program_key, family))
    if matches:
        _, _, program_key, family = max(matches)
        return program_key, family
    return None, None


def build_market_alignment(
    jobs: list[dict[str, Any]],
    skill_mentions: list[dict[str, Any]],
    courses: list[dict[str, Any]],
    coverage_rows: list[dict[str, Any]],
    program: str = "all",
) -> dict[str, Any]:
    selected = {"itm", "ba"} if program == "all" else {program}
    classified: dict[str, tuple[str, str]] = {}
    selected_jobs: list[dict[str, Any]] = []
    for job in jobs:
        program_key, family = classify_job(job.get("title", ""))
        if not program_key or program_key not in selected:
            continue
        job_id = str(job["id"])
        classified[job_id] = (program_key, family)
        selected_jobs.append(job)

    jobs_by_program = Counter(v[0] for v in classified.values())
    role_counts: dict[str, Counter] = {key: Counter() for key in selected}
    title_counts: dict[str, Counter] = {key: Counter() for key in selected}
    for program_key, family in classified.values():
        role_counts[program_key][family] += 1
    for job in selected_jobs:
        program_key, _ = classified[str(job["id"])]
        title = re.sub(r"\s+", " ", (job.get("title") or "Untitled role")).strip()
        title_counts[program_key][title] += 1

    job_skill_sets: dict[tuple[str, str], set[str]] = defaultdict(set)
    skill_details: dict[tuple[str, str], dict[str, Any]] = {}
    for row in skill_mentions:
        job_id = str(row["job_id"])
        if job_id not in classified:
            continue
        program_key, _ = classified[job_id]
        normalized = (row.get("normalized") or row.get("text") or "").strip().lower()
        if not normalized:
            continue
        job_skill_sets[(program_key, normalized)].add(job_id)
        skill_details[(program_key, normalized)] = {
            "keyword_id": str(row["keyword_id"]),
            "skill": row.get("text") or normalized,
            "category": row.get("category") or row.get("domain") or "Other",
            "importance": row.get("importance") or "unspecified",
            "is_emerging": bool(row.get("is_emerging")),
        }

    best_coverage: dict[str, dict[str, Any]] = {}
    for row in coverage_rows:
        keyword_id = str(row["keyword_id"])
        value = STATUS_VALUE.get(row.get("status", "missing"), 0.0)
        previous = best_coverage.get(keyword_id)
        if previous is None or value > previous["value"]:
            best_coverage[keyword_id] = {
                "value": value,
                "status": row.get("status", "missing"),
                "course_title": row.get("course_title"),
                "course_code": row.get("course_code"),
                "similarity_score": row.get("similarity_score"),
            }

    program_sections = []
    all_missing: list[dict[str, Any]] = []
    for program_key in sorted(selected):
        total_jobs = jobs_by_program[program_key]
        skills = []
        weighted_total = 0
        weighted_covered = 0.0
        for (key, normalized), job_ids in job_skill_sets.items():
            if key != program_key:
                continue
            details = skill_details[(key, normalized)]
            mentions = len(job_ids)
            coverage = best_coverage.get(details["keyword_id"])
            status = coverage["status"] if coverage else "not_assessed"
            if courses:
                weighted_total += mentions
                weighted_covered += mentions * (coverage["value"] if coverage else 0.0)
            item = {
                **details,
                "job_mentions": mentions,
                "share_of_jobs_pct": round(mentions * 100 / total_jobs, 1) if total_jobs else 0.0,
                "syllabus_status": status,
                "best_course": ({
                    "title": coverage.get("course_title"),
                    "code": coverage.get("course_code"),
                    "similarity_score": coverage.get("similarity_score"),
                } if coverage else None),
            }
            skills.append(item)
        skills.sort(key=lambda item: (-item["job_mentions"], item["skill"].lower()))
        top_skills = skills[:25]
        missing = [item for item in top_skills if item["syllabus_status"] in {"missing", "not_assessed"}]
        all_missing.extend({**item, "program": program_key} for item in missing)

        score = round(weighted_covered * 100 / weighted_total, 1) if weighted_total else None
        if not courses:
            readiness = "not_assessed"
        elif score is not None and score >= 75:
            readiness = "strong_alignment"
        elif score is not None and score >= 50:
            readiness = "developing_alignment"
        else:
            readiness = "early_alignment"

        program_sections.append({
            "program": program_key,
            "program_name": PROGRAMS[program_key]["name"],
            "job_count": total_jobs,
            "key_jobs": [
                {"role": role, "count": count, "share_pct": round(count * 100 / total_jobs, 1) if total_jobs else 0.0}
                for role, count in role_counts[program_key].most_common()
            ],
            "job_titles": [
                {"title": title, "count": count}
                for title, count in title_counts[program_key].most_common(30)
            ],
            "top_skills": top_skills,
            "market_weighted_syllabus_coverage_pct": score,
            "readiness": readiness,
            "limitations": [
                "This is curriculum-to-market alignment, not a prediction that an individual will receive an offer.",
                "Individual readiness additionally depends on resume evidence, projects, experience, communication, interviewing, location, and work authorization.",
            ],
        })

    sources = Counter(job.get("source") or "unknown" for job in selected_jobs)
    locations = Counter(job.get("location") or "Unspecified" for job in selected_jobs)
    dates = [job.get("scraped_at") for job in selected_jobs if job.get("scraped_at")]
    all_missing.sort(key=lambda item: (-item["job_mentions"], item["skill"].lower()))

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": {
            "programs": [PROGRAMS[key]["name"] for key in sorted(selected)],
            "evidence_rule": "Skills are counted only when linked to a collected job description.",
            "job_count": len(selected_jobs),
            "jobs_with_descriptions": sum(1 for job in selected_jobs if len(job.get("description") or "") >= 100),
            "sources": [
                {
                    "source": name,
                    "name": JOB_SOURCES.get(name, {}).get("name", name),
                    "count": count,
                    "homepage": JOB_SOURCES.get(name, {}).get("homepage"),
                    "api_url": JOB_SOURCES.get(name, {}).get("api_url"),
                    "attribution": JOB_SOURCES.get(name, {}).get("attribution"),
                }
                for name, count in sources.most_common()
            ],
            "top_locations": [{"location": name, "count": count} for name, count in locations.most_common(10)],
            "scraped_from": min(dates).isoformat() if dates else None,
            "scraped_to": max(dates).isoformat() if dates else None,
            "sample_quality": "empty" if not selected_jobs else ("pilot" if len(selected_jobs) < 30 else "directional" if len(selected_jobs) < 100 else "broad"),
        },
        "programs": program_sections,
        "priority_actions": [
            {
                "skill": item["skill"],
                "program": item["program"],
                "job_mentions": item["job_mentions"],
                "action": "Add explicit syllabus outcomes and an assessed project demonstrating this skill.",
            }
            for item in all_missing[:10]
        ],
        "course_count": len(courses),
        "methodology": {
            "role_classification": "Job titles are mapped to explicit ITM and BA role families.",
            "skill_demand": "A skill counts at most once per job description.",
            "coverage": "Covered=1.0, partial=0.5, missing=0.0, weighted by distinct job mentions.",
            "student_outcome": "The report identifies preparation gaps; it does not guarantee employment.",
        },
    }
