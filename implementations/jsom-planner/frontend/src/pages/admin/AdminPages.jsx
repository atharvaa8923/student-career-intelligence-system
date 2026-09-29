// ── All imports at top (required for ES modules) ─────────────
import { useState, useEffect } from 'react';
import { adminAPI, programsAPI, coursesAPI } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { Search, Plus, GitBranch, X, Shield, GraduationCap } from 'lucide-react';


// ── Admin Students Page (Users Management) ────────────────────
export function AdminStudentsPage() {
  const [users, setUsers]       = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterProg, setFilter] = useState('');
  const [roleTab, setRoleTab]   = useState('all');
  const [expanded, setExpanded] = useState(null);
  const toast = useToast();

  useEffect(() => {
    Promise.all([load(), programsAPI.list().then(r => setPrograms(r.data))]);
  }, []);

  async function load() {
    setLoading(true);
    try { const r = await adminAPI.students(); setUsers(r.data); }
    catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }

  async function toggleActive(userId, current) {
    try {
      await adminAPI.toggleActive(userId);
      setUsers(p => p.map(u => u.user_id === userId ? { ...u, is_active: !current } : u));
      toast.success('Account ' + (current ? 'deactivated' : 'activated'));
    } catch { toast.error('Failed to update'); }
  }

  const filtered = users.filter(u => {
    if (roleTab === 'student' && u.role !== 'student') return false;
    if (roleTab === 'admin'   && u.role !== 'admin')   return false;
    if (filterProg && u.program_id !== filterProg)     return false;
    if (search) {
      const q = search.toLowerCase();
      return ((u.first_name||'')+(u.last_name||'')+(u.email||'')+(u.utd_id||'')).toLowerCase().includes(q);
    }
    return true;
  });

  const studentCount = users.filter(u => u.role==='student').length;
  const adminCount   = users.filter(u => u.role==='admin').length;

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <p>{studentCount} students · {adminCount} admins registered</p>
      </div>

      <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1rem' }}>
        {[{v:'all',l:`All (${users.length})`},{v:'student',l:`Students (${studentCount})`},{v:'admin',l:`Admins (${adminCount})`}].map(t=>(
          <button key={t.v} onClick={()=>setRoleTab(t.v)}
            style={{ padding:'0.35rem 1rem', borderRadius:100, border:'1.5px solid', cursor:'pointer', fontSize:'0.78rem', fontWeight:700,
              borderColor:roleTab===t.v?'var(--utd-navy)':'var(--gray-200)',
              background:roleTab===t.v?'var(--utd-navy)':'transparent',
              color:roleTab===t.v?'#fff':'var(--gray-500)' }}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.5rem' }}>
        <div className="search-box" style={{ flex:1 }}>
          <Search size={15} className="search-icon"/>
          <input className="form-input" placeholder="Search by name, email, or UTD ID..."
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {roleTab !== 'admin' && (
          <select className="form-select" style={{ width:220 }} value={filterProg} onChange={e=>setFilter(e.target.value)}>
            <option value="">All Programs</option>
            {programs.map(p=><option key={p.id} value={p.id}>{p.program_name}</option>)}
          </select>
        )}
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner lg"/></div> : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table className="data-table">
            <thead><tr><th>User</th><th>Role</th><th>Program</th><th>Progress</th><th>GPA</th><th>Registered</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(u => (
                <>
                  <tr key={u.user_id} style={{ cursor:u.role==='student'?'pointer':'' }}
                    onClick={()=>u.role==='student'&&setExpanded(expanded===u.user_id?null:u.user_id)}>
                    <td>
                      <div style={{ fontWeight:600, fontSize:'0.875rem' }}>{u.first_name} {u.last_name}</div>
                      <div style={{ fontSize:'0.75rem', color:'var(--gray-400)' }}>{u.email}</div>
                      {u.utd_id&&<div style={{ fontSize:'0.7rem', color:'var(--gray-300)' }}>{u.utd_id}</div>}
                    </td>
                    <td>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', padding:'0.2rem 0.6rem', borderRadius:100, fontSize:'0.72rem', fontWeight:700,
                        background:u.role==='admin'?'var(--utd-navy)':'var(--utd-orange-pale)',
                        color:u.role==='admin'?'#fff':'var(--utd-orange)' }}>
                        {u.role==='admin'?<Shield size={10}/>:<GraduationCap size={10}/>}
                        {u.role==='admin'?'Admin':'Student'}
                      </span>
                    </td>
                    <td style={{ fontSize:'0.8rem', color:'var(--gray-600)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {u.program_name||<span style={{color:'var(--gray-300)'}}>—</span>}
                      {u.concentration_name&&<div style={{fontSize:'0.7rem',color:'var(--utd-orange)'}}>{u.concentration_name}</div>}
                    </td>
                    <td>
                      {u.role==='student'&&u.total_sch?(
                        <div style={{ minWidth:100 }}>
                          <div style={{ fontSize:'0.75rem', color:'var(--gray-500)', marginBottom:'0.2rem' }}>{u.completed_sch}/{u.total_sch} SCH</div>
                          <div style={{ height:5, background:'var(--gray-100)', borderRadius:3, overflow:'hidden' }}>
                            <div style={{ height:'100%', borderRadius:3, background:'var(--utd-green)',
                              width:Math.min(100,Math.round((u.completed_sch/u.total_sch)*100))+'%' }}/>
                          </div>
                        </div>
                      ):<span style={{color:'var(--gray-300)',fontSize:'0.8rem'}}>—</span>}
                    </td>
                    <td>{u.gpa?<span style={{ fontWeight:700, color:parseFloat(u.gpa)>=3.5?'var(--utd-green)':parseFloat(u.gpa)>=3.0?'var(--utd-navy)':'var(--color-error)' }}>{parseFloat(u.gpa).toFixed(2)}</span>:<span style={{color:'var(--gray-300)'}}>—</span>}</td>
                    <td style={{ fontSize:'0.78rem', color:'var(--gray-400)' }}>{u.registered_at?new Date(u.registered_at).toLocaleDateString():'—'}</td>
                    <td>
                      <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:u.is_active?'var(--utd-green)':'var(--gray-300)', marginRight:6 }}/>
                      {u.is_active?'Active':'Inactive'}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();toggleActive(u.user_id,u.is_active);}}
                        style={{ fontSize:'0.75rem', color:u.is_active?'var(--color-error)':'var(--utd-green)' }}>
                        {u.is_active?'Deactivate':'Activate'}
                      </button>
                    </td>
                  </tr>
                  {expanded===u.user_id&&u.role==='student'&&(
                    <tr key={u.user_id+'_exp'}>
                      <td colSpan={8} style={{ background:'var(--gray-50)', padding:'1rem 1.5rem' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.75rem' }}>
                          {[
                            {l:'Program',v:u.program_name||'Not assigned',s:true},
                            {l:'Concentration',v:u.concentration_name||'Not selected',s:true},
                            {l:'Enrolled',v:u.enrollment_year?`${u.enrollment_semester} ${u.enrollment_year}`:'—'},
                            {l:'Expected Grad',v:u.expected_graduation||'—'},
                            {l:'Credits Done',v:`${u.completed_sch} / ${u.total_sch||'?'} SCH`},
                            {l:'Currently Enrolled',v:`${u.enrolled_count} course(s)`},
                            {l:'GPA',v:u.gpa?parseFloat(u.gpa).toFixed(2):'—'},
                            {l:'Progress',v:u.total_sch?Math.round((u.completed_sch/u.total_sch)*100)+'%':'—'},
                          ].map(stat=>(
                            <div key={stat.l} style={{ background:'#fff', borderRadius:8, padding:'0.6rem 0.85rem', border:'1px solid var(--gray-100)' }}>
                              <div style={{ fontSize:'0.68rem', color:'var(--gray-400)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.2rem' }}>{stat.l}</div>
                              <div style={{ fontSize:stat.s?'0.78rem':'0.9rem', fontWeight:600, color:'var(--utd-navy)' }}>{stat.v}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {filtered.length===0&&<div style={{ textAlign:'center', padding:'2rem', color:'var(--gray-400)' }}>No users found</div>}
        </div>
      )}
    </div>
  );
}

// ── Admin Courses Page ────────────────────────────────────────
export function AdminCoursesPage() {
  const [courses, setCourses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [subject, setSubject]   = useState('');
  const [subjects, setSubjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail]     = useState(null);
  const toast = useToast();

  useEffect(() => {
    coursesAPI.subjects().then(r=>setSubjects(r.data));
    load();
  }, []);

  useEffect(() => { const t=setTimeout(load,300); return()=>clearTimeout(t); }, [search, subject]);

  async function load() {
    setLoading(true);
    try {
      const params = { limit:80 };
      if (search) params.search = search;
      if (subject) params.subject = subject;
      const r = await coursesAPI.list(params);
      setCourses(r.data);
    } catch {} finally { setLoading(false); }
  }

  async function openDetail(course) {
    setSelected(course);
    try { const r = await coursesAPI.get(course.id); setDetail(r.data); } catch {}
  }

  return (
    <div style={{ display:'flex', gap:'1.5rem', height:'calc(100vh - 120px)' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <div className="page-header">
          <h1>Course Catalog Admin</h1>
          <p>Manage courses, prerequisites, and knowledge graph edges</p>
        </div>
        <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem' }}>
          <div className="search-box" style={{ flex:1 }}>
            <Search size={15} className="search-icon"/>
            <input className="form-input" placeholder="Search courses..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select className="form-select" style={{ width:120 }} value={subject} onChange={e=>setSubject(e.target.value)}>
            <option value="">All</option>
            {subjects.map(s=><option key={s.subject} value={s.subject}>{s.subject}</option>)}
          </select>
        </div>
        {loading ? <div className="loading-overlay"><div className="spinner lg"/></div> : (
          <div style={{ overflowY:'auto', flex:1 }}>
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Code</th><th>Title</th><th>SCH</th><th>Prereqs</th><th></th></tr></thead>
                <tbody>
                  {courses.map(c => (
                    <tr key={c.id} style={{ cursor:'pointer', background: selected?.id===c.id?'var(--utd-orange-pale)':'' }} onClick={()=>openDetail(c)}>
                      <td><span className="course-tag">{c.full_code}</span></td>
                      <td style={{ fontSize:'0.85rem', maxWidth:250, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</td>
                      <td>{c.credit_hours}</td>
                      <td>{c.prereq_text ? <span style={{ display:'flex', alignItems:'center', gap:'0.3rem', color:'var(--utd-orange)', fontSize:'0.75rem' }}><GitBranch size={11}/>Yes</span> : '—'}</td>
                      <td><button className="btn btn-ghost btn-sm">Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {courses.length === 0 && <div style={{textAlign:'center',padding:'2rem',color:'var(--gray-400)'}}>No courses found</div>}
            </div>
          </div>
        )}
      </div>
      {detail && (
        <div style={{ width:360, flexShrink:0, overflowY:'auto' }}>
          <CourseDetailPanel detail={detail} onClose={()=>{setSelected(null);setDetail(null);}} onUpdated={load}/>
        </div>
      )}
    </div>
  );
}

function CourseDetailPanel({ detail, onClose, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title:detail.title, credit_hours:detail.credit_hours, prereq_text:detail.prereq_text||'', description:detail.description||'' });
  const [addPrereq, setAddPrereq] = useState(false);
  const [prereqSearch, setPrereqSearch] = useState('');
  const [prereqResults, setPrereqResults] = useState([]);
  const [localPrereqs, setLocalPrereqs] = useState(detail.prerequisites || []);
  const toast = useToast();

  useEffect(() => {
    if (!prereqSearch || prereqSearch.length < 2) { setPrereqResults([]); return; }
    const t = setTimeout(async () => {
      try { const r = await coursesAPI.list({ search: prereqSearch, limit:8 }); setPrereqResults(r.data); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [prereqSearch]);

  async function save() {
    try { await coursesAPI.update(detail.id, form); toast.success('Course updated'); setEditing(false); onUpdated(); }
    catch { toast.error('Update failed'); }
  }

  async function handleAddPrereq(reqCourseId) {
    try {
      await coursesAPI.addPrereq(detail.id, { requires_course_id: reqCourseId, prereq_type:'required' });
      const r = await coursesAPI.get(detail.id);
      setLocalPrereqs(r.data.prerequisites || []);
      toast.success('Prerequisite added'); setAddPrereq(false); setPrereqSearch('');
    } catch(e) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function removePrereq(reqId, code) {
    if (!confirm(`Remove ${code} as prerequisite?`)) return;
    try { await coursesAPI.removePrereq(detail.id, reqId); setLocalPrereqs(p => p.filter(x => x.id !== reqId)); toast.success('Removed'); }
    catch { toast.error('Failed'); }
  }

  return (
    <div className="card">
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1rem' }}>
        <div>
          <span className="course-tag">{detail.full_code}</span>
          {!editing && <h3 style={{ fontSize:'0.95rem', marginTop:'0.35rem' }}>{detail.title}</h3>}
        </div>
        <div style={{ display:'flex', gap:'0.4rem' }}>
          {editing
            ? <><button className="btn btn-primary btn-sm" onClick={save}>Save</button><button className="btn btn-ghost btn-sm" onClick={()=>setEditing(false)}>Cancel</button></>
            : <><button className="btn btn-outline btn-sm" onClick={()=>setEditing(true)}>Edit</button><button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14}/></button></>
          }
        </div>
      </div>

      {editing ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Credit Hours</label><input className="form-input" type="number" value={form.credit_hours} onChange={e=>setForm(p=>({...p,credit_hours:parseInt(e.target.value)}))}/></div>
          <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" rows={3} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Prereq Text</label><textarea className="form-textarea" rows={2} value={form.prereq_text} onChange={e=>setForm(p=>({...p,prereq_text:e.target.value}))}/></div>
        </div>
      ) : (
        <>
          {detail.description && <p style={{ fontSize:'0.82rem', color:'var(--gray-600)', lineHeight:1.6, marginBottom:'1rem' }}>{detail.description}</p>}
          <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem', flexWrap:'wrap' }}>
            <span className="badge badge-enrolled">{detail.credit_hours} Credits</span>
            <span className="badge badge-planned">{detail.subject}</span>
          </div>
          <div style={{ marginBottom:'1rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
              <span style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--gray-600)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Prerequisites</span>
              <button className="btn btn-ghost btn-sm" onClick={()=>setAddPrereq(!addPrereq)}><Plus size={12}/> Add</button>
            </div>
            {addPrereq && (
              <div style={{ position:'relative', marginBottom:'0.5rem' }}>
                <input className="form-input" placeholder="Search course..." value={prereqSearch} onChange={e=>setPrereqSearch(e.target.value)} autoFocus/>
                {prereqResults.length > 0 && (
                  <div style={{ position:'absolute', zIndex:10, background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-md)', top:'100%', left:0, right:0, maxHeight:160, overflowY:'auto' }}>
                    {prereqResults.map(c=>(
                      <div key={c.id} onClick={()=>handleAddPrereq(c.id)} style={{ padding:'0.5rem 0.75rem', cursor:'pointer', fontSize:'0.82rem', display:'flex', gap:'0.5rem' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--gray-50)'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                        <span className="course-tag" style={{fontSize:'0.7rem'}}>{c.full_code}</span>{c.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {localPrereqs.length > 0 ? localPrereqs.map(p=>(
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.3rem 0.5rem', borderRadius:6, background:'var(--gray-50)', marginBottom:'0.3rem' }}>
                <span className="course-tag" style={{fontSize:'0.7rem'}}>{p.full_code}</span>
                <span style={{flex:1,fontSize:'0.78rem',color:'var(--gray-600)'}}>{p.title}</span>
                <button onClick={()=>removePrereq(p.id,p.full_code)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--gray-300)'}}><X size={11}/></button>
              </div>
            )) : <span style={{fontSize:'0.78rem',color:'var(--gray-300)'}}>No prerequisites</span>}
          </div>
          {detail.core_in_programs?.length > 0 && (
            <div>
              <span style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--gray-600)', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'0.5rem' }}>Core In</span>
              {detail.core_in_programs.map(p=>(
                <div key={p.id} style={{fontSize:'0.78rem',color:'var(--gray-600)',padding:'0.2rem 0',display:'flex',alignItems:'center',gap:'0.5rem'}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:'var(--utd-orange)',flexShrink:0}}/>{p.program_name}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Admin Graph Page ──────────────────────────────────────────
export function AdminGraphPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  useEffect(() => { adminAPI.graphStats().then(r=>setStats(r.data)).finally(()=>setLoading(false)); }, []);

  async function refresh() {
    setRefreshing(true);
    try { await adminAPI.refreshGraph(); toast.success('Graph refreshed'); adminAPI.graphStats().then(r=>setStats(r.data)); }
    catch { toast.error('Refresh failed'); } finally { setRefreshing(false); }
  }

  if (loading) return <div className="loading-overlay"><div className="spinner lg"/></div>;

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div><h1>Knowledge Graph</h1><p>Course dependency graph and program relationship analysis</p></div>
        <button className="btn btn-primary" onClick={refresh} disabled={refreshing}>
          {refreshing ? <div className="spinner" style={{width:14,height:14}}/> : '↻'} Refresh Graph
        </button>
      </div>
      <div className="grid-4" style={{ marginBottom:'1.75rem' }}>
        {[
          { label:'Course Nodes', value: stats?.graph_nodes, desc:'Active courses in graph' },
          { label:'Prereq Edges', value: stats?.graph_edges, desc:'Dependency relationships' },
          { label:'Graph Density', value: stats?.graph_density ? `${stats.graph_density}%` : '—', desc:'Edge/node ratio' },
          { label:'Isolated Courses', value: stats?.isolated_courses?.length ?? 0, desc:'No program assignment', warn:true },
        ].map(s=>(
          <div key={s.label} className="card">
            <div className="card-title">{s.label}</div>
            <div className="card-value" style={{fontSize:'1.75rem', color: s.warn&&parseInt(s.value)>20?'var(--color-error)':'var(--utd-navy)'}}>{s.value ?? '—'}</div>
            <div className="card-sub">{s.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
        <div className="card">
          <div className="card-header"><span className="card-section-title">Top Cross-Listed Courses</span></div>
          <p style={{ fontSize:'0.78rem', color:'var(--gray-400)', marginBottom:'1rem' }}>Courses appearing in most programs/concentrations</p>
          {stats?.top_cross_listed?.map((c,i)=>(
            <div key={c.full_code} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.5rem 0', borderBottom:'1px solid var(--gray-100)' }}>
              <span style={{ width:20, height:20, borderRadius:'50%', background:'var(--utd-navy-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:700, color:'var(--utd-navy)', flexShrink:0 }}>{i+1}</span>
              <span className="course-tag" style={{fontSize:'0.72rem'}}>{c.full_code}</span>
              <span style={{ fontSize:'0.8rem', flex:1, color:'var(--gray-600)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</span>
              <span style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--utd-orange)', flexShrink:0 }}>{c.connections} links</span>
            </div>
          ))}
          {!stats?.top_cross_listed?.length && <p style={{fontSize:'0.8rem',color:'var(--gray-400)'}}>No data yet — add courses to programs</p>}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-section-title">Isolated Courses</span></div>
          <p style={{ fontSize:'0.78rem', color:'var(--gray-400)', marginBottom:'1rem' }}>Courses not assigned to any program or concentration</p>
          {stats?.isolated_courses?.length === 0
            ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--utd-green)', fontSize:'0.875rem' }}>✓ All courses are assigned</div>
            : <div style={{ maxHeight:280, overflowY:'auto' }}>
                {stats?.isolated_courses?.map(c=>(
                  <div key={c.full_code} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0', fontSize:'0.8rem', color:'var(--gray-500)', borderBottom:'1px solid var(--gray-100)' }}>
                    <span className="course-tag" style={{fontSize:'0.7rem'}}>{c.full_code}</span><span>{c.title}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  );
}

// ── Admin Settings Page ───────────────────────────────────────
export function AdminSettingsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { adminAPI.auditLog({ limit:30 }).then(r=>setLogs(r.data)).finally(()=>setLoading(false)); }, []);

  return (
    <div>
      <div className="page-header"><h1>Settings & Audit Log</h1><p>System configuration and activity monitoring</p></div>
      <div className="card">
        <div className="card-header"><span className="card-section-title">Recent Audit Log</span></div>
        {loading ? <div className="loading-overlay"><div className="spinner"/></div> : (
          <table className="data-table">
            <thead><tr><th>Action</th><th>Entity</th><th>User</th><th>Time</th></tr></thead>
            <tbody>
              {logs.map(l=>(
                <tr key={l.id}>
                  <td><span className={'badge ' + (l.action==='LOGIN'?'badge-enrolled':l.action==='DELETE'?'badge-dropped':'badge-planned')}>{l.action}</span></td>
                  <td style={{fontSize:'0.8rem',color:'var(--gray-600)'}}>{l.entity_type}</td>
                  <td style={{fontSize:'0.8rem'}}>{l.user_email || '—'}</td>
                  <td style={{fontSize:'0.78rem',color:'var(--gray-400)'}}>{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={4} style={{textAlign:'center',color:'var(--gray-400)',padding:'2rem'}}>No audit entries yet</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

