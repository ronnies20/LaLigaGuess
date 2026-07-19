import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { LIVE_STATUSES, getTeamInfo, getTeamLogoUrl, getStatusLabel, calcPoints } from '../lib/teams'

function TeamLogo({ name, size = 22 }) {
  const t = getTeamInfo(name)
  const url = getTeamLogoUrl(t.logoId)
  const scale = t.logoScale ?? 1
  const imgSize = size * scale
  if (!url) return <span style={{ color: t.color, fontWeight: 700, fontSize: 10, width: size, textAlign: 'center', display: 'inline-block' }}>{t.short}</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0, overflow: 'hidden' }}>
      <img src={url} alt={t.short}
        style={{ width: imgSize, height: imgSize, objectFit: 'contain', flexShrink: 0, display: 'block' }}
        onError={e => { e.currentTarget.style.display = 'none' }} />
    </span>
  )
}

const REAL_MADRID = 'Real Madrid'

const PEN_RANGES = [
  { min: 1,  max: 17, label: '1-17'   },
  { min: 18, max: 32, label: '18-32'  },
  { min: 33, max: 45, label: '33-45+' },
  { min: 46, max: 62, label: '46-62'  },
  { min: 63, max: 77, label: '63-77'  },
  { min: 78, max: 90, label: '78-90+' },
]

function getPenLabel(min, max) {
  if (min == null || max == null) return null
  return PEN_RANGES.find(r => r.min === min && r.max === max)?.label ?? `${min}-${max}`
}

function guessResult(g, m) {
  if (!g || m.home_score === null) return 'none'
  if (g.home_guess === m.home_score && g.away_guess === m.away_score) return 'exact'
  const gDir = Math.sign(g.home_guess - g.away_guess)
  const mDir = Math.sign(m.home_score - m.away_score)
  return gDir === mDir ? 'dir' : 'miss'
}

function livePoints(g, m) {
  if (!g || m.home_score === null) return 0
  // Use calcPoints with streak=0 for approximate live view
  return calcPoints(g.home_guess, g.away_guess, m.home_score, m.away_score, g.is_joker, m.is_special, m.round, 0)
}

function initial(name) { return name?.[0]?.toUpperCase() ?? '?' }

const COLORS = ['#004D9E','#00883A','#CE1021','#534AB7','#C9A84C','#EF7D00','#005AA7','#D4002A','#6A0DAD','#0F6E56']
const BGS    = ['#e8f0ff','#e8f8ee','#ffe8ea','#EEEDFE','#fff8e8','#fff3e0','#e8f0ff','#ffe8ea','#f0e8ff','#e1f5ee']

export default function LivePage() {
  const { user } = useAuth()
  const [matches, setMatches] = useState([])
  const [guesses, setGuesses] = useState({})   // { matchId: { userId: predRow } }
  const [players, setPlayers] = useState([])   // season-rank order
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: live } = await supabase
        .from('matches')
        .select('id, home_team, away_team, home_score, away_score, status, is_special, round')
        .in('status', LIVE_STATUSES)
        .order('kickoff')
      const liveList = live || []
      setMatches(liveList)

      if (!liveList.length) { setLoading(false); return }

      const [{ data: preds }, { data: lb }] = await Promise.all([
        supabase
          .from('predictions')
          .select('user_id, match_id, home_guess, away_guess, is_joker, penalty_min, penalty_max')
          .in('match_id', liveList.map(m => m.id)),
        supabase
          .from('leaderboard_view')
          .select('user_id, display_name, avatar_url, total_points')
          .order('total_points', { ascending: false })
          .limit(100),
      ])

      const gMap = {}
      ;(preds || []).forEach(p => {
        if (!gMap[p.match_id]) gMap[p.match_id] = {}
        gMap[p.match_id][p.user_id] = p
      })
      setGuesses(gMap)
      setPlayers(lb || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Realtime: live score updates
  useEffect(() => {
    const ch = supabase.channel('live-war-room')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, p => {
        setMatches(prev => {
          const next = prev.map(m => m.id === p.new.id ? { ...m, ...p.new } : m)
          // Remove matches that left live status
          return next.filter(m => LIVE_STATUSES.includes(m.status))
        })
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  if (loading) return <div className="page"><div className="spinner" /></div>

  if (!matches.length) return (
    <div className="page">
      <div className="content" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>⏰</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>
          אין משחקים בלייב כרגע
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>
          הטאב יתעדכן אוטומטית כשמשחק יתחיל
        </div>
      </div>
    </div>
  )

  // Sort: highest live pts first, then season rank as tiebreak
  const ranked = players.map((p, seasonRank) => ({
    ...p,
    seasonRank,
    livePts: matches.reduce((s, m) => s + livePoints(guesses[m.id]?.[p.user_id], m), 0),
  })).sort((a, b) => b.livePts - a.livePts || a.seasonRank - b.seasonRank)

  const isRMMatch = m => m.home_team === REAL_MADRID || m.away_team === REAL_MADRID

  return (
    <div className="page">
      <div className="content">

        {/* Title */}
        <div className="lw-page-title">
          <span className="lw-live-dot" />
          חדר מלחמה
          <span className="lw-match-count">{matches.length} משחקים</span>
        </div>

        {/* Live match score strip */}
        <div className="lw-score-strip">
          {matches.map(m => {
            const h = getTeamInfo(m.home_team)
            const a = getTeamInfo(m.away_team)
            return (
              <div key={m.id} className="lw-score-card">
                {/* away first → right in RTL, home last → left in RTL (same as PredictPage) */}
                <div className="lw-score-row">
                  <TeamLogo name={m.away_team} size={24} />
                  <div className="lw-score-num">{m.home_score ?? 0}:{m.away_score ?? 0}</div>
                  <TeamLogo name={m.home_team} size={24} />
                </div>
                <div className="lw-score-status">{getStatusLabel(m.status) || m.status}</div>
              </div>
            )
          })}
        </div>

        {/* War Room Table */}
        <div className="lw-table-wrap">
          <table className="lw-table">
            <thead>
              <tr>
                <th className="lw-th lw-th-rank">#</th>
                <th className="lw-th lw-th-name">שחקן</th>
                {matches.map(m => {
                  const h = getTeamInfo(m.home_team)
                  const a = getTeamInfo(m.away_team)
                  return (
                    <th key={m.id} className="lw-th lw-th-match">
                      <div className="lw-col-match-header">
                        <TeamLogo name={m.away_team} size={18} />
                        <span className="lw-col-sep">×</span>
                        <TeamLogo name={m.home_team} size={18} />
                      </div>
                      <div className="lw-col-score">
                        {m.home_score ?? 0}:{m.away_score ?? 0}
                      </div>
                    </th>
                  )
                })}
                <th className="lw-th lw-th-pts">נק'</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p, i) => {
                const isMe = p.user_id === user?.id
                const colorIdx = i % COLORS.length
                return (
                  <tr key={p.user_id} className={`lw-row${isMe ? ' lw-me' : ''}`}>
                    <td className="lw-td lw-td-rank">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td className="lw-td lw-td-name">
                      <div className="lw-avatar" style={{ background: BGS[colorIdx], color: COLORS[colorIdx] }}>
                        {p.avatar_url
                          ? <img src={p.avatar_url} alt={p.display_name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                          : initial(p.display_name)}
                      </div>
                      <span className="lw-name-text">{p.display_name}</span>
                    </td>
                    {matches.map(m => {
                      const g = guesses[m.id]?.[p.user_id]
                      const res = guessResult(g, m)
                      return (
                        <td key={m.id} className="lw-td lw-td-cell">
                          {g ? (
                            <div className={`lw-guess lw-${res}`}>
                              <span className="lw-guess-score">
                                {g.home_guess}:{g.away_guess}
                                {g.is_joker ? <span className="lw-joker-icon">🃏</span> : null}
                              </span>
                            </div>
                          ) : (
                            <span className="lw-no-guess">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="lw-td lw-td-pts">
                      <span className={`lw-pts-chip${p.livePts > 0 ? ' pos' : p.livePts < 0 ? ' neg' : ''}`}>
                        {p.livePts > 0 ? '+' : ''}{p.livePts}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="lw-footer-note">
          * נקודות משוערות — ללא בונוס סטרייק
        </div>
      </div>
    </div>
  )
}
