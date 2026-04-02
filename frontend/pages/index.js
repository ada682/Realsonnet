"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Head from "next/head";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";

/* ─── CONFIG ──────────────────────────────────────────────────────────────── */
const API = process.env.NEXT_PUBLIC_API_URL || "https://caring-contentment-production.up.railway.app";
const WS  = process.env.NEXT_PUBLIC_WS_URL  || "wss://caring-contentment-production.up.railway.app/ws/live";

/* ─── DESIGN TOKENS ───────────────────────────────────────────────────────── */
const C = {
  bg:        "#04060F",
  s0:        "#070B18",
  s1:        "#0B1020",
  s2:        "#0F1628",
  s3:        "#141D32",
  border:    "rgba(100,160,255,.07)",
  borderHi:  "rgba(100,160,255,.18)",
  win:       "#00E676",
  loss:      "#FF4569",
  pend:      "#FFB300",
  accent:    "#4D9FFF",
  accentDim: "rgba(77,159,255,.12)",
  teal:      "#00D4AA",
  violet:    "#9B6DFF",
  text:      "#DCE8FF",
  sub:       "#5E7099",
  muted:     "#253050",
  dim:       "#111928",
};

/* ─── GLOBAL CSS ──────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@500;600;700;800&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px;scroll-behavior:smooth}
body{
  background:${C.bg};
  color:${C.text};
  font-family:'Outfit',sans-serif;
  -webkit-font-smoothing:antialiased;
  min-height:100vh;
  overflow-x:hidden;
}

/* Ambient mesh */
body::before{
  content:'';
  position:fixed;inset:0;
  background:
    radial-gradient(ellipse 80% 50% at 10% 15%,rgba(77,159,255,.05) 0%,transparent 60%),
    radial-gradient(ellipse 60% 40% at 90% 70%,rgba(155,109,255,.06) 0%,transparent 60%),
    radial-gradient(ellipse 40% 30% at 50% 100%,rgba(0,212,170,.04) 0%,transparent 60%);
  pointer-events:none;z-index:0;
}

::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${C.muted};border-radius:9px}
::-webkit-scrollbar-thumb:hover{background:${C.sub}}

.mono{font-family:'Space Mono',monospace}
.syne{font-family:'Syne',sans-serif}

/* ── Card system ── */
.card{
  background:linear-gradient(160deg,rgba(11,16,32,.92) 0%,rgba(7,11,24,.96) 100%);
  border:1px solid ${C.border};
  border-radius:22px;
  backdrop-filter:blur(20px);
  -webkit-backdrop-filter:blur(20px);
  position:relative;
  overflow:hidden;
  transition:border-color .25s,transform .25s,box-shadow .25s;
}
.card::before{
  content:'';
  position:absolute;inset:0;
  background:radial-gradient(ellipse at 25% 0%,rgba(77,159,255,.05) 0%,transparent 55%);
  pointer-events:none;border-radius:inherit;
}
.card:hover{border-color:${C.borderHi}}
.card-lift:hover{transform:translateY(-3px);box-shadow:0 24px 64px rgba(0,0,0,.55)}

/* ── Stat card ── */
.sc{
  background:linear-gradient(160deg,rgba(11,16,32,.92),rgba(7,11,24,.96));
  border:1px solid ${C.border};
  border-radius:22px;
  overflow:hidden;
  transition:all .35s cubic-bezier(.22,1,.36,1);
  cursor:default;
  position:relative;
}
.sc::after{
  content:'';
  position:absolute;
  top:0;left:20%;right:20%;height:1px;
  background:linear-gradient(90deg,transparent,var(--sc-color,${C.accent}),transparent);
  opacity:0;
  transition:opacity .3s;
}
.sc:hover{
  transform:translateY(-5px);
  box-shadow:0 28px 72px rgba(0,0,0,.6),0 0 0 1px var(--sc-color,${C.accent})18;
  border-color:var(--sc-color,${C.accent})28;
}
.sc:hover::after{opacity:.8}

/* ── Section label ── */
.slabel{
  font-family:'Space Mono',monospace;
  font-size:10px;font-weight:700;
  letter-spacing:2px;text-transform:uppercase;
  color:${C.sub};
  display:flex;align-items:center;gap:8px;
}

/* ── Nav ── */
.ntab{
  display:flex;align-items:center;gap:6px;
  padding:9px 18px;border-radius:14px;
  cursor:pointer;font-size:13px;font-weight:600;
  border:1px solid transparent;
  font-family:'Outfit',sans-serif;
  transition:all .2s;white-space:nowrap;
}
.ntab-on{
  background:rgba(77,159,255,.14);
  border-color:rgba(77,159,255,.35);
  color:${C.accent};
}
.ntab-off{background:transparent;color:${C.sub}}
.ntab-off:hover{background:rgba(255,255,255,.04);color:${C.text};border-color:${C.border}}

/* ── Table ── */
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{
  text-align:left;padding:13px 18px;
  font-family:'Space Mono',monospace;font-size:9px;font-weight:700;
  letter-spacing:1.8px;text-transform:uppercase;
  color:${C.sub};
  border-bottom:1px solid ${C.border};
  white-space:nowrap;background:rgba(255,255,255,.01);
}
.tbl td{
  padding:12px 18px;
  border-bottom:1px solid rgba(77,159,255,.04);
  vertical-align:middle;color:${C.text};
}
.tbl tbody tr{transition:background .15s}
.tbl tbody tr:hover td{background:rgba(77,159,255,.04)}
.tbl tbody tr:last-child td{border-bottom:none}

/* ── Badges ── */
.badge{
  display:inline-flex;align-items:center;gap:4px;
  padding:3px 10px;border-radius:8px;
  font-family:'Space Mono',monospace;font-size:10px;font-weight:700;
  letter-spacing:.5px;white-space:nowrap;
}
.bw{background:rgba(0,230,118,.1);color:${C.win};border:1px solid rgba(0,230,118,.22)}
.bl{background:rgba(255,69,105,.1);color:${C.loss};border:1px solid rgba(255,69,105,.22)}
.bp{background:rgba(255,179,0,.08);color:${C.pend};border:1px solid rgba(255,179,0,.2)}
.b1{background:rgba(77,159,255,.1);color:${C.accent};border:1px solid rgba(77,159,255,.28)}
.bo{background:rgba(0,212,170,.08);color:${C.teal};border:1px solid rgba(0,212,170,.22)}
.ba{background:rgba(155,109,255,.1);color:${C.violet};border:1px solid rgba(155,109,255,.25)}
.bs{background:rgba(37,48,80,.3);color:${C.sub};border:1px solid rgba(37,48,80,.5)}

/* ── Select ── */
.sel{
  background:${C.s1};border:1px solid ${C.border};
  color:${C.text};padding:8px 14px;border-radius:12px;
  font-family:'Space Mono',monospace;font-size:11px;
  outline:none;cursor:pointer;transition:border-color .2s;
  appearance:none;-webkit-appearance:none;
}
.sel:focus,.sel:hover{border-color:rgba(77,159,255,.35)}

/* ── Dot ── */
.dot{width:8px;height:8px;border-radius:50%;background:${C.win};flex-shrink:0}
.dot-live{animation:dpulse 2.2s ease-in-out infinite}
.dot-off{background:${C.loss}}
@keyframes dpulse{
  0%,100%{box-shadow:0 0 0 0 rgba(0,230,118,.55)}
  60%{box-shadow:0 0 0 8px rgba(0,230,118,0)}
}

/* ── Log cards ── */
.log{
  border-radius:14px;padding:12px 14px;
  border:1px solid transparent;
  border-left-width:3px;
  animation:lslide .3s cubic-bezier(.22,1,.36,1);
}
@keyframes lslide{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
.log-pred{background:rgba(77,159,255,.06);border-color:rgba(77,159,255,.15);border-left-color:${C.accent}}
.log-res{background:rgba(0,230,118,.06);border-color:rgba(0,230,118,.15);border-left-color:${C.win}}
.log-parl{background:rgba(255,179,0,.05);border-color:rgba(255,179,0,.15);border-left-color:${C.pend}}
.log-err{background:rgba(255,69,105,.06);border-color:rgba(255,69,105,.15);border-left-color:${C.loss}}
.log-def{background:rgba(255,255,255,.025);border-color:${C.border};border-left-color:${C.muted}}

/* ── Parlay pick row ── */
.ppick{
  font-family:'Space Mono',monospace;font-size:11px;
  padding:10px 14px;
  border-bottom:1px solid rgba(255,255,255,.04);
  display:flex;align-items:flex-start;gap:8px;
  color:${C.text};line-height:1.6;
}
.ppick:last-child{border-bottom:none}

/* ── Big number ── */
.bignum{
  font-family:'Syne',sans-serif;font-size:32px;
  font-weight:800;letter-spacing:-2px;line-height:1;
  color:${C.text};
}

/* ── Ticker ── */
@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.ticker-wrap{
  overflow:hidden;height:38px;
  display:flex;align-items:center;
  background:linear-gradient(90deg,${C.bg} 0%,rgba(77,159,255,.03) 30%,rgba(77,159,255,.03) 70%,${C.bg} 100%);
  border-top:1px solid ${C.border};border-bottom:1px solid ${C.border};
}
.ticker-inner{
  display:flex;gap:52px;
  animation:ticker 38s linear infinite;
  white-space:nowrap;padding:0 28px;
}
.ticker-inner:hover{animation-play-state:paused}

/* ── Popup ── */
@keyframes popSlide{from{opacity:0;transform:translateY(24px) scale(.93)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes popFade{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-8px)}}
.popup-in{animation:popSlide .4s cubic-bezier(.16,1,.3,1) forwards}
.popup-out{animation:popFade .3s ease forwards;pointer-events:none}
@keyframes timeGlow{0%,100%{opacity:1}50%{opacity:.4}}
.time-blink{animation:timeGlow 1.2s ease-in-out infinite}

/* ── Ping ── */
@keyframes ping{75%,100%{transform:scale(2.2);opacity:0}}
.ping{animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite}

/* ── Flow diagram ── */
@keyframes flowAnim{from{stroke-dashoffset:18}to{stroke-dashoffset:0}}
@keyframes blip{0%,100%{opacity:1}50%{opacity:.15}}
.blip-dot{animation:blip 2.2s ease-in-out infinite}

/* ── Fade in ── */
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp .5s cubic-bezier(.22,1,.36,1) both}
.fu1{animation-delay:.06s}.fu2{animation-delay:.12s}.fu3{animation-delay:.18s}
.fu4{animation-delay:.24s}.fu5{animation-delay:.30s}

/* ── Scroll-x ── */
.scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch}
.scroll-x::-webkit-scrollbar{height:2px}

/* ── Shimmer ── */
@keyframes shimmer{from{background-position:-200% 0}to{background-position:200% 0}}
.shimmer{
  background:linear-gradient(90deg,${C.s1} 25%,${C.s2} 50%,${C.s1} 75%);
  background-size:200% 100%;animation:shimmer 1.8s infinite;border-radius:8px;
}

/* ── Ping anim for WS indicator ── */
@keyframes wsping{0%{transform:scale(1);opacity:.8}50%{transform:scale(1.5);opacity:0}}
.ws-ping{animation:wsping 2s ease-out infinite}

/* ── Loading spinner ── */
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.spin{animation:spin 1.2s linear infinite}

/* ── Mobile ── */
.bottom-nav{display:none}
@media(max-width:768px){
  .bottom-nav{
    display:flex;position:fixed;bottom:0;left:0;right:0;
    background:rgba(7,11,24,.96);
    border-top:1px solid ${C.border};
    z-index:100;padding:8px 0 calc(8px + env(safe-area-inset-bottom));
    backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
  }
  .bnav-item{
    flex:1;display:flex;flex-direction:column;align-items:center;
    gap:3px;cursor:pointer;padding:4px 0;
    background:none;border:none;outline:none;transition:opacity .15s;
  }
  .bnav-item span:first-child{font-size:18px;line-height:1}
  .bnav-item span:last-child{font-size:9px;font-family:'Space Mono',monospace;letter-spacing:.5px}
  .bnav-active span:last-child{color:${C.accent}}
  .bnav-off span:last-child{color:${C.muted}}
  .bnav-active span:first-child{filter:drop-shadow(0 0 5px ${C.accent})}
  .desktop-only{display:none!important}
  .mobile-pb{padding-bottom:80px!important}
  .stat-grid{grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
  .chart-grid{grid-template-columns:1fr!important}
  .main-grid{grid-template-columns:1fr!important}
  .bignum{font-size:24px!important}
  .tbl th,.tbl td{padding:10px 12px;font-size:11px}
}
@media(min-width:769px){.mobile-only{display:none!important}}
`;

/* ─── CUSTOM TOOLTIP ──────────────────────────────────────────────────────── */
const CTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.s2, border: `1px solid ${C.borderHi}`,
      borderRadius: 14, padding: "10px 14px",
      fontFamily: "'Space Mono',monospace", fontSize: 11,
      boxShadow: "0 16px 48px rgba(0,0,0,.7)",
    }}>
      <div style={{ color: C.sub, fontSize: 9, marginBottom: 7, letterSpacing: "1px" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: C.text, marginBottom: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, display: "inline-block" }} />
          <span style={{ color: C.sub, fontSize: 9 }}>{p.name}</span>
          <span style={{ fontWeight: 700, marginLeft: "auto", paddingLeft: 14, color: p.color }}>
            {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─── CONFIDENCE BAR ──────────────────────────────────────────────────────── */
const ConfBar = ({ val }) => {
  const filled = Math.min(Math.round(val / 20), 5);
  const clr = val >= 80 ? C.win : val >= 60 ? C.accent : val >= 40 ? C.pend : C.loss;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{
          width: 6, height: 14, borderRadius: 3,
          background: i < filled ? clr : C.dim,
          boxShadow: i < filled ? `0 0 7px ${clr}66` : "none",
          transition: "background .2s",
        }} />
      ))}
      <span style={{ fontFamily:"'Space Mono',monospace", fontSize: 10, color: C.sub, marginLeft: 5 }}>{val}%</span>
    </div>
  );
};

/* ─── STAT CARD ───────────────────────────────────────────────────────────── */
const StatCard = ({ value, label, color, icon, sub }) => (
  <div className="sc fu" style={{ padding: "20px 22px", "--sc-color": color }}>
    {/* Top accent glow */}
    <div style={{
      position:"absolute", top:0, left:0, right:0, height: 1,
      background: `linear-gradient(90deg, transparent 0%, ${color}60 50%, transparent 100%)`,
    }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <div className="bignum" style={{ color: color || C.text }}>{value}</div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 8, fontWeight: 500, letterSpacing: ".3px" }}>{label}</div>
        {sub && <div style={{ fontFamily:"'Space Mono',monospace", fontSize: 9, color: C.muted, marginTop: 4 }}>{sub}</div>}
      </div>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: `${color}12`, border: `1px solid ${color}24`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, flexShrink: 0,
        boxShadow: `0 0 20px ${color}18`,
      }}>{icon}</div>
    </div>
  </div>
);

/* ─── LOG CARD ────────────────────────────────────────────────────────────── */
const LogCard = ({ log }) => {
  const time = new Date(log.ts).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
  const ev = {
    new_prediction: { label: "NEW PICK",      color: C.accent, cn: "log-pred" },
    result_tracked: { label: "RESULT",         color: C.win,    cn: "log-res"  },
    result_update:  { label: "MANUAL RESULT",  color: C.win,    cn: "log-res"  },
    parlay_ready:   { label: "PARLAY READY",   color: C.pend,   cn: "log-parl" },
    error:          { label: "ERROR",          color: C.loss,   cn: "log-err"  },
  }[log.event] || { label: log.event.replace(/_/g," ").toUpperCase(), color: C.sub, cn: "log-def" };

  return (
    <div className={`log ${ev.cn}`}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, fontWeight:700, color:ev.color, letterSpacing:"1.2px" }}>
          {ev.label}
        </span>
        <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:C.muted }}>{time}</span>
      </div>
      <div style={{ fontFamily:"'Space Mono',monospace", fontSize:11, lineHeight:1.7, color:C.sub }}>
        {log.event === "new_prediction" && <>
          <span style={{ color:C.text, fontWeight:600 }}>{log.data?.match}</span><br/>
          <span style={{ color:ev.color }}>[ {log.data?.bet_type} ]</span>{" "}
          <span style={{ color:C.win, fontWeight:700 }}>{log.data?.pick}</span>
          <span style={{ color:C.muted }}> · {log.data?.confidence}%</span>
        </>}
        {log.event === "result_tracked" && <>
          <span style={{ color:C.text }}>{log.data?.match}</span>{" "}
          <span style={{ color:C.muted }}>{log.data?.score}</span>{" → "}
          <span style={{ color:log.data?.outcome==="win"?C.win:C.loss, fontWeight:700 }}>
            {log.data?.outcome?.toUpperCase()}
          </span>
        </>}
        {log.event === "parlay_ready" && <>
          <span style={{ color:C.pend }}>Parlay siap</span>
          <span style={{ color:C.muted }}> · {log.data?.match_count} matches</span>
        </>}
        {!["new_prediction","result_tracked","parlay_ready"].includes(log.event) &&
          <span>{JSON.stringify(log.data).slice(0,90)}</span>
        }
      </div>
    </div>
  );
};

/* ─── PARLAY PANEL ────────────────────────────────────────────────────────── */
const ParlayPanel = ({ p }) => {
  if (!p) return (
    <div style={{ textAlign:"center", padding:"36px 24px" }}>
      <div style={{ fontSize:36, marginBottom:12, opacity:.4 }}>🎰</div>
      <div style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:C.muted }}>
        Menunggu analisa berikutnya...
      </div>
    </div>
  );
  const secs = [
    { key:"parlay_1x2", label:"1X2", color:C.accent,  bg:"rgba(77,159,255,.06)"  },
    { key:"parlay_ou",  label:"O/U", color:C.teal,    bg:"rgba(0,212,170,.06)"   },
    { key:"parlay_ah",  label:"AH",  color:C.violet,  bg:"rgba(155,109,255,.06)" },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {secs.map(({ key, label, color, bg }) => {
        const picks = p[key] || [];
        if (!picks.length) return null;
        return (
          <div key={key} style={{ background:bg, border:`1px solid ${color}22`, borderRadius:14, overflow:"hidden" }}>
            <div style={{ padding:"9px 14px", borderBottom:`1px solid ${color}18`, display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:color, boxShadow:`0 0 8px ${color}` }} />
              <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, fontWeight:700, color, letterSpacing:"1.2px" }}>
                {label} PARLAY
              </span>
              <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:C.muted, marginLeft:"auto" }}>
                {picks.length} picks
              </span>
            </div>
            {picks.map((pick, i) => (
              <div key={i} className="ppick">
                <span style={{ color, fontSize:9, marginTop:2, flexShrink:0 }}>▸</span>
                <span>{pick}</span>
              </div>
            ))}
          </div>
        );
      })}
      {p.warning && (
        <div style={{ background:"rgba(255,69,105,.06)", border:"1px solid rgba(255,69,105,.2)", borderRadius:14, padding:"10px 14px" }}>
          <div style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:C.loss, fontWeight:700, letterSpacing:".8px", marginBottom:6 }}>⚠ WARNING</div>
          <div style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:C.sub, lineHeight:1.7 }}>{p.warning}</div>
        </div>
      )}
    </div>
  );
};

/* ─── TICKER ──────────────────────────────────────────────────────────────── */
const Ticker = ({ preds }) => {
  const recent = preds.filter(p => p.outcome==="win"||p.outcome==="loss").slice(0,12);
  if (!recent.length) return null;
  const items = [...recent, ...recent];
  return (
    <div className="ticker-wrap">
      <div className="ticker-inner">
        {items.map((p, i) => (
          <span key={i} style={{ fontFamily:"'Space Mono',monospace", fontSize:11, display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
            <span style={{ color:C.sub, fontSize:10 }}>{p.match_name}</span>
            <span style={{ color:p.outcome==="win"?C.win:C.loss, fontWeight:700, fontSize:10 }}>
              {p.outcome==="win" ? "✓ WIN" : "✗ LOSS"}
            </span>
            <span style={{ color:C.muted, fontSize:16, lineHeight:1 }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
};

/* ─── EMPTY STATE ─────────────────────────────────────────────────────────── */
const EmptyState = ({ icon, title, desc }) => (
  <div style={{ textAlign:"center", padding:"52px 24px" }}>
    <div style={{ fontSize:38, marginBottom:14, opacity:.45 }}>{icon}</div>
    <div style={{ fontSize:14, fontWeight:600, color:C.sub, marginBottom:7 }}>{title}</div>
    <div style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:C.muted, lineHeight:1.8, whiteSpace:"pre-line" }}>{desc}</div>
  </div>
);

/* ─── INFO BANNER ─────────────────────────────────────────────────────────── */
const InfoBanner = ({ preds }) => {
  if (preds.length > 0) return null;
  return (
    <div style={{
      background:"rgba(255,179,0,.05)", border:"1px solid rgba(255,179,0,.18)",
      borderRadius:14, padding:"12px 18px", margin:"12px 18px",
      display:"flex", gap:12, alignItems:"flex-start",
    }}>
      <span style={{ fontSize:16, flexShrink:0 }}>💡</span>
      <div style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:C.sub, lineHeight:1.8 }}>
        <span style={{ color:C.pend, fontWeight:700 }}>Kenapa tabel kosong?</span>{" "}
        Tabel ini baca dari <span style={{ color:C.text }}>SQLite database</span>. Pastikan{" "}
        <span style={{ color:C.accent }}>bot.py</span> memanggil{" "}
        <span style={{ color:C.win }}>db.save_prediction()</span>{" "}
        sebelum push ke <span style={{ color:C.accent }}>/api/push-prediction</span>.
        Live Feed bekerja karena WebSocket — database harus diisi terpisah.
      </div>
    </div>
  );
};

/* ─── AI FLOW DIAGRAM ─────────────────────────────────────────────────────── */
const AIFlowDiagram = () => {
  const [active, setActive] = useState(null);

  const nodes = {
    api:      { label: "TheSportsDB API",      sub: "12 Liga · Free · No Auth",              color:C.teal,   glow:C.teal   },
    prep:     { label: "Preprocessing",         sub: "Cache · Normalisasi · Feature Eng",      color:C.sub,    glow:"#4A6080" },
    stat:     { label: "Agent Statistik",       sub: "Form · H2H · Historis",                  color:C.violet, glow:C.violet },
    odds:     { label: "Agent Odds",            sub: "Value Bet · Market Eval",                color:C.violet, glow:C.violet },
    ctx:      { label: "Agent Konteks",         sub: "Cedera · Cuaca · Motivasi",              color:C.violet, glow:C.violet },
    debate:   { label: "Debate Engine",         sub: "Multi-Agent Voting → Confidence",         color:C.pend,   glow:C.pend   },
    learning: { label: "Learning Engine",       sub: "Auto-Weight dari Hasil Aktual",          color:C.win,    glow:C.win    },
    pred:     { label: "Prediksi 1X2/OU/AH",    sub: "Confidence % per Bet Type",              color:C.accent, glow:C.accent },
    parlay:   { label: "Parlay Builder",        sub: "Gabung Picks Value Tinggi",              color:"#FF6E7A", glow:"#FF6E7A" },
    tg:       { label: "Telegram Bot",          sub: "Push Notifikasi Real-time",              color:C.accent, glow:C.accent },
    web:      { label: "Dashboard Web",         sub: "Live · Charts · Schedule",               color:C.teal,   glow:C.teal   },
  };

  const info = {
    api:      "TheSportsDB (free key=123) menyediakan fixtures, hasil, dan info tim untuk 12 liga. Data di-cache 15 menit untuk menghindari rate-limit.",
    prep:     "Data mentah dari API difilter, dinormalisasi, dan di-cache. Tim tidak dikenali diberi TTL 24 jam sebelum otomatis dihapus.",
    stat:     "Agent ini menganalisa statistik historis: performa kandang/tandang, head-to-head, dan form 5 pertandingan terakhir.",
    odds:     "Agent evaluasi value bet — apakah odds yang ditawarkan sepadan dengan probabilitas yang diprediksikan AI.",
    ctx:      "Informasi kontekstual: apakah ada pemain cedera kunci? Pertandingan dengan taruhan tinggi? Kondisi cuaca ekstrem?",
    debate:   "Tiga agent berdebat dan saling berargumen. Sistem voting konsensus menghasilkan prediksi final beserta confidence score.",
    learning: "Setelah pertandingan selesai, hasil aktual dibandingkan dengan prediksi. Bobot setiap agent diperbarui otomatis.",
    pred:     "Output prediksi dalam 3 jenis taruhan: 1X2 (hasil akhir), OU (over/under gol), AH (asian handicap).",
    parlay:   "Picks dengan confidence tertinggi digabungkan menjadi satu paket parlay dengan potensi odds lebih besar.",
    tg:       "Bot Telegram mengirimkan notifikasi real-time setiap ada prediksi baru, hasil match, atau parlay siap.",
    web:      "Dashboard ini — live feed via WebSocket, winrate chart, tabel prediksi, dan jadwal pertandingan.",
  };

  const NodeBox = ({ id, x, y, w = 200 }) => {
    const n = nodes[id];
    const isActive = active === id;
    return (
      <g onClick={() => setActive(active===id?null:id)} style={{ cursor:"pointer" }}>
        <rect x={x} y={y} width={w} height={52} rx={11}
          fill={isActive ? `${n.glow}20` : "rgba(255,255,255,.025)"}
          stroke={isActive ? n.glow : "rgba(255,255,255,.07)"}
          strokeWidth={isActive ? 1.5 : 0.8}
          style={{ transition:"all .2s" }}
        />
        {isActive && <rect x={x} y={y} width={w} height={2} rx={1} fill={n.glow} opacity={.9} />}
        <text x={x+w/2} y={y+18} textAnchor="middle"
          fill={n.color} fontFamily="'Space Mono',monospace"
          fontSize={9} fontWeight={700} letterSpacing={0.8}
        >{n.label}</text>
        <text x={x+w/2} y={y+35} textAnchor="middle"
          fill="#3A4D70" fontFamily="'Outfit',sans-serif" fontSize={9}
        >{n.sub}</text>
      </g>
    );
  };

  const activeInfo = active ? info[active] : null;
  const activeNode = active ? nodes[active] : null;

  return (
    <div className="card" style={{ overflow:"hidden" }}>
      <div style={{ padding:"16px 22px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:10, background:"rgba(77,159,255,.12)", border:`1px solid rgba(77,159,255,.2)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🧠</div>
        <div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15 }}>Cara Kerja AI</div>
          <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:C.muted, letterSpacing:"1px" }}>KLIK NODE UNTUK DETAIL</div>
        </div>
      </div>

      {activeInfo && (
        <div style={{
          margin:"14px 18px 0",
          background:`${activeNode.glow}12`,
          border:`1px solid ${activeNode.glow}28`,
          borderRadius:12, padding:"12px 16px",
          display:"flex", gap:10, alignItems:"flex-start",
          animation:"lslide .2s ease",
        }}>
          <div style={{ width:3, borderRadius:2, background:activeNode.glow, alignSelf:"stretch", flexShrink:0 }} />
          <div>
            <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, fontWeight:700, color:activeNode.glow, letterSpacing:"1px", marginBottom:6 }}>
              {activeNode.label.toUpperCase()}
            </div>
            <div style={{ fontSize:13, color:C.sub, lineHeight:1.7 }}>{activeInfo}</div>
          </div>
        </div>
      )}

      <div style={{ padding:"12px 16px 16px", overflowX:"auto" }}>
        <svg width="100%" viewBox="0 0 700 615" style={{ minWidth:560 }}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 2L8 5L2 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>

          <NodeBox id="api" x={220} y={12} w={260} />
          <line x1={350} y1={64} x2={350} y2={96} stroke={C.muted} strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 1.8s linear infinite"}} />

          <NodeBox id="prep" x={175} y={96} w={350} />
          <line x1={260} y1={148} x2={140} y2={190} stroke={C.teal} strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 1.6s .2s linear infinite"}} />
          <line x1={350} y1={148} x2={350} y2={190} stroke={C.teal} strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 1.6s .4s linear infinite"}} />
          <line x1={440} y1={148} x2={560} y2={190} stroke={C.teal} strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 1.6s .6s linear infinite"}} />

          <NodeBox id="stat" x={30}  y={190} w={190} />
          <NodeBox id="odds" x={255} y={190} w={190} />
          <NodeBox id="ctx"  x={480} y={190} w={190} />

          <line x1={125} y1={242} x2={260} y2={284} stroke={C.violet} strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 2s .1s linear infinite"}} />
          <line x1={350} y1={242} x2={350} y2={284} stroke={C.violet} strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 2s .3s linear infinite"}} />
          <line x1={575} y1={242} x2={440} y2={284} stroke={C.violet} strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 2s .5s linear infinite"}} />

          <NodeBox id="debate" x={155} y={284} w={390} />
          <circle className="blip-dot" cx={144} cy={310} r={4} fill={C.pend} />
          <circle className="blip-dot" cx={556} cy={310} r={4} fill={C.pend} style={{animationDelay:".8s"}} />

          <line x1={350} y1={336} x2={350} y2={374} stroke={C.pend} strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 1.5s linear infinite"}} />

          <NodeBox id="learning" x={155} y={374} w={390} />

          <line x1={280} y1={426} x2={190} y2={464} stroke="#FF6E7A" strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 1.7s .1s linear infinite"}} />
          <line x1={420} y1={426} x2={510} y2={464} stroke="#FF6E7A" strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 1.7s .3s linear infinite"}} />

          <NodeBox id="pred"   x={60}  y={464} w={260} />
          <NodeBox id="parlay" x={380} y={464} w={260} />

          <line x1={150} y1={516} x2={150} y2={546} stroke={C.accent} strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 1.4s linear infinite"}} />
          <line x1={220} y1={516} x2={430} y2={546} stroke={C.accent} strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 1.4s .3s linear infinite"}} />
          <line x1={510} y1={516} x2={510} y2={546} stroke={C.win} strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 1.4s linear infinite"}} />
          <line x1={440} y1={516} x2={260} y2={546} stroke={C.win} strokeWidth={1} strokeDasharray="6 3" fill="none" markerEnd="url(#arr)" style={{animation:"flowAnim 1.4s .3s linear infinite"}} />

          <NodeBox id="tg"  x={30}  y={546} w={280} />
          <NodeBox id="web" x={390} y={546} w={280} />

          <path d={`M 30 572 L 12 572 L 12 400 L 153 400`} fill="none"
            stroke="rgba(255,255,255,.09)" strokeWidth={1} strokeDasharray="4 4" markerEnd="url(#arr)" />
          <text x={8} y={490} fontSize={8} fill="rgba(255,255,255,.2)"
            fontFamily="'Space Mono',monospace" transform="rotate(-90,8,490)" textAnchor="middle">
            feedback
          </text>
        </svg>
      </div>

      <div style={{ padding:"0 18px 18px", display:"flex", flexWrap:"wrap", gap:6 }}>
        {["PL","PD","SA","BL1","FL1","UCL","UEL","ELC","PPL","DED","BSA","MLS"].map(c => (
          <span key={c} style={{
            fontFamily:"'Space Mono',monospace", fontSize:9, fontWeight:700,
            padding:"3px 10px", borderRadius:7, letterSpacing:".8px",
            background:"rgba(77,159,255,.1)", border:"1px solid rgba(77,159,255,.2)", color:C.accent,
          }}>{c}</span>
        ))}
        <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, padding:"3px 8px", color:C.muted }}>
          via TheSportsDB FREE
        </span>
      </div>
    </div>
  );
};

/* ─── UPCOMING MATCH POPUP ────────────────────────────────────────────────── */
const UpcomingPopup = ({ pred, visible, total, idx, onClose }) => {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!pred?.next_match?.time_left_sec) return;
    const fetchedAt = Date.now();
    const tick = () => {
      const elapsed = Math.floor((Date.now()-fetchedAt)/1000);
      const sec = Math.max(0, pred.next_match.time_left_sec - elapsed);
      const h = Math.floor(sec/3600);
      const m = Math.floor((sec%3600)/60);
      const s = sec%60;
      if (h>0) setTimeLeft(`${h}h ${m}m`);
      else if (m>0) setTimeLeft(`${m}m ${s}s`);
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
  const isUnknown = pred.api_status==="unknown" || !m;
  const ac = isUnknown ? C.violet : isVerySoon ? C.loss : isSoon ? C.pend : C.accent;
  const bc = pred.bet_type==="1X2" ? C.accent : pred.bet_type==="OU" ? C.teal : C.violet;
  const parts = pred.match_name?.split(" vs ") || ["?","?"];
  const homeD = m?.home || parts[0]?.trim() || "?";
  const awayD = m?.away || parts[1]?.trim() || "?";
  const kickoffStr = m?.kickoff_wib
    ? new Date(m.kickoff_wib).toLocaleString("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})
    : null;

  return (
    <div className={visible?"popup-in":"popup-out"} style={{
      position:"fixed", bottom:24, right:20, zIndex:999, width:306,
      background:"linear-gradient(160deg,rgba(9,13,26,.97),rgba(6,9,19,.98))",
      border:`1px solid ${ac}40`, borderRadius:22,
      boxShadow:`0 32px 80px rgba(0,0,0,.85),0 0 0 1px ${ac}12,inset 0 1px 0 rgba(255,255,255,.05)`,
      backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)",
      overflow:"hidden",
    }}>
      {/* Top glow strip */}
      <div style={{
        position:"absolute", top:0, left:0, right:0, height:2,
        background:`linear-gradient(90deg,transparent 0%,${ac} 40%,${ac} 60%,transparent 100%)`,
        opacity:.9,
      }} />

      {/* Header */}
      <div style={{ padding:"14px 16px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{
            width:24, height:24, borderRadius:8,
            background:`${ac}18`, border:`1px solid ${ac}35`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:12,
          }}>
            {isUnknown?"🔮":isVerySoon?"⚡":"📅"}
          </div>
          <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, fontWeight:700, letterSpacing:"1.6px", color:ac }}>
            {isUnknown?"PREDIKSI AKTIF":isVerySoon?"KICKS OFF SOON":isSoon?"UPCOMING · <1H":"NEXT MATCH"}
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {total>1 && (
            <div style={{ display:"flex", gap:4 }}>
              {Array.from({length:Math.min(total,6)}).map((_,i) => (
                <div key={i} style={{
                  width:i===(idx%Math.min(total,6))?14:5, height:5, borderRadius:3,
                  background:i===(idx%Math.min(total,6))?ac:C.dim,
                  transition:"all .3s ease",
                }} />
              ))}
            </div>
          )}
          <button onClick={onClose} style={{
            background:"rgba(255,255,255,.05)", border:`1px solid rgba(255,255,255,.1)`,
            color:C.muted, cursor:"pointer", fontSize:11, lineHeight:1,
            borderRadius:7, padding:"3px 7px", transition:"all .15s",
          }}>✕</button>
        </div>
      </div>

      {/* Teams */}
      <div style={{ padding:"12px 16px 0" }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.text, lineHeight:1.3 }}>{homeD}</div>
        <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:C.muted, margin:"4px 0", letterSpacing:"2px" }}>VS</div>
        <div style={{ fontSize:14, fontWeight:700, color:C.text, lineHeight:1.3 }}>{awayD}</div>
      </div>

      {/* Pick badge */}
      <div style={{ padding:"10px 16px 0", display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
        <span style={{
          background:`${bc}18`, border:`1px solid ${bc}35`, borderRadius:8,
          padding:"3px 9px", fontFamily:"'Space Mono',monospace", fontSize:9,
          fontWeight:700, color:bc, letterSpacing:".8px",
        }}>{pred.bet_type}</span>
        <span style={{
          fontFamily:"'Space Mono',monospace", fontSize:10, color:C.sub,
          flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
        }}>{pred.predicted_pick}</span>
        <span style={{
          fontFamily:"'Space Mono',monospace", fontSize:9,
          color:pred.confidence>=70?C.win:pred.confidence>=50?C.pend:C.loss,
          fontWeight:700,
        }}>{pred.confidence}%</span>
      </div>

      {/* Countdown */}
      <div style={{ margin:"12px 16px 16px" }}>
        {kickoffStr ? (
          <div style={{
            background:"rgba(255,255,255,.04)", border:`1px solid rgba(255,255,255,.07)`,
            borderRadius:14, padding:"12px 14px",
            display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            <div>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:8, color:C.muted, letterSpacing:"1.2px", marginBottom:4 }}>KICKOFF WIB</div>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:12, fontWeight:700, color:C.text }}>{kickoffStr}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:8, color:C.muted, letterSpacing:"1.2px", marginBottom:4 }}>TIME LEFT</div>
              <div className={isVerySoon?"time-blink":""} style={{
                fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800,
                color:ac, letterSpacing:"-1px",
              }}>{timeLeft||m.time_left_str}</div>
            </div>
          </div>
        ) : (
          <div style={{
            background:`${C.violet}0F`, border:`1px solid ${C.violet}22`,
            borderRadius:12, padding:"10px 14px",
            fontFamily:"'Space Mono',monospace", fontSize:9,
            color:C.muted, lineHeight:1.7,
          }}>⏳ Jadwal belum tersedia · menunggu data...</div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MAIN DASHBOARD                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [stats,         setStats]         = useState(null);
  const [preds,         setPreds]         = useState([]);
  const [history,       setHistory]       = useState([]);
  const [historyTotal,  setHistoryTotal]  = useState(0);
  const [logs,          setLogs]          = useState([]);
  const [tab,           setTab]           = useState("overview");
  const [schedule,      setSchedule]      = useState([]);
  const [comp,          setComp]          = useState("PL");
  const [loading,       setLoading]       = useState(true);
  const [wsOk,          setWsOk]          = useState(false);
  const [parlay,        setParlay]        = useState(null);
  const [upcomingPreds, setUpcomingPreds] = useState([]);
  const [popupIdx,      setPopupIdx]      = useState(0);
  const [popupVisible,  setPopupVisible]  = useState(false);
  const [popupDismissed,setPopupDismissed]= useState(false);
  const logsRef  = useRef(null);
  const predsRef = useRef([]);
  const popupCooldownRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        fetch(`${API}/api/stats`).then(r=>r.json()),
        fetch(`${API}/api/predictions?limit=50`).then(r=>r.json()),
      ]);
      setStats(s); setPreds(p); predsRef.current = p;
    } catch {}
    setLoading(false);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const d = await fetch(`${API}/api/history?limit=100`).then(r=>r.json());
      if (d && Array.isArray(d.items)) {
        setHistory(d.items);
        setHistoryTotal(d.total ?? d.items.length);
      }
    } catch(e){ console.warn("loadHistory error:", e); }
  }, []);

  const loadUpcoming = useCallback(async () => {
    try {
      const data = await fetch(`${API}/api/upcoming-predictions`).then(r=>r.json());
      if (Array.isArray(data) && data.length>0) {
        const genuine = data.filter(p =>
          !p.outcome &&
          !(p.next_match?.already_started) &&
          (p.next_match?.time_left_sec==null || p.next_match.time_left_sec>0)
        );
        setUpcomingPreds(genuine);
        return;
      }
    } catch(_){}

    const comps = ["PL","PD","SA","BL1","FL1","UCL","UEL","ELC","PPL","DED","BSA","MLS"];
    const allMatches = [];
    await Promise.all(comps.map(async c => {
      try {
        const d = await fetch(`${API}/api/schedule?competition=${c}`).then(r=>r.json());
        if (d.matches) allMatches.push(...d.matches);
      } catch(_){}
    }));

    const pending = (predsRef.current||[]).filter(p=>!p.outcome);
    const enriched = pending.map(pred => {
      const parts = (pred.match_name||"").split(" vs ");
      const home = (parts[0]||"").trim().toLowerCase();
      const away = (parts[1]||"").trim().toLowerCase();
      const found = allMatches.find(m => {
        const mh=(m.home||"").toLowerCase();
        const ma=(m.away||"").toLowerCase();
        return (mh.includes(home.split(" ")[0])||home.includes(mh.split(" ")[0])) &&
               (ma.includes(away.split(" ")[0])||away.includes(ma.split(" ")[0]));
      });
      if (!found) return { ...pred, api_status:"unknown", next_match:null };
      const kickoffUTC = new Date(found.kickoff);
      const kickoffWIB = new Date(kickoffUTC.getTime() + 7*3600000);
      const secLeft = Math.max(0, Math.floor((kickoffUTC-Date.now())/1000));
      const h = Math.floor(secLeft/3600);
      const min = Math.floor((secLeft%3600)/60);
      return {
        ...pred, api_status:"found",
        next_match:{
          home:found.home, away:found.away, competition:found.competition,
          kickoff_utc:found.kickoff, kickoff_wib:kickoffWIB.toISOString(),
          time_left_sec:secLeft,
          time_left_str:h>0?`${h}h ${min}m`:`${min}m`,
          already_started:secLeft===0,
        },
      };
    }).filter(p=>p.next_match && !p.next_match.already_started);
    setUpcomingPreds(enriched);
  }, []);

  const loadSched = useCallback(async (c) => {
    try {
      const r = await fetch(`${API}/api/schedule?competition=${c}`);
      if (!r.ok) return;
      const d = await r.json();
      setSchedule(d.matches||[]);
    } catch(e){ console.warn("loadSched error:", e); }
  }, []);

  useEffect(() => {
    load().then(()=>loadUpcoming());
    loadHistory();
    let ws, timer;
    const connect = () => {
      ws = new WebSocket(WS);
      ws.onopen  = () => setWsOk(true);
      ws.onclose = () => { setWsOk(false); timer = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        setLogs(prev=>[msg,...prev].slice(0,150));
        if (["new_prediction","result_tracked","parlay_ready","result_update"].includes(msg.event)) {
          load().then(()=>loadUpcoming());
        }
        if (["result_tracked","result_update"].includes(msg.event)) loadHistory();
        if (msg.event==="reset") {
          setPreds([]); predsRef.current=[];
          setHistory([]); setHistoryTotal(0);
          setStats(null); setParlay(null);
          setUpcomingPreds([]); setPopupVisible(false);
          load().then(()=>loadUpcoming());
          loadHistory();
        }
        if (msg.event==="parlay_ready") setParlay(msg.data);
      };
    };
    connect();
    const interval = setInterval(()=>{load().then(()=>loadUpcoming());}, 60000);
    return () => { clearTimeout(timer); clearInterval(interval); ws?.close(); };
  }, []);

  useEffect(()=>{
    if (upcomingPreds.length===0) { setPopupVisible(false); return; }
    const now = Date.now();
    const cooldownUntil = popupCooldownRef.current || 0;
    if (now<cooldownUntil) return;
    setPopupIdx(0);
    setTimeout(()=>setPopupVisible(true), 300);
    const rot = setInterval(()=>{
      if (upcomingPreds.length<=1) return;
      setPopupVisible(false);
      setTimeout(()=>{ setPopupIdx(prev=>(prev+1)%upcomingPreds.length); setTimeout(()=>setPopupVisible(true),50); },380);
    }, 12000);
    return ()=>clearInterval(rot);
  }, [upcomingPreds]);

  useEffect(()=>{ loadSched(comp); }, [comp]);
  useEffect(()=>{ if(logsRef.current) logsRef.current.scrollTop=0; }, [logs]);

  const o   = stats?.overall;
  const fmt = (n) => n?.toFixed(1)??"—";
  const resolved  = preds.filter(p=>p.outcome==="win"||p.outcome==="loss");
  const wins      = resolved.filter(p=>p.outcome==="win").length;
  const displayWR = resolved.length>0 ? Math.round(wins/resolved.length*1000)/10 : 0;

  const chartWR = resolved.slice(0,20).reverse().map((p,i,arr)=>({
    name:`#${p.id}`,
    wr:Math.round((arr.slice(0,i+1).filter(x=>x.outcome==="win").length/(i+1))*1000)/10,
  }));
  const btData  = (stats?.by_bet_type??[]).map(b=>({ name:b.bet_type,"Win Rate":b.win_rate, wins:b.wins, total:b.total }));
  const btColor = { "1X2":C.accent, "OU":C.teal, "AH":C.violet };

  const navItems = [
    { key:"overview",   icon:"⚡", label:"Overview"    },
    { key:"predictions",icon:"🔮", label:"Picks"        },
    { key:"history",    icon:"📜", label:"History"      },
    { key:"schedule",   icon:"📅", label:"Schedule"     },
    { key:"feed",       icon:"📡", label:"Live Feed"    },
    { key:"parlay",     icon:"🏆", label:"Parlay"       },
    { key:"howitworks", icon:"🧠", label:"How It Works" },
  ];

  /* ── LOADING ── */
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24 }}>
        <div style={{
          width:60, height:60, borderRadius:18,
          background:"linear-gradient(135deg,rgba(77,159,255,.2),rgba(155,109,255,.1))",
          border:`1px solid ${C.borderHi}`,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:28,
          boxShadow:`0 0 40px rgba(77,159,255,.2)`,
        }}>⚽</div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, letterSpacing:"-1px" }}>
          Parlay <span style={{color:C.accent}}>AI</span>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {[0,1,2].map(i=>(
            <div key={i} style={{
              width:6, height:6, borderRadius:"50%",
              background:C.accent,
              animation:`dpulse 1.4s ${i*.2}s ease-in-out infinite`,
              boxShadow:`0 0 10px ${C.accent}`,
            }} />
          ))}
        </div>
        <div style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:C.muted, letterSpacing:"3px" }}>
          LOADING SYSTEM...
        </div>
      </div>
    </>
  );

  /* ── RENDER ── */
  return (
    <>
      <Head>
        <title>Parlay AI — Football Intelligence</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <meta name="theme-color" content={C.bg} />
      </Head>
      <style>{CSS}</style>

      {/* ═══════ HEADER ═══════ */}
      <header style={{
        position:"sticky", top:0, zIndex:50,
        background:`${C.bg}E8`,
        backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
        borderBottom:`1px solid ${C.border}`,
        padding:"12px 24px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{
            width:44, height:44, borderRadius:14,
            background:"linear-gradient(135deg,rgba(77,159,255,.22) 0%,rgba(77,159,255,.06) 100%)",
            border:`1px solid rgba(77,159,255,.3)`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:22,
            boxShadow:`0 0 30px rgba(77,159,255,.2), inset 0 1px 0 rgba(255,255,255,.1)`,
          }}>⚽</div>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:19, fontWeight:800, letterSpacing:"-1px", lineHeight:1 }}>
              Parlay <span style={{color:C.accent}}>AI</span>
            </div>
            <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:C.muted, letterSpacing:"2.5px", marginTop:3 }}>
              FOOTBALL INTELLIGENCE
            </div>
          </div>
        </div>

        {/* Right side */}
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          {/* Win Rate Pill */}
          <div style={{
            background:`linear-gradient(135deg,rgba(0,230,118,.12),rgba(0,230,118,.04))`,
            border:`1px solid rgba(0,230,118,.22)`,
            borderRadius:14, padding:"8px 16px",
            display:"flex", flexDirection:"column", alignItems:"flex-end",
          }}>
            <span style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:C.win, letterSpacing:"-1.5px", lineHeight:1 }}>
              {fmt(o?.win_rate??0)}%
            </span>
            <span style={{ fontFamily:"'Space Mono',monospace", fontSize:8, color:`${C.win}88`, letterSpacing:"2px" }}>WIN RATE</span>
          </div>

          {/* WS Status */}
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <div style={{ position:"relative", width:10, height:10 }}>
              <div className={`dot ${wsOk?"dot-live":"dot-off"}`} style={{ position:"absolute", inset:0 }} />
              {wsOk && <div className="dot ws-ping" style={{ position:"absolute", inset:0, opacity:.3 }} />}
            </div>
            <span className="desktop-only" style={{
              fontFamily:"'Space Mono',monospace", fontSize:10,
              color:wsOk?C.win:C.loss, letterSpacing:"1.5px",
            }}>
              {wsOk?"LIVE":"OFFLINE"}
            </span>
          </div>
        </div>
      </header>

      {/* ═══════ TICKER ═══════ */}
      <Ticker preds={preds} />

      {/* ═══════ DESKTOP NAV ═══════ */}
      <div className="desktop-only" style={{ maxWidth:1440, margin:"0 auto", padding:"18px 24px 0", display:"flex", gap:6, overflowX:"auto" }}>
        {navItems.map(n=>(
          <button key={n.key} className={`ntab ${tab===n.key?"ntab-on":"ntab-off"}`}
            onClick={()=>setTab(n.key)}>
            <span style={{ fontSize:14 }}>{n.icon}</span> {n.label}
          </button>
        ))}
      </div>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <main style={{ maxWidth:1440, margin:"0 auto", padding:"20px 20px 24px" }} className="mobile-pb">

        {/* ─────── OVERVIEW ─────── */}
        {tab==="overview" && (
          <>
            {/* 5-column stat grid */}
            <div className="stat-grid fu" style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:18 }}>
              <StatCard value={o?.total_predictions??0} label="Total Predictions" icon="📊" color={C.accent}  />
              <StatCard value={o?.wins??0}              label="Total Wins"         icon="✅" color={C.win}     />
              <StatCard value={o?.losses??0}            label="Total Losses"       icon="❌" color={C.loss}    />
              <StatCard value={o?.pending??0}           label="Pending"            icon="⏳" color={C.pend}    />
              <StatCard value={`${displayWR}%`}         label="Resolved WR"        icon="🎯" color={C.teal}    />
            </div>

            {/* Charts row */}
            <div className="chart-grid fu fu2" style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:14, marginBottom:18 }}>
              {/* Win rate area chart */}
              <div className="card" style={{ padding:"22px 24px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:C.accent, boxShadow:`0 0 10px ${C.accent}` }} />
                  <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:C.sub, letterSpacing:"1.5px" }}>
                    RUNNING WIN RATE
                  </span>
                </div>
                {chartWR.length===0
                  ? <EmptyState icon="📈" title="Belum ada data" desc="Resolve prediksi dulu" />
                  : <ResponsiveContainer width="100%" height={168}>
                      <AreaChart data={chartWR} margin={{top:4,right:4,bottom:0,left:-18}}>
                        <defs>
                          <linearGradient id="wrG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor={C.accent} stopOpacity={.35} />
                            <stop offset="100%" stopColor={C.accent} stopOpacity={0}   />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke={C.dim} vertical={false} />
                        <XAxis dataKey="name" tick={{fill:C.muted,fontSize:9,fontFamily:"Space Mono"}} axisLine={false} tickLine={false} />
                        <YAxis domain={[0,100]} tick={{fill:C.muted,fontSize:9,fontFamily:"Space Mono"}} axisLine={false} tickLine={false} />
                        <Tooltip content={<CTip />} cursor={{stroke:C.borderHi,strokeWidth:1,strokeDasharray:"3 3"}} />
                        <Area type="monotone" dataKey="wr" name="Win %" stroke={C.accent} strokeWidth={2.5}
                          fill="url(#wrG)" dot={false}
                          activeDot={{r:5, fill:C.accent, stroke:C.s1, strokeWidth:2}}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                }
              </div>

              {/* Bar chart by bet type */}
              <div className="card" style={{ padding:"22px 24px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:C.teal, boxShadow:`0 0 10px ${C.teal}` }} />
                  <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:C.sub, letterSpacing:"1.5px" }}>
                    WIN RATE BY TYPE
                  </span>
                </div>
                {btData.length===0
                  ? <EmptyState icon="📉" title="Belum ada data" desc="Tambah prediksi via Telegram" />
                  : <>
                      <ResponsiveContainer width="100%" height={128}>
                        <BarChart data={btData} barSize={38} margin={{top:4,right:4,bottom:0,left:-18}}>
                          <CartesianGrid strokeDasharray="2 6" stroke={C.dim} vertical={false} />
                          <XAxis dataKey="name" tick={{fill:C.sub,fontSize:11,fontFamily:"Space Mono"}} axisLine={false} tickLine={false} />
                          <YAxis domain={[0,100]} tick={{fill:C.muted,fontSize:9,fontFamily:"Space Mono"}} axisLine={false} tickLine={false} />
                          <Tooltip content={<CTip />} cursor={{fill:"rgba(255,255,255,.03)",radius:6}} />
                          <Bar dataKey="Win Rate" radius={[8,8,0,0]}>
                            {btData.map((entry,i)=>(
                              <Cell key={i} fill={btColor[entry.name]||C.accent}
                                style={{filter:`drop-shadow(0 0 12px ${btColor[entry.name]||C.accent}55)`}} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ display:"flex", gap:16, marginTop:14, justifyContent:"center" }}>
                        {Object.entries(btColor).map(([k,v])=>(
                          <div key={k} style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:8, height:8, borderRadius:3, background:v, boxShadow:`0 0 6px ${v}88` }} />
                            <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:C.sub }}>{k}</span>
                          </div>
                        ))}
                      </div>
                    </>
                }
              </div>
            </div>

            {/* Recent picks + Parlay */}
            <div className="main-grid desktop-only fu fu3" style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:14 }}>
              {/* Recent picks */}
              <div className="card" style={{ overflow:"hidden" }}>
                <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, fontWeight:700, color:C.sub, letterSpacing:"1.5px" }}>RECENT PICKS</span>
                  <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:C.muted, marginLeft:"auto" }}>{preds.length} total</span>
                </div>
                {preds.length===0
                  ? <EmptyState icon="🔮" title="Belum ada prediksi" desc={"Kirim pertandingan via Telegram.\nPastikan bot.py panggil db.save_prediction()"} />
                  : <div className="scroll-x">
                      <table className="tbl">
                        <thead><tr><th>Match</th><th>Type</th><th>Pick</th><th>Conf</th><th>Result</th></tr></thead>
                        <tbody>
                          {preds.filter(p=>p.outcome!=="skip").slice(0,6).map(p=>(
                            <tr key={p.id}>
                              <td>
                                <div style={{ fontWeight:600, fontSize:13, whiteSpace:"nowrap" }}>{p.match_name}</div>
                                <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:C.muted, marginTop:2 }}>
                                  {new Date(p.created_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}
                                </div>
                              </td>
                              <td><span className={`badge ${p.bet_type==="1X2"?"b1":p.bet_type==="OU"?"bo":"ba"}`}>{p.bet_type}</span></td>
                              <td style={{ fontFamily:"'Space Mono',monospace", fontSize:11, maxWidth:140, color:C.text }}>{p.predicted_pick}</td>
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
              <div className="card">
                <div style={{ padding:"16px 18px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:30, height:30, borderRadius:10, background:"rgba(255,179,0,.1)", border:"1px solid rgba(255,179,0,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🏆</div>
                  <span style={{ fontWeight:700, fontSize:14 }}>Latest Parlay</span>
                  {parlay && (
                    <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:C.pend, marginLeft:"auto", letterSpacing:"1px", background:"rgba(255,179,0,.1)", border:"1px solid rgba(255,179,0,.18)", borderRadius:8, padding:"3px 8px" }}>
                      ● FRESH
                    </span>
                  )}
                </div>
                <div style={{ padding:16 }}><ParlayPanel p={parlay} /></div>
              </div>
            </div>
          </>
        )}

        {/* ─────── PREDICTIONS ─────── */}
        {tab==="predictions" && (
          <div className="card fu" style={{ overflow:"hidden" }}>
            <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, fontWeight:700, color:C.sub, letterSpacing:"1.5px" }}>ALL PREDICTIONS</span>
              <span className="badge bw" style={{ marginLeft:6 }}>{resolved.length} resolved</span>
              <span className="badge bp">{o?.pending??0} pending</span>
            </div>
            <InfoBanner preds={preds} />
            {preds.filter(p=>p.outcome!=="skip").length===0
              ? <EmptyState icon="🔮" title="Database kosong" desc={"Predictions disimpan via db.save_prediction()\nbukan lewat WebSocket push"} />
              : <div className="scroll-x">
                  <table className="tbl">
                    <thead>
                      <tr><th>Match</th><th>Type</th><th>Pick</th><th>Conf</th><th>Parlay</th><th>Result</th><th>Score</th></tr>
                    </thead>
                    <tbody>
                      {preds.filter(p=>p.outcome!=="skip").map(p=>(
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight:600, fontSize:13, whiteSpace:"nowrap" }}>{p.match_name}</div>
                            <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:C.muted, marginTop:2 }}>
                              {new Date(p.created_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
                            </div>
                          </td>
                          <td><span className={`badge ${p.bet_type==="1X2"?"b1":p.bet_type==="OU"?"bo":"ba"}`}>{p.bet_type}</span></td>
                          <td style={{ fontFamily:"'Space Mono',monospace", fontSize:11, maxWidth:160, color:C.text }}>{p.predicted_pick}</td>
                          <td><ConfBar val={p.confidence} /></td>
                          <td>
                            {p.include_in_parlay
                              ? <span style={{ color:C.win, fontSize:16, fontWeight:700 }}>✓</span>
                              : <span className="badge bs">SKIP</span>
                            }
                          </td>
                          <td>
                            {p.outcome
                              ? <span className={`badge ${p.outcome==="win"?"bw":"bl"}`}>{p.outcome.toUpperCase()}</span>
                              : <span className="badge bp">PENDING</span>
                            }
                          </td>
                          <td style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:C.sub }}>{p.actual_result??"—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        )}

        {/* ─────── HISTORY ─────── */}
        {tab==="history" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {history.length>0 && (()=>{
              const hResolved = history.filter(h=>h.outcome==="win"||h.outcome==="loss");
              const hWins     = history.filter(h=>h.outcome==="win").length;
              const hLosses   = history.filter(h=>h.outcome==="loss").length;
              const hSkips    = history.filter(h=>h.outcome==="skip").length;
              const hWR       = hResolved.length>0 ? Math.round(hWins/hResolved.length*1000)/10 : 0;
              let streak=0, streakType=null;
              for (const h of history.filter(x=>x.outcome!=="skip")) {
                if (!streakType) streakType=h.outcome;
                if (h.outcome===streakType) streak++;
                else break;
              }
              return (
                <div className="stat-grid fu" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                  <StatCard value={hResolved.length} label="Win/Loss Resolved" icon="📜" color={C.sub}  sub={hSkips>0?`+${hSkips} skipped`:undefined} />
                  <StatCard value={hWins}            label="Wins"              icon="✅" color={C.win}  />
                  <StatCard value={hLosses}          label="Losses"            icon="❌" color={C.loss} />
                  <StatCard value={`${hWR}%`}        label="Win Rate"          icon="🎯"
                    color={hWR>=55?C.win:hWR>=45?C.pend:C.loss}
                    sub={streakType?`${streak}x ${streakType.toUpperCase()} streak`:undefined}
                  />
                </div>
              );
            })()}

            <div className="card fu fu2" style={{ overflow:"hidden" }}>
              <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, fontWeight:700, color:C.sub, letterSpacing:"1.5px" }}>RESOLVED HISTORY</span>
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:C.muted, marginLeft:"auto" }}>{historyTotal} total</span>
              </div>
              {history.length===0
                ? <EmptyState icon="📜" title="Belum ada history" desc="History terisi setelah prediksi di-resolve" />
                : <div className="scroll-x">
                    <table className="tbl">
                      <thead><tr><th>Match</th><th>Date</th><th>Type</th><th>Pick</th><th>Conf</th><th>Result</th><th>Score</th></tr></thead>
                      <tbody>
                        {history.map((h,i)=>(
                          <tr key={i}>
                            <td>
                              <div style={{ fontWeight:600, fontSize:13, whiteSpace:"nowrap" }}>{h.match_name}</div>
                            </td>
                            <td style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:C.sub, whiteSpace:"nowrap" }}>
                              {new Date(h.created_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
                            </td>
                            <td><span className={`badge ${h.bet_type==="1X2"?"b1":h.bet_type==="OU"?"bo":"ba"}`}>{h.bet_type}</span></td>
                            <td style={{ fontFamily:"'Space Mono',monospace", fontSize:11, maxWidth:160, color:C.text }}>{h.predicted_pick}</td>
                            <td><ConfBar val={h.confidence} /></td>
                            <td>
                              {h.outcome==="win"  && <span className="badge bw">WIN</span>}
                              {h.outcome==="loss" && <span className="badge bl">LOSS</span>}
                              {h.outcome==="skip" && <span className="badge bs">SKIP</span>}
                              {!h.outcome         && <span className="badge bp">PENDING</span>}
                            </td>
                            <td style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:C.sub }}>{h.actual_result??"—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          </div>
        )}

        {/* ─────── SCHEDULE ─────── */}
        {tab==="schedule" && (
          <div className="card fu" style={{ overflow:"hidden" }}>
            <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, fontWeight:700, color:C.sub, letterSpacing:"1.5px" }}>COMPETITION</span>
              <div style={{ position:"relative" }}>
                <select className="sel" value={comp} onChange={e=>setComp(e.target.value)}>
                  {["PL","PD","SA","BL1","FL1","UCL","UEL","ELC","PPL","DED","BSA","MLS"].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:C.muted, marginLeft:"auto" }}>
                {schedule.length} matches
              </span>
            </div>
            {schedule.length===0
              ? <EmptyState icon="📅" title="Tidak ada jadwal" desc="Pilih kompetisi lain atau cek API key" />
              : <div className="scroll-x">
                  <table className="tbl">
                    <thead><tr><th>Home</th><th>Away</th><th>League</th><th>Kickoff (WIB)</th><th>Countdown</th></tr></thead>
                    <tbody>
                      {schedule.map((m,i)=>{
                        const ko = new Date(m.kickoff);
                        const koWIB = new Date(ko.getTime()+7*3600000);
                        const secLeft = Math.max(0,Math.floor((ko-Date.now())/1000));
                        const h = Math.floor(secLeft/3600);
                        const min = Math.floor((secLeft%3600)/60);
                        const isSoon = secLeft<3600 && secLeft>0;
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight:600, whiteSpace:"nowrap" }}>{m.home}</td>
                            <td style={{ fontWeight:600, whiteSpace:"nowrap" }}>{m.away}</td>
                            <td style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:C.muted }}>{m.competition}</td>
                            <td style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:C.sub, whiteSpace:"nowrap" }}>
                              {koWIB.toLocaleString("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                            </td>
                            <td>
                              {secLeft===0
                                ? <span className="badge bl">LIVE/DONE</span>
                                : <span style={{
                                    fontFamily:"'Space Mono',monospace", fontSize:11, fontWeight:700,
                                    color:isSoon?C.pend:C.sub,
                                    textShadow:isSoon?`0 0 12px ${C.pend}66`:"none",
                                  }}>
                                    {h>0?`${h}h ${min}m`:`${min}m`}
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
        )}

        {/* ─────── LIVE FEED ─────── */}
        {tab==="feed" && (
          <div className="card fu" style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 180px)" }}>
            <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, flexShrink:0, display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ position:"relative", width:12, height:12 }}>
                <div className={`dot ${wsOk?"dot-live":"dot-off"}`} style={{ position:"absolute", inset:0 }} />
                {wsOk && <div className="dot ws-ping" style={{ position:"absolute", inset:0, opacity:.35 }} />}
              </div>
              <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15 }}>Live Feed</span>
              <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:wsOk?C.win:C.loss, letterSpacing:"1px", marginLeft:4 }}>
                {wsOk?"● CONNECTED":"● DISCONNECTED"}
              </span>
              <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:C.muted, marginLeft:"auto" }}>
                {logs.length} / 150
              </span>
            </div>
            <div ref={logsRef} style={{ flex:1, overflowY:"auto", padding:14, display:"flex", flexDirection:"column", gap:8 }}>
              {logs.length===0
                ? <EmptyState icon="📡" title="Menunggu aktivitas AI..." desc="Bot aktif akan mengirim events ke sini" />
                : logs.map((l,i)=><LogCard key={i} log={l} />)
              }
            </div>
          </div>
        )}

        {/* ─────── HOW IT WORKS ─────── */}
        {tab==="howitworks" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <AIFlowDiagram />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }} className="stat-grid">
              {[
                { icon:"🌍", title:"12 Liga Didukung",  desc:"PL · PD · SA · BL1 · FL1 · UCL · UEL · ELC · PPL · DED · BSA · MLS — semua FREE via TheSportsDB", color:C.accent  },
                { icon:"🤖", title:"Multi-Agent Debate", desc:"3 AI agents berdebat setiap prediksi — statistik, odds value, dan konteks situasional",            color:C.violet  },
                { icon:"📈", title:"Self-Learning",      desc:"Sistem belajar dari hasil aktual dan otomatis update bobot agent untuk akurasi yang terus meningkat", color:C.win    },
              ].map((card,i)=>(
                <div key={i} className="card fu" style={{ padding:"20px 22px", animationDelay:`${i*.1}s` }}>
                  <div style={{ fontSize:24, marginBottom:12, lineHeight:1 }}>{card.icon}</div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, color:card.color, marginBottom:8 }}>{card.title}</div>
                  <div style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:C.muted, lineHeight:2 }}>{card.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────── PARLAY ─────── */}
        {tab==="parlay" && (
          <div className="card fu" style={{ overflow:"hidden" }}>
            <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:11, background:"rgba(255,179,0,.1)", border:"1px solid rgba(255,179,0,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🏆</div>
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15 }}>Latest Parlay</div>
                <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:C.muted, letterSpacing:"1px" }}>
                  AI GENERATED PICK BUNDLE
                </div>
              </div>
              {parlay && (
                <span style={{
                  fontFamily:"'Space Mono',monospace", fontSize:9, color:C.pend, marginLeft:"auto",
                  letterSpacing:"1px", background:"rgba(255,179,0,.1)", border:"1px solid rgba(255,179,0,.2)",
                  borderRadius:9, padding:"4px 10px",
                }}>
                  ● FRESH · {parlay.match_count} matches
                </span>
              )}
            </div>
            <div style={{ padding:18 }}><ParlayPanel p={parlay} /></div>
          </div>
        )}

      </main>

      {/* ═══════ BOTTOM NAV (mobile) ═══════ */}
      <nav className="bottom-nav">
        {[
          { key:"overview",    icon:"⚡", label:"Overview"  },
          { key:"predictions", icon:"🔮", label:"Picks"     },
          { key:"history",     icon:"📜", label:"History"   },
          { key:"schedule",    icon:"📅", label:"Schedule"  },
          { key:"parlay",      icon:"🏆", label:"Parlay"    },
        ].map(n=>(
          <button key={n.key} className={`bnav-item ${tab===n.key?"bnav-active":"bnav-off"}`}
            onClick={()=>setTab(n.key)}>
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* ═══════ FOOTER ═══════ */}
      <div className="desktop-only" style={{
        textAlign:"center", padding:"24px 0 32px",
        fontFamily:"'Space Mono',monospace", fontSize:9,
        color:C.muted, letterSpacing:"2.5px",
        borderTop:`1px solid ${C.border}`,
        marginTop:8,
      }}>
        PARLAY AI v4 · FOR ENTERTAINMENT ONLY · BET RESPONSIBLY
      </div>

      {/* ═══════ UPCOMING MATCH POPUP ═══════ */}
      {upcomingPreds.length>0 && !popupDismissed && popupVisible && (
        <UpcomingPopup
          pred={upcomingPreds[popupIdx % upcomingPreds.length]}
          visible={popupVisible}
          total={upcomingPreds.length}
          idx={popupIdx}
          onClose={()=>{
            setPopupVisible(false);
            setPopupDismissed(true);
            popupCooldownRef.current = Date.now() + 5*60*1000;
          }}
        />
      )}
    </>
  );
}
