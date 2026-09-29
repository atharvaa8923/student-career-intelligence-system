import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';

export default function LoginPage() {
  const [role, setRole]         = useState('student'); // 'student' | 'admin'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      // Verify the role matches what was selected
      if (role === 'admin' && user.role !== 'admin') {
        toast.error('This account does not have admin access.');
        setLoading(false);
        return;
      }
      toast.success('Welcome back, ' + user.firstName + '!');
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'linear-gradient(135deg, var(--utd-navy) 0%, #0D2B3E 100%)' }}>

      {/* Left panel */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'3rem', color:'#fff', maxWidth:520 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'3rem' }}>
          <div style={{ width:44, height:44, background:'var(--utd-orange)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-serif)', fontWeight:700, fontSize:'1.2rem', color:'#fff' }}>J</div>
          <div>
            <div style={{ fontSize:'1.1rem', fontWeight:700 }}>JSOM Degree Planner</div>
            <div style={{ fontSize:'0.75rem', opacity:0.6 }}>Naveen Jindal School of Management</div>
          </div>
        </div>
        <h1 style={{ color:'#fff', fontSize:'2.25rem', lineHeight:1.2, marginBottom:'1rem' }}>
          Plan your path to graduation
        </h1>
        <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'1rem', lineHeight:1.7 }}>
          Track your degree requirements, plan your courses semester by semester,
          and ensure you meet every graduation constraint — all in one place.
        </p>
        <div style={{ marginTop:'2.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
          {['Real-time prerequisite checking','Smart course recommendations','Direct Galaxy enrollment links','Admin-managed degree constraints'].map(f => (
            <div key={f} style={{ display:'flex', alignItems:'center', gap:'0.75rem', color:'rgba(255,255,255,0.75)', fontSize:'0.875rem' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--utd-orange-light)', flexShrink:0 }} />{f}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', background:'rgba(255,255,255,0.04)', backdropFilter:'blur(4px)' }}>
        <div style={{ background:'#fff', borderRadius:20, padding:'2.5rem', width:'100%', maxWidth:420, boxShadow:'var(--shadow-xl)' }}>

          {/* Role toggle */}
          <div style={{ display:'flex', background:'var(--gray-100)', borderRadius:12, padding:4, marginBottom:'2rem', gap:4 }}>
            {[
              { value:'student', label:'Student', icon:<GraduationCap size={15}/> },
              { value:'admin',   label:'Administration', icon:<Shield size={15}/> },
            ].map(tab => (
              <button key={tab.value} type="button" onClick={() => { setRole(tab.value); setEmail(''); setPassword(''); }}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem',
                  padding:'0.6rem 0.5rem', borderRadius:9, border:'none', cursor:'pointer', fontSize:'0.82rem', fontWeight:700, transition:'all 0.2s',
                  background: role===tab.value ? '#fff' : 'transparent',
                  color: role===tab.value ? 'var(--utd-navy)' : 'var(--gray-400)',
                  boxShadow: role===tab.value ? 'var(--shadow-sm)' : 'none' }}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          <div style={{ marginBottom:'1.75rem' }}>
            <h2 style={{ fontSize:'1.4rem', marginBottom:'0.2rem' }}>
              {role === 'admin' ? 'Admin Sign In' : 'Student Sign In'}
            </h2>
            <p style={{ color:'var(--gray-500)', fontSize:'0.85rem' }}>
              {role === 'admin' ? 'Administration & faculty access' : 'Use your UTD email address'}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position:'relative' }}>
                <Mail size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--gray-400)' }}/>
                <input className="form-input" type="email"
                  placeholder={role === 'admin' ? 'admin@utdallas.edu' : 'netid@utdallas.edu'}
                  value={email} onChange={e => setEmail(e.target.value)}
                  style={{ paddingLeft:'2.25rem' }} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position:'relative' }}>
                <Lock size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--gray-400)' }}/>
                <input className="form-input" type={showPwd ? 'text' : 'password'} placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  style={{ paddingLeft:'2.25rem', paddingRight:'2.5rem' }} required />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)' }}>
                  {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
              style={{ width:'100%', justifyContent:'center',
                background: role==='admin' ? 'var(--utd-navy)' : 'var(--utd-orange)' }}>
              {loading ? <div className="spinner" style={{ width:18, height:18 }}/> : <>Sign In <ArrowRight size={16}/></>}
            </button>
          </form>

          <div className="divider"/>

          {role === 'student' && (
            <p style={{ textAlign:'center', fontSize:'0.8rem', color:'var(--gray-500)' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color:'var(--utd-orange)', fontWeight:600 }}>Register here</Link>
            </p>
          )}

          {/* Demo credentials */}
          <div style={{ marginTop:'1.25rem', padding:'0.875rem', background:'var(--gray-50)', borderRadius:8, fontSize:'0.73rem', color:'var(--gray-500)', lineHeight:1.7 }}>
            <strong style={{ color:'var(--gray-700)' }}>Demo {role === 'admin' ? 'admin' : 'student'}:</strong><br/>
            {role === 'admin'
              ? <><strong>Email:</strong> admin@utdallas.edu<br/><strong>Password:</strong> password123</>
              : <><strong>Email:</strong> demo.student@utdallas.edu<br/><strong>Password:</strong> password123</>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

