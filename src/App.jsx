import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { supabase, getCurrentRound } from './lib/supabase'
import { registerPush } from './lib/push'
import { getCelebrated } from './lib/effects'
import AuthPage from './pages/AuthPage'
import PredictPage from './pages/PredictPage'
import LeaderboardPage from './pages/LeaderboardPage'
import LivePage from './pages/LivePage'
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
    live: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" fill="#FF3B3B" stroke="none"/>
        <circle cx="12" cy="12" r="7.5" stroke="#FF3B3B" strokeOpacity="0.45"/>
        <circle cx="12" cy="12" r="11"  stroke="#FF3B3B" strokeOpacity="0.18"/>
      </svg>
    ),
  }
  return icons[name] || null
}

function App() {
  const { user, loading } = useAuth()
  const [tab, setTab] = useState('predict')
  const [hasPending, setHasPending] = useState(false)
  const [hasLive, setHasLive] = useState(false)

  useEffect(() => {
    if (user) setTimeout(() => registerPush(user.id, supabase), 3000)
  }, [user?.id])

  // Track live matches — show/hide Live tab
  useEffect(() => {
    if (!user) return
    const LIVE = ['1H','HT','2H','ET','BT','P','INT']
    supabase.from('matches').select('id', { count: 'exact', head: true }).in('status', LIVE)
      .then(({ count }) => setHasLive((count ?? 0) > 0))
    const ch = supabase.channel('app-live-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, p => {
        const wasLive = LIVE.includes(p.old?.status)
        const isNowLive = LIVE.includes(p.new?.status)
        if (!wasLive && isNowLive) setHasLive(true)
        if (wasLive && !isNowLive) {
          supabase.from('matches').select('id', { count: 'exact', head: true }).in('status', LIVE)
            .then(({ count }) => {
              if ((count ?? 0) === 0) { setHasLive(false); setTab(t => t === 'live' ? 'predict' : t) }
            })
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    async function checkPending() {
      try {
        const currentRound = await getCurrentRound()
        const { data: roundMatches } = await supabase
          .from('matches').select('id, kickoff, home_score').eq('round', currentRound)
        if (!roundMatches?.length) { setHasPending(false); return }

        // Condition 1: open matches in current round with no prediction yet
        const openMatches = roundMatches.filter(m =>
          m.home_score === null &&
          new Date(m.kickoff).getTime() - 1 * 60 * 1000 > Date.now()
        )
        if (openMatches.length > 0) {
          const { data: preds } = await supabase
            .from('predictions').select('match_id')
            .eq('user_id', user.id).in('match_id', openMatches.map(m => m.id))
          const predIds = new Set((preds || []).map(p => p.match_id))
          if (openMatches.some(m => !predIds.has(m.id))) { setHasPending(true); return }
        }

        // Condition 2: finished matches whose celebration hasn't fired yet
        const finishedIds = roundMatches.filter(m => m.home_score !== null).map(m => m.id)
        if (finishedIds.length > 0) {
          const { data: myPreds } = await supabase
            .from('predictions').select('match_id')
            .eq('user_id', user.id).in('match_id', finishedIds)
          if (myPreds?.length) {
            const celebrated = getCelebrated(user.id)
            if (myPreds.some(p => !celebrated.has(p.match_id))) { setHasPending(true); return }
          }
        }

        setHasPending(false)
      } catch {}
    }
    checkPending()
  }, [user?.id, tab])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100dvh', background:'#050210' }}>
      <div className="spinner" />
    </div>
  )

  if (!user) return <AuthPage />

  const tabs = [
    { id: 'profile', label: 'פרופיל'  },
    { id: 'predict', label: 'ניחושים' },
    ...(hasLive ? [{ id: 'live', label: 'חדר מלחמה' }] : []),
    { id: 'table',   label: 'טבלה'    },
    { id: 'rules',   label: 'חוקים'   },
  ]

  return (
    <div>
      {/* Logo header — fills full width, not sticky */}
      <div
        style={{ background:'#050210', height:400, overflow:'hidden', cursor:'pointer' }}
        onClick={() => setTab('profile')}
      >
        <img
          src="/kittyCATa.io%20LOGO.png"
          alt="KittyCata"
          style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 40%', display:'block' }}
        />
      </div>

      {/* Sticky secondary header with text */}
      <div
        className="topbar"
        style={{ flexDirection:'column', alignItems:'center', gap:2, paddingTop:8, paddingBottom:8, cursor:'pointer' }}
        onClick={() => setTab('profile')}
      >
        <div style={{ fontSize:13, fontWeight:800, color:'#FDB927', letterSpacing:0.3 }}>תחרות הניחושים של הלה ליגה</div>
        <div style={{ fontSize:11, fontWeight:700, color:'#A07FCC', letterSpacing:0.5 }}>Barca Mania x FRIEREN · עונת 26/27</div>
      </div>

      {tab === 'predict' && <PredictPage />}
      {tab === 'live'    && <LivePage />}
      {tab === 'table'   && <LeaderboardPage />}
      {tab === 'profile' && <ProfilePage />}
      {tab === 'rules'   && <RulesPage />}

      <nav className="bottom-nav">
        {tabs.map(t => (
          <button key={t.id} className={`nav-item${tab === t.id ? ' active' : ''}${t.id === 'live' ? ' live-tab' : ''}`} onClick={() => setTab(t.id)}>
            <div className="nav-icon-wrap">
              <NavIcon name={t.id} />
              {t.id === 'predict' && hasPending && tab !== 'predict' && <span className="nav-badge" />}
            </div>
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
