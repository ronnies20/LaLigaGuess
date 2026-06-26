import { useState, useEffect } from 'react'
import { supabase, signOut, getMyStats } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function ProfilePage() {
  const { user, profile } = useAuth()
  const [stats, setStats]     = useState(null)
  const [rank, setRank]       = useState(null)
  const [copied, setCopied]   = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!user) return
      try {
        const s = await getMyStats(user.id)
        setStats(s)

        const { data: lb } = await supabase
          .from('leaderboard_view')
          .select('user_id')
          .order('total_points', { ascending: false })
        if (lb) {
          const idx = lb.findIndex(r => r.user_id === user.id)
          setRank(idx > -1 ? idx + 1 : null)
        }
      } catch (err) { console.error(err) }
      setLoading(false)
    }
    load()
  }, [user])

  function copyInvite() {
    const link = `${window.location.origin}?invite=LL2526`
    navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'שחקן'
  const pct = stats && stats.played > 0 ? Math.round(((stats.exact + stats.dir) / stats.played) * 100) : 0

  return (
    <div className="page">
      <div style={{ background:'#D4002A', padding:'20px 16px', color:'#fff', display:'flex', alignItems:'center', gap:'12px' }}>
        <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#fff', flexShrink:0 }}>
          {displayName[0].toUpperCase()}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:600 }}>{displayName}</div>
          <div style={{ fontSize:12, opacity:.75, marginTop:2 }}>{user?.email}</div>
        </div>
        {rank && (
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:20, fontWeight:700 }}>#{rank}</div>
            <div style={{ fontSize:11, opacity:.75 }}>דירוג</div>
          </div>
        )}
      </div>

      <div className="content">
        {loading ? <div className="spinner" /> : stats ? (
          <>
            <div className="section-title">סטטיסטיקות עונה</div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-val" style={{ color:'#C9A84C' }}>{stats.exact}</div>
                <div className="stat-lbl">תוצאות מדויקות</div>
              </div>
              <div className="stat-card">
                <div className="stat-val" style={{ color:'#2e7d32' }}>{stats.dir}</div>
                <div className="stat-lbl">כיוון נכון</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{stats.total}</div>
                <div className="stat-lbl">סה״כ נקודות</div>
              </div>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-val">{stats.played}</div>
                <div className="stat-lbl">ניחושים</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{pct}%</div>
                <div className="stat-lbl">אחוז הצלחה</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{stats.played > 0 ? (stats.total / stats.played).toFixed(1) : '0'}</div>
                <div className="stat-lbl">נק׳ לניחוש</div>
              </div>
            </div>
          </>
        ) : null}

        <div className="section-title" style={{ marginTop:8 }}>הזמן חברים</div>
        <div className="invite-box">
          <p style={{ fontSize:13, color:'#666', marginBottom:8 }}>שתף קישור זה כדי שחברים יוכלו להצטרף לליגה</p>
          <div className="invite-code">LL2526</div>
          <button className="btn btn-outline btn-sm" onClick={copyInvite}>
            {copied ? '✓ הועתק!' : '📋 העתק קישור'}
          </button>
        </div>

        <div className="section-title" style={{ marginTop:16 }}>חוקים</div>
        <div className="card-section" style={{ fontSize:13, lineHeight:1.8 }}>
          <div style={{ display:'flex', gap:10, marginBottom:8, alignItems:'center' }}>
            <span style={{ width:28, height:28, borderRadius:'50%', background:'#fff8e8', color:'#C9A84C', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, flexShrink:0 }}>3</span>
            <span>תוצאה מדויקת — ניחשת 2:1 ויצא 2:1</span>
          </div>
          <div style={{ display:'flex', gap:10, marginBottom:8, alignItems:'center' }}>
            <span style={{ width:28, height:28, borderRadius:'50%', background:'#e8f5e9', color:'#2e7d32', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, flexShrink:0 }}>1</span>
            <span>כיוון נכון — ניצחון/תיקו/הפסד נכון, תוצאה שגויה</span>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ width:28, height:28, borderRadius:'50%', background:'#f0f0f0', color:'#999', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, flexShrink:0 }}>0</span>
            <span>ניחוש שגוי לחלוטין</span>
          </div>
          <div style={{ marginTop:12, padding:'10px', background:'#fff3e0', borderRadius:8, fontSize:12, color:'#e65100' }}>
            🔒 ניחושים ננעלים שעה לפני תחילת כל משחק
          </div>
        </div>

        <button className="btn btn-outline btn-full" style={{ marginTop:16, color:'#c62828', borderColor:'#f0c4c4' }}
          onClick={() => signOut()}>
          התנתקות
        </button>
      </div>
    </div>
  )
}
