import { useState, useEffect } from 'react';
import { studentsAPI, coursesAPI } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { Plus, Search, Trash2, Edit3, ChevronDown, CheckCircle, AlertTriangle, X } from 'lucide-react';

const STATUSES = ['planned','enrolled','completed','dropped'];
const SEMESTERS = ['Spring','Summer','Fall'];
const GRADES = ['A+','A','A-','B+','B','B-','C+','C','C-','F','W','I'];
const GRADE_POINTS = { 'A+':4.0,'A':4.0,'A-':3.67,'B+':3.33,'B':3.0,'B-':2.67,'C+':2.33,'C':2.0,'C-':1.67,'F':0,'W':null,'I':null };

export default function MyCoursesPage() {
  const [studentCourses, setStudentCourses] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSem, setFilterSem]   = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const toast = useToast();

  useEffect(() => { loadCourses(); }, []);

  async function loadCourses() {
    setLoading(true);
    try {
      const res = await studentsAPI.courses();
      setStudentCourses(res.data);
    } catch { toast.error('Failed to load courses'); }
    finally { setLoading(false); }
  }

  async function handleRemove(id) {
    if (!confirm('Remove this course from your plan?')) return;
    try {
      await studentsAPI.removeCourse(id);
      setStudentCourses(p => p.filter(c => c.id !== id));
      toast.success('Course removed');
    } catch { toast.error('Failed to remove course'); }
  }

  async function handleStatusUpdate(id, status, grade) {
    try {
      const gp = grade ? GRADE_POINTS[grade] : undefined;
      await studentsAPI.updateCourse(id, { status, grade: grade || undefined, grade_points: gp });
      setStudentCourses(p => p.map(c => c.id === id ? { ...c, status, grade: grade || c.grade, grade_points: gp || c.grade_points } : c));
      toast.success('Updated');
    } catch { toast.error('Update failed'); }
  }

  const filtered = studentCourses.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterSem && c.semester !== filterSem) return false;
    return true;
  });

  // Group by semester/year
  const grouped = filtered.reduce((acc, c) => {
    const key = (c.year) + ' ' + (c.semester);
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort((a,b) => {
    const [ay, as] = a.split(' '); const [by, bs] = b.split(' ');
    if (ay !== by) return parseInt(by) - parseInt(ay);
    const order = { Spring:1, Summer:2, Fall:3 };
    return (order[bs]||0) - (order[as]||0);
  });

  const totalSCH = studentCourses.filter(c=>c.status==='completed').reduce((s,c)=>s+(c.credit_hours||0),0);
  const enrolledSCH = studentCourses.filter(c=>c.status==='enrolled').reduce((s,c)=>s+(c.credit_hours||0),0);

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <h1>My Courses</h1>
          <p>Track and manage your degree plan · {totalSCH} SCH completed, {enrolledSCH} enrolled</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Add Course
        </button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
        <div style={{ display:'flex', borderRadius:'var(--radius-md)', overflow:'hidden', border:'1.5px solid var(--gray-200)' }}>
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding:'0.45rem 0.9rem', background: filterStatus===s ? 'var(--utd-navy)' : '#fff',
                color: filterStatus===s ? '#fff' : 'var(--gray-600)', border:'none', cursor:'pointer',
                fontSize:'0.8rem', fontWeight:600, textTransform:'capitalize' }}>
              {s}
            </button>
          ))}
        </div>
        <select className="form-select" style={{ width:'auto', minWidth:140 }} value={filterSem} onChange={e=>setFilterSem(e.target.value)}>
          <option value="">All Semesters</option>
          {SEMESTERS.map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ marginLeft:'auto', fontSize:'0.8rem', color:'var(--gray-500)', alignSelf:'center' }}>
          {filtered.length} course{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner lg" /></div>
      ) : sortedKeys.length === 0 ? (
        <div style={{ textAlign:'center', padding:'4rem', color:'var(--gray-400)' }}>
          <BookIcon />
          <p style={{ marginTop:'1rem' }}>No courses found. <button onClick={()=>setShowAddModal(true)} style={{ background:'none',border:'none',color:'var(--utd-orange)',fontWeight:600,cursor:'pointer' }}>Add your first course →</button></p>
        </div>
      ) : (
        sortedKeys.map(key => {
          const courses = grouped[key];
          const semSCH = courses.reduce((s,c)=>s+(c.credit_hours||0),0);
          return (
            <div key={key} style={{ marginBottom:'2rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'0.75rem' }}>
                <h3 style={{ fontSize:'1rem', color:'var(--utd-navy)' }}>{key}</h3>
                <span style={{ fontSize:'0.75rem', color:'var(--gray-500)', background:'var(--gray-100)', padding:'0.2rem 0.6rem', borderRadius:100 }}>{semSCH} SCH</span>
                <div style={{ flex:1, height:1, background:'var(--gray-200)' }} />
              </div>
              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Title</th>
                      <th>SCH</th>
                      <th>Status</th>
                      <th>Grade</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map(c => (
                      <CourseRow key={c.id} course={c}
                        onRemove={() => handleRemove(c.id)}
                        onEdit={() => setEditingCourse(c)}
                        onStatusChange={(status, grade) => handleStatusUpdate(c.id, status, grade)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {showAddModal && <AddCourseModal onClose={() => setShowAddModal(false)} onAdded={loadCourses} />}
      {editingCourse && <EditCourseModal course={editingCourse} onClose={() => setEditingCourse(null)} onSaved={loadCourses} />}
    </div>
  );
}

function CourseRow({ course, onRemove, onEdit, onStatusChange }) {
  const [showGradeInput, setShowGradeInput] = useState(false);
  const gradeColors = { A:['A+','A','A-'], B:['B+','B','B-'], C:['C+','C','C-'] };
  const gradeColor = (g) => {
    if (!g) return 'var(--gray-400)';
    if (['A+','A','A-'].includes(g)) return 'var(--utd-green)';
    if (['B+','B','B-'].includes(g)) return 'var(--utd-navy)';
    return 'var(--color-error)';
  };

  return (
    <tr>
      <td><span className="course-tag">{course.full_code}</span></td>
      <td style={{ maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{course.title}</td>
      <td><span style={{ fontWeight:600, color:'var(--gray-700)' }}>{course.credit_hours}</span></td>
      <td>
        <select value={course.status} onChange={e => onStatusChange(e.target.value, course.grade)}
          style={{ border:'none', background:'transparent', fontSize:'0.8rem', fontWeight:600, cursor:'pointer',
            color: course.status==='completed' ? 'var(--utd-green)' : course.status==='enrolled' ? 'var(--utd-navy)' : 'var(--gray-500)' }}>
          {STATUSES.map(s => <option key={s} value={s} style={{ textTransform:'capitalize' }}>{s}</option>)}
        </select>
      </td>
      <td>
        {course.status === 'completed' ? (
          <select value={course.grade || ''} onChange={e => onStatusChange('completed', e.target.value)}
            style={{ border:'none', background:'transparent', fontSize:'0.85rem', fontWeight:700, cursor:'pointer', color:gradeColor(course.grade) }}>
            <option value="">—</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        ) : <span style={{ color:'var(--gray-300)' }}>—</span>}
      </td>
      <td>
        <div style={{ display:'flex', gap:'0.25rem', justifyContent:'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onEdit}><Edit3 size={13} /></button>
          <button className="btn btn-ghost btn-sm" onClick={onRemove} style={{ color:'var(--color-error)' }}><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  );
}

function AddCourseModal({ onClose, onAdded }) {
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ semester:'Fall', year: new Date().getFullYear(), status:'planned' });
  const [prereqCheck, setPrereqCheck] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (search.length < 2) { setCourses([]); return; }
    const t = setTimeout(async () => {
      const r = await coursesAPI.list({ search, limit: 20 });
      setCourses(r.data);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function checkPrereqs(courseId) {
    try {
      const r = await studentsAPI.checkPrereqs(courseId);
      setPrereqCheck(r.data);
    } catch {}
  }

  async function handleAdd() {
    if (!selected) return;
    setLoading(true);
    try {
      await studentsAPI.addCourse({ course_id: selected.id, ...form, year: parseInt(form.year) });
      toast.success((selected.full_code) + ' added to your plan');
      onAdded(); onClose();
    } catch (err) {
      if (err.response?.data?.missing_prerequisites) {
        toast.error('Missing prerequisites: ' + (err.response.data.missing_prerequisites.join(', ')));
      } else {
        toast.error(err.response?.data?.error || 'Failed to add course');
      }
    } finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Add Course to Plan</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Search Course</label>
            <div className="search-box">
              <Search size={15} className="search-icon" />
              <input className="form-input" placeholder="e.g. BUAN 6337 or Predictive Analytics..."
                value={search} onChange={e=>setSearch(e.target.value)} autoFocus />
            </div>
          </div>

          {courses.length > 0 && !selected && (
            <div style={{ border:'1.5px solid var(--gray-200)', borderRadius:'var(--radius-md)', overflow:'hidden', maxHeight:200, overflowY:'auto' }}>
              {courses.map(c => (
                <div key={c.id} onClick={() => { setSelected(c); setSearch(''); checkPrereqs(c.id); }}
                  style={{ padding:'0.65rem 1rem', cursor:'pointer', display:'flex', gap:'0.75rem', alignItems:'center', borderBottom:'1px solid var(--gray-100)' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--gray-50)'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <span className="course-tag" style={{ flexShrink:0 }}>{c.full_code}</span>
                  <span style={{ fontSize:'0.85rem', flex:1 }}>{c.title}</span>
                  <span style={{ fontSize:'0.75rem', color:'var(--gray-400)' }}>{c.credit_hours}h</span>
                </div>
              ))}
            </div>
          )}

          {selected && (
            <div style={{ background:'var(--utd-navy-light)', borderRadius:'var(--radius-md)', padding:'0.875rem', display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
              <span className="course-tag">{selected.full_code}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:'0.875rem' }}>{selected.title}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--gray-500)', marginTop:'0.2rem' }}>{selected.credit_hours} credit hours</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(null); setPrereqCheck(null); }}><X size={13} /></button>
            </div>
          )}

          {prereqCheck && prereqCheck.prerequisites.length > 0 && (
            <div className={'alert ' + (prereqCheck.can_enroll ? 'alert-success' : 'alert-warning')}>
              {prereqCheck.can_enroll ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <div>
                <strong>{prereqCheck.can_enroll ? 'Prerequisites met' : 'Missing required prerequisites'}</strong>
                <div style={{ fontSize:'0.8rem', marginTop:'0.25rem' }}>
                  {prereqCheck.prerequisites.map(p => (
                    <span key={p.course_id} style={{ display:'inline-flex', alignItems:'center', gap:'0.25rem', marginRight:'0.5rem' }}>
                      {p.is_met ? <CheckCircle size={11} color="var(--utd-green)" /> : <X size={11} color="var(--color-error)" />}
                      {p.course_code} ({p.prereq_type})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Semester</label>
              <select className="form-select" value={form.semester} onChange={e=>setForm(p=>({...p,semester:e.target.value}))}>
                {SEMESTERS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Year</label>
              <input className="form-input" type="number" min="2020" max="2035" value={form.year} onChange={e=>setForm(p=>({...p,year:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                {STATUSES.map(s => <option key={s} value={s} style={{ textTransform:'capitalize' }}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!selected || loading} onClick={handleAdd}>
            {loading ? <div className="spinner" style={{width:16,height:16}} /> : 'Add to Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCourseModal({ course, onClose, onSaved }) {
  const [form, setForm] = useState({ semester: course.semester, year: course.year, status: course.status, grade: course.grade||'', notes: course.notes||'' });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleSave() {
    setLoading(true);
    try {
      const gp = form.grade ? GRADE_POINTS[form.grade] : undefined;
      await studentsAPI.updateCourse(course.id, { ...form, year: parseInt(form.year), grade_points: gp });
      toast.success('Course updated');
      onSaved(); onClose();
    } catch { toast.error('Update failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Edit Course — {course.full_code}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Semester</label>
              <select className="form-select" value={form.semester} onChange={e=>setForm(p=>({...p,semester:e.target.value}))}>
                {SEMESTERS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Year</label>
              <input className="form-input" type="number" value={form.year} onChange={e=>setForm(p=>({...p,year:e.target.value}))} />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                {STATUSES.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Grade</label>
              <select className="form-select" value={form.grade} onChange={e=>setForm(p=>({...p,grade:e.target.value}))}>
                <option value="">—</option>
                {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function BookIcon() {
  return <div style={{fontSize:'3rem'}}>📚</div>;
}
