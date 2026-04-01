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

/* ── Upcoming Match Popup ── */
@keyframes popSlide{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes popFade{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(-8px) scale(.97)}}
.popup-in{animation:popSlide .38s cubic-bezier(.16,1,.3,1) forwards}
.popup-out{animation:popFade .32s ease forwards;pointer-events:none}
@keyframes timeGlow{0%,100%{opacity:1}50%{opacity:.55}}
.time-blink{animation:timeGlow 1.4s ease-in-out infinite}

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
    new_prediction: { label: "NEW PICK",      color: T.accent, cn: "log-pred" },
    result_tracked: { label: "RESULT",        color: T.win,    cn: "log-res"  },
    result_update:  { label: "MANUAL RESULT", color: T.win,    cn: "log-res"  },
    parlay_ready:   { label: "PARLAY READY",  color: T.pend,   cn: "log-parl" },
    error:          { label: "ERROR",         color: T.loss,   cn: "log-err"  },
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

/* ─── AI FLOW DIAGRAM (How It Works) ─────────────────────────────────────── */
const AIFlowDiagram = () => {
  const [active, setActive] = useState(null);

  const nodes = {
    api:      { label: "TheSportsDB API", sub: "PL · PD · SA · BL1 · FL1 · UCL · UEL · ELC · PPL · DED · BSA · MLS", color: T.sub,    glow: "#3A4A63" },
    prep:     { label: "Preprocessing & Cache", sub: "Rate-limit · 15 min cache · TTL guard", color: T.cyan,   glow: "#00D4F0" },
    stat:     { label: "Agent Statistik", sub: "Form & historis tim",       color: T.purple, glow: "#A97FF5" },
    odds:     { label: "Agent Odds",     sub: "Value bet evaluation",       color: T.purple, glow: "#A97FF5" },
    ctx:      { label: "Agent Konteks", sub: "Cedera · cuaca · motivasi",  color: T.purple, glow: "#A97FF5" },
    debate:   { label: "Debate Engine", sub: "Multi-agent voting → confidence score", color: T.pend,   glow: "#FFBA35" },
    learning: { label: "Learning Engine", sub: "SQLite · update bobot dari hasil aktual", color: "#FF6B6B", glow: "#FF4060" },
    pred:     { label: "Prediksi (1X2/OU/AH)", sub: "Confidence % per bet type",   color: T.accent, glow: "#4F8EFF" },
    parlay:   { label: "Parlay Builder", sub: "Gabung picks value tinggi",  color: T.win,    glow: "#00E09A" },
    tg:       { label: "Telegram Bot",   sub: "Push notifikasi real-time",  color: T.accent, glow: "#4F8EFF" },
    web:      { label: "Dashboard Web",  sub: "Live feed · winrate · jadwal", color: T.win,  glow: "#00E09A" },
  };

  const info = {
    api:      "TheSportsDB (free key=123) menyediakan fixtures, hasil, dan info tim untuk 12 liga yang didukung. Data di-cache 15 menit untuk menghindari rate-limit.",
    prep:     "Data mentah dari API difilter, dinormalisasi, dan di-cache. Tim yang tidak dikenali sistem diberi TTL 24 jam sebelum otomatis dihapus.",
    stat:     "Agent ini menganalisa statistik historis: performa kandang/tandang, head-to-head, dan form 5 pertandingan terakhir.",
    odds:     "Agent evaluasi value bet — apakah odds yang ditawarkan sepadan dengan probabilitas yang diprediksikan AI.",
    ctx:      "Informasi kontekstual: apakah ada pemain cedera kunci? Pertandingan dengan taruhan tinggi? Kondisi cuaca ekstrem?",
    debate:   "Tiga agent berdebat dan saling berargumen. Sistem voting konsensus menghasilkan prediksi final beserta confidence score 0–100%.",
    learning: "Setelah pertandingan selesai, hasil aktual dibandingkan dengan prediksi. Bobot setiap agent diperbarui otomatis untuk meningkatkan akurasi.",
    pred:     "Output prediksi dalam 3 jenis taruhan: 1X2 (hasil akhir), OU (over/under gol), AH (asian handicap). Setiap prediksi punya confidence % sendiri.",
    parlay:   "Picks dengan confidence tertinggi digabungkan menjadi satu paket parlay dengan potensi odds lebih besar.",
    tg:       "Bot Telegram mengirimkan notifikasi real-time setiap ada prediksi baru, hasil match, atau parlay siap.",
    web:      "Dashboard ini — live feed via WebSocket, winrate chart, tabel prediksi, dan jadwal pertandingan.",
  };

  const T2 = T; // alias for closure

  const NodeBox = ({ id, x, y, w = 200 }) => {
    const n = nodes[id];
    const isActive = active === id;
    return (
      <g
        onClick={() => setActive(active === id ? null : id)}
        style={{ cursor: "pointer" }}
      >
        <rect
          x={x} y={y} width={w} height={54} rx={10}
          fill={isActive ? `${n.glow}25` : "rgba(255,255,255,0.03)"}
          stroke={isActive ? n.glow : "rgba(255,255,255,0.08)"}
          strokeWidth={isActive ? 1.5 : 0.5}
          style={{ transition: "all .2s" }}
        />
        {isActive && (
          <rect x={x} y={y} width={w} height={2} rx={1} fill={n.glow} opacity={0.9} />
        )}
        <text
          x={x + w/2} y={y + 19}
          textAnchor="middle"
          fill={n.color}
          fontFamily="'JetBrains Mono', monospace"
          fontSize={10} fontWeight={700} letterSpacing={0.5}
        >{n.label}</text>
        <text
          x={x + w/2} y={y + 36}
          textAnchor="middle"
          fill={T2.muted}
          fontFamily="'DM Sans', sans-serif"
          fontSize={9}
        >{n.sub}</text>
      </g>
    );
  };

  const Arrow = ({ x1, y1, x2, y2, color = T.muted, dash = false, delay = 0 }) => (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={color} strokeWidth={1}
      strokeDasharray={dash ? "5 3" : "6 3"}
      fill="none"
      markerEnd="url(#arr)"
      style={{ animation: `flowAnim 2s ${delay}s linear infinite` }}
    />
  );

  const activeInfo = active ? info[active] : null;
  const activeNode = active ? nodes[active] : null;

  return (
    <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14 }}>🧠</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Cara Kerja AI Analisis</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 9, color: T.muted, marginLeft: "auto", letterSpacing: "1px" }}>
          KLIK NODE UNTUK DETAIL
        </span>
      </div>

      {/* Info panel */}
      {activeInfo && (
        <div style={{
          margin: "12px 16px 0",
          background: `${activeNode.glow}12`,
          border: `1px solid ${activeNode.glow}30`,
          borderRadius: 10, padding: "10px 14px",
          display: "flex", gap: 10, alignItems: "flex-start",
          animation: "lslide .2s ease",
        }}>
          <div style={{ width: 3, borderRadius: 2, background: activeNode.glow, alignSelf: "stretch", flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 9, fontWeight: 700, color: activeNode.glow, letterSpacing: "1px", marginBottom: 5 }}>
              {activeNode.label.toUpperCase()}
            </div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize: 12, color: T.sub, lineHeight: 1.7 }}>{activeInfo}</div>
          </div>
        </div>
      )}

      {/* SVG Diagram */}
      <div style={{ padding: "12px 16px 16px", overflowX: "auto" }}>
        <svg width="100%" viewBox="0 0 700 610" style={{ minWidth: 560 }}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 2L8 5L2 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <style>{`
              @keyframes flowAnim { from { stroke-dashoffset: 18; } to { stroke-dashoffset: 0; } }
              @keyframes blip { 0%,100%{opacity:1}50%{opacity:.3} }
              .blip-dot { animation: blip 2s ease-in-out infinite; }
            `}</style>
          </defs>

          {/* ── ROW 0: API ── */}
          <NodeBox id="api" x={220} y={12} w={260} />

          {/* api → prep */}
          <line x1={350} y1={66} x2={350} y2={98} stroke={T.muted} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.8s linear infinite" }} />

          {/* ── ROW 1: PREPROCESS ── */}
          <NodeBox id="prep" x={175} y={98} w={350} />

          {/* prep → 3 agents */}
          <line x1={260} y1={152} x2={140} y2={194} stroke={T.cyan} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.6s .2s linear infinite" }} />
          <line x1={350} y1={152} x2={350} y2={194} stroke={T.cyan} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.6s .4s linear infinite" }} />
          <line x1={440} y1={152} x2={560} y2={194} stroke={T.cyan} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.6s .6s linear infinite" }} />

          {/* ── ROW 2: AGENTS ── */}
          <NodeBox id="stat" x={30}  y={194} w={190} />
          <NodeBox id="odds" x={255} y={194} w={190} />
          <NodeBox id="ctx"  x={480} y={194} w={190} />

          {/* agents → debate */}
          <line x1={125} y1={248} x2={260} y2={290} stroke={T.purple} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 2s .1s linear infinite" }} />
          <line x1={350} y1={248} x2={350} y2={290} stroke={T.purple} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 2s .3s linear infinite" }} />
          <line x1={575} y1={248} x2={440} y2={290} stroke={T.purple} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 2s .5s linear infinite" }} />

          {/* ── ROW 3: DEBATE ── */}
          <NodeBox id="debate" x={155} y={290} w={390} />

          {/* pulse dots on debate */}
          <circle className="blip-dot" cx={144} cy={317} r={4} fill={T.pend} />
          <circle className="blip-dot" cx={556} cy={317} r={4} fill={T.pend} style={{ animationDelay: ".8s" }} />

          {/* debate → learning */}
          <line x1={350} y1={344} x2={350} y2={382} stroke={T.pend} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.5s linear infinite" }} />

          {/* ── ROW 4: LEARNING ── */}
          <NodeBox id="learning" x={155} y={382} w={390} />

          {/* learning → pred + parlay */}
          <line x1={280} y1={436} x2={190} y2={474} stroke={"#FF6B6B"} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.7s .1s linear infinite" }} />
          <line x1={420} y1={436} x2={510} y2={474} stroke={"#FF6B6B"} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.7s .3s linear infinite" }} />

          {/* ── ROW 5: PRED + PARLAY ── */}
          <NodeBox id="pred"   x={60}  y={474} w={260} />
          <NodeBox id="parlay" x={380} y={474} w={260} />

          {/* pred → tg + web */}
          <line x1={150} y1={528} x2={150} y2={558} stroke={T.accent} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.4s linear infinite" }} />
          <line x1={220} y1={528} x2={430} y2={558} stroke={T.accent} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.4s .3s linear infinite" }} />

          {/* parlay → tg + web */}
          <line x1={510} y1={528} x2={510} y2={558} stroke={T.win} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.4s linear infinite" }} />
          <line x1={440} y1={528} x2={260} y2={558} stroke={T.win} strokeWidth={1} strokeDasharray="6 3"
            fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.4s .3s linear infinite" }} />

          {/* ── ROW 6: DELIVERY ── */}
          <NodeBox id="tg"  x={30}  y={558} w={280} />
          <NodeBox id="web" x={390} y={558} w={280} />

          {/* feedback loop: web → learning (dashed left edge) */}
          <path
            d={`M 30 585 L 12 585 L 12 409 L 153 409`}
            fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="4 4"
            markerEnd="url(#arr)"
          />
          <text x={8} y={500} fontSize={9} fill="rgba(255,255,255,0.25)"
            fontFamily="'JetBrains Mono',monospace"
            transform="rotate(-90, 8, 500)" textAnchor="middle">
            feedback loop
          </text>
        </svg>
      </div>

      {/* League pills */}
      <div style={{ padding: "10px 16px 16px", display: "flex", flexWrap: "wrap", gap: 6 }}>
        {["PL","PD","SA","BL1","FL1","UCL","UEL","ELC","PPL","DED","BSA","MLS"].map(c => (
          <span key={c} style={{
            fontFamily:"'JetBrains Mono',monospace", fontSize: 9, fontWeight: 700,
            padding: "3px 9px", borderRadius: 6, letterSpacing: ".8px",
            background: "rgba(79,142,255,.1)", border: "1px solid rgba(79,142,255,.2)", color: T.accent,
          }}>{c}</span>
        ))}
        <span style={{
          fontFamily:"'JetBrains Mono',monospace", fontSize: 9,
          padding: "3px 9px", borderRadius: 6, letterSpacing: ".5px",
          color: T.muted,
        }}>via TheSportsDB FREE</span>
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

/* ─── UPCOMING MATCH POPUP ───────────────────────────────────────────────── */
const UpcomingPopup = ({ pred, visible, total, idx, onClose }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!pred?.next_match?.time_left_sec) return;
    // Hitung detik yang sudah berlalu sejak data di-fetch (pakai created_at popup)
    const fetchedAt = Date.now();
    const tick = () => {
      const elapsed    = Math.floor((Date.now() - fetchedAt) / 1000);
      const sec        = Math.max(0, pred.next_match.time_left_sec - elapsed);
      const h          = Math.floor(sec / 3600);
      const m          = Math.floor((sec % 3600) / 60);
      const s          = sec % 60;
      if (h > 0)       setTimeLeft(`${h}h ${m}m`);
      else if (m > 0)  setTimeLeft(`${m}m ${s}s`);
      else             setTimeLeft(`${s}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [pred]);

  if (!pred) return null;

  const m          = pred.next_match;   // bisa null kalau unknown / cache kosong
  const isSoon     = m && m.time_left_sec < 3600;
  const isVerySoon = m && m.time_left_sec < 900;
  const isUnknown  = pred.api_status === "unknown" || !m;
  const accentCol  = isUnknown ? T.purple : isVerySoon ? T.loss : isSoon ? T.pend : T.accent;
  const betCol     = pred.bet_type === "1X2" ? T.accent : pred.bet_type === "OU" ? T.cyan : T.purple;

  // Parse team names dari match_name kalau next_match null
  const parts       = pred.match_name?.split(" vs ") || ["?", "?"];
  const homeDisplay = m?.home || parts[0]?.trim() || "?";
  const awayDisplay = m?.away || parts[1]?.trim() || "?";

  const kickoffStr = m?.kickoff_wib
    ? new Date(m.kickoff_wib).toLocaleString("id-ID", {
        day: "2-digit", month: "short",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div
      className={visible ? "popup-in" : "popup-out"}
      style={{
        position: "fixed", bottom: 24, right: 20, zIndex: 999,
        width: 300,
        background: "linear-gradient(145deg,rgba(13,16,28,.97) 0%,rgba(9,11,20,.97) 100%)",
        border: `1px solid ${accentCol}44`,
        borderRadius: 18,
        boxShadow: `0 28px 72px rgba(0,0,0,.85), 0 0 0 1px ${accentCol}18, inset 0 1px 0 rgba(255,255,255,.06)`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        overflow: "hidden",
      }}
    >
      {/* Glow strip top */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent 0%, ${accentCol} 40%, ${accentCol} 60%, transparent 100%)`,
        opacity: .85,
      }} />

      {/* Header row */}
      <div style={{ padding: "12px 14px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 7,
            background: `${accentCol}22`, border: `1px solid ${accentCol}40`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
          }}>
            {isUnknown ? "🔮" : isVerySoon ? "⚡" : "📅"}
          </div>
          <span style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
            fontWeight: 700, letterSpacing: "1.6px", color: accentCol,
          }}>
            {isUnknown ? "PREDIKSI AKTIF" : isVerySoon ? "KICKS OFF SOON" : isSoon ? "UPCOMING · <1H" : "NEXT MATCH"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Dot indicators */}
          {total > 1 && (
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: Math.min(total, 6) }).map((_, i) => (
                <div key={i} style={{
                  width: i === (idx % Math.min(total, 6)) ? 14 : 5, height: 5,
                  borderRadius: 3,
                  background: i === (idx % Math.min(total, 6)) ? accentCol : T.dim,
                  transition: "all .3s ease",
                }} />
              ))}
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
              color: T.muted, cursor: "pointer", fontSize: 11, lineHeight: 1,
              borderRadius: 6, padding: "3px 6px", transition: "all .15s",
            }}
          >✕</button>
        </div>
      </div>

      {/* Teams */}
      <div style={{ padding: "10px 14px 0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{homeDisplay}</div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: T.muted, margin: "3px 0", letterSpacing: "1px" }}>VS</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{awayDisplay}</div>
      </div>

      {/* Prediction badge */}
      <div style={{ padding: "8px 14px 0", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{
          background: `${betCol}18`, border: `1px solid ${betCol}35`, borderRadius: 7,
          padding: "2px 8px", fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
          fontWeight: 700, color: betCol, letterSpacing: ".8px",
        }}>{pred.bet_type}</span>
        <span style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: T.sub,
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{pred.predicted_pick}</span>
        <span style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
          color: pred.confidence >= 70 ? T.win : pred.confidence >= 50 ? T.pend : T.loss,
          fontWeight: 700,
        }}>{pred.confidence}%</span>
      </div>

      {/* Kickoff + Countdown (kalau ada) */}
      <div style={{ margin: "10px 14px 14px" }}>
        {kickoffStr ? (
          <div style={{
            background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)",
            borderRadius: 12, padding: "10px 12px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: T.muted, letterSpacing: "1px", marginBottom: 3 }}>KICKOFF WIB</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: T.text }}>{kickoffStr}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: T.muted, letterSpacing: "1px", marginBottom: 3 }}>TIME LEFT</div>
              <div className={isVerySoon ? "time-blink" : ""} style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 16,
                fontWeight: 700, color: accentCol, letterSpacing: "-1px",
              }}>{timeLeft || m.time_left_str}</div>
            </div>
          </div>
        ) : (
          <div style={{
            background: `${T.purple}12`, border: `1px solid ${T.purple}25`,
            borderRadius: 10, padding: "8px 12px",
            fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
            color: T.muted, lineHeight: 1.6,
          }}>
            ⏳ Jadwal belum tersedia di API · menunggu data...
          </div>
        )}
      </div>
    </div>
  );
};

// timestamp saat popup mount
let _popupMountedAt = Date.now() / 1000;

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MAIN DASHBOARD                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [stats,    setStats]    = useState(null);
  const [preds,    setPreds]    = useState([]);
  const [history,  setHistory]  = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [logs,     setLogs]     = useState([]);
  const [tab,      setTab]      = useState("overview");
  const [schedule, setSchedule] = useState([]);
  const [comp,     setComp]     = useState("PL");
  const [loading,  setLoading]  = useState(true);
  const [wsOk,     setWsOk]     = useState(false);
  const [parlay,   setParlay]   = useState(null);
  const [upcomingPreds, setUpcomingPreds] = useState([]);
  const [popupIdx,      setPopupIdx]      = useState(0);
  const [popupVisible,  setPopupVisible]  = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const logsRef  = useRef(null);
  const predsRef = useRef([]);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        fetch(`${API}/api/stats`).then(r => r.json()),
        fetch(`${API}/api/predictions?limit=50`).then(r => r.json()),
      ]);
      setStats(s); setPreds(p); predsRef.current = p;
    } catch {}
    setLoading(false);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const d = await fetch(`${API}/api/history?limit=100`).then(r => r.json());
      if (d && Array.isArray(d.items)) {
        setHistory(d.items);
        setHistoryTotal(d.total ?? d.items.length);
      }
    } catch (e) {
      console.warn("loadHistory error:", e);
    }
  }, []);

  const loadUpcoming = useCallback(async () => {
    // Coba endpoint baru dulu, kalau gagal (endpoint belum ada di Railway) → fallback ke schedule
    try {
      const data = await fetch(`${API}/api/upcoming-predictions`).then(r => r.json());
      if (Array.isArray(data) && data.length > 0) {
        // Hanya tampilkan prediksi yang matchnya belum mulai (time_left_sec > 0 atau tidak ada match)
        const genuine = data.filter(p =>
          !p.outcome &&
          !(p.next_match?.already_started) &&
          (p.next_match?.time_left_sec == null || p.next_match.time_left_sec > 0)
        );
        setUpcomingPreds(genuine);
        return;
      }
    } catch (_) {
      // endpoint belum di-deploy → pakai fallback
    }

    // ── FALLBACK: build popup dari prediksi pending + semua jadwal ──
    // Ambil jadwal dari semua liga yang disupport
    const comps = ["PL","PD","SA","BL1","FL1","UCL","UEL","ELC","PPL","DED","BSA","MLS"];
    const allMatches = [];
    await Promise.all(comps.map(async c => {
      try {
        const d = await fetch(`${API}/api/schedule?competition=${c}`).then(r => r.json());
        if (d.matches) allMatches.push(...d.matches);
      } catch (_) {}
    }));

    const pending = (predsRef.current || []).filter(p => !p.outcome);
    const enriched = pending.map(pred => {
      const parts = (pred.match_name || "").split(" vs ");
      const home  = (parts[0] || "").trim().toLowerCase();
      const away  = (parts[1] || "").trim().toLowerCase();
      const found = allMatches.find(m => {
        const mh = (m.home || "").toLowerCase();
        const ma = (m.away || "").toLowerCase();
        return (mh.includes(home.split(" ")[0]) || home.includes(mh.split(" ")[0])) &&
               (ma.includes(away.split(" ")[0]) || away.includes(ma.split(" ")[0]));
      });

      if (!found) return { ...pred, api_status: "unknown", next_match: null };

      const kickoffUTC = new Date(found.kickoff);
      const kickoffWIB = new Date(kickoffUTC.getTime() + 7 * 3600000);
      const secLeft    = Math.max(0, Math.floor((kickoffUTC - Date.now()) / 1000));
      const h          = Math.floor(secLeft / 3600);
      const min        = Math.floor((secLeft % 3600) / 60);

      return {
        ...pred,
        api_status: "found",
        next_match: {
          home:           found.home,
          away:           found.away,
          competition:    found.competition,
          kickoff_utc:    found.kickoff,
          kickoff_wib:    kickoffWIB.toISOString(),
          time_left_sec:  secLeft,
          time_left_str:  h > 0 ? `${h}h ${min}m` : `${min}m`,
          already_started: secLeft === 0,
        },
      };
    }).filter(p => p.next_match && !p.next_match.already_started);

    setUpcomingPreds(enriched);
  }, []);

  const loadSched = useCallback(async (c) => {
    try {
      const r = await fetch(`${API}/api/schedule?competition=${c}`);
      if (!r.ok) { console.warn("schedule fetch failed:", r.status); return; }
      const d = await r.json();
      setSchedule(d.matches || []);
    } catch (e) {
      console.warn("loadSched error:", e);
    }
  }, []);

  useEffect(() => {
    // load preds dulu, baru loadUpcoming (supaya predsRef terisi)
    load().then(() => loadUpcoming());
    loadHistory();
    let ws, timer;
    const connect = () => {
      ws = new WebSocket(WS);
      ws.onopen  = () => setWsOk(true);
      ws.onclose = () => { setWsOk(false); timer = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        setLogs(prev => [msg, ...prev].slice(0, 150));
        if (["new_prediction","result_tracked","parlay_ready","result_update"].includes(msg.event)) {
          load().then(() => loadUpcoming());
        }
        if (["result_tracked","result_update"].includes(msg.event)) {
          loadHistory();
        }
        if (msg.event === "parlay_ready") setParlay(msg.data);
      };
    };
    connect();
    const interval = setInterval(() => { load().then(() => loadUpcoming()); }, 60000);
    return () => { clearTimeout(timer); clearInterval(interval); ws?.close(); };
  }, []);

  // ── Popup rotation: ganti setiap 12 detik, dismissed cooldown 5 menit ──
  const popupCooldownRef = useRef(null);  // timestamp kapan boleh muncul lagi

  useEffect(() => {
    if (upcomingPreds.length === 0) { setPopupVisible(false); return; }

    // Cek apakah sedang dalam cooldown (user baru close)
    const now = Date.now();
    const cooldownUntil = popupCooldownRef.current || 0;
    if (now < cooldownUntil) return;  // masih cooldown, jangan paksa muncul

    // Munculkan popup
    setPopupIdx(0);
    setTimeout(() => setPopupVisible(true), 300);

    const rot = setInterval(() => {
      if (upcomingPreds.length <= 1) return;  // kalau cuma 1 prediksi, tidak perlu rotasi
      setPopupVisible(false);
      setTimeout(() => {
        setPopupIdx(prev => (prev + 1) % upcomingPreds.length);
        setTimeout(() => setPopupVisible(true), 50);
      }, 380);
    }, 12000);  // ganti setiap 12 detik, lebih santai
    return () => clearInterval(rot);
  }, [upcomingPreds]);

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
    { key: "history",      icon: "📜", label: "History"     },
    { key: "schedule",     icon: "📅", label: "Schedule"    },
    { key: "feed",         icon: "📡", label: "Live"        },
    { key: "parlay",       icon: "🏆", label: "Parlay"      },
    { key: "howitworks",   icon: "🧠", label: "How It Works"},
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

        {/* ════════ HISTORY ════════ */}
        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Stats summary strip */}
            {history.length > 0 && (() => {
              const wins   = history.filter(h => h.outcome === "win").length;
              const losses = history.filter(h => h.outcome === "loss").length;
              const wr     = history.length > 0 ? Math.round(wins / history.length * 1000) / 10 : 0;
              // streak
              let streak = 0, streakType = null;
              for (const h of history) {
                if (!streakType) streakType = h.outcome;
                if (h.outcome === streakType) streak++;
                else break;
              }
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }} className="stat-grid">
                  <StatCard value={history.length} label="Total Resolved" icon="📜" color={T.sub} />
                  <StatCard value={wins}           label="Wins"           icon="✅" color={T.win} />
                  <StatCard value={losses}         label="Losses"         icon="❌" color={T.loss} />
                  <StatCard
                    value={`${wr}%`}
                    label="Win Rate"
                    icon="🎯"
                    color={wr >= 55 ? T.win : wr >= 45 ? T.pend : T.loss}
                    sub={streakType ? `${streak}x ${streakType.toUpperCase()} streak` : undefined}
                  />
                </div>
              );
            })()}

            {/* History table */}
            <div className="glass" style={{ overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: T.sub, letterSpacing: "1px" }}>📜 HISTORY</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted }}>semua prediksi yang sudah ada hasil</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted, marginLeft: "auto" }}>
                  {history.length} / {historyTotal} records
                </span>
              </div>

              {history.length === 0 ? (
                <div style={{ padding: "48px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📜</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 12, color: T.sub, marginBottom: 6 }}>
                    Belum ada history
                  </div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted }}>
                    Input hasil via Telegram: /hasil [nama tim] win/lose
                  </div>
                </div>
              ) : (
                <div className="scroll-x">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Match</th>
                        <th>Type</th>
                        <th>AI Pick</th>
                        <th>Conf</th>
                        <th>Result</th>
                        <th>Notes</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h, i) => {
                        const isWin     = h.outcome === "win";
                        const rowBorder = isWin
                          ? "rgba(0,224,154,.06)"
                          : "rgba(255,64,96,.04)";
                        const isManual  = (h.notes || "").toLowerCase().includes("manual");
                        return (
                          <tr key={h.id ?? i} style={{ background: rowBorder }}>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                                {h.match_name}
                                {isManual && (
                                  <span style={{
                                    fontFamily:"'JetBrains Mono',monospace", fontSize: 8,
                                    color: T.purple, background: "rgba(169,127,245,.12)",
                                    border: "1px solid rgba(169,127,245,.25)",
                                    borderRadius: 5, padding: "1px 5px", letterSpacing: ".5px",
                                  }}>MANUAL</span>
                                )}
                              </div>
                              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 9, color: T.muted, marginTop: 2 }}>
                                #{h.id}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${h.bet_type==="1X2"?"b1":h.bet_type==="OU"?"bo":"ba"}`}>
                                {h.bet_type}
                              </span>
                            </td>
                            <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, maxWidth: 160, color: T.text }}>
                              {h.predicted_pick}
                            </td>
                            <td><ConfBar val={h.confidence} /></td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span className={`badge ${isWin ? "bw" : "bl"}`}>
                                  {isWin ? "✓ WIN" : "✗ LOSS"}
                                </span>
                              </div>
                            </td>
                            <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted, maxWidth: 180 }}>
                              {h.score || h.actual_result || "—"}
                            </td>
                            <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted, whiteSpace: "nowrap" }}>
                              {h.recorded_at
                                ? new Date(h.recorded_at).toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric" })
                                : "—"
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Tip box */}
            <div style={{
              background: "rgba(79,142,255,.05)", border: "1px solid rgba(79,142,255,.15)",
              borderRadius: 14, padding: "14px 18px",
              fontFamily:"'JetBrains Mono',monospace", fontSize: 11, color: T.sub, lineHeight: 1.7,
            }}>
              💡 <strong style={{ color: T.accent }}>Cara input hasil manual via Telegram:</strong>
              <br />
              1. Ketik <code style={{ color: T.win }}>/list</code> → lihat semua picks pending
              <br />
              2. Ketik <code style={{ color: T.win }}>/hasil [nama tim] win</code> atau <code style={{ color: T.win }}>/hasil [nama tim] lose</code>
              <br />
              3. Web ini akan auto-update setelah kamu submit · prediksi masuk ke halaman History ini
            </div>
          </div>
        )}

        {/* ════════ SCHEDULE ════════ */}
        {tab === "schedule" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── Unknown Team Warning Box ── */}
            {upcomingPreds.filter(p => p.api_status === "unknown").length > 0 && (
              <div style={{
                background: "rgba(255,186,53,.05)", border: "1px solid rgba(255,186,53,.25)",
                borderRadius: 14, padding: "14px 18px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 14 }}>⚠️</span>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, color: T.pend, letterSpacing: "1px" }}>
                    TIM TIDAK DITEMUKAN DI API · AUTO-HAPUS SETELAH 24H
                  </span>
                </div>
                {upcomingPreds.filter(p => p.api_status === "unknown").map((p, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "7px 12px", marginBottom: 5,
                    background: "rgba(255,255,255,.03)", borderRadius: 9,
                    border: "1px solid rgba(255,186,53,.12)",
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{p.match_name}</div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 9, color: T.muted, marginTop: 2 }}>
                        Tidak masuk winrate · tidak ditrack hasil
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 9, color: T.pend }}>
                        Hapus dalam ~{p.will_expire_hrs?.toFixed(0)}h
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Main schedule table ── */}
            <div className="glass" style={{ overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted, letterSpacing: "1px" }}>COMPETITION</span>
                <div style={{ position: "relative" }}>
                  <select className="sel" value={comp} onChange={e => setComp(e.target.value)}>
                    {["PL","PD","SA","BL1","FL1","UCL","UEL","ELC","PPL","DED","BSA","MLS"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted, marginLeft: "auto" }}>{schedule.length} matches</span>
              </div>
              {schedule.length === 0
                ? <EmptyState icon="📅" title="Tidak ada jadwal" desc="Pilih kompetisi lain atau cek API key" />
                : <div className="scroll-x">
                    <table className="tbl">
                      <thead><tr><th>Home</th><th>Away</th><th>League</th><th>Kickoff (WIB)</th><th>Countdown</th></tr></thead>
                      <tbody>
                        {schedule.map((m, i) => {
                          const ko = new Date(m.kickoff);
                          const koWIB = new Date(ko.getTime() + 7 * 3600000);
                          const secLeft = Math.max(0, Math.floor((ko - Date.now()) / 1000));
                          const h = Math.floor(secLeft / 3600);
                          const min = Math.floor((secLeft % 3600) / 60);
                          const isSoon = secLeft < 3600 && secLeft > 0;
                          return (
                            <tr key={i}>
                              <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{m.home}</td>
                              <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{m.away}</td>
                              <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted }}>{m.competition}</td>
                              <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 11, color: T.sub, whiteSpace: "nowrap" }}>
                                {koWIB.toLocaleString("id-ID", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                              </td>
                              <td>
                                {secLeft === 0
                                  ? <span className="badge bl">LIVE/DONE</span>
                                  : <span style={{
                                      fontFamily:"'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700,
                                      color: isSoon ? T.pend : T.sub,
                                    }}>
                                      {h > 0 ? `${h}h ${min}m` : `${min}m`}
                                    </span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
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

        {/* ════════ HOW IT WORKS ════════ */}
        {tab === "howitworks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <AIFlowDiagram />
            {/* Extra info cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }} className="stat-grid">
              {[
                { icon: "🌍", title: "12 Liga Didukung", desc: "PL · PD · SA · BL1 · FL1 · UCL · UEL · ELC · PPL · DED · BSA · MLS — semua FREE via TheSportsDB", color: T.accent },
                { icon: "🤖", title: "Multi-Agent Debate", desc: "3 AI agents berdebat setiap prediksi — statistik, odds value, dan konteks situasional", color: T.purple },
                { icon: "📈", title: "Self-Learning", desc: "Sistem belajar dari hasil aktual dan otomatis update bobot agent untuk akurasi yang terus meningkat", color: T.win },
              ].map((c, i) => (
                <div key={i} className="glass" style={{ padding: "16px 18px" }}>
                  <div style={{ fontSize: 22, marginBottom: 10 }}>{c.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: c.color, marginBottom: 6 }}>{c.title}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{c.desc}</div>
                </div>
              ))}
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
        {[
          { key: "overview",    icon: "📊", label: "Overview" },
          { key: "predictions", icon: "🔮", label: "Picks"    },
          { key: "history",     icon: "📜", label: "History"  },
          { key: "schedule",    icon: "📅", label: "Schedule" },
          { key: "parlay",      icon: "🏆", label: "Parlay"   },
        ].map(n => (
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

      {/* ── UPCOMING MATCH POPUP ── */}
      {upcomingPreds.length > 0 && !popupDismissed && popupVisible && (
        <UpcomingPopup
          pred={upcomingPreds[popupIdx % upcomingPreds.length]}
          visible={popupVisible}
          total={upcomingPreds.length}
          idx={popupIdx}
          onClose={() => {
            setPopupVisible(false);
            setPopupDismissed(true);
            popupCooldownRef.current = Date.now() + 5 * 60 * 1000;  // cooldown 5 menit
          }}
        />
      )}
    </>
  );
}
