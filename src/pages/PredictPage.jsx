import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, upsertPrediction, getCurrentRound, getRoundMessages, upsertRoundMessage, countRoundParticipants } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { getTeamInfo, getTeamLogoUrl, isMatchLocked, isMatchLive, isMatchFinished, getStatusLabel, formatKickoff, TOTAL_ROUNDS, LIVE_STATUSES, calcPoints } from '../lib/teams'
import { playCoinSound, playJackpotSound, fireConfetti, getCelebrated, markCelebrated, playNearMissSound, playReversedSound, spawnParticles } from '../lib/effects'
import { playSubmit, playExactScore, playNearMiss as playNearMissNew, playJokerWin, playJokerLoss, playStreakMilestone, playTick, playJokerActivate } from '../lib/audio'
import { getPhaseBase } from '../lib/teams'

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

function PtsBadge({ pts, isJoker, isSpecial, round = 1, isExact = false }) {
  if (pts === null || pts === undefined) return <div className="pts-badge pts-none">?</div>
  if (isJoker && pts > 0)  return <div className="pts-badge pts-exact pts-joker">🃏{pts}</div>
  if (pts < 0)             return <div className="pts-badge pts-miss pts-joker">🃏{pts}</div>
  if (pts === 0)           return <div className="pts-badge pts-miss">0</div>
  const exactBase = getPhaseBase(round).exact
  if (isExact || pts >= exactBase) {
    const hasStreakBonus = pts > exactBase
    return <div className={`pts-badge pts-exact${hasStreakBonus ? ' pts-streak' : ''}`}>{hasStreakBonus ? `🔥${pts}` : pts}</div>
  }
  if (isSpecial && pts > 0) return <div className="pts-badge pts-dir pts-special">⭐{pts}</div>
  return <div className="pts-badge pts-dir">{pts}</div>
}

function TeamDisplay({ name }) {
  const t = getTeamInfo(name)
  const logoUrl = getTeamLogoUrl(t.logoId, t.logoUrl)
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

// Mirror of the SQL penalty_in_range() function
function checkPenaltyInRange(elapsed, extra, rangeMin, rangeMax) {
  const min = parseInt(rangeMin), max = parseInt(rangeMax)
  if (max === 45) return elapsed >= min && elapsed <= 45  // "33-45+": first half only
  if (max === 90) return elapsed >= min                    // "78-90+": end of match incl. ET
  return elapsed >= min && elapsed <= max
}

const PEN_RANGES = [
  { label: '1-17',   min: 1,  max: 17 },
  { label: '46-62',  min: 46, max: 62 },
  { label: '18-32',  min: 18, max: 32 },
  { label: '63-77',  min: 63, max: 77 },
  { label: '33-45+', min: 33, max: 45 },
  { label: '78-90+', min: 78, max: 90 },
]

export default function PredictPage() {
  const { user, profile, refreshProfile } = useAuth()
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
  const [penPickerMatchId, setPenPickerMatchId] = useState(null)
  const [dirty, setDirty]             = useState(new Set())
  const [socialCount, setSocialCount] = useState(0)
  const [lockCountdown, setLockCountdown] = useState(null)
  const [revealingMatches, setRevealingMatches] = useState(new Set())
  const [goalFlash, setGoalFlash]               = useState(new Set())
  const [missedRound, setMissedRound]           = useState(null)
  const [trashUnlocked, setTrashUnlocked]       = useState(false)
  const [trashMessages, setTrashMessages]       = useState([])
  const saveBtnRef            = useRef(null)
  const celebratedRef         = useRef(getCelebrated(user.id))

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

      // Social proof: count participants in this round
      try {
        const cnt = await countRoundParticipants(round)
        setSocialCount(cnt)
      } catch {}
      // Loss framing: was the previous round played but user had no predictions?
      if (round > 1) {
        try {
          const { data: prevM } = await supabase
            .from('matches').select('id').eq('round', round - 1).not('home_score', 'is', null)
          if (prevM?.length > 0) {
            const { data: myPrev } = await supabase
              .from('predictions').select('id').eq('user_id', user.id)
              .in('match_id', prevM.map(m => m.id))
            setMissedRound(!myPrev?.length ? { round: round - 1, possible: prevM.length * 3 } : null)
          }
        } catch {}
      }
      setTrashUnlocked(false)
      setTrashMessages([])
    } catch (err) { console.error(err) }
    setLoading(false)
  }, [round, user.id])

  useEffect(() => { loadRound() }, [loadRound])

  // Countdown timer to first lock
  useEffect(() => {
    if (!matches.length) { setLockCountdown(null); return }
    const openM = matches.filter(m => !isMatchLocked(m.kickoff) && m.home_score === null)
    if (!openM.length) { setLockCountdown(null); return }
    const firstLock = Math.min(...openM.map(m => new Date(m.kickoff).getTime() - 60 * 60 * 1000))
    const tick = () => setLockCountdown(Math.max(0, Math.floor((firstLock - Date.now()) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [matches])

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
        // Goal flash when live match score changes
        const isLive = LIVE_STATUSES.includes(payload.new.status)
        const scoreChanged = payload.old?.home_score !== payload.new.home_score || payload.old?.away_score !== payload.new.away_score
        if (isLive && scoreChanged) {
          setGoalFlash(prev => { const n = new Set(prev); n.add(payload.new.id); return n })
          setTimeout(() => setGoalFlash(prev => { const n = new Set(prev); n.delete(payload.new.id); return n }), 900)
        }
        // Staged reveal when score first appears (null → value)
        const justRevealed = payload.old?.home_score === null && payload.new.home_score !== null
        if (justRevealed) {
          setRevealingMatches(prev => { const n = new Set(prev); n.add(payload.new.id); return n })
          setTimeout(() => setRevealingMatches(prev => { const n = new Set(prev); n.delete(payload.new.id); return n }), 2800)
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
      markCelebrated(m.id, user.id)
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
        setTimeout(() => {
          playJackpotSound(); fireConfetti()
          spawnParticles(window.innerWidth / 2, window.innerHeight * 0.42)
        }, delay)
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

  function activateJoker(matchId) {
    setJokerMatchId(matchId)
    playJokerActivate()
  }

  async function activateStreakShield() {
    try {
      const { data, error } = await supabase.rpc('activate_streak_shield', { p_round: round })
      if (error || !data) throw error || new Error('shield not available')
      refreshProfile()
      setSaveMsg('🛡️ המגן הופעל! הסטרייק שלך מוגן')
      setTimeout(() => setSaveMsg(''), 4000)
    } catch {
      setSaveMsg('לא ניתן להפעיל את המגן')
      setTimeout(() => setSaveMsg(''), 4000)
    }
  }

  function handleInput(matchId, side, val) {
    const clean = val.replace(/\D/g, '').slice(0, 2)
    setGuesses(g => ({ ...g, [matchId]: { ...g[matchId], [side]: clean } }))
    setDirty(d => { const n = new Set(d); n.add(matchId); return n })
  }

  function handlePenRange(matchId, min, max) {
    setGuesses(prev => ({ ...prev, [matchId]: { ...(prev[matchId] || {}), penMin: String(min), penMax: String(max) } }))
    setPenPickerMatchId(null)
    const g = guesses[matchId] || {}
    if (g.h !== '' && g.a !== '') {
      upsertPrediction(user.id, matchId, parseInt(g.h), parseInt(g.a), jokerMatchId === matchId, min, max)
        .catch(console.error)
    }
  }

  async function saveAll() {
    setSaving(true)
    playSubmit()
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
    setDirty(new Set())
    if (count > 0 && !trashUnlocked) {
      setTrashUnlocked(true)
      try {
        const msgs = await getRoundMessages(round)
        setTrashMessages(msgs.filter(msg => msg.user_id !== user.id))
      } catch {}
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

  // Unsaved count: matches with a valid guess not yet saved (or modified after save)
  const unsavedCount = openMatches.filter(m => {
    const g = guesses[m.id]
    return g && g.h !== '' && g.a !== '' && dirty.has(m.id)
  }).length

  // Progress: how many open matches have a guess
  const predictedCount = openMatches.filter(m => {
    const g = guesses[m.id]; return g && g.h !== '' && g.a !== ''
  }).length

  // Current round points from finished matches
  const roundPts = matches
    .filter(m => m.home_score !== null && !isMatchLive(m.status))
    .reduce((sum, m) => sum + (guesses[m.id]?.pts ?? 0), 0)
  const hasRoundResults = matches.some(m => m.home_score !== null)

  // Format countdown
  function formatCountdown(secs) {
    if (secs === null || secs === undefined) return null
    if (secs <= 0) return null
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    return `${m}:${String(s).padStart(2,'0')}`
  }
  const countdownStr = formatCountdown(lockCountdown)
  const isUrgent = lockCountdown !== null && lockCountdown < 3600
  const isCritical = lockCountdown !== null && lockCountdown < 600

  // Single headline status banner — only the most relevant message is shown
  // at a time, picked in priority order, instead of stacking every banner.
  const streakAtRisk = userStreak >= 1 && openMatches.length > 0 && predictedCount === 0
  const headline =
    streakAtRisk                                  ? 'streak-risk' :
    missedRound && round === currentRound         ? 'missed-round' :
    round >= 34                                   ? 'phase-sprint' :
    (round >= 20 && round < 34)                   ? 'phase-two' :
    userStreak >= 5                               ? 'streak5' :
    userStreak === 4                              ? 'streak4' :
    userStreak === 3                              ? 'streak3' :
    hasRoundResults                               ? 'round-pts' :
    (userStreak >= 1 && userStreak <= 2)          ? 'streak-mini' :
    null

  return (
    <div className="page">
      <div className="content">
        <div className="round-nav">
          {/* circular: from round 1 go back to last round, and vice versa */}
          <button className="round-nav-btn" onClick={() => setRound(r => r <= 1 ? TOTAL_ROUNDS : r - 1)}>‹</button>
          <div className="round-label">מחזור {round}</div>
          <button className="round-nav-btn" onClick={() => setRound(r => r >= TOTAL_ROUNDS ? 1 : r + 1)}>›</button>
        </div>

        {/* Headline status banner — phase */}
        {headline === 'phase-sprint' && (
          <div className="phase-banner phase-sprint">⚡ ספרינט! {38 - round + 1} מחזורים אחרונים — מדויק = 7 נק׳, כיוון = 3 נק׳</div>
        )}
        {headline === 'phase-two' && (
          <div className="phase-banner phase-two">🔥 פאזה 2 — מדויק = 5 נק׳, כיוון = 2 נק׳</div>
        )}

        {/* Headline status banner — missed round loss framing */}
        {headline === 'missed-round' && (
          <div className="missed-round-card">
            <div className="missed-round-main">
              <span className="missed-round-icon">😤</span>
              <div>
                <div className="missed-round-title">פספסת מחזור {missedRound.round}</div>
                <div className="missed-round-sub">היו אפשריים עד {missedRound.possible} נק׳ — אל תפספס שוב!</div>
              </div>
            </div>
            <button className="missed-round-close" onClick={() => setMissedRound(null)}>✕</button>
          </div>
        )}

        {/* Round completion progress bar */}
        {openMatches.length > 0 && (
          <div className="round-progress-wrap">
            <div
              className={`round-progress-bar${predictedCount === openMatches.length ? ' complete' : ''}`}
              style={{ width: `${(predictedCount / openMatches.length) * 100}%` }}
            />
            <span className="round-progress-label">
              {predictedCount}/{openMatches.length} ניחושים
              {socialCount > 0 && <span className="round-social-count"> · 👥 {socialCount} שחקנים ניחשו</span>}
            </span>
          </div>
        )}

        {/* Countdown timer */}
        {countdownStr && openMatches.length > 0 && (
          <div className={`lock-countdown${isUrgent ? ' urgent' : ''}${isCritical ? ' critical' : ''}`}>
            🔒 ננעל בעוד <strong>{countdownStr}</strong>
            {isCritical && ' — מהר!'}
          </div>
        )}

        {/* Headline status banner — round points from finished matches */}
        {headline === 'round-pts' && (
          <div className="round-pts-chip">
            📊 {roundPts > 0 ? '+' : ''}{roundPts} נק׳ במחזור {round}
          </div>
        )}

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

        {/* Trash FOMO reveal */}
        {round === currentRound && openMatches.length > 0 && (
          trashUnlocked
            ? trashMessages.length > 0 && (
                <div className="trash-reveal-card">
                  <div className="trash-reveal-label">💬 מה אחרים כתבו</div>
                  {trashMessages.slice(0, 3).map((msg, i) => (
                    <div key={i} className="trash-reveal-msg">"{msg.message}"</div>
                  ))}
                </div>
              )
            : <div className="trash-fomo-card">👀 שמור ניחושים כדי לגלות מה אחרים כתבו...</div>
        )}

        {/* Headline status banner — streak at risk warning */}
        {headline === 'streak-risk' && (
          <div className="streak-risk-banner">
            <div>⚠️ יש לך סטרייק של {userStreak} {'🔥'.repeat(Math.min(userStreak,5))} — נחש לפני הנעילה כדי לשמור עליו!</div>
            {profile?.streak_shield !== false ? (
              <button className="shield-btn" onClick={() => activateStreakShield()}>🛡️ הפעל מגן</button>
            ) : (
              <span className="shield-used-tag">🛡️ מגן נוצל</span>
            )}
          </div>
        )}

        {headline === 'streak-mini' && (
          <div className="streak-mini">
            {'🔥'.repeat(userStreak)} {userStreak} ברצף — עוד {3 - userStreak} לבונוס
          </div>
        )}
        {headline === 'streak3' && (
          <div className="streak-banner streak-warning">
            🔥🔥🔥 3 ניחושים ברצף! הניחוש המדויק הבא יהיה שווה <strong>5 נקודות</strong>
          </div>
        )}
        {headline === 'streak4' && (
          <div className="streak-banner streak-bonus">
            🔥🔥🔥🔥 4 ברצף! ניחוש מדויק הבא = <strong>6 נקודות</strong>
          </div>
        )}
        {headline === 'streak5' && (
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
              // For live matches: calculate pts client-side (trigger only runs on finish)
              const dbPts      = hasScore && hasGuess ? (g.pts ?? null) : null
              const livePts    = live && hasGuess && hasScore
                ? calcPoints(parseInt(g.h), parseInt(g.a), m.home_score, m.away_score, g.joker, m.is_special, round, userStreak)
                : null
              const pts        = livePts ?? dbPts
              const isExact    = hasScore && hasGuess &&
                parseInt(g.h) === m.home_score && parseInt(g.a) === m.away_score
              const guessClass = isExact ? 'guess-exact'
                : (pts !== null && pts > 0) ? 'guess-dir'
                : (pts !== null && pts <= 0) ? 'guess-miss' : 'guess-none'
              const nearMissLabel = (() => {
                if (!hasGuess || !hasScore) return 'כמעט 😤'
                const hg = parseInt(g.h), ag = parseInt(g.a)
                const dirRight = Math.sign(m.home_score - m.away_score) === Math.sign(hg - ag)
                const dist = Math.abs(hg - m.home_score) + Math.abs(ag - m.away_score)
                if (dirRight && dist === 1) return 'כמעט! פספסת בגול אחד ⚽'
                if (dirRight) return 'כמעט! ניחשת נכון את הכיוון ⭐'
                return 'כמעט! הפרש של גול 😤'
              })()
              const isRMMatch       = m.home_team === 'Real Madrid' || m.away_team === 'Real Madrid'
              const others          = othersGuesses[m.id] || []

              return (
                <div className={`card${isThisJoker ? ' joker-card' : ''}${m.is_special ? ' special-card' : ''}${live ? ' live-match-card' : ''}${goalFlash.has(m.id) ? ' goal-flash' : ''}`} key={m.id}>
                  {m.is_special && <div className="special-strip">⭐ משחק מיוחד — ניחוש שווה כפל נקודות</div>}
                  <div className="match-header">
                    <span className="match-date">
                      {getStatusLabel(m.status) || formatKickoff(m.kickoff)}
                    </span>
                    {locked && !hasScore && <span className="badge badge-lock" style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)'}}>🔒 נעול</span>}
                  </div>
                  <div className="match-body">
                    <div className="match-body-inner">
                    <TeamDisplay name={m.away_team} />
                    <div className="score-wrap">
                      {hasScore ? (
                        <div className={`result-area${live ? ' result-live' : ''}${revealingMatches.has(m.id) ? ' revealing' : ''}`}>
                          <div className="result-col">
                            <span className="result-col-label">ניחוש</span>
                            <div style={{ position: 'relative' }}>
                              {matchAnims[m.id] === 'near-miss' && <span className="float-label near-miss-label">{nearMissLabel}</span>}
                              {matchAnims[m.id] === 'reversed' && <span className="float-label reversed-label">הפוך! 💀</span>}
                              <div className={`guess-chip ${guessClass}${matchAnims[m.id] ? ' ' + matchAnims[m.id] + '-anim' : ''}`}>{hasGuess ? `${g.h}:${g.a}` : '—'}</div>
                            </div>
                          </div>
                          <div className="result-sep" />
                          <div className="result-col">
                            <span className="result-col-label">{live ? 'לייב' : 'סופי'}</span>
                            <div className="final-score-chip" style={live && hasGuess ? {
                              color: guessClass === 'guess-exact' ? '#00E676' : guessClass === 'guess-dir' ? '#FDB927' : '#ff5252',
                              borderColor: guessClass === 'guess-exact' ? 'rgba(0,230,118,0.4)' : guessClass === 'guess-dir' ? 'rgba(253,185,39,0.4)' : 'rgba(255,82,82,0.4)',
                            } : {}}>{m.home_score}:{m.away_score}</div>
                          </div>
                          <div className="result-sep" />
                          <div className="result-col">
                            <span className="result-col-label">נק׳</span>
                            <PtsBadge pts={pts} isJoker={!!g.joker} isSpecial={!!m.is_special} round={round} isExact={isExact} />
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
                    {!effectiveLocked ? (
                      <button
                        className={`joker-side-btn${isThisJoker ? ' joker-active' : ''}${jokerTaken ? ' joker-taken' : ''}`}
                        onClick={() => { isThisJoker ? setJokerMatchId(null) : (!jokerTaken && activateJoker(m.id)) }}
                        title={isThisJoker ? 'לחץ להסרת ג׳וקר' : 'לחץ להפעלת ג׳וקר'}
                      >
                        <span>🃏</span>
                        <span className="joker-side-label">{isThisJoker ? 'ג׳וקר' : 'לחץ'}</span>
                      </button>
                    ) : g.joker ? (
                      <div className="joker-side-btn joker-active" style={{ cursor: 'default' }}>
                        <span>🃏</span>
                        <span className="joker-side-label">ג׳וקר</span>
                      </div>
                    ) : null}
                  </div>
                  {/* Penalty prediction — Real Madrid matches only */}
                  {isRMMatch && (
                    <div className="penalty-section">
                      {!effectiveLocked ? (
                        <>
                          <span className="penalty-label">🎯 ניחוש פנדל לריאל מדריד</span>
                          <button className="penalty-range-btn" onClick={() => setPenPickerMatchId(m.id)}>
                            <span>{g.penMin && g.penMax
                              ? (PEN_RANGES.find(r => r.min === parseInt(g.penMin) && r.max === parseInt(g.penMax))?.label ?? `${g.penMin}-${g.penMax}`)
                              : '1-17'}</span>
                            <span className="penalty-range-arrow">▼</span>
                          </button>
                        </>
                      ) : hasScore ? (() => {
                        const penEvents = (() => {
                          try {
                            const raw = m.penalty_events
                            return Array.isArray(raw) ? raw : JSON.parse(raw || '[]')
                          } catch { return [] }
                        })()
                        const allPens = penEvents.length > 0
                          ? penEvents
                          : m.penalty_minute != null ? [{ e: m.penalty_minute, x: null }] : []

                        if (allPens.length === 0) {
                          return finished
                            ? <div className="penalty-result pen-no">לא היה פנדל לריאל במשחק זה</div>
                            : null
                        }

                        const hasPred = g.penMin && g.penMax
                        const hits = hasPred
                          ? allPens.filter(p => checkPenaltyInRange(p.e, p.x, g.penMin, g.penMax)).length
                          : 0
                        const bonus = hits * 3
                        const minutesStr = allPens.map(p => `${p.e}${p.x ? `+${p.x}` : ''}`).join(', ')
                        const rangeLabel = hasPred
                          ? (PEN_RANGES.find(r => r.min === parseInt(g.penMin) && r.max === parseInt(g.penMax))?.label ?? `${g.penMin}-${g.penMax}`)
                          : null

                        return (
                          <div className="penalty-result">
                            <span>{allPens.length > 1 ? 'פנדלים בדקות' : 'פנדל בדקה'} {minutesStr} — </span>
                            {!hasPred
                              ? <span className="pen-no">לא ניחשת</span>
                              : bonus > 0
                                ? <span className="pen-hit">✅ +{bonus}נק׳{hits > 1 ? ` (${hits} פנדלים בטווח)` : ''}</span>
                                : <span className="pen-miss">❌ ניחשת {rangeLabel}</span>}
                          </div>
                        )
                      })() : g.penMin && g.penMax ? (
                        <div className="penalty-result pen-pending">
                          🎯 ניחשת: {PEN_RANGES.find(r => r.min === parseInt(g.penMin) && r.max === parseInt(g.penMax))?.label ?? `${g.penMin}-${g.penMax}`}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Guess distribution — only after match started (live or finished) */}
                  {(live || hasScore) && others.length > 0 && (() => {
                    const freq = {}
                    others.forEach(o => { const k = `${o.h}:${o.a}`; freq[k] = (freq[k] || 0) + 1 })
                    const total = others.length
                    const top5 = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,3)
                    const maxCount = top5[0][1]
                    return (
                      <>
                        <button className="others-toggle-btn dist-toggle-btn" onClick={() => setExpandedMatch(p => p === m.id ? null : m.id)}>
                          📊 הסתברות הימורים {expandedMatch === m.id ? '▲' : '▼'}
                        </button>
                        {expandedMatch === m.id && (
                          <div className="dist-list">
                            <div className="dist-subtitle">התוצאות שהימרו עליהן הכי הרבה במשחק זה</div>
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
          <button
            ref={saveBtnRef}
            className={`btn btn-primary btn-full save-btn${unsavedCount > 0 ? ' has-unsaved' : ''}`}
            onClick={saveAll}
            disabled={saving}
          >
            <span className="save-emoji">{saving ? '🎲' : '🎰'}</span>
            <span>
              {saving
                ? 'שומר...'
                : unsavedCount > 0
                  ? `שמור ${unsavedCount} ניחושים`
                  : 'שמור ניחושים'}
            </span>
            {unsavedCount > 0 && !saving && (
              <span className="unsaved-badge">{unsavedCount}</span>
            )}
          </button>
          <div className="save-msg">{saveMsg}</div>
        </div>
      )}
      {/* share card disabled — kept for future use */}

      {penPickerMatchId && (() => {
        const pg = guesses[penPickerMatchId] || {}
        const curMin = pg.penMin ? parseInt(pg.penMin) : 1
        const curMax = pg.penMax ? parseInt(pg.penMax) : 17
        return (
          <div className="modal-overlay" onClick={() => setPenPickerMatchId(null)}>
            <div className="pen-picker-modal modal-card" onClick={e => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setPenPickerMatchId(null)}>✕</button>
              <div className="pen-picker-title">🎯 הימוריאל</div>
              <div className="pen-picker-sub">באיזה טווח דקות יהיה פנדל לריאל?</div>
              <div className="pen-picker-options">
                {PEN_RANGES.map(r => (
                  <button
                    key={r.label}
                    className={`pen-picker-opt${curMin === r.min && curMax === r.max ? ' selected' : ''}`}
                    onClick={() => handlePenRange(penPickerMatchId, r.min, r.max)}
                  >{r.label}</button>
                ))}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
