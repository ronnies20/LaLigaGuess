import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { CURRENT_ROUND } from '../lib/teams'

const COLORS = ['#004D9E','#00883A','#CE1021','#534AB7','#C9A84C','#EF7D00','#005AA7','#D4002A','#6A0DAD','#0F6E56']
const BGS    = ['#e8f0ff','#e8f8ee','#ffe8ea','#EEEDFE','#fff8e8','#fff3e0','#e8f0ff','#ffe8ea','#f0e8ff','#e1f5ee']

function initial(name) { return name ? name[0].toUpperCase() : '?' }

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [view, setView]       = useState('season')
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [round, setRound]     = useState(CURRENT_ROUND)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => { loadData() }, [view, round, refreshKey])

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
    try {
      if (view === 'season') {
        const { data } = await supabase
          .from('leaderboard_view')
          .select('*')
          .order('total_points', { ascending: false })
          .limit(100)
        setRows(data || [])
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

  const pts  = r => view === 'season' ? r.total_points  : r.round_points
  const ex   = r => view === 'season' ? r.exact_count   : r.round_exact
  const dir  = r => view === 'season' ? r.direction_count : r.round_direction

  const myIdx = rows.findIndex(r => r.user_id === user?.id)

  return (
    <div className="page">
      <div className="content">
        <div className="toggle-row">
          <button className={`toggle-btn${view==='season'?' active':''}`} onClick={() => setView('season')}>עונה שלמה</button>
          <button className={`toggle-btn${view==='round'?' active':''}`} onClick={() => setView('round')}>לפי מחזור</button>
        </div>

        {view === 'round' && (
          <div className="round-nav" style={{ marginBottom:'12px' }}>
            <button className="round-nav-btn" onClick={() => setRound(r => r-1)} disabled={round<=1}>‹</button>
            <div className="round-label">מחזור {round}</div>
            <button className="round-nav-btn" onClick={() => setRound(r => r+1)} disabled={round>=38}>›</button>
          </div>
        )}

        <div className="card">
          <div className="lb-header">
            <div></div>
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
            const isMe = r.user_id === user?.id
            const colorIdx = i % COLORS.length
            const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':null
            return (
              <div key={r.user_id} className={`lb-row${isMe?' me':''}`}>
                <div className={`lb-rank${i<3?' g'+(i+1):''}`}>{medal || (i+1)}</div>
                <div className="lb-user">
                  <div className="lb-avatar" style={{ background:BGS[colorIdx], color:COLORS[colorIdx] }}>
                    {initial(r.display_name)}
                  </div>
                  <div className="lb-name">{r.display_name}{isMe ? ' (אני)' : ''}</div>
                </div>
                <div className="lb-num">{ex(r) ?? 0}</div>
                <div className="lb-num">{dir(r) ?? 0}</div>
                <div className="lb-pts">{pts(r) ?? 0}</div>
              </div>
            )
          })}
        </div>

        {myIdx > -1 && (
          <div style={{ textAlign:'center', fontSize:'12px', color:'#888', marginTop:'8px' }}>
            המיקום שלך: #{myIdx+1} מתוך {rows.length} שחקנים
          </div>
        )}
      </div>
    </div>
  )
}
