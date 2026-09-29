from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                 TableStyle, HRFlowable, PageBreak, KeepTogether)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY

# UTD Colors
UTD_NAVY   = colors.HexColor('#154360')
UTD_ORANGE = colors.HexColor('#C75B12')
UTD_ORANGE_L = colors.HexColor('#E87722')
UTD_GREEN  = colors.HexColor('#1E8449')
UTD_GOLD   = colors.HexColor('#D4AC0D')
GRAY_800   = colors.HexColor('#343A40')
GRAY_600   = colors.HexColor('#6C757D')
GRAY_200   = colors.HexColor('#E9ECEF')
GRAY_100   = colors.HexColor('#F1F3F5')
WHITE      = colors.white

OUT = '/mnt/user-data/outputs/JSOM_Degree_Planner_Project_Plan.pdf'

doc = SimpleDocTemplate(
    OUT, pagesize=letter,
    leftMargin=0.85*inch, rightMargin=0.85*inch,
    topMargin=0.9*inch, bottomMargin=0.85*inch,
    title='JSOM Degree Planner — Project Plan',
    author='UTD JSOM'
)

styles = getSampleStyleSheet()

def S(name, **kw):
    return ParagraphStyle(name, **kw)

# Custom styles
H1 = S('H1', fontName='Helvetica-Bold', fontSize=18, textColor=UTD_NAVY,
        spaceAfter=4, spaceBefore=14, leading=22)
H2 = S('H2', fontName='Helvetica-Bold', fontSize=12, textColor=UTD_ORANGE,
        spaceAfter=4, spaceBefore=10, leading=15, borderPad=0)
H3 = S('H3', fontName='Helvetica-Bold', fontSize=10, textColor=UTD_NAVY,
        spaceAfter=2, spaceBefore=6, leading=13)
BODY = S('BODY', fontName='Helvetica', fontSize=9, textColor=GRAY_800,
         spaceAfter=4, leading=14, alignment=TA_JUSTIFY)
BODY_SM = S('BODY_SM', fontName='Helvetica', fontSize=8.5, textColor=GRAY_600,
            spaceAfter=3, leading=12)
CAPTION = S('CAPTION', fontName='Helvetica-Oblique', fontSize=8, textColor=GRAY_600,
            spaceAfter=2, leading=11)
MONO = S('MONO', fontName='Courier', fontSize=8, textColor=UTD_NAVY,
         spaceAfter=2, leading=11)
BULLET = S('BULLET', fontName='Helvetica', fontSize=9, textColor=GRAY_800,
           leftIndent=12, bulletIndent=0, spaceAfter=2, leading=13)
LABEL = S('LABEL', fontName='Helvetica-Bold', fontSize=7.5, textColor=GRAY_600,
          spaceAfter=1, leading=10, letterSpacing=0.5)

def tbl_style(header_bg=UTD_NAVY, alt=True):
    cmds = [
        ('BACKGROUND', (0,0), (-1,0), header_bg),
        ('TEXTCOLOR',  (0,0), (-1,0), WHITE),
        ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',   (0,0), (-1,0), 8),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING',    (0,0), (-1,0), 6),
        ('FONTNAME',   (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE',   (0,1), (-1,-1), 8),
        ('TOPPADDING',    (0,1), (-1,-1), 4),
        ('BOTTOMPADDING', (0,1), (-1,-1), 4),
        ('TEXTCOLOR',  (0,1), (-1,-1), GRAY_800),
        ('GRID',       (0,0), (-1,-1), 0.4, GRAY_200),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, GRAY_100] if alt else [WHITE]),
        ('VALIGN',     (0,0), (-1,-1), 'MIDDLE'),
    ]
    return TableStyle(cmds)

def section_bar(text):
    return Table([[Paragraph(text, H2)]], colWidths=[6.3*inch],
        style=TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#EAF2FF')),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LINEBELOW', (0,0), (-1,-1), 1.5, UTD_ORANGE),
        ])
    )

def phase_header(num, title, timeline, color=UTD_NAVY):
    data = [[
        Paragraph(f'<font color="white"><b>Phase {num}</b></font>', S('ph', fontName='Helvetica-Bold', fontSize=9, textColor=WHITE, leading=11)),
        Paragraph(f'<b>{title}</b>', S('pt', fontName='Helvetica-Bold', fontSize=10, textColor=WHITE, leading=13)),
        Paragraph(timeline, S('ptl', fontName='Helvetica', fontSize=8.5, textColor=colors.HexColor('#AABBCC'), leading=11, alignment=TA_RIGHT)),
    ]]
    return Table(data, colWidths=[0.65*inch, 3.9*inch, 1.75*inch],
        style=TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), color),
            ('TOPPADDING', (0,0), (-1,-1), 7),
            ('BOTTOMPADDING', (0,0), (-1,-1), 7),
            ('LEFTPADDING', (0,0), (0,0), 10),
            ('LEFTPADDING', (0,0), (1,0), 6),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ])
    )

def bullet(text, indent=0):
    return Paragraph(f'• {text}', S('bl', fontName='Helvetica', fontSize=9, textColor=GRAY_800,
        leftIndent=12+indent, spaceAfter=2, leading=13))

def sub_bullet(text):
    return Paragraph(f'– {text}', S('sbl', fontName='Helvetica', fontSize=8.5, textColor=GRAY_600,
        leftIndent=22, spaceAfter=1, leading=12))

story = []

# ══════════════════════════════════════════════════════════════
# COVER HEADER
# ══════════════════════════════════════════════════════════════
cover_top = Table([[
    Paragraph('<font color="white"><b>JSOM DEGREE PLANNER</b></font>',
              S('ct', fontName='Helvetica-Bold', fontSize=22, textColor=WHITE, leading=26)),
    ''
],[
    Paragraph('<font color="#E87722">Graduate Degree Planning Platform</font>',
              S('cs', fontName='Helvetica', fontSize=11, textColor=UTD_ORANGE_L, leading=14)),
    Paragraph('<font color="#AABBCC">UT Dallas · Spring 2026</font>',
              S('cd', fontName='Helvetica', fontSize=9, textColor=colors.HexColor('#AABBCC'), leading=11, alignment=TA_RIGHT)),
]], colWidths=[4.5*inch, 1.8*inch],
    style=TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), UTD_NAVY),
        ('TOPPADDING', (0,0), (-1,-1), 18),
        ('BOTTOMPADDING', (0,0), (-1,-1), 18),
        ('LEFTPADDING', (0,0), (-1,-1), 16),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('SPAN', (0,0), (0,0)),
    ])
)
story.append(cover_top)

# Orange accent bar
story.append(Table([['']], colWidths=[6.3*inch],
    style=TableStyle([('BACKGROUND',(0,0),(-1,-1),UTD_ORANGE),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2)])))

story.append(Spacer(1, 10))

# Meta info strip
meta_data = [['Course', 'Team', 'Submission', 'Version'],
             ['CS/IS 6359 — Grad Info Systems', 'JSOM Planning Group', 'April 2026', '1.0 Final']]
meta_tbl = Table(meta_data, colWidths=[1.7*inch, 1.9*inch, 1.4*inch, 1.3*inch])
meta_tbl.setStyle(tbl_style(header_bg=UTD_NAVY, alt=False))
story.append(meta_tbl)
story.append(Spacer(1, 12))

# ══════════════════════════════════════════════════════════════
# SECTION 1 — EXECUTIVE SUMMARY
# ══════════════════════════════════════════════════════════════
story.append(section_bar('1.  Executive Summary'))
story.append(Spacer(1, 6))
story.append(Paragraph(
    'JSOM Degree Planner is a full-stack web application that digitizes and automates graduate degree planning '
    'for the Naveen Jindal School of Management at UT Dallas. The system serves two audiences: <b>students</b>, '
    'who can plan courses semester-by-semester with real-time prerequisite validation and progress tracking, '
    'and <b>administrators</b>, who can manage all degree constraints — core courses, concentrations, credit requirements — '
    'with changes propagating instantly to all student dashboards.', BODY))
story.append(Spacer(1, 4))

# Quick stats
stats_data = [
    ['39\nPrograms', '311\nCourses', '19\nSubject Areas', '5,545\nLines of Code', '3-Tier\nArchitecture'],
]
stats_tbl = Table(stats_data, colWidths=[1.26*inch]*5)
stats_tbl.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), UTD_NAVY),
    ('TEXTCOLOR', (0,0), (-1,-1), WHITE),
    ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,-1), 9),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('TOPPADDING', (0,0), (-1,-1), 10),
    ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ('GRID', (0,0), (-1,-1), 1, UTD_ORANGE),
]))
story.append(stats_tbl)
story.append(Spacer(1, 10))

# ══════════════════════════════════════════════════════════════
# SECTION 2 — PROBLEM STATEMENT & MOTIVATION
# ══════════════════════════════════════════════════════════════
story.append(section_bar('2.  Problem Statement & Motivation'))
story.append(Spacer(1, 6))
story.append(Paragraph(
    'Graduate students at JSOM navigate a complex landscape of program-specific degree requirements: '
    'multiple concentrations per degree, prerequisite chains, STEM designation constraints, '
    'and credit hour thresholds that vary by program. Currently, students rely on static PDF catalogs '
    'and manual spreadsheets — a process prone to errors, missed requirements, and advisor bottlenecks. '
    'When administrators update requirements mid-program, there is no automated mechanism to notify '
    'affected students or update their existing plans.', BODY))
story.append(Spacer(1, 4))

prob_data = [
    ['Pain Point', 'Impact', 'Our Solution'],
    ['Static PDF catalogs', 'Outdated requirements missed by students', 'Live admin-managed constraint system'],
    ['No prereq enforcement', 'Students register for courses they cannot take', 'Real-time graph-based prereq validation'],
    ['Manual credit tracking', 'Graduation delays from miscounts', 'Automated SCH dashboard with live totals'],
    ['Disconnected systems', 'Galaxy enrollment requires separate visit', 'Deep-link integration to UTD Galaxy'],
    ['No admin broadcast', 'Requirement changes go unnoticed', 'Instant propagation to all student views'],
]
prob_tbl = Table(prob_data, colWidths=[1.6*inch, 2.2*inch, 2.5*inch])
prob_tbl.setStyle(tbl_style())
story.append(prob_tbl)
story.append(Spacer(1, 10))

# ══════════════════════════════════════════════════════════════
# SECTION 3 — SYSTEM ARCHITECTURE
# ══════════════════════════════════════════════════════════════
story.append(section_bar('3.  System Architecture'))
story.append(Spacer(1, 6))

arch_cols = [
    ['FRONTEND\n(React 18 + Vite)',
     '• 8 pages across student & admin portals\n• UTD design system (Orange #C75B12 / Navy #154360)\n• Recharts for progress visualization\n• JWT stored in localStorage\n• React Router v6 with role-based guards\n• Axios interceptors for auth & 401 handling'],
    ['BACKEND\n(Node.js + Express)',
     '• 7 route modules, 35+ endpoints\n• JWT authentication + bcrypt password hashing\n• Role-based middleware (student / admin)\n• Express rate limiting (200 req/15 min)\n• Global async error handler\n• Audit log on all write operations'],
    ['DATABASE\n(PostgreSQL 15)',
     '• 10 core tables + 2 views\n• Materialized view: course_graph\n• Recursive CTE for prereq chains\n• Row-level triggers for updated_at\n• Knowledge graph as adjacency list\n• Composite unique constraints'],
]

arch_data = [[Paragraph(c[0], S('ah', fontName='Helvetica-Bold', fontSize=9, textColor=WHITE, leading=11, alignment=TA_CENTER)),] for c in arch_cols]
arch_data2 = [[Paragraph(c[1], S('ab', fontName='Helvetica', fontSize=8, textColor=GRAY_800, leading=12)),] for c in arch_cols]

arch_tbl = Table(
    [[arch_data[0][0], arch_data[1][0], arch_data[2][0]],
     [arch_data2[0][0], arch_data2[1][0], arch_data2[2][0]]],
    colWidths=[2.1*inch, 2.1*inch, 2.1*inch]
)
arch_tbl.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), UTD_ORANGE),
    ('TEXTCOLOR',  (0,0), (-1,0), WHITE),
    ('BACKGROUND', (0,1), (-1,1), GRAY_100),
    ('TOPPADDING', (0,0), (-1,-1), 7),
    ('BOTTOMPADDING', (0,0), (-1,-1), 7),
    ('LEFTPADDING', (0,0), (-1,-1), 8),
    ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ('GRID', (0,0), (-1,-1), 0.5, GRAY_200),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('LINEBELOW', (0,0), (-1,0), 1, UTD_NAVY),
]))
story.append(arch_tbl)
story.append(Spacer(1, 8))

# Data flow
story.append(Paragraph('Data Flow', H3))
flow_items = [
    'JSOM Graduate Catalog XLSX → Python parser → 39 programs, 311 courses, 150+ cross-listed relationships extracted',
    'PostgreSQL schema (schema.sql) → 10 tables with FK constraints, triggers, and materialized view',
    'seed_database.py → populates all programs, concentrations, core courses, elective mappings, prerequisite edges',
    'Express API (35 endpoints) → validated with express-validator, protected by JWT middleware',
    'React frontend → Axios instance with Bearer token injection and automatic 401 redirect',
    'Nebula API proxy (/api/nebula/*) → caches section data locally, falls back gracefully if key missing',
]
for f in flow_items:
    story.append(bullet(f))
story.append(Spacer(1, 10))

# ══════════════════════════════════════════════════════════════
# SECTION 4 — KNOWLEDGE GRAPH
# ══════════════════════════════════════════════════════════════
story.append(section_bar('4.  Knowledge Graph & Data Model'))
story.append(Spacer(1, 6))
story.append(Paragraph(
    'The core intellectual contribution of this project is modeling JSOM degree requirements as a '
    '<b>directed graph</b> stored in PostgreSQL. Each course is a node; prerequisite relationships are '
    'directed edges. Program membership (core vs. elective) is represented as labeled edges to program '
    'and concentration nodes.', BODY))
story.append(Spacer(1, 5))

graph_data = [
    ['Graph Element', 'Storage', 'Count', 'Key Insight'],
    ['Course nodes', 'courses table', '311', 'Parsed from 19 subject prefixes across JSOM catalog'],
    ['Prereq edges', 'course_prerequisites', '27+', 'Typed: required / recommended / concurrent'],
    ['Program-course edges', 'program_core_courses', '300+', 'Defines core requirements per degree'],
    ['Conc-course edges', 'concentration_courses', '1,500+', 'Defines elective pool per concentration'],
    ['Cross-listed courses', 'materialized view', '150', 'OPRE 6301 appears in 8 programs (most shared)'],
    ['Prereq chain depth', 'recursive CTE', 'up to 5', 'Full dependency tree via WITH RECURSIVE query'],
]
gtbl = Table(graph_data, colWidths=[1.4*inch, 1.4*inch, 0.6*inch, 2.9*inch])
gtbl.setStyle(tbl_style(header_bg=UTD_GREEN))
story.append(gtbl)
story.append(Spacer(1, 6))
story.append(Paragraph(
    '<b>Graph validation confirmed:</b> All 311 courses successfully mapped to programs/concentrations. '
    '150 courses appear in 2+ programs (cross-listed). The top cross-listed course, OPRE 6301 '
    '(Statistics & Data Analysis), is a core requirement in 8 distinct programs — confirming its '
    'role as a foundational quantitative methods course across JSOM. '
    '105 courses are core-only, 122 are elective-only, and 84 appear in both roles.', BODY))
story.append(Spacer(1, 10))

# ══════════════════════════════════════════════════════════════
# SECTION 5 — FEATURES (Student + Admin)
# ══════════════════════════════════════════════════════════════
story.append(section_bar('5.  Feature Inventory'))
story.append(Spacer(1, 6))

feat_data = [
    ['Feature', 'Role', 'Implementation'],
    ['Progress dashboard', 'Student', 'SCH completed/enrolled/planned, GPA, radial chart, core course checklist'],
    ['Course catalog browser', 'Student', 'Search + subject filter, prerequisite graph display, program appearances'],
    ['Add course to plan', 'Student', 'Prerequisite check via graph traversal, conflict warning, semester assignment'],
    ['Grade & status tracking', 'Student', 'Per-course status (planned/enrolled/completed), GPA auto-recalculation'],
    ['Schedule builder', 'Student', 'Semester view, time conflict detection, eligible next courses sidebar'],
    ['Section lookup', 'Student', 'Nebula API proxy for live sections; graceful fallback to Coursebook link'],
    ['Galaxy enrollment link', 'Student', 'Deep-link to UTD Galaxy with class number pre-filled, one-click enroll'],
    ['Prereq chain viewer', 'Student', 'Full recursive dependency tree rendered with depth indentation'],
    ['Program management', 'Admin', 'Edit total SCH, core SCH, elective SCH, STEM flag, notes per program'],
    ['Core course editor', 'Admin', 'Add/remove core courses per program with live search autocomplete'],
    ['Concentration manager', 'Admin', 'Create/delete concentrations, set required SCH, manage elective pools'],
    ['Elective course editor', 'Admin', 'Add/remove courses from each concentration\'s elective list'],
    ['Student roster', 'Admin', 'All students with program, GPA, completed SCH; activate/deactivate accounts'],
    ['Knowledge graph panel', 'Admin', 'Node/edge counts, top cross-listed courses, isolated course detection'],
    ['Graph refresh', 'Admin', 'Trigger REFRESH MATERIALIZED VIEW CONCURRENTLY on demand'],
    ['Audit log', 'Admin', 'Every write operation logged with user, entity, before/after data, IP'],
    ['System stats', 'Admin', 'Programs, courses, student count, enrollment distribution bar chart'],
]
ftbl = Table(feat_data, colWidths=[1.7*inch, 0.75*inch, 3.85*inch])
ftbl.setStyle(tbl_style(header_bg=UTD_NAVY))
story.append(ftbl)
story.append(Spacer(1, 10))

# ══════════════════════════════════════════════════════════════
# SECTION 6 — PHASE BY PHASE PLAN
# ══════════════════════════════════════════════════════════════
story.append(section_bar('6.  Phase-by-Phase Development Plan'))
story.append(Spacer(1, 6))

phases = [
    {
        'num': 1, 'color': UTD_NAVY, 'title': 'Data Acquisition & Knowledge Graph Construction',
        'timeline': 'Week 1–2', 'status': 'COMPLETE',
        'goal': 'Parse the JSOM Graduate Catalog XLSX and build the complete knowledge graph.',
        'deliverables': [
            'Python parser (scripts/seed_database.py) — extracts 39 programs, 311 courses, 19 subject areas',
            'Knowledge graph JSON (scripts/knowledge_graph.json) — nodes, edges, cross-listing analysis',
            'Graph validation: 150 cross-listed courses, OPRE 6301 confirmed as most central node (8 programs)',
            'PostgreSQL schema (database/schema.sql) — 10 tables, 2 views, triggers, recursive CTEs',
            'Prerequisite edge set (27 relationships) seeded from catalog parsing + expert annotation',
        ],
        'tech': 'Python 3 · pandas · psycopg2 · PostgreSQL 15 · XLSX parsing',
        'loops_closed': [
            'Missing course titles: resolved by maintaining a COURSE_TITLES dict for all 311 codes',
            'SCH parsing errors (e.g. "up to 9"): resolved with regex fallback in safe_int()',
            'Free elective allowance mixed types: stored as text + numeric separately',
        ]
    },
    {
        'num': 2, 'color': UTD_ORANGE, 'title': 'Backend API & Authentication',
        'timeline': 'Week 3–4', 'status': 'COMPLETE',
        'goal': 'Build the full Express API with JWT auth, role-based access control, and all business logic.',
        'deliverables': [
            'server.js — Express app with Helmet, CORS, Morgan, rate limiting, graceful shutdown',
            'auth.js routes — /register (UTD email enforced), /login (bcrypt), /me, /change-password',
            'programs.js — Full CRUD for programs, core courses, concentrations, elective pools',
            'courses.js — Catalog search, course detail with graph relationships, recursive prereq chain',
            'students.js — Dashboard aggregation, course CRUD, prereq validation, eligible-courses query',
            'admin.js — Stats, student roster, audit log, graph stats/refresh, bulk course update',
            'schedule.js — Semester schedule, time conflict detection, Galaxy deep-link generation',
            'nebula.js — Proxy to UTD Nebula API for live section and grade data',
        ],
        'tech': 'Node.js · Express · JWT · bcryptjs · pg (PostgreSQL client) · express-validator',
        'loops_closed': [
            'Self-registration as admin blocked: role=admin returns 403 on /register',
            'Concurrent GPA recalculation: triggers on grade_points update via PATCH /students/courses/:id',
            'Prereq loop guard: course cannot be its own prerequisite (enforced in route + DB unique constraint)',
            'Token expiry: 401 with code TOKEN_EXPIRED triggers auto-logout in Axios interceptor',
        ]
    },
    {
        'num': 3, 'color': UTD_GREEN, 'title': 'Frontend — Student Portal',
        'timeline': 'Week 5–6', 'status': 'COMPLETE',
        'goal': 'Build all 4 student-facing pages with the UTD design system.',
        'deliverables': [
            'global.css — Full UTD design system: typography (Libre Baskerville + Source Sans 3), color tokens, card/button/badge/modal/toast components',
            'LoginPage.jsx — Split-panel login with UTD branding, feature highlights, demo account info',
            'RegisterPage.jsx — Student registration with program selector pre-populated from API',
            'DashboardPage.jsx — KPI stat cards (GPA, SCH, core progress), radial completion ring, semester SCH bar chart, recent activity, core course checklist',
            'MyCoursesPage.jsx — Table view grouped by semester, inline status/grade editing, Add Course modal with prereq check and search',
            'CourseCatalogPage.jsx — Two-panel layout: course grid with subject chips + right panel with prereq chain, program appearances, quick-add',
            'ScheduleBuilderPage.jsx — Semester selector, conflict alerts, section lookup (Nebula), eligible courses sidebar, Galaxy enroll button',
        ],
        'tech': 'React 18 · Vite · React Router v6 · Recharts · Axios · Lucide React icons',
        'loops_closed': [
            'Auth guards: RequireAuth component blocks access; admins redirected to /admin, students to /dashboard',
            'Empty state handling: every data list has a meaningful empty state with call to action',
            'Optimistic updates: status/grade changes reflect immediately in UI, rollback on API failure',
            'Toast notifications: every async action has success/error feedback via ToastContext',
        ]
    },
    {
        'num': 4, 'color': colors.HexColor('#6C3483'), 'title': 'Frontend — Admin Portal',
        'timeline': 'Week 7', 'status': 'COMPLETE',
        'goal': 'Build all admin pages with full constraint editing capabilities.',
        'deliverables': [
            'AdminOverviewPage.jsx — Stats KPIs, enrollment distribution chart, knowledge graph health panel, admin quick-nav grid',
            'AdminProgramsPage.jsx — Expandable program list, inline SCH editing, core course add/remove with autocomplete search, concentration CRUD, elective pool management',
            'AdminStudentsPage — Student roster with program filter, GPA color coding, activate/deactivate',
            'AdminCoursesPage — Course table with side panel, prereq edge add/remove, program appearance display',
            'AdminGraphPage — Graph health metrics, top cross-listed courses, isolated course detection',
            'AdminSettingsPage — Audit log table with action/entity/user/timestamp',
            'AppLayout.jsx — Shared sidebar (role-aware nav), topbar with user badge, UTD accent bar',
        ],
        'tech': 'React 18 · same stack as student portal',
        'loops_closed': [
            'Admin route protection: requireAdmin middleware on all /api/admin/* routes',
            'Stale detail cache: program detail cache invalidated on any mutation by deleting key and re-fetching',
            'Graph isolation alert: admin graph page flags courses not assigned to any program',
            'Audit trail: all admin write operations generate audit_log entries with old/new data as JSONB',
        ]
    },
    {
        'num': 5, 'color': colors.HexColor('#117A65'), 'title': 'Integration, Containerization & Deployment',
        'timeline': 'Week 8', 'status': 'READY',
        'goal': 'Wire all layers together, containerize with Docker, and document deployment.',
        'deliverables': [
            'docker-compose.yml — PostgreSQL + Backend + Frontend orchestration with healthchecks and volume persistence',
            'backend/Dockerfile — Node 20 Alpine, production-only npm install',
            'frontend/Dockerfile — Multi-stage: Vite build → Nginx Alpine serving, SPA routing config',
            'nginx.conf — API proxy to backend, gzip compression, SPA fallback routing',
            'README.md — Complete setup guide: Docker quick start, manual setup, API reference, deployment to Railway + Vercel',
            'Vite proxy config — /api/* proxied to backend:5000 in dev mode (no CORS issues)',
            'Environment separation: .env.example with all required variables documented',
        ],
        'tech': 'Docker · Docker Compose · Nginx · Railway (backend/DB) · Vercel (frontend)',
        'loops_closed': [
            'Dev/prod CORS: FRONTEND_URL env var controls allowed origin; Nginx proxy eliminates CORS in prod',
            'DB init ordering: docker-compose healthcheck ensures schema runs before seed',
            'SPA 404s: nginx try_files $uri $uri/ /index.html handles client-side routing',
            'Nebula API optional: all Nebula calls wrapped in try/catch with graceful empty-array fallback',
        ]
    },
]

for phase in phases:
    story.append(KeepTogether([
        phase_header(phase['num'], phase['title'], phase['timeline'], phase['color']),
        Spacer(1, 4),
    ]))

    # Goal + status row
    goal_row = Table([[
        Paragraph(f'<b>Goal:</b> {phase["goal"]}', BODY_SM),
        Paragraph(f'<b><font color="#1E8449">✓ {phase["status"]}</font></b>',
                  S('st', fontName='Helvetica-Bold', fontSize=8.5, textColor=UTD_GREEN, alignment=TA_RIGHT)),
    ]], colWidths=[5.3*inch, 1.0*inch])
    goal_row.setStyle(TableStyle([
        ('VALIGN', (0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),4),
        ('BOTTOMPADDING',(0,0),(-1,-1),2),
    ]))
    story.append(goal_row)

    # Deliverables
    story.append(Paragraph('Key Deliverables:', S('kd', fontName='Helvetica-Bold', fontSize=8.5, textColor=GRAY_600, spaceBefore=4, spaceAfter=2, leading=11)))
    for d in phase['deliverables']:
        story.append(bullet(d))

    # Tech
    story.append(Spacer(1,2))
    story.append(Paragraph(f'<b>Technologies:</b> <font color="#6C757D">{phase["tech"]}</font>',
                           S('te', fontName='Helvetica', fontSize=8, leading=11, spaceAfter=2)))

    # Loops closed
    story.append(Paragraph('Edge Cases & Loops Resolved:', S('ec', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.HexColor('#6C3483'), spaceBefore=3, spaceAfter=2, leading=11)))
    for l in phase['loops_closed']:
        story.append(sub_bullet(l))

    story.append(Spacer(1, 8))

# ══════════════════════════════════════════════════════════════
# SECTION 7 — NEBULA API INTEGRATION
# ══════════════════════════════════════════════════════════════
story.append(section_bar('7.  UTD Nebula API Integration'))
story.append(Spacer(1, 5))
story.append(Paragraph(
    'The UTD Nebula API (api.utdnebula.com) is a student-built, university-sanctioned REST API '
    'providing read access to UTD course, section, grade, and professor data. All calls are proxied '
    'through the backend to protect the API key and enable local caching.', BODY))
story.append(Spacer(1, 4))

neb_data = [
    ['Endpoint', 'Data Returned', 'Used For'],
    ['GET /course', 'Subject, number, title, description, prereqs', 'Course catalog enrichment (title, description)'],
    ['GET /section', 'Days, times, professor, room, enrollment', 'Schedule builder section lookup'],
    ['GET /grades/overall', 'Grade distribution A-F by professor/section', 'Bonus: show historical grade distribution'],
    ['GET /professor', 'Name, RMP rating, courses taught', 'Link to RateMyProfessors data in section picker'],
]
ntbl = Table(neb_data, colWidths=[1.4*inch, 2.3*inch, 2.6*inch])
ntbl.setStyle(tbl_style(header_bg=UTD_NAVY))
story.append(ntbl)
story.append(Spacer(1, 4))
story.append(Paragraph(
    '<b>Fallback strategy:</b> All Nebula calls are wrapped in try/catch. If the API key is absent '
    'or the call fails, the app returns an empty sections array with a link to UTD Coursebook '
    '(coursebook.utdallas.edu) so students can still find section information. '
    'The Galaxy enrollment deep-link works independently of Nebula.', BODY_SM))
story.append(Spacer(1, 10))

# ══════════════════════════════════════════════════════════════
# SECTION 8 — DATABASE SCHEMA SUMMARY
# ══════════════════════════════════════════════════════════════
story.append(section_bar('8.  Database Schema Summary'))
story.append(Spacer(1, 5))

schema_data = [
    ['Table / View', 'Type', 'Purpose', 'Key Relationships'],
    ['users', 'Table', 'Auth accounts (student/admin)', 'One-to-one with students'],
    ['departments', 'Table', 'JSOM department registry', 'FK from programs'],
    ['programs', 'Table', 'Degree programs (39 rows)', 'FK to departments, concentrations'],
    ['courses', 'Table', 'Master course catalog (311)', 'full_code generated column'],
    ['course_prerequisites', 'Table', 'Directed prereq graph edges', 'Self-referencing FK on courses'],
    ['program_core_courses', 'Table', 'Core course assignments', 'M2M: programs ↔ courses'],
    ['concentrations', 'Table', 'Concentrations per program', 'FK to programs'],
    ['concentration_courses', 'Table', 'Elective pool per concentration', 'M2M: concentrations ↔ courses'],
    ['students', 'Table', 'Student profiles', 'FK to users, programs, concentrations'],
    ['student_courses', 'Table', 'Course plan / enrollment', 'FK to students + courses; UNIQUE constraint'],
    ['course_sections', 'Table', 'Nebula API section cache', 'FK to courses'],
    ['audit_log', 'Table', 'All write operation history', 'FK to users; old_data/new_data as JSONB'],
    ['course_graph', 'Mat. View', 'Denormalized graph relationships', 'Refreshed on demand; UNIQUE index'],
    ['student_progress', 'View', 'Aggregated degree progress', 'Live query joining 5 tables'],
]
stbl = Table(schema_data, colWidths=[1.4*inch, 0.65*inch, 1.7*inch, 2.55*inch])
stbl.setStyle(tbl_style(header_bg=UTD_NAVY))
story.append(stbl)
story.append(Spacer(1, 10))

# ══════════════════════════════════════════════════════════════
# SECTION 9 — FUTURE ROADMAP
# ══════════════════════════════════════════════════════════════
story.append(section_bar('9.  Future Roadmap'))
story.append(Spacer(1, 5))

road_data = [
    ['Priority', 'Feature', 'Effort', 'Notes'],
    ['High', 'Galaxy API enrollment', 'High', 'Requires UTD IT partnership; currently deep-link workaround'],
    ['High', 'Email notifications', 'Medium', 'Notify students when admin changes core courses in their program'],
    ['Medium', 'AI advisor chatbot', 'Medium', 'Claude API integration to answer "what should I take next?" questions'],
    ['Medium', 'Degree audit PDF export', 'Low', 'Export full degree plan as formatted PDF for advisor meetings'],
    ['Medium', 'Graph visualization', 'Medium', 'Interactive D3.js force-directed graph of course dependencies'],
    ['Low', 'Multi-semester planner', 'Medium', 'Drag-and-drop multi-year plan with what-if analysis'],
    ['Low', 'Grade prediction', 'High', 'ML model using Nebula grade history to forecast GPA impact'],
    ['Low', 'Mobile app', 'High', 'React Native port of student portal'],
]
rtbl = Table(road_data, colWidths=[0.65*inch, 1.9*inch, 0.6*inch, 3.15*inch])
rtbl.setStyle(tbl_style(header_bg=colors.HexColor('#6C3483')))
story.append(rtbl)
story.append(Spacer(1, 10))

# ══════════════════════════════════════════════════════════════
# SECTION 10 — CONCLUSION
# ══════════════════════════════════════════════════════════════
story.append(section_bar('10.  Conclusion'))
story.append(Spacer(1, 5))
story.append(Paragraph(
    'JSOM Degree Planner delivers a production-ready, end-to-end degree planning platform grounded in '
    'a rigorously validated knowledge graph of JSOM graduate programs. The graph-theoretic data model — '
    '311 course nodes, 1,800+ relationship edges across programs and concentrations — enables computationally '
    'correct prerequisite validation, cross-listing detection, and eligible-course recommendations that '
    'static catalog documents cannot provide.', BODY))
story.append(Spacer(1, 4))
story.append(Paragraph(
    'The administrative interface ensures that degree constraint changes made by JSOM staff propagate '
    'immediately to all student dashboards, eliminating the version-drift problem of static PDFs. '
    'The Nebula API integration, graceful fallback design, and Galaxy deep-link enrollment path '
    'demonstrate a realistic production deployment strategy within the UTD ecosystem.', BODY))
story.append(Spacer(1, 4))
story.append(Paragraph(
    'The codebase — 5,545 lines across 38 files — is fully containerized, documented, and ready for '
    'deployment. All data relationships have been verified against the original JSOM Graduate Catalog '
    '2025 source document.', BODY))
story.append(Spacer(1, 8))

# Footer strip
story.append(HRFlowable(width='100%', thickness=1, color=UTD_ORANGE))
story.append(Spacer(1, 4))
footer_tbl = Table([[
    Paragraph('JSOM Degree Planner  ·  UT Dallas Spring 2026', CAPTION),
    Paragraph('github.com/utd-jsom/degree-planner', S('fl', fontName='Helvetica', fontSize=8, textColor=UTD_NAVY, alignment=TA_RIGHT)),
]], colWidths=[3.8*inch, 2.5*inch])
footer_tbl.setStyle(TableStyle([('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0)]))
story.append(footer_tbl)

doc.build(story)
print(f"PDF saved to {OUT}")
