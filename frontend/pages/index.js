"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Head from "next/head";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "https://caring-contentment-production.up.railway.app";
const WS  = process.env.NEXT_PUBLIC_WS_URL  || "wss://caring-contentment-production.up.railway.app/ws/live";

const C = {
  bg:       "#060810",
  surface:  "#0A0D18",
  card:     "#0E1220",
  cardHi:   "#121828",
  border:   "#181E30",
  borderHi: "#1E2840",
  win:      "#00D68F",
  loss:     "#FF3D5A",
  pend:     "#FFB020",
  blue:     "#3D7EFF",
  blueGlow: "rgba(61,126,255,.15)",
  cyan:     "#00C8E0",
  purple:   "#8B5CF6",
  text:     "#E2E8F8",
  sub:      "#8896B0",
  muted:    "#3D4F6A",
  dim:      "#1A2030",
};

const mono = { fontFamily: "'Space Mono', monospace" };

const G = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:${C.bg};color:${C.text};font-family:'Space Grotesk',sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh;overflow-x:hidden}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${C.border};border-radius:99px}
.mono{font-family:'Space Mono',monospace}
.card{background:${C.card};border:1px solid ${C.border};border-radius:16px;position:relative;overflow:hidden;transition:border-color .2s}
.card:hover{border-color:${C.borderHi}}
.card-inner::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.025) 0%,transparent 50%);pointer-events:none;border-radius:inherit}
.stat-card{padding:22px 24px;cursor:default;transition:all .25s}
.stat-card:hover{border-color:${C.borderHi};transform:translateY(-3px);box-shadow:0 16px 48px rgba(0,0,0,.5)}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{text-align:left;padding:11px 16px;color:${C.sub};font-size:11px;font-weight:600;letter-spacing:.9px;text-transform:uppercase;border-bottom:1px solid ${C.border};font-family:'Space Mono',monospace}
.tbl td{padding:11px 16px;border-bottom:1px solid ${C.border}30;vertical-align:middle}
.tbl tbody tr{transition:background .15s}
.tbl tbody tr:hover td{background:rgba(61,126,255,.04)}
.tbl tbody tr:last-child td{border-bottom:none}
.badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:.6px;font-family:'Space Mono',monospace;white-space:nowrap}
.bw{background:rgba(0,214,143,.12);color:${C.win};border:1px solid rgba(0,214,143,.25)}
.bl{background:rgba(255,61,90,.12);color:${C.loss};border:1px solid rgba(255,61,90,.25)}
.bp{background:rgba(255,176,32,.1);color:${C.pend};border:1px solid rgba(255,176,32,.25)}
.b1{background:rgba(61,126,255,.12);color:${C.blue};border:1px solid rgba(61,126,255,.3)}
.bo{background:rgba(0,200,224,.1);color:${C.cyan};border:1px solid rgba(0,200,224,.25)}
.ba{background:rgba(139,92,246,.1);color:${C.purple};border:1px solid rgba(139,92,246,.25)}
.bs{background:rgba(61,79,106,.15);color:${C.sub};border:1px solid rgba(61,79,106,.3)}
.tab{padding:8px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;border:1px solid transparent;font-family:'Space Grotesk',sans-serif;letter-spacing:.2px;transition:all .15s}
.tab-on{background:rgba(61,126,255,.15);border-color:rgba(61,126,255,.35);color:${C.blue}}
.tab-off{background:transparent;color:${C.sub}}
.tab-off:hover{background:${C.card};color:${C.text};border-color:${C.border}}
.sel{background:${C.surface};border:1px solid ${C.border};color:${C.text};padding:7px 14px;border-radius:8px;font-family:'Space Mono',monospace;font-size:12px;outline:none;cursor:pointer;transition:border-color .15s}
.sel:focus{border-color:rgba(61,126,255,.55)}
.dot{width:7px;height:7px;border-radius:50%;background:${C.win};flex-shrink:0;animation:dpulse 2s ease-in-out infinite}
.dot-off{background:${C.loss};animation:none}
@keyframes dpulse{0%,100%{box-shadow:0 0 0 0 rgba(0,214,143,.5)}50%{box-shadow:0 0 0 6px rgba(0,214,143,0)}}
.log{border-radius:10px;padding:10px 12px;border:1px solid transparent;flex-shrink:0;animation:lslide .2s ease}
@keyframes lslide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.log-pred{background:rgba(61,126,255,.07);border-color:rgba(61,126,255,.2)}
.log-res{background:rgba(0,214,143,.07);border-color:rgba(0,214,143,.2)}
.log-parl{background:rgba(255,176,32,.06);border-color:rgba(255,176,32,.2)}
.log-err{background:rgba(255,61,90,.07);border-color:rgba(255,61,90,.2)}
.log-def{background:${C.card};border-color:${C.border}}
.ppick{font-family:'Space Mono',monospace;font-size:11px;padding:7px 10px;border-bottom:1px solid ${C.border}22;display:flex;align-items:flex-start;gap:8px;color:${C.text};line-height:1.5}
.ppick:last-child{border-bottom:none}
.sh{font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${C.sub};font-family:'Space Mono',monospace;display:flex;align-items:center;gap:8px}
.gnum{font-family:'Space Mono',monospace;font-size:30px;font-weight:700;letter-spacing:-1.5px;line-height:1}
@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.ticker-wrap{overflow:hidden;background:${C.surface};border-top:1px solid ${C.border};border-bottom:1px solid ${C.border};height:32px;display:flex;align-items:center;margin-bottom:24px}
.ticker-inner{display:flex;gap:40px;animation:ticker 30s linear infinite;white-space:nowrap;padding:0 20px}
.ticker-inner:hover{animation-play-state:paused}
.recharts-tooltip-wrapper{pointer-events:none!important}
`;

const CTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.cardHi, border: `1px solid ${C.borderHi}`,
      borderRadius: 10, padding: "10px 14px",
      fontFamily: "'Space Mono', monospace", fontSize: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,.6)", pointerEvents: "none",
    }}>
      <div style={{ color: C.sub, fontSize: 10, marginBottom: 6, letterSpacing: ".6px" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: C.text }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: C.sub, fontSize: 10 }}>{p.name}</span>
          <span style={{ fontWeight: 700, marginLeft: "auto", paddingLeft: 16, color: p.color }}>
            {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const ConfBar = ({ val }) => {
  const filled = Math.min(Math.round(val / 20), 5);
  const clr = val >= 80 ? C.win : val >= 60 ? C.blue : val >= 40 ? C.pend : C.loss;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{
          width: 5, height: 14, borderRadius: 3,
          background: i < filled ? clr : C.dim,
          boxShadow: i < filled ? `0 0 5px ${clr}55` : "none",
        }} />
      ))}
      <span style={{ ...mono, fontSize: 10, color: C.muted, marginLeft: 6 }}>{val}%</span>
    </div>
  );
};

const StatCard = ({ value, label, color, icon }) => (
  <div className="card stat-card card-inner">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div className="gnum" style={{ color: color || C.text }}>{value}</div>
        <div style={{ fontSize: 11, color: C.sub, marginTop: 8, fontWeight: 600, letterSpacing: ".8px", textTransform: "uppercase" }}>
          {label}
        </div>
      </div>
      <div style={{
        width: 38, height: 38, borderRadius: 10, display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 17,
        background: `${color}15`, border: `1px solid ${color}20`, flexShrink: 0,
      }}>{icon}</div>
    </div>
  </div>
);

const LogCard = ({ log }) => {
  const time = new Date(log.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const ev = {
    new_prediction: { label: "NEW PICK",    color: C.blue,   cn: "log-pred" },
    result_tracked: { label: "RESULT",       color: C.win,    cn: "log-res"  },
    parlay_ready:   { label: "PARLAY READY", color: C.pend,   cn: "log-parl" },
    error:          { label: "ERROR",         color: C.loss,   cn: "log-err"  },
  }[log.event] || { label: log.event.replace(/_/g," ").toUpperCase(), color: C.sub, cn: "log-def" };

  return (
    <div className={`log ${ev.cn}`}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: ev.color, letterSpacing: ".8px" }}>{ev.label}</span>
        <span style={{ ...mono, fontSize: 10, color: C.muted }}>{time}</span>
      </div>
      <div style={{ ...mono, fontSize: 11, lineHeight: 1.6, color: C.sub }}>
        {log.event === "new_prediction" && <>
          <span style={{ color: C.text }}>{log.data?.match}</span><br />
          <span style={{ color: ev.color }}>[{log.data?.bet_type}]</span>{" "}
          <span style={{ color: C.win, fontWeight: 700 }}>{log.data?.pick}</span>{" "}
          <span style={{ color: C.muted }}>· {log.data?.confidence}%</span>
        </>}
        {log.event === "result_tracked" && <>
          <span style={{ color: C.text }}>{log.data?.match}</span>{" "}
          <span style={{ color: C.muted }}>{log.data?.score}</span>{" → "}
          <span style={{ color: log.data?.outcome === "win" ? C.win : C.loss, fontWeight: 700 }}>
            {log.data?.outcome?.toUpperCase()}
          </span>
        </>}
        {log.event === "parlay_ready" && <>
          <span style={{ color: C.pend }}>Parlay built</span>
          <span style={{ color: C.muted }}> · {log.data?.match_count} matches</span>
        </>}
        {!["new_prediction","result_tracked","parlay_ready"].includes(log.event) &&
          JSON.stringify(log.data).slice(0, 80)
        }
      </div>
    </div>
  );
};

const ParlayPanel = ({ p }) => {
  if (!p) return (
    <div style={{ padding: "28px 0", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>🎰</div>
      <div style={{ ...mono, fontSize: 11, color: C.muted }}>Waiting for next analysis...</div>
    </div>
  );
  const secs = [
    { key: "parlay_1x2", label: "1X2",  color: C.blue,   bg: "rgba(61,126,255,.06)"  },
    { key: "parlay_ou",  label: "O/U",  color: C.cyan,   bg: "rgba(0,200,224,.06)"   },
    { key: "parlay_ah",  label: "AH",   color: C.purple, bg: "rgba(139,92,246,.06)"  },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {secs.map(({ key, label, color, bg }) => {
        const picks = p[key] || [];
        if (!picks.length) return null;
        return (
          <div key={key} style={{ background: bg, border: `1px solid ${color}22`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "8px 12px", borderBottom: `1px solid ${color}15`, display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
              <span style={{ ...mono, fontSize: 10, fontWeight: 700, color, letterSpacing: "1px" }}>{label} PARLAY</span>
              <span style={{ ...mono, fontSize: 10, color: C.muted, marginLeft: "auto" }}>{picks.length} picks</span>
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
        <div style={{ background: "rgba(255,61,90,.06)", border: "1px solid rgba(255,61,90,.2)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ ...mono, fontSize: 10, color: C.loss, fontWeight: 700, letterSpacing: ".7px", marginBottom: 6 }}>⚠ WARNING</div>
          <div style={{ ...mono, fontSize: 11, color: C.sub, lineHeight: 1.6 }}>{p.warning}</div>
        </div>
      )}
    </div>
  );
};

const Ticker = ({ preds }) => {
  const recent = preds.filter(p => p.outcome).slice(0, 12);
  if (!recent.length) return null;
  const items = [...recent, ...recent];
  return (
    <div className="ticker-wrap">
      <div className="ticker-inner">
        {items.map((p, i) => (
          <span key={i} style={{ ...mono, fontSize: 11, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ color: C.sub }}>{p.match_name}</span>
            <span style={{ color: p.outcome === "win" ? C.win : C.loss, fontWeight: 700 }}>
              {p.outcome === "win" ? "WIN" : "LOSS"}
            </span>
            <span style={{ color: C.dim }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [stats,    setStats]    = useState(null);
  const [preds,    setPreds]    = useState([]);
  const [logs,     setLogs]     = useState([]);
  const [tab,      setTab]      = useState("predictions");
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
      // ── FIX 2: tambah "parlay_ready" ke trigger load() ────────────────────
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        setLogs(prev => [msg, ...prev].slice(0, 150));
        if (["new_prediction", "result_tracked", "parlay_ready"].includes(msg.event)) load();
        if (msg.event === "parlay_ready") setParlay(msg.data);
      };
    };
    connect();
    return () => { clearTimeout(timer); ws?.close(); };
  }, []);

  useEffect(() => { loadSched(comp); }, [comp]);
  useEffect(() => { if (logsRef.current) logsRef.current.scrollTop = 0; }, [logs]);

  const o   = stats?.overall;
  const fmt = (n) => n?.toFixed(1) ?? "—";

  const resolved = preds.filter(p => p.outcome);
  const chartWR  = resolved.slice(0, 20).reverse().map((p, i, arr) => ({
    name: `#${p.id}`,
    wr: Math.round((arr.slice(0, i+1).filter(x => x.outcome === "win").length / (i+1)) * 1000) / 10,
  }));
  const btData = (stats?.by_bet_type ?? []).map(b => ({
    name: b.bet_type, "Win Rate": b.win_rate, wins: b.wins, total: b.total,
  }));
  const btColor = { "1X2": C.blue, "OU": C.cyan, "AH": C.purple };

  if (loading) return (
    <>
      <style>{G}</style>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <div style={{ ...mono, color: C.blue, fontSize: 12, letterSpacing: "4px" }}>LOADING SYSTEM</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.blue, animation: `dpulse 1.2s ${i*.15}s ease-in-out infinite` }} />
          ))}
        </div>
      </div>
    </>
  );

  return (
    <>
      <Head>
        <title>Parlay AI — WIN OR DIE 💀</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>
      <style>{G}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "linear-gradient(135deg,#1a2a5e 0%,#0e1830 100%)",
              border: `1px solid rgba(61,126,255,.3)`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
            }}>⚽</div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-1px", lineHeight: 1 }}>
                Parlay <span style={{ color: C.blue }}>AI</span>
              </h1>
              <div style={{ ...mono, fontSize: 10, color: C.muted, letterSpacing: "2px", marginTop: 4 }}>
                WIN THE PARLAY OR WE DIE 💀
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 6 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ ...mono, fontSize: 32, fontWeight: 700, color: C.win, letterSpacing: "-2px", lineHeight: 1 }}>
                {fmt(o?.win_rate ?? 0)}%
              </div>
              <div style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: "2px", marginTop: 4 }}>WIN RATE</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 24, borderLeft: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div className={`dot ${wsOk ? "" : "dot-off"}`} />
                <span style={{ ...mono, fontSize: 9, color: C.sub, letterSpacing: "1.5px" }}>{wsOk ? "LIVE" : "OFFLINE"}</span>
              </div>
              <div style={{ ...mono, fontSize: 9, color: C.muted }}>{logs.length} events</div>
            </div>
          </div>
        </div>

        {/* TICKER */}
        <div style={{ marginTop: 20, marginBottom: 0 }}>
          <Ticker preds={preds} />
        </div>

        {/* STAT CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
          <StatCard value={o?.total_predictions ?? 0} label="Total Predictions" icon="📊" color={C.blue} />
          <StatCard value={o?.wins ?? 0}              label="Total Wins"         icon="✅" color={C.win} />
          <StatCard value={o?.losses ?? 0}            label="Total Losses"       icon="❌" color={C.loss} />
          <StatCard value={o?.pending ?? 0}           label="Pending"            icon="⏳" color={C.pend} />
          <StatCard
            value={`${resolved.length > 0 ? Math.round(resolved.filter(p=>p.outcome==="win").length/resolved.length*1000)/10 : 0}%`}
            label="Resolved Rate" icon="🎯" color={C.cyan}
          />
        </div>

        {/* CHARTS */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, marginBottom: 20 }}>
          <div className="card" style={{ padding: "20px 24px" }}>
            <div className="sh" style={{ marginBottom: 18 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.blue, display: "inline-block", boxShadow: `0 0 8px ${C.blue}` }} />
              Running Win Rate
            </div>
            {chartWR.length === 0
              ? <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ ...mono, fontSize: 11, color: C.muted }}>No resolved predictions yet</span>
                </div>
              : <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={chartWR} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                    <defs>
                      <linearGradient id="wrG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={C.blue} stopOpacity={.28} />
                        <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.dim} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 9, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0,100]} tick={{ fill: C.muted, fontSize: 9, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CTip />} cursor={{ stroke: C.borderHi, strokeWidth: 1, strokeDasharray: "3 3" }} />
                    <Area type="monotone" dataKey="wr" name="Win %" stroke={C.blue} strokeWidth={2}
                      fill="url(#wrG)" dot={false}
                      activeDot={{ r: 5, fill: C.blue, stroke: C.card, strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
            }
          </div>

          <div className="card" style={{ padding: "20px 24px" }}>
            <div className="sh" style={{ marginBottom: 18 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.cyan, display: "inline-block", boxShadow: `0 0 8px ${C.cyan}` }} />
              Win Rate by Bet Type
            </div>
            {btData.length === 0
              ? <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ ...mono, fontSize: 11, color: C.muted }}>No data yet</span>
                </div>
              : <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={btData} barSize={42} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.dim} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 11, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0,100]} tick={{ fill: C.muted, fontSize: 9, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CTip />} cursor={{ fill: "rgba(255,255,255,.025)", radius: 6 }} />
                    <Bar dataKey="Win Rate" radius={[7,7,0,0]}>
                      {btData.map((entry, i) => (
                        <Cell key={i}
                          fill={btColor[entry.name] || C.blue}
                          style={{ filter: `drop-shadow(0 0 8px ${btColor[entry.name] || C.blue}44)` }}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
            }
            <div style={{ display: "flex", gap: 16, marginTop: 14, justifyContent: "center" }}>
              {Object.entries(btColor).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: v, boxShadow: `0 0 6px ${v}88` }} />
                  <span style={{ ...mono, fontSize: 10, color: C.sub }}>{k}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN 3-COL */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 300px", gap: 14 }}>

          <div style={{ gridColumn: "1 / 3" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
              <button className={`tab ${tab === "predictions" ? "tab-on" : "tab-off"}`} onClick={() => setTab("predictions")}>
                📊 Predictions
              </button>
              <button className={`tab ${tab === "schedule" ? "tab-on" : "tab-off"}`} onClick={() => setTab("schedule")}>
                📅 Schedule
              </button>
              {tab === "predictions" && (
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="badge bw">{resolved.length} resolved</span>
                  <span className="badge bp">{o?.pending ?? 0} pending</span>
                </div>
              )}
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
              {tab === "predictions" && (
                <table className="tbl">
                  <thead>
                    <tr><th>Match</th><th>Type</th><th>Pick</th><th>Conf</th><th>Parlay</th><th>Result</th><th>Score</th></tr>
                  </thead>
                  <tbody>
                    {preds.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.match_name}</div>
                          <div style={{ ...mono, fontSize: 10, color: C.muted, marginTop: 2 }}>
                            {new Date(p.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${p.bet_type==="1X2"?"b1":p.bet_type==="OU"?"bo":"ba"}`}>{p.bet_type}</span>
                        </td>
                        <td style={{ ...mono, fontSize: 12, maxWidth: 160, color: C.text }}>{p.predicted_pick}</td>
                        <td><ConfBar val={p.confidence} /></td>
                        <td>
                          {p.include_in_parlay
                            ? <span style={{ color: C.win, fontSize: 16 }}>✓</span>
                            : <span className="badge bs">SKIP</span>
                          }
                        </td>
                        <td>
                          {p.outcome
                            ? <span className={`badge ${p.outcome==="win"?"bw":"bl"}`}>{p.outcome.toUpperCase()}</span>
                            : <span className="badge bp">PENDING</span>
                          }
                        </td>
                        <td style={{ ...mono, fontSize: 12, color: C.sub }}>{p.actual_result ?? "—"}</td>
                      </tr>
                    ))}
                    {preds.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: 40, ...mono, fontSize: 11, color: C.muted }}>
                          No predictions yet — send matches via Telegram to start
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {tab === "schedule" && (
                <>
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ ...mono, fontSize: 10, color: C.muted, letterSpacing: "1px" }}>COMPETITION</span>
                    <select className="sel" value={comp} onChange={e => setComp(e.target.value)}>
                      {["PL","CL","PD","SA","BL1","FL1","ELC","PPL","DED"].map(c => <option key={c}>{c}</option>)}
                    </select>
                    <span style={{ ...mono, fontSize: 10, color: C.muted, marginLeft: "auto" }}>{schedule.length} matches</span>
                  </div>
                  <table className="tbl">
                    <thead><tr><th>Home</th><th>Away</th><th>League</th><th>Kickoff</th></tr></thead>
                    <tbody>
                      {schedule.map((m, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{m.home}</td>
                          <td style={{ fontWeight: 600 }}>{m.away}</td>
                          <td style={{ ...mono, fontSize: 10, color: C.muted }}>{m.competition}</td>
                          <td style={{ ...mono, fontSize: 11, color: C.sub }}>
                            {new Date(m.kickoff).toLocaleString("en-GB", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                          </td>
                        </tr>
                      ))}
                      {schedule.length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: "center", padding: 40, ...mono, fontSize: 11, color: C.muted }}>No upcoming matches</td></tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Live feed */}
            <div className="card" style={{ display: "flex", flexDirection: "column", height: 380 }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <div className={`dot ${wsOk ? "" : "dot-off"}`} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>Live Feed</span>
                <span style={{ ...mono, fontSize: 10, color: C.muted, marginLeft: "auto" }}>{logs.length} / 150</span>
              </div>
              <div ref={logsRef} style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                {logs.length === 0
                  ? <div style={{ textAlign: "center", padding: "32px 0", ...mono, fontSize: 11, color: C.muted }}>Waiting for AI activity...</div>
                  : logs.map((l, i) => <LogCard key={i} log={l} />)
                }
              </div>
            </div>

            {/* Parlay */}
            <div className="card" style={{ flexShrink: 0 }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>🏆</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Latest Parlay</span>
                {parlay && <span style={{ ...mono, fontSize: 9, color: C.pend, marginLeft: "auto", letterSpacing: "1px" }}>● FRESH</span>}
              </div>
              <div style={{ padding: 12 }}><ParlayPanel p={parlay} /></div>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div style={{ marginTop: 44, textAlign: "center", ...mono, fontSize: 10, color: C.muted, letterSpacing: "1px" }}>
          PARLAY AI v3 · FOR ENTERTAINMENT ONLY · BET RESPONSIBLY
        </div>
      </div>
    </>
  );
}
