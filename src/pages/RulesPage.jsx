export default function RulesPage() {
  return (
    <div className="page">
      <div className="content">
        <div className="section-title" style={{ marginTop: 8 }}>חוקים</div>
        <div className="card-section" style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div style={{ display:'flex', gap:10, marginBottom:10, alignItems:'center' }}>
            <span style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#00C853,#00E676)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0, boxShadow:'0 0 12px rgba(0,230,118,0.5)' }}>3</span>
            <span style={{ color:'#EEEEFF', textAlign:'center', flex:1 }}>תוצאה מדויקת — ניחשת 2:1 ויצא 2:1</span>
          </div>
          <div style={{ display:'flex', gap:10, marginBottom:10, alignItems:'center' }}>
            <span style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#FFE566,#C4901A)', color:'#000', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0, boxShadow:'0 0 12px rgba(253,185,39,0.5)' }}>1</span>
            <span style={{ color:'#EEEEFF', textAlign:'center', flex:1 }}>כיוון נכון — ניצחון/תיקו/הפסד נכון, תוצאה שגויה</span>
          </div>
          <div style={{ display:'flex', gap:10, marginBottom:12, alignItems:'center' }}>
            <span style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,23,68,0.15)', color:'#FF1744', border:'1px solid rgba(255,23,68,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0 }}>0</span>
            <span style={{ color:'#7060A0', textAlign:'center', flex:1 }}>ניחוש שגוי לחלוטין</span>
          </div>

          <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:12, marginBottom:10 }}>
            <div style={{ display:'flex', gap:10, marginBottom:10, alignItems:'center' }}>
              <span style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,100,0,0.15)', color:'#FF7A00', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🃏</span>
              <span style={{ color:'#EEEEFF', flex:1 }}>ג׳וקר — מדויק = 6 נק׳, טעות = −1 נק׳. אחד לכל מחזור</span>
            </div>
            <div style={{ display:'flex', gap:10, marginBottom:10, alignItems:'center' }}>
              <span style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,200,0,0.15)', color:'#FFD700', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>⭐</span>
              <span style={{ color:'#EEEEFF', flex:1 }}>משחק מיוחד — הנקודות מוכפלות ×2</span>
            </div>
            <div style={{ display:'flex', gap:10, marginBottom:10, alignItems:'center' }}>
              <span style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,100,0,0.15)', color:'#FF6600', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🔥</span>
              <span style={{ color:'#EEEEFF', flex:1 }}>סטרייק — 3 מדויקות ברצף = חיווי, 4 = 5 נק׳, 5+ = 6 נק׳</span>
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <span style={{ width:32, height:32, borderRadius:'50%', background:'rgba(0,200,100,0.15)', color:'#00C864', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🎯</span>
              <span style={{ color:'#EEEEFF', flex:1 }}>פנדל ריאל — ניחוש הדקה הנכונה = +3 נק׳ בונוס</span>
            </div>
          </div>

          <div style={{ marginTop:12, padding:'10px 12px', background:'rgba(255,100,0,0.08)', borderRadius:8, fontSize:12, color:'#FF7A00', border:'1px solid rgba(255,100,0,0.15)', textAlign:'center' }}>
            🔒 ניחושים ננעלים 5 דקות לפני תחילת כל משחק
          </div>
        </div>
      </div>
    </div>
  )
}
