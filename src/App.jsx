import { useState } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import AuthPage from './pages/AuthPage'
import PredictPage from './pages/PredictPage'
import LeaderboardPage from './pages/LeaderboardPage'
import ProfilePage from './pages/ProfilePage'
import './index.css'

function NavIcon({ name }) {
  const icons = {
    predict: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10"/><path d="m12 8 4 4-4 4M8 12h8"/>
      </svg>
    ),
    table: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
      </svg>
    ),
    profile: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    )
  }
  return icons[name] || null
}

function App() {
  const { user, loading } = useAuth()
  const [tab, setTab] = useState('predict')

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100dvh' }}>
      <div className="spinner" />
    </div>
  )

  if (!user) return <AuthPage />

  const tabs = [
    { id: 'predict', label: 'ניחושים' },
    { id: 'table',   label: 'טבלה'    },
    { id: 'profile', label: 'פרופיל'  },
  ]

  return (
    <div>
      <div className="topbar">
        <div className="topbar-logo">L</div>
        <div>
          <div className="topbar h1" style={{ fontSize:16, fontWeight:600, color:'#fff' }}>LaLiga Predictions</div>
          <div className="topbar-sub">עונת 2025/26</div>
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
