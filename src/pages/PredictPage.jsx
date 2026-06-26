import { useState, useEffect, useCallback } from 'react'
import { supabase, upsertPrediction } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { getTeamInfo, calcPoints, isMatchLocked, formatKickoff, CURRENT_ROUND, TOTAL_ROUNDS } from '../lib/teams'

function PtsBadge({ pts }) {
  if (pts === null) return <div className="pts-badge pts-none">?</div>
  if (pts === 3) return <div className="pts-badge pts-exact">3</div>
  if (pts === 1) return <div className="pts-badge pts-dir">1</div>
  return <div className="pts-badge pts-miss">0</div>
}

function TeamBadge({ name }) {
  const t = getTeamInfo(name)
  return (
    <div className="team-badge" style={{ background: t.bg, color: t.color }}>
      {t.initial}
    </div>
  )
}

export default function PredictPage() {
  const { user } = useAuth()
  const [round, setRound]       = useState(CURRENT_ROUND)
  const [matches, setMatches]   = useState([])
  const [guesses, setGuesses]   = useState({})
  const [saved, setSaved]       = useState({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState('')

  const loadRound = useCallback(async () => {
    setLoading(true)
    try {
      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .eq('round', round)
        .order('kickoff')

      const { data: predData } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user.id)
        .in('match_id', (matchData || []).map(m => m.id))

      setMatches(matchData || [])

      const g = {}
      const s = {}
      ;(predData || []).forEach(p => {
        g[p.match_id] = { h: String(p.home_guess ?? ''), a: String(p.away_guess ?? '') }
        s[p.match_id] = true
      })
      setGuesses(g)
      setSaved(s)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }, [round, user.id])

  useEffect(() => { loadRound() }, [loadRound])

  function handleInput(matchId, side, val) {
    const clean = val.replace(/\D/g, '').slice(0, 2)
    setGuesses(g => ({ ...g, [matchId]: { ...g[matchId], [side]: clean } }))
  }

  async function saveAll() {
    setSaving(true)
    let count = 0
    for (const m of matches) {
      if (isMatchLocked(m.kickoff)) continue
      const g = guesses[m.id]
      if (!g || g.h === '' || g.a === '') continue
      try {
        await upsertPrediction(user.id, m.id, parseInt(g.h), parseInt(g.a))
        setSaved(s => ({ ...s, [m.id]: true }))
        count++
      } catch (err) {
        console.error(err)
      }
    }
    setSaving(false)
    setSaveMsg(count > 0 ? `✓ ${count} ניחושים נשמרו!` : '✓ ניחושים עודכנו')
    setTimeout(() => setSaveMsg(''), 3000)
  }

  const openMatches = matches.filter(m => !isMatchLocked(m.kickoff))

  return (
    <div className="page">
      <div className="content">
        <div className="round-nav">
          <button className="round-nav-btn" onClick={() => setRound(r => r - 1)} disabled={round <= 1}>›</button>
          <div className="round-label">מחזור {round}</div>
          <button className="round-nav-btn" onClick={() => setRound(r => r + 1)} disabled={round >= TOTAL_ROUNDS}>‹</button>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : matches.length === 0 ? (
          <div className="empty">אין משחקים במחזור זה</div>
        ) : (
          matches.map(m => {
            const locked = isMatchLocked(m.kickoff)
            const g = guesses[m.id] || { h: '', a: '' }
            const pts = calcPoints(
              g.h !== '' ? parseInt(g.h) : null,
              g.a !== '' ? parseInt(g.a) : null,
              m.home_score, m.away_score
            )
            const hasReal = m.home_score !== null

            return (
              <div className="card" key={m.id}>
                <div className="match-header">
                  <span>{formatKickoff(m.kickoff)}</span>
                  <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                    {locked && <span className="badge badge-lock">🔒 נעול</span>}
                    {hasReal && (
                      <span style={{ fontWeight:'600', fontSize:'13px' }}>
                        {m.home_score}:{m.away_score}
                      </span>
                    )}
                  </div>
                </div>
                <div className="match-body">
                  <div className="team">
                    <TeamBadge name={m.home_team} />
                    <div className="team-name">{m.home_team}</div>
                  </div>
                  <div className="score-wrap">
                    <input className="score-input" type="number" min="0" max="20" inputMode="numeric"
                      value={g.h} disabled={locked}
                      onChange={e => handleInput(m.id, 'h', e.target.value)} />
                    <span className="score-sep">:</span>
                    <input className="score-input" type="number" min="0" max="20" inputMode="numeric"
                      value={g.a} disabled={locked}
                      onChange={e => handleInput(m.id, 'a', e.target.value)} />
                    <div style={{ marginRight: '6px' }}>
                      <PtsBadge pts={hasReal ? pts : null} />
                    </div>
                  </div>
                  <div className="team">
                    <TeamBadge name={m.away_team} />
                    <div className="team-name">{m.away_team}</div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {openMatches.length > 0 && (
        <div className="save-bar">
          <button className="btn btn-primary btn-full" onClick={saveAll} disabled={saving}>
            {saving ? 'שומר...' : 'שמור ניחושים'}
          </button>
          <div className="save-msg">{saveMsg}</div>
        </div>
      )}
    </div>
  )
}
