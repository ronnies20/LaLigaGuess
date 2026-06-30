import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { supabase } from './lib/supabase'
import { registerPush } from './lib/push'
import AuthPage from './pages/AuthPage'
import PredictPage from './pages/PredictPage'
import LeaderboardPage from './pages/LeaderboardPage'
import ProfilePage from './pages/ProfilePage'
import RulesPage from './pages/RulesPage'
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
    rules: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        <line x1="9" y1="7"  x2="15" y2="7"/>
        <line x1="9" y1="11" x2="15" y2="11"/>
        <line x1="9" y1="15" x2="12" y2="15"/>
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

  const tabs = [
    { id: 'profile', label: 'פרופיל'  },
    { id: 'predict', label: 'ניחושים' },
    { id: 'table',   label: 'טבלה'    },
    { id: 'rules',   label: 'חוקים'   },
  ]

  return (
    <div>
      <div
        className="topbar"
        style={{ flexDirection:'column', alignItems:'center', gap:6, paddingTop:16, paddingBottom:14, cursor:'pointer' }}
        onClick={() => setTab('profile')}
      >
        <img
          src="https://media.api-sports.io/football/teams/529.png"
          alt="Barça"
          style={{ width:34, height:34, objectFit:'contain', filter:'drop-shadow(0 0 10px rgba(253,185,39,0.6))' }}
        />
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:14, fontWeight:800, color:'#FDB927', letterSpacing:0.3 }}>תחרות הניחושים של הלה ליגה</div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, marginTop:3 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#A07FCC', letterSpacing:0.5 }}>Barca Mania x FRIEREN · עונת 26/27</span>
            <span style={{ fontSize:9, fontWeight:800, color:'#050210', background:'linear-gradient(135deg,#FDB927,#ff8800)', borderRadius:4, padding:'1px 5px', letterSpacing:1, textTransform:'uppercase', boxShadow:'0 0 8px rgba(253,185,39,0.5)' }}>BETA</span>
          </div>
        </div>
      </div>

      {tab === 'predict' && <PredictPage />}
      {tab === 'table'   && <LeaderboardPage />}
      {tab === 'profile' && <ProfilePage />}
      {tab === 'rules'   && <RulesPage />}

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
