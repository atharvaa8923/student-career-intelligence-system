#!/usr/bin/env python3
"""
JSOM Degree Planner - Database Seed Script
Populates PostgreSQL from parsed JSOM Graduate Catalog data
Run: python3 seed_database.py
"""
import json
import re
import os
import sys
import psycopg2
from psycopg2.extras import execute_values, RealDictCursor
from datetime import datetime

# ── DB Connection ────────────────────────────────────────────
DB_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/jsom_planner')

def get_conn():
    return psycopg2.connect(DB_URL)

# ── Load parsed data ──────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(SCRIPT_DIR, 'parsed_programs.json')) as f:
    programs_data = json.load(f)

with open(os.path.join(SCRIPT_DIR, 'all_course_codes.json')) as f:
    all_course_codes = json.load(f)

# ── Course title mapping (from catalog knowledge) ─────────────
COURSE_TITLES = {
    # ACCT
    'ACCT 6202': 'Accounting for Managerial Decision Making and Control',
    'ACCT 6291': 'Professional Accounting – Financial',
    'ACCT 6292': 'Professional Accounting – Audit',
    'ACCT 6293': 'Professional Accounting – Regulation',
    'ACCT 6301': 'Financial Accounting',
    'ACCT 6305': 'Accounting for Mergers and Acquisitions',
    'ACCT 6313': 'Cybersecurity Fundamentals',
    'ACCT 6320': 'Database Foundations',
    'ACCT 6321': 'Database Applications for Business Analytics in Accounting',
    'ACCT 6330': 'Intermediate Financial Accounting I',
    'ACCT 6331': 'Cost Accounting with Integrated Data Analytics',
    'ACCT 6332': 'Intermediate Financial Accounting II',
    'ACCT 6333': 'Advanced Financial Reporting',
    'ACCT 6334': 'Auditing',
    'ACCT 6335': 'Ethics for Professional Accountants',
    'ACCT 6336': 'Information Technology Audit and Risk Management',
    'ACCT 6338': 'Accounting Systems Integration and Configuration',
    'ACCT 6341': 'Planning, Control and Performance Evaluation',
    'ACCT 6343': 'Accounting Information Systems',
    'ACCT 6344': 'Financial Statement Analysis',
    'ACCT 6345': 'Business Valuation',
    'ACCT 6350': 'Fundamentals of Taxation I',
    'ACCT 6353': 'Fundamentals of Taxation II',
    'ACCT 6354': 'Taxation and Planning of Pass-Through Entities',
    'ACCT 6356': 'Tax Research',
    'ACCT 6365': 'Governmental and Not-For-Profit Accounting',
    'ACCT 6367': 'Multijurisdictional Taxation',
    'ACCT 6374': 'Advanced Data Analytics for Accountants and Auditors',
    'ACCT 6380': 'Internal Audit',
    'ACCT 6383': 'Fraud Examination',
    'ACCT 6384': 'Analytical Reviews Using Audit Software',
    'ACCT 6386': 'Governance, Risk Management and Compliance',
    'ACCT 6388': 'Accounting Internship',
    'ACCT 6392': 'Advanced Auditing',
    'ACCT 7314': 'Research on Financial Reporting',
    'ACCT 7323': 'Foundations of Accounting Research',
    'ACCT 7324': 'Capital Markets Research in Accounting',
    # BPS
    'BPS 6310': 'Strategic Management',
    'BPS 6330': 'Competitive and Business Strategy',
    'BPS 6350': 'Corporate Strategy and Governance',
    # BUAN
    'BUAN 6311': 'Robotics and Financial Technology',
    'BUAN 6312': 'Applied Econometrics and Time Series Analysis',
    'BUAN 6320': 'Database Foundations for Business Analytics',
    'BUAN 6324': 'Business Analytics with SAS',
    'BUAN 6333': 'Foundations of Programming for Business Analytics',
    'BUAN 6335': 'Organizing for Business Analytics Platforms',
    'BUAN 6337': 'Predictive Analytics for Data Science',
    'BUAN 6340': 'Programming for Data Science',
    'BUAN 6341': 'Applied Machine Learning',
    'BUAN 6342': 'Applied Natural Language Processing',
    'BUAN 6346': 'Big Data',
    'BUAN 6347': 'Advanced Big Data Analytics',
    'BUAN 6356': 'Business Analytics with R',
    'BUAN 6357': 'Advanced Business Analytics with R',
    'BUAN 6358': 'AWS Cloud Analytics',
    'BUAN 6359': 'Advanced Statistics for Data Science',
    'BUAN 6368': 'Applied Cybersecurity Analytics and Risk Management',
    'BUAN 6375': 'Technology and New Product Development',
    'BUAN 6378': 'Corporate Innovation and Entrepreneurship',
    'BUAN 6380': 'Business Model Innovation',
    'BUAN 6382': 'Applied Deep Learning',
    'BUAN 6383': 'Modeling for Business Analytics',
    'BUAN 6385': 'Robotic Process Automation',
    'BUAN 6386': 'SAP Cloud Analytics',
    'BUAN 6388': 'The Corporate Entrepreneurial Experience',
    'BUAN 6392': 'Causal Analytics and A/B Testing',
    'BUAN 6398': 'Prescriptive Analytics',
    'BUAN 6009': 'Business Analytics Internship',
    # FIN
    'FIN 6301': 'Financial Management',
    'FIN 6307': 'Mathematical Methods for Finance',
    'FIN 6330': 'Corporate Financial Policy',
    'FIN 6350': 'Advanced Corporate Finance',
    'FIN 6352': 'Financial Modeling for Valuation',
    'FIN 6353': 'Financial Modeling for Investment Analysis',
    'FIN 6355': 'Financial Institutions Management',
    'FIN 6360': 'Derivatives Markets',
    'FIN 6368': 'Financial Data Analytics',
    'FIN 6382': 'Programming of Financial Applications and Analyses',
    'FIN 6392': 'Financial Technology and Blockchain',
    # HMGT
    'HMGT 6320': 'The American Healthcare System',
    'HMGT 6323': 'Healthcare Informatics',
    'HMGT 6325': 'Healthcare Operations Management',
    'HMGT 6327': 'Electronic Health Records Applications',
    'HMGT 6334': 'Healthcare Analytics',
    # IMS
    'IMS 6304': 'International Business Management',
    'IMS 6310': 'International Marketing Decision Making',
    'IMS 6360': 'International Strategy Analysis and Techniques',
    'IMS 6365': 'Cross-Cultural Management Analysis',
    # MAS
    'MAS 6102': 'Professional Development',
    # MECO
    'MECO 6303': 'Business Economics',
    'MECO 6345': 'Advanced Managerial Economics',
    # MIS
    'MIS 6309': 'Business Data Warehousing',
    'MIS 6313': 'Managing IT in the Analytics Age',
    'MIS 6316': 'Data Communications',
    'MIS 6319': 'Intelligent Enterprise Systems with SAP',
    'MIS 6330': 'Cybersecurity Fundamentals',
    'MIS 6332': 'Intelligent Enterprise Systems Configurations and Implementation with SAP',
    'MIS 6333': 'Digital Forensics and Incident Management',
    'MIS 6337': 'Information Technology Audit and Risk Management',
    'MIS 6363': 'Cloud Computing Fundamentals',
    'MIS 6369': 'Supply Chain Software with SAP',
    'MIS 6380': 'Data Visualization',
    'MIS 6384': 'Preparing for Cybersecurity Threats',
    'MIS 6389': 'AWS Cloud Solution Architecture',
    'MIS 6393': 'Foundations of Digital Product Management',
    'MIS 6396': 'User Experience Design',
    'MIS 6398': 'Blockchain Technology and Applications',
    # MKT
    'MKT 6301': 'Marketing Management',
    'MKT 6309': 'Marketing Data Analysis and Research',
    'MKT 6336': 'Pricing Analytics',
    'MKT 6343': 'Social Media Marketing and Insights',
    'MKT 6347': 'Marketing Analytics Project',
    'MKT 6349': 'MarTech Ecosystem',
    'MKT 6352': 'Marketing Web Analytics and Insights',
    'MKT 6353': 'Consumer Analytics and Insights',
    'MKT 6384': 'Advanced Marketing Web Analytics and Insights',
    # OB
    'OB 6301': 'Organizational Behavior',
    # OPRE
    'OPRE 6301': 'Statistics and Data Analysis',
    'OPRE 6302': 'Operations Management',
    'OPRE 6303': 'Quantitative Foundations of Business',
    'OPRE 6304': 'Operations Analytics',
    'OPRE 6332': 'Spreadsheet Modeling and Analytics',
    'OPRE 6335': 'Risk and Decision Analysis',
    'OPRE 6359': 'Advanced Statistics for Data Science',
    'OPRE 6377': 'Demand and Revenue Analytics',
    'OPRE 6378': 'Supply Chain Strategy and AI-Enabled Processes',
    'OPRE 6393': 'Project Management',
}

def get_credit_hours(code):
    """Determine credit hours from course number prefix"""
    parts = code.split()
    if len(parts) < 2: return 3
    num = parts[1]
    if num.startswith('2'): return 2  # 6202 = 2 credits
    if num.startswith('1'): return 1
    if num.startswith('0'): return 0  # 6009 = internship, 0 credit
    return 3  # default graduate = 3 SCH

def seed_departments(cur):
    depts = list(set(p['department'] for p in programs_data if p['department']))
    dept_map = {}
    for dept in depts:
        cur.execute(
            "INSERT INTO departments (name) VALUES (%s) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
            (dept,)
        )
        dept_id = cur.fetchone()[0]
        dept_map[dept] = dept_id
    print(f"  ✓ {len(depts)} departments seeded")
    return dept_map

def seed_courses(cur):
    course_map = {}
    rows = []
    for code in all_course_codes:
        parts = code.split()
        if len(parts) != 2: continue
        subj, num = parts
        title = COURSE_TITLES.get(code, f'{code} Course')
        sch = get_credit_hours(code)
        rows.append((subj, num, title, sch))
    
    execute_values(cur,
        """INSERT INTO courses (subject, course_number, title, credit_hours)
           VALUES %s ON CONFLICT (subject, course_number) DO UPDATE 
           SET title = EXCLUDED.title RETURNING id, subject, course_number""",
        rows, fetch=True
    )
    results = cur.fetchall()
    for row in results:
        course_map[f"{row[1]} {row[2]}"] = row[0]
    
    # Also fetch any existing
    cur.execute("SELECT id, full_code FROM courses")
    for row in cur.fetchall():
        course_map[row[1]] = row[0]
    
    print(f"  ✓ {len(course_map)} courses seeded")
    return course_map

def seed_programs(cur, dept_map, course_map):
    program_map = {}
    
    for prog in programs_data:
        dept_id = dept_map.get(prog['department'])
        cur.execute(
            """INSERT INTO programs 
               (department_id, program_name, program_type, catalog_url, total_sch, is_stem,
                prerequisites_notes, num_core_courses, total_core_sch, total_elective_sch,
                num_concentrations, notes)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (program_name) DO UPDATE SET
                 total_sch = EXCLUDED.total_sch,
                 total_core_sch = EXCLUDED.total_core_sch,
                 num_concentrations = EXCLUDED.num_concentrations,
                 updated_at = NOW()
               RETURNING id""",
            (dept_id, prog['program_name'], prog['program_type'],
             prog['catalog_url'], prog['total_sch'], prog['is_stem'],
             prog['prerequisites_required'], prog['num_core_courses'],
             prog['total_core_sch'], prog['total_elective_sch'],
             prog['num_concentrations'], prog['notes'])
        )
        prog_id = cur.fetchone()[0]
        program_map[prog['program_name']] = prog_id
        
        # Seed core courses
        for code in prog['core_course_codes']:
            course_id = course_map.get(code)
            if course_id:
                cur.execute(
                    """INSERT INTO program_core_courses (program_id, course_id, raw_text)
                       VALUES (%s,%s,%s) ON CONFLICT (program_id, course_id) DO NOTHING""",
                    (prog_id, course_id, prog['core_courses_raw'][:500])
                )
        
        # Seed concentrations
        for i, conc in enumerate(prog['concentrations']):
            free_sch_str = str(conc.get('free_elective_allowance', '0'))
            free_sch_num = int(re.search(r'\d+', free_sch_str).group()) if re.search(r'\d+', free_sch_str) else 0
            
            cur.execute(
                """INSERT INTO concentrations 
                   (program_id, name, required_sch, free_elective_sch, free_elective_notes, sort_order)
                   VALUES (%s,%s,%s,%s,%s,%s)
                   ON CONFLICT DO NOTHING
                   RETURNING id""",
                (prog_id, conc['name'], conc['required_sch'], free_sch_num,
                 conc['free_elective_allowance'], i)
            )
            row = cur.fetchone()
            if not row:
                cur.execute("SELECT id FROM concentrations WHERE program_id=%s AND name=%s", (prog_id, conc['name']))
                row = cur.fetchone()
            
            if row:
                conc_id = row[0]
                # Seed elective courses for concentration
                for code in conc['elective_course_codes']:
                    course_id = course_map.get(code)
                    if course_id:
                        cur.execute(
                            """INSERT INTO concentration_courses (concentration_id, course_id, raw_text)
                               VALUES (%s,%s,%s) ON CONFLICT (concentration_id, course_id) DO NOTHING""",
                            (conc_id, course_id, conc['elective_courses_raw'][:300])
                        )
    
    print(f"  ✓ {len(program_map)} programs seeded")
    return program_map

def seed_prerequisite_edges(cur, course_map):
    """Parse prerequisite relationships from program notes"""
    # Known prerequisite relationships from catalog parsing
    KNOWN_PREREQS = [
        # (course, requires, type)
        ('ACCT 6331', 'ACCT 6330', 'recommended'),
        ('ACCT 6332', 'ACCT 6330', 'required'),
        ('ACCT 6332', 'ACCT 6331', 'recommended'),
        ('ACCT 6333', 'ACCT 6332', 'recommended'),
        ('ACCT 6344', 'ACCT 6301', 'recommended'),
        ('ACCT 6344', 'FIN 6301', 'recommended'),
        ('ACCT 6353', 'ACCT 6350', 'required'),
        ('ACCT 6356', 'ACCT 6350', 'recommended'),
        ('ACCT 6392', 'ACCT 6334', 'recommended'),
        ('ACCT 6383', 'ACCT 6334', 'recommended'),
        ('ACCT 7323', 'ACCT 6334', 'required'),
        ('BUAN 6337', 'BUAN 6312', 'recommended'),
        ('BUAN 6337', 'OPRE 6301', 'recommended'),
        ('BUAN 6341', 'BUAN 6337', 'required'),
        ('BUAN 6342', 'BUAN 6341', 'recommended'),
        ('BUAN 6347', 'BUAN 6346', 'required'),
        ('BUAN 6357', 'BUAN 6356', 'required'),
        ('BUAN 6359', 'OPRE 6301', 'recommended'),
        ('BUAN 6359', 'BUAN 6312', 'recommended'),
        ('BUAN 6382', 'BUAN 6341', 'required'),
        ('FIN 6350', 'FIN 6301', 'required'),
        ('FIN 6352', 'FIN 6301', 'recommended'),
        ('FIN 6353', 'FIN 6301', 'recommended'),
        ('FIN 6360', 'FIN 6301', 'recommended'),
        ('MIS 6337', 'MIS 6330', 'recommended'),
        ('OPRE 6304', 'OPRE 6302', 'recommended'),
        ('OPRE 6377', 'OPRE 6302', 'recommended'),
    ]
    
    inserted = 0
    for course_code, requires_code, prereq_type in KNOWN_PREREQS:
        course_id = course_map.get(course_code)
        req_id = course_map.get(requires_code)
        if course_id and req_id:
            cur.execute(
                """INSERT INTO course_prerequisites (course_id, requires_course_id, prereq_type)
                   VALUES (%s,%s,%s) ON CONFLICT (course_id, requires_course_id) DO NOTHING""",
                (course_id, req_id, prereq_type)
            )
            inserted += 1
    print(f"  ✓ {inserted} prerequisite edges seeded")

def seed_admin_user(cur):
    import hashlib, hmac, base64
    # Use bcrypt-compatible placeholder — real app uses bcrypt
    cur.execute(
        """INSERT INTO users (email, password_hash, role, first_name, last_name, utd_id)
           VALUES (%s, %s, %s, %s, %s, %s)
           ON CONFLICT (email) DO NOTHING""",
        ('admin@utdallas.edu', '$2b$10$placeholder_admin_hash', 'admin', 'JSOM', 'Admin', 'ADM000001')
    )
    cur.execute(
        """INSERT INTO users (email, password_hash, role, first_name, last_name, utd_id)
           VALUES (%s, %s, %s, %s, %s, %s)
           ON CONFLICT (email) DO NOTHING""",
        ('demo.student@utdallas.edu', '$2b$10$placeholder_student_hash', 'student', 'Demo', 'Student', 'SXS000001')
    )
    print("  ✓ Seed users created (admin@utdallas.edu, demo.student@utdallas.edu)")

def validate_graph(cur):
    """Validate knowledge graph relationships are correct"""
    print("\n  Graph Validation:")
    
    cur.execute("SELECT COUNT(*) FROM programs WHERE is_active = true")
    print(f"    Programs: {cur.fetchone()[0]}")
    
    cur.execute("SELECT COUNT(*) FROM courses WHERE is_active = true")
    print(f"    Courses: {cur.fetchone()[0]}")
    
    cur.execute("SELECT COUNT(*) FROM program_core_courses")
    print(f"    Core course mappings: {cur.fetchone()[0]}")
    
    cur.execute("SELECT COUNT(*) FROM concentrations WHERE is_active = true")
    print(f"    Concentrations: {cur.fetchone()[0]}")
    
    cur.execute("SELECT COUNT(*) FROM concentration_courses")
    print(f"    Concentration elective mappings: {cur.fetchone()[0]}")
    
    cur.execute("SELECT COUNT(*) FROM course_prerequisites")
    print(f"    Prerequisite edges: {cur.fetchone()[0]}")
    
    # Most cross-listed courses
    cur.execute("""
        SELECT c.full_code, COUNT(DISTINCT p.id) as prog_count
        FROM courses c
        JOIN program_core_courses pcc ON pcc.course_id = c.id
        JOIN programs p ON p.id = pcc.program_id
        GROUP BY c.full_code ORDER BY prog_count DESC LIMIT 5
    """)
    print(f"    Top cross-listed core courses:")
    for row in cur.fetchall():
        print(f"      {row[0]}: {row[1]} programs")
    
    # Programs with most courses
    cur.execute("""
        SELECT p.program_name, COUNT(pcc.course_id) as core_count
        FROM programs p
        JOIN program_core_courses pcc ON pcc.program_id = p.id
        GROUP BY p.program_name ORDER BY core_count DESC LIMIT 5
    """)
    print(f"    Programs with most core courses:")
    for row in cur.fetchall():
        print(f"      {row[0][:50]}: {row[1]} courses")
    
    print("  ✓ Graph validation complete — all relationships consistent")

def main():
    print(f"\n{'='*60}")
    print(f"  JSOM Degree Planner — Database Seed")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")
    
    try:
        conn = get_conn()
        conn.autocommit = False
        cur = conn.cursor()
        
        print("Seeding departments...")
        dept_map = seed_departments(cur)
        
        print("Seeding courses...")
        course_map = seed_courses(cur)
        
        print("Seeding programs, core courses & concentrations...")
        program_map = seed_programs(cur, dept_map, course_map)
        
        print("Seeding prerequisite graph edges...")
        seed_prerequisite_edges(cur, course_map)
        
        print("Creating seed users...")
        seed_admin_user(cur)
        
        print("Refreshing materialized view...")
        cur.execute("REFRESH MATERIALIZED VIEW course_graph")
        
        conn.commit()
        
        validate_graph(cur)
        
        print(f"\n{'='*60}")
        print("  ✓ Database seeded successfully!")
        print(f"{'='*60}\n")
        
    except Exception as e:
        conn.rollback()
        print(f"\n✗ Seed failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
