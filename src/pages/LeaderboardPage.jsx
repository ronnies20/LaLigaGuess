import { useState, useEffect } from 'react'
import { supabase, getCurrentRound, getRoundMessages, getPlayerHistory, getLiveMatchGuesses } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { getTeamInfo, LIVE_STATUSES } from '../lib/teams'

const COLORS = ['#004D9E','#00883A','#CE1021','#534AB7','#C9A84C','#EF7D00','#005AA7','#D4002A','#6A0DAD','#0F6E56']
const BGS    = ['#e8f0ff','#e8f8ee','#ffe8ea','#EEEDFE','#fff8e8','#fff3e0','#e8f0ff','#ffe8ea','#f0e8ff','#e1f5ee']

function initial(name) { return name ? name[0].toUpperCase() : '?' }

function getLiveColor(guess, matchInfo) {
  if (!matchInfo || matchInfo.home_score === null || matchInfo.away_score === null) return '#7060A0'
  if (guess.h === matchInfo.home_score && guess.a === matchInfo.away_score) return '#00E676'
  const gDir = Math.sign(guess.h - guess.a)
  const lDir = Math.sign(matchInfo.home_score - matchInfo.away_score)
  if (gDir === lDir) return '#FDB927'
  return '#FF4444'
}

function PtsBadge({ pts, isJoker }) {
  if (pts === null || pts === undefined) return <span className="hst-pts-none">?</span>
  if (isJoker && pts >= 6)  return <span className="hst-pts-exact">🃏{pts}</span>
  if (isJoker && pts < 0)   return <span className="hst-pts-miss">🃏{pts}</span>
  if (pts >= 5)             return <span className="hst-pts-exact">🔥{pts}</span>
  if (pts === 3)            return <span className="hst-pts-exact">{pts}</span>
  if (pts === 2)            return <span className="hst-pts-dir">⭐{pts}</span>
  if (pts === 1)            return <span className="hst-pts-dir">{pts}</span>
  return <span className="hst-pts-miss">{pts}</span>
}

function PlayerHistoryModal({ player, onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPlayerHistory(player.user_id)
      .then(data => { setHistory(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [player.user_id])

  const total = history.reduce((s, p) => s + (p.points ?? 0) + (p.penalty_bonus ?? 0), 0)
  const exact = history.filter(p => p.home_guess === p.matches.home_score && p.away_guess === p.matches.away_score).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card history-modal" onClick={e => e.stopPropagation()}>
        <div className="history-header">
          <div className="history-avatar">
            {player.avatar_url
              ? <img src={player.avatar_url} alt={player.display_name} />
              : initial(player.display_name)}
          </div>
          <div>
            <div className="history-name">{player.display_name}</div>
            <div className="history-summary">{total} נק׳ · {exact} מדויקים · {history.length} משחקים</div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="spinner" style={{ margin: '24px auto' }} />
        ) : history.length === 0 ? (
          <div className="empty" style={{ padding: '24px' }}>אין ניחושים עדיין</div>
        ) : (
          <div className="history-list">
            {history.map((p, i) => {
              const m = p.matches
              const homeInfo = getTeamInfo(m.home_team)
              const awayInfo = getTeamInfo(m.away_team)
              const isExact  = p.home_guess === m.home_score && p.away_guess === m.away_score
              const guessDir = Math.sign(p.home_guess - p.away_guess)
              const realDir  = Math.sign(m.home_score - m.away_score)
              const isDir    = !isExact && guessDir === realDir
              const rowCls   = isExact ? 'hst-exact' : isDir ? 'hst-dir' : 'hst-miss'
              const d = new Date(m.kickoff)
              const dateStr = d.toLocaleDateString('he-IL', { day:'numeric', month:'numeric' })
              return (
                <div key={i} className={`history-row ${rowCls}`}>
                  <div className="history-round">מ{m.round}</div>
                  <div className="history-teams">
                    <span className="history-team" style={{ color: homeInfo.color }}>{homeInfo.short}</span>
                    <div className="history-scores">
                      <span className="hst-result">{m.home_score}:{m.away_score}</span>
                      <span className="hst-guess">{p.home_guess}:{p.away_guess}{p.is_joker ? ' 🃏' : ''}</span>
                    </div>
                    <span className="history-team" style={{ color: awayInfo.color }}>{awayInfo.short}</span>
                  </div>
                  <div className="history-pts-col">
                    <PtsBadge pts={p.points} isJoker={p.is_joker} />
                    {(p.penalty_bonus ?? 0) > 0 && <span className="hst-pen-bonus">+{p.penalty_bonus}🎯</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [view, setView]         = useState('season')
  const [rows, setRows]         = useState([])
  const [streaks, setStreaks]   = useState({})
  const [messages, setMessages] = useState({})
  const [penCounts, setPenCounts] = useState({})
  const [loading, setLoading]   = useState(true)
  const [round, setRound]       = useState(null)
  const [currentRound, setCurrentRound] = useState(null)
  const [refreshKey, setRefreshKey]     = useState(0)
  const [liveMatches, setLiveMatches]   = useState([])
  const [liveGuesses, setLiveGuesses]   = useState({})
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  useEffect(() => {
    getCurrentRound()
      .then(r => { setRound(r); setCurrentRound(r) })
      .catch(() => { setRound(1); setCurrentRound(1) })
  }, [])

  useEffect(() => { if (round !== null) loadData() }, [view, round, refreshKey])

  useEffect(() => {
    const channel = supabase.channel('lb-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'predictions' }, () => {
        setRefreshKey(k => k + 1)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, payload => {
        const status = payload.new?.status
        if (status && (LIVE_STATUSES.includes(status) || status === 'FT' || status === 'AET' || status === 'PEN')) {
          setRefreshKey(k => k + 1)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function loadData() {
    setLoading(true)
    setStreaks({})
    try {
      // Live matches
      const { data: liveMData } = await supabase
        .from('matches')
        .select('id, home_team, away_team, home_score, away_score, status')
        .in('status', LIVE_STATUSES)
      setLiveMatches(liveMData || [])
      if (liveMData?.length) {
        const livePreds = await getLiveMatchGuesses(liveMData.map(m => m.id))
        const lg = {}
        livePreds.forEach(p => {
          if (!lg[p.user_id]) lg[p.user_id] = []
          const matchInfo = liveMData.find(m => m.id === p.match_id)
          lg[p.user_id].push({ matchId: p.match_id, h: p.home_guess, a: p.away_guess, joker: p.is_joker, matchInfo })
        })
        setLiveGuesses(lg)
      } else {
        setLiveGuesses({})
      }

      // Penalty hits per user
      const { data: penData } = await supabase
        .from('predictions')
        .select('user_id')
        .gt('penalty_bonus', 0)
      const pc = {}
      penData?.forEach(p => { pc[p.user_id] = (pc[p.user_id] || 0) + 1 })
      setPenCounts(pc)

      if (view === 'season') {
        const [{ data }, { data: streakData }, msgs] = await Promise.all([
          supabase.from('leaderboard_view').select('*').order('total_points', { ascending: false }).limit(100),
          supabase.from('current_streak_view').select('user_id, current_streak'),
          currentRound ? getRoundMessages(currentRound) : Promise.resolve([]),
        ])
        setRows(data || [])
        const sm = {}
        streakData?.forEach(r => { sm[r.user_id] = r.current_streak })
        setStreaks(sm)
        const mm = {}
        msgs?.forEach(m => { mm[m.user_id] = m.message })
        setMessages(mm)
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
  const hasLive = liveMatches.length > 0

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

        {hasLive && (
          <div className="live-banner">
            {liveMatches.map(m => (
              <span key={m.id} className="live-banner-match">
                🔴 {getTeamInfo(m.home_team).short} {m.home_score}:{m.away_score} {getTeamInfo(m.away_team).short}
              </span>
            ))}
          </div>
        )}

        <div className="card">
          <div className={`lb-header${hasLive ? ' has-live' : ''}`}>
            <div style={{textAlign:'center'}}>מיקום</div>
            <div>שחקן</div>
            {hasLive && <div style={{textAlign:'center', fontSize:10}}>🔴 ניחוש</div>}
            <div style={{textAlign:'center'}}>מדויק</div>
            <div style={{textAlign:'center'}}>כיוון</div>
            <div style={{textAlign:'center', fontSize:9, lineHeight:1.2}}>פנדל<br/>לריאל</div>
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
            const userLive = liveGuesses[r.user_id] || []
            const penHits  = penCounts[r.user_id] || 0

            return (
              <div
                key={r.user_id}
                className={`lb-row${isMe?' me':''} lb-row-clickable${hasLive?' has-live':''}`}
                onClick={() => setSelectedPlayer(r)}
              >
                <div className={`lb-rank${i<3?' g'+(i+1):''}`}>{medal || (i+1)}</div>

                <div className="lb-user">
                  <div className="lb-avatar" style={{ background:BGS[colorIdx], color:COLORS[colorIdx], overflow:'hidden', padding:0 }}>
                    {r.avatar_url
                      ? <img src={r.avatar_url} alt={r.display_name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                      : initial(r.display_name)
                    }
                  </div>
                  <div className="lb-user-info">
                    <div className="lb-name">{r.display_name}{r.display_name === 'CAT' && ' 🤖'}</div>
                    {view === 'season' && messages[r.user_id] && (
                      <div className="lb-trash">💬 {messages[r.user_id]}</div>
                    )}
                    {streak >= 3 && <div className="lb-streak-badge">🔥 {streak}</div>}
                  </div>
                </div>

                {hasLive && (
                  <div className="lb-live-col">
                    {userLive.length > 0 ? userLive.map((g, gi) => {
                      const color = getLiveColor(g, g.matchInfo)
                      return (
                        <div key={gi} className="lb-live-cell" style={{ color, borderColor: color }}>
                          {g.h}:{g.a}
                          {g.joker && <span style={{ fontSize:9, marginRight:2 }}>🃏</span>}
                        </div>
                      )
                    }) : (
                      <div className="lb-live-cell lb-live-empty">—</div>
                    )}
                  </div>
                )}

                <div className="lb-num">{ex(r) ?? 0}</div>
                <div className="lb-num">{dir(r) ?? 0}</div>
                <div className="lb-num" style={{ color: penHits > 0 ? '#00BCD4' : undefined }}>
                  {penHits}
                </div>
                <div className="lb-pts">{pts(r) ?? 0}</div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedPlayer && (
        <PlayerHistoryModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  )
}
