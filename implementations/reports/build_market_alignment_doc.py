from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from docx.enum.style import WD_STYLE_TYPE

OUTPUT = "/Users/atharvavinaykulkarni/Documents/ChatGPT/Agents/implementations/reports/ITM_BA_Market_Alignment_Report.docx"

NAVY = "17365D"
BLUE = "DCE6F1"
PALE = "F4F7FA"
GRAY = "D9D9D9"
ORANGE = "C75B12"
WHITE = "FFFFFF"
BLACK = "000000"


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def borders(cell, color=GRAY, size="6"):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_borders = tc_pr.first_child_found_in("w:tcBorders")
    if tc_borders is None:
        tc_borders = OxmlElement("w:tcBorders")
        tc_pr.append(tc_borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        element = tc_borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            tc_borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:color"), color)


def margins(cell, top=100, start=120, bottom=100, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for key, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn("w:" + key))
        if node is None:
            node = OxmlElement("w:" + key)
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def repeat_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_cell_text(cell, text, bold=False, color=BLACK, align=None, size=9):
    cell.text = ""
    p = cell.paragraphs[0]
    if align is not None:
        p.alignment = align
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.08
    run = p.add_run(str(text))
    run.bold = bold
    run.font.name = "Aptos"
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), "Aptos")
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), "Aptos")
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)


def add_table(doc, headers, rows, widths, numeric_cols=()):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    hdr = table.rows[0]
    repeat_header(hdr)
    for idx, value in enumerate(headers):
        cell = hdr.cells[idx]
        cell.width = Inches(widths[idx])
        shade(cell, NAVY)
        borders(cell)
        margins(cell)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        set_cell_text(cell, value, True, WHITE, WD_ALIGN_PARAGRAPH.CENTER, 9)
    for ridx, row in enumerate(rows):
        cells = table.add_row().cells
        for idx, value in enumerate(row):
            cell = cells[idx]
            cell.width = Inches(widths[idx])
            shade(cell, WHITE if ridx % 2 == 0 else PALE)
            borders(cell)
            margins(cell)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            align = WD_ALIGN_PARAGRAPH.CENTER if idx in numeric_cols else WD_ALIGN_PARAGRAPH.LEFT
            set_cell_text(cell, value, False, BLACK, align, 8.6)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    return table


def add_bullet(doc, text, level=0):
    p = doc.add_paragraph(style="List Bullet" if level == 0 else "List Bullet 2")
    p.paragraph_format.space_after = Pt(3)
    p.add_run(text)
    return p


def add_number(doc, text):
    p = doc.add_paragraph(style="List Number")
    p.paragraph_format.space_after = Pt(4)
    p.add_run(text)
    return p


doc = Document()
section = doc.sections[0]
section.top_margin = Inches(0.72)
section.bottom_margin = Inches(0.72)
section.left_margin = Inches(0.78)
section.right_margin = Inches(0.78)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Aptos"
normal._element.rPr.rFonts.set(qn("w:ascii"), "Aptos")
normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos")
normal.font.size = Pt(10.2)
normal.font.color.rgb = RGBColor.from_string("263238")
normal.paragraph_format.space_after = Pt(6)
normal.paragraph_format.line_spacing = 1.14

title = styles["Title"]
title.font.name = "Aptos Display"
title._element.rPr.rFonts.set(qn("w:ascii"), "Aptos Display")
title._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos Display")
title.font.size = Pt(28)
title.font.bold = True
title.font.color.rgb = RGBColor.from_string(BLACK)
title.paragraph_format.space_after = Pt(10)

for name, size, before, after in (("Heading 1", 17, 16, 7), ("Heading 2", 12.5, 11, 5)):
    style = styles[name]
    style.font.name = "Aptos Display"
    style._element.rPr.rFonts.set(qn("w:ascii"), "Aptos Display")
    style._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos Display")
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = RGBColor.from_string(BLACK)
    style.paragraph_format.space_before = Pt(before)
    style.paragraph_format.space_after = Pt(after)
    style.paragraph_format.keep_with_next = True

if "Metric" not in styles:
    metric = styles.add_style("Metric", WD_STYLE_TYPE.PARAGRAPH)
else:
    metric = styles["Metric"]
metric.font.name = "Aptos Display"
metric.font.size = Pt(22)
metric.font.bold = True
metric.font.color.rgb = RGBColor.from_string(ORANGE)
metric.paragraph_format.space_after = Pt(1)

footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
footer_run = footer.add_run("SyllabusCheck  ITM and Business Analytics Market Alignment  Pilot Report")
footer_run.font.name = "Aptos"
footer_run.font.size = Pt(8)
footer_run.font.color.rgb = RGBColor.from_string("6B7280")

doc.add_paragraph("ITM and Business Analytics Market Alignment Report", style="Title")
subtitle = doc.add_paragraph()
subtitle.paragraph_format.space_after = Pt(4)
r = subtitle.add_run("Pilot job description evidence and curriculum readiness framework")
r.bold = True
r.font.size = Pt(14)
r.font.color.rgb = RGBColor.from_string(NAVY)
meta = doc.add_paragraph("Prepared for SyllabusCheck  |  28 September 2026  |  Development dataset")
meta.paragraph_format.space_after = Pt(18)
for run in meta.runs:
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor.from_string("6B7280")

doc.add_heading("Executive Summary", level=1)
doc.add_paragraph(
    "This report describes the current pilot evidence for Information Technology and Management and Business Analytics roles and defines how SyllabusCheck will compare that demand with course content. The current collection contains 18 qualifying jobs with full descriptions and 78 explicit job skill links. Ten jobs map to ITM and eight map to Business Analytics."
)
doc.add_paragraph(
    "The strongest observed Business Analytics signals are Python and SQL. The strongest ITM signal is project management, followed by REST APIs and stakeholder management. These findings describe the collected sample only. The sample is small and primarily European, so it is not yet suitable for Dallas, Texas, or United States curriculum decisions."
)
doc.add_paragraph(
    "Curriculum alignment is not yet scored because no ITM or Business Analytics syllabi have been uploaded to the hosted development account. SyllabusCheck correctly reports this state as not assessed. A student employment outcome also cannot be inferred from curriculum alone; resume evidence, projects, experience, communication, interviewing, location, and work authorization must be evaluated separately."
)

doc.add_heading("Current Evidence at a Glance", level=1)
metrics = doc.add_table(rows=1, cols=4)
metrics.alignment = WD_TABLE_ALIGNMENT.CENTER
metrics.autofit = False
for idx, (value, label) in enumerate((("18", "Description backed jobs"), ("10", "ITM jobs"), ("8", "Business Analytics jobs"), ("78", "Explicit skill links"))):
    cell = metrics.rows[0].cells[idx]
    cell.width = Inches(1.62)
    borders(cell)
    margins(cell, 140, 100, 140, 100)
    shade(cell, PALE)
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    cell.text = ""
    p1 = cell.paragraphs[0]
    p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p1.paragraph_format.space_after = Pt(2)
    p1.add_run(value).bold = True
    p1.runs[0].font.size = Pt(22)
    p1.runs[0].font.color.rgb = RGBColor.from_string(ORANGE)
    p2 = cell.add_paragraph(label)
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.paragraph_format.space_after = Pt(0)
    p2.runs[0].font.size = Pt(8.5)

doc.add_heading("What the Scraper Collects", level=1)
doc.add_paragraph(
    "The focused importer reads public job feed records, retains only titles assigned to an explicit ITM or Business Analytics role family, and requires a substantive job description. Each retained record includes the source, external identifier, job title, employer, location, remote indicator, role type, description, source URL, collection timestamp, program classification, role family, and explicit skill mentions."
)
for text in (
    "Skills count only when the term or an approved synonym occurs in the job description.",
    "A skill counts at most once per job, even when the description repeats it.",
    "The extractor does not infer likely skills from a job title.",
    "Every listing retains its source URL for attribution and review.",
    "The import is idempotent, so rerunning it updates existing listings instead of duplicating them.",
):
    add_bullet(doc, text)

doc.add_page_break()
doc.add_heading("Current Data Scope", level=2)
add_table(doc,
    ["Dimension", "Current pilot"],
    [
        ["Source", "Arbeitnow public job board API"],
        ["Collection", "Five paginated feed pages collected on 29 September 2026 UTC"],
        ["Qualification rule", "Full description plus an ITM or BA role family title match"],
        ["Geography", "Primarily European locations including London, Munster, Lausanne, Karlsruhe, Dresden, Stuttgart and Berlin"],
        ["Quality label", "Pilot because fewer than 30 qualifying jobs were collected"],
    ],
    [1.55, 5.0]
)

doc.add_heading("Key Job Families", level=1)
doc.add_heading("Business Analytics", level=2)
add_table(doc, ["Job family", "Jobs", "Share of BA sample"], [
    ["Business Analyst", "4", "50 percent"],
    ["Data Analyst", "4", "50 percent"],
], [3.8, 1.0, 1.75], numeric_cols=(1, 2))

doc.add_heading("Information Technology and Management", level=2)
add_table(doc, ["Job family", "Jobs", "Share of ITM sample"], [
    ["IT Project Manager", "4", "40 percent"],
    ["ERP and Enterprise Systems", "3", "30 percent"],
    ["Technology Consultant", "3", "30 percent"],
], [3.8, 1.0, 1.75], numeric_cols=(1, 2))

doc.add_heading("Main Skills Found in Job Descriptions", level=1)
doc.add_paragraph("The following tables show distinct job mentions. Percentages use the relevant program sample as the denominator.")
doc.add_heading("Business Analytics Skills", level=2)
add_table(doc, ["Skill", "Jobs mentioning skill", "Share"], [
    ["Python", "4", "50 percent"], ["SQL", "4", "50 percent"],
    ["Agile", "2", "25 percent"], ["Data Analysis", "2", "25 percent"],
    ["Excel", "2", "25 percent"], ["Salesforce", "2", "25 percent"],
    ["Azure", "1", "12.5 percent"], ["Business Process Modeling", "1", "12.5 percent"],
    ["Communication", "1", "12.5 percent"], ["Confluence", "1", "12.5 percent"],
], [3.45, 1.7, 1.4], numeric_cols=(1, 2))

doc.add_heading("Information Technology and Management Skills", level=2)
add_table(doc, ["Skill", "Jobs mentioning skill", "Share"], [
    ["Project Management", "4", "40 percent"], ["REST API", "3", "30 percent"],
    ["Stakeholder Management", "3", "30 percent"], ["Agile", "2", "20 percent"],
    ["AWS", "2", "20 percent"], ["Azure", "2", "20 percent"],
    ["Confluence", "2", "20 percent"], ["ERP", "2", "20 percent"],
    ["Git", "2", "20 percent"], ["Google Cloud", "2", "20 percent"],
], [3.45, 1.7, 1.4], numeric_cols=(1, 2))

doc.add_heading("Curriculum Alignment Status", level=1)
doc.add_paragraph(
    "The curriculum result is currently not assessed for both programs. The hosted development account has no uploaded ITM or Business Analytics syllabi, so there is no defensible course evidence to compare with the market skills above. The report intentionally returns a blank score instead of treating missing input as zero coverage."
)
doc.add_paragraph("When syllabi are available, SyllabusCheck will apply the following market weighted calculation:")
add_bullet(doc, "Covered skill receives a value of 1.0.")
add_bullet(doc, "Partially covered skill receives a value of 0.5.")
add_bullet(doc, "Missing skill receives a value of 0.0.")
add_bullet(doc, "Each value is weighted by the number of distinct job descriptions mentioning that skill.")
doc.add_paragraph(
    "The resulting percentage measures how strongly documented course content addresses observed demand. It does not measure teaching quality, student mastery, or hiring probability."
)

doc.add_heading("How the Report Supports Student Job Readiness", level=1)
doc.add_paragraph(
    "A useful student outcome report must connect market demand to evidence the student can demonstrate. Syllabus coverage establishes where a student may encounter a skill, but employers also evaluate whether the student can apply it. The end to end readiness model should therefore include four evidence layers."
)
add_number(doc, "Curriculum evidence identifies courses whose objectives, weekly topics, tools, and assessed work address a demanded skill.")
add_number(doc, "Portfolio evidence records projects, datasets, systems, reports, dashboards, and measurable outcomes that demonstrate applied ability.")
add_number(doc, "Resume evidence connects each claimed skill to a course, project, internship, certification, or work result.")
add_number(doc, "Application readiness evaluates role fit, missing requirements, interview preparation, location constraints, and work authorization without promising an employment outcome.")

doc.add_heading("Recommended Curriculum Actions", level=1)
add_table(doc, ["Priority", "Program", "Skill", "Recommended evidence"], [
    ["1", "ITM", "Project Management", "Add an assessed technology project with scope, schedule, risk and stakeholder deliverables."],
    ["2", "BA", "Python", "Require a reproducible analysis project using real data and documented decisions."],
    ["3", "BA", "SQL", "Assess querying, joins, aggregation, data quality and interpretation using a business dataset."],
    ["4", "ITM", "REST APIs", "Include integration work that consumes or designs an authenticated API."],
    ["5", "ITM", "Stakeholder Management", "Assess requirements interviews, decision logs and executive communication."],
    ["6", "Both", "Agile", "Use iterative delivery with a backlog, review, retrospective and evidence of team decisions."],
    ["7", "ITM", "Cloud Platforms", "Add a deployable cloud assignment with architecture, security and cost considerations."],
], [0.55, 0.7, 1.4, 3.9], numeric_cols=(0,))

doc.add_heading("Required Next Data", level=1)
doc.add_paragraph("The following work is required before this report can support program decisions or individual advising.")
for text in (
    "Collect Dallas, Texas, and broader United States listings from multiple permitted sources across several dates.",
    "Upload the applicable ITM and Business Analytics syllabi and confirm their program and course mappings.",
    "Review extracted syllabus topics with faculty before treating them as authoritative evidence.",
    "Add student resume, project, course completion, and preference data under the existing private access controls.",
    "Evaluate role and skill classification accuracy against a manually reviewed sample.",
    "Set minimum sample-size and freshness rules before presenting results as directional or broad market evidence.",
):
    add_bullet(doc, text)

doc.add_heading("Methodology and Limitations", level=1)
add_table(doc, ["Area", "Method or limitation"], [
    ["Role classification", "Explicit title phrases map listings to documented ITM and BA job families."],
    ["Skill extraction", "Maintained patterns identify explicit tools, methods, delivery practices and professional competencies in description text."],
    ["Demand frequency", "A skill counts no more than once per listing."],
    ["Curriculum coverage", "Best course evidence determines covered, partial or missing status for each skill."],
    ["Sample bias", "The current feed and geography may overrepresent specific employers, seniority levels and European labor markets."],
    ["Outcome interpretation", "Alignment supports preparation planning and does not predict interviews, offers, salary or employment."],
], [1.55, 5.0])

doc.add_heading("Sources", level=1)
doc.add_paragraph("Arbeitnow public job board API. https://www.arbeitnow.com/api/job-board-api")
doc.add_paragraph("Remotive public jobs API documentation and attribution requirements. https://github.com/remotive-io/remote-jobs-api")
doc.add_paragraph("SyllabusCheck hosted development report generated from the Supabase job, keyword, syllabus, and coverage data model.")

doc.core_properties.title = "ITM and Business Analytics Market Alignment Report"
doc.core_properties.subject = "Job description evidence and curriculum readiness"
doc.core_properties.author = "SyllabusCheck"
doc.core_properties.keywords = "ITM, Business Analytics, curriculum, job market, skills"
doc.save(OUTPUT)
print(OUTPUT)
