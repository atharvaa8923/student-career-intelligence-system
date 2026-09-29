import { useState, useEffect } from 'react';
import { coursesAPI, studentsAPI } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { Search, Plus, ChevronRight, GitBranch, X, CheckCircle, AlertTriangle, BookOpen, Filter } from 'lucide-react';

export default function CourseCatalogPage() {
  const [courses, setCourses]         = useState([]);
  const [subjects, setSubjects]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterSubject, setFilter]    = useState('');
  const [filterType, setFilterType]   = useState('');
  const [showAll, setShowAll]         = useState(false);
  const [selected, setSelected]       = useState(null);
  const [prereqData, setPrereqData]   = useState(null);
  const [addModal, setAddModal]       = useState(null);
  const [programId, setProgramId]     = useState(undefined);
  const [programName, setProgramName] = useState('');
  const [concentrationName, setConcentrationName] = useState('');
  const toast = useToast();

  // On mount: fetch dashboard FIRST, then fetch courses with the program_id
  useEffect(() => {
    async function init() {
      let pid = null;
      try {
        const d = await studentsAPI.dashboard();
        pid = d.data.programId || null;
        setProgramId(pid);
        setProgramName(d.data.programName || '');
        setConcentrationName(d.data.concentrationName || '');
      } catch {
        setProgramId(null);
      }
      // Now fetch courses — pid is guaranteed to be set
      await loadCourses(pid);
    }
    init();
  }, []);

  // Re-fetch when filters change (programId already known at this point)
  useEffect(() => {
    if (programId === undefined) return; // still in init, skip
    loadCourses(showAll ? null : programId);
  }, [search, filterSubject, filterType, showAll]);

  async function loadCourses(pid) {
    setLoading(true);
    try {
      const params = { limit: 120 };
      if (search)        params.search    = search;
      if (filterSubject) params.subject   = filterSubject;
      if (pid)           params.program_id = pid;

      const [coursesRes, subjectsRes] = await Promise.all([
        coursesAPI.list(params),
        coursesAPI.subjects(pid ? { program_id: pid } : undefined)
      ]);

      let filtered = coursesRes.data;
      if (filterType) filtered = filtered.filter(c => c.course_type === filterType);
      setCourses(filtered);
      setSubjects(subjectsRes.data);
    } catch { toast.error('Failed to load courses'); }
    finally { setLoading(false); }
  }

  async function openDetail(course) {
    setSelected(course);
    setPrereqData(null);
    try {
      const [detail, chain] = await Promise.all([
        coursesAPI.get(course.id),
        coursesAPI.prereqChain(course.id)
      ]);
      setSelected(detail.data);
      setPrereqData(chain.data);
    } catch {}
  }

  const subjectColors = {
    ACCT:'#1A5276', BUAN:'#C75B12', FIN:'#1E8449', MIS:'#6C3483',
    MKT:'#C0392B', OB:'#117A65',  OPRE:'#1F618D', BPS:'#7D6608',
    MECO:'#884EA0', IMS:'#2E86C1', HMGT:'#D35400', ENTP:'#1F618D',
    FTEC:'#B7950B', SYSM:'#1A5276', ENGY:'#196F3D'
  };

  const programFiltered = !showAll && !!programId;
  const coreCount     = courses.filter(c => c.course_type === 'core').length;
  const electiveCount = courses.filter(c => c.course_type === 'elective').length;

  return (
    <div style={{ display:'flex', gap:'1.5rem', height:'calc(100vh - 120px)' }}>

      {/* ── Left: course list ─────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>

        {/* Header */}
        <div className="page-header" style={{ marginBottom:'1rem' }}>
          <div>
            <h1>Course Catalog</h1>
            <p style={{ color:'var(--gray-500)', fontSize:'0.85rem', marginTop:'0.15rem' }}>
              {programFiltered
                ? <>Showing <strong>{courses.length}</strong> courses eligible for <strong>{programName}</strong></>
                : <>Showing all <strong>{courses.length}</strong> JSOM courses</>
              }
            </p>
          </div>
          {/* Toggle: My Program / All Courses */}
          {programId && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'var(--gray-50)', borderRadius:8, padding:'0.35rem 0.6rem', border:'1px solid var(--gray-200)' }}>
              <button onClick={() => { setShowAll(false); setFilter(''); }}
                style={{ padding:'0.3rem 0.75rem', borderRadius:6, border:'none', cursor:'pointer', fontSize:'0.78rem', fontWeight:700,
                  background: !showAll ? 'var(--utd-navy)' : 'transparent',
                  color: !showAll ? '#fff' : 'var(--gray-500)' }}>
                My Program
              </button>
              <button onClick={() => { setShowAll(true); setFilter(''); setFilterType(''); }}
                style={{ padding:'0.3rem 0.75rem', borderRadius:6, border:'none', cursor:'pointer', fontSize:'0.78rem', fontWeight:700,
                  background: showAll ? 'var(--utd-navy)' : 'transparent',
                  color: showAll ? '#fff' : 'var(--gray-500)' }}>
                All Courses
              </button>
            </div>
          )}
        </div>

        {/* Program badge */}
        {programFiltered && (
          <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.75rem', flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:'0.75rem', color:'var(--gray-500)', fontWeight:600 }}>Enrolled in:</span>
            <span style={{ background:'var(--utd-navy)', color:'#fff', borderRadius:100, padding:'0.2rem 0.75rem', fontSize:'0.75rem', fontWeight:700 }}>
              {programName}
            </span>
            {concentrationName && (
              <span style={{ background:'var(--utd-orange)', color:'#fff', borderRadius:100, padding:'0.2rem 0.75rem', fontSize:'0.75rem', fontWeight:700 }}>
                {concentrationName}
              </span>
            )}
          </div>
        )}

        {/* Core / Elective filter tabs */}
        {programFiltered && (
          <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.75rem' }}>
            {[
              { label: 'All', value: '' },
              { label: `Core (${coreCount})`, value: 'core' },
              { label: `Electives (${electiveCount})`, value: 'elective' },
            ].map(tab => (
              <button key={tab.value} onClick={() => setFilterType(tab.value)}
                style={{ padding:'0.3rem 0.9rem', borderRadius:100, border:'1.5px solid',
                  borderColor: filterType===tab.value ? 'var(--utd-orange)' : 'var(--gray-200)',
                  background: filterType===tab.value ? 'var(--utd-orange-pale)' : 'transparent',
                  color: filterType===tab.value ? 'var(--utd-orange)' : 'var(--gray-500)',
                  fontSize:'0.75rem', fontWeight:700, cursor:'pointer' }}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Search + subject filter */}
        <div style={{ display:'flex', gap:'0.75rem', marginBottom:'0.75rem' }}>
          <div className="search-box" style={{ flex:1 }}>
            <Search size={15} className="search-icon" />
            <input className="form-input" placeholder="Search by code or title..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width:130 }} value={filterSubject} onChange={e => setFilter(e.target.value)}>
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s.subject} value={s.subject}>{s.subject} ({s.count})</option>)}
          </select>
        </div>

        {/* Subject chips */}
        <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginBottom:'1rem' }}>
          {subjects.map(s => (
            <button key={s.subject} onClick={() => setFilter(filterSubject === s.subject ? '' : s.subject)}
              style={{ padding:'0.2rem 0.65rem', borderRadius:100, border:'1.5px solid',
                borderColor: filterSubject===s.subject ? (subjectColors[s.subject]||'var(--utd-navy)') : 'var(--gray-200)',
                background: filterSubject===s.subject ? (subjectColors[s.subject]||'var(--utd-navy)') : 'transparent',
                color: filterSubject===s.subject ? '#fff' : 'var(--gray-600)',
                fontSize:'0.72rem', fontWeight:700, cursor:'pointer', transition:'all 0.15s' }}>
              {s.subject}
            </button>
          ))}
        </div>

        {/* Course grid */}
        {loading ? (
          <div className="loading-overlay"><div className="spinner lg" /></div>
        ) : (
          <div style={{ overflowY:'auto', flex:1, paddingRight:'0.25rem' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(270px, 1fr))', gap:'0.75rem' }}>
              {courses.map(c => (
                <div key={c.id} onClick={() => openDetail(c)}
                  className="card" style={{ cursor:'pointer', padding:'1rem', position:'relative',
                    border: selected?.id===c.id ? '2px solid var(--utd-orange)' : '1px solid var(--gray-200)',
                    transition:'all 0.15s' }}>

                  {/* Core badge */}
                  {c.course_type === 'core' && (
                    <span style={{ position:'absolute', top:8, right:8, background:'var(--utd-navy)', color:'#fff',
                      fontSize:'0.62rem', fontWeight:800, padding:'0.15rem 0.45rem', borderRadius:100, letterSpacing:'0.05em' }}>
                      CORE
                    </span>
                  )}

                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.4rem', paddingRight: c.course_type==='core'?40:0 }}>
                    <span className="course-tag"
                      style={{ background:(subjectColors[c.subject]||'var(--utd-navy)')+'18',
                        color: subjectColors[c.subject]||'var(--utd-navy)',
                        borderColor:(subjectColors[c.subject]||'var(--utd-navy)')+'30' }}>
                      {c.full_code}
                    </span>
                    <span style={{ fontSize:'0.75rem', color:'var(--gray-400)', fontWeight:600 }}>{c.credit_hours}h</span>
                  </div>

                  <div style={{ fontSize:'0.825rem', fontWeight:600, color:'var(--gray-800)', lineHeight:1.35, marginBottom:'0.3rem' }}>
                    {c.title}
                  </div>

                  {/* Concentration label */}
                  {c.course_type === 'elective' && c.concentration_name && (
                    <div style={{ fontSize:'0.68rem', color:'var(--utd-orange)', fontWeight:600, marginBottom:'0.15rem' }}>
                      {c.concentration_name}
                    </div>
                  )}

                  {c.prereq_text && (
                    <div style={{ fontSize:'0.72rem', color:'var(--gray-400)', display:'flex', alignItems:'center', gap:'0.3rem', marginTop:'0.25rem' }}>
                      <GitBranch size={10} /> Has prerequisites
                    </div>
                  )}
                </div>
              ))}
            </div>
            {courses.length === 0 && (
              <div style={{ textAlign:'center', padding:'3rem', color:'var(--gray-400)' }}>
                <BookOpen size={32} style={{ margin:'0 auto 1rem', opacity:0.3 }}/>
                <div>No courses match your search</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right: course detail panel ────────────────────── */}
      {selected && (
        <div style={{ width:380, flexShrink:0, display:'flex', flexDirection:'column', gap:'1rem', overflowY:'auto' }}>
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
              <div>
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.4rem' }}>
                  <span className="course-tag">{selected.full_code}</span>
                  {selected.course_type === 'core' && (
                    <span style={{ background:'var(--utd-navy)', color:'#fff', fontSize:'0.65rem', fontWeight:800,
                      padding:'0.15rem 0.5rem', borderRadius:100 }}>CORE</span>
                  )}
                </div>
                <h3 style={{ fontSize:'1rem', marginTop:'0.1rem' }}>{selected.title}</h3>
                {selected.concentration_name && selected.course_type === 'elective' && (
                  <div style={{ fontSize:'0.75rem', color:'var(--utd-orange)', fontWeight:600, marginTop:'0.2rem' }}>
                    {selected.concentration_name} Elective
                  </div>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><X size={14} /></button>
            </div>

            <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem', flexWrap:'wrap' }}>
              <span className="badge badge-enrolled">{selected.credit_hours} Credits</span>
              {selected.prereq_text && <span className="badge badge-planned">Has Prereqs</span>}
            </div>

            {selected.description && (
              <p style={{ fontSize:'0.825rem', color:'var(--gray-600)', lineHeight:1.6, marginBottom:'1rem' }}>
                {selected.description}
              </p>
            )}

            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}
              onClick={() => setAddModal(selected)}>
              <Plus size={15} /> Add to My Plan
            </button>
          </div>

          {/* Prerequisites */}
          {selected.prerequisites?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-section-title">Prerequisites</span>
                <GitBranch size={14} color="var(--gray-400)" />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                {selected.prerequisites.map(p => (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.4rem 0.6rem',
                    background:'var(--gray-50)', borderRadius:6 }}>
                    <span className="course-tag" style={{ fontSize:'0.72rem' }}>{p.full_code}</span>
                    <span style={{ fontSize:'0.8rem', flex:1, color:'var(--gray-600)' }}>{p.title}</span>
                    {p.group_id > 0 && (
                      <span style={{ fontSize:'0.65rem', color:'var(--utd-orange)', fontWeight:700 }}>OR</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full prereq chain */}
          {prereqData?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-section-title">Full Prereq Chain</span>
                <span style={{ fontSize:'0.72rem', color:'var(--gray-400)' }}>
                  depth {Math.max(...prereqData.map(p=>p.depth))}
                </span>
              </div>
              {prereqData.map(p => (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.3rem 0',
                  paddingLeft:((p.depth-1)*16)+'px', fontSize:'0.8rem', color:'var(--gray-600)' }}>
                  <ChevronRight size={10} color="var(--gray-300)" />
                  <span className="course-tag" style={{ fontSize:'0.7rem' }}>{p.full_code}</span>
                  <span style={{ flex:1 }}>{p.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Core in programs */}
          {selected.core_in_programs?.length > 0 && (
            <div className="card">
              <div className="card-section-title" style={{ marginBottom:'0.75rem' }}>Core Requirement In</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
                {selected.core_in_programs.map(p => (
                  <div key={p.id} style={{ fontSize:'0.8rem', color:'var(--gray-600)',
                    display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--utd-orange)', flexShrink:0 }} />
                    {p.program_name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {addModal && (
        <QuickAddModal course={addModal} onClose={() => setAddModal(null)} onAdded={loadCourses} />
      )}
    </div>
  );
}

function QuickAddModal({ course, onClose, onAdded }) {
  const [form, setForm] = useState({ semester:'Fall', year: new Date().getFullYear(), status:'planned' });
  const [prereqCheck, setPrereqCheck] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    studentsAPI.checkPrereqs(course.id).then(r => setPrereqCheck(r.data)).catch(()=>{});
  }, [course.id]);

  async function handleAdd() {
    setLoading(true);
    try {
      await studentsAPI.addCourse({ course_id: course.id, ...form, year: parseInt(form.year) });
      toast.success(course.full_code + ' added to your plan');
      onAdded?.();
      onClose();
    } catch (err) {
      if (err.response?.data?.or_group_conflict) {
        toast.error(
          `Already enrolled in ${err.response.data.already_taken} which satisfies this OR requirement. ` +
          `You cannot take multiple courses from the same OR group.`
        );
      } else if (err.response?.data?.missing_prerequisites) {
        toast.error('Missing prerequisites: ' + err.response.data.missing_prerequisites.join(', '));
      } else {
        toast.error(err.response?.data?.error || 'Failed to add course');
      }
    } finally { setLoading(false); }
  }

  const groupedPrereqs = {};
  if (prereqCheck?.prerequisites) {
    for (const p of prereqCheck.prerequisites) {
      const g = p.group_id ?? 0;
      if (!groupedPrereqs[g]) groupedPrereqs[g] = [];
      groupedPrereqs[g].push(p);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3>Add to Plan</h3>
            <p style={{ fontSize:'0.8rem', color:'var(--gray-500)', marginTop:'0.1rem' }}>
              {course.full_code} · {course.title}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          {/* OR group conflict warning — shown above everything else */}
          {prereqCheck?.or_group_conflict?.blocked && (
            <div className="alert alert-warning" style={{ marginBottom:'0.75rem' }}>
              <AlertTriangle size={16}/>
              <div>
                <strong>OR Group Restriction</strong>
                <p style={{ fontSize:'0.8rem', marginTop:'0.25rem' }}>
                  {prereqCheck.or_group_conflict.reason}
                </p>
                <div style={{ fontSize:'0.75rem', color:'var(--gray-500)', marginTop:'0.3rem' }}>
                  Courses in this group:{' '}
                  {prereqCheck.or_group_conflict.all_group_courses?.map((code, i) => (
                    <span key={code}>
                      {i > 0 && <span style={{ color:'var(--utd-orange)', margin:'0 0.3rem' }}>or</span>}
                      <span className="course-tag" style={{ fontSize:'0.68rem' }}>{code}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Prerequisite check */}
          {prereqCheck && prereqCheck.prerequisites?.length > 0 && (
            <div className={'alert ' + (prereqCheck.can_enroll ? 'alert-success' : 'alert-warning')}>
              {prereqCheck.can_enroll ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
              <div>
                <strong>{prereqCheck.can_enroll ? 'Prerequisites met' : 'Prerequisites not met'}</strong>
                <div style={{ fontSize:'0.78rem', marginTop:'0.35rem', display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                  {Object.entries(groupedPrereqs).map(([gid, prereqs]) => (
                    <div key={gid} style={{ display:'flex', alignItems:'center', gap:'0.35rem', flexWrap:'wrap' }}>
                      {prereqs.length > 1 && <span style={{ fontSize:'0.68rem', color:'var(--gray-400)', fontStyle:'italic' }}>one of:</span>}
                      {prereqs.map((p, i) => (
                        <span key={p.id || i} style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem' }}>
                          {p.is_met
                            ? <CheckCircle size={11} color="var(--utd-green)"/>
                            : <X size={11} color="var(--color-error)"/>}
                          <span style={{ color: p.is_met ? 'var(--utd-green)' : 'var(--color-error)', fontWeight:600 }}>
                            {p.full_code}
                          </span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem', marginTop:'0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Semester</label>
              <select className="form-select" value={form.semester} onChange={e=>setForm(p=>({...p,semester:e.target.value}))}>
                {['Spring','Summer','Fall'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Year</label>
              <input className="form-input" type="number" value={form.year}
                onChange={e=>setForm(p=>({...p,year:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                {['planned','enrolled','completed'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd}
            disabled={loading || !!prereqCheck?.or_group_conflict?.blocked}
            title={prereqCheck?.or_group_conflict?.blocked ? 'Cannot enroll: OR group restriction' : ''}>
            {loading ? <div className="spinner" style={{width:16,height:16}}/> : 'Add to Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

