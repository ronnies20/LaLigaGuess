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
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100dvh', padding:'32px', textAlign:'center', gap:'12px', background:'#07091A' }}>
      <div style={{ fontSize:'48px', filter:'drop-shadow(0 0 16px rgba(255,215,0,0.5))' }}>✉️</div>
      <h2 style={{ fontSize:'18px', fontWeight:'700', color:'#FFD700' }}>בדוק את האימייל שלך!</h2>
      <p style={{ color:'#6B6B90', fontSize:'14px', lineHeight:'1.6' }}>
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
      <div style={{ background:'linear-gradient(135deg, #0D0F24 0%, #1A1040 100%)', padding:'40px 24px 28px', textAlign:'center', borderBottom:'1px solid rgba(255,215,0,0.2)' }}>
        <img src="https://media.api-sports.io/football/teams/529.png" alt="Barça"
          style={{ width:56, height:56, objectFit:'contain', marginBottom:10, filter:'drop-shadow(0 0 16px rgba(253,185,39,0.6))' }} />
        <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#FDB927', letterSpacing:'0.3px', lineHeight:1.3 }}>תחרות הניחושים של הלה ליגה</h1>
        <p style={{ fontSize:'13px', color:'#A07FCC', marginTop:'7px', fontWeight:700, letterSpacing:0.5 }}>Barca Mania x FRIEREN · עונת 26/27</p>
      </div>

      <div style={{ padding:'24px 20px', flex:'1' }}>
        <div className="toggle-row" style={{ marginBottom:'24px' }}>
          <button className={`toggle-btn${mode==='login'?' active':''}`} onClick={() => setMode('login')}>התחברות</button>
          <button className={`toggle-btn${mode==='register'?' active':''}`} onClick={() => setMode('register')}>הרשמה</button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">ניק טלגרם (יוצג בטבלה)</label>
              <input className="form-input" type="text" placeholder="למשל: FRIEREN" value={name}
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
