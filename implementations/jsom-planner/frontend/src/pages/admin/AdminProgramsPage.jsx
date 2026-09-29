import { useState, useEffect } from 'react';
import { programsAPI, coursesAPI } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { ChevronDown, ChevronRight, Plus, Trash2, Edit3, Save, X, Search } from 'lucide-react';

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterType, setFilter] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [programDetail, setProgramDetail] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm]   = useState({});
  const toast = useToast();

  useEffect(() => { loadPrograms(); }, []);

  async function loadPrograms() {
    setLoading(true);
    try {
      const r = await programsAPI.list();
      setPrograms(r.data);
    } catch { toast.error('Failed to load programs'); }
    finally { setLoading(false); }
  }

  async function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!programDetail[id]) {
      try {
        const r = await programsAPI.get(id);
        setProgramDetail(p => ({ ...p, [id]: r.data }));
      } catch { toast.error('Failed to load program detail'); }
    }
  }

  async function saveEdit(id) {
    try {
      await programsAPI.update(id, editForm);
      setPrograms(p => p.map(prog => prog.id === id ? { ...prog, ...editForm } : prog));
      setProgramDetail(p => ({ ...p, [id]: { ...p[id], ...editForm } }));
      setEditingId(null);
      toast.success('Program updated');
    } catch { toast.error('Update failed'); }
  }

  async function removeCoreCourse(programId, courseId, courseCode) {
    if (!confirm('Remove ' + (courseCode) + ' from core requirements?')) return;
    try {
      await programsAPI.removeCoreCourse(programId, courseId);
      setProgramDetail(p => ({
        ...p,
        [programId]: { ...p[programId], core_courses: p[programId].core_courses.filter(c => c.id !== courseId) }
      }));
      toast.success((courseCode) + ' removed from core');
    } catch { toast.error('Failed to remove'); }
  }

  async function removeConcentration(programId, concId, name) {
    if (!confirm('Delete concentration "' + (name) + '"? This will remove all its elective course assignments.')) return;
    try {
      await programsAPI.deleteConcentration(programId, concId);
      setProgramDetail(p => ({
        ...p,
        [programId]: { ...p[programId], concentrations: p[programId].concentrations.filter(c => c.id !== concId) }
      }));
      toast.success('Concentration removed');
    } catch { toast.error('Failed to remove'); }
  }

  const filtered = programs.filter(p => {
    if (filterType && p.program_type !== filterType) return false;
    if (search && !p.program_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const types = [...new Set(programs.map(p => p.program_type))];

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between' }}>
        <div>
          <h1>Programs & Degree Requirements</h1>
          <p>Manage degree constraints, core courses, and concentrations across {programs.length} programs</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.5rem' }}>
        <div className="search-box" style={{ flex:1 }}>
          <Search size={15} className="search-icon" />
          <input className="form-input" placeholder="Search programs..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <div style={{ display:'flex', borderRadius:'var(--radius-md)', overflow:'hidden', border:'1.5px solid var(--gray-200)' }}>
          <button onClick={()=>setFilter('')} style={{ padding:'0.45rem 0.9rem', background:!filterType?'var(--utd-navy)':'#fff', color:!filterType?'#fff':'var(--gray-600)', border:'none', cursor:'pointer', fontSize:'0.8rem', fontWeight:600 }}>All</button>
          {types.map(t => (
            <button key={t} onClick={()=>setFilter(t)} style={{ padding:'0.45rem 0.9rem', background:filterType===t?'var(--utd-navy)':'#fff', color:filterType===t?'#fff':'var(--gray-600)', border:'none', cursor:'pointer', fontSize:'0.8rem', fontWeight:600 }}>{t}</button>
          ))}
        </div>
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner lg" /></div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {filtered.map(prog => (
            <div key={prog.id} className="card" style={{ padding:0, overflow:'hidden' }}>
              {/* Program header row */}
              <div style={{ padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', cursor:'pointer' }}
                onClick={() => toggleExpand(prog.id)}>
                {expanded === prog.id ? <ChevronDown size={16} color="var(--gray-400)"/> : <ChevronRight size={16} color="var(--gray-400)"/>}
                <div style={{ flex:1 }}>
                  {editingId === prog.id ? (
                    <input className="form-input" style={{ maxWidth:400 }} value={editForm.program_name}
                      onChange={e=>setEditForm(p=>({...p,program_name:e.target.value}))}
                      onClick={e=>e.stopPropagation()} />
                  ) : (
                    <span style={{ fontWeight:600, fontSize:'0.9rem', color:'var(--utd-navy)' }}>{prog.program_name}</span>
                  )}
                </div>
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                  <span className={'badge badge-' + (prog.program_type==='MBA'?'mba':prog.program_type==='MS'?'ms':'cert')}>{prog.program_type}</span>
                  {prog.is_stem && <span className="badge badge-stem">STEM</span>}
                  <span style={{ fontSize:'0.8rem', color:'var(--gray-500)' }}>{prog.total_sch} SCH</span>
                  {editingId === prog.id ? (
                    <div style={{ display:'flex', gap:'0.35rem' }} onClick={e=>e.stopPropagation()}>
                      <button className="btn btn-primary btn-sm" onClick={()=>saveEdit(prog.id)}><Save size={12}/> Save</button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>setEditingId(null)}><X size={12}/></button>
                    </div>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();setEditingId(prog.id);setEditForm({program_name:prog.program_name,total_sch:prog.total_sch,total_core_sch:prog.total_core_sch,total_elective_sch:prog.total_elective_sch,is_stem:prog.is_stem,notes:prog.notes||''});}}>
                      <Edit3 size={13}/>
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === prog.id && programDetail[prog.id] && (
                <div style={{ borderTop:'1px solid var(--gray-100)', padding:'1.25rem' }}>
                  {editingId === prog.id && (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.75rem', marginBottom:'1.25rem', padding:'1rem', background:'var(--gray-50)', borderRadius:'var(--radius-md)' }}>
                      {[
                        { label:'Total SCH', key:'total_sch', type:'number' },
                        { label:'Core SCH', key:'total_core_sch', type:'number' },
                        { label:'Elective SCH', key:'total_elective_sch', type:'number' },
                      ].map(f => (
                        <div key={f.key} className="form-group">
                          <label className="form-label">{f.label}</label>
                          <input className="form-input" type={f.type} value={editForm[f.key]||''}
                            onChange={e=>setEditForm(p=>({...p,[f.key]:e.target.value}))} />
                        </div>
                      ))}
                      <div className="form-group" style={{ gridColumn:'1/-1' }}>
                        <label className="form-label">Notes</label>
                        <textarea className="form-textarea" rows={2} value={editForm.notes}
                          onChange={e=>setEditForm(p=>({...p,notes:e.target.value}))} />
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <input type="checkbox" id={'stem_' + (prog.id)} checked={editForm.is_stem}
                          onChange={e=>setEditForm(p=>({...p,is_stem:e.target.checked}))} />
                        <label htmlFor={'stem_' + (prog.id)} className="form-label" style={{ margin:0 }}>STEM Designated</label>
                      </div>
                    </div>
                  )}

                  {/* Core Courses */}
                  <CoreCoursesSection
                    programId={prog.id}
                    slots={programDetail[prog.id].core_slots || []}
                    courses={programDetail[prog.id].core_courses || []}
                    onRemove={(cId, code) => removeCoreCourse(prog.id, cId, code)}
                    onAdd={(courseId) => {
                      programsAPI.addCoreCourse(prog.id, { course_id: courseId })
                        .then(() => { toast.success('Core course added'); toggleExpand(prog.id); delete programDetail[prog.id]; toggleExpand(prog.id); })
                        .catch(() => toast.error('Failed to add'));
                    }}
                  />

                  <div className="divider" />

                  {/* Concentrations */}
                  <ConcentrationsSection
                    programId={prog.id}
                    concentrations={programDetail[prog.id].concentrations || []}
                    onRemoveConc={(cId, name) => removeConcentration(prog.id, cId, name)}
                    onRemoveCourse={(concId, courseId, code) => {
                      programsAPI.removeConcCourse(prog.id, concId, courseId)
                        .then(() => {
                          toast.success((code) + ' removed');
                          setProgramDetail(p => ({
                            ...p, [prog.id]: {
                              ...p[prog.id], concentrations: p[prog.id].concentrations.map(c =>
                                c.id === concId ? { ...c, elective_courses: c.elective_courses.filter(e=>e.id!==courseId) } : c
                              )
                            }
                          }));
                        })
                        .catch(() => toast.error('Failed to remove'));
                    }}
                    onAddConc={(data) => {
                      programsAPI.addConcentration(prog.id, data)
                        .then(r => {
                          toast.success('Concentration added');
                          setProgramDetail(p => ({...p, [prog.id]: {...p[prog.id], concentrations: [...(p[prog.id].concentrations||[]), {...r.data, elective_courses:[]}]}}));
                        })
                        .catch(() => toast.error('Failed to add concentration'));
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CoreCoursesSection({ programId, slots, courses, onRemove, onAdd }) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const r = await coursesAPI.list({ search: searchTerm, limit: 10 });
      setResults(r.data);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Use slots if available, otherwise fall back to flat courses list
  const hasSlots = slots && slots.length > 0;
  const totalSlots = hasSlots ? slots.length : courses.length;

  return (
    <div style={{ marginBottom:'1rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
        <h4 style={{ fontSize:'0.875rem', color:'var(--utd-navy)' }}>
          Core Courses ({totalSlots} slots · {courses.length} total courses)
        </h4>
        <button className="btn btn-outline btn-sm" onClick={()=>setShowSearch(!showSearch)}>
          <Plus size={13}/> Add Core Course
        </button>
      </div>

      {showSearch && (
        <div style={{ marginBottom:'0.75rem', position:'relative' }}>
          <div className="search-box">
            <Search size={13} className="search-icon"/>
            <input className="form-input" placeholder="Search course code or title..." value={searchTerm}
              onChange={e=>setSearchTerm(e.target.value)} autoFocus />
          </div>
          {results.length > 0 && (
            <div style={{ position:'absolute', zIndex:10, background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-md)', top:'100%', left:0, right:0, maxHeight:200, overflowY:'auto' }}>
              {results.map(c => (
                <div key={c.id} onClick={()=>{onAdd(c.id);setShowSearch(false);setSearchTerm('');}}
                  style={{ padding:'0.6rem 1rem', cursor:'pointer', display:'flex', gap:'0.6rem', fontSize:'0.82rem' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--gray-50)'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <span className="course-tag" style={{ fontSize:'0.7rem' }}>{c.full_code}</span>
                  {c.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Display with OR groups if available */}
      {hasSlots ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
          {slots.map((slot, i) => (
            slot.type === 'required' ? (
              <div key={slot.courses[0].id} style={{ display:'flex', alignItems:'center', gap:'0.4rem', background:'var(--utd-navy-light)', borderRadius:100, padding:'0.25rem 0.75rem', width:'fit-content' }}>
                <span style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--utd-navy)' }}>{slot.courses[0].full_code}</span>
                <button onClick={()=>onRemove(slot.courses[0].id, slot.courses[0].full_code)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', display:'flex', padding:0 }}>
                  <X size={11}/>
                </button>
              </div>
            ) : (
              <div key={`or_${i}`} style={{ display:'flex', alignItems:'center', gap:'0.3rem', flexWrap:'wrap', border:'1.5px dashed var(--gray-200)', borderRadius:8, padding:'0.4rem 0.6rem' }}>
                <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--utd-orange)', marginRight:'0.2rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>OR</span>
                {slot.courses.map((c, ci) => (
                  <span key={c.id} style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem' }}>
                    {ci > 0 && <span style={{ fontSize:'0.65rem', color:'var(--gray-400)', fontStyle:'italic' }}>or</span>}
                    <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'var(--utd-orange-pale)', borderRadius:100, padding:'0.2rem 0.6rem' }}>
                      <span style={{ fontSize:'0.73rem', fontWeight:700, color:'var(--utd-orange)' }}>{c.full_code}</span>
                      <button onClick={()=>onRemove(c.id, c.full_code)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--utd-orange)', opacity:0.6, display:'flex', padding:0 }}>
                        <X size={10}/>
                      </button>
                    </div>
                  </span>
                ))}
              </div>
            )
          ))}
        </div>
      ) : (
        // Fallback: flat list (no OR group data)
        <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem' }}>
          {courses.map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'0.4rem', background:'var(--utd-navy-light)', borderRadius:100, padding:'0.25rem 0.75rem' }}>
              <span style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--utd-navy)' }}>{c.full_code}</span>
              <button onClick={()=>onRemove(c.id, c.full_code)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', display:'flex', padding:0 }}>
                <X size={11}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConcentrationsSection({ programId, concentrations, onRemoveConc, onRemoveCourse, onAddConc }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newConc, setNewConc] = useState({ name:'', required_sch:9, free_elective_sch:0 });

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
        <h4 style={{ fontSize:'0.875rem', color:'var(--utd-navy)' }}>Concentrations ({concentrations.length})</h4>
        <button className="btn btn-outline btn-sm" onClick={()=>setShowAdd(!showAdd)}>
          <Plus size={13}/> Add Concentration
        </button>
      </div>

      {showAdd && (
        <div style={{ padding:'0.875rem', background:'var(--gray-50)', borderRadius:'var(--radius-md)', marginBottom:'0.75rem', display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div className="form-group" style={{ flex:2, minWidth:200 }}>
            <label className="form-label">Concentration Name</label>
            <input className="form-input" value={newConc.name} onChange={e=>setNewConc(p=>({...p,name:e.target.value}))} placeholder="e.g. Data Science" />
          </div>
          <div className="form-group" style={{ flex:1, minWidth:100 }}>
            <label className="form-label">Required SCH</label>
            <input className="form-input" type="number" value={newConc.required_sch} onChange={e=>setNewConc(p=>({...p,required_sch:parseInt(e.target.value)}))} />
          </div>
          <div className="form-group" style={{ flex:1, minWidth:100 }}>
            <label className="form-label">Free Elective SCH</label>
            <input className="form-input" type="number" value={newConc.free_elective_sch} onChange={e=>setNewConc(p=>({...p,free_elective_sch:parseInt(e.target.value)}))} />
          </div>
          <div style={{ display:'flex', gap:'0.4rem' }}>
            <button className="btn btn-primary btn-sm" disabled={!newConc.name} onClick={()=>{onAddConc(newConc);setShowAdd(false);setNewConc({name:'',required_sch:9,free_elective_sch:0});}}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {concentrations.map(conc => (
        <div key={conc.id} style={{ marginBottom:'0.75rem', padding:'0.875rem', border:'1px solid var(--gray-200)', borderRadius:'var(--radius-md)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
            <span style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--gray-800)', flex:1 }}>{conc.name}</span>
            <span style={{ fontSize:'0.75rem', color:'var(--gray-500)' }}>{conc.required_sch} SCH required</span>
            {conc.free_elective_sch > 0 && <span style={{ fontSize:'0.75rem', color:'var(--gray-400)' }}>{conc.free_elective_sch} free</span>}
            <button className="btn btn-ghost btn-sm" style={{ color:'var(--color-error)' }} onClick={()=>onRemoveConc(conc.id, conc.name)}><Trash2 size={12}/></button>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'0.35rem' }}>
            {(conc.elective_courses||[]).map(c => (
              <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'var(--gray-100)', borderRadius:100, padding:'0.2rem 0.6rem' }}>
                <span style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--gray-700)' }}>{c.full_code}</span>
                <button onClick={()=>onRemoveCourse(conc.id, c.id, c.full_code)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', display:'flex', padding:0 }}>
                  <X size={10}/>
                </button>
              </div>
            ))}
            {(conc.elective_courses||[]).length === 0 && <span style={{ fontSize:'0.75rem', color:'var(--gray-400)' }}>No elective courses assigned</span>}
          </div>
        </div>
      ))}
    </div>
  );
}