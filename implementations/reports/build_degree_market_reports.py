"""Build separate attributed ITM and BA market reports from the public-feed collector."""
from __future__ import annotations

import asyncio
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
import sys

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "syllabus-check" / "backend"
sys.path.insert(0, str(BACKEND))

from services.reports.market_alignment import JOB_SOURCES, PROGRAMS  # noqa: E402
from services.scraper.focused_market import collect_focused_market_jobs  # noqa: E402

OUTPUT_DIR = Path(__file__).resolve().parent
NAVY = "17365D"
PALE = "F4F7FA"
GRAY = "D9D9D9"
ORANGE = "C75B12"
WHITE = "FFFFFF"
BLACK = "000000"


def shade(cell, fill):
    props = cell._tc.get_or_add_tcPr()
    node = props.find(qn("w:shd"))
    if node is None:
        node = OxmlElement("w:shd")
        props.append(node)
    node.set(qn("w:fill"), fill)


def border(cell):
    props = cell._tc.get_or_add_tcPr()
    borders = props.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        props.append(borders)
    for edge in ("top", "left", "bottom", "right"):
        node = OxmlElement(f"w:{edge}")
        node.set(qn("w:val"), "single")
        node.set(qn("w:sz"), "6")
        node.set(qn("w:color"), GRAY)
        borders.append(node)


def cell_text(cell, value, *, bold=False, color=BLACK, align=WD_ALIGN_PARAGRAPH.LEFT):
    cell.text = ""
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = cell.paragraphs[0]
    p.alignment = align
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(str(value))
    run.bold = bold
    run.font.name = "Aptos"
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor.from_string(color)


def table(doc, headers, rows, widths, numeric=()):
    result = doc.add_table(rows=1, cols=len(headers))
    result.alignment = WD_TABLE_ALIGNMENT.CENTER
    result.autofit = False
    for index, header in enumerate(headers):
        cell = result.rows[0].cells[index]
        cell.width = Inches(widths[index])
        shade(cell, NAVY)
        border(cell)
        cell_text(cell, header, bold=True, color=WHITE, align=WD_ALIGN_PARAGRAPH.CENTER)
    for row_index, row in enumerate(rows):
        cells = result.add_row().cells
        for index, value in enumerate(row):
            cell = cells[index]
            cell.width = Inches(widths[index])
            shade(cell, WHITE if row_index % 2 == 0 else PALE)
            border(cell)
            cell_text(cell, value, align=WD_ALIGN_PARAGRAPH.CENTER if index in numeric else WD_ALIGN_PARAGRAPH.LEFT)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def configure(doc: Document, program_name: str):
    section = doc.sections[0]
    section.top_margin = Inches(0.72)
    section.bottom_margin = Inches(0.72)
    section.left_margin = Inches(0.78)
    section.right_margin = Inches(0.78)
    normal = doc.styles["Normal"]
    normal.font.name = "Aptos"
    normal.font.size = Pt(10)
    normal.font.color.rgb = RGBColor.from_string("263238")
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.12
    title = doc.styles["Title"]
    title.font.name = "Aptos Display"
    title.font.size = Pt(27)
    title.font.bold = True
    title.font.color.rgb = RGBColor.from_string(BLACK)
    for name, size in (("Heading 1", 17), ("Heading 2", 12.5)):
        style = doc.styles[name]
        style.font.name = "Aptos Display"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(BLACK)
        style.paragraph_format.keep_with_next = True
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = footer.add_run(f"SyllabusCheck  |  {program_name} Market Alignment Report")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor.from_string("6B7280")


def add_metrics(doc, metrics):
    result = doc.add_table(rows=1, cols=len(metrics))
    result.alignment = WD_TABLE_ALIGNMENT.CENTER
    result.autofit = False
    for index, (value, label) in enumerate(metrics):
        cell = result.rows[0].cells[index]
        cell.width = Inches(6.5 / len(metrics))
        shade(cell, PALE)
        border(cell)
        cell.text = ""
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(str(value))
        r.bold = True
        r.font.size = Pt(21)
        r.font.color.rgb = RGBColor.from_string(ORANGE)
        p2 = cell.add_paragraph(label)
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p2.runs[0].font.size = Pt(8)


def build_report(program: str, all_jobs: list[dict]) -> Path:
    jobs = [job for job in all_jobs if job["program"] == program]
    program_name = PROGRAMS[program]["name"]
    families = Counter(job["role_family"] for job in jobs)
    titles = Counter(job["title"] for job in jobs)
    sources = Counter(job["source"] for job in jobs)
    skills: dict[str, set[str]] = defaultdict(set)
    categories = {}
    for job in jobs:
        for item in job["skills"]:
            skills[item["skill"]].add(f'{job["source"]}:{job["external_id"]}')
            categories[item["skill"]] = item["category"]

    doc = Document()
    configure(doc, program_name)
    doc.add_paragraph(f"{program_name} Market Alignment Report", style="Title")
    subtitle = doc.add_paragraph("Job-title demand, explicit skills, sources, and curriculum-readiness framework")
    subtitle.runs[0].bold = True
    subtitle.runs[0].font.size = Pt(13)
    subtitle.runs[0].font.color.rgb = RGBColor.from_string(NAVY)
    meta = doc.add_paragraph(f"Prepared for SyllabusCheck  |  {datetime.now(timezone.utc).strftime('%d %B %Y')}  |  Live public-feed sample")
    for run in meta.runs:
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor.from_string("6B7280")

    doc.add_heading("Executive Summary", level=1)
    doc.add_paragraph(
        f"This degree-specific report analyzes {len(jobs)} qualifying {program_name} job descriptions from "
        f"{len(sources)} active public feeds. The sample represents {len(titles)} distinct job titles across "
        f"{len(families)} role families. Skills are counted only when explicitly present in a job description."
    )
    doc.add_paragraph(
        "The evidence is suitable for identifying current role and skill signals in the collected sample. It does not "
        "predict hiring outcomes. Curriculum coverage remains not assessed until the applicable syllabi are uploaded and reviewed."
    )
    add_metrics(doc, [
        (len(jobs), "Qualified jobs"), (len(titles), "Distinct titles"),
        (len(families), "Role families"), (len(sources), "Active sources"),
    ])

    doc.add_heading("Job Families", level=1)
    table(doc, ["Role family", "Jobs", "Share"], [
        (name, count, f"{count * 100 / len(jobs):.1f}%") for name, count in families.most_common()
    ], [4.25, 1.0, 1.25], numeric=(1, 2))

    doc.add_page_break()
    doc.add_heading("Job Titles Represented", level=1)
    table(doc, ["Job title", "Listings"], titles.most_common(30), [5.35, 1.15], numeric=(1,))

    doc.add_heading("Skills Found in Job Descriptions", level=1)
    skill_rows = sorted(
        ((skill, categories[skill], len(job_ids), f"{len(job_ids) * 100 / len(jobs):.1f}%") for skill, job_ids in skills.items()),
        key=lambda row: (-row[2], row[0].lower()),
    )[:20]
    table(doc, ["Skill", "Category", "Jobs", "Demand share"], skill_rows, [2.2, 2.0, 0.9, 1.4], numeric=(2, 3))

    doc.add_heading("Job Sources and Attribution", level=1)
    source_rows = []
    for source, details in JOB_SOURCES.items():
        source_rows.append((details["name"], sources.get(source, 0), details["homepage"], details["api_url"]))
    table(doc, ["Source", "Jobs", "Website", "Public feed"], source_rows, [1.1, 0.55, 2.25, 2.6], numeric=(1,))
    doc.add_paragraph(
        "Each imported listing retains its canonical source URL. Source names and links must remain visible wherever listings or derived evidence are displayed."
    )

    doc.add_heading("Curriculum Alignment Status", level=1)
    doc.add_paragraph(
        "Status: not assessed. No authoritative degree syllabus evidence was available to score against these market skills. "
        "When syllabi are uploaded, each explicit skill will be classified as covered, partially covered, or missing and weighted by distinct job mentions."
    )
    doc.add_heading("Recommended Next Actions", level=2)
    for action in (
        "Upload and verify the current degree syllabi, learning outcomes, weekly topics, tools, and assessed projects.",
        "Collect the same sources on a schedule so the report can show stable demand, emerging skills, and declining signals.",
        "Add Dallas, Texas, and broader United States sources before using the results for local-market advising.",
        "Connect each student resume claim to course, project, internship, certification, or work evidence.",
    ):
        doc.add_paragraph(action, style="List Bullet")

    doc.add_heading("Method and Limitations", level=1)
    table(doc, ["Area", "Method or limitation"], [
        ("Qualification", "A substantive description and an explicit degree-relevant title phrase are required."),
        ("Skill demand", "A skill counts once per listing and only when present in description text."),
        ("Source resilience", "Public feeds are collected independently; one unavailable feed does not stop the remaining sources."),
        ("Sample scope", "Remote and European feeds are overrepresented; the sample is not a complete labor-market census."),
        ("Student outcome", "Alignment supports preparation planning and does not guarantee an interview, offer, salary, or employment."),
    ], [1.45, 5.05])

    filename = "ITM_Market_Alignment_Report.docx" if program == "itm" else "Business_Analytics_Market_Alignment_Report.docx"
    output = OUTPUT_DIR / filename
    doc.save(output)
    return output


async def main():
    jobs = await collect_focused_market_jobs(pages=5)
    if not jobs:
        raise RuntimeError("No qualifying public-feed jobs were collected.")
    for program in ("itm", "ba"):
        print(build_report(program, jobs))


if __name__ == "__main__":
    asyncio.run(main())
