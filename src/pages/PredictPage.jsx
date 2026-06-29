import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, upsertPrediction, getCurrentRound, getRoundMessages, upsertRoundMessage } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { getTeamInfo, getTeamLogoUrl, calcPoints, isMatchLocked, formatKickoff, TOTAL_ROUNDS } from '../lib/teams'
import { playCoinSound, playJackpotSound, fireConfetti, getCelebrated, markCelebrated, playNearMissSound, playReversedSound } from '../lib/effects'

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
  const [round, setRound]         = useState(null)
  const [currentRound, setCurrentRound] = useState(null)
  const [trashTalk, setTrashTalk]   = useState('')
  const [trashSaved, setTrashSaved] = useState(false)
  const [matches, setMatches] = useState([])
  const [guesses, setGuesses] = useState({})
  const [saved, setSaved]     = useState({})
  const [flash, setFlash]     = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [matchAnims, setMatchAnims] = useState({})
  const saveBtnRef            = useRef(null)
  const celebratedRef         = useRef(getCelebrated())

  useEffect(() => {
    getCurrentRound().then(r => { setRound(r); setCurrentRound(r) }).catch(() => { setRound(1); setCurrentRound(1) })
  }, [])

  const loadRound = useCallback(async () => {
    if (round === null) return
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
    if (!currentRound) return
    supabase.from('round_messages').select('message')
      .eq('user_id', user.id).eq('round', currentRound).maybeSingle()
      .then(({ data }) => { setTrashTalk(data?.message || ''); setTrashSaved(!!data?.message) })
  }, [currentRound, user.id])

  useEffect(() => {
    if (!matches.length || !Object.keys(guesses).length) return
    let delay = 0
    matches.forEach(m => {
      if (m.home_score === null || celebratedRef.current.has(m.id)) return
      const g = guesses[m.id]
      if (!g || g.h === '' || g.a === '') return
      const hg = parseInt(g.h), ag = parseInt(g.a)
      const pts = calcPoints(hg, ag, m.home_score, m.away_score)
      celebratedRef.current.add(m.id)
      markCelebrated(m.id)
      if (pts === 3) {
        setTimeout(() => { playJackpotSound(); fireConfetti() }, delay)
        delay += 700
      } else if (pts === 1) {
        setTimeout(playCoinSound, delay)
        delay += 250
      } else {
        const isReversed = hg === m.away_score && ag === m.home_score
        const distance = Math.abs(hg - m.home_score) + Math.abs(ag - m.away_score)
        const isNearMiss = !isReversed && distance === 1
        const mid = m.id
        if (isReversed) {
          setTimeout(() => {
            playReversedSound()
            setMatchAnims(a => ({ ...a, [mid]: 'reversed' }))
            setTimeout(() => setMatchAnims(a => { const n = { ...a }; delete n[mid]; return n }), 1600)
          }, delay)
          delay += 700
        } else if (isNearMiss) {
          setTimeout(() => {
            playNearMissSound()
            setMatchAnims(a => ({ ...a, [mid]: 'near-miss' }))
            setTimeout(() => setMatchAnims(a => { const n = { ...a }; delete n[mid]; return n }), 1300)
          }, delay)
          delay += 600
        }
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
      if (isMatchLocked(m.kickoff) || m.home_score !== null) continue
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

  async function saveTrashTalk() {
    if (!trashTalk.trim() || trashSaved) return
    await upsertRoundMessage(user.id, currentRound, trashTalk.trim())
    setTrashSaved(true)
  }

  const openMatches = matches.filter(m => !isMatchLocked(m.kickoff) && m.home_score === null)

  return (
    <div className="page">
      <div className="content">
        <div className="round-nav">
          {/* circular: from round 1 go back to last round, and vice versa */}
          <button className="round-nav-btn" onClick={() => setRound(r => r <= 1 ? TOTAL_ROUNDS : r - 1)}>‹</button>
          <div className="round-label">מחזור {round}</div>
          <button className="round-nav-btn" onClick={() => setRound(r => r >= TOTAL_ROUNDS ? 1 : r + 1)}>›</button>
        </div>

        {round === currentRound && (
          <div className="card trash-card">
            <div className="trash-label">💬 טראש טוק למחזור {round}</div>
            <div className="trash-row">
              <input
                type="text"
                maxLength={20}
                className={`trash-input${trashSaved ? ' trash-saved' : ''}`}
                placeholder="מה יש לך להגיד? 😤"
                value={trashTalk}
                onChange={e => { setTrashTalk(e.target.value); setTrashSaved(false) }}
                onBlur={saveTrashTalk}
              />
              <span className="trash-counter" style={{ color: trashTalk.length >= 18 ? '#f44336' : undefined }}>
                {trashTalk.length}/20
              </span>
              <button className="trash-btn" onClick={saveTrashTalk} disabled={trashSaved || !trashTalk.trim()}>
                {trashSaved ? '✓' : 'שלח'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="spinner" />
        ) : matches.length === 0 ? (
          <div className="empty">אין משחקים במחזור זה</div>
        ) : (
          <>
            {/* Home on left, Away on right — matches API Football convention */}
            <div className="teams-header">
              <span className="teams-header-slot">Away</span>
              <span className="teams-header-center" />
              <span className="teams-header-slot">Home</span>
            </div>

            {matches.map(m => {
              const locked          = isMatchLocked(m.kickoff)
              const hasReal         = m.home_score !== null
              const effectiveLocked = locked || hasReal
              const g               = guesses[m.id] || { h: '', a: '' }
              const hasGuess        = g.h !== '' && g.a !== ''
              const pts             = hasReal && hasGuess
                ? calcPoints(parseInt(g.h), parseInt(g.a), m.home_score, m.away_score)
                : null
              const guessClass = pts === 3 ? 'guess-exact' : pts === 1 ? 'guess-dir' : pts === 0 ? 'guess-miss' : 'guess-none'

              return (
                <div className="card" key={m.id}>
                  <div className="match-header">
                    <span className="match-date">{formatKickoff(m.kickoff)}</span>
                    {locked && !hasReal && <span className="badge badge-lock" style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)'}}>🔒 נעול</span>}
                  </div>
                  <div className="match-body">
                    <TeamDisplay name={m.away_team} />
                    <div className="score-wrap">
                      {hasReal ? (
                        <div className="result-area">
                          <div className="result-col">
                            <span className="result-col-label">ניחוש</span>
                            <div style={{ position: 'relative' }}>
                              {matchAnims[m.id] === 'near-miss' && <span className="float-label near-miss-label">כמעט 😤</span>}
                              {matchAnims[m.id] === 'reversed' && <span className="float-label reversed-label">הפוך! 💀</span>}
                              <div className={`guess-chip ${guessClass}${matchAnims[m.id] ? ' ' + matchAnims[m.id] + '-anim' : ''}`}>{hasGuess ? `${g.h}:${g.a}` : '—'}</div>
                            </div>
                          </div>
                          <div className="result-sep" />
                          <div className="result-col">
                            <span className="result-col-label">סופי</span>
                            <div className="final-score-chip">{m.home_score}:{m.away_score}</div>
                          </div>
                          <div className="result-sep" />
                          <div className="result-col">
                            <span className="result-col-label">נק׳</span>
                            <PtsBadge pts={pts} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <input
                            className={`score-input${flash[m.id] ? ' saved' : ''}`}
                            type="number" min="0" max="20" inputMode="numeric"
                            value={g.h} disabled={effectiveLocked}
                            onChange={e => handleInput(m.id, 'h', e.target.value)}
                          />
                          <span className="score-sep">:</span>
                          <input
                            className={`score-input${flash[m.id] ? ' saved' : ''}`}
                            type="number" min="0" max="20" inputMode="numeric"
                            value={g.a} disabled={effectiveLocked}
                            onChange={e => handleInput(m.id, 'a', e.target.value)}
                          />
                          <div style={{ marginRight:'6px' }}>
                            <PtsBadge pts={null} />
                          </div>
                        </>
                      )}
                    </div>
                    <TeamDisplay name={m.home_team} />
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {openMatches.length > 0 && (
        <div className="save-bar">
          <button ref={saveBtnRef} className="btn btn-primary btn-full save-btn" onClick={saveAll} disabled={saving}>
            <span className="save-emoji">{saving ? '🎲' : '🎰'}</span>
            <span>{saving ? 'שומר...' : 'שמור ניחושים'}</span>
          </button>
          <div className="save-msg">{saveMsg}</div>
        </div>
      )}
    </div>
  )
}
