import { useState, useEffect } from 'react'
import { supabase, getCurrentRound } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const COLORS = ['#004D9E','#00883A','#CE1021','#534AB7','#C9A84C','#EF7D00','#005AA7','#D4002A','#6A0DAD','#0F6E56']
const BGS    = ['#e8f0ff','#e8f8ee','#ffe8ea','#EEEDFE','#fff8e8','#fff3e0','#e8f0ff','#ffe8ea','#f0e8ff','#e1f5ee']

function initial(name) { return name ? name[0].toUpperCase() : '?' }


export default function LeaderboardPage() {
  const { user } = useAuth()
  const [view, setView]       = useState('season')
  const [rows, setRows]       = useState([])
  const [streaks, setStreaks] = useState({})
  const [loading, setLoading] = useState(true)
  const [round, setRound]     = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    getCurrentRound().then(r => setRound(r)).catch(() => setRound(1))
  }, [])

  useEffect(() => { if (round !== null) loadData() }, [view, round, refreshKey])

  useEffect(() => {
    const channel = supabase
      .channel('lb-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'predictions' }, () => {
        setRefreshKey(k => k + 1)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function loadData() {
    setLoading(true)
    setStreaks({})
    try {
      if (view === 'season') {
        const [{ data }, { data: streakData }] = await Promise.all([
          supabase.from('leaderboard_view').select('*').order('total_points', { ascending: false }).limit(100),
          supabase.from('current_streak_view').select('user_id, current_streak'),
        ])
        setRows(data || [])
        const sm = {}
        streakData?.forEach(r => { sm[r.user_id] = r.current_streak })
        setStreaks(sm)
      } else {
        const { data } = await supabase
          .from('round_leaderboard_view')
          .select('*')
          .eq('round', round)
          .order('round_points', { ascending: false })
          .limit(100)
        setRows(data || [])
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const pts  = r => view === 'season' ? r.total_points    : r.round_points
  const ex   = r => view === 'season' ? r.exact_count     : r.round_exact
  const dir  = r => view === 'season' ? r.direction_count : r.round_direction

  return (
    <div className="page">
      <div className="content">
        <div className="toggle-row">
          <button className={`toggle-btn${view==='season'?' active':''}`} onClick={() => setView('season')}>עונה שלמה</button>
          <button className={`toggle-btn${view==='round'?' active':''}`} onClick={() => setView('round')}>לפי מחזור</button>
        </div>

        {view === 'round' && (
          <div className="round-nav" style={{ marginBottom:'12px' }}>
            <button className="round-nav-btn" onClick={() => setRound(r => r <= 1 ? 38 : r - 1)}>‹</button>
            <div className="round-label">מחזור {round}</div>
            <button className="round-nav-btn" onClick={() => setRound(r => r >= 38 ? 1 : r + 1)}>›</button>
          </div>
        )}

        <div className="card">
          <div className="lb-header">
            <div style={{textAlign:'center'}}>מיקום</div>
            <div>שחקן</div>
            <div style={{textAlign:'center'}}>מדויק</div>
            <div style={{textAlign:'center'}}>כיוון</div>
            <div style={{textAlign:'center'}}>נק׳</div>
          </div>
          {loading ? (
            <div className="spinner" />
          ) : rows.length === 0 ? (
            <div className="empty">אין נתונים עדיין</div>
          ) : rows.map((r, i) => {
            const isMe     = r.user_id === user?.id
            const colorIdx = i % COLORS.length
            const medal    = i===0?'🥇':i===1?'🥈':i===2?'🥉':null
            const streak   = view === 'season' ? (streaks[r.user_id] ?? 0) : 0
            return (
              <div key={r.user_id} className={`lb-row${isMe?' me':''}`}>
                <div className={`lb-rank${i<3?' g'+(i+1):''}`}>{medal || (i+1)}</div>
                <div className="lb-user">
                  <div className="lb-avatar" style={{ background:BGS[colorIdx], color:COLORS[colorIdx], overflow:'hidden', padding:0 }}>
                    {r.avatar_url
                      ? <img src={r.avatar_url} alt={r.display_name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                      : initial(r.display_name)
                    }
                  </div>
                  <div className="lb-name">{r.display_name}{r.display_name === 'CAT' && ' 🤖'}</div>
                  {streak >= 3 && <div className="lb-streak-badge">🔥 {streak}</div>}
                </div>
                <div className="lb-num">{ex(r) ?? 0}</div>
                <div className="lb-num">{dir(r) ?? 0}</div>
                <div className="lb-pts">{pts(r) ?? 0}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
