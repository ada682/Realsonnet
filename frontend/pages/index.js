"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Head from "next/head";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "https://caring-contentment-production.up.railway.app";
const WS  = process.env.NEXT_PUBLIC_WS_URL  || "wss://caring-contentment-production.up.railway.app/ws/live";

const T = {
  bg:       "#07080F",
  s0:       "#0B0D18",
  s1:       "#0F1220",
  s2:       "#131828",
  border:   "rgba(255,255,255,.07)",
  borderHi: "rgba(255,255,255,.13)",
  win:      "#00E09A",
  loss:     "#FF4060",
  pend:     "#FFBA35",
  accent:   "#4F8EFF",
  accentDim:"rgba(79,142,255,.15)",
  cyan:     "#00D4F0",
  purple:   "#A97FF5",
  text:     "#EDF2FF",
  sub:      "#7A8BA8",
  muted:    "#3A4A63",
  dim:      "#161C2C",
};

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px}
body{background:${T.bg};color:${T.text};font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh;overflow-x:hidden}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${T.muted};border-radius:99px}
.mono{font-family:'JetBrains Mono',monospace}

/* ── Glassmorphism base card ── */
.glass{
  background:linear-gradient(135deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.01) 100%);
  border:1px solid ${T.border};
  border-radius:18px;
  backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
  position:relative;
  overflow:hidden;
  transition:border-color .2s,transform .2s,box-shadow .2s;
}
.glass::before{
  content:'';position:absolute;inset:0;
  background:radial-gradient(ellipse at 20% 0%,rgba(79,142,255,.06) 0%,transparent 60%);
  pointer-events:none;border-radius:inherit;
}
.glass:hover{border-color:${T.borderHi}}

/* ── Stat card hover lift ── */
.stat-lift:hover{transform:translateY(-4px);box-shadow:0 20px 56px rgba(0,0,0,.6)}

/* ── Section label ── */
.sh{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${T.sub};display:flex;align-items:center;gap:8px}

/* ── Table ── */
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{text-align:left;padding:12px 16px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${T.sub};border-bottom:1px solid ${T.border}}
.tbl td{padding:11px 16px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle;color:${T.text}}
.tbl tbody tr{transition:background .15s}
.tbl tbody tr:hover td{background:rgba(79,142,255,.05)}
.tbl tbody tr:last-child td{border-bottom:none}

/* ── Badges ── */
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.7px;white-space:nowrap}
.bw{background:rgba(0,224,154,.1);color:${T.win};border:1px solid rgba(0,224,154,.2)}
.bl{background:rgba(255,64,96,.1);color:${T.loss};border:1px solid rgba(255,64,96,.2)}
.bp{background:rgba(255,186,53,.08);color:${T.pend};border:1px solid rgba(255,186,53,.18)}
.b1{background:rgba(79,142,255,.1);color:${T.accent};border:1px solid rgba(79,142,255,.25)}
.bo{background:rgba(0,212,240,.08);color:${T.cyan};border:1px solid rgba(0,212,240,.2)}
.ba{background:rgba(169,127,245,.1);color:${T.purple};border:1px solid rgba(169,127,245,.22)}
.bs{background:rgba(58,74,99,.2);color:${T.sub};border:1px solid rgba(58,74,99,.4)}

/* ── Tabs ── */
.tab{padding:9px 20px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;border:1px solid transparent;font-family:'DM Sans',sans-serif;letter-spacing:.1px;transition:all .2s;white-space:nowrap}
.tab-on{background:rgba(79,142,255,.18);border-color:rgba(79,142,255,.4);color:${T.accent}}
.tab-off{background:transparent;color:${T.sub}}
.tab-off:hover{background:rgba(255,255,255,.04);color:${T.text};border-color:${T.border}}

/* ── Select ── */
.sel{background:${T.s1};border:1px solid ${T.border};color:${T.text};padding:8px 14px;border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:11px;outline:none;cursor:pointer;transition:border-color .2s;appearance:none;-webkit-appearance:none}
.sel:focus{border-color:rgba(79,142,255,.5)}

/* ── Dot ── */
.dot{width:8px;height:8px;border-radius:50%;background:${T.win};flex-shrink:0}
.dot-live{animation:dpulse 2.2s ease-in-out infinite}
.dot-off{background:${T.loss}}
@keyframes dpulse{0%,100%{box-shadow:0 0 0 0 rgba(0,224,154,.6)}60%{box-shadow:0 0 0 7px rgba(0,224,154,0)}}

/* ── Log feed entry ── */
.log{border-radius:12px;padding:10px 14px;border:1px solid transparent;animation:lslide .25s ease}
@keyframes lslide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
.log-pred{background:rgba(79,142,255,.07);border-color:rgba(79,142,255,.18)}
.log-res{background:rgba(0,224,154,.07);border-color:rgba(0,224,154,.18)}
.log-parl{background:rgba(255,186,53,.06);border-color:rgba(255,186,53,.18)}
.log-err{background:rgba(255,64,96,.07);border-color:rgba(255,64,96,.18)}
.log-def{background:rgba(255,255,255,.03);border-color:${T.border}}

/* ── Parlay pick row ── */
.ppick{font-family:'JetBrains Mono',monospace;font-size:11px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.04);display:flex;align-items:flex-start;gap:8px;color:${T.text};line-height:1.5}
.ppick:last-child{border-bottom:none}

/* ── Big stat number ── */
.bignum{font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;letter-spacing:-1.5px;line-height:1;color:${T.text}}

/* ── Ticker ── */
@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.ticker-wrap{overflow:hidden;background:${T.s0};border-top:1px solid ${T.border};border-bottom:1px solid ${T.border};height:34px;display:flex;align-items:center}
.ticker-inner{display:flex;gap:48px;animation:ticker 32s linear infinite;white-space:nowrap;padding:0 24px}
.ticker-inner:hover{animation-play-state:paused}

/* ── Nav bottom mobile ── */
.bottom-nav{display:none}
@media(max-width:768px){
  .bottom-nav{
    display:flex;position:fixed;bottom:0;left:0;right:0;
    background:${T.s0};border-top:1px solid ${T.border};
    z-index:100;padding:8px 0 calc(8px + env(safe-area-inset-bottom));
  }
  .bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;padding:4px 0;transition:opacity .15s}
  .bnav-item span:first-child{font-size:20px;line-height:1}
  .bnav-item span:last-child{font-size:10px;font-family:'JetBrains Mono',monospace;letter-spacing:.5px}
  .bnav-active span:last-child{color:${T.accent}}
  .bnav-off span:last-child{color:${T.muted}}
}

/* ── Mobile layout overrides ── */
@media(max-width:768px){
  .desktop-only{display:none!important}
  .mobile-pb{padding-bottom:80px!important}
  .stat-grid{grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
  .chart-grid{grid-template-columns:1fr!important}
  .main-grid{grid-template-columns:1fr!important}
  .bignum{font-size:22px}
  .tbl th,.tbl td{padding:10px 12px;font-size:12px}
}
@media(min-width:769px){
  .mobile-only{display:none!important}
}

/* ── Glow accents ── */
.glow-blue{box-shadow:0 0 20px rgba(79,142,255,.25)}
.glow-green{box-shadow:0 0 20px rgba(0,224,154,.25)}

/* ── Ping animation ── */
@keyframes ping{75%,100%{transform:scale(2);opacity:0}}
.ping{animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite}

/* ── Scrollable ── */
.scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch}
.scroll-x::-webkit-scrollbar{height:2px}

/* ── Shimmer loading ── */
@keyframes shimmer{from{background-position:-200% 0}to{background-position:200% 0}}
.shimmer{background:linear-gradient(90deg,${T.s1} 25%,${T.s2} 50%,${T.s1} 75%);background-size:200% 100%;animation:shimmer 1.8s infinite;border-radius:8px}
`;

/* ─── RECHARTS CUSTOM TOOLTIP ─────────────────────────────────────────────── */
const CTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.s2, border: `1px solid ${T.borderHi}`,
      borderRadius: 12, padding: "10px 14px",
      fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
      boxShadow: "0 12px 40px rgba(0,0,0,.7)",
    }}>
      <div style={{ color: T.sub, fontSize: 10, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: T.text }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, display: "inline-block" }} />
          <span style={{ color: T.sub, fontSize: 10 }}>{p.name}</span>
          <span style={{ fontWeight: 700, marginLeft: "auto", paddingLeft: 14, color: p.color }}>
            {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─── CONFIDENCE BAR ─────────────────────────────────────────────────────── */
const ConfBar = ({ val }) => {
  const filled = Math.min(Math.round(val / 20), 5);
  const clr = val >= 80 ? T.win : val >= 60 ? T.accent : val >= 40 ? T.pend : T.loss;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{
          width: 5, height: 13, borderRadius: 3,
          background: i < filled ? clr : T.dim,
          boxShadow: i < filled ? `0 0 6px ${clr}55` : "none",
          transition: "background .2s",
        }} />
      ))}
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.muted, marginLeft: 5 }}>{val}%</span>
    </div>
  );
};

/* ─── STAT CARD ──────────────────────────────────────────────────────────── */
const StatCard = ({ value, label, color, icon, sub }) => (
  <div className="glass stat-lift" style={{ padding: "18px 20px", cursor: "default" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div className="bignum" style={{ color: color || T.text }}>{value}</div>
        <div style={{ fontSize: 11, color: T.sub, marginTop: 7, fontWeight: 500, letterSpacing: ".5px" }}>{label}</div>
        {sub && <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: T.muted, marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color}14`, border: `1px solid ${color}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, flexShrink: 0,
      }}>{icon}</div>
    </div>
  </div>
);

/* ─── LOG CARD ───────────────────────────────────────────────────────────── */
const LogCard = ({ log }) => {
  const time = new Date(log.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const ev = {
    new_prediction: { label: "NEW PICK",    color: T.accent, cn: "log-pred" },
    result_tracked: { label: "RESULT",      color: T.win,    cn: "log-res"  },
    parlay_ready:   { label: "PARLAY READY",color: T.pend,   cn: "log-parl" },
    error:          { label: "ERROR",       color: T.loss,   cn: "log-err"  },
  }[log.event] || { label: log.event.replace(/_/g," ").toUpperCase(), color: T.sub, cn: "log-def" };
  return (
    <div className={`log ${ev.cn}`}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 9, fontWeight: 700, color: ev.color, letterSpacing: "1px" }}>{ev.label}</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 9, color: T.muted }}>{time}</span>
      </div>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, lineHeight: 1.6, color: T.sub }}>
        {log.event === "new_prediction" && <>
          <span style={{ color: T.text, fontWeight: 600 }}>{log.data?.match}</span><br />
          <span style={{ color: ev.color }}>[{log.data?.bet_type}]</span>{" "}
          <span style={{ color: T.win, fontWeight: 700 }}>{log.data?.pick}</span>
          <span style={{ color: T.muted }}> · {log.data?.confidence}%</span>
        </>}
        {log.event === "result_tracked" && <>
          <span style={{ color: T.text }}>{log.data?.match}</span>{" "}
          <span style={{ color: T.muted }}>{log.data?.score}</span>{" → "}
          <span style={{ color: log.data?.outcome === "win" ? T.win : T.loss, fontWeight: 700 }}>
            {log.data?.outcome?.toUpperCase()}
          </span>
        </>}
        {log.event === "parlay_ready" && <>
          <span style={{ color: T.pend }}>Parlay siap</span>
          <span style={{ color: T.muted }}> · {log.data?.match_count} matches</span>
        </>}
        {!["new_prediction","result_tracked","parlay_ready"].includes(log.event) &&
          <span>{JSON.stringify(log.data).slice(0, 90)}</span>
        }
      </div>
    </div>
  );
};

/* ─── PARLAY PANEL ────────────────────────────────────────────────────────── */
const ParlayPanel = ({ p }) => {
  if (!p) return (
    <div style={{ padding: "32px 0", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🎰</div>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, color: T.muted }}>Menunggu analisa berikutnya...</div>
    </div>
  );
  const secs = [
    { key: "parlay_1x2", label: "1X2",  color: T.accent,  bg: "rgba(79,142,255,.06)"   },
    { key: "parlay_ou",  label: "O/U",  color: T.cyan,    bg: "rgba(0,212,240,.06)"    },
    { key: "parlay_ah",  label: "AH",   color: T.purple,  bg: "rgba(169,127,245,.06)"  },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {secs.map(({ key, label, color, bg }) => {
        const picks = p[key] || [];
        if (!picks.length) return null;
        return (
          <div key={key} style={{ background: bg, border: `1px solid ${color}20`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "8px 12px", borderBottom: `1px solid ${color}15`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, color, letterSpacing: "1.2px" }}>{label} PARLAY</span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted, marginLeft: "auto" }}>{picks.length} picks</span>
            </div>
            {picks.map((pick, i) => (
              <div key={i} className="ppick">
                <span style={{ color, fontSize: 9, marginTop: 2, flexShrink: 0 }}>▸</span>
                <span>{pick}</span>
              </div>
            ))}
          </div>
        );
      })}
      {p.warning && (
        <div style={{ background: "rgba(255,64,96,.06)", border: "1px solid rgba(255,64,96,.18)", borderRadius: 12, padding: "10px 14px" }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.loss, fontWeight: 700, letterSpacing: ".8px", marginBottom: 6 }}>⚠ WARNING</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, color: T.sub, lineHeight: 1.6 }}>{p.warning}</div>
        </div>
      )}
    </div>
  );
};

/* ─── TICKER ─────────────────────────────────────────────────────────────── */
const Ticker = ({ preds }) => {
  const recent = preds.filter(p => p.outcome).slice(0, 12);
  if (!recent.length) return null;
  const items = [...recent, ...recent];
  return (
    <div className="ticker-wrap">
      <div className="ticker-inner">
        {items.map((p, i) => (
          <span key={i} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ color: T.sub, fontSize: 10 }}>{p.match_name}</span>
            <span style={{ color: p.outcome === "win" ? T.win : T.loss, fontWeight: 700, fontSize: 10 }}>
              {p.outcome === "win" ? "✓ WIN" : "✗ LOSS"}
            </span>
            <span style={{ color: T.dim, fontSize: 14 }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
};

/* ─── EMPTY STATE ─────────────────────────────────────────────────────────── */
const EmptyState = ({ icon, title, desc }) => (
  <div style={{ textAlign: "center", padding: "48px 24px" }}>
    <div style={{ fontSize: 36, marginBottom: 14, opacity: .6 }}>{icon}</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: T.sub, marginBottom: 6 }}>{title}</div>
    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, color: T.muted, lineHeight: 1.6 }}>{desc}</div>
  </div>
);

/* ─── INFO BANNER: why predictions tab is empty ────────────────────────────── */
const InfoBanner = ({ preds }) => {
  if (preds.length > 0) return null;
  return (
    <div style={{
      background: "rgba(255,186,53,.06)", border: "1px solid rgba(255,186,53,.2)",
      borderRadius: 12, padding: "12px 16px", marginBottom: 14,
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, color: T.sub, lineHeight: 1.7 }}>
        <span style={{ color: T.pend, fontWeight: 700 }}>Kenapa tabel kosong?</span>{" "}
        Tabel ini baca dari <span style={{ color: T.text }}>SQLite database</span>. Pastikan{" "}
        <span style={{ color: T.accent }}>bot.py</span> memanggil{" "}
        <span style={{ color: T.win }}>db.save_prediction()</span>{" "}
        sebelum push ke <span style={{ color: T.accent }}>/api/push-prediction</span>.
        Live Feed bekerja karena WebSocket — database harus diisi terpisah.
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MAIN DASHBOARD                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [stats,    setStats]    = useState(null);
  const [preds,    setPreds]    = useState([]);
  const [logs,     setLogs]     = useState([]);
  const [tab,      setTab]      = useState("overview");  // overview | predictions | schedule | feed | parlay
  const [schedule, setSchedule] = useState([]);
  const [comp,     setComp]     = useState("PL");
  const [loading,  setLoading]  = useState(true);
  const [wsOk,     setWsOk]     = useState(false);
  const [parlay,   setParlay]   = useState(null);
  const logsRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        fetch(`${API}/api/stats`).then(r => r.json()),
        fetch(`${API}/api/predictions?limit=50`).then(r => r.json()),
      ]);
      setStats(s); setPreds(p);
    } catch {}
    setLoading(false);
  }, []);

  const loadSched = useCallback(async (c) => {
    try {
      const d = await fetch(`${API}/api/schedule?competition=${c}`).then(r => r.json());
      setSchedule(d.matches || []);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    let ws, timer;
    const connect = () => {
      ws = new WebSocket(WS);
      ws.onopen  = () => setWsOk(true);
      ws.onclose = () => { setWsOk(false); timer = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        setLogs(prev => [msg, ...prev].slice(0, 150));
        if (["new_prediction","result_tracked","parlay_ready"].includes(msg.event)) load();
        if (msg.event === "parlay_ready") setParlay(msg.data);
      };
    };
    connect();
    const interval = setInterval(load, 60000);
    return () => { clearTimeout(timer); clearInterval(interval); ws?.close(); };
  }, []);

  useEffect(() => { loadSched(comp); }, [comp]);
  useEffect(() => { if (logsRef.current) logsRef.current.scrollTop = 0; }, [logs]);

  const o   = stats?.overall;
  const fmt = (n) => n?.toFixed(1) ?? "—";
  const resolved = preds.filter(p => p.outcome);
  const wins     = resolved.filter(p => p.outcome === "win").length;
  const displayWR = resolved.length > 0 ? Math.round(wins / resolved.length * 1000) / 10 : 0;

  const chartWR = resolved.slice(0, 20).reverse().map((p, i, arr) => ({
    name: `#${p.id}`,
    wr: Math.round((arr.slice(0, i+1).filter(x => x.outcome === "win").length / (i+1)) * 1000) / 10,
  }));
  const btData = (stats?.by_bet_type ?? []).map(b => ({
    name: b.bet_type, "Win Rate": b.win_rate, wins: b.wins, total: b.total,
  }));
  const btColor = { "1X2": T.accent, "OU": T.cyan, "AH": T.purple };

  /* ── LOADING ── */
  if (loading) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", color: T.accent, fontSize: 11, letterSpacing: "4px" }}>LOADING SYSTEM</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent, animation: `dpulse 1.4s ${i*.2}s ease-in-out infinite` }} />
          ))}
        </div>
      </div>
    </>
  );

  /* ── MOBILE NAV ITEMS ── */
  const navItems = [
    { key: "overview",     icon: "📊", label: "Overview"    },
    { key: "predictions",  icon: "🔮", label: "Picks"       },
    { key: "schedule",     icon: "📅", label: "Schedule"    },
    { key: "feed",         icon: "📡", label: "Live"        },
    { key: "parlay",       icon: "🏆", label: "Parlay"      },
  ];

  /* ── RENDER ── */
  return (
    <>
      <Head>
        <title>Parlay AI — WIN OR DIE 💀</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <meta name="theme-color" content="#07080F" />
      </Head>
      <style>{GLOBAL_CSS}</style>

      {/* ── HEADER ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: `${T.bg}E6`, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.border}`,
        padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg,#1a3070 0%,#0b1535 100%)",
            border: `1px solid rgba(79,142,255,.35)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            boxShadow: "0 0 20px rgba(79,142,255,.2)",
          }}>⚽</div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.5px", lineHeight: 1 }}>
              Parlay <span style={{ color: T.accent }}>AI</span>
            </h1>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 9, color: T.muted, letterSpacing: "2px", marginTop: 2 }}>
              WIN THE PARLAY OR WE DIE
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Win rate pill */}
          <div style={{
            background: `${T.win}14`, border: `1px solid ${T.win}25`,
            borderRadius: 12, padding: "6px 14px",
            display: "flex", flexDirection: "column", alignItems: "flex-end",
          }}>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, color: T.win, letterSpacing: "-1px", lineHeight: 1 }}>
              {fmt(o?.win_rate ?? 0)}%
            </span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 8, color: T.muted, letterSpacing: "1.5px" }}>WIN RATE</span>
          </div>
          {/* WS status */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ position: "relative", width: 10, height: 10 }}>
              <div className={`dot ${wsOk ? "dot-live" : "dot-off"}`} style={{ position: "absolute", inset: 0 }} />
              {wsOk && <div className="dot" style={{ position: "absolute", inset: 0, opacity: .4 }} />}
            </div>
            <span className="desktop-only" style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: wsOk ? T.win : T.loss, letterSpacing: "1.5px" }}>
              {wsOk ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </header>

      {/* ── TICKER ── */}
      <Ticker preds={preds} />

      {/* ── DESKTOP NAV TABS ── */}
      <div className="desktop-only" style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 20px 0", display: "flex", gap: 6 }}>
        {navItems.map(n => (
          <button key={n.key} className={`tab ${tab === n.key ? "tab-on" : "tab-off"}`} onClick={() => setTab(n.key)}>
            {n.icon} {n.label}
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT ── */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 16px 20px" }} className="mobile-pb">

        {/* ════════ OVERVIEW ════════ */}
        {tab === "overview" && (
          <>
            {/* Stat cards */}
            <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 16 }}>
              <StatCard value={o?.total_predictions ?? 0} label="Total Predictions" icon="📊" color={T.accent} />
              <StatCard value={o?.wins ?? 0}              label="Total Wins"         icon="✅" color={T.win}    />
              <StatCard value={o?.losses ?? 0}            label="Total Losses"       icon="❌" color={T.loss}   />
              <StatCard value={o?.pending ?? 0}           label="Pending"            icon="⏳" color={T.pend}   />
              <StatCard value={`${displayWR}%`}           label="Resolved WR"        icon="🎯" color={T.cyan}   />
            </div>

            {/* Charts */}
            <div className="chart-grid" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, marginBottom: 16 }}>
              {/* Win rate chart */}
              <div className="glass" style={{ padding: "20px 22px" }}>
                <div className="sh" style={{ marginBottom: 16 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent, display: "inline-block", boxShadow: `0 0 8px ${T.accent}` }} />
                  Running Win Rate
                </div>
                {chartWR.length === 0
                  ? <EmptyState icon="📈" title="Belum ada data" desc="Resolve prediksi dulu" />
                  : <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={chartWR} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                        <defs>
                          <linearGradient id="wrG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor={T.accent} stopOpacity={.3} />
                            <stop offset="100%" stopColor={T.accent} stopOpacity={0}  />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 5" stroke={T.dim} vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: T.muted, fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0,100]} tick={{ fill: T.muted, fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CTip />} cursor={{ stroke: T.borderHi, strokeWidth: 1, strokeDasharray: "3 3" }} />
                        <Area type="monotone" dataKey="wr" name="Win %" stroke={T.accent} strokeWidth={2}
                          fill="url(#wrG)" dot={false}
                          activeDot={{ r: 5, fill: T.accent, stroke: T.s1, strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                }
              </div>

              {/* Bar chart by bet type */}
              <div className="glass" style={{ padding: "20px 22px" }}>
                <div className="sh" style={{ marginBottom: 16 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.cyan, display: "inline-block", boxShadow: `0 0 8px ${T.cyan}` }} />
                  Win Rate by Bet Type
                </div>
                {btData.length === 0
                  ? <EmptyState icon="📉" title="Belum ada data" desc="Tambah prediksi via Telegram" />
                  : <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={btData} barSize={40} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                        <CartesianGrid strokeDasharray="2 5" stroke={T.dim} vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: T.sub, fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0,100]} tick={{ fill: T.muted, fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CTip />} cursor={{ fill: "rgba(255,255,255,.03)", radius: 6 }} />
                        <Bar dataKey="Win Rate" radius={[7,7,0,0]}>
                          {btData.map((entry, i) => (
                            <Cell key={i} fill={btColor[entry.name] || T.accent}
                              style={{ filter: `drop-shadow(0 0 10px ${btColor[entry.name] || T.accent}55)` }} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                }
                <div style={{ display: "flex", gap: 14, marginTop: 14, justifyContent: "center" }}>
                  {Object.entries(btColor).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 7, height: 7, borderRadius: 2, background: v, boxShadow: `0 0 5px ${v}88` }} />
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.sub }}>{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop: Live feed + Parlay side by side below charts */}
            <div className="main-grid desktop-only" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>
              {/* Recent picks preview */}
              <div className="glass" style={{ overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: T.sub, letterSpacing: "1px" }}>RECENT PICKS</span>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted, marginLeft: "auto" }}>{preds.length} total</span>
                </div>
                {preds.length === 0
                  ? <EmptyState icon="🔮" title="Belum ada prediksi" desc={"Kirim pertandingan via Telegram.\nPastikan bot.py panggil db.save_prediction()"} />
                  : <div className="scroll-x">
                      <table className="tbl">
                        <thead><tr><th>Match</th><th>Type</th><th>Pick</th><th>Conf</th><th>Result</th></tr></thead>
                        <tbody>
                          {preds.slice(0, 6).map(p => (
                            <tr key={p.id}>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{p.match_name}</div>
                                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 9, color: T.muted, marginTop: 2 }}>
                                  {new Date(p.created_at).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}
                                </div>
                              </td>
                              <td><span className={`badge ${p.bet_type==="1X2"?"b1":p.bet_type==="OU"?"bo":"ba"}`}>{p.bet_type}</span></td>
                              <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, maxWidth: 140, color: T.text }}>{p.predicted_pick}</td>
                              <td><ConfBar val={p.confidence} /></td>
                              <td>
                                {p.outcome
                                  ? <span className={`badge ${p.outcome==="win"?"bw":"bl"}`}>{p.outcome.toUpperCase()}</span>
                                  : <span className="badge bp">PENDING</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                }
              </div>
              {/* Parlay */}
              <div className="glass">
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15 }}>🏆</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Latest Parlay</span>
                  {parlay && <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 9, color: T.pend, marginLeft: "auto", letterSpacing: "1px" }}>● FRESH</span>}
                </div>
                <div style={{ padding: 14 }}><ParlayPanel p={parlay} /></div>
              </div>
            </div>
          </>
        )}

        {/* ════════ PREDICTIONS ════════ */}
        {tab === "predictions" && (
          <div className="glass" style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: T.sub, letterSpacing: "1px" }}>ALL PREDICTIONS</span>
              <span className="badge bw" style={{ marginLeft: 6 }}>{resolved.length} resolved</span>
              <span className="badge bp">{o?.pending ?? 0} pending</span>
            </div>
            <InfoBanner preds={preds} />
            {preds.length === 0
              ? <EmptyState icon="🔮" title="Database kosong" desc={"Predictions disimpan via db.save_prediction()\nbukan lewat WebSocket push"} />
              : <div className="scroll-x">
                  <table className="tbl">
                    <thead>
                      <tr><th>Match</th><th>Type</th><th>Pick</th><th>Conf</th><th>Parlay</th><th>Result</th><th>Score</th></tr>
                    </thead>
                    <tbody>
                      {preds.map(p => (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{p.match_name}</div>
                            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 9, color: T.muted, marginTop: 2 }}>
                              {new Date(p.created_at).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}
                            </div>
                          </td>
                          <td><span className={`badge ${p.bet_type==="1X2"?"b1":p.bet_type==="OU"?"bo":"ba"}`}>{p.bet_type}</span></td>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, maxWidth: 160, color: T.text }}>{p.predicted_pick}</td>
                          <td><ConfBar val={p.confidence} /></td>
                          <td>
                            {p.include_in_parlay
                              ? <span style={{ color: T.win, fontSize: 16 }}>✓</span>
                              : <span className="badge bs">SKIP</span>
                            }
                          </td>
                          <td>
                            {p.outcome
                              ? <span className={`badge ${p.outcome==="win"?"bw":"bl"}`}>{p.outcome.toUpperCase()}</span>
                              : <span className="badge bp">PENDING</span>
                            }
                          </td>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, color: T.sub }}>{p.actual_result ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        )}

        {/* ════════ SCHEDULE ════════ */}
        {tab === "schedule" && (
          <div className="glass" style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted, letterSpacing: "1px" }}>COMPETITION</span>
              <div style={{ position: "relative" }}>
                <select className="sel" value={comp} onChange={e => setComp(e.target.value)}>
                  {["PL","CL","PD","SA","BL1","FL1","ELC","PPL","DED"].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted, marginLeft: "auto" }}>{schedule.length} matches</span>
            </div>
            {schedule.length === 0
              ? <EmptyState icon="📅" title="Tidak ada jadwal" desc="Pilih kompetisi lain atau cek API key" />
              : <div className="scroll-x">
                  <table className="tbl">
                    <thead><tr><th>Home</th><th>Away</th><th>League</th><th>Kickoff</th></tr></thead>
                    <tbody>
                      {schedule.map((m, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{m.home}</td>
                          <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{m.away}</td>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted }}>{m.competition}</td>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, color: T.sub, whiteSpace: "nowrap" }}>
                            {new Date(m.kickoff).toLocaleString("en-GB", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        )}

        {/* ════════ LIVE FEED ════════ */}
        {tab === "feed" && (
          <div className="glass" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative", width: 10, height: 10 }}>
                <div className={`dot ${wsOk ? "dot-live" : "dot-off"}`} style={{ position: "absolute", inset: 0 }} />
              </div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Live Feed</span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted, marginLeft: "auto" }}>{logs.length} / 150</span>
            </div>
            <div ref={logsRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {logs.length === 0
                ? <EmptyState icon="📡" title="Menunggu aktivitas AI..." desc="Bot aktif akan mengirim events ke sini" />
                : logs.map((l, i) => <LogCard key={i} log={l} />)
              }
            </div>
          </div>
        )}

        {/* ════════ PARLAY ════════ */}
        {tab === "parlay" && (
          <div className="glass">
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>🏆</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Latest Parlay</span>
              {parlay && (
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.pend, marginLeft: "auto", letterSpacing: "1px", background: "rgba(255,186,53,.1)", border: "1px solid rgba(255,186,53,.2)", borderRadius: 8, padding: "3px 10px" }}>
                  ● FRESH · {parlay.match_count} matches
                </span>
              )}
            </div>
            <div style={{ padding: 16 }}><ParlayPanel p={parlay} /></div>
          </div>
        )}

      </main>

      {/* ── BOTTOM NAV (mobile only) ── */}
      <nav className="bottom-nav">
        {navItems.map(n => (
          <button key={n.key} className={`bnav-item ${tab === n.key ? "bnav-active" : "bnav-off"}`}
            onClick={() => setTab(n.key)}
            style={{ background: "none", border: "none", outline: "none" }}>
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* ── FOOTER ── */}
      <div className="desktop-only" style={{ textAlign: "center", padding: "24px 0 32px", fontFamily:"'JetBrains Mono',monospace", fontSize: 9, color: T.dim, letterSpacing: "2px" }}>
        PARLAY AI v4 · FOR ENTERTAINMENT ONLY · BET RESPONSIBLY
      </div>
    </>
  );
}
