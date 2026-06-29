import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { supabase } from './lib/supabase'
import { registerPush } from './lib/push'
import AuthPage from './pages/AuthPage'
import PredictPage from './pages/PredictPage'
import LeaderboardPage from './pages/LeaderboardPage'
import ProfilePage from './pages/ProfilePage'
import './index.css'

function NavIcon({ name }) {
  const icons = {
    profile: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    predict: (
      <svg viewBox="0 0 36 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1"  y="1" width="10" height="18" rx="2"/>
        <rect x="13" y="1" width="10" height="18" rx="2"/>
        <rect x="25" y="1" width="10" height="18" rx="2"/>
        <text x="6"  y="14" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none">1</text>
        <text x="18" y="14" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none">X</text>
        <text x="30" y="14" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none">2</text>
      </svg>
    ),
    table: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="3" y1="9"  x2="21" y2="9"/>
        <line x1="3" y1="15" x2="21" y2="15"/>
        <line x1="9" y1="9"  x2="9"  y2="21"/>
      </svg>
    ),
  }
  return icons[name] || null
}

function App() {
  const { user, loading } = useAuth()
  const [tab, setTab] = useState('predict')

  useEffect(() => {
    if (user) setTimeout(() => registerPush(user.id, supabase), 3000)
  }, [user?.id])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100dvh', background:'#050210' }}>
      <div className="spinner" />
    </div>
  )

  if (!user) return <AuthPage />

  // RTL order: profile (right), predict (center), table (left)
  const tabs = [
    { id: 'profile', label: 'פרופיל'  },
    { id: 'predict', label: 'ניחושים' },
    { id: 'table',   label: 'טבלה'    },
  ]

  return (
    <div>
      <div className="topbar" style={{ flexDirection:'column', alignItems:'center', gap:6, paddingTop:16, paddingBottom:14 }}>
        <img
          src="https://media.api-sports.io/football/teams/529.png"
          alt="Barça"
          style={{ width:34, height:34, objectFit:'contain', filter:'drop-shadow(0 0 10px rgba(253,185,39,0.6))' }}
        />
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:14, fontWeight:800, color:'#FDB927', letterSpacing:0.3 }}>תחרות הניחושים של הלה ליגה</div>
          <div style={{ fontSize:12, fontWeight:700, color:'#A07FCC', marginTop:3, letterSpacing:0.5 }}>Barca Mania x FRIEREN · עונת 26/27</div>
        </div>
      </div>

      {tab === 'predict' && <PredictPage />}
      {tab === 'table'   && <LeaderboardPage />}
      {tab === 'profile' && <ProfilePage />}

      <nav className="bottom-nav">
        {tabs.map(t => (
          <button key={t.id} className={`nav-item${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            <NavIcon name={t.id} />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function Root() {
  return <AuthProvider><App /></AuthProvider>
}
