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
  bg:       "#050811",
  s0:       "#080C18",
  s1:       "#0C1020",
  s2:       "#101526",
  border:   "rgba(255,255,255,.06)",
  borderHi: "rgba(255,255,255,.12)",
  win:      "#00F5A0",
  loss:     "#FF3B5C",
  pend:     "#FFB800",
  accent:   "#3D7BFF",
  accentDim:"rgba(61,123,255,.15)",
  cyan:     "#00E5FF",
  purple:   "#B06EFF",
  pink:     "#FF4FD8",
  text:     "#F0F4FF",
  sub:      "#6B7FA0",
  muted:    "#2E3A52",
  dim:      "#111827",
};

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px;scroll-behavior:smooth}
body{background:${T.bg};color:${T.text};font-family:'Outfit',sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh;overflow-x:hidden}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${T.muted};border-radius:99px}
.mono{font-family:'Space Mono',monospace}

/* ─── Background mesh ─── */
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    radial-gradient(ellipse 80% 40% at 20% 10%, rgba(61,123,255,.08) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 80%, rgba(176,110,255,.07) 0%, transparent 60%),
    radial-gradient(ellipse 50% 30% at 50% 50%, rgba(0,229,255,.04) 0%, transparent 60%);
}
body>*{position:relative;z-index:1}

/* ─── Glassmorphism ─── */
.glass{
  background:linear-gradient(145deg,rgba(255,255,255,.045) 0%,rgba(255,255,255,.015) 100%);
  border:1px solid ${T.border};
  border-radius:20px;
  backdrop-filter:blur(20px);
  -webkit-backdrop-filter:blur(20px);
  position:relative;
  overflow:hidden;
  transition:border-color .3s,transform .3s cubic-bezier(.34,1.56,.64,1),box-shadow .3s;
}
.glass::before{
  content:'';position:absolute;inset:0;
  background:radial-gradient(ellipse at 15% 0%,rgba(61,123,255,.07) 0%,transparent 55%);
  pointer-events:none;border-radius:inherit;
}
.glass:hover{border-color:${T.borderHi}}

/* ─── Stat card lift ─── */
.stat-lift{cursor:default}
.stat-lift:hover{
  transform:translateY(-6px) scale(1.01);
  box-shadow:0 28px 64px rgba(0,0,0,.7), 0 0 0 1px rgba(61,123,255,.15);
}

/* ─── Section header ─── */
.sh{font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${T.sub};display:flex;align-items:center;gap:8px}

/* ─── Table ─── */
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{text-align:left;padding:13px 18px;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${T.sub};border-bottom:1px solid ${T.border};white-space:nowrap}
.tbl td{padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle;color:${T.text}}
.tbl tbody tr{transition:background .2s,transform .15s}
.tbl tbody tr:hover td{background:rgba(61,123,255,.06)}
.tbl tbody tr:last-child td{border-bottom:none}

/* ─── Badges ─── */
.badge{display:inline-flex;align-items:center;gap:4px;padding:4px 11px;border-radius:8px;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.8px;white-space:nowrap;transition:all .2s}
.bw{background:rgba(0,245,160,.1);color:${T.win};border:1px solid rgba(0,245,160,.2)}
.bl{background:rgba(255,59,92,.1);color:${T.loss};border:1px solid rgba(255,59,92,.2)}
.bp{background:rgba(255,184,0,.08);color:${T.pend};border:1px solid rgba(255,184,0,.2)}
.b1{background:rgba(61,123,255,.1);color:${T.accent};border:1px solid rgba(61,123,255,.25)}
.bo{background:rgba(0,229,255,.08);color:${T.cyan};border:1px solid rgba(0,229,255,.2)}
.ba{background:rgba(176,110,255,.1);color:${T.purple};border:1px solid rgba(176,110,255,.22)}
.bs{background:rgba(46,58,82,.25);color:${T.sub};border:1px solid rgba(46,58,82,.5)}

/* ─── Nav tabs ─── */
.tab{
  padding:9px 18px;border-radius:12px;cursor:pointer;font-size:12px;font-weight:600;
  border:1px solid transparent;font-family:'Outfit',sans-serif;letter-spacing:.2px;
  transition:all .25s cubic-bezier(.34,1.56,.64,1);white-space:nowrap;
  display:flex;align-items:center;gap:6px;
}
.tab-on{
  background:linear-gradient(135deg,rgba(61,123,255,.25) 0%,rgba(61,123,255,.12) 100%);
  border-color:rgba(61,123,255,.45);color:${T.accent};
  box-shadow:0 4px 20px rgba(61,123,255,.15), inset 0 1px 0 rgba(255,255,255,.08);
}
.tab-off{background:transparent;color:${T.sub}}
.tab-off:hover{
  background:rgba(255,255,255,.05);color:${T.text};
  border-color:${T.border};transform:translateY(-1px);
}
.tab-icon{font-size:14px;transition:transform .25s}
.tab-off:hover .tab-icon{transform:scale(1.2) rotate(-5deg)}
.tab-on .tab-icon{filter:drop-shadow(0 0 6px ${T.accent})}

/* ─── Select ─── */
.sel{
  background:${T.s1};border:1px solid ${T.border};color:${T.text};
  padding:8px 14px;border-radius:12px;font-family:'Space Mono',monospace;
  font-size:11px;outline:none;cursor:pointer;transition:all .2s;
  appearance:none;-webkit-appearance:none;
}
.sel:focus,.sel:hover{border-color:rgba(61,123,255,.5);box-shadow:0 0 0 3px rgba(61,123,255,.1)}

/* ─── Live dot ─── */
.dot{width:8px;height:8px;border-radius:50%;background:${T.win};flex-shrink:0;position:relative}
.dot-live::after{
  content:'';position:absolute;inset:-4px;border-radius:50%;
  border:1.5px solid rgba(0,245,160,.5);
  animation:dotring 2s ease-in-out infinite;
}
.dot-off{background:${T.loss}}
@keyframes dotring{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.8);opacity:0}}
@keyframes dpulse{0%,100%{box-shadow:0 0 0 0 rgba(0,245,160,.5)}60%{box-shadow:0 0 0 8px rgba(0,245,160,0)}}

/* ─── Log entry ─── */
.log{border-radius:14px;padding:11px 15px;border:1px solid transparent;animation:lslide .3s cubic-bezier(.34,1.56,.64,1)}
@keyframes lslide{from{opacity:0;transform:translateY(-10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
.log-pred{background:rgba(61,123,255,.07);border-color:rgba(61,123,255,.18)}
.log-res{background:rgba(0,245,160,.07);border-color:rgba(0,245,160,.18)}
.log-parl{background:rgba(255,184,0,.06);border-color:rgba(255,184,0,.18)}
.log-err{background:rgba(255,59,92,.07);border-color:rgba(255,59,92,.18)}
.log-def{background:rgba(255,255,255,.03);border-color:${T.border}}

/* ─── Parlay pick ─── */
.ppick{
  font-family:'Space Mono',monospace;font-size:11px;
  padding:9px 13px;border-bottom:1px solid rgba(255,255,255,.04);
  display:flex;align-items:flex-start;gap:8px;color:${T.text};line-height:1.5;
  transition:background .15s;
}
.ppick:hover{background:rgba(255,255,255,.03)}
.ppick:last-child{border-bottom:none}

/* ─── Big number ─── */
.bignum{font-family:'Outfit',sans-serif;font-size:30px;font-weight:800;letter-spacing:-1.5px;line-height:1;color:${T.text}}

/* ─── Ticker ─── */
@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.ticker-wrap{
  overflow:hidden;background:${T.s0};
  border-top:1px solid ${T.border};border-bottom:1px solid ${T.border};
  height:36px;display:flex;align-items:center;
}
.ticker-inner{
  display:flex;gap:52px;animation:ticker 35s linear infinite;
  white-space:nowrap;padding:0 26px;
}
.ticker-inner:hover{animation-play-state:paused}

/* ─── Scroll fade-in ─── */
.fade-in{opacity:0;transform:translateY(22px);transition:opacity .6s ease,transform .6s cubic-bezier(.22,1,.36,1)}
.fade-in.visible{opacity:1;transform:translateY(0)}
.fade-in-delay-1{transition-delay:.1s}
.fade-in-delay-2{transition-delay:.2s}
.fade-in-delay-3{transition-delay:.3s}
.fade-in-delay-4{transition-delay:.4s}

/* ─── Glow ─── */
.glow-blue{box-shadow:0 0 24px rgba(61,123,255,.3)}
.glow-green{box-shadow:0 0 24px rgba(0,245,160,.3)}

/* ─── Ping ─── */
@keyframes ping{75%,100%{transform:scale(2.2);opacity:0}}
.ping{animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite}

/* ─── Popup ─── */
@keyframes popSlide{from{opacity:0;transform:translateY(24px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes popFade{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(-8px) scale(.97)}}
.popup-in{animation:popSlide .4s cubic-bezier(.16,1,.3,1) forwards}
.popup-out{animation:popFade .3s ease forwards;pointer-events:none}
@keyframes timeGlow{0%,100%{opacity:1}50%{opacity:.5}}
.time-blink{animation:timeGlow 1.3s ease-in-out infinite}

/* ─── Scroll ─── */
.scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch}
.scroll-x::-webkit-scrollbar{height:2px}

/* ─── Shimmer ─── */
@keyframes shimmer{from{background-position:-200% 0}to{background-position:200% 0}}
.shimmer{
  background:linear-gradient(90deg,${T.s1} 25%,${T.s2} 50%,${T.s1} 75%);
  background-size:200% 100%;animation:shimmer 2s infinite;border-radius:10px;
}

/* ─── Gradient text ─── */
.grad-text{
  background:linear-gradient(135deg,${T.accent} 0%,${T.cyan} 50%,${T.purple} 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}

/* ─── Neon line ─── */
.neon-line{
  height:2px;border-radius:2px;
  background:linear-gradient(90deg,transparent,${T.accent},${T.cyan},transparent);
  opacity:.6;
}

/* ─── Card shine ─── */
.shine{overflow:hidden;position:relative}
.shine::after{
  content:'';position:absolute;top:-50%;left:-75%;width:50%;height:200%;
  background:linear-gradient(to right,transparent,rgba(255,255,255,.06),transparent);
  transform:skewX(-20deg);transition:left .6s ease;
}
.shine:hover::after{left:125%}

/* ─── Mobile bottom nav ─── */
.bottom-nav{display:none}
@media(max-width:768px){
  .bottom-nav{
    display:flex;position:fixed;bottom:0;left:0;right:0;
    background:rgba(8,12,24,.95);border-top:1px solid ${T.border};
    z-index:100;padding:8px 0 calc(8px + env(safe-area-inset-bottom));
    backdrop-filter:blur(20px);
  }
  .bnav-item{
    flex:1;display:flex;flex-direction:column;align-items:center;
    gap:3px;cursor:pointer;padding:4px 0;transition:all .2s;
    background:none;border:none;outline:none;
  }
  .bnav-item span:first-child{font-size:19px;line-height:1;transition:transform .25s cubic-bezier(.34,1.56,.64,1)}
  .bnav-item span:last-child{font-size:9px;font-family:'Space Mono',monospace;letter-spacing:.5px}
  .bnav-active span:first-child{transform:translateY(-3px) scale(1.15)}
  .bnav-active span:last-child{color:${T.accent}}
  .bnav-off span:last-child{color:${T.muted}}
}

/* ─── Mobile overrides ─── */
@media(max-width:768px){
  .desktop-only{display:none!important}
  .mobile-pb{padding-bottom:84px!important}
  .stat-grid{grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
  .chart-grid{grid-template-columns:1fr!important}
  .main-grid{grid-template-columns:1fr!important}
  .bignum{font-size:24px}
  .tbl th,.tbl td{padding:10px 12px;font-size:11px}
}
@media(min-width:769px){.mobile-only{display:none!important}}

/* ─── Header nav pill ─── */
.nav-pills{display:flex;gap:4px;overflow-x:auto;padding:14px 20px 0;max-width:1400px;margin:0 auto}
.nav-pills::-webkit-scrollbar{display:none}

/* ─── Stat ring ─── */
@keyframes spinRing{to{stroke-dashoffset:0}}

/* ─── Vertical glow line ─── */
.v-glow{
  width:3px;border-radius:3px;
  background:linear-gradient(180deg,transparent,${T.accent},transparent);
  flex-shrink:0;align-self:stretch;
}
`;

/* ──────────────── USE SCROLL ANIMATION ──────────────── */
function useFadeIn(ref) {
  useEffect(() => {
    if (!ref.current) return;
    const els = ref.current.querySelectorAll(".fade-in");
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add("visible");
      });
    }, { threshold: 0.08 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  });
}

/* ──────────────── RECHARTS CUSTOM TOOLTIP ──────────────── */
const CTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.s2, border: `1px solid ${T.borderHi}`,
      borderRadius: 14, padding: "11px 15px",
      fontFamily: "'Space Mono', monospace", fontSize: 11,
      boxShadow: "0 16px 48px rgba(0,0,0,.8)",
    }}>
      <div style={{ color: T.sub, fontSize: 9, marginBottom: 7, letterSpacing: "1px" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: T.text }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, display: "inline-block", boxShadow: `0 0 6px ${p.color}` }} />
          <span style={{ color: T.sub, fontSize: 9 }}>{p.name}</span>
          <span style={{ fontWeight: 700, marginLeft: "auto", paddingLeft: 16, color: p.color, fontSize: 13 }}>
            {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ──────────────── CONFIDENCE BAR ──────────────── */
const ConfBar = ({ val }) => {
  const filled = Math.min(Math.round(val / 20), 5);
  const clr = val >= 80 ? T.win : val >= 60 ? T.accent : val >= 40 ? T.pend : T.loss;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{
          width: 5, height: 14, borderRadius: 3,
          background: i < filled ? clr : T.muted,
          boxShadow: i < filled ? `0 0 8px ${clr}66` : "none",
          transition: `background .3s ${i * .06}s, box-shadow .3s`,
        }} />
      ))}
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: T.sub, marginLeft: 5 }}>{val}%</span>
    </div>
  );
};

/* ──────────────── STAT CARD ──────────────── */
const StatCard = ({ value, label, color, icon, sub }) => (
  <div className="glass stat-lift shine fade-in" style={{ padding: "20px 22px", cursor: "default" }}>
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: "2px",
      background: `linear-gradient(90deg, transparent, ${color || T.accent}66, transparent)`,
    }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div className="bignum" style={{ color: color || T.text }}>{value}</div>
        <div style={{ fontSize: 11, color: T.sub, marginTop: 8, fontWeight: 500, letterSpacing: ".5px" }}>{label}</div>
        {sub && <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: T.muted, marginTop: 4 }}>{sub}</div>}
      </div>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: `${color || T.accent}14`,
        border: `1px solid ${color || T.accent}25`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 17, flexShrink: 0,
        boxShadow: `0 0 16px ${color || T.accent}22`,
        transition: "transform .3s cubic-bezier(.34,1.56,.64,1), box-shadow .3s",
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.15) rotate(-8deg)"; e.currentTarget.style.boxShadow = `0 0 24px ${color || T.accent}55`; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1) rotate(0deg)"; e.currentTarget.style.boxShadow = `0 0 16px ${color || T.accent}22`; }}
      >{icon}</div>
    </div>
  </div>
);

/* ──────────────── LOG CARD ──────────────── */
const LogCard = ({ log }) => {
  const time = new Date(log.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const ev = {
    new_prediction: { label: "NEW PICK",      color: T.accent,  cn: "log-pred" },
    result_tracked: { label: "RESULT",        color: T.win,     cn: "log-res"  },
    result_update:  { label: "MANUAL RESULT", color: T.win,     cn: "log-res"  },
    parlay_ready:   { label: "PARLAY READY",  color: T.pend,    cn: "log-parl" },
    error:          { label: "ERROR",         color: T.loss,    cn: "log-err"  },
  }[log.event] || { label: log.event.replace(/_/g," ").toUpperCase(), color: T.sub, cn: "log-def" };
  return (
    <div className={`log ${ev.cn}`}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, fontWeight: 700, color: ev.color, letterSpacing: "1.2px", display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ width:5, height:5, borderRadius:"50%", background:ev.color, display:"inline-block", boxShadow:`0 0 6px ${ev.color}` }}/>
          {ev.label}
        </span>
        <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: T.muted }}>{time}</span>
      </div>
      <div style={{ fontFamily:"'Space Mono',monospace", fontSize: 11, lineHeight: 1.7, color: T.sub }}>
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

/* ──────────────── PARLAY PANEL ──────────────── */
const ParlayPanel = ({ p }) => {
  if (!p) return (
    <div style={{ padding: "36px 0", textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 14, opacity: .5 }}>🎰</div>
      <div style={{ fontFamily:"'Space Mono',monospace", fontSize: 11, color: T.muted }}>Menunggu analisa berikutnya...</div>
    </div>
  );
  const secs = [
    { key: "parlay_1x2", label: "1X2",  color: T.accent,  bg: "rgba(61,123,255,.06)"   },
    { key: "parlay_ou",  label: "O/U",  color: T.cyan,    bg: "rgba(0,229,255,.06)"    },
    { key: "parlay_ah",  label: "AH",   color: T.purple,  bg: "rgba(176,110,255,.06)"  },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {secs.map(({ key, label, color, bg }) => {
        const picks = p[key] || [];
        if (!picks.length) return null;
        return (
          <div key={key} style={{ background: bg, border: `1px solid ${color}22`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "8px 13px", borderBottom: `1px solid ${color}18`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 10px ${color}` }} />
              <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, fontWeight: 700, color, letterSpacing: "1.2px" }}>{label} PICKS</span>
            </div>
            {picks.map((pick, i) => (
              <div key={i} className="ppick">
                <span style={{ color, flexShrink: 0, fontSize: 13 }}>›</span>
                <span style={{ flex: 1 }}>{pick}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

/* ──────────────── AI FLOW DIAGRAM ──────────────── */
const NODES = {
  api:      { label: "Sports API",         icon: "🌐", glow: T.cyan   },
  prep:     { label: "Data Preprocessor",  icon: "⚙️", glow: T.sub   },
  stat:     { label: "Stats Agent",        icon: "📊", glow: T.accent },
  odds:     { label: "Odds Agent",         icon: "💹", glow: T.pend   },
  ctx:      { label: "Context Agent",      icon: "🧭", glow: T.cyan   },
  debate:   { label: "Multi-Agent Debate", icon: "🤺", glow: T.purple },
  learning: { label: "Self-Learning AI",   icon: "🧠", glow: T.win    },
  pred:     { label: "Predictions",        icon: "🔮", glow: T.accent },
  parlay:   { label: "Parlay Builder",     icon: "🏆", glow: T.pend   },
  tg:       { label: "Telegram Bot",       icon: "📱", glow: T.cyan   },
  web:      { label: "Web Dashboard",      icon: "💻", glow: T.purple },
};
const NODE_INFO = {
  api:      "Fetch live match data, fixtures, and odds from 12 supported leagues via TheSportsDB FREE API.",
  prep:     "Normalize raw data: team stats, recent form, head-to-head records, and situational context.",
  stat:     "Analyzes historical match data, goals per game, clean sheets, and defensive metrics.",
  odds:     "Evaluates market value and identifies bet opportunities with positive expected value.",
  ctx:      "Reads situational context: injuries, suspensions, motivation, weather, and travel fatigue.",
  debate:   "Three AI agents argue their perspectives. The strongest consensus drives the final pick.",
  learning: "Updates agent weights based on actual results. Win = reinforce. Loss = penalize.",
  pred:     "Final prediction with confidence score, sent to Telegram and stored in database.",
  parlay:   "Selects the 3 highest-confidence picks across 1X2/OU/AH for the daily parlay.",
  tg:       "Delivers predictions to Telegram channel in real-time with full reasoning.",
  web:      "This dashboard — live stats, charts, history, and AI pipeline visualization.",
};

const NodeBox = ({ id, x, y, w }) => {
  const n = NODES[id];
  const [hov, setHov] = useState(false);
  return (
    <g
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ cursor: "pointer" }}
    >
      <rect x={x} y={y} width={w} height={52}
        rx={12} ry={12}
        fill={hov ? `${n.glow}12` : `${n.glow}06`}
        stroke={hov ? n.glow : `${n.glow}35`}
        strokeWidth={hov ? 1.5 : 1}
        style={{ transition: "all .25s", filter: hov ? `drop-shadow(0 0 12px ${n.glow}55)` : "none" }}
      />
      <text x={x + 24} y={y + 21} fontSize={14} textAnchor="middle" dominantBaseline="middle">{n.icon}</text>
      <text x={x + 42} y={y + 26} fontSize={11} fontFamily="Outfit,sans-serif" fontWeight={600} fill={hov ? n.glow : T.text} dominantBaseline="middle">{n.label}</text>
    </g>
  );
};

const AIFlowDiagram = () => {
  const [activeNode, setActiveNode] = useState("debate");
  const [activeInfo, setActiveInfo] = useState(NODE_INFO["debate"]);
  return (
    <div className="glass fade-in" style={{ overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.purple, boxShadow: `0 0 10px ${T.purple}` }} />
        <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 10, fontWeight: 700, color: T.sub, letterSpacing: "1.5px" }}>AI PIPELINE</span>
      </div>
      {activeNode && (
        <div style={{
          margin: "14px 18px 0",
          padding: "12px 14px",
          background: `${NODES[activeNode].glow}10`,
          border: `1px solid ${NODES[activeNode].glow}25`,
          borderRadius: 12,
          display: "flex", gap: 12,
        }}>
          <div style={{ width: 3, borderRadius: 2, background: NODES[activeNode].glow, alignSelf: "stretch", flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, fontWeight: 700, color: NODES[activeNode].glow, letterSpacing: "1px", marginBottom: 5 }}>
              {NODES[activeNode].label.toUpperCase()}
            </div>
            <div style={{ fontFamily:"'Outfit',sans-serif", fontSize: 12, color: T.sub, lineHeight: 1.7 }}>{activeInfo}</div>
          </div>
        </div>
      )}
      <div style={{ padding: "12px 16px 16px", overflowX: "auto" }}>
        <svg width="100%" viewBox="0 0 700 610" style={{ minWidth: 560 }}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 2L8 5L2 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <style>{`
              @keyframes flowAnim { from { stroke-dashoffset: 18; } to { stroke-dashoffset: 0; } }
              @keyframes blip { 0%,100%{opacity:1}50%{opacity:.2} }
              .blip-dot { animation: blip 2s ease-in-out infinite; }
            `}</style>
          </defs>
          <NodeBox id="api" x={220} y={12} w={260} />
          <line x1={350} y1={66} x2={350} y2={98} stroke={T.muted} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.8s linear infinite" }} />
          <NodeBox id="prep" x={175} y={98} w={350} />
          <line x1={260} y1={152} x2={140} y2={194} stroke={T.cyan} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.6s .2s linear infinite" }} />
          <line x1={350} y1={152} x2={350} y2={194} stroke={T.cyan} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.6s .4s linear infinite" }} />
          <line x1={440} y1={152} x2={560} y2={194} stroke={T.cyan} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.6s .6s linear infinite" }} />
          <NodeBox id="stat" x={30}  y={194} w={190} />
          <NodeBox id="odds" x={255} y={194} w={190} />
          <NodeBox id="ctx"  x={480} y={194} w={190} />
          <line x1={125} y1={248} x2={260} y2={290} stroke={T.purple} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 2s .1s linear infinite" }} />
          <line x1={350} y1={248} x2={350} y2={290} stroke={T.purple} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 2s .3s linear infinite" }} />
          <line x1={575} y1={248} x2={440} y2={290} stroke={T.purple} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 2s .5s linear infinite" }} />
          <NodeBox id="debate" x={155} y={290} w={390} />
          <circle className="blip-dot" cx={144} cy={317} r={4} fill={T.pend} />
          <circle className="blip-dot" cx={556} cy={317} r={4} fill={T.pend} style={{ animationDelay: ".8s" }} />
          <line x1={350} y1={344} x2={350} y2={382} stroke={T.pend} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.5s linear infinite" }} />
          <NodeBox id="learning" x={155} y={382} w={390} />
          <line x1={280} y1={436} x2={190} y2={474} stroke={T.pink} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.7s .1s linear infinite" }} />
          <line x1={420} y1={436} x2={510} y2={474} stroke={T.pink} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.7s .3s linear infinite" }} />
          <NodeBox id="pred"   x={60}  y={474} w={260} />
          <NodeBox id="parlay" x={380} y={474} w={260} />
          <line x1={150} y1={528} x2={150} y2={558} stroke={T.accent} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.4s linear infinite" }} />
          <line x1={220} y1={528} x2={430} y2={558} stroke={T.accent} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.4s .3s linear infinite" }} />
          <line x1={510} y1={528} x2={510} y2={558} stroke={T.win} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.4s linear infinite" }} />
          <line x1={440} y1={528} x2={260} y2={558} stroke={T.win} strokeWidth={1.2} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{ animation: "flowAnim 1.4s .3s linear infinite" }} />
          <NodeBox id="tg"  x={30}  y={558} w={280} />
          <NodeBox id="web" x={390} y={558} w={280} />
          <path d={`M 30 585 L 12 585 L 12 409 L 153 409`} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={1} strokeDasharray="4 4" markerEnd="url(#arr)" />
          <text x={8} y={500} fontSize={9} fill="rgba(255,255,255,.2)" fontFamily="Space Mono,monospace" transform="rotate(-90, 8, 500)" textAnchor="middle">feedback loop</text>
        </svg>
      </div>
      <div style={{ padding: "0 16px 16px", display: "flex", flexWrap: "wrap", gap: 6 }}>
        {["PL","PD","SA","BL1","FL1","UCL","UEL","ELC","PPL","DED","BSA","MLS"].map(c => (
          <span key={c} style={{
            fontFamily:"'Space Mono',monospace", fontSize: 9, fontWeight: 700,
            padding: "3px 9px", borderRadius: 6, letterSpacing: ".8px",
            background: "rgba(61,123,255,.1)", border: "1px solid rgba(61,123,255,.2)", color: T.accent,
          }}>{c}</span>
        ))}
      </div>
    </div>
  );
};

/* ──────────────── TICKER ──────────────── */
const Ticker = ({ preds }) => {
  const items = preds.slice(0, 15);
  if (!items.length) return null;
  const doubled = [...items, ...items];
  return (
    <div className="ticker-wrap">
      <div className="ticker-inner">
        {doubled.map((p, i) => (
          <span key={i} style={{ fontFamily:"'Space Mono',monospace", fontSize: 10, color: T.sub, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: T.muted }}>⚽</span>
            <span style={{ color: T.text, fontWeight: 600, fontSize: 11 }}>{p.match_name}</span>
            <span style={{
              padding: "1px 7px", borderRadius: 5,
              background: p.outcome === "win" ? "rgba(0,245,160,.1)" : p.outcome === "loss" ? "rgba(255,59,92,.1)" : "rgba(255,184,0,.08)",
              color: p.outcome === "win" ? T.win : p.outcome === "loss" ? T.loss : T.pend,
              border: `1px solid ${p.outcome === "win" ? "rgba(0,245,160,.2)" : p.outcome === "loss" ? "rgba(255,59,92,.2)" : "rgba(255,184,0,.2)"}`,
              fontWeight: 700, fontSize: 9
            }}>{p.predicted_pick}</span>
            <span style={{ color: T.muted }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
};

/* ──────────────── EMPTY STATE ──────────────── */
const EmptyState = ({ icon, title, desc }) => (
  <div style={{ textAlign: "center", padding: "52px 24px" }}>
    <div style={{ fontSize: 40, marginBottom: 14, opacity: .5 }}>{icon}</div>
    <div style={{ fontSize: 14, fontWeight: 700, color: T.sub, marginBottom: 6 }}>{title}</div>
    <div style={{ fontFamily:"'Space Mono',monospace", fontSize: 10, color: T.muted, lineHeight: 1.7 }}>{desc}</div>
  </div>
);

/* ──────────────── INFO BANNER ──────────────── */
const InfoBanner = ({ preds }) => {
  if (preds.length > 0) return null;
  return (
    <div style={{
      background: "rgba(255,184,0,.05)", border: "1px solid rgba(255,184,0,.18)",
      borderRadius: 14, padding: "13px 17px", margin: "14px 18px 0",
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
      <div style={{ fontFamily:"'Space Mono',monospace", fontSize: 10, color: T.sub, lineHeight: 1.8 }}>
        <span style={{ color: T.pend, fontWeight: 700 }}>Kenapa tabel kosong?</span>{" "}
        Tabel ini baca dari <span style={{ color: T.text }}>SQLite database</span>. Pastikan{" "}
        <span style={{ color: T.accent }}>bot.py</span> memanggil{" "}
        <span style={{ color: T.win }}>db.save_prediction()</span>{" "}
        sebelum push ke <span style={{ color: T.accent }}>/api/push-prediction</span>.
      </div>
    </div>
  );
};

/* ──────────────── UPCOMING POPUP ──────────────── */
const UpcomingPopup = ({ pred, visible, total, idx, onClose }) => {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!pred?.next_match?.time_left_sec) return;
    const fetchedAt = Date.now();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - fetchedAt) / 1000);
      const sec = Math.max(0, pred.next_match.time_left_sec - elapsed);
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      if (h > 0) setTimeLeft(`${h}h ${m}m`);
      else if (m > 0) setTimeLeft(`${m}m ${s}s`);
      else setTimeLeft(`${s}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [pred]);

  if (!pred) return null;
  const m = pred.next_match;
  const isSoon = m && m.time_left_sec < 3600;
  const isVerySoon = m && m.time_left_sec < 900;
  const isUnknown = pred.api_status === "unknown" || !m;
  const accentCol = isUnknown ? T.purple : isVerySoon ? T.loss : isSoon ? T.pend : T.accent;
  const betCol = pred.bet_type === "1X2" ? T.accent : pred.bet_type === "OU" ? T.cyan : T.purple;
  const parts = pred.match_name?.split(" vs ") || ["?", "?"];
  const homeDisplay = m?.home || parts[0]?.trim() || "?";
  const awayDisplay = m?.away || parts[1]?.trim() || "?";
  const kickoffStr = m?.kickoff_wib
    ? new Date(m.kickoff_wib).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className={visible ? "popup-in" : "popup-out"} style={{
      position: "fixed", bottom: 24, right: 20, zIndex: 999, width: 300,
      background: "linear-gradient(145deg,rgba(10,14,28,.97) 0%,rgba(6,9,18,.97) 100%)",
      border: `1px solid ${accentCol}44`, borderRadius: 20,
      boxShadow: `0 32px 80px rgba(0,0,0,.9), 0 0 0 1px ${accentCol}18, inset 0 1px 0 rgba(255,255,255,.07)`,
      backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accentCol}, transparent)` }} />
      <div style={{ padding: "13px 15px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 22, height: 22, borderRadius: 8, background: `${accentCol}22`, border: `1px solid ${accentCol}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
            {isUnknown ? "🔮" : isVerySoon ? "⚡" : "📅"}
          </div>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", color: accentCol }}>
            {isUnknown ? "PREDIKSI AKTIF" : isVerySoon ? "KICKS OFF SOON" : isSoon ? "UPCOMING · <1H" : "NEXT MATCH"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {total > 1 && (
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: Math.min(total, 6) }).map((_, i) => (
                <div key={i} style={{ width: i === (idx % Math.min(total, 6)) ? 14 : 5, height: 5, borderRadius: 3, background: i === (idx % Math.min(total, 6)) ? accentCol : T.dim, transition: "all .3s ease" }} />
              ))}
            </div>
          )}
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: T.muted, cursor: "pointer", fontSize: 11, lineHeight: 1, borderRadius: 7, padding: "3px 7px", transition: "all .15s" }}>✕</button>
        </div>
      </div>
      <div style={{ padding: "11px 15px 0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{homeDisplay}</div>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: T.muted, margin: "3px 0", letterSpacing: "2px" }}>VS</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{awayDisplay}</div>
      </div>
      <div style={{ padding: "8px 15px 0", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ background: `${betCol}18`, border: `1px solid ${betCol}35`, borderRadius: 7, padding: "2px 8px", fontFamily: "'Space Mono',monospace", fontSize: 9, fontWeight: 700, color: betCol, letterSpacing: ".8px" }}>{pred.bet_type}</span>
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: T.sub, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pred.predicted_pick}</span>
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: pred.confidence >= 70 ? T.win : pred.confidence >= 50 ? T.pend : T.loss, fontWeight: 700 }}>{pred.confidence}%</span>
      </div>
      <div style={{ margin: "10px 15px 15px" }}>
        {kickoffStr ? (
          <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 13, padding: "10px 13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: T.muted, letterSpacing: "1px", marginBottom: 3 }}>KICKOFF WIB</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 600, color: T.text }}>{kickoffStr}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: T.muted, letterSpacing: "1px", marginBottom: 3 }}>TIME LEFT</div>
              <div className={isVerySoon ? "time-blink" : ""} style={{ fontFamily: "'Space Mono',monospace", fontSize: 16, fontWeight: 700, color: accentCol, letterSpacing: "-1px" }}>{timeLeft || m.time_left_str}</div>
            </div>
          </div>
        ) : (
          <div style={{ background: `${T.purple}12`, border: `1px solid ${T.purple}25`, borderRadius: 11, padding: "8px 13px", fontFamily: "'Space Mono',monospace", fontSize: 9, color: T.muted, lineHeight: 1.7 }}>
            ⏳ Jadwal belum tersedia di API · menunggu data...
          </div>
        )}
      </div>
    </div>
  );
};

let _popupMountedAt = Date.now() / 1000;

/* ═══════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════ */
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
  const contentRef = useRef(null);

  useFadeIn(contentRef);

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
    } catch (e) { console.warn("loadHistory error:", e); }
  }, []);

  const loadUpcoming = useCallback(async () => {
    try {
      const data = await fetch(`${API}/api/upcoming-predictions`).then(r => r.json());
      if (Array.isArray(data) && data.length > 0) {
        const genuine = data.filter(p =>
          !p.outcome &&
          !(p.next_match?.already_started) &&
          (p.next_match?.time_left_sec == null || p.next_match.time_left_sec > 0)
        );
        setUpcomingPreds(genuine);
        return;
      }
    } catch (_) {}
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
      const home = (parts[0] || "").trim().toLowerCase();
      const away = (parts[1] || "").trim().toLowerCase();
      const found = allMatches.find(m => {
        const mh = (m.home || "").toLowerCase(), ma = (m.away || "").toLowerCase();
        return (mh.includes(home.split(" ")[0]) || home.includes(mh.split(" ")[0])) &&
               (ma.includes(away.split(" ")[0]) || away.includes(ma.split(" ")[0]));
      });
      if (!found) return { ...pred, api_status: "unknown", next_match: null };
      const kickoffUTC = new Date(found.kickoff);
      const kickoffWIB = new Date(kickoffUTC.getTime() + 7 * 3600000);
      const secLeft = Math.max(0, Math.floor((kickoffUTC - Date.now()) / 1000));
      const h = Math.floor(secLeft / 3600), min = Math.floor((secLeft % 3600) / 60);
      return {
        ...pred, api_status: "found",
        next_match: { home: found.home, away: found.away, competition: found.competition, kickoff_utc: found.kickoff, kickoff_wib: kickoffWIB.toISOString(), time_left_sec: secLeft, time_left_str: h > 0 ? `${h}h ${min}m` : `${min}m`, already_started: secLeft === 0 },
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
    } catch (e) { console.warn("loadSched error:", e); }
  }, []);

  useEffect(() => {
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
        if (["result_tracked","result_update"].includes(msg.event)) loadHistory();
        if (msg.event === "reset") {
          setPreds([]); predsRef.current = []; setHistory([]); setHistoryTotal(0);
          setStats(null); setParlay(null); setUpcomingPreds([]); setPopupVisible(false);
          load().then(() => loadUpcoming()); loadHistory();
        }
        if (msg.event === "parlay_ready") setParlay(msg.data);
      };
    };
    connect();
    const interval = setInterval(() => { load().then(() => loadUpcoming()); }, 60000);
    return () => { clearTimeout(timer); clearInterval(interval); ws?.close(); };
  }, []);

  const popupCooldownRef = useRef(null);
  useEffect(() => {
    if (upcomingPreds.length === 0) { setPopupVisible(false); return; }
    const now = Date.now();
    const cooldownUntil = popupCooldownRef.current || 0;
    if (now < cooldownUntil) return;
    setPopupIdx(0);
    setTimeout(() => setPopupVisible(true), 300);
    const rot = setInterval(() => {
      if (upcomingPreds.length <= 1) return;
      setPopupVisible(false);
      setTimeout(() => {
        setPopupIdx(prev => (prev + 1) % upcomingPreds.length);
        setTimeout(() => setPopupVisible(true), 50);
      }, 380);
    }, 12000);
    return () => clearInterval(rot);
  }, [upcomingPreds]);

  useEffect(() => { loadSched(comp); }, [comp]);
  useEffect(() => { if (logsRef.current) logsRef.current.scrollTop = 0; }, [logs]);

  const o = stats?.overall;
  const fmt = (n) => n?.toFixed(1) ?? "—";
  const resolved = preds.filter(p => p.outcome === "win" || p.outcome === "loss");
  const wins = resolved.filter(p => p.outcome === "win").length;
  const displayWR = resolved.length > 0 ? Math.round(wins / resolved.length * 1000) / 10 : 0;
  const chartWR = resolved.slice(0, 20).reverse().map((p, i, arr) => ({
    name: `#${p.id}`,
    wr: Math.round((arr.slice(0, i+1).filter(x => x.outcome === "win").length / (i+1)) * 1000) / 10,
  }));
  const btData = (stats?.by_bet_type ?? []).map(b => ({ name: b.bet_type, "Win Rate": b.win_rate, wins: b.wins, total: b.total }));
  const btColor = { "1X2": T.accent, "OU": T.cyan, "AH": T.purple };

  const navItems = [
    { key: "overview",     icon: "📊", label: "Overview"    },
    { key: "predictions",  icon: "🔮", label: "Picks"       },
    { key: "history",      icon: "📜", label: "History"     },
    { key: "schedule",     icon: "📅", label: "Schedule"    },
    { key: "feed",         icon: "📡", label: "Live"        },
    { key: "parlay",       icon: "🏆", label: "Parlay"      },
    { key: "howitworks",   icon: "🧠", label: "How It Works"},
  ];

  /* ── LOADING ── */
  if (loading) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 40, animation: "dpulse 1.8s ease-in-out infinite", filter: `drop-shadow(0 0 20px ${T.accent})` }}>⚽</div>
        </div>
        <div style={{ fontFamily:"'Space Mono',monospace", color: T.accent, fontSize: 10, letterSpacing: "4px" }}>INITIALIZING SYSTEM</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === 1 ? T.cyan : i === 2 ? T.purple : T.accent, animation: `dpulse 1.2s ${i*.15}s ease-in-out infinite` }} />
          ))}
        </div>
      </div>
    </>
  );

  /* ── RENDER ── */
  return (
    <>
      <Head>
        <title>Parlay AI — WIN OR DIE 💀</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <meta name="theme-color" content="#050811" />
      </Head>
      <style>{GLOBAL_CSS}</style>

      {/* ── HEADER ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: `rgba(5,8,17,.88)`,
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        borderBottom: `1px solid ${T.border}`,
        padding: "10px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 14,
            background: "linear-gradient(135deg,rgba(61,123,255,.3) 0%,rgba(61,123,255,.08) 100%)",
            border: `1px solid rgba(61,123,255,.4)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            boxShadow: "0 0 28px rgba(61,123,255,.25)",
            transition: "transform .3s cubic-bezier(.34,1.56,.64,1), box-shadow .3s",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "rotate(-10deg) scale(1.1)"; e.currentTarget.style.boxShadow = "0 0 40px rgba(61,123,255,.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "rotate(0) scale(1)"; e.currentTarget.style.boxShadow = "0 0 28px rgba(61,123,255,.25)"; }}
          >⚽</div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-1px", lineHeight: 1, fontFamily: "'Outfit', sans-serif" }}>
              Parlay <span className="grad-text">AI</span>
            </h1>
            <div style={{ fontFamily:"'Space Mono',monospace", fontSize: 8, color: T.muted, letterSpacing: "2.5px", marginTop: 3 }}>
              WIN THE PARLAY OR WE DIE
            </div>
          </div>
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Win rate */}
          <div style={{
            background: `rgba(0,245,160,.08)`,
            border: `1px solid rgba(0,245,160,.2)`,
            borderRadius: 14, padding: "7px 16px",
            display: "flex", flexDirection: "column", alignItems: "flex-end",
            boxShadow: "0 4px 16px rgba(0,245,160,.1)",
          }}>
            <span style={{ fontFamily:"'Outfit',sans-serif", fontSize: 22, fontWeight: 800, color: T.win, letterSpacing: "-1.5px", lineHeight: 1 }}>
              {fmt(o?.win_rate ?? 0)}%
            </span>
            <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 7, color: T.muted, letterSpacing: "2px", marginTop: 1 }}>WIN RATE</span>
          </div>

          {/* WS */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ position: "relative", width: 10, height: 10 }}>
              <div className={`dot ${wsOk ? "dot-live" : "dot-off"}`} />
            </div>
            <span className="desktop-only" style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: wsOk ? T.win : T.loss, letterSpacing: "1.5px" }}>
              {wsOk ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </header>

      {/* ── TICKER ── */}
      <Ticker preds={preds} />

      {/* ── DESKTOP NAV ── */}
      <div className="desktop-only nav-pills">
        {navItems.map(n => (
          <button key={n.key} className={`tab ${tab === n.key ? "tab-on" : "tab-off"}`} onClick={() => setTab(n.key)}>
            <span className="tab-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </div>

      {/* ── MAIN ── */}
      <main ref={contentRef} style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 18px 20px" }} className="mobile-pb">

        {/* ════════ OVERVIEW ════════ */}
        {tab === "overview" && (
          <>
            {/* Stat cards */}
            <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 18 }}>
              <div className="fade-in fade-in-delay-1"><StatCard value={o?.total_predictions ?? 0} label="Total Predictions" icon="📊" color={T.accent} /></div>
              <div className="fade-in fade-in-delay-2"><StatCard value={o?.wins ?? 0}              label="Total Wins"         icon="✅" color={T.win}    /></div>
              <div className="fade-in fade-in-delay-3"><StatCard value={o?.losses ?? 0}            label="Total Losses"       icon="❌" color={T.loss}   /></div>
              <div className="fade-in fade-in-delay-4"><StatCard value={o?.pending ?? 0}           label="Pending"            icon="⏳" color={T.pend}   /></div>
              <div className="fade-in" style={{ transitionDelay: ".5s" }}><StatCard value={`${displayWR}%`} label="Resolved WR" icon="🎯" color={T.cyan} /></div>
            </div>

            {/* Charts */}
            <div className="chart-grid fade-in" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, marginBottom: 18 }}>
              <div className="glass shine" style={{ padding: "22px 24px" }}>
                <div className="sh" style={{ marginBottom: 18 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, display: "inline-block", boxShadow: `0 0 10px ${T.accent}` }} />
                  Running Win Rate
                </div>
                {chartWR.length === 0
                  ? <EmptyState icon="📈" title="Belum ada data" desc="Resolve prediksi dulu" />
                  : <ResponsiveContainer width="100%" height={170}>
                      <AreaChart data={chartWR} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                        <defs>
                          <linearGradient id="wrG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor={T.accent} stopOpacity={.35} />
                            <stop offset="100%" stopColor={T.accent} stopOpacity={0}  />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke={T.dim} vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: T.muted, fontSize: 9, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0,100]} tick={{ fill: T.muted, fontSize: 9, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CTip />} cursor={{ stroke: T.borderHi, strokeWidth: 1, strokeDasharray: "3 3" }} />
                        <Area type="monotone" dataKey="wr" name="Win %" stroke={T.accent} strokeWidth={2.5}
                          fill="url(#wrG)" dot={false}
                          activeDot={{ r: 6, fill: T.accent, stroke: T.s1, strokeWidth: 2, filter: `drop-shadow(0 0 8px ${T.accent})` }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                }
              </div>

              <div className="glass shine" style={{ padding: "22px 24px" }}>
                <div className="sh" style={{ marginBottom: 18 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.cyan, display: "inline-block", boxShadow: `0 0 10px ${T.cyan}` }} />
                  Win Rate by Bet Type
                </div>
                {btData.length === 0
                  ? <EmptyState icon="📉" title="Belum ada data" desc="Tambah prediksi via Telegram" />
                  : <ResponsiveContainer width="100%" height={170}>
                      <BarChart data={btData} barSize={42} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                        <CartesianGrid strokeDasharray="2 6" stroke={T.dim} vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: T.sub, fontSize: 11, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0,100]} tick={{ fill: T.muted, fontSize: 9, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CTip />} cursor={{ fill: "rgba(255,255,255,.03)", radius: 8 }} />
                        <Bar dataKey="Win Rate" radius={[9,9,0,0]}>
                          {btData.map((entry, i) => (
                            <Cell key={i} fill={btColor[entry.name] || T.accent}
                              style={{ filter: `drop-shadow(0 0 12px ${btColor[entry.name] || T.accent}66)` }} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                }
                <div style={{ display: "flex", gap: 16, marginTop: 14, justifyContent: "center" }}>
                  {Object.entries(btColor).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 3, background: v, boxShadow: `0 0 6px ${v}99` }} />
                      <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 10, color: T.sub }}>{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop overview bottom grid */}
            <div className="main-grid desktop-only fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>
              <div className="glass" style={{ overflow: "hidden" }}>
                <div style={{ padding: "15px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, boxShadow: `0 0 8px ${T.accent}` }} />
                  <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 10, fontWeight: 700, color: T.sub, letterSpacing: "1.2px" }}>RECENT PICKS</span>
                  <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: T.muted, marginLeft: "auto" }}>{preds.length} total</span>
                </div>
                {preds.length === 0
                  ? <EmptyState icon="🔮" title="Belum ada prediksi" desc={"Kirim pertandingan via Telegram.\nPastikan bot.py panggil db.save_prediction()"} />
                  : <div className="scroll-x">
                      <table className="tbl">
                        <thead><tr><th>Match</th><th>Type</th><th>Pick</th><th>Conf</th><th>Result</th></tr></thead>
                        <tbody>
                          {preds.filter(p => p.outcome !== "skip").slice(0, 6).map(p => (
                            <tr key={p.id}>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{p.match_name}</div>
                                <div style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: T.muted, marginTop: 2 }}>
                                  {new Date(p.created_at).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}
                                </div>
                              </td>
                              <td><span className={`badge ${p.bet_type==="1X2"?"b1":p.bet_type==="OU"?"bo":"ba"}`}>{p.bet_type}</span></td>
                              <td style={{ fontFamily:"'Space Mono',monospace", fontSize: 11, maxWidth: 140, color: T.text }}>{p.predicted_pick}</td>
                              <td><ConfBar val={p.confidence} /></td>
                              <td>{p.outcome ? <span className={`badge ${p.outcome==="win"?"bw":"bl"}`}>{p.outcome.toUpperCase()}</span> : <span className="badge bp">PENDING</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                }
              </div>

              <div className="glass shine">
                <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🏆</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Latest Parlay</span>
                  {parlay && <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 8, color: T.pend, marginLeft: "auto", letterSpacing: "1.2px", background: "rgba(255,184,0,.1)", border: "1px solid rgba(255,184,0,.22)", borderRadius: 8, padding: "3px 10px" }}>● FRESH</span>}
                </div>
                <div style={{ padding: 15 }}><ParlayPanel p={parlay} /></div>
              </div>
            </div>
          </>
        )}

        {/* ════════ PREDICTIONS ════════ */}
        {tab === "predictions" && (
          <div className="glass fade-in" style={{ overflow: "hidden" }}>
            <div style={{ padding: "15px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.purple, boxShadow: `0 0 8px ${T.purple}` }} />
              <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 10, fontWeight: 700, color: T.sub, letterSpacing: "1.2px" }}>ALL PREDICTIONS</span>
              <span className="badge bw" style={{ marginLeft: 6 }}>{resolved.length} resolved</span>
              <span className="badge bp">{o?.pending ?? 0} pending</span>
            </div>
            <InfoBanner preds={preds} />
            {preds.filter(p => p.outcome !== "skip").length === 0
              ? <EmptyState icon="🔮" title="Database kosong" desc={"Predictions disimpan via db.save_prediction()\nbukan lewat WebSocket push"} />
              : <div className="scroll-x">
                  <table className="tbl">
                    <thead>
                      <tr><th>Match</th><th>Type</th><th>Pick</th><th>Conf</th><th>Parlay</th><th>Result</th><th>Score</th></tr>
                    </thead>
                    <tbody>
                      {preds.filter(p => p.outcome !== "skip").map(p => (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{p.match_name}</div>
                            <div style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: T.muted, marginTop: 2 }}>
                              {new Date(p.created_at).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}
                            </div>
                          </td>
                          <td><span className={`badge ${p.bet_type==="1X2"?"b1":p.bet_type==="OU"?"bo":"ba"}`}>{p.bet_type}</span></td>
                          <td style={{ fontFamily:"'Space Mono',monospace", fontSize: 11, maxWidth: 160, color: T.text }}>{p.predicted_pick}</td>
                          <td><ConfBar val={p.confidence} /></td>
                          <td>{p.include_in_parlay ? <span style={{ color: T.win, fontSize: 16, filter: `drop-shadow(0 0 6px ${T.win})` }}>✓</span> : <span className="badge bs">SKIP</span>}</td>
                          <td>{p.outcome ? <span className={`badge ${p.outcome==="win"?"bw":"bl"}`}>{p.outcome.toUpperCase()}</span> : <span className="badge bp">PENDING</span>}</td>
                          <td style={{ fontFamily:"'Space Mono',monospace", fontSize: 11, color: T.sub }}>{p.actual_result ?? "—"}</td>
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
            {history.length > 0 && (() => {
              const resolved = history.filter(h => h.outcome === "win" || h.outcome === "loss");
              const wins   = history.filter(h => h.outcome === "win").length;
              const losses = history.filter(h => h.outcome === "loss").length;
              const skips  = history.filter(h => h.outcome === "skip").length;
              const wr     = resolved.length > 0 ? Math.round(wins / resolved.length * 1000) / 10 : 0;
              let streak = 0, streakType = null;
              for (const h of history.filter(x => x.outcome !== "skip")) {
                if (!streakType) streakType = h.outcome;
                if (h.outcome === streakType) streak++;
                else break;
              }
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }} className="stat-grid">
                  <StatCard value={resolved.length} label="Win/Loss Resolved" icon="📜" color={T.sub} sub={skips > 0 ? `+${skips} skipped` : undefined} />
                  <StatCard value={wins}           label="Wins"           icon="✅" color={T.win} />
                  <StatCard value={losses}         label="Losses"         icon="❌" color={T.loss} />
                  <StatCard value={`${wr}%`}       label="Win Rate"       icon="🎯" color={wr >= 55 ? T.win : wr >= 45 ? T.pend : T.loss} sub={streakType ? `${streak}x ${streakType.toUpperCase()} streak` : undefined} />
                </div>
              );
            })()}

            <div className="glass fade-in" style={{ overflow: "hidden" }}>
              <div style={{ padding: "15px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.pend, boxShadow: `0 0 8px ${T.pend}` }} />
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 10, fontWeight: 700, color: T.sub, letterSpacing: "1.2px" }}>HISTORY</span>
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: T.muted }}>semua prediksi yang sudah ada hasil</span>
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: T.muted, marginLeft: "auto" }}>{history.length} / {historyTotal} records</span>
              </div>
              {history.length === 0 ? (
                <EmptyState icon="📜" title="Belum ada history" desc="Input hasil via Telegram: /hasil [nama tim] win/lose" />
              ) : (
                <div className="scroll-x">
                  <table className="tbl">
                    <thead><tr><th>Match</th><th>Type</th><th>AI Pick</th><th>Conf</th><th>Result</th><th>Notes</th><th>Date</th></tr></thead>
                    <tbody>
                      {history.map((h, i) => {
                        const isWin = h.outcome === "win";
                        const isSkip = h.outcome === "skip";
                        const isManual = (h.notes || "").toLowerCase().includes("manual") || (h.notes || "").toLowerCase().includes("skip");
                        return (
                          <tr key={h.id ?? i} style={{ opacity: isSkip ? 0.55 : 1 }}>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                                {h.match_name}
                                {isManual && !isSkip && (
                                  <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 7, color: T.purple, background: "rgba(176,110,255,.12)", border: "1px solid rgba(176,110,255,.25)", borderRadius: 5, padding: "1px 5px", letterSpacing: ".5px" }}>MANUAL</span>
                                )}
                              </div>
                              <div style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: T.muted, marginTop: 2 }}>#{h.id}</div>
                            </td>
                            <td><span className={`badge ${h.bet_type==="1X2"?"b1":h.bet_type==="OU"?"bo":"ba"}`}>{h.bet_type}</span></td>
                            <td style={{ fontFamily:"'Space Mono',monospace", fontSize: 11, maxWidth: 160, color: isSkip ? T.muted : T.text }}>{h.predicted_pick}</td>
                            <td><ConfBar val={h.confidence} /></td>
                            <td>{isSkip ? <span className="badge bs">🗑 SKIP</span> : <span className={`badge ${isWin ? "bw" : "bl"}`}>{isWin ? "✓ WIN" : "✗ LOSS"}</span>}</td>
                            <td style={{ fontFamily:"'Space Mono',monospace", fontSize: 10, color: T.muted, maxWidth: 180 }}>{isSkip ? "—" : (h.score || h.actual_result || "—")}</td>
                            <td style={{ fontFamily:"'Space Mono',monospace", fontSize: 10, color: T.muted, whiteSpace: "nowrap" }}>
                              {h.recorded_at ? new Date(h.recorded_at).toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric" }) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="fade-in" style={{ background: "rgba(61,123,255,.05)", border: "1px solid rgba(61,123,255,.15)", borderRadius: 16, padding: "15px 20px", fontFamily:"'Space Mono',monospace", fontSize: 10, color: T.sub, lineHeight: 1.9 }}>
              💡 <strong style={{ color: T.accent }}>Cara input hasil manual via Telegram:</strong><br />
              1. Ketik <code style={{ color: T.win }}>/list</code> → lihat semua picks pending<br />
              2. Ketik <code style={{ color: T.win }}>/hasil [nama tim] win</code> atau <code style={{ color: T.win }}>/hasil [nama tim] lose</code><br />
              3. Web ini akan auto-update setelah kamu submit · prediksi masuk ke halaman History ini
            </div>
          </div>
        )}

        {/* ════════ SCHEDULE ════════ */}
        {tab === "schedule" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {upcomingPreds.filter(p => p.api_status === "unknown").length > 0 && (
              <div className="fade-in" style={{ background: "rgba(255,184,0,.04)", border: "1px solid rgba(255,184,0,.22)", borderRadius: 16, padding: "15px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 14 }}>⚠️</span>
                  <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, fontWeight: 700, color: T.pend, letterSpacing: "1.2px" }}>
                    TIM TIDAK DITEMUKAN DI API · AUTO-HAPUS SETELAH 24H
                  </span>
                </div>
                {upcomingPreds.filter(p => p.api_status === "unknown").map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 13px", marginBottom: 5, background: "rgba(255,255,255,.03)", borderRadius: 10, border: "1px solid rgba(255,184,0,.12)" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{p.match_name}</div>
                      <div style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: T.muted, marginTop: 2 }}>Tidak masuk winrate · tidak ditrack hasil</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: T.pend }}>Hapus dalam ~{p.will_expire_hrs?.toFixed(0)}h</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="glass fade-in" style={{ overflow: "hidden" }}>
              <div style={{ padding: "15px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: T.muted, letterSpacing: "1.2px" }}>COMPETITION</span>
                <div style={{ position: "relative" }}>
                  <select className="sel" value={comp} onChange={e => setComp(e.target.value)}>
                    {["PL","PD","SA","BL1","FL1","UCL","UEL","ELC","PPL","DED","BSA","MLS"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: T.muted, marginLeft: "auto" }}>{schedule.length} matches</span>
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
                              <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{m.home}</td>
                              <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{m.away}</td>
                              <td style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: T.muted }}>{m.competition}</td>
                              <td style={{ fontFamily:"'Space Mono',monospace", fontSize: 10, color: T.sub, whiteSpace: "nowrap" }}>
                                {koWIB.toLocaleString("id-ID", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                              </td>
                              <td>
                                {secLeft === 0
                                  ? <span className="badge bl">LIVE/DONE</span>
                                  : <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 11, fontWeight: 700, color: isSoon ? T.pend : T.sub }}>
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
          <div className="glass fade-in" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
            <div style={{ padding: "15px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative", width: 10, height: 10 }}>
                <div className={`dot ${wsOk ? "dot-live" : "dot-off"}`} style={{ position: "absolute", inset: 0 }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Live Feed</span>
              <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: T.muted, marginLeft: "auto" }}>{logs.length} / 150</span>
            </div>
            <div ref={logsRef} style={{ flex: 1, overflowY: "auto", padding: 13, display: "flex", flexDirection: "column", gap: 8 }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }} className="stat-grid">
              {[
                { icon: "🌍", title: "12 Liga Didukung", desc: "PL · PD · SA · BL1 · FL1 · UCL · UEL · ELC · PPL · DED · BSA · MLS — semua FREE via TheSportsDB", color: T.accent },
                { icon: "🤖", title: "Multi-Agent Debate", desc: "3 AI agents berdebat setiap prediksi — statistik, odds value, dan konteks situasional", color: T.purple },
                { icon: "📈", title: "Self-Learning", desc: "Sistem belajar dari hasil aktual dan otomatis update bobot agent untuk akurasi yang terus meningkat", color: T.win },
              ].map((c, i) => (
                <div key={i} className="glass shine fade-in" style={{ padding: "18px 20px" }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: `${c.color}14`, border: `1px solid ${c.color}25`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, marginBottom: 14, boxShadow: `0 0 18px ${c.color}22`,
                  }}>{c.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: c.color, marginBottom: 8 }}>{c.title}</div>
                  <div style={{ fontFamily:"'Space Mono',monospace", fontSize: 10, color: T.muted, lineHeight: 1.9 }}>{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════ PARLAY ════════ */}
        {tab === "parlay" && (
          <div className="glass fade-in">
            <div style={{ padding: "15px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>🏆</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Latest Parlay</span>
              {parlay && (
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 8, color: T.pend, marginLeft: "auto", letterSpacing: "1.2px", background: "rgba(255,184,0,.1)", border: "1px solid rgba(255,184,0,.22)", borderRadius: 9, padding: "3px 10px" }}>
                  ● FRESH · {parlay.match_count} matches
                </span>
              )}
            </div>
            <div style={{ padding: 18 }}><ParlayPanel p={parlay} /></div>
          </div>
        )}

      </main>

      {/* ── BOTTOM NAV (mobile) ── */}
      <nav className="bottom-nav">
        {[
          { key: "overview",    icon: "📊", label: "Overview" },
          { key: "predictions", icon: "🔮", label: "Picks"    },
          { key: "history",     icon: "📜", label: "History"  },
          { key: "schedule",    icon: "📅", label: "Schedule" },
          { key: "parlay",      icon: "🏆", label: "Parlay"   },
        ].map(n => (
          <button key={n.key} className={`bnav-item ${tab === n.key ? "bnav-active" : "bnav-off"}`} onClick={() => setTab(n.key)}>
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* ── FOOTER ── */}
      <div className="desktop-only" style={{ textAlign: "center", padding: "24px 0 32px", fontFamily:"'Space Mono',monospace", fontSize: 8, color: T.muted, letterSpacing: "2.5px" }}>
        PARLAY AI v5 · FOR ENTERTAINMENT ONLY · BET RESPONSIBLY
      </div>

      {/* ── POPUP ── */}
      {upcomingPreds.length > 0 && !popupDismissed && popupVisible && (
        <UpcomingPopup
          pred={upcomingPreds[popupIdx % upcomingPreds.length]}
          visible={popupVisible}
          total={upcomingPreds.length}
          idx={popupIdx}
          onClose={() => {
            setPopupVisible(false);
            setPopupDismissed(true);
            popupCooldownRef.current = Date.now() + 5 * 60 * 1000;
          }}
        />
      )}
    </>
  );
}
