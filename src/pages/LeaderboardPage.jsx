import React, { useState, useEffect } from 'react'
import { supabase, getCurrentRound, getRoundMessages, getPlayerHistory, getLiveMatchGuesses, getPlayerRoundPredictions, getBonusBreakdown } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { getTeamInfo, getTeamLogoUrl, LIVE_STATUSES } from '../lib/teams'

function TeamLogo({ name, size = 22 }) {
  const t = getTeamInfo(name)
  const url = getTeamLogoUrl(t.logoId)
  const scale = t.logoScale ?? 1
  const imgSize = size * scale
  if (!url) return <span style={{ color: t.color, fontWeight: 700, fontSize: 11, width: size, textAlign: 'center', display: 'inline-block' }}>{t.short}</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0, overflow: 'hidden' }}>
      <img src={url} alt={t.short}
        style={{ width: imgSize, height: imgSize, objectFit: 'contain', flexShrink: 0, display: 'block' }}
        onError={e => { e.currentTarget.style.display = 'none' }} />
    </span>
  )
}

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
  if (isJoker && pts >= 6)  return <span className="hst-pts-exact">{pts}</span>
  if (isJoker && pts < 0)   return <span style={{ color: '#FF4444', fontWeight: 800, fontSize: 13 }}>{pts}</span>
  if (pts >= 5)             return <span className="hst-pts-exact">🔥{pts}</span>
  if (pts === 3)            return <span className="hst-pts-exact">{pts}</span>
  if (pts === 2)            return <span className="hst-pts-dir">⭐{pts}</span>
  if (pts === 1)            return <span className="hst-pts-dir">{pts}</span>
  return <span className="hst-pts-miss">{pts}</span>
}

function PlayerRoundModal({ player, round, onClose }) {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPlayerRoundPredictions(player.user_id, round)
      .then(d => { setPredictions(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [player.user_id, round])

  // Only show finished matches (have result, not live)
  const finished = predictions.filter(p =>
    p.matches.home_score !== null && !LIVE_STATUSES.includes(p.matches.status)
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card round-pred-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>✕</button>

        {/* Centered header */}
        <div className="rpm-header">
          <div className="history-avatar rpm-avatar">
            {player.avatar_url
              ? <img src={player.avatar_url} alt={player.display_name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
              : initial(player.display_name)}
          </div>
          <div className="rpm-name">{player.display_name}</div>
          <div className="rpm-pts-big">{player.round_points ?? 0} <span className="rpm-pts-label">נק׳</span></div>
          <div className="rpm-stats">
            מחזור {round} · {player.round_exact ?? 0} מדויקים
          </div>
        </div>

        {/* Column headers */}
        {!loading && finished.length > 0 && (
          <div className="rpm-finished-note">משחקים שהסתיימו בלבד</div>
          )}
        {!loading && finished.length > 0 && (
          <div className="rpm-col-header">
            <div className="rpm-ch-match">משחק</div>
            <div className="rpm-ch-guess">ניחוש</div>
            <div className="rpm-ch-result">תוצאה</div>
            <div className="rpm-ch-pts">נק׳</div>
          </div>
        )}

        {loading ? (
          <div className="spinner" style={{ margin: '24px auto' }} />
        ) : finished.length === 0 ? (
          <div className="rpm-empty">אין תוצאות סופיות עדיין</div>
        ) : (
          <div className="rpm-list">
            {finished.map((p, i) => {
              const m = p.matches
              const homeInfo = getTeamInfo(m.home_team)
              const awayInfo = getTeamInfo(m.away_team)
              const isExact = p.home_guess === m.home_score && p.away_guess === m.away_score
              const gDir = Math.sign(p.home_guess - p.away_guess)
              const rDir = Math.sign(m.home_score - m.away_score)
              const isDir = !isExact && gDir === rDir
              const guessColor = isExact ? '#00E676' : isDir ? '#FDB927' : '#FF5252'
              const hasPenalty = m.penalty_events?.length > 0 && p.penalty_min != null
              const penHit    = hasPenalty && (p.penalty_bonus ?? 0) > 0
              const penColor  = penHit ? '#00E676' : '#FF5252'
              const totalPts  = (p.points ?? 0) + (p.penalty_bonus ?? 0)
              return (
                <div key={i} className="rpm-row">
                  <div className="rpm-match">
                    <TeamLogo name={m.home_team} size={22} />
                    <span className="rpm-vs">-</span>
                    <TeamLogo name={m.away_team} size={22} />
                  </div>
                  <div className="rpm-guess-wrap">
                    {hasPenalty && (
                      <div className="rpm-pen-box" style={{ borderColor: penColor, color: penColor }}>
                        ⚡ {p.penalty_min}-{p.penalty_max}
                      </div>
                    )}
                    <div className="rpm-guess" style={{ color: guessColor, borderColor: `${guessColor}55` }}>
                      {p.home_guess}:{p.away_guess}{p.is_joker ? ' 🃏' : ''}
                    </div>
                  </div>
                  <div className="rpm-result">
                    {m.home_score}:{m.away_score}
                  </div>
                  <div className="rpm-pts-cell">
                    <PtsBadge pts={p.points} isJoker={p.is_joker} />
                    {hasPenalty && penHit && (
                      <span className="rpm-pen-bonus">+{p.penalty_bonus}</span>
                    )}
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

function BonusBreakdownModal({ data, onClose }) {
  const fmt = v => v > 0 ? `+${v}` : v < 0 ? `${v}` : '0'
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card bonus-breakdown-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>✕</button>
        <div className="bbm-title">בונוסים - {data.displayName}</div>
        {data.loading ? (
          <div className="spinner" style={{ margin: '24px auto' }} />
        ) : (
          <div className="bbm-rows">
            <div className="bbm-row">
              <span>⚽ פנדלים נכונים</span>
              <span className="bbm-pts">{fmt(data.penalty)} נק'</span>
            </div>
            <div className="bbm-row">
              <span>🃏 בונוס ג'וקר</span>
              <span className="bbm-pts">{fmt(data.joker)} נק'</span>
            </div>
            <div className="bbm-row">
              <span>🔥 בונוס סטרייק</span>
              <span className="bbm-pts">{fmt(data.streak)} נק'</span>
            </div>
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
  const [loading, setLoading]   = useState(true)
  const [round, setRound]       = useState(null)
  const [currentRound, setCurrentRound] = useState(null)
  const [refreshKey, setRefreshKey]     = useState(0)
  const [liveMatches, setLiveMatches]   = useState([])
  const [liveGuesses, setLiveGuesses]   = useState({})
  const [selectedPlayer, setSelectedPlayer]           = useState(null)
  const [selectedRoundPlayer, setSelectedRoundPlayer] = useState(null)
  const [bonusModal, setBonusModal]                   = useState(null)
  const [roundFinished, setRoundFinished]             = useState(false)
  const [roundStarted, setRoundStarted]               = useState(false)
  const [roundFinishedSeason, setRoundFinishedSeason] = useState(false)
  const [prevRanks, setPrevRanks]                     = useState({})

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


      if (view === 'season') {
        // Determine round timing window for trash talk visibility
        let started = false, seasonFinished = false
        let roundMatchData = null
        if (currentRound) {
          const { data: roundMatches } = await supabase
            .from('matches').select('id, kickoff, home_score, status')
            .eq('round', currentRound)
          roundMatchData = roundMatches
          if (roundMatches?.length) {
            const now = Date.now()
            const firstKickoff = Math.min(...roundMatches.map(m => new Date(m.kickoff).getTime()))
            started = firstKickoff <= now
            seasonFinished = roundMatches.every(m => m.status === 'FT')
          }
        }
        setRoundStarted(started)
        setRoundFinishedSeason(seasonFinished)

        const [{ data }, msgs] = await Promise.all([
          supabase.from('leaderboard_view').select('*').order('total_points', { ascending: false }).limit(100),
          (started && !seasonFinished && currentRound) ? getRoundMessages(currentRound) : Promise.resolve([]),
        ])
        setRows(data || [])
        const mm = {}
        msgs?.forEach(m => { mm[m.user_id] = m.message })
        setMessages(mm)
        try {
          const { data: streakData } = await supabase.from('current_streak_view').select('user_id, current_streak')
          const sm = {}
          streakData?.forEach(r => { sm[r.user_id] = r.current_streak })
          setStreaks(sm)
        } catch {}

        if (started && !seasonFinished && currentRound > 1 && roundMatchData?.length) {
          const matchIds = roundMatchData.map(m => m.id)
          const { data: crPreds } = await supabase
            .from('predictions')
            .select('user_id, points')
            .in('match_id', matchIds)
            .not('points', 'is', null)
          const crMap = {}
          ;(crPreds || []).forEach(p => {
            crMap[p.user_id] = (crMap[p.user_id] || 0) + (p.points || 0)
          })
          const prevTotals = (data || []).map(r => ({
            user_id: r.user_id,
            prevTotal: (r.total_points || 0) - (crMap[r.user_id] || 0),
          })).sort((a, b) => b.prevTotal - a.prevTotal)
          const pm = {}
          prevTotals.forEach((r, idx) => { pm[r.user_id] = idx + 1 })
          setPrevRanks(pm)
        } else {
          setPrevRanks({})
        }
      } else {
        const [{ data }, { data: roundMatches }] = await Promise.all([
          supabase.from('round_leaderboard_view').select('*').eq('round', round).order('round_points', { ascending: false }).limit(100),
          supabase.from('matches').select('home_score').eq('round', round),
        ])
        setRows(data || [])
        setRoundFinished(
          (roundMatches?.length ?? 0) > 0 && roundMatches.every(m => m.home_score !== null)
        )
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function handleBonusClick(r, bonus) {
    if (bonus === 0) return
    setBonusModal({ userId: r.user_id, displayName: r.display_name, loading: true })
    const breakdown = await getBonusBreakdown(r.user_id, view === 'round' ? round : null)
    setBonusModal({ userId: r.user_id, displayName: r.display_name, loading: false, ...breakdown })
  }

  const pts = r => view === 'season' ? r.total_points    : r.round_points
  const ex  = r => view === 'season' ? r.exact_count     : r.round_exact
  const dir = r => view === 'season' ? r.direction_count : r.round_direction

  const leaderPts   = rows.length > 0 ? pts(rows[0]) : 0
  const myIdx       = rows.findIndex(r => r.user_id === user?.id)
  const myRival     = myIdx > 0 ? rows[myIdx - 1] : null
  const myPts       = myIdx >= 0 ? pts(rows[myIdx]) : 0
  const rivalGap    = myRival ? pts(myRival) - myPts : 0
  const playerBelow = myIdx >= 0 && myIdx < rows.length - 1 ? rows[myIdx + 1] : null
  const gapBelow    = playerBelow !== null ? myPts - pts(playerBelow) : Infinity

  let smartBanner = null
  if (!loading && rows.length > 0) {
    if (leaderPts === 0) {
      smartBanner = (
        <div className="rival-banner" style={{ textAlign: 'center' }}>
          🔥 חממו מנועים... מי יהיה אלוף בארסה מאניה?
        </div>
      )
    } else if (myIdx === 0 && rows.length > 1) {
      smartBanner = (
        <div className="leader-banner">
          👑 אתה מוביל! <span className="banner-sep">|</span> {pts(rows[0]) - pts(rows[1])} נקודות על {rows[1].display_name}
        </div>
      )
    } else if (myIdx > 0) {
      if (rivalGap === 0) {
        smartBanner = (
          <div className="rival-banner" style={{ textAlign: 'center' }}>
            ✨ הטבלה צמודה - שולחת לך אבקת קסמים למזל
          </div>
        )
      } else if (rivalGap <= gapBelow) {
        smartBanner = (
          <div className="rival-banner">
            🎯 אתה רחוק רק <strong>{rivalGap}</strong> נקודות ממקום <strong>{myIdx}</strong>
          </div>
        )
      } else {
        smartBanner = (
          <div className="closing-in-banner">
            ⚠️ <strong>{playerBelow.display_name}</strong> - רק {gapBelow} נקודות מאחוריך!
          </div>
        )
      }
    }
  }

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

        {view === 'season' && smartBanner}

<div className="card lb-card">
          <div className="lb-header">
            <div style={{textAlign:'center'}}>מיקום</div>
            <div>שחקן</div>
            <div style={{textAlign:'center'}}>מדויק</div>
            <div style={{textAlign:'center'}}>כיוון</div>
            <div style={{textAlign:'center'}}>בונוס<div style={{fontSize:'9px',opacity:0.6,lineHeight:1.1}}>(בנק')</div></div>
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
            const bonus    = (pts(r) ?? 0) - (ex(r) ?? 0) * 3 - (dir(r) ?? 0)
            const gap      = i > 0 ? leaderPts - (pts(r) ?? 0) : 0
            const avgRound = (pts(r) ?? 0) > 0 && currentRound > 0 ? (pts(r) ?? 0) / currentRound : 0
            const roundsToClose = i > 0 && avgRound > 0 ? Math.ceil(gap / avgRound) : null
            const prevRank = view === 'season' && roundStarted && !roundFinishedSeason ? (prevRanks[r.user_id] ?? null) : null
            const rankChange = prevRank !== null ? prevRank - (i + 1) : 0

            return (
              <div
                key={r.user_id}
                className={`lb-row${isMe?' me':''}${view==='round'?' lb-row-clickable':''}`}
                style={{ position: 'relative' }}
                onClick={() => view === 'round' && setSelectedRoundPlayer(r)}
              >
                {view === 'season' && messages[r.user_id] && (
                  <div className="lb-trash-float">💬 {messages[r.user_id]}</div>
                )}

                <div className={`lb-rank${i<3?' g'+(i+1):''}`}>
                  <span>{medal || (i+1)}</span>
                  {rankChange > 0 && <span className="lb-rank-change up">↑{rankChange}</span>}
                  {rankChange < 0 && <span className="lb-rank-change down">↓{Math.abs(rankChange)}</span>}
                </div>

                <div className="lb-user">
                  <div className={`lb-avatar${streak >= 3 ? ' on-fire' : ''}`} style={{ background:BGS[colorIdx], color:COLORS[colorIdx], overflow:'hidden', padding:0 }}>
                    {r.avatar_url
                      ? <img src={r.avatar_url} alt={r.display_name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                      : initial(r.display_name)
                    }
                  </div>
                  <div className="lb-user-info">
                    <div className="lb-name">{r.display_name}{r.display_name === 'CAT' && ' 🤖'}</div>
                    {streak >= 3 && <div className="lb-streak-badge">🔥 {streak}</div>}
                  </div>
                </div>

                <div className="lb-num">{ex(r) ?? 0}</div>
                <div className="lb-num">{dir(r) ?? 0}</div>
                <div
                  className={`lb-num${bonus !== 0 ? ' lb-bonus-clickable' : ''}`}
                  onClick={e => { e.stopPropagation(); handleBonusClick(r, bonus) }}
                >
                  {bonus > 0 ? `${bonus}+` : bonus}
                </div>
                <div className="lb-pts">
                  {pts(r) ?? 0}
                </div>
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

      {selectedRoundPlayer && (
        <PlayerRoundModal
          player={selectedRoundPlayer}
          round={round}
          onClose={() => setSelectedRoundPlayer(null)}
        />
      )}

      {bonusModal && (
        <BonusBreakdownModal
          data={bonusModal}
          onClose={() => setBonusModal(null)}
        />
      )}
    </div>
  )
}
