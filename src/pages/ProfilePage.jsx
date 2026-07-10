import { useState, useEffect, useRef } from 'react'
import { supabase, signOut, getMyStats, uploadAvatar, updateProfile, submitFeedback, getAdminFeedback, markFeedbackRead, getMyHistory } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { calcPoints } from '../lib/teams'

const ADMIN_EMAIL = 'mikaswiftt@gmail.com'

function FeedbackModal({ user, profile, onClose }) {
  const [msg, setMsg]       = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent]     = useState(false)
  const [err, setErr]       = useState(null)

  async function send() {
    if (!msg.trim()) return
    setSending(true)
    setErr(null)
    try {
      await submitFeedback(msg.trim())
      setSent(true)
    } catch (e) { setErr('שגיאה בשליחה, נסה שוב') }
    setSending(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ padding:'28px 24px', maxWidth:380, textAlign:'center' }} onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>✕</button>
        {sent ? (
          <div style={{ padding:'20px 0' }}>
            <div style={{ fontSize:40 }}>✅</div>
            <div style={{ fontSize:17, fontWeight:700, color:'#00E676', marginTop:12 }}>תודה על הפידבק!</div>
            <div style={{ fontSize:14, color:'#7060A0', marginTop:8 }}>ההודעה נשלחה ל-FRIEREN</div>
            <button className="btn btn-gold" style={{ marginTop:20 }} onClick={onClose}>סגור</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize:18, fontWeight:800, color:'#FDB927', marginBottom:6 }}>📨 שלח פידבק</div>
            <div style={{ fontSize:14, color:'#7060A0', marginBottom:16 }}>באג? הצעה? כתוב כאן ונתייחס. תודה ❤️</div>
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder="תאר את הבעיה או ההצעה..."
              rows={5}
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(253,185,39,0.2)', borderRadius:10, padding:'10px 12px', color:'#F0EDFF', fontSize:14, resize:'vertical', fontFamily:'inherit', direction:'rtl', boxSizing:'border-box', textAlign:'center' }}
            />
            {err && <div style={{ fontSize:12, color:'#FF4444', marginTop:6 }}>{err}</div>}
            <button
              className="btn btn-gold btn-full"
              style={{ marginTop:16 }}
              disabled={sending || !msg.trim()}
              onClick={send}
            >
              {sending ? 'שולח...' : 'שלח'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function AdminFeedbackPanel() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen]       = useState(false)

  async function load() {
    setLoading(true)
    try { setItems(await getAdminFeedback()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleRead(id) {
    await markFeedbackRead(id)
    setItems(prev => prev.map(x => x.id === id ? { ...x, read: true } : x))
  }

  const unread = items.filter(x => !x.read).length

  return (
    <div className="card" style={{ marginTop:16, border:'1px solid rgba(253,185,39,0.3)' }}>
      <div
        style={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}
        onClick={() => { setOpen(o => !o); if (!open) load() }}
      >
        <span style={{ fontWeight:800, color:'#FDB927', fontSize:14 }}>📬 פידבק ממשתמשים</span>
        <span style={{ display:'flex', gap:8, alignItems:'center' }}>
          {unread > 0 && <span style={{ background:'#FF4444', color:'#fff', borderRadius:20, fontSize:10, fontWeight:800, padding:'2px 7px' }}>{unread}</span>}
          <span style={{ color:'#7060A0', fontSize:13 }}>{open ? '▲' : '▼'}</span>
        </span>
      </div>
      {open && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', maxHeight:400, overflowY:'auto' }}>
          {loading ? <div className="spinner" style={{ margin:'16px auto' }} /> :
           items.length === 0 ? <div style={{ padding:16, textAlign:'center', color:'#7060A0', fontSize:12 }}>אין פידבק עדיין</div> :
           items.map(item => {
             const d = new Date(item.created_at)
             const dateStr = d.toLocaleDateString('he-IL', { day:'numeric', month:'numeric' }) + ' ' + d.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' })
             return (
               <div key={item.id} style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)', background: item.read ? 'transparent' : 'rgba(253,185,39,0.04)' }}>
                 <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                   <span style={{ fontWeight:700, fontSize:13, color: item.read ? '#7060A0' : '#FDB927' }}>{item.display_name}</span>
                   <span style={{ fontSize:10, color:'#7060A0' }}>{dateStr}</span>
                 </div>
                 {item.user_email && <div style={{ fontSize:11, color:'#5588BB', marginBottom:5 }}>📧 {item.user_email}</div>}
                 <div style={{ fontSize:13, color:'#F0EDFF', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{item.message}</div>
                 {!item.read && (
                   <button
                     onClick={() => handleRead(item.id)}
                     style={{ marginTop:8, fontSize:10, color:'#7060A0', background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'2px 10px', cursor:'pointer' }}
                   >
                     ✓ סמן כנקרא
                   </button>
                 )}
               </div>
             )
           })
          }
        </div>
      )}
    </div>
  )
}

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

// Compute trophies from stats + history — milestones scale up once reached
function computeTrophies(stats, history) {
  if (!stats) return []
  const uniqueRounds = new Set(history.map(p => p.matches?.round).filter(Boolean)).size
  const jokerWins = history.filter(p => p.is_joker && (p.points ?? 0) >= 6).length
  const defs = [
    { id: 'sniper',  icon: '🎯', label: 'סנייפר',       descFn: t => `${t} תוצאות מדויקות`,  val: stats.exact,       ms: [10, 25, 50]    },
    { id: 'joker',   icon: '🃏', label: 'ג׳וקר מאסטר', descFn: t => `${t} ג׳וקרים מוצלחים`, val: jokerWins,         ms: [3, 7, 15]      },
    { id: 'iron',    icon: '🔩', label: 'הברזל',         descFn: t => `${t} מחזורים ברצף`,    val: uniqueRounds,      ms: [10, 20, 38]    },
    { id: 'penalty', icon: '⚽', label: 'הימוריאל',      descFn: t => `${t} פנדלים נכונים`,   val: stats.penaltyHits, ms: [5, 10, 20]     },
    { id: 'hundred', icon: '💯', label: 'מאה ניחושים',   descFn: t => `${t} ניחושים כולל`,    val: stats.played,      ms: [100, 200, 300] },
    { id: 'streak',  icon: '🔥', label: 'רצף להבה',      descFn: t => `סטרייק של ${t}`,       val: stats.maxStreak,   ms: [5, 8, 12]      },
  ]
  return defs.map(d => {
    const target = d.ms.find(m => m > d.val) ?? d.ms[d.ms.length - 1]
    const done   = d.val >= d.ms[d.ms.length - 1]
    return { id: d.id, icon: d.icon, label: d.label, desc: d.descFn(target), val: d.val, target, done }
  })
}

// Compute persona from history
function computePersona(stats, history) {
  if (!stats || history.length < 5) return null
  const jokerUses = history.filter(p => p.is_joker).length
  const exactRate = stats.played > 0 ? stats.exact / stats.played : 0
  if (exactRate > 0.28) return { icon: '🎯', label: 'הסנייפר',    desc: 'מדיוק גבוה מהממוצע' }
  if (jokerUses >= 3)   return { icon: '🃏', label: 'הגמבלר',     desc: 'לא מפחד לקחת סיכון' }
  if (stats.played > 30) return { icon: '🔩', label: 'הברזל',     desc: 'מחויבות מלאה לעונה' }
  if (stats.penaltyHits >= 2) return { icon: '⚽', label: 'מנחש הפנדלים', desc: 'חוש לריאל מדריד' }
  return { icon: '🎲', label: 'המהמר',      desc: 'סגנון חופשי' }
}

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const [stats, setStats]         = useState(null)
  const [history, setHistory]     = useState([])
  const [rank, setRank]           = useState(null)
  const [copied, setCopied]       = useState(false)
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const fileInputRef              = useRef()
  const isAdmin                   = user?.email === ADMIN_EMAIL

  useEffect(() => {
    async function load() {
      if (!user) return
      try {
        const [s, hist] = await Promise.all([
          getMyStats(user.id),
          getMyHistory(user.id),
        ])
        setStats(s)
        setHistory(hist)
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
    } catch (err) { console.error('Upload failed:', err) }
    setUploading(false)
  }

  function copyInvite() {
    navigator.clipboard.writeText(window.location.origin).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'שחקן'
  const pct = stats && stats.played > 0 ? Math.round(((stats.exact + stats.dir) / stats.played) * 100) : 0
  const lateGoalPtsLost = history.reduce((total, p) => {
    const s90 = p.matches?.score_90
    if (!s90) return total
    const wouldBeExact = p.home_guess === s90.home && p.away_guess === s90.away
    if (!wouldBeExact) return total
    const resultChanged = p.home_guess !== p.matches.home_score || p.away_guess !== p.matches.away_score
    if (!resultChanged) return total
    const wouldHaveGot = calcPoints(p.home_guess, p.away_guess, s90.home, s90.away, p.is_joker, p.matches.is_special, p.matches.round, 0)
    return total + Math.max(0, wouldHaveGot - (p.points ?? 0))
  }, 0)

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
                <div className="stat-val" style={{ color:'#00BCD4' }}>{stats.penaltyHits}</div>
                <div className="stat-lbl">פנדלים 🎯</div>
              </div>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-val">{stats.total}</div>
                <div className="stat-lbl">ניקוד כולל</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{pct}%</div>
                <div className="stat-lbl">% הצלחה</div>
              </div>
              <div className="stat-card">
                <div className="stat-val" style={{ color:'#FF4444' }}>{lateGoalPtsLost > 0 ? `💀${lateGoalPtsLost}` : '—'}</div>
                <div className="stat-lbl">איבוד נקודות בתוספת</div>
              </div>
            </div>
          </>
        ) : null}

        {stats && history.length > 0 && (() => {
          const trophies = computeTrophies(stats, history)
          return (
            <>
              {/* Streak shield status */}
              <div className="shield-status-row">
                <span>🛡️ מגן סטרייק</span>
                <span className={`shield-status-val${profile?.streak_shield === false ? ' used' : ''}`}>
                  {profile?.streak_shield === false ? 'נוצל' : 'זמין'}
                </span>
              </div>

              {/* Trophies */}
              <div className="section-title">הישגים</div>
              <div className="trophies-grid">
                {trophies.map(t => {
                  const pct = Math.min(100, Math.round((t.val / t.target) * 100))
                  return (
                    <div key={t.id} className={`trophy-card${t.done ? ' done' : ''}`}>
                      <div className="trophy-icon">{t.icon}</div>
                      <div className="trophy-label">{t.label}</div>
                      <div className="trophy-desc">{t.desc}</div>
                      <div className="trophy-bar-wrap">
                        <div className="trophy-bar" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="trophy-progress">{t.val}/{t.target}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )
        })()}

        <div className="section-title" style={{ marginTop:8 }}>הזמן חברים</div>
        <div className="invite-box">
          <p style={{ fontSize:13, color:'#7060A0', marginBottom:8 }}>שתף קישור זה כדי שחברים יוכלו להצטרף לליגה</p>
          <div className="invite-code" style={{ fontSize:12, wordBreak:'break-all', userSelect:'all', letterSpacing:0 }}>{window.location.origin}</div>
          <button className="btn btn-outline btn-sm" onClick={copyInvite}>
            {copied ? '✓ הועתק!' : '📋 העתק קישור'}
          </button>
        </div>

        <div className="beta-box">
          <div className="beta-box-title">🧪 גרסת BETA</div>
          <div className="beta-box-text">
            האפליקציה נמצאת בפיתוח פעיל. נתקלת בבאג או יש לך הצעה לשיפור?
          </div>
          <button className="beta-box-link" style={{ cursor:'pointer', background:'none' }} onClick={() => setShowFeedback(true)}>
            📨 שלח פידבק
          </button>
        </div>

        {isAdmin && <AdminFeedbackPanel />}

        <button className="btn btn-outline btn-full" style={{ marginTop:12, color:'#FF4444', borderColor:'rgba(255,68,68,0.3)' }}
          onClick={() => signOut()}>
          התנתקות
        </button>
      </div>

      {showFeedback && <FeedbackModal user={user} profile={profile} onClose={() => setShowFeedback(false)} />}
    </div>
  )
}
