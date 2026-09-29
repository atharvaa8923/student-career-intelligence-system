import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { studentsAPI, programsAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  GraduationCap, BookOpen, CheckCircle, Clock,
  TrendingUp, AlertCircle, ChevronRight, ExternalLink,
  BookMarked, Star, Calendar
} from 'lucide-react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts';

export default function StudentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [programDetail, setProgramDetail] = useState(null);
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    load();
  }, []);

  const [studentCourses, setStudentCourses] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const [res, coursesRes] = await Promise.all([
        studentsAPI.dashboard(),
        studentsAPI.courses()
      ]);
      setData(res.data);
      setStudentCourses(coursesRes.data || []);
      if (res.data.student.programId) {
        const pRes = await programsAPI.get(res.data.student.programId);
        setProgramDetail(pRes.data);
      }
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="loading-overlay">
      <div className="spinner lg" />
      <span style={{ color:'var(--gray-500)' }}>Loading your dashboard...</span>
    </div>
  );

  if (!data) return null;

  const { student, progress, recentActivity, semesterBreakdown } = data;
  const pct = progress.percentComplete;

  // Chart data for semester SCH
  const semData = semesterBreakdown.reduce((acc, s) => {
    const key = (s.semester) + ' ' + (s.year);
    if (!acc[key]) acc[key] = { name: key, completed: 0, enrolled: 0, planned: 0 };
    acc[key][s.status] = parseInt(s.total_sch) || 0;
    return acc;
  }, {});
  const chartData = Object.values(semData).slice(-6);

  const gradeColor = (g) => {
    if (!g) return 'var(--gray-400)';
    if (['A+','A','A-'].includes(g)) return 'var(--utd-green)';
    if (['B+','B','B-'].includes(g)) return 'var(--utd-navy)';
    if (['C+','C','C-'].includes(g)) return 'var(--utd-gold)';
    return 'var(--color-error)';
  };

  return (
    <div>
      {/* Page header */}
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <h1>Good {getGreeting()}, {user?.firstName}!</h1>
          <p>{student.programName || 'No program selected'}{student.concentrationName ? ' · ' + (student.concentrationName) : ''}</p>
        </div>
        <div style={{ display:'flex', gap:'0.75rem' }}>
          {student.catalogUrl && (
            <a href={student.catalogUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
              <ExternalLink size={14} /> View Catalog
            </a>
          )}
          <Link to="/schedule" className="btn btn-primary btn-sm">
            <Calendar size={14} /> Plan Schedule
          </Link>
        </div>
      </div>

      {/* No program warning */}
      {!student.programId && (
        <div className="alert alert-warning" style={{ marginBottom:'1.5rem' }}>
          <AlertCircle size={18} />
          <div>
            <strong>No program selected.</strong> Update your profile to see personalized degree requirements.{' '}
            <Link to="/my-courses" style={{ color:'var(--utd-orange)' }}>Update profile →</Link>
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid-4" style={{ marginBottom:'1.75rem' }}>
        <StatCard icon={<GraduationCap size={20} />} iconClass="orange"
          label="Graduation Progress" value={(pct) + '%'}
          sub={(progress.completedSch) + ' of ' + (progress.totalRequired) + ' SCH'}
          progress={pct} />
        <StatCard icon={<CheckCircle size={20} />} iconClass="green"
          label="Core Courses" value={(progress.coreCompleted) + '/' + (progress.totalCoreRequired)}
          sub={(progress.coreRemaining) + ' remaining'} />
        <StatCard icon={<BookOpen size={20} />} iconClass="blue"
          label="Credits Remaining" value={progress.remainingSch}
          sub={(progress.enrolledSch) + ' currently enrolled'} />
        <StatCard icon={<Star size={20} />} iconClass="gold"
          label="Cumulative GPA" value={progress.gpa || '—'}
          sub={progress.gpa ? 'Based on completed courses' : 'No completed courses yet'} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', marginBottom:'1.5rem' }}>
        {/* SCH Breakdown Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-section-title">Credits by Semester</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={2}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="completed" stackId="a" fill="var(--utd-green)" name="Completed" radius={[0,0,0,0]} />
                <Bar dataKey="enrolled" stackId="a" fill="var(--utd-navy)" name="Enrolled" />
                <Bar dataKey="planned" stackId="a" fill="var(--gray-300)" name="Planned" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gray-400)', fontSize:'0.875rem' }}>
              No courses added yet
            </div>
          )}
        </div>

        {/* Degree progress ring */}
        <div className="card">
          <div className="card-header">
            <span className="card-section-title">Degree Completion</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'1.5rem' }}>
            <div style={{ width:140, height:140, position:'relative', flexShrink:0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="65%" outerRadius="100%" data={[{ value: pct, fill: 'var(--utd-orange)' }]} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" background={{ fill: 'var(--gray-100)' }} cornerRadius={6} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'1.5rem', fontWeight:700, color:'var(--utd-navy)', fontFamily:'var(--font-serif)' }}>{pct}%</span>
                <span style={{ fontSize:'0.65rem', color:'var(--gray-400)' }}>complete</span>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem', flex:1 }}>
              {[
                { label:'Completed', sch: progress.completedSch, color:'var(--utd-green)' },
                { label:'In Progress', sch: progress.enrolledSch, color:'var(--utd-navy)' },
                { label:'Planned', sch: progress.plannedSch, color:'var(--gray-400)' },
                { label:'Remaining', sch: progress.remainingSch, color:'var(--gray-200)' },
              ].map(item => (
                <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.8rem', color:'var(--gray-600)' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:item.color }} />
                    {item.label}
                  </div>
                  <span style={{ fontSize:'0.85rem', fontWeight:600, color:'var(--gray-800)' }}>{item.sch} SCH</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <span className="card-section-title">Recent Activity</span>
            <Link to="/my-courses" className="btn btn-ghost btn-sm">View All <ChevronRight size={14} /></Link>
          </div>
          {recentActivity.length === 0 ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'var(--gray-400)', fontSize:'0.875rem' }}>
              No courses added yet.<br />
              <Link to="/catalog" style={{ color:'var(--utd-orange)' }}>Browse catalog →</Link>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {recentActivity.map((a, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.6rem', borderRadius:8, background:'var(--gray-50)' }}>
                  <span className="course-tag" style={{ minWidth:90 }}>{a.full_code}</span>
                  <span style={{ fontSize:'0.8rem', color:'var(--gray-600)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.title}</span>
                  <span className={'badge badge-' + (a.status)}>{a.status}</span>
                  {a.grade && <span style={{ fontSize:'0.8rem', fontWeight:700, color:gradeColor(a.grade) }}>{a.grade}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Core courses checklist */}
        <div className="card">
          <div className="card-header">
            <span className="card-section-title">Core Requirements</span>
            <span style={{ fontSize:'0.75rem', color:'var(--gray-500)' }}>{progress.coreCompleted}/{progress.totalCoreRequired} complete</span>
          </div>
          {programDetail?.core_slots?.length > 0 ? (
            <CoreCourseChecklist slots={programDetail.core_slots} studentCourses={studentCourses} />
          ) : (
            <div style={{ color:'var(--gray-400)', fontSize:'0.875rem', textAlign:'center', padding:'1.5rem' }}>
              {student.programId ? 'Loading core courses...' : 'Select a program to see requirements'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, iconClass, label, value, sub, progress }) {
  return (
    <div className="stat-card">
      <div className={'stat-icon ' + (iconClass)}>{icon}</div>
      <div style={{ flex:1 }}>
        <div className="card-title">{label}</div>
        <div className="card-value" style={{ fontSize:'1.5rem' }}>{value}</div>
        <div className="card-sub">{sub}</div>
        {progress !== undefined && (
          <div className="progress-bar-wrap" style={{ marginTop:'0.5rem' }}>
            <div className="progress-bar-fill" style={{ width:(Math.min(100,progress)) + '%' }} />
          </div>
        )}
      </div>
    </div>
  );
}

function CoreCourseChecklist({ slots, studentCourses }) {
  if (!slots?.length) return null;

  // Build a set of completed/enrolled course IDs for quick lookup
  const takenIds = new Set(
    (studentCourses || [])
      .filter(sc => ['completed','enrolled'].includes(sc.status))
      .map(sc => sc.course_id)
  );
  const completedIds = new Set(
    (studentCourses || [])
      .filter(sc => sc.status === 'completed')
      .map(sc => sc.course_id)
  );

  function getSlotStatus(slot) {
    if (slot.type === 'required') {
      const c = slot.courses[0];
      if (completedIds.has(c.id)) return 'completed';
      if (takenIds.has(c.id)) return 'enrolled';
      return 'pending';
    }
    // OR group — satisfied if ANY course is taken
    const anyCompleted = slot.courses.some(c => completedIds.has(c.id));
    const anyEnrolled  = slot.courses.some(c => takenIds.has(c.id));
    if (anyCompleted) return 'completed';
    if (anyEnrolled)  return 'enrolled';
    return 'pending';
  }

  const statusColor = { completed:'var(--utd-green)', enrolled:'var(--utd-orange)', pending:'var(--gray-300)' };
  const statusIcon  = { completed:'✓', enrolled:'◉', pending:'○' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem', maxHeight:340, overflowY:'auto' }}>
      {slots.map((slot, i) => {
        const status = getSlotStatus(slot);
        const color  = statusColor[status];

        if (slot.type === 'required') {
          const c = slot.courses[0];
          return (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'0.6rem',
              padding:'0.4rem 0.6rem', borderRadius:6, fontSize:'0.8rem',
              background: status==='completed' ? 'rgba(39,174,96,0.05)' : status==='enrolled' ? 'rgba(199,91,18,0.05)' : '' }}>
              <span style={{ color, fontSize:'0.9rem', flexShrink:0 }}>{statusIcon[status]}</span>
              <span className="course-tag" style={{ fontSize:'0.7rem' }}>{c.full_code}</span>
              <span style={{ color:'var(--gray-600)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{c.title}</span>
              <span style={{ color:'var(--gray-400)', flexShrink:0, fontSize:'0.75rem' }}>{c.credit_hours}h</span>
            </div>
          );
        }

        // OR group
        return (
          <div key={`or_${i}`} style={{ border:'1px dashed var(--gray-200)', borderRadius:8, overflow:'hidden' }}>
            <div style={{ padding:'0.25rem 0.6rem', background:'var(--gray-50)',
              fontSize:'0.68rem', fontWeight:700, color:'var(--gray-500)',
              textTransform:'uppercase', letterSpacing:'0.05em',
              display:'flex', alignItems:'center', gap:'0.4rem' }}>
              <span style={{ color, fontSize:'0.85rem' }}>{statusIcon[status]}</span>
              Pick one of:
            </div>
            {slot.courses.map((c, ci) => {
              const cStatus = completedIds.has(c.id) ? 'completed' : takenIds.has(c.id) ? 'enrolled' : 'pending';
              return (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'0.6rem',
                  padding:'0.35rem 0.6rem 0.35rem 1.2rem', fontSize:'0.78rem',
                  borderTop: ci > 0 ? '1px solid var(--gray-100)' : '',
                  background: cStatus==='completed' ? 'rgba(39,174,96,0.06)' : cStatus==='enrolled' ? 'rgba(199,91,18,0.06)' : '' }}>
                  <span style={{ color: statusColor[cStatus], fontSize:'0.8rem', flexShrink:0 }}>{statusIcon[cStatus]}</span>
                  <span className="course-tag" style={{ fontSize:'0.68rem' }}>{c.full_code}</span>
                  <span style={{ color:'var(--gray-600)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{c.title}</span>
                  <span style={{ color:'var(--gray-400)', flexShrink:0, fontSize:'0.73rem' }}>{c.credit_hours}h</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

