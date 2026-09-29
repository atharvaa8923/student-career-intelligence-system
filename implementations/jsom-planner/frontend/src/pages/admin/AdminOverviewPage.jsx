import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { Users, BookOpen, GraduationCap, Database, RefreshCw, Activity, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function AdminOverviewPage() {
  const [stats, setStats]   = useState(null);
  const [graph, setGraph]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [sRes, gRes] = await Promise.all([adminAPI.stats(), adminAPI.graphStats()]);
      setStats(sRes.data);
      setGraph(gRes.data);
    } catch { toast.error('Failed to load stats'); }
    finally { setLoading(false); }
  }

  async function refreshGraph() {
    setRefreshing(true);
    try {
      await adminAPI.refreshGraph();
      toast.success('Knowledge graph refreshed');
      load();
    } catch { toast.error('Refresh failed'); }
    finally { setRefreshing(false); }
  }

  if (loading) return <div className="loading-overlay"><div className="spinner lg" /></div>;

  const enrollData = stats?.enrollments ? Object.entries(stats.enrollments).map(([k,v]) => ({ name: k, value: v })) : [];
  const enrollColors = { completed:'var(--utd-green)', enrolled:'var(--utd-navy)', planned:'var(--gray-400)', dropped:'var(--color-error)' };

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <h1>Admin Overview</h1>
          <p>System status and degree constraint management</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={refreshGraph} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          Refresh Graph
        </button>
      </div>

      {/* Main KPIs */}
      <div className="grid-4" style={{ marginBottom:'1.75rem' }}>
        {[
          { icon:<GraduationCap size={20}/>, cls:'orange', label:'Active Programs', value:stats?.programs, link:'/admin/programs' },
          { icon:<BookOpen size={20}/>,      cls:'blue',   label:'Total Courses',   value:stats?.courses,  link:'/admin/courses' },
          { icon:<Users size={20}/>,         cls:'green',  label:'Registered Students', value:stats?.students, link:'/admin/students' },
          { icon:<Database size={20}/>,      cls:'gold',   label:'Graph Edges',     value:graph?.graph_edges, link:'/admin/graph' },
        ].map(s => (
          <Link key={s.label} to={s.link} style={{ textDecoration:'none' }}>
            <div className="stat-card" style={{ cursor:'pointer' }}>
              <div className={'stat-icon ' + (s.cls)}>{s.icon}</div>
              <div>
                <div className="card-title">{s.label}</div>
                <div className="card-value" style={{ fontSize:'1.75rem' }}>{s.value ?? '—'}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', marginBottom:'1.5rem' }}>
        {/* Enrollment distribution */}
        <div className="card">
          <div className="card-header">
            <span className="card-section-title">Course Enrollments by Status</span>
            <Activity size={15} color="var(--gray-400)" />
          </div>
          {enrollData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={enrollData} layout="vertical">
                <XAxis type="number" tick={{ fontSize:11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize:11, textTransform:'capitalize' }} width={70} />
                <Tooltip />
                <Bar dataKey="value" radius={[0,4,4,0]}>
                  {enrollData.map(entry => (
                    <Cell key={entry.name} fill={enrollColors[entry.name] || 'var(--gray-300)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gray-300)' }}>No data</div>}
        </div>

        {/* Knowledge Graph stats */}
        <div className="card">
          <div className="card-header">
            <span className="card-section-title">Knowledge Graph Health</span>
            <Database size={15} color="var(--gray-400)" />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {[
              { label:'Total course nodes', value: graph?.graph_nodes },
              { label:'Prerequisite edges', value: graph?.graph_edges },
              { label:'Graph density', value: graph?.graph_density ? (graph.graph_density) + '%' : '—' },
              { label:'Isolated courses', value: graph?.isolated_courses?.length || 0,
                warn: (graph?.isolated_courses?.length || 0) > 20 },
            ].map(r => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.5rem 0', borderBottom:'1px solid var(--gray-100)' }}>
                <span style={{ fontSize:'0.85rem', color:'var(--gray-600)' }}>{r.label}</span>
                <span style={{ fontWeight:700, fontSize:'0.9rem', color: r.warn ? 'var(--color-error)' : 'var(--utd-navy)' }}>{r.value ?? '—'}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:'1rem' }}>
            <p style={{ fontSize:'0.75rem', color:'var(--gray-400)', marginBottom:'0.5rem' }}>Top cross-listed courses:</p>
            {graph?.top_cross_listed?.slice(0,3).map(c => (
              <div key={c.full_code} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.78rem', padding:'0.2rem 0', color:'var(--gray-600)' }}>
                <span className="course-tag" style={{ fontSize:'0.7rem' }}>{c.full_code}</span>
                <span>{c.connections} programs/concentrations</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick nav */}
      <div className="card">
        <div className="card-header">
          <span className="card-section-title">Administration</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'0.75rem' }}>
          {[
            { to:'/admin/programs', icon:'🎓', label:'Manage Programs', desc:'Edit degree requirements, add/remove core courses, manage concentrations' },
            { to:'/admin/courses',  icon:'📚', label:'Course Catalog',  desc:'Add courses, set prerequisites, manage the knowledge graph edges' },
            { to:'/admin/students', icon:'👥', label:'Student Records', desc:'View all students, track progress, manage enrollments' },
            { to:'/admin/graph',    icon:'🕸️', label:'Knowledge Graph', desc:'Visualize course dependencies and program relationships' },
            { to:'/admin/settings', icon:'⚙️', label:'Settings',        desc:'Manage admin users, audit logs, system configuration' },
          ].map(item => (
            <Link key={item.to} to={item.to} style={{ textDecoration:'none' }}>
              <div style={{ padding:'1rem', borderRadius:'var(--radius-md)', border:'1.5px solid var(--gray-200)', cursor:'pointer', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--utd-orange)'; e.currentTarget.style.background='var(--utd-orange-pale)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--gray-200)'; e.currentTarget.style.background=''; }}>
                <div style={{ fontSize:'1.5rem', marginBottom:'0.4rem' }}>{item.icon}</div>
                <div style={{ fontWeight:600, fontSize:'0.875rem', color:'var(--utd-navy)', marginBottom:'0.3rem' }}>{item.label}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--gray-500)', lineHeight:1.4 }}>{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

