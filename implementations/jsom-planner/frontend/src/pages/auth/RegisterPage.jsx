import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { programsAPI, authAPI } from '../../utils/api';
import { ArrowRight, Info, CheckCircle } from 'lucide-react';

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName:'', lastName:'', email:'', password:'', confirmPassword:'', utdId:'', programId:''
  });
  const [programs, setPrograms]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [pwdStrength, setPwdStrength] = useState(0);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    programsAPI.list().then(r => setPrograms(r.data)).catch(() => {});
  }, []);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (k === 'password') {
      let s = 0;
      if (v.length >= 8) s++;
      if (/[A-Z]/.test(v)) s++;
      if (/[0-9]/.test(v)) s++;
      if (/[^A-Za-z0-9]/.test(v)) s++;
      setPwdStrength(s);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match'); return;
    }
    setLoading(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName:  form.lastName,
        email:     form.email,
        password:  form.password,
        utdId:     form.utdId || undefined,
        programId: form.programId || undefined,
      };
      await authAPI.register(payload);
      const user = await login(form.email, form.password);
      toast.success('Account created! Welcome to JSOM Planner.');
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const strengthColors = ['var(--gray-200)', 'var(--color-error)', 'var(--utd-orange)', '#F0C040', 'var(--utd-green)'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  // Group programs by type for dropdown
  const programGroups = programs.reduce((acc, p) => {
    const type = p.program_type || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(p);
    return acc;
  }, {});

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg, var(--utd-navy) 0%, #0D2B3E 100%)', padding:'2rem' }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'2.5rem', width:'100%', maxWidth:520, boxShadow:'var(--shadow-xl)' }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'1.75rem' }}>
          <div style={{ width:36, height:36, background:'var(--utd-orange)', borderRadius:8,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'var(--font-serif)', fontWeight:700, fontSize:'1rem', color:'#fff' }}>J</div>
          <span style={{ fontWeight:700, color:'var(--utd-navy)', fontSize:'0.95rem' }}>JSOM Degree Planner</span>
        </div>

        <div style={{ marginBottom:'1.5rem' }}>
          <h2 style={{ fontSize:'1.35rem', marginBottom:'0.2rem' }}>
            Create Student Account
          </h2>
          <p style={{ color:'var(--gray-500)', fontSize:'0.82rem' }}>
            Register with your UTD email address
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

          {/* Name row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input className="form-input" placeholder="Jane" value={form.firstName}
                onChange={e=>set('firstName',e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input className="form-input" placeholder="Smith" value={form.lastName}
                onChange={e=>set('lastName',e.target.value)} required />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label">UTD Email</label>
            <input className="form-input" type="email" placeholder="netid@utdallas.edu"
              value={form.email} onChange={e=>set('email',e.target.value)} required />
          </div>

          {/* UTD ID — students only */}
          <>
            <div className="form-group">
              <label className="form-label">UTD ID <span style={{ color:'var(--gray-400)', fontWeight:400 }}>(optional)</span></label>
              <input className="form-input" placeholder="SXS123456"
                value={form.utdId} onChange={e=>set('utdId',e.target.value)} />
            </div>
          </>

          {/* Program — students only, not required */}
          <>
            <div className="form-group">
              <label className="form-label" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>Degree Program <span style={{ color:'var(--gray-400)', fontWeight:400 }}>(optional)</span></span>
              </label>
              <select className="form-select" value={form.programId} onChange={e=>set('programId',e.target.value)}>
                <option value="">Select your program (can be set later)</option>
                {Object.entries(programGroups).map(([type, progs]) => (
                  <optgroup key={type} label={type}>
                    {progs.map(p => <option key={p.id} value={p.id}>{p.program_name}</option>)}
                  </optgroup>
                ))}
              </select>
              {/* Info note */}
              <div style={{ display:'flex', alignItems:'flex-start', gap:'0.4rem', marginTop:'0.4rem',
                padding:'0.5rem 0.65rem', background:'#EBF5FB', borderRadius:6, fontSize:'0.75rem', color:'#1F618D' }}>
                <Info size={13} style={{ flexShrink:0, marginTop:1 }}/>
                <span>You can select or change your program after registration from your profile settings.</span>
              </div>
            </div>
          </>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="Min. 8 characters"
              value={form.password} onChange={e=>set('password',e.target.value)} minLength={8} required />
            {form.password && (
              <div style={{ marginTop:'0.4rem' }}>
                <div style={{ display:'flex', gap:3, marginBottom:'0.2rem' }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex:1, height:3, borderRadius:2,
                      background: pwdStrength >= i ? strengthColors[pwdStrength] : 'var(--gray-200)',
                      transition:'background 0.2s' }}/>
                  ))}
                </div>
                <span style={{ fontSize:'0.7rem', color: strengthColors[pwdStrength] }}>{strengthLabels[pwdStrength]}</span>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="form-group">
            <label className="form-label" style={{ display:'flex', justifyContent:'space-between' }}>
              <span>Confirm Password</span>
              {form.confirmPassword && form.password === form.confirmPassword && (
                <span style={{ color:'var(--utd-green)', fontSize:'0.75rem', display:'flex', alignItems:'center', gap:'0.25rem' }}>
                  <CheckCircle size={12}/> Match
                </span>
              )}
            </label>
            <input className="form-input" type="password" placeholder="Re-enter password"
              value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)}
              style={{ borderColor: form.confirmPassword && form.password !== form.confirmPassword ? 'var(--color-error)' : '' }}
              required />
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <span style={{ fontSize:'0.72rem', color:'var(--color-error)', marginTop:'0.2rem', display:'block' }}>Passwords do not match</span>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
            style={{ width:'100%', justifyContent:'center', marginTop:'0.25rem',
              background: 'var(--utd-orange)' }}>
            {loading ? <div className="spinner" style={{ width:18, height:18 }}/> : <>Create Account <ArrowRight size={16}/></>}
          </button>
        </form>

        <p style={{ textAlign:'center', fontSize:'0.8rem', color:'var(--gray-500)', marginTop:'1.25rem' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color:'var(--utd-orange)', fontWeight:600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

