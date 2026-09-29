-- ============================================================
-- JSOM DEGREE PLANNER - Complete Database Schema
-- PostgreSQL 15+ | UTD JSOM Graduate Programs
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy course search

-- ============================================================
-- USERS & AUTH
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_user_id UUID UNIQUE,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('student', 'admin')),
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  utd_id        VARCHAR(20) UNIQUE,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(200) UNIQUE NOT NULL,
  code       VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROGRAMS (Degree Requirements)
-- ============================================================
CREATE TABLE programs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id         UUID REFERENCES departments(id),
  program_name          VARCHAR(300) UNIQUE NOT NULL,
  program_type          VARCHAR(50) NOT NULL CHECK (program_type IN ('MS','MBA','Certificate','Double Degree','Executive MS','PhD')),
  catalog_url           TEXT,
  total_sch             INTEGER NOT NULL DEFAULT 0,
  is_stem               BOOLEAN DEFAULT false,
  prerequisites_notes   TEXT,
  num_core_courses      INTEGER DEFAULT 0,
  total_core_sch        INTEGER DEFAULT 0,
  total_elective_sch    INTEGER DEFAULT 0,
  num_concentrations    INTEGER DEFAULT 0,
  notes                 TEXT,
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_programs_type ON programs(program_type);
CREATE INDEX idx_programs_dept ON programs(department_id);

-- ============================================================
-- COURSES (Master Catalog)
-- ============================================================
CREATE TABLE courses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject         VARCHAR(10) NOT NULL,
  course_number   VARCHAR(10) NOT NULL,
  full_code       VARCHAR(20) GENERATED ALWAYS AS (subject || ' ' || course_number) STORED,
  title           VARCHAR(300) NOT NULL DEFAULT 'TBD',
  description     TEXT,
  credit_hours    INTEGER NOT NULL DEFAULT 3,
  prereq_text     TEXT,
  nebula_id       VARCHAR(100),  -- ID from Nebula API if available
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject, course_number)
);

CREATE INDEX idx_courses_subject ON courses(subject);
CREATE INDEX idx_courses_full_code ON courses(full_code);
CREATE INDEX idx_courses_title_trgm ON courses USING gin(title gin_trgm_ops);

-- ============================================================
-- PREREQUISITE GRAPH EDGES
-- ============================================================
CREATE TABLE course_prerequisites (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id         UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  requires_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  prereq_type       VARCHAR(20) DEFAULT 'required' CHECK (prereq_type IN ('required','recommended','concurrent')),
  logic_group       VARCHAR(10) DEFAULT 'AND',  -- AND/OR for grouped prereqs
  group_id          INTEGER DEFAULT 0,           -- courses in same group are OR'd
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, requires_course_id)
);

CREATE INDEX idx_prereq_course ON course_prerequisites(course_id);
CREATE INDEX idx_prereq_requires ON course_prerequisites(requires_course_id);

-- ============================================================
-- PROGRAM CORE COURSES
-- ============================================================
CREATE TABLE program_core_courses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  raw_text    TEXT,  -- preserve original catalog text including any OR options
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, course_id)
);

CREATE INDEX idx_core_program ON program_core_courses(program_id);

-- ============================================================
-- CONCENTRATIONS
-- ============================================================
CREATE TABLE concentrations (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id             UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name                   VARCHAR(300) NOT NULL,
  required_sch           INTEGER DEFAULT 0,
  free_elective_sch      INTEGER DEFAULT 0,
  free_elective_notes    TEXT,
  sort_order             INTEGER DEFAULT 0,
  is_active              BOOLEAN DEFAULT true,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_concentrations_program ON concentrations(program_id);

-- ============================================================
-- CONCENTRATION ELECTIVE COURSES
-- ============================================================
CREATE TABLE concentration_courses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concentration_id  UUID NOT NULL REFERENCES concentrations(id) ON DELETE CASCADE,
  course_id         UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  group_label       VARCHAR(50) DEFAULT 'A',  -- "Set A", "Set B" etc for grouped choices
  min_from_group    INTEGER DEFAULT 1,
  raw_text          TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(concentration_id, course_id)
);

CREATE INDEX idx_conc_courses_conc ON concentration_courses(concentration_id);
CREATE INDEX idx_conc_courses_course ON concentration_courses(course_id);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE TABLE students (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id            UUID REFERENCES programs(id),
  concentration_id      UUID REFERENCES concentrations(id),
  enrollment_year       INTEGER,
  enrollment_semester   VARCHAR(10) CHECK (enrollment_semester IN ('Fall','Spring','Summer')),
  expected_graduation   VARCHAR(20),
  gpa                   NUMERIC(3,2),
  is_full_time          BOOLEAN DEFAULT true,
  advisor_notes         TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_students_user ON students(user_id);
CREATE INDEX idx_students_program ON students(program_id);

-- ============================================================
-- STUDENT COURSES (The core enrollment/planning table)
-- ============================================================
CREATE TABLE student_courses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES courses(id),
  semester      VARCHAR(10) NOT NULL CHECK (semester IN ('Fall','Spring','Summer')),
  year          INTEGER NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','enrolled','completed','dropped','waived')),
  grade         VARCHAR(5),  -- A+, A, A-, B+, etc.
  grade_points  NUMERIC(3,2),
  section_id    VARCHAR(50), -- Nebula API section ID for enrolled courses
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id, semester, year)
);

CREATE INDEX idx_student_courses_student ON student_courses(student_id);
CREATE INDEX idx_student_courses_status ON student_courses(status);
CREATE INDEX idx_student_courses_course ON student_courses(course_id);

-- ============================================================
-- COURSE SECTIONS (from Nebula API cache)
-- ============================================================
CREATE TABLE course_sections (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id     UUID NOT NULL REFERENCES courses(id),
  nebula_id     VARCHAR(100) UNIQUE,
  section_number VARCHAR(10),
  semester      VARCHAR(10) NOT NULL,
  year          INTEGER NOT NULL,
  professor     VARCHAR(200),
  days          VARCHAR(20),   -- MWF, TR, etc.
  start_time    TIME,
  end_time      TIME,
  location      VARCHAR(100),
  seats_total   INTEGER DEFAULT 0,
  seats_filled  INTEGER DEFAULT 0,
  modality      VARCHAR(20) DEFAULT 'In-Person',  -- In-Person, Online, Hybrid
  last_synced   TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sections_course ON course_sections(course_id);
CREATE INDEX idx_sections_semester ON course_sections(semester, year);

-- ============================================================
-- AUDIT LOG (Admin changes tracking)
-- ============================================================
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(50) NOT NULL,  -- CREATE, UPDATE, DELETE
  entity_type VARCHAR(50) NOT NULL,  -- program, course, concentration, etc.
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- ============================================================
-- GRAPH RELATIONSHIPS VIEW (Knowledge Graph materialized)
-- ============================================================
CREATE MATERIALIZED VIEW course_graph AS
SELECT 
  c.id as course_id,
  c.full_code,
  c.title,
  c.subject,
  c.credit_hours,
  -- Programs this course is core in
  COALESCE((
    SELECT json_agg(json_build_object('program_id', p.id, 'program_name', p.program_name, 'type', p.program_type))
    FROM program_core_courses pcc
    JOIN programs p ON p.id = pcc.program_id
    WHERE pcc.course_id = c.id
  ), '[]'::json) as core_in_programs,
  -- Concentrations this course is an elective in
  COALESCE((
    SELECT json_agg(json_build_object('concentration_id', conc.id, 'concentration_name', conc.name, 'program_name', p.program_name))
    FROM concentration_courses cc
    JOIN concentrations conc ON conc.id = cc.concentration_id
    JOIN programs p ON p.id = conc.program_id
    WHERE cc.course_id = c.id
  ), '[]'::json) as elective_in_concentrations,
  -- Prerequisites
  COALESCE((
    SELECT json_agg(json_build_object('course_id', rc.id, 'course_code', rc.full_code, 'prereq_type', cp.prereq_type))
    FROM course_prerequisites cp
    JOIN courses rc ON rc.id = cp.requires_course_id
    WHERE cp.course_id = c.id
  ), '[]'::json) as prerequisites,
  -- Courses that require this course
  COALESCE((
    SELECT json_agg(json_build_object('course_id', dc.id, 'course_code', dc.full_code))
    FROM course_prerequisites cp2
    JOIN courses dc ON dc.id = cp2.course_id
    WHERE cp2.requires_course_id = c.id
  ), '[]'::json) as required_by
FROM courses c
WHERE c.is_active = true;

CREATE UNIQUE INDEX idx_course_graph_id ON course_graph(course_id);

-- ============================================================
-- STUDENT PROGRESS VIEW
-- ============================================================
CREATE VIEW student_progress AS
SELECT
  s.id as student_id,
  u.first_name,
  u.last_name,
  u.email,
  p.program_name,
  p.total_sch as required_sch,
  p.total_core_sch,
  p.total_elective_sch,
  -- Completed SCH
  COALESCE(SUM(CASE WHEN sc.status = 'completed' THEN c.credit_hours ELSE 0 END), 0) as completed_sch,
  -- Enrolled SCH
  COALESCE(SUM(CASE WHEN sc.status = 'enrolled' THEN c.credit_hours ELSE 0 END), 0) as enrolled_sch,
  -- Planned SCH
  COALESCE(SUM(CASE WHEN sc.status = 'planned' THEN c.credit_hours ELSE 0 END), 0) as planned_sch,
  -- Remaining SCH
  p.total_sch - COALESCE(SUM(CASE WHEN sc.status IN ('completed','enrolled') THEN c.credit_hours ELSE 0 END), 0) as remaining_sch,
  -- GPA
  s.gpa,
  -- Core courses completed
  (SELECT COUNT(*) FROM program_core_courses pcc 
   JOIN student_courses sc2 ON sc2.course_id = pcc.course_id AND sc2.student_id = s.id AND sc2.status = 'completed'
   WHERE pcc.program_id = s.program_id) as core_completed,
  p.num_core_courses as core_required
FROM students s
JOIN users u ON u.id = s.user_id
LEFT JOIN programs p ON p.id = s.program_id
LEFT JOIN student_courses sc ON sc.student_id = s.id
LEFT JOIN courses c ON c.id = sc.course_id
GROUP BY s.id, u.first_name, u.last_name, u.email, p.program_name, p.total_sch, p.total_core_sch, p.total_elective_sch, s.gpa, s.program_id, p.num_core_courses;

-- ============================================================
-- TRIGGERS: updated_at auto-update
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_programs_updated BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_student_courses_updated BEFORE UPDATE ON student_courses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_concentrations_updated BEFORE UPDATE ON concentrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
