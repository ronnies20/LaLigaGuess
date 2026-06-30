import { getPhaseBase, CURRENT_ROUND } from '../lib/teams'

function Row({ icon, iconBg, iconColor, iconBorder, iconShadow, fontSize, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
      <span style={{
        width: 32, height: 32, borderRadius: '50%', background: iconBg, color: iconColor,
        border: iconBorder, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: fontSize || 14, flexShrink: 0, boxShadow: iconShadow,
      }}>{icon}</span>
      <span style={{ color: '#EEEEFF', flex: 1 }}>{children}</span>
    </div>
  )
}

export default function RulesPage() {
  const { exact, dir } = getPhaseBase(CURRENT_ROUND)

  return (
    <div className="page">
      <div className="content">
        <div className="section-title" style={{ marginTop: 8 }}>חוקים</div>

        <div className="card-section" style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div style={{ color: '#FDB927', fontWeight: 700, marginBottom: 10, fontSize: 12 }}>
            ניקוד בסיס — מחזור {CURRENT_ROUND}
          </div>
          <Row icon={exact} iconBg="linear-gradient(135deg,#00C853,#00E676)" iconColor="#fff"
               iconShadow="0 0 12px rgba(0,230,118,0.5)">
            תוצאה מדויקת — ניחשת 2:1 ויצא 2:1
          </Row>
          <Row icon={dir} iconBg="linear-gradient(135deg,#FFE566,#C4901A)" iconColor="#000"
               iconShadow="0 0 12px rgba(253,185,39,0.5)">
            כיוון נכון — ניצחון/תיקו/הפסד נכון, תוצאה שגויה
          </Row>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,23,68,0.15)', color: '#FF1744', border: '1px solid rgba(255,23,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>0</span>
            <span style={{ color: '#7060A0', textAlign: 'center', flex: 1 }}>ניחוש שגוי לחלוטין</span>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10, marginBottom: 12, fontSize: 12 }}>
            <div style={{ color: '#A855F7', fontWeight: 700, marginBottom: 6 }}>הניקוד עולה ככל שהעונה מתקדמת:</div>
            <div style={{ color: '#7060A0' }}>מחזורים 1–19: מדויק 3 / כיוון 1</div>
            <div style={{ color: '#7060A0' }}>מחזורים 20–33: מדויק 5 / כיוון 2</div>
            <div style={{ color: '#7060A0' }}>מחזורים 34–38 (ספרינט אחרון): מדויק 7 / כיוון 3</div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12, marginBottom: 10 }}>
            <Row icon="🃏" iconBg="rgba(255,100,0,0.15)" iconColor="#FF7A00" fontSize={18}>
              ג׳וקר — מדויק = פי 2 מניקוד הבסיס (כרגע {exact * 2} נק׳), טעות = −1 נק׳ (−3 אם אתה בסטרייק של 4+). אחד לכל מחזור
            </Row>
            <Row icon="⭐" iconBg="rgba(255,200,0,0.15)" iconColor="#FFD700" fontSize={18}>
              משחק מיוחד — הנקודות מוכפלות ×2
            </Row>
            <Row icon="🔥" iconBg="rgba(255,100,0,0.15)" iconColor="#FF6600" fontSize={18}>
              סטרייק — 4 מדויקות ברצף = בונוס +2 נק׳, 5+ ברצף = בונוס +3 נק׳ (מעל ניקוד הבסיס)
            </Row>
            <Row icon="🛡️" iconBg="rgba(168,85,247,0.15)" iconColor="#C084FC" fontSize={18}>
              מגן סטרייק — פעם אחת בעונה, מגן על הרצף שלך גם אם תפספס מחזור
            </Row>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,200,100,0.15)', color: '#00C864', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🎯</span>
              <span style={{ color: '#EEEEFF', flex: 1 }}>פנדל ריאל — ניחוש הדקה הנכונה = +3 נק׳ בונוס</span>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,100,0,0.08)', borderRadius: 8, fontSize: 12, color: '#FF7A00', border: '1px solid rgba(255,100,0,0.15)', textAlign: 'center' }}>
            🔒 ניחושים ננעלים שעה לפני תחילת כל משחק
          </div>
        </div>
      </div>
    </div>
  )
}
