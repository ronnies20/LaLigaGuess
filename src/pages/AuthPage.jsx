import { useState } from 'react'
import { signIn, signUp } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode]         = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        if (!name.trim()) { setError('יש להזין שם תצוגה'); setLoading(false); return }
        await signUp(email, password, name.trim())
        setDone(true)
      }
    } catch (err) {
      const msg = err.message
      if (msg.includes('Invalid login')) setError('אימייל או סיסמה שגויים')
      else if (msg.includes('already registered')) setError('אימייל זה כבר רשום — נסה להתחבר')
      else setError(msg)
    }
    setLoading(false)
  }

  if (done) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100dvh', padding:'32px', textAlign:'center', gap:'12px' }}>
      <div style={{ fontSize:'48px' }}>✉️</div>
      <h2 style={{ fontSize:'18px', fontWeight:'600' }}>בדוק את האימייל שלך!</h2>
      <p style={{ color:'#666', fontSize:'14px', lineHeight:'1.6' }}>
        שלחנו קישור אימות לכתובת <strong>{email}</strong>.<br/>
        לחץ על הקישור ואז חזור לכאן להתחבר.
      </p>
      <button className="btn btn-outline btn-sm" onClick={() => { setMode('login'); setDone(false) }}>
        חזרה להתחברות
      </button>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100dvh' }}>
      <div style={{ background:'#D4002A', padding:'32px 24px 24px', color:'#fff', textAlign:'center' }}>
        <div style={{ fontSize:'36px', marginBottom:'8px' }}>⚽</div>
        <h1 style={{ fontSize:'22px', fontWeight:'700' }}>LaLiga Predictions</h1>
        <p style={{ fontSize:'13px', opacity:'0.8', marginTop:'4px' }}>ליגת ניחושים פרטית · עונת 2025/26</p>
      </div>

      <div style={{ padding:'24px 20px', flex:'1' }}>
        <div className="toggle-row" style={{ marginBottom:'24px' }}>
          <button className={`toggle-btn${mode==='login'?' active':''}`} onClick={() => setMode('login')}>התחברות</button>
          <button className={`toggle-btn${mode==='register'?' active':''}`} onClick={() => setMode('register')}>הרשמה</button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">שם תצוגה (יוצג בטבלה)</label>
              <input className="form-input" type="text" placeholder="למשל: יוסי כהן" value={name}
                onChange={e => setName(e.target.value)} required maxLength={30} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">אימייל</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">סיסמה</label>
            <input className="form-input" type="password" placeholder={mode==='register'?'לפחות 6 תווים':'••••••••'} value={password}
              onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-full" type="submit" disabled={loading} style={{ marginTop:'8px' }}>
            {loading ? '...' : mode === 'login' ? 'התחבר' : 'הירשם'}
          </button>
        </form>
      </div>
    </div>
  )
}
