# Test Plan — LaLigaGuess

## מצב נוכחי (76 בדיקות עוברות)

```
node scripts/tests/run-suite.js
```

| Suite | כיסוי נוכחי | בדיקות |
|-------|-------------|--------|
| `scoring.js` | פאזות 1/2/3, exact/dir/miss, joker בסיסי, is_special | 19 |
| `streak.js` | צבירה, +2/+3, שבירה, shield, joker+streak (streak=3,4) | 6 |
| `penalty.js` | חלונות בסיסי, כמה פנדלים, גבולות 45+3 ו-90+3 | 8 |
| `leaderboard.js` | עמודות, דלתות, round_leaderboard | 5 |
| `calcpoints.js` | calcPoints() unit tests כל הענפים | 38 |

---

## P1 — קריטי (ישפיע ישירות על ניקוד משתמשים)

### A. פנדלים — כיסוי מלא

> **עיקרון בסיסי:** `points` ו-`penalty_bonus` הם **עמודות עצמאיות לחלוטין**.
> שני טריגרים נפרדים — `update_match_points` ו-`update_penalty_bonus`.
> בטבלת הדירוג: `total = sum(points) + sum(penalty_bonus)`.
> פנדל יכול להוסיף +3 גם כשה-match points הם -3 → total = 0.

#### A1. כל 6 החלונות — גבולות ראשון ואחרון של כל חלון

| # | תרחיש | ציפייה |
|---|--------|--------|
| A1.1 | פנדל דקה 1 בחלון 1-17 | penalty=3 |
| A1.2 | פנדל דקה 17 (אחרון) בחלון 1-17 | penalty=3 |
| A1.3 | פנדל דקה 18 (חלון 18-32) | penalty=3 |
| A1.4 | פנדל דקה 32 (אחרון) בחלון 18-32 | penalty=3 |
| A1.5 | פנדל דקה 33 (ראשון) בחלון 33-45 | penalty=3 |
| A1.6 | פנדל 45+5 (elapsed=45) — נכלל ב-33-45 | penalty=3 |
| A1.7 | פנדל דקה 46 (ראשון) בחלון 46-62 | penalty=3 |
| A1.8 | פנדל דקה 62 (אחרון) בחלון 46-62 | penalty=3 |
| A1.9 | פנדל דקה 63 (ראשון) בחלון 63-77 | penalty=3 |
| A1.10 | פנדל דקה 77 (אחרון) בחלון 63-77 | penalty=3 |
| A1.11 | פנדל דקה 78 (ראשון) בחלון 78-90 | penalty=3 |
| A1.12 | פנדל 90+7 (elapsed=97) — נכלל ב-78-90 (ללא תקרה) | penalty=3 |
| A1.13 | פנדל דקה 18, ניחוש חלון 1-17 — ממש מחוץ | penalty=0 |
| A1.14 | פנדל דקה 46, ניחוש חלון 33-45 — ממש מחוץ | penalty=0 |
| A1.15 | פנדל דקה 78, ניחוש חלון 63-77 — ממש מחוץ | penalty=0 |

**Suite:** `penalty.js` → `"all-windows boundary suite"`

#### A2. פנדל + תוצאת הניחוש (עצמאות מלאה)

| # | ניחוש | תוצאה | penalty | points | total |
|---|-------|--------|---------|--------|-------|
| A2.1 | exact | hit בחלון | +3 | 3 | **6** |
| A2.2 | direction | hit בחלון | +3 | 1 | **4** |
| A2.3 | miss | hit בחלון | +3 | 0 | **3** ← פנדל עוזר גם ב-miss |
| A2.4 | exact | ללא חלון | 0 | 3 | 3 |
| A2.5 | exact | חלון שגוי | 0 | 3 | 3 |

**Suite:** `penalty.js` → `"penalty bonus is independent of match prediction outcome"`

#### A3. פנדל + ג'וקר (כל שילובי הג'וקר)

| # | ג'וקר | ניחוש | תוצאה | streak | points | penalty | total |
|---|-------|-------|--------|--------|--------|---------|-------|
| A3.1 | ✓ | exact | hit | 0 | 6 | 3 | **9** |
| A3.2 | ✓ | direction (נכון) | hit | 0 | 0 | 3 | **3** ← אפס+פנדל |
| A3.3 | ✓ | כיוון שגוי | hit | 0 | -1 | 3 | **2** ← שלילי+פנדל |
| A3.4 | ✓ | כיוון שגוי | hit | ≥3 | -3 | 3 | **0** ← חשוב! |

**Suite:** `penalty.js` → `"joker × penalty_bonus combinations"`

#### A4. פנדל + סטריק

| # | ניחוש | streak_count | points | penalty | total |
|---|-------|--------------|--------|---------|-------|
| A4.1 | exact | 3 | 5 | 3 | **8** |
| A4.2 | exact | 4 | 6 | 3 | **9** |
| A4.3 | exact | 2 | 3 | 3 | **6** ← אין בונוס עדיין |

**Suite:** `penalty.js` → `"streak bonus stacks independently with penalty_bonus"`

#### A5. פנדל + ג'וקר + סטריק — הקומבינציה המלאה

| # | תרחיש | streak | points | penalty | total |
|---|--------|--------|--------|---------|-------|
| A5.1 | joker exact | 3 | 8 (3×2+2) | 3 | **11** |
| A5.2 | joker exact | 4 | 9 (3×2+3) | 3 | **12** |
| A5.3 | joker exact R20 | 3 | 12 (5×2+2) | 3 | **15** |
| A5.4 | joker exact R20 | 4 | 13 (5×2+3) | 3 | **16** |
| A5.5 | joker כיוון שגוי | 3 | -3 | 3 | **0** |
| A5.6 | joker כיוון שגוי | 3 | -3 | 6 (2 hits) | **3** |

**Suite:** `penalty.js` → `"full combo: joker + streak + penalty_bonus"`

---

### B. מעבר שלבים — R19→R20 ו-R33→R34

> **עיקרון:** הסטריק **ממשיך ללא הפרעה** דרך מעברי פאזה.
> מה שמשתנה הוא `base_exact` — לא הסטריק עצמו.
> **גילוי:** `is_special` **לא מקבל** בונוס סטריק (ראה B6).

#### B1. R19→R20 — סטריק עובר בין פאזות

| # | מחזור | ניחוש | streak_count | pts |
|---|-------|-------|--------------|-----|
| B1.1 | R17 | exact | 0 | 3 |
| B1.2 | R18 | exact | 1 | 3 |
| B1.3 | R19 | exact | 2 | 3 |
| B1.4 | **R20** | exact | 3 | **7 (5+2)** ← סטריק שרד + בייס חדש |
| B1.5 | R20 | exact | 4 | **8 (5+3)** |

**מה זה בודק:** בגלל שהסטריק מחושב לפי כל המשחקים הקודמים ללא קשר לפאזה, ה-+2 מגיע כבר ב-R20 למי שצבר 3 exacts ב-R17-R19.
**Suite:** `streak.js` → `"streak carries across phase 1→2 boundary"`

#### B2. R33→R34 — סטריק עובר לפאזה 3

| # | מחזור | ניחוש | streak_count | pts |
|---|-------|-------|--------------|-----|
| B2.1 | R32 | exact | 3 | 7 (5+2) |
| B2.2 | R33 | exact | 4 | 8 (5+3) |
| B2.3 | **R34** | exact | 5 | **10 (7+3)** ← גם exact=7 וגם בונוס |

**Suite:** `streak.js` → `"streak carries across phase 2→3 boundary"`

#### B3. ג'וקר + מעבר פאזה

| # | תרחיש | streak | pts |
|---|--------|--------|-----|
| B3.1 | joker exact **R19** (last of phase 1), streak=4 | 4 | 3×2+3 = **9** |
| B3.2 | joker exact **R20** (first of phase 2), streak=4 | 4 | 5×2+3 = **13** ← קפיצה! |
| B3.3 | joker exact **R33** (last of phase 2), streak=3 | 3 | 5×2+2 = **12** |
| B3.4 | joker exact **R34** (first of phase 3), streak=3 | 3 | 7×2+2 = **16** |

**Suite:** `streak.js` → `"joker exact at phase boundaries with streak bonus"`

#### B4. is_special — אין בונוס סטריק (מוסתר!)

```
DB trigger: is_special branch uses calculate_points() * 2
calculate_points() returns base_exact (no streak).
→ is_special NEVER gets streak bonus, even with streak=5.
```

| # | תרחיש | streak | pts ציפייה | הערה |
|---|--------|--------|------------|------|
| B4.1 | is_special exact R10 | 0 | 6 (3×2) | ✓ |
| B4.2 | is_special exact R10 | 3 | **6** (3×2, לא 8) | ← ללא בונוס! |
| B4.3 | is_special exact R10 | 4 | **6** (3×2, לא 9) | ← ללא בונוס! |
| B4.4 | is_special exact R20 | 4 | **10** (5×2, לא 13) | ← ללא בונוס! |

**Suite:** `scoring.js` → `"is_special exact does NOT receive streak bonus"`

#### B5. ג'וקר + is_special — ג'וקר מנצח

```
Trigger: if rec.is_joker → joker branch (is_special ignored entirely)
→ joker+is_special = joker logic, NOT is_special×2 doubling.
```

| # | תרחיש | streak | pts |
|---|--------|--------|-----|
| B5.1 | joker exact + is_special match R10 | 0 | 6 (3×2) — כמו joker רגיל |
| B5.2 | joker direction + is_special match | 0 | **0** (לא dir×4=4) |
| B5.3 | joker exact + is_special R10 + streak=3 | 3 | **8** (3×2+2) — בונוס joker כן |

**Suite:** `scoring.js` → `"joker takes precedence over is_special"`

---

## P2 — חשוב (ישפיע אם התרחיש מתרחש)

### C. ריבוי משתמשים ועדכונים

#### C1. 5 משתמשים — אותו משחק, טריגר אחד
**מה:** exact, direction-home, direction-away, draw-miss, miss → תוצאה 2-1.
**למה:** הטריגר רץ ב-loop. אם overwrite שגוי — רק בדיקה עם כמה users יגלה.
```
suite: scoring.js → "5 users on same match scored correctly in single trigger run"
```

#### C2. תיקון תוצאה
**מה:** תוצאה 2-1 → טריגר → תיקון ל-1-2 → טריגר שני. משתמש A (exact ל-2-1) יורד מ-3 ל-0. משתמש B (exact ל-1-2) עולה מ-0 ל-3.
```
suite: scoring.js → "score correction recalculates all predictions correctly"
```

#### C3. שינוי ניחוש לפני תוצאה (upsert)
**מה:** ניחש 2-1, מחליף ל-1-0, תוצאה 2-1 → מקבל 1 (direction) ולא 3 (exact).
**למה:** ודא שאין שני records ל-user_id+match_id אחרי upsert.
```
suite: scoring.js → "prediction upsert: latest guess replaces old, no duplicate rows"
```

### D. Streak Views & RPCs

#### D1. current_streak_view — מדויק אחרי שבירה
**מה:** בנה streak של 4 בשנת 2030 (kickoffs עתידיים = הכי חדשים). miss → exact. view מחזיר 1.
**קושי:** ה-view כולל את כל ה-predictions של המשתמש. כדי לבודד, השתמש ב-2030 kickoffs (יהיו הכי חדשים).
```
suite: streak.js → "current_streak_view accurate after break and restart"
```

#### D2. get_max_streak RPC — שיא היסטורי
**מה:** קבל baseline, בנה streak ארוך יותר, ודא שה-RPC מחזיר את השיא.
```
suite: streak.js → "get_max_streak RPC returns historical peak, not current streak"
```

#### D3. Same-kickoff — result_at כ-tiebreaker
**מה:** M1 ו-M2 — אותו kickoff בדיוק. Score M1 ראשון (result_at(M1) קדום). M3 (אותו kickoff) scored אחרון.
- עבור M3: M1 ו-M2 ייכללו בספירת הסטריק (result_at < M3.result_at)
- אם M2 = miss → שובר סטריק ל-M3 אפילו שאותו kickoff
```
suite: streak.js → "same-kickoff matches ordered by result_at for streak calculation"
```

### E. getBonusBreakdown — פירוט בונוסים

#### E1. פירוק נכון לשלושה סלים
**מה:** משתמש עם: normal exact (3), joker exact (+3 extra=joker), streak bonus (+2), penalty (+3).
**ציפייה:** `{ penalty: 3, joker: 3, streak: 2 }`.
**באג ידוע לבדוק:** joker direction hit (0 pts) — הנוסחה שולחת -2*dir לסל streak. האם זה מכוון?
```
suite: leaderboard.js → "getBonusBreakdown splits penalty/joker/streak correctly"
```

#### E2. ג'וקר שגוי (-1) — מופיע בסל streak
**מה:** joker wrong direction → points=-1. basePts=0, jokerExtra=0 → streak+=-1. הפירוק: `{ streak: -1 }`.
```
suite: leaderboard.js → "joker miss appears as negative in streak bucket"
```

### F. score_90 + lateGoalPtsLost

**מה:** Match עם score_90={home:2,away:2} ו-home_score=3, away_score=2 (פנדל ב-93').
משתמש ניחש 2-2 → exact ב-score_90, miss בתוצאה הסופית.
`lateGoalPtsLost` ב-ProfilePage.jsx שורה 262-271 → צריך לחשב +3.
**הערה:** test unit ל-calcPoints (ללא DB rendering).
```
suite: calcpoints.js → "lateGoalPtsLost: exact at score_90 but miss at final"
```

### G. Leaderboard quirks

#### G1. joker direction hit → miss_count, לא direction_count
`leaderboard_view` מסמן direction רק כשה-`points > 0`. joker direction = 0 → miss_count.
```
suite: leaderboard.js → "joker direction hit (0 pts) counted in miss_count"
```

#### G2. total_points שלילי → נדחה לתחתית
joker miss + streak≥3 → points=-3. הדירוג שם אותו בתחתית.
```
suite: leaderboard.js → "user with negative total_points ranked below zero"
```

---

## P3 — נמוך / UI

### H. War Room (LivePage) — unit ו-manual

#### H1. guessResult() — סיווג נכון (unit, ללא DB)
```javascript
// src/pages/LivePage.jsx:37
function guessResult(g, m)  // → 'exact' | 'dir' | 'miss' | 'none'
```
| # | ניחוש | תוצאה | ציפייה |
|---|-------|--------|--------|
| H1.1 | 2-1 | 2-1 | 'exact' |
| H1.2 | 1-0 | 2-0 | 'dir' |
| H1.3 | 0-1 | 2-0 | 'miss' |
| H1.4 | 1-1 | 0-0 | 'dir' (draw=draw) |
| H1.5 | ללא ניחוש | 2-0 | 'none' |
| H1.6 | 2-1 | score=null | 'none' (טרם נגמר) |

**Suite:** `calcpoints.js` → `"guessResult() LivePage classification"`

#### H2. livePoints() — תמיד streak=0 (עיצוב מכוון)
```javascript
// LivePage:48 — calcPoints(..., streak=0) by design
```
`* נקודות משוערות — ללא בונוס סטרייק` מוצג בממשק.
- joker exact R10 → 6 (לא 8/9 גם אם יש streak)
- is_special exact R10 → 6 (streak לא משנה כאן בכל מקרה)
- joker wrong dir → -1 (streak=0, אף פעם לא -3)

**Suite:** `calcpoints.js` → `"livePoints() always ignores streak (by design)"`

#### H3. Ranking בחדר מלחמה — livePts + seasonRank tiebreak
```javascript
// LivePage:136
.sort((a, b) => b.livePts - a.livePts || a.seasonRank - b.seasonRank)
```
- User A livePts=6, seasonRank=3 vs User B livePts=6, seasonRank=1 → B comes first
- User C livePts=0 → below users with positive livePts

**Suite:** `calcpoints.js` → `"war room ranking: livePts desc, seasonRank tiebreak"`

#### H4. Manual checklist — חדר מלחמה (דורש browser)
- [ ] עמוד מוצג "אין משחקים בלייב" כשאין משחקים בסטטוס LIVE
- [ ] כשמשחק עובר לסטטוס '1H' — מופיע בטבלה
- [ ] ניחוש exact → תא ירוק, direction → צהוב, miss → אדום
- [ ] icon 🃏 מופיע ליד ניחוש עם ג'וקר
- [ ] שחקן ללא ניחוש → "—" בתא
- [ ] עצמי (is_me) → שורה מודגשת
- [ ] נקודות שליליות → chip אדום
- [ ] realtime: שינוי score בDB → מתעדכן ב-UI ללא refresh

### I. RLS (Security)

#### I1. ניסיון לנחש אחרי נעילה (anon key)
INSERT על משחק עם kickoff בעבר → 403.
**דורש:** anon key ב-`.env.test.secrets` + session management.

#### I2. Joker כפול — האם DB מאפשר?
שני is_joker=true באותו round לאותו user. DB אין UNIQUE constraint.
**אם עובר → צריך להוסיף constraint.**

#### I3. ניחוש גלוי לאחרים רק אחרי נעילה
User B (anon) → SELECT על ניחוש User A → אמור להיכשל לפני kickoff, להצליח אחרי status='FT'.

---

## isMatchLocked() — גבולות זמן

| # | זמן | ציפייה |
|---|-----|--------|
| L1 | 2 דקות לפני kickoff | false (פתוח) |
| L2 | 61 שניות לפני kickoff | false |
| L3 | 60 שניות לפני kickoff | true (נעול) |
| L4 | 30 שניות לפני kickoff | true |
| L5 | בדיוק בקיקאוף | true |

**Suite:** `calcpoints.js` → `"isMatchLocked() 1-minute boundary"`

---

## סדר יישום מומלץ

```
Phase 1 (DB trigger correctness):
  A2  → penalty + prediction independence
  A3  → penalty + joker combos
  A4  → penalty + streak
  A5  → full combo
  B1  → phase transition R19→R20 with streak
  B4  → is_special no streak bonus  ← גילוי חשוב!
  B5  → joker overrides is_special

Phase 2 (multi-user + views):
  C1  → 5 users parallel
  C2  → score correction
  D1  → current_streak_view
  D2  → get_max_streak

Phase 3 (UI unit tests, no DB):
  H1  → guessResult()
  H2  → livePoints() streak=0
  H3  → war room ranking
  L1-5 → isMatchLocked() boundaries

Phase 4 (boundary completeness):
  A1  → all 6 windows first/last minute
  B2  → R33→R34 transition
  B3  → joker at phase boundaries

Phase 5 (later):
  E1  → getBonusBreakdown
  F   → score_90 + lateGoalPtsLost
  I1-3 → RLS security
  H4  → manual browser checklist
```

---

## סטיות ידועות (אל תתקן בלי כוונה)

| נושא | DB טריגר (אמיתי) | calcPoints() (preview) |
|------|-----------------|------------------------|
| Streak +2 | `>= 3` | `>= 4` |
| Streak +3 | `>= 4` | `>= 5` |
| Joker miss × -3 | `>= 3` streak | `>= 4` streak |
| Joker exact streak bonus | +2 at ≥3, +3 at ≥4 | +1 at ≥4, +3 at ≥5 |
| is_special + streak | **אין בונוס** | אין בונוס ✓ (שניהם) |
| Joker + is_special | joker לוקח עדיפות | joker לוקח עדיפות ✓ |
| livePoints streak | תמיד streak=0 | — (עיצוב מכוון) |
| leaderboard direction_count | `points > 0` בלבד | joker dir hit = miss |
