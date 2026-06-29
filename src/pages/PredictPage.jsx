import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, upsertPrediction, getCurrentRound, getRoundMessages, upsertRoundMessage } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { getTeamInfo, getTeamLogoUrl, isMatchLocked, formatKickoff, TOTAL_ROUNDS } from '../lib/teams'

function buildShareText({ matches, guesses, round, userStreak, displayName }) {
  const lines = [`🎰 LaLiga Guess • מחזור ${round}`, `👤 ${displayName}`, '']
  let total = 0, count = 0
  for (const m of matches) {
    if (m.home_score === null) continue
    const g = guesses[m.id]
    if (!g || g.pts == null) continue
    count++
    total += g.pts
    const awayS = getTeamInfo(m.away_team).short
    const homeS = getTeamInfo(m.home_team).short
    const pts   = g.pts
    const icon  = pts >= 5 ? '🔥' : pts >= 3 ? '✅' : pts >= 1 ? '➡️' : pts < 0 ? '🃏' : '❌'
    const badge = (g.joker ? '🃏' : '') + (m.is_special ? '⭐' : '')
    const ptsStr = pts >= 0 ? `+${pts}` : String(pts)
    lines.push(`${icon}${badge} ${awayS} ${g.a}:${g.h} ${homeS}  →  ${m.away_score}:${m.home_score}  ${ptsStr}נק׳`)
  }
  if (!count) return null
  lines.push('')
  lines.push(`📊 מחזור ${round}: ${total} נקודות`)
  if (userStreak > 0) lines.push(`🔥 סטרייק: ${userStreak}`)
  lines.push('')
  lines.push('LaLiga Guess 🎰')
  return lines.join('\n')
}
import { playCoinSound, playJackpotSound, fireConfetti, getCelebrated, markCelebrated, playNearMissSound, playReversedSound } from '../lib/effects'

function PtsBadge({ pts, isJoker, isSpecial }) {
  if (pts === null)            return <div className="pts-badge pts-none">?</div>
  if (pts === 12)              return <div className="pts-badge pts-exact pts-joker">🃏12</div>
  if (pts === 10)              return <div className="pts-badge pts-exact pts-joker">🃏10</div>
  if (pts === 6  && isJoker)  return <div className="pts-badge pts-exact pts-joker">🃏6</div>
  if (pts === -3)              return <div className="pts-badge pts-miss pts-joker">🃏-3</div>
  if (pts === -1)              return <div className="pts-badge pts-miss pts-joker">🃏-1</div>
  if (pts === 6  && isSpecial) return <div className="pts-badge pts-exact pts-special">⭐6</div>
  if (pts === 2)               return <div className="pts-badge pts-dir pts-special">⭐2</div>
  if (pts === 6)               return <div className="pts-badge pts-exact pts-streak">🔥6</div>
  if (pts === 5)               return <div className="pts-badge pts-exact pts-streak">🔥5</div>
  if (pts === 3)               return <div className="pts-badge pts-exact">3</div>
  if (pts === 1)               return <div className="pts-badge pts-dir">1</div>
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
  const { user, profile } = useAuth()
  const [round, setRound]               = useState(null)
  const [currentRound, setCurrentRound] = useState(null)
  const [jokerMatchId, setJokerMatchId] = useState(null)
  const [userStreak, setUserStreak]     = useState(0)
  const [shareMsg, setShareMsg]         = useState('')
  const [trashTalk, setTrashTalk]       = useState('')
  const [trashSaved, setTrashSaved]     = useState(false)
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
      let joker = null
      ;(predData || []).forEach(p => {
        g[p.match_id] = { h: String(p.home_guess ?? ''), a: String(p.away_guess ?? ''), joker: !!p.is_joker, pts: p.points }
        s[p.match_id] = true
        if (p.is_joker) joker = p.match_id
      })
      setGuesses(g)
      setSaved(s)
      setJokerMatchId(joker)

      const { data: streakData } = await supabase
        .from('current_streak_view').select('current_streak')
        .eq('user_id', user.id).maybeSingle()
      setUserStreak(streakData?.current_streak ?? 0)
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
      const pts = g.pts ?? null
      if (pts === null) return
      celebratedRef.current.add(m.id)
      markCelebrated(m.id)
      const mid = m.id
      if (pts >= 10) {
        setTimeout(() => {
          playJackpotSound(); fireConfetti()
          setTimeout(() => { playJackpotSound(); fireConfetti() }, 250)
          setTimeout(() => { playJackpotSound(); fireConfetti() }, 500)
        }, delay)
        delay += 1200
      } else if (pts >= 5) {
        setTimeout(() => {
          playJackpotSound(); fireConfetti()
          setTimeout(() => { playJackpotSound(); fireConfetti() }, 350)
        }, delay)
        delay += 900
      } else if (pts === 3) {
        setTimeout(() => { playJackpotSound(); fireConfetti() }, delay)
        delay += 700
      } else if (pts === 1 || pts === 2) {
        setTimeout(playCoinSound, delay)
        delay += 250
      } else if (pts < 0) {
        setTimeout(() => {
          playReversedSound()
          setMatchAnims(a => ({ ...a, [mid]: 'reversed' }))
          setTimeout(() => setMatchAnims(a => { const n = { ...a }; delete n[mid]; return n }), 1600)
        }, delay)
        delay += 700
      } else {
        const hg = parseInt(g.h), ag = parseInt(g.a)
        const isReversed = hg === m.away_score && ag === m.home_score
        const distance = Math.abs(hg - m.home_score) + Math.abs(ag - m.away_score)
        const isNearMiss = !isReversed && distance === 1
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
        await upsertPrediction(user.id, m.id, parseInt(g.h), parseInt(g.a), jokerMatchId === m.id)
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

  async function shareRound() {
    const text = buildShareText({
      matches, guesses, round, userStreak,
      displayName: profile?.display_name || 'שחקן',
    })
    if (!text) return
    if (navigator.share) {
      try { await navigator.share({ text }); return } catch {}
    }
    try {
      await navigator.clipboard.writeText(text)
      setShareMsg('הועתק! 📋')
      setTimeout(() => setShareMsg(''), 2500)
    } catch {}
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

        {userStreak >= 1 && userStreak <= 2 && (
          <div className="streak-mini">
            {'🔥'.repeat(userStreak)} {userStreak} ברצף — עוד {3 - userStreak} לבונוס
          </div>
        )}
        {userStreak === 3 && (
          <div className="streak-banner streak-warning">
            🔥🔥🔥 3 ניחושים ברצף! הניחוש המדויק הבא יהיה שווה <strong>5 נקודות</strong>
          </div>
        )}
        {userStreak === 4 && (
          <div className="streak-banner streak-bonus">
            🔥🔥🔥🔥 4 ברצף! ניחוש מדויק הבא = <strong>6 נקודות</strong>
          </div>
        )}
        {userStreak >= 5 && (
          <div className="streak-banner streak-bonus">
            {'🔥'.repeat(Math.min(userStreak, 6))} {userStreak} ברצף! ניחוש מדויק = <strong>6 נקודות</strong> 🎯
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
              const g               = guesses[m.id] || { h: '', a: '', joker: false }
              const hasGuess        = g.h !== '' && g.a !== ''
              const isThisJoker     = jokerMatchId === m.id
              const jokerTaken      = jokerMatchId !== null && !isThisJoker
              const pts        = hasReal && hasGuess ? (g.pts ?? null) : null
              const guessClass = (pts >= 3) ? 'guess-exact' : (pts === 1 || pts === 2) ? 'guess-dir' : (pts !== null && pts <= 0) ? 'guess-miss' : 'guess-none'

              return (
                <div className={`card${isThisJoker ? ' joker-card' : ''}${m.is_special ? ' special-card' : ''}`} key={m.id}>
                  {m.is_special && <div className="special-strip">⭐ משחק מיוחד — ניחוש שווה כפל נקודות</div>}
                  <div className="match-header">
                    <span className="match-date">{formatKickoff(m.kickoff)}</span>
                    {locked && !hasReal && <span className="badge badge-lock" style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)'}}>🔒 נעול</span>}
                    {!effectiveLocked && (
                      <button
                        className={`joker-btn${isThisJoker ? ' joker-active' : ''}${jokerTaken ? ' joker-taken' : ''}`}
                        onClick={() => setJokerMatchId(isThisJoker ? null : m.id)}
                        style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)'}}
                        title="ג׳וקר — מדויק = 6 נקודות, טעות = -1"
                      >🃏</button>
                    )}
                    {hasReal && g.joker && <span style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',fontSize:'16px'}}>🃏</span>}
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
                            <PtsBadge pts={pts} isJoker={!!g.joker} isSpecial={!!m.is_special} />
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
      {matches.some(m => m.home_score !== null && guesses[m.id]?.pts != null) && (
        <div className="share-bar">
          <button className="btn share-btn" onClick={shareRound}>
            📤 שתף מחזור {round}
          </button>
          {shareMsg && <div className="share-msg">{shareMsg}</div>}
        </div>
      )}
    </div>
  )
}
