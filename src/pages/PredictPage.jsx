import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, upsertPrediction } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { getTeamInfo, getTeamLogoUrl, calcPoints, isMatchLocked, formatKickoff, CURRENT_ROUND, TOTAL_ROUNDS } from '../lib/teams'
import { playCoinSound, playJackpotSound, fireConfetti, getCelebrated, markCelebrated } from '../lib/effects'

function PtsBadge({ pts }) {
  if (pts === null) return <div className="pts-badge pts-none">?</div>
  if (pts === 3)    return <div className="pts-badge pts-exact">3</div>
  if (pts === 1)    return <div className="pts-badge pts-dir">1</div>
  return <div className="pts-badge pts-miss">0</div>
}

function TeamDisplay({ name }) {
  const t = getTeamInfo(name)
  const logoUrl = getTeamLogoUrl(t.logoId)
  return (
    <div className="team">
      <div className="team-logo-wrap">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={name}
            className="team-logo-img"
            onError={e => {
              e.currentTarget.style.display = 'none'
              e.currentTarget.nextSibling.style.display = 'flex'
            }}
          />
        ) : null}
        <div className="team-badge" style={{ background: t.bg, color: t.color, display: logoUrl ? 'none' : 'flex' }}>
          {t.initial}
        </div>
      </div>
      <div className="team-name">{name}</div>
    </div>
  )
}

export default function PredictPage() {
  const { user } = useAuth()
  const [round, setRound]     = useState(CURRENT_ROUND)
  const [matches, setMatches] = useState([])
  const [guesses, setGuesses] = useState({})
  const [saved, setSaved]     = useState({})
  const [flash, setFlash]     = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const saveBtnRef            = useRef(null)

  const loadRound = useCallback(async () => {
    setLoading(true)
    try {
      const { data: matchData } = await supabase
        .from('matches').select('*').eq('round', round).order('kickoff')
      const { data: predData } = await supabase
        .from('predictions').select('*')
        .eq('user_id', user.id)
        .in('match_id', (matchData || []).map(m => m.id))
      setMatches(matchData || [])
      const g = {}, s = {}
      ;(predData || []).forEach(p => {
        g[p.match_id] = { h: String(p.home_guess ?? ''), a: String(p.away_guess ?? '') }
        s[p.match_id] = true
      })
      setGuesses(g)
      setSaved(s)
    } catch (err) { console.error(err) }
    setLoading(false)
  }, [round, user.id])

  useEffect(() => { loadRound() }, [loadRound])

  useEffect(() => {
    if (!matches.length || !Object.keys(guesses).length) return
    const celebrated = getCelebrated()
    let delay = 0
    matches.forEach(m => {
      if (m.home_score === null || celebrated.has(m.id)) return
      const g = guesses[m.id]
      if (!g || g.h === '' || g.a === '') return
      const pts = calcPoints(parseInt(g.h), parseInt(g.a), m.home_score, m.away_score)
      markCelebrated(m.id)
      if (pts === 3) {
        setTimeout(() => { playJackpotSound(); fireConfetti() }, delay)
        delay += 700
      } else if (pts === 1) {
        setTimeout(playCoinSound, delay)
        delay += 250
      }
    })
  }, [matches, guesses])

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
        setFlash(f => ({ ...f, [m.id]: true }))
        setTimeout(() => setFlash(f => ({ ...f, [m.id]: false })), 400)
        count++
        setTimeout(playCoinSound, count * 90)
      } catch (err) { console.error(err) }
    }
    setSaving(false)
    if (count > 0) {
      setSaveMsg(`🎰 ${count} ניחושים נשמרו!`)
      if (count >= 3) setTimeout(() => { playJackpotSound(); fireConfetti() }, count * 90 + 150)
    } else {
      setSaveMsg('✓ ניחושים עודכנו')
    }
    setTimeout(() => setSaveMsg(''), 3500)
  }

  const openMatches = matches.filter(m => !isMatchLocked(m.kickoff))

  return (
    <div className="page">
      <div className="content">
        <div className="round-nav">
          {/* RTL: first button appears on RIGHT → increase round (go to next) */}
          <button className="round-nav-btn" onClick={() => setRound(r => r - 1)} disabled={round <= 1}>‹</button>
          <div className="round-label">מחזור {round}</div>
          <button className="round-nav-btn" onClick={() => setRound(r => r + 1)} disabled={round >= TOTAL_ROUNDS}>›</button>
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
                      <span style={{ fontWeight:'700', fontSize:'14px', color:'#FDB927' }}>
                        {m.home_score}:{m.away_score}
                      </span>
                    )}
                  </div>
                </div>
                <div className="match-body">
                  <TeamDisplay name={m.home_team} />
                  <div className="score-wrap">
                    <input
                      className={`score-input${flash[m.id] ? ' saved' : ''}`}
                      type="number" min="0" max="20" inputMode="numeric"
                      value={g.h} disabled={locked}
                      onChange={e => handleInput(m.id, 'h', e.target.value)}
                    />
                    <span className="score-sep">:</span>
                    <input
                      className={`score-input${flash[m.id] ? ' saved' : ''}`}
                      type="number" min="0" max="20" inputMode="numeric"
                      value={g.a} disabled={locked}
                      onChange={e => handleInput(m.id, 'a', e.target.value)}
                    />
                    <div style={{ marginRight:'6px' }}>
                      <PtsBadge pts={hasReal ? pts : null} />
                    </div>
                  </div>
                  <TeamDisplay name={m.away_team} />
                </div>
              </div>
            )
          })
        )}
      </div>

      {openMatches.length > 0 && (
        <div className="save-bar">
          <button ref={saveBtnRef} className="btn btn-primary btn-full" onClick={saveAll} disabled={saving}>
            {saving ? '🎲 שומר...' : '🎰 שמור ניחושים'}
          </button>
          <div className="save-msg">{saveMsg}</div>
        </div>
      )}
    </div>
  )
}
