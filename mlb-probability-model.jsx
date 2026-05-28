import { useState, useCallback, useRef } from "react";

// ─── TEAMS ───────────────────────────────────────────────────────────────────
const MLB_TEAMS = [
  "Arizona Diamondbacks","Atlanta Braves","Baltimore Orioles","Boston Red Sox",
  "Chicago Cubs","Chicago White Sox","Cincinnati Reds","Cleveland Guardians",
  "Colorado Rockies","Detroit Tigers","Houston Astros","Kansas City Royals",
  "Los Angeles Angels","Los Angeles Dodgers","Miami Marlins","Milwaukee Brewers",
  "Minnesota Twins","New York Mets","New York Yankees","Oakland Athletics",
  "Philadelphia Phillies","Pittsburgh Pirates","San Diego Padres","San Francisco Giants",
  "Seattle Mariners","St. Louis Cardinals","Tampa Bay Rays","Texas Rangers",
  "Toronto Blue Jays","Washington Nationals",
];

// ─── MODEL FACTORS ────────────────────────────────────────────────────────────
const CORE = [
  { id:"SP",    label:"Starting Pitcher",    weight:24, desc:"ERA / xERA / FIP / K-rate" },
  { id:"SPLIT", label:"Handedness Split",    weight:22, desc:"Team wOBA vs LHP/RHP" },
  { id:"BP",    label:"Bullpen Strength",    weight:16, desc:"Usage, fatigue, reliability" },
  { id:"LU",    label:"Lineup Quality",      weight:14, desc:"Top-to-bottom offensive depth" },
  { id:"EV",    label:"Exit Velocity / EV%", weight:10, desc:"Barrel %, HardHit %, launch" },
];
const CTX = [
  { id:"HOME",   label:"Home / Away",    weight:4, desc:"Venue splits" },
  { id:"SERIES", label:"Series Context", weight:3, desc:"G1 / G2 / rubber match" },
  { id:"REST",   label:"Rest & Travel",  weight:2, desc:"Fatigue / travel penalty" },
  { id:"UMP",    label:"Umpire Zone",    weight:2, desc:"Tight vs hitter-friendly" },
  { id:"WX",     label:"Weather / Wind", weight:2, desc:"Wind out/in, humidity, temp" },
  { id:"DAY",    label:"Day / Night",    weight:1, desc:"Time-slot splits" },
];
const MOM = [
  { id:"MOM",      label:"Team Momentum",   desc:"Win/loss trajectory" },
  { id:"HOT",      label:"Hot Bats",        desc:"Active hitting streaks" },
  { id:"COLD",     label:"Slump Detection", desc:"Offensive cold spells" },
  { id:"BP_TREND", label:"Bullpen Trend",   desc:"Directional bullpen form" },
  { id:"FORM",     label:"7-14 Day Form",   desc:"Rolling team performance" },
];
const VOL_MARKERS = [
  { id:"DIV",     label:"Divisional Rival",    desc:"Higher variance" },
  { id:"EXTRA",   label:"Extra Innings Prev.", desc:"Carry-over fatigue" },
  { id:"PEN",     label:"Bullpen Depleted",    desc:"Heavy usage flag" },
  { id:"REST_LU", label:"Resting Starters",   desc:"Lineup integrity risk" },
  { id:"STREAK",  label:"Streak Warning",      desc:"Unsustainable pattern" },
];
const ALL_FACTOR_IDS = [...CORE, ...CTX, ...MOM].map(f => f.id);

const clamp = (v, lo=0, hi=100) => Math.max(lo, Math.min(hi, v));
const initSliders = () => Object.fromEntries(ALL_FACTOR_IDS.map(id => [id, 50]));
const initVol     = () => Object.fromEntries(VOL_MARKERS.map(m => [m.id, false]));

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#04101e", panel:"#071928", border:"#0e2d47",
  accent:"#38bdf8", orange:"#f97316", green:"#22c55e",
  yellow:"#facc15", red:"#ef4444", muted:"#475569",
  text:"#e2e8f0", subtext:"#94a3b8",
};

// ─── SLIDER ───────────────────────────────────────────────────────────────────
function Slider({ id, value, onChange, color="#38bdf8", disabled=false }) {
  return (
    <input type="range" min={0} max={100} step={1} value={value} disabled={disabled}
      onChange={e => onChange(id, +e.target.value)}
      style={{ width:"100%", height:4, cursor: disabled?"not-allowed":"pointer",
        accentColor:color, outline:"none", border:"none", background:"transparent",
        opacity: disabled ? 0.4 : 1 }} />
  );
}

// ─── TOGGLE CHIP ──────────────────────────────────────────────────────────────
function Toggle({ active, onClick, label, color=C.red }) {
  return (
    <button onClick={onClick} style={{
      padding:"4px 10px", borderRadius:4,
      border:`1px solid ${active ? color : C.border}`,
      background: active ? color+"22" : "transparent",
      color: active ? color : C.muted,
      fontSize:11, fontFamily:"inherit", cursor:"pointer", transition:"all .15s",
      fontWeight: active?600:400, letterSpacing:"0.03em",
    }}>{label}</button>
  );
}

// ─── CONF BAR ─────────────────────────────────────────────────────────────────
function ConfBar({ value, color }) {
  return (
    <div style={{ background:"#0a1929", borderRadius:3, height:6, overflow:"hidden", marginTop:4 }}>
      <div style={{ width:`${value}%`, height:"100%",
        background:`linear-gradient(90deg,${color}66,${color})`,
        borderRadius:3, transition:"width .4s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

// ─── WIN ARC ──────────────────────────────────────────────────────────────────
function WinArc({ prob, teamA, teamB }) {
  const size=200, r=78, stroke=13;
  const circ = Math.PI * r;
  const dashA = (prob/100)*circ;
  return (
    <div style={{ position:"relative", width:size, height:size/2+32, margin:"0 auto" }}>
      <svg width={size} height={size/2+stroke} viewBox={`0 0 ${size} ${size/2+stroke}`}>
        <path d={`M ${stroke/2} ${size/2} A ${r} ${r} 0 0 1 ${size-stroke/2} ${size/2}`}
          fill="none" stroke="#0a1929" strokeWidth={stroke} strokeLinecap="round"/>
        <path d={`M ${stroke/2} ${size/2} A ${r} ${r} 0 0 1 ${size-stroke/2} ${size/2}`}
          fill="none" stroke={C.orange} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${circ}`} strokeDashoffset={0}/>
        <path d={`M ${stroke/2} ${size/2} A ${r} ${r} 0 0 1 ${size-stroke/2} ${size/2}`}
          fill="none" stroke={C.accent} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dashA} ${circ}`} strokeDashoffset={0}
          style={{ transition:"stroke-dasharray .5s cubic-bezier(.4,0,.2,1)" }}/>
      </svg>
      <div style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", textAlign:"center", whiteSpace:"nowrap" }}>
        <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", textTransform:"uppercase" }}>Win Probability</div>
        <div style={{ display:"flex", gap:16, justifyContent:"center", marginTop:3 }}>
          <span style={{ color:C.accent, fontWeight:700, fontSize:22 }}>{Math.round(prob)}%</span>
          <span style={{ color:C.border, fontSize:22 }}>—</span>
          <span style={{ color:C.orange, fontWeight:700, fontSize:22 }}>{100-Math.round(prob)}%</span>
        </div>
        <div style={{ display:"flex", gap:16, justifyContent:"center", marginTop:1 }}>
          <span style={{ color:C.accent, fontSize:11, fontWeight:600, maxWidth:80, overflow:"hidden", textOverflow:"ellipsis" }}>{teamA||"HOME"}</span>
          <span style={{ color:C.orange, fontSize:11, fontWeight:600, maxWidth:80, overflow:"hidden", textOverflow:"ellipsis" }}>{teamB||"AWAY"}</span>
        </div>
      </div>
    </div>
  );
}

// ─── MOM EMOJI ────────────────────────────────────────────────────────────────
function MomEmoji({ val }) {
  if (val>=80) return <span>🔥</span>;
  if (val>=60) return <span>📈</span>;
  if (val>=40) return <span>⚠️</span>;
  if (val>=20) return <span>❄️</span>;
  return <span>💀</span>;
}

// ─── TEAM SELECT ──────────────────────────────────────────────────────────────
function TeamSelect({ value, onChange, color, placeholder }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} style={{
      background:C.panel, border:`1.5px solid ${value?color:C.border}`,
      borderRadius:6, padding:"7px 12px", color: value?color:C.muted,
      fontFamily:"inherit", fontSize:12, fontWeight:600, width:"100%",
      outline:"none", cursor:"pointer", appearance:"none",
      backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='${encodeURIComponent(C.muted)}'/%3E%3C/svg%3E")`,
      backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center",
    }}>
      <option value="">{placeholder}</option>
      {MLB_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
    </select>
  );
}

// ─── STAT CHIP ────────────────────────────────────────────────────────────────
function StatChip({ label, val, color }) {
  return (
    <div style={{ background:"#040e1a", borderRadius:4, padding:"4px 8px",
      border:`1px solid ${C.border}`, display:"inline-flex", flexDirection:"column", alignItems:"center", minWidth:54 }}>
      <span style={{ fontSize:8, color:C.muted, letterSpacing:"0.1em" }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:700, color: color||C.text }}>{val}</span>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function MLBModel() {
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [sliders, setSliders] = useState(initSliders());
  const [vol, setVol]         = useState(initVol());
  const [status, setStatus]   = useState("idle"); // idle | loading | done | error
  const [log, setLog]         = useState([]);
  const [rawStats, setRawStats] = useState(null);
  const abortRef = useRef(null);

  // ── compute output ──────────────────────────────────────────────────────────
  const compute = (s=sliders, v=vol) => {
    let raw=0, total=0;
    [...CORE,...CTX].forEach(f=>{ raw+=(s[f.id]/100)*f.weight; total+=f.weight; });
    const momAvg = MOM.reduce((a,f)=>a+s[f.id],0)/MOM.length;
    raw += (momAvg/100)*5; total+=5;
    const winProb = clamp((raw/total)*100, 10, 90);
    let conf=50;
    if(s.SP>70) conf+=8; if(s.SPLIT>70) conf+=7; if(s.BP>70) conf+=5;
    if(s.LU>70) conf+=4; if(s.MOM>70) conf+=3; if(s.HOME>70) conf+=3;
    if(v.DIV) conf-=8; if(v.PEN) conf-=7; if(v.EXTRA) conf-=6;
    if(v.REST_LU) conf-=5; if(v.STREAK) conf-=4;
    if(s.SP<40) conf-=6; if(s.BP<30) conf-=5;
    conf=clamp(conf,10,95);
    const edge=Math.abs(winProb-50);
    const edgeLabel=edge<5?"TOSS-UP":edge<12?"SLIGHT LEAN":edge<22?"MODERATE EDGE":"STRONG EDGE";
    return { winProb, conf, edge, edgeLabel, momComp:momAvg };
  };

  const result = compute(sliders, vol);

  // ── auto-calc via Claude API + web search ───────────────────────────────────
  const autoCalc = useCallback(async () => {
    if (!teamA || !teamB) return;
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("loading");
    setLog([]);
    setRawStats(null);

    const addLog = (msg) => setLog(prev => [...prev, msg]);
    addLog(`Fetching 2026 stats: ${teamA} vs ${teamB}…`);

    const prompt = `You are a baseball analytics engine. Search the web for current 2026 MLB season statistics for these two teams:
Team A: ${teamA}
Team B: ${teamB}

Retrieve and analyze the following for EACH team (2026 season, as current as possible):
- Starting pitcher ERA, xERA, FIP, K%, WHIP (use their likely next starter or rotation ace)
- Team wOBA/OPS vs LHP and vs RHP (handedness splits)
- Bullpen ERA, usage rate, save opportunities, blown saves
- Team OPS, wRC+, lineup depth
- Barrel %, HardHit %, Exit Velocity
- Home/Away splits (record and OPS)
- Last 7-14 game win/loss record and run differential
- Any recent injuries, lineup changes, or notable trends

Based on this data, produce a JSON object with these keys. Each value is 0-100 representing Team A's RELATIVE EDGE over Team B (50=even, >50=Team A advantage, <50=Team B advantage):

{
  "SP": <number>,
  "SPLIT": <number>,
  "BP": <number>,
  "LU": <number>,
  "EV": <number>,
  "HOME": <number>,
  "SERIES": <number>,
  "REST": <number>,
  "UMP": <number>,
  "WX": <number>,
  "DAY": <number>,
  "MOM": <number>,
  "HOT": <number>,
  "COLD": <number>,
  "BP_TREND": <number>,
  "FORM": <number>,
  "summary": {
    "teamA": {
      "sp_name": "<pitcher name>",
      "sp_era": "<ERA>",
      "sp_fip": "<FIP>",
      "team_ops": "<OPS>",
      "bullpen_era": "<ERA>",
      "last10": "<W-L>",
      "barrel_pct": "<Barrel%>",
      "hard_hit_pct": "<HardHit%>"
    },
    "teamB": {
      "sp_name": "<pitcher name>",
      "sp_era": "<ERA>",
      "sp_fip": "<FIP>",
      "team_ops": "<OPS>",
      "bullpen_era": "<ERA>",
      "last10": "<W-L>",
      "barrel_pct": "<Barrel%>",
      "hard_hit_pct": "<HardHit%>"
    },
    "notes": "<2-3 sentences of key matchup narrative>"
  }
}

Return ONLY valid JSON. No markdown fences. No explanation outside the JSON.`;

    try {
      addLog("Querying Claude with web search…");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        signal: ctrl.signal,
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1500,
          tools:[{ type:"web_search_20250305", name:"web_search" }],
          messages:[{ role:"user", content:prompt }],
        }),
      });

      const data = await res.json();
      addLog("Parsing response…");

      // extract all text blocks
      const textBlocks = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text);
      const searchBlocks = (data.content||[]).filter(b=>b.type==="tool_use" && b.name==="web_search");
      if (searchBlocks.length>0) addLog(`Web searches executed: ${searchBlocks.length}`);

      const fullText = textBlocks.join("\n");
      // strip json fences if present
      const clean = fullText.replace(/```json|```/g,"").trim();
      // find outermost { }
      const start = clean.indexOf("{");
      const end   = clean.lastIndexOf("}");
      if (start===-1||end===-1) throw new Error("No JSON found in response");
      const parsed = JSON.parse(clean.slice(start, end+1));

      // build new sliders
      const newSliders = { ...sliders };
      ALL_FACTOR_IDS.forEach(id => {
        if (parsed[id] !== undefined) {
          newSliders[id] = clamp(Math.round(parsed[id]), 0, 100);
        }
      });
      setSliders(newSliders);
      if (parsed.summary) setRawStats(parsed.summary);
      addLog("✓ Sliders auto-populated from live data.");
      setStatus("done");
    } catch(err) {
      if (err.name==="AbortError") { setStatus("idle"); return; }
      addLog(`⚠ Error: ${err.message}`);
      setStatus("error");
    }
  }, [teamA, teamB]);

  const handleSlider = (id,val) => setSliders(p=>({...p,[id]:val}));
  const toggleVol = (id) => setVol(p=>({...p,[id]:!p[id]}));
  const reset = () => { setSliders(initSliders()); setVol(initVol()); setStatus("idle"); setLog([]); setRawStats(null); };

  const edgeColor = result.edge<5?C.yellow:result.edge<12?C.subtext:result.edge<22?C.accent:C.green;
  const confColor = result.conf<40?C.red:result.conf<60?C.yellow:result.conf<75?C.accent:C.green;

  const shortA = teamA ? teamA.split(" ").pop().toUpperCase().slice(0,3) : "HME";
  const shortB = teamB ? teamB.split(" ").pop().toUpperCase().slice(0,3) : "AWY";

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text,
      fontFamily:"'DM Mono','Courier New',monospace", padding:"20px 14px", boxSizing:"border-box" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box}
        input[type=range]{-webkit-appearance:none;appearance:none;background:transparent}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#38bdf8;cursor:pointer;box-shadow:0 0 0 3px #38bdf820}
        input[type=range]::-webkit-slider-runnable-track{height:4px;background:#0e2d47;border-radius:2px}
        select option{background:#071928;color:#e2e8f0}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#0e2d47;border-radius:2px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <div style={{ maxWidth:940, margin:"0 auto" }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom:20, borderBottom:`1px solid ${C.border}`, paddingBottom:18 }}>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, letterSpacing:"0.15em", color:C.accent, lineHeight:1 }}>
                MLB PROBABILITY ENGINE
              </div>
              <div style={{ color:C.muted, fontSize:10, letterSpacing:"0.12em", marginTop:3 }}>
                AI-POWERED · LIVE DATA · WEIGHTED FACTOR MODEL · 2026 SEASON
              </div>
            </div>
            <button onClick={reset} style={{ padding:"5px 14px", borderRadius:4,
              border:`1px solid ${C.border}`, background:"transparent",
              color:C.muted, fontSize:10, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.08em" }}>
              ↺ RESET
            </button>
          </div>

          {/* team selectors */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr auto", gap:10, marginTop:16, alignItems:"center" }}>
            <TeamSelect value={teamA} onChange={setTeamA} color={C.accent} placeholder="Select Home Team" />
            <span style={{ color:C.muted, fontSize:12, fontWeight:600 }}>VS</span>
            <TeamSelect value={teamB} onChange={setTeamB} color={C.orange} placeholder="Select Away Team" />
            <button
              onClick={autoCalc}
              disabled={!teamA||!teamB||status==="loading"}
              style={{
                padding:"8px 18px", borderRadius:6,
                border:`1.5px solid ${teamA&&teamB?C.green:C.border}`,
                background: teamA&&teamB ? C.green+"18" : "transparent",
                color: teamA&&teamB ? C.green : C.muted,
                fontSize:11, fontFamily:"inherit", cursor: teamA&&teamB?"pointer":"not-allowed",
                fontWeight:700, letterSpacing:"0.1em", whiteSpace:"nowrap",
                transition:"all .2s",
                animation: status==="loading" ? "pulse 1s infinite" : "none",
              }}>
              {status==="loading" ? "FETCHING…" : "⚡ AUTO-CALC"}
            </button>
          </div>

          {/* log */}
          {log.length>0 && (
            <div style={{ marginTop:10, background:"#020c17", border:`1px solid ${C.border}`,
              borderRadius:6, padding:"8px 12px", animation:"fadeIn .3s ease" }}>
              {log.map((l,i)=>(
                <div key={i} style={{ fontSize:10, color: l.startsWith("✓")?C.green:l.startsWith("⚠")?C.red:C.muted,
                  marginBottom:2, fontFamily:"inherit" }}>{l}</div>
              ))}
            </div>
          )}
        </div>

        {/* ── RAW STATS CHIPS ── */}
        {rawStats && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16, animation:"fadeIn .4s ease" }}>
            {[["teamA", teamA, C.accent],["teamB", teamB, C.orange]].map(([key, name, col])=>{
              const s = rawStats[key]||{};
              return (
                <div key={key} style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:12 }}>
                  <div style={{ fontSize:10, color:col, fontWeight:700, letterSpacing:"0.1em", marginBottom:8 }}>
                    {name||key.toUpperCase()}
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {s.sp_name&&<StatChip label="SP" val={s.sp_name.split(" ").pop()} color={col}/>}
                    {s.sp_era&&<StatChip label="ERA" val={s.sp_era} color={col}/>}
                    {s.sp_fip&&<StatChip label="FIP" val={s.sp_fip} color={C.text}/>}
                    {s.team_ops&&<StatChip label="OPS" val={s.team_ops} color={C.text}/>}
                    {s.bullpen_era&&<StatChip label="BP ERA" val={s.bullpen_era} color={C.text}/>}
                    {s.last10&&<StatChip label="L10" val={s.last10} color={C.yellow}/>}
                    {s.barrel_pct&&<StatChip label="BBL%" val={s.barrel_pct} color={C.text}/>}
                    {s.hard_hit_pct&&<StatChip label="HH%" val={s.hard_hit_pct} color={C.text}/>}
                  </div>
                </div>
              );
            })}
            {rawStats.notes && (
              <div style={{ gridColumn:"1/-1", background:"#020c17", borderRadius:6, padding:"8px 12px",
                border:`1px solid ${C.border}`, fontSize:11, color:C.subtext, lineHeight:1.7 }}>
                📋 {rawStats.notes}
              </div>
            )}
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

          {/* ── LEFT: SLIDERS ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* Core */}
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
              <div style={{ fontSize:9, letterSpacing:"0.15em", color:C.accent, marginBottom:12, fontWeight:600 }}>
                🔷 PRIMARY CORE FACTORS
              </div>
              {CORE.map(f=>(
                <div key={f.id} style={{ marginBottom:13 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                    <span style={{ fontSize:11, color:C.text }}>
                      <span style={{ color:C.accent, fontWeight:700 }}>{f.id}</span>
                      <span style={{ color:C.muted, marginLeft:5, fontSize:9 }}>{f.label}</span>
                    </span>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontSize:8, color:C.muted }}>WT {f.weight}%</span>
                      <span style={{ fontSize:10, minWidth:28, textAlign:"right",
                        color:sliders[f.id]>50?C.accent:sliders[f.id]===50?C.muted:C.orange, fontWeight:700 }}>
                        {sliders[f.id]>50?`+${sliders[f.id]-50}`:sliders[f.id]===50?"EVN":`${sliders[f.id]-50}`}
                      </span>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:9, color:C.orange, minWidth:24 }}>{shortB}</span>
                    <Slider id={f.id} value={sliders[f.id]} onChange={handleSlider} color={C.accent}/>
                    <span style={{ fontSize:9, color:C.accent, minWidth:24, textAlign:"right" }}>{shortA}</span>
                  </div>
                  <div style={{ fontSize:8, color:"#1a3550", marginTop:1 }}>{f.desc}</div>
                </div>
              ))}
            </div>

            {/* Context */}
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
              <div style={{ fontSize:9, letterSpacing:"0.15em", color:"#fb923c", marginBottom:12, fontWeight:600 }}>
                🔶 SITUATIONAL CONTEXT
              </div>
              {CTX.map(f=>(
                <div key={f.id} style={{ marginBottom:11 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                    <span style={{ fontSize:11, color:C.text }}>
                      <span style={{ color:"#fb923c", fontWeight:700 }}>{f.id}</span>
                      <span style={{ color:C.muted, marginLeft:5, fontSize:9 }}>{f.label}</span>
                    </span>
                    <span style={{ fontSize:8, color:C.muted }}>WT {f.weight}%</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:9, color:C.orange, minWidth:24 }}>{shortB}</span>
                    <Slider id={f.id} value={sliders[f.id]} onChange={handleSlider} color="#fb923c"/>
                    <span style={{ fontSize:9, color:C.accent, minWidth:24, textAlign:"right" }}>{shortA}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Momentum */}
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
              <div style={{ fontSize:9, letterSpacing:"0.15em", color:C.yellow, marginBottom:12, fontWeight:600 }}>
                🔥 MOMENTUM LAYER
              </div>
              {MOM.map(f=>(
                <div key={f.id} style={{ marginBottom:11 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                    <span style={{ fontSize:11, color:C.text }}>
                      <span style={{ color:C.yellow, fontWeight:700 }}>{f.id}</span>
                      <span style={{ color:C.muted, marginLeft:5, fontSize:9 }}>{f.label}</span>
                    </span>
                    <span style={{ fontSize:10, color:sliders[f.id]>50?C.yellow:C.muted, fontWeight:600 }}>{sliders[f.id]}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:9, color:C.orange, minWidth:24 }}>{shortB}</span>
                    <Slider id={f.id} value={sliders[f.id]} onChange={handleSlider} color={C.yellow}/>
                    <span style={{ fontSize:9, color:C.accent, minWidth:24, textAlign:"right" }}>{shortA}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: OUTPUT ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* Win prob + core outputs */}
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:18 }}>
              <WinArc prob={result.winProb} teamA={teamA||"Home"} teamB={teamB||"Away"} />

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:18 }}>
                <div style={{ background:"#020c17", borderRadius:6, padding:10 }}>
                  <div style={{ fontSize:8, color:C.muted, letterSpacing:"0.12em", marginBottom:3 }}>CONFIDENCE</div>
                  <div style={{ fontSize:22, fontWeight:700, color:confColor }}>{Math.round(result.conf)}<span style={{ fontSize:11 }}>%</span></div>
                  <ConfBar value={result.conf} color={confColor}/>
                </div>
                <div style={{ background:"#020c17", borderRadius:6, padding:10 }}>
                  <div style={{ fontSize:8, color:C.muted, letterSpacing:"0.12em", marginBottom:3 }}>EDGE RATING</div>
                  <div style={{ fontSize:11, fontWeight:700, color:edgeColor, marginTop:2 }}>{result.edgeLabel}</div>
                  <div style={{ fontSize:20, fontWeight:700, color:edgeColor, marginTop:2 }}>±{Math.round(result.edge)}<span style={{ fontSize:10 }}>pts</span></div>
                </div>
              </div>

              {/* Momentum */}
              <div style={{ background:"#020c17", borderRadius:6, padding:10, marginTop:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:8, color:C.muted, letterSpacing:"0.12em" }}>MOMENTUM INDEX</div>
                    <div style={{ fontSize:18, fontWeight:700, color:C.yellow, marginTop:2 }}>
                      {Math.round(result.momComp)}<span style={{ fontSize:10 }}>/100</span>
                    </div>
                  </div>
                  <div style={{ fontSize:26 }}><MomEmoji val={result.momComp}/></div>
                </div>
                <ConfBar value={result.momComp} color={C.yellow}/>
              </div>

              {/* Volatility */}
              <div style={{ marginTop:8, background:"#020c17", borderRadius:6, padding:10 }}>
                <div style={{ fontSize:8, color:C.muted, letterSpacing:"0.12em", marginBottom:8 }}>VOLATILITY FLAGS</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {VOL_MARKERS.map(m=>(
                    <Toggle key={m.id} active={vol[m.id]} onClick={()=>toggleVol(m.id)} label={m.label}/>
                  ))}
                </div>
              </div>
            </div>

            {/* Factor edge bars */}
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
              <div style={{ fontSize:9, letterSpacing:"0.15em", color:C.subtext, marginBottom:12 }}>FACTOR EDGE BREAKDOWN</div>
              {[...CORE,...CTX].map(f=>{
                const edge = sliders[f.id]-50;
                const barW = Math.abs(edge);
                const isA = edge>=0;
                return (
                  <div key={f.id} style={{ marginBottom:7 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                      <span style={{ fontSize:9, color:C.muted }}>{f.id}</span>
                      <span style={{ fontSize:9, color:isA?C.accent:C.orange, fontWeight:600 }}>
                        {edge===0?"EVEN":`${isA?shortA:shortB} +${barW}`}
                      </span>
                    </div>
                    <div style={{ background:"#0a1929", borderRadius:2, height:4, position:"relative", overflow:"hidden" }}>
                      <div style={{ position:"absolute", left: isA?"50%":"auto", right: isA?"auto":"50%",
                        width:`${barW/2}%`, height:"100%",
                        background:`linear-gradient(${isA?"90deg":"270deg"},${isA?C.accent:C.orange}44,${isA?C.accent:C.orange})`,
                        transition:"width .3s",
                      }}/>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Advanced markers ref */}
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
              <div style={{ fontSize:9, letterSpacing:"0.15em", color:C.subtext, marginBottom:10 }}>ADVANCED STAT REFERENCE</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5 }}>
                {["xERA","FIP","K-BB%","GB%","CSW%","TTO","wOBA","Barrel%","Chase%","HardHit%","ISO","OPS+"].map(m=>(
                  <div key={m} style={{ fontSize:9, color:C.muted, padding:"3px 7px",
                    background:"#040e1a", borderRadius:4, border:`1px solid ${C.border}` }}>{m}</div>
                ))}
              </div>
              <div style={{ fontSize:8, color:"#1a3550", marginTop:8 }}>Factored into SP / EV / LU sliders on auto-calc.</div>
            </div>
          </div>
        </div>

        {/* footer */}
        <div style={{ marginTop:20, paddingTop:14, borderTop:`1px solid ${C.border}`,
          display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
          <div style={{ fontSize:8, color:"#0e2d47", letterSpacing:"0.1em" }}>
            TIER 1 (CORE 86%) · TIER 2 (SITUATIONAL 14%) · TIER 3 (MOMENTUM NUDGE) · CONFIDENCE ENGINE
          </div>
          <div style={{ fontSize:9, color:C.muted }}>
            PROB: <span style={{ color:C.accent, fontWeight:700 }}>{Math.round(result.winProb)}%</span>
            {" "}· CONF: <span style={{ color:confColor, fontWeight:700 }}>{Math.round(result.conf)}%</span>
            {" "}· <span style={{ color:edgeColor, fontWeight:700 }}>{result.edgeLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
