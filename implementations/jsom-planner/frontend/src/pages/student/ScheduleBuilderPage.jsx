import { useState, useEffect } from 'react';
import { studentsAPI, scheduleAPI } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { Calendar, AlertTriangle, CheckCircle, ExternalLink, Plus, Clock } from 'lucide-react';

const SEMESTERS = ['Spring','Summer','Fall'];
const CURRENT_YEAR = new Date().getFullYear();

export default function ScheduleBuilderPage() {
  const [semester, setSemester]   = useState(getCurrentSemester());
  const [year, setYear]           = useState(CURRENT_YEAR);
  const [schedule, setSchedule]   = useState(null);
  const [eligible, setEligible]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [enrolling, setEnrolling] = useState(null);
  const toast = useToast();

  useEffect(() => { loadSchedule(); }, [semester, year]);

  useEffect(() => {
    studentsAPI.eligibleCourses()
      .then(r => setEligible(r.data))
      .catch(() => {});
  }, []);

  async function loadSchedule() {
    setLoading(true);
    try {
      const r = await scheduleAPI.get({ semester, year });
      setSchedule(r.data);
    } catch { toast.error('Failed to load schedule'); }
    finally { setLoading(false); }
  }

  async function handleEnroll(studentCourseId, sectionId) {
    setEnrolling(studentCourseId);
    try {
      const r = await scheduleAPI.enroll({ student_course_id: studentCourseId, section_id: sectionId });
      toast.success('Marked as enrolled. Opening Galaxy...');
      window.open(r.data.galaxy_url, '_blank');
      loadSchedule();
    } catch { toast.error('Enrollment failed'); }
    finally { setEnrolling(null); }
  }

  const totalSCH = schedule?.courses?.reduce((s, c) => s + (c.credit_hours || 0), 0) || 0;

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <h1>Schedule Builder</h1>
          <p>Plan your courses and check for conflicts before enrolling in Galaxy</p>
        </div>
        {/* Semester selector */}
        <div style={{ display:'flex', gap:'0.75rem', alignItems:'center' }}>
          <select className="form-select" style={{ width:110 }} value={semester} onChange={e=>setSemester(e.target.value)}>
            {SEMESTERS.map(s=><option key={s}>{s}</option>)}
          </select>
          <select className="form-select" style={{ width:90 }} value={year} onChange={e=>setYear(parseInt(e.target.value))}>
            {[CURRENT_YEAR-1, CURRENT_YEAR, CURRENT_YEAR+1, CURRENT_YEAR+2].map(y=><option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Conflict alerts */}
      {schedule?.conflicts?.length > 0 && (
        <div style={{ marginBottom:'1.25rem' }}>
          {schedule.conflicts.map((c, i) => (
            <div key={i} className="alert alert-warning" style={{ marginBottom:'0.5rem' }}>
              <AlertTriangle size={16} />
              <strong>Time Conflict:</strong> {c.message}
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'1.5rem' }}>
        {/* Main schedule view */}
        <div>
          {/* Summary row */}
          <div style={{ display:'flex', gap:'1rem', marginBottom:'1.25rem' }}>
            {[
              { label:'Courses', value: schedule?.courses?.length || 0, color:'var(--utd-navy)' },
              { label:'Credit Hours', value: totalSCH, color:'var(--utd-orange)' },
              { label:'Conflicts', value: schedule?.conflicts?.length || 0, color: schedule?.conflicts?.length ? 'var(--color-error)' : 'var(--utd-green)' },
            ].map(s => (
              <div key={s.label} style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--radius-md)', padding:'0.875rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                <span style={{ fontSize:'1.5rem', fontWeight:700, color:s.color, fontFamily:'var(--font-serif)' }}>{s.value}</span>
                <span style={{ fontSize:'0.8rem', color:'var(--gray-500)' }}>{s.label}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="loading-overlay"><div className="spinner lg" /></div>
          ) : schedule?.courses?.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'3rem' }}>
              <Calendar size={40} color="var(--gray-300)" style={{ marginBottom:'1rem', display:'block', margin:'0 auto 1rem' }} />
              <p style={{ color:'var(--gray-500)', marginBottom:'1rem' }}>No courses planned for {semester} {year}</p>
              <p style={{ fontSize:'0.85rem', color:'var(--gray-400)' }}>
                Add courses from <strong>My Courses</strong> or the <strong>catalog</strong> with semester {semester} {year}
              </p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {schedule.courses.map(course => (
                <ScheduleCourseCard key={course.id} course={course}
                  onEnroll={(sectionId) => handleEnroll(course.id, sectionId)}
                  enrolling={enrolling === course.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Eligible courses sidebar */}
        <div>
          <div className="card" style={{ position:'sticky', top:80 }}>
            <div className="card-header">
              <span className="card-section-title">Eligible Next Courses</span>
            </div>
            <p style={{ fontSize:'0.78rem', color:'var(--gray-400)', marginBottom:'1rem' }}>
              Courses you can take based on completed prerequisites
            </p>
            {eligible.length === 0 ? (
              <p style={{ fontSize:'0.8rem', color:'var(--gray-400)', textAlign:'center', padding:'1rem' }}>
                Complete your profile to see recommendations
              </p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', maxHeight:500, overflowY:'auto' }}>
                {eligible.filter(c => c.prereqs_met).slice(0, 15).map(c => (
                  <div key={c.id} style={{ padding:'0.6rem', borderRadius:'var(--radius-md)', background:'var(--gray-50)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <CheckCircle size={13} color="var(--utd-green)" style={{ flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--utd-navy)' }}>{c.full_code}</div>
                      <div style={{ fontSize:'0.72rem', color:'var(--gray-500)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</div>
                    </div>
                    <span style={{ fontSize:'0.7rem', color:'var(--gray-400)', flexShrink:0 }}>{c.credit_hours}h</span>
                  </div>
                ))}
                {eligible.filter(c => !c.prereqs_met).slice(0, 5).map(c => (
                  <div key={c.id} style={{ padding:'0.6rem', borderRadius:'var(--radius-md)', background:'#FEF9E7', display:'flex', alignItems:'center', gap:'0.5rem', opacity:0.7 }}>
                    <AlertTriangle size={13} color="var(--utd-gold)" style={{ flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--gray-700)' }}>{c.full_code}</div>
                      <div style={{ fontSize:'0.72rem', color:'var(--gray-400)' }}>Prereqs needed</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleCourseCard({ course, onEnroll, enrolling }) {
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [showSections, setShowSections] = useState(false);

  async function fetchSections() {
    if (showSections) { setShowSections(false); return; }
    setShowSections(true);
    if (sections.length > 0) return;
    setLoadingSections(true);
    try {
      const r = await scheduleAPI.sections(course.course_id, { semester: course.semester, year: course.year });
      setSections(r.data.sections || []);
    } catch {}
    finally { setLoadingSections(false); }
  }

  const statusColor = {
    planned:'var(--gray-400)', enrolled:'var(--utd-navy)', completed:'var(--utd-green)'
  };

  return (
    <div className="card" style={{ padding:'1rem' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:'1rem' }}>
        <div style={{ width:4, alignSelf:'stretch', borderRadius:2, background: statusColor[course.status] || 'var(--gray-200)', flexShrink:0 }} />
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.35rem' }}>
            <span className="course-tag">{course.full_code}</span>
            <span style={{ fontWeight:600, fontSize:'0.9rem', color:'var(--gray-800)' }}>{course.title}</span>
            <span className={'badge badge-' + (course.status)} style={{ marginLeft:'auto' }}>{course.status}</span>
          </div>

          <div style={{ display:'flex', gap:'1.5rem', fontSize:'0.78rem', color:'var(--gray-500)' }}>
            <span>{course.credit_hours} credit hours</span>
            {course.professor && <span>👤 {course.professor}</span>}
            {course.days && course.start_time && (
              <span style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                <Clock size={11} /> {course.days} {formatTime(course.start_time)}–{formatTime(course.end_time)}
              </span>
            )}
            {course.location && <span>📍 {course.location}</span>}
            {course.modality && course.modality !== 'In-Person' && <span>🌐 {course.modality}</span>}
          </div>
        </div>

        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexShrink:0 }}>
          <button className="btn btn-outline btn-sm" onClick={fetchSections}>
            {showSections ? 'Hide' : 'Sections'}
          </button>
          {course.status === 'planned' && (
            <button className="btn btn-primary btn-sm" disabled={enrolling}
              onClick={() => onEnroll(course.section_id)}>
              {enrolling ? <div className="spinner" style={{width:14,height:14}}/> : <><ExternalLink size={12}/> Enroll</>}
            </button>
          )}
        </div>
      </div>

      {showSections && (
        <div style={{ marginTop:'0.875rem', paddingTop:'0.875rem', borderTop:'1px solid var(--gray-100)' }}>
          {loadingSections ? (
            <div style={{ textAlign:'center', padding:'0.5rem' }}><div className="spinner" style={{margin:'0 auto'}} /></div>
          ) : sections.length === 0 ? (
            <p style={{ fontSize:'0.78rem', color:'var(--gray-400)', textAlign:'center' }}>
              No live section data available. Check <a href="https://coursebook.utdallas.edu" target="_blank" rel="noreferrer" style={{ color:'var(--utd-orange)' }}>UTD Coursebook</a> for sections.
            </p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {sections.map(s => (
                <div key={s.id} style={{ display:'flex', gap:'1rem', padding:'0.5rem 0.75rem', background:'var(--gray-50)', borderRadius:'var(--radius-md)', fontSize:'0.78rem', alignItems:'center' }}>
                  <span style={{ fontWeight:700, color:'var(--utd-navy)', minWidth:60 }}>§{s.section_number}</span>
                  <span>{s.professor || 'TBA'}</span>
                  <span>{s.days} {formatTime(s.start_time)}–{formatTime(s.end_time)}</span>
                  <span style={{ color: s.seats_filled >= s.seats_total ? 'var(--color-error)' : 'var(--utd-green)' }}>
                    {s.seats_total - s.seats_filled}/{s.seats_total} seats
                  </span>
                  <button className="btn btn-sm btn-secondary" style={{ marginLeft:'auto' }}
                    onClick={() => onEnroll(s.nebula_id)}>
                    <ExternalLink size={11}/> Galaxy
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = String(t).slice(0, 5).split(':');
  const hr = parseInt(h);
  return (hr > 12 ? hr-12 : hr) + ':' + (m) + (hr >= 12 ? 'pm' : 'am');
}

function getCurrentSemester() {
  const m = new Date().getMonth() + 1;
  if (m <= 5) return 'Spring';
  if (m <= 7) return 'Summer';
  return 'Fall';
}
