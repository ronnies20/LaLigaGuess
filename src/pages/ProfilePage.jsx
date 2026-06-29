import { useState, useEffect, useRef } from 'react'
import { supabase, signOut, getMyStats, uploadAvatar, updateProfile } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const BARCA_AVATARS = [
  { name: 'Pedri',       num: 8,  bg: 'linear-gradient(135deg, #004D98 50%, #A50044 50%)' },
  { name: 'Yamal',       num: 27, bg: 'linear-gradient(135deg, #A50044 40%, #FDB927 100%)' },
  { name: 'Lewandowski', num: 9,  bg: 'linear-gradient(135deg, #004D98, #1a5c2a)' },
  { name: 'Gavi',        num: 6,  bg: 'linear-gradient(135deg, #6B0040, #004D98)' },
  { name: 'De Jong',     num: 21, bg: 'linear-gradient(135deg, #FF6B00, #004D98)' },
  { name: 'Raphinha',    num: 11, bg: 'linear-gradient(135deg, #00883A, #A50044)' },
]

function getBarcaAvatar(userId) {
  if (!userId) return BARCA_AVATARS[0]
  const hash = [...userId].reduce((a, c) => a + c.charCodeAt(0), 0)
  return BARCA_AVATARS[hash % BARCA_AVATARS.length]
}

function PlayerAvatar({ profile, size = 50, onClick }) {
  const av = getBarcaAvatar(profile?.id)
  if (profile?.avatar_url) {
    return (
      <div style={{ position:'relative', width:size, height:size, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
        <img src={profile.avatar_url} alt="avatar"
          style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(253,185,39,0.4)', boxShadow:'0 0 16px rgba(253,185,39,0.4)' }} />
        {onClick && <CameraOverlay />}
      </div>
    )
  }
  return (
    <div
      style={{ position:'relative', width:size, height:size, borderRadius:'50%', background:av.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', color:'#fff', fontWeight:800, boxShadow:'0 0 18px rgba(253,185,39,0.4)', border:'2px solid rgba(253,185,39,0.3)', cursor: onClick ? 'pointer' : 'default', flexShrink:0 }}
      onClick={onClick}
    >
      <span style={{ fontSize: size * 0.34, lineHeight:1 }}>{av.num}</span>
      <span style={{ fontSize: size * 0.14, opacity:0.85, letterSpacing:0.5, marginTop:1 }}>{av.name.toUpperCase()}</span>
      {onClick && <CameraOverlay />}
    </div>
  )
}

function CameraOverlay() {
  return (
    <div style={{ position:'absolute', bottom:0, right:0, background:'rgba(253,185,39,0.92)', borderRadius:'50%', width:20, height:20, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, boxShadow:'0 0 6px rgba(0,0,0,0.4)' }}>
      📷
    </div>
  )
}

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const [stats, setStats]       = useState(null)
  const [rank, setRank]         = useState(null)
  const [copied, setCopied]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef            = useRef()

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

  async function handleAvatarUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadAvatar(file, user.id)
      await updateProfile(user.id, { avatar_url: url })
      refreshProfile()
    } catch (err) {
      console.error('Upload failed:', err)
    }
    setUploading(false)
  }

  function copyInvite() {
    navigator.clipboard.writeText(window.location.origin).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'שחקן'
  const pct = stats && stats.played > 0 ? Math.round(((stats.exact + stats.dir) / stats.played) * 100) : 0

  return (
    <div className="page">
      <div style={{ background:'linear-gradient(135deg, #0C0625 0%, #1A0850 100%)', padding:'20px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:10, borderBottom:'1px solid rgba(253,185,39,0.2)' }}>
        <PlayerAvatar
          profile={profile}
          size={60}
          onClick={() => !uploading && fileInputRef.current?.click()}
        />
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatarUpload} />
        {uploading && <div style={{ fontSize:11, color:'#A07FCC' }}>מעלה תמונה...</div>}
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#FDB927' }}>{displayName}</div>
        </div>
        {rank && (
          <div style={{ background:'rgba(253,185,39,0.1)', border:'1px solid rgba(253,185,39,0.3)', borderRadius:10, padding:'6px 20px', textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:800, color:'#FDB927', textShadow:'0 0 12px rgba(253,185,39,0.5)' }}>#{rank}</div>
            <div style={{ fontSize:10, color:'#7060A0', fontWeight:600, letterSpacing:1 }}>דירוג</div>
          </div>
        )}
      </div>

      <div className="content">
        {loading ? <div className="spinner" /> : stats ? (
          <>
            <div className="section-title">סטטיסטיקות עונה</div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-val" style={{ color:'#00E676' }}>{stats.exact}</div>
                <div className="stat-lbl">מדויקות</div>
              </div>
              <div className="stat-card">
                <div className="stat-val" style={{ color:'#FDB927' }}>{stats.dir}</div>
                <div className="stat-lbl">כיוון נכון</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{stats.total}</div>
                <div className="stat-lbl">סה״כ נק׳</div>
              </div>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-val">{stats.played}</div>
                <div className="stat-lbl">ניחושים</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{pct}%</div>
                <div className="stat-lbl">% הצלחה</div>
              </div>
              <div className="stat-card">
                <div className="stat-val" style={{ color:'#ff6600' }}>{stats.maxStreak > 0 ? `🔥${stats.maxStreak}` : '—'}</div>
                <div className="stat-lbl">סטרייק מקסימלי</div>
              </div>
            </div>
          </>
        ) : null}

        <div className="section-title" style={{ marginTop:8 }}>הזמן חברים</div>
        <div className="invite-box">
          <p style={{ fontSize:13, color:'#7060A0', marginBottom:8 }}>שתף קישור זה כדי שחברים יוכלו להצטרף לליגה</p>
          <div className="invite-code" style={{ fontSize:12, wordBreak:'break-all', userSelect:'all', letterSpacing:0 }}>{window.location.origin}</div>
          <button className="btn btn-outline btn-sm" onClick={copyInvite}>
            {copied ? '✓ הועתק!' : '📋 העתק קישור'}
          </button>
        </div>

        <div className="section-title" style={{ marginTop:16 }}>חוקים</div>
        <div className="card-section" style={{ fontSize:13, lineHeight:1.8 }}>
          <div style={{ display:'flex', gap:10, marginBottom:10, alignItems:'center' }}>
            <span style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#00C853,#00E676)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0, boxShadow:'0 0 12px rgba(0,230,118,0.5)' }}>3</span>
            <span style={{ color:'#EEEEFF', textAlign:'center', flex:1 }}>תוצאה מדויקת — ניחשת 2:1 ויצא 2:1</span>
          </div>
          <div style={{ display:'flex', gap:10, marginBottom:10, alignItems:'center' }}>
            <span style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#FFE566,#C4901A)', color:'#000', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0, boxShadow:'0 0 12px rgba(253,185,39,0.5)' }}>1</span>
            <span style={{ color:'#EEEEFF', textAlign:'center', flex:1 }}>כיוון נכון — ניצחון/תיקו/הפסד נכון, תוצאה שגויה</span>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,23,68,0.15)', color:'#FF1744', border:'1px solid rgba(255,23,68,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0 }}>0</span>
            <span style={{ color:'#7060A0', textAlign:'center', flex:1 }}>ניחוש שגוי לחלוטין</span>
          </div>
          <div style={{ marginTop:12, padding:'10px 12px', background:'rgba(255,100,0,0.08)', borderRadius:8, fontSize:12, color:'#FF7A00', border:'1px solid rgba(255,100,0,0.15)', textAlign:'center' }}>
            🔒 ניחושים ננעלים 5 דקות לפני תחילת כל משחק
          </div>
        </div>

        <button className="btn btn-outline btn-full" style={{ marginTop:16, color:'#FF4444', borderColor:'rgba(255,68,68,0.3)' }}
          onClick={() => signOut()}>
          התנתקות
        </button>
      </div>
    </div>
  )
}
