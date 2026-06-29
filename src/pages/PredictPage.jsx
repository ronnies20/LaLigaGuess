import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, upsertPrediction, getCurrentRound, getRoundMessages, upsertRoundMessage } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { getTeamInfo, getTeamLogoUrl, isMatchLocked, isMatchLive, isMatchFinished, getStatusLabel, formatKickoff, TOTAL_ROUNDS, LIVE_STATUSES } from '../lib/teams'
import { playCoinSound, playJackpotSound, fireConfetti, getCelebrated, markCelebrated, playNearMissSound, playReversedSound } from '../lib/effects'

function generateShareCanvas({ matches, guesses, round, userStreak, displayName }) {
  const W = 420, PAD = 22, ROW_H = 52, HEADER_H = 96, FOOTER_H = 76
  const results = matches.filter(m => m.home_score !== null && guesses[m.id]?.pts != null)
  if (!results.length) return null
  const H = HEADER_H + results.length * ROW_H + FOOTER_H

  const canvas = document.createElement('canvas')
  canvas.width = W * 2; canvas.height = H * 2
  const ctx = canvas.getContext('2d')
  ctx.scale(2, 2)

  ctx.fillStyle = '#0d0d0a'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#FDB927'
  ctx.fillRect(0, 0, W, 4)

  const hGrad = ctx.createLinearGradient(0, 4, W, 4)
  hGrad.addColorStop(0, 'rgba(253,185,39,0.1)')
  hGrad.addColorStop(1, 'rgba(253,185,39,0.02)')
  ctx.fillStyle = hGrad
  ctx.fillRect(0, 4, W, HEADER_H - 4)

  ctx.direction = 'ltr'; ctx.textAlign = 'center'
  ctx.font = 'bold 23px Arial, sans-serif'
  ctx.fillStyle = '#FDB927'
  ctx.fillText('🎰 LaLiga Guess', W / 2, 44)

  ctx.font = '14px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText(`מחזור ${round}  •  ${displayName}`, W / 2, 70)

  ctx.fillStyle = 'rgba(253,185,39,0.2)'
  ctx.fillRect(PAD, HEADER_H - 1, W - PAD * 2, 1)

  results.forEach((m, i) => {
    const g = guesses[m.id]
    const pts = g.pts
    const rowY = HEADER_H + i * ROW_H
    const midY = rowY + ROW_H / 2

    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fillRect(0, rowY, W, ROW_H)
    }

    const icon = pts >= 5 ? '🔥' : pts >= 3 ? '✅' : pts >= 1 ? '➡️' : pts < 0 ? '🃏' : '❌'
    ctx.font = '17px Arial, sans-serif'
    ctx.textAlign = 'left'; ctx.direction = 'ltr'
    ctx.fillStyle = '#fff'
    ctx.fillText(icon, PAD, midY + 7)

    const awayS = getTeamInfo(m.away_team).short
    const homeS = getTeamInfo(m.home_team).short
    ctx.font = 'bold 13px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillText(awayS, PAD + 30, midY + 1)
    ctx.font = 'bold 14px Arial, sans-serif'
    ctx.fillStyle = '#FDB927'
    ctx.fillText(`${m.away_score}:${m.home_score}`, PAD + 64, midY + 1)
    ctx.font = 'bold 13px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillText(homeS, PAD + 100, midY + 1)

    ctx.font = '11px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.38)'
    ctx.fillText(`ניחוש ${g.a}:${g.h}`, PAD + 30, midY + 19)

    const ptsColor = pts >= 5 ? '#FDB927' : pts >= 3 ? '#66bb6a' : pts >= 1 ? '#42a5f5' : '#ef5350'
    const ptsStr = (pts >= 0 ? '+' : '') + pts + 'נק׳'
    const extras = (g.joker ? '🃏' : '') + (m.is_special ? '⭐' : '') + (pts >= 5 && !g.joker ? '🔥' : '')

    ctx.font = 'bold 14px Arial, sans-serif'
    ctx.fillStyle = ptsColor
    ctx.textAlign = 'right'
    ctx.fillText(ptsStr, W - PAD, midY + 3)
    if (extras) {
      ctx.font = '13px Arial, sans-serif'
      ctx.fillText(extras, W - PAD, midY + 19)
    }
  })

  const footerY = HEADER_H + results.length * ROW_H
  ctx.fillStyle = 'rgba(253,185,39,0.05)'
  ctx.fillRect(0, footerY, W, FOOTER_H)
  ctx.fillStyle = 'rgba(253,185,39,0.2)'
  ctx.fillRect(PAD, footerY, W - PAD * 2, 1)

  const total = results.reduce((s, m) => s + (guesses[m.id]?.pts ?? 0), 0)
  ctx.direction = 'ltr'; ctx.textAlign = 'center'
  ctx.font = 'bold 20px Arial, sans-serif'
  ctx.fillStyle = '#FDB927'
  ctx.fillText(`📊 ${total} נקודות`, W / 2, footerY + 32)

  if (userStreak > 0) {
    ctx.font = '13px Arial, sans-serif'
    ctx.fillStyle = '#f4a261'
    ctx.fillText(`🔥 סטרייק: ${userStreak}`, W / 2, footerY + 54)
  }

  return canvas
}

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
  const [othersGuesses, setOthersGuesses] = useState({})
  const [expandedMatch, setExpandedMatch] = useState(null)
  const [shareMsg, setShareMsg]         = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareImageUrl, setShareImageUrl]   = useState('')
  const shareFileRef = useRef(null)
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
      const allMatchIds = (matchData || []).map(m => m.id)
      setMatches(matchData || [])

      const g = {}, s = {}
      let joker = null
      ;(predData || []).forEach(p => {
        g[p.match_id] = {
          h: String(p.home_guess ?? ''), a: String(p.away_guess ?? ''),
          joker: !!p.is_joker, pts: p.points,
          penMin: String(p.penalty_min ?? ''), penMax: String(p.penalty_max ?? ''),
          penBonus: p.penalty_bonus ?? 0,
        }
        s[p.match_id] = true
        if (p.is_joker) joker = p.match_id
      })
      setGuesses(g)
      setSaved(s)
      setJokerMatchId(joker)

      // All predictions for started/live matches — for guess distribution stats
      const startedIds = (matchData || []).filter(m => isMatchLocked(m.kickoff)).map(m => m.id)
      if (startedIds.length) {
        const { data: allPreds } = await supabase
          .from('predictions')
          .select('match_id, home_guess, away_guess')
          .in('match_id', startedIds)
        const og = {}
        ;(allPreds || []).forEach(p => {
          if (!og[p.match_id]) og[p.match_id] = []
          og[p.match_id].push({ h: p.home_guess, a: p.away_guess })
        })
        setOthersGuesses(og)
      }

      const { data: streakData } = await supabase
        .from('current_streak_view').select('current_streak')
        .eq('user_id', user.id).maybeSingle()
      setUserStreak(streakData?.current_streak ?? 0)
    } catch (err) { console.error(err) }
    setLoading(false)
  }, [round, user.id])

  useEffect(() => { loadRound() }, [loadRound])

  // Realtime: live match score updates + own points updates
  useEffect(() => {
    if (!round) return
    const channel = supabase.channel(`predict-round-${round}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, payload => {
        if (payload.new.round !== round) return
        setMatches(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
        // When a match goes live for the first time, load its predictions for distribution stats
        const justWentLive = LIVE_STATUSES.includes(payload.new.status) && !LIVE_STATUSES.includes(payload.old?.status)
        if (justWentLive) {
          supabase
            .from('predictions')
            .select('match_id, home_guess, away_guess')
            .eq('match_id', payload.new.id)
            .then(({ data }) => {
              if (!data) return
              setOthersGuesses(prev => ({
                ...prev,
                [payload.new.id]: data.map(p => ({ h: p.home_guess, a: p.away_guess }))
              }))
            })
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'predictions' }, payload => {
        if (payload.new.user_id !== user.id) return
        setGuesses(prev => {
          const ex = prev[payload.new.match_id]
          if (!ex) return prev
          return { ...prev, [payload.new.match_id]: { ...ex, pts: payload.new.points, penBonus: payload.new.penalty_bonus ?? 0 } }
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [round, user.id])

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
      if (isMatchLive(m.status)) return  // don't celebrate during live
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

  function handlePenaltyInput(matchId, side, val) {
    const clean = val.replace(/\D/g, '').slice(0, 2)
    const clamped = clean && parseInt(clean) > 90 ? '90' : clean
    setGuesses(g => ({ ...g, [matchId]: { ...g[matchId], [side]: clamped } }))
  }

  async function saveAll() {
    setSaving(true)
    let count = 0
    for (const m of matches) {
      if (isMatchLocked(m.kickoff) || m.home_score !== null) continue
      const g = guesses[m.id]
      if (!g || g.h === '' || g.a === '') continue
      try {
        const penMin = g.penMin ? parseInt(g.penMin) : null
        const penMax = g.penMax ? parseInt(g.penMax) : null
        await upsertPrediction(user.id, m.id, parseInt(g.h), parseInt(g.a), jokerMatchId === m.id, penMin, penMax)
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

  function shareRound() {
    const canvas = generateShareCanvas({
      matches, guesses, round, userStreak,
      displayName: profile?.display_name || 'שחקן',
    })
    if (!canvas) return
    canvas.toBlob(blob => {
      if (shareImageUrl) URL.revokeObjectURL(shareImageUrl)
      const url = URL.createObjectURL(blob)
      shareFileRef.current = new File([blob], `laliga-round-${round}.png`, { type: 'image/png' })
      setShareImageUrl(url)
      setShowShareModal(true)
    }, 'image/png')
  }

  async function handleModalShare() {
    const file = shareFileRef.current
    if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `LaLiga Guess • מחזור ${round}` }); return } catch {}
    }
    if (shareImageUrl) window.open(shareImageUrl, '_blank')
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

        {round === currentRound && openMatches.length > 0 && (
          <div className="card trash-card">
            <div className="trash-label">💬 טראש טוק למחזור {round}</div>
            <div className="trash-row">
              <input
                type="text"
                maxLength={20}
                className={`trash-input${trashSaved ? ' trash-saved' : ''}`}
                placeholder="מה יש לך להגיד לשאר הליגה? 👀"
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
              const live            = isMatchLive(m.status)
              const finished        = isMatchFinished(m.status) || (m.home_score !== null && !live && !m.status)
              const hasScore        = m.home_score !== null
              const effectiveLocked = locked || hasScore
              const g               = guesses[m.id] || { h: '', a: '', joker: false, penMin: '', penMax: '', penBonus: 0 }
              const hasGuess        = g.h !== '' && g.a !== ''
              const isThisJoker     = jokerMatchId === m.id
              const jokerTaken      = jokerMatchId !== null && !isThisJoker
              const pts        = hasScore && hasGuess ? (g.pts ?? null) : null
              const guessClass = (pts >= 3) ? 'guess-exact' : (pts === 1 || pts === 2) ? 'guess-dir' : (pts !== null && pts <= 0) ? 'guess-miss' : 'guess-none'
              const isRMMatch       = m.home_team === 'Real Madrid' || m.away_team === 'Real Madrid'
              const others          = othersGuesses[m.id] || []

              return (
                <div className={`card${isThisJoker ? ' joker-card' : ''}${m.is_special ? ' special-card' : ''}`} key={m.id}>
                  {m.is_special && <div className="special-strip">⭐ משחק מיוחד — ניחוש שווה כפל נקודות</div>}
                  <div className="match-header">
                    <span className="match-date">
                      {live ? <span className="live-dot">🔴</span> : null}
                      {getStatusLabel(m.status) || formatKickoff(m.kickoff)}
                    </span>
                    {locked && !hasScore && <span className="badge badge-lock" style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)'}}>🔒 נעול</span>}
                    {!effectiveLocked && (
                      <button
                        className={`joker-btn${isThisJoker ? ' joker-active' : ''}${jokerTaken ? ' joker-taken' : ''}`}
                        onClick={() => setJokerMatchId(isThisJoker ? null : m.id)}
                        style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)'}}
                        title="ג׳וקר — מדויק = 6 נקודות, טעות = -1"
                      >🃏</button>
                    )}
                    {hasScore && g.joker && <span style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',fontSize:'16px'}}>🃏</span>}
                  </div>
                  <div className="match-body">
                    <TeamDisplay name={m.away_team} />
                    <div className="score-wrap">
                      {hasScore ? (
                        <div className={`result-area${live ? ' result-live' : ''}`}>
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
                            <span className="result-col-label">{live ? '🔴' : 'סופי'}</span>
                            <div className={`final-score-chip${live ? ' live-score' : ''}`}>{m.home_score}:{m.away_score}</div>
                          </div>
                          <div className="result-sep" />
                          <div className="result-col">
                            <span className="result-col-label">נק׳</span>
                            <PtsBadge pts={pts} isJoker={!!g.joker} isSpecial={!!m.is_special} />
                            {(g.penBonus ?? 0) > 0 && <div className="pen-bonus-badge">+{g.penBonus}🎯</div>}
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
                  {/* Penalty prediction — Real Madrid matches only */}
                  {isRMMatch && (
                    <div className="penalty-section">
                      {!effectiveLocked ? (
                        <>
                          <span className="penalty-label">🎯 ניחוש פנדל לריאל מדריד (אופציונלי)</span>
                          <div className="penalty-inputs">
                            <span className="penalty-unit">מדקה</span>
                            <input type="number" min="1" max="90" inputMode="numeric" placeholder="1"
                              className="penalty-input" value={g.penMin}
                              onChange={e => handlePenaltyInput(m.id, 'penMin', e.target.value)} />
                            <span>–</span>
                            <input type="number" min="1" max="90" inputMode="numeric" placeholder="90"
                              className="penalty-input" value={g.penMax}
                              onChange={e => handlePenaltyInput(m.id, 'penMax', e.target.value)} />
                          </div>
                        </>
                      ) : m.penalty_minute != null ? (
                        <div className="penalty-result">
                          <span>פנדל בדקה {m.penalty_minute} — </span>
                          {g.penMin && g.penMax && m.penalty_minute >= parseInt(g.penMin) && m.penalty_minute <= parseInt(g.penMax)
                            ? <span className="pen-hit">✅ ניחוש מדויק! +3נק׳</span>
                            : g.penMin && g.penMax
                              ? <span className="pen-miss">❌ ניחשת {g.penMin}–{g.penMax}</span>
                              : <span className="pen-no">לא ניחשת</span>}
                        </div>
                      ) : hasScore && finished ? (
                        <div className="penalty-result pen-no">לא היה פנדל לריאל במשחק זה</div>
                      ) : (g.penMin && g.penMax) ? (
                        <div className="penalty-result pen-pending">🎯 ניחשת: {g.penMin}–{g.penMax} דקה</div>
                      ) : null}
                    </div>
                  )}

                  {/* Guess distribution — only after match started (live or finished) */}
                  {(live || hasScore) && others.length > 0 && (() => {
                    const freq = {}
                    others.forEach(o => { const k = `${o.h}:${o.a}`; freq[k] = (freq[k] || 0) + 1 })
                    const total = others.length
                    const top5 = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,5)
                    const maxCount = top5[0][1]
                    return (
                      <>
                        <button className="others-toggle-btn" onClick={() => setExpandedMatch(p => p === m.id ? null : m.id)}>
                          📊 ניחושים ({total}) {expandedMatch === m.id ? '▲' : '▼'}
                        </button>
                        {expandedMatch === m.id && (
                          <div className="dist-list">
                            <div className="dist-title">הסתברות ניחושים</div>
                            {top5.map(([score, count]) => {
                              const pct = Math.round((count / total) * 100)
                              const barW = Math.round((count / maxCount) * 100)
                              return (
                                <div key={score} className="dist-row">
                                  <span className="dist-score">{score}</span>
                                  <div className="dist-bar-wrap">
                                    <div className="dist-bar" style={{ width: `${barW}%` }} />
                                  </div>
                                  <span className="dist-pct">{pct}%</span>
                                  <span className="dist-count">{count}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </>
                    )
                  })()}
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
      {/* share card disabled — kept for future use */}
    </div>
  )
}
