// frontend/pages/index.js  ── Parlay AI Dashboard v2
"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Head from "next/head";
import {
  LineChart, Line, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const WS  = process.env.NEXT_PUBLIC_WS_URL  || "";

// ─── design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:       "#080B10",
  surface:  "#0D1117",
  card:     "#111620",
  border:   "#1C2333",
  borderHi: "#2A3650",
  win:      "#00E5A0",
  loss:     "#FF4757",
  pending:  "#FFB830",
  accent:   "#4D8AFF",
  accentDim:"#1A2F5A",
  text:     "#E6EDF3",
  muted:    "#8B949E",
  dim:      "#3D4451",
};

// ─── global styles injected once ──────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Syne:wght@400;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    background: ${C.bg};
    color: ${C.text};
    font-family: 'Syne', sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: ${C.borderHi}; }

  /* scanline overlay for depth */
  body::after {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,.04) 2px,
      rgba(0,0,0,.04) 4px
    );
    pointer-events: none;
    z-index: 9999;
  }

  .mono { font-family: 'JetBrains Mono', monospace; }

  /* card */
  .card {
    background: ${C.card};
    border: 1px solid ${C.border};
    border-radius: 10px;
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(77,138,255,.04) 0%, transparent 60%);
    pointer-events: none;
  }

  /* stat card glow on hover */
  .stat-card:hover {
    border-color: ${C.borderHi};
    transform: translateY(-2px);
    transition: all .2s ease;
  }
  .stat-card { transition: all .2s ease; cursor: default; }

  /* tab */
  .tab-btn {
    padding: 7px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid transparent;
    font-family: 'Syne', sans-serif;
    letter-spacing: .3px;
    transition: all .15s;
  }
  .tab-btn.active {
    background: ${C.accentDim};
    border-color: ${C.accent}55;
    color: ${C.accent};
  }
  .tab-btn.inactive {
    background: transparent;
    color: ${C.muted};
  }
  .tab-btn.inactive:hover {
    background: ${C.card};
    color: ${C.text};
    border-color: ${C.border};
  }

  /* table */
  .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .data-table th {
    text-align: left;
    padding: 11px 14px;
    color: ${C.muted};
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .8px;
    text-transform: uppercase;
    border-bottom: 1px solid ${C.border};
    font-family: 'JetBrains Mono', monospace;
  }
  .data-table td {
    padding: 10px 14px;
    border-bottom: 1px solid ${C.border}44;
    vertical-align: middle;
  }
  .data-table tbody tr:hover td { background: rgba(77,138,255,.03); }
  .data-table tbody tr:last-child td { border-bottom: none; }

  /* badge */
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .5px;
    font-family: 'JetBrains Mono', monospace;
  }
  .b-win     { background: rgba(0,229,160,.12);  color: ${C.win};     border: 1px solid rgba(0,229,160,.25); }
  .b-loss    { background: rgba(255,71,87,.12);   color: ${C.loss};    border: 1px solid rgba(255,71,87,.25); }
  .b-pending { background: rgba(255,184,48,.1);   color: ${C.pending}; border: 1px solid rgba(255,184,48,.25); }
  .b-1x2     { background: rgba(77,138,255,.12);  color: ${C.accent};  border: 1px solid rgba(77,138,255,.3); }
  .b-ou      { background: rgba(0,229,160,.08);   color: #40D0E0;      border: 1px solid rgba(0,229,160,.2); }
  .b-ah      { background: rgba(255,184,48,.08);  color: ${C.pending}; border: 1px solid rgba(255,184,48,.2); }
  .b-skip    { background: rgba(139,148,158,.08); color: ${C.muted};   border: 1px solid rgba(139,148,158,.2); }

  /* pulse dot */
  .pulse-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: ${C.win};
    animation: pulse-anim 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes pulse-anim {
    0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0,229,160,.6); }
    50%      { opacity: .7; box-shadow: 0 0 0 5px rgba(0,229,160,0); }
  }

  /* log entry */
  .log-entry {
    border-radius: 7px;
    padding: 9px 11px;
    font-size: 12px;
    border: 1px solid transparent;
    animation: log-slide .25s ease;
    flex-shrink: 0;
  }
  @keyframes log-slide {
    from { opacity: 0; transform: translateX(8px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  .log-new_prediction { background: rgba(77,138,255,.08); border-color: rgba(77,138,255,.2); }
  .log-result_tracked { background: rgba(0,229,160,.07);  border-color: rgba(0,229,160,.2); }
  .log-parlay_ready   { background: rgba(255,184,48,.07); border-color: rgba(255,184,48,.2); }
  .log-error          { background: rgba(255,71,87,.07);  border-color: rgba(255,71,87,.2); }
  .log-default        { background: ${C.card};             border-color: ${C.border}; }

  /* parlay panel */
  .parlay-panel {
    border-radius: 8px;
    padding: 14px;
    background: rgba(77,138,255,.05);
    border: 1px solid rgba(77,138,255,.15);
    margin-bottom: 10px;
  }

  /* comp select */
  .comp-select {
    background: ${C.surface};
    border: 1px solid ${C.border};
    color: ${C.text};
    padding: 6px 12px;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    outline: none;
    cursor: pointer;
  }
  .comp-select:focus { border-color: ${C.accent}55; }

  /* tooltip override */
  .recharts-tooltip-wrapper .recharts-default-tooltip {
    background: ${C.card} !important;
    border: 1px solid ${C.borderHi} !important;
    border-radius: 7px !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 12px !important;
  }

  /* header glow line */
  .header-line {
    height: 1px;
    background: linear-gradient(90deg, transparent, ${C.accent}44, transparent);
    margin-bottom: 28px;
  }
`;

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.borderHi}`, borderRadius: 7, padding: "8px 12px" }}>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </div>
      ))}
    </div>
  );
};

// ─── Confidence bar ───────────────────────────────────────────────────────────
const ConfBar = ({ val }) => {
  const filled = Math.min(Math.round(val / 20), 5);
  const color  = val >= 80 ? C.win : val >= 60 ? C.accent : val >= 40 ? C.pending : C.loss;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{
          width: 5, height: 14, borderRadius: 2,
          background: i < filled ? color : C.dim,
          transition: "background .3s",
        }} />
      ))}
      <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: C.muted, marginLeft: 5 }}>{val}%</span>
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ value, label, color, icon, sub }) => (
  <div className="card stat-card" style={{ padding: "18px 20px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{
          fontSize: 30, fontWeight: 800, color: color || C.text,
          lineHeight: 1, letterSpacing: "-1px",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {value}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontWeight: 600, letterSpacing: ".8px", textTransform: "uppercase" }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 20, opacity: .5 }}>{icon}</div>
    </div>
  </div>
);

// ─── Log Card ─────────────────────────────────────────────────────────────────
const LogCard = ({ log }) => {
  const time = new Date(log.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const eventLabel = {
    new_prediction: "NEW PICK",
    result_tracked: "RESULT IN",
    parlay_ready:   "PARLAY READY",
    error:          "ERROR",
  }[log.event] || log.event.replace(/_/g, " ").toUpperCase();

  const eventColor = {
    new_prediction: C.accent,
    result_tracked: C.win,
    parlay_ready:   C.pending,
    error:          C.loss,
  }[log.event] || C.muted;

  const cn = `log-entry log-${log.event in {new_prediction:1,result_tracked:1,parlay_ready:1,error:1} ? log.event : "default"}`;

  return (
    <div className={cn}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 700, color: eventColor, letterSpacing: ".8px" }}>
          {eventLabel}
        </span>
        <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: C.dim }}>{time}</span>
      </div>
      <div style={{ color: "#C9D1D9", fontFamily: "JetBrains Mono", lineHeight: 1.5 }}>
        {log.event === "new_prediction" && (
          <>
            <span style={{ color: C.text }}>{log.data?.match}</span>
            <br />
            <span style={{ color: C.accent }}>[{log.data?.bet_type}]</span>{" "}
            <span style={{ color: C.win, fontWeight: 600 }}>{log.data?.pick}</span>{" "}
            <span style={{ color: C.muted }}>• {log.data?.confidence}% conf</span>
          </>
        )}
        {log.event === "result_tracked" && (
          <>
            <span style={{ color: C.text }}>{log.data?.match}</span>{" "}
            <span style={{ fontFamily: "JetBrains Mono", color: C.muted }}>{log.data?.score}</span>{" → "}
            <span style={{ color: log.data?.outcome === "win" ? C.win : C.loss, fontWeight: 700 }}>
              {log.data?.outcome?.toUpperCase()}
            </span>
          </>
        )}
        {log.event === "parlay_ready" && (
          <>
            <span style={{ color: C.pending }}>🏆 Final parlay built</span>
            <span style={{ color: C.muted }}> • {log.data?.match_count} matches</span>
          </>
        )}
        {!["new_prediction","result_tracked","parlay_ready"].includes(log.event) && (
          <span style={{ color: C.muted }}>{JSON.stringify(log.data).slice(0, 90)}</span>
        )}
      </div>
    </div>
  );
};

// ─── Parlay Panel ─────────────────────────────────────────────────────────────
const ParlayPanel = ({ latestParlay }) => {
  if (!latestParlay) return (
    <div style={{ padding: "20px 0", textAlign: "center", color: C.muted, fontFamily: "JetBrains Mono", fontSize: 12 }}>
      Waiting for next parlay analysis...
    </div>
  );

  const sections = [
    { key: "parlay_1x2", label: "1X2", icon: "🏆", color: C.accent },
    { key: "parlay_ou",  label: "O/U", icon: "⚽", color: "#40D0E0" },
    { key: "parlay_ah",  label: "AH",  icon: "⚖️", color: C.pending },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sections.map(({ key, label, icon, color }) => {
        const picks = latestParlay[key] || [];
        if (!picks.length) return null;
        return (
          <div key={key} className="parlay-panel" style={{ background: `${color}08`, borderColor: `${color}22` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <span style={{ fontSize: 15 }}>{icon}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color, letterSpacing: ".5px" }}>{label} PARLAY</span>
            </div>
            {picks.map((p, i) => (
              <div key={i} style={{
                fontFamily: "JetBrains Mono", fontSize: 12, color: C.text,
                padding: "5px 0", borderBottom: i < picks.length - 1 ? `1px solid ${C.border}33` : "none",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ color, fontSize: 10 }}>▸</span>
                {p}
              </div>
            ))}
          </div>
        );
      })}
      {latestParlay.warning && (
        <div style={{
          background: "rgba(255,71,87,.06)", border: "1px solid rgba(255,71,87,.2)",
          borderRadius: 7, padding: "10px 12px",
        }}>
          <div style={{ fontSize: 11, color: C.loss, fontWeight: 700, letterSpacing: ".6px", marginBottom: 5 }}>
            ⚠ CONTRARIAN WARNING
          </div>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            {latestParlay.warning}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const [stats,        setStats]        = useState(null);
  const [predictions,  setPredictions]  = useState([]);
  const [logs,         setLogs]         = useState([]);
  const [tab,          setTab]          = useState("predictions");
  const [schedule,     setSchedule]     = useState([]);
  const [competition,  setCompetition]  = useState("PL");
  const [loading,      setLoading]      = useState(true);
  const [wsConnected,  setWsConnected]  = useState(false);
  const [latestParlay, setLatestParlay] = useState(null);
  const logsRef = useRef(null);

  // ── data fetching ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        fetch(`${API}/api/stats`).then(r => r.json()),
        fetch(`${API}/api/predictions?limit=30`).then(r => r.json()),
      ]);
      setStats(s);
      setPredictions(p);
    } catch (err) {
      console.error("Load error:", err);
    }
    setLoading(false);
  }, []);

  const loadSchedule = useCallback(async (comp) => {
    try {
      const data = await fetch(`${API}/api/schedule?competition=${comp}`).then(r => r.json());
      setSchedule(data.matches || []);
    } catch (err) {
      console.error("Schedule error:", err);
    }
  }, []);

  // ── WebSocket ────────────────────────────────────────────────────────────
  useEffect(() => {
    load();

    let ws;
    let reconnectTimer;

    const connect = () => {
      ws = new WebSocket(WS);

      ws.onopen  = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 3000);  // auto-reconnect
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        setLogs(prev => [msg, ...prev].slice(0, 120));

        if (msg.event === "new_prediction" || msg.event === "result_tracked") {
          load();
        }
        if (msg.event === "parlay_ready") {
          setLatestParlay(msg.data);
        }
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  useEffect(() => { loadSchedule(competition); }, [competition]);
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = 0;
  }, [logs]);

  // ── chart data ────────────────────────────────────────────────────────────
  const resolved = predictions.filter(p => p.outcome);
  const chartData = resolved.slice(0, 20).reverse().map((p, i) => ({
    name: `#${p.id}`,
    correct: p.outcome === "win" ? 1 : 0,
    conf: p.confidence,
  }));

  const runningWR = chartData.map((_, i) => {
    const slice = chartData.slice(0, i + 1);
    const wr    = (slice.filter(x => x.correct).length / slice.length) * 100;
    return { name: chartData[i].name, wr: Math.round(wr * 10) / 10 };
  });

  const o = stats?.overall;
  const fmt = (n) => n?.toFixed(1) ?? "—";

  // ── loading state ─────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: "JetBrains Mono", color: C.accent, fontSize: 13, letterSpacing: "3px" }}>INITIALIZING</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: "50%", background: C.accent,
              animation: `pulse-anim 1.2s ease-in-out ${i * .2}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </>
  );

  // ─── render ──────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Parlay AI — WIN OR DIE 💀</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <style>{GLOBAL_CSS}</style>

      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "24px 18px" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>⚽</span>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-1px", color: C.text }}>
                PARLAY AI
              </h1>
              <span style={{
                fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 700,
                color: C.accent, letterSpacing: "2px",
                background: C.accentDim, padding: "2px 8px", borderRadius: 4,
                border: `1px solid ${C.accent}33`,
              }}>
                v6
              </span>
            </div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.muted, marginTop: 3, letterSpacing: ".5px" }}>
              WIN THE PARLAY OR WE DIE 💀
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* win rate ring */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 700, color: C.win, letterSpacing: "-1px" }}>
                {fmt(o?.win_rate ?? 0)}%
              </div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: C.muted, letterSpacing: ".8px" }}>WIN RATE</div>
            </div>

            {/* WS status */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: wsConnected ? C.win : C.loss,
                boxShadow: wsConnected ? `0 0 8px ${C.win}88` : "none",
                animation: wsConnected ? "pulse-anim 1.8s infinite" : "none",
              }} />
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: C.muted, letterSpacing: "1px" }}>
                {wsConnected ? "LIVE" : "RECONNECTING"}
              </span>
            </div>
          </div>
        </div>

        <div className="header-line" />

        {/* ── Stat row ────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
          <StatCard value={o?.total_predictions ?? 0} label="Total"    icon="📊" color={C.text} />
          <StatCard value={o?.wins ?? 0}               label="Wins"     icon="✅" color={C.win} />
          <StatCard value={o?.losses ?? 0}             label="Losses"   icon="❌" color={C.loss} />
          <StatCard value={o?.pending ?? 0}            label="Pending"  icon="⏳" color={C.pending} />
          <StatCard value={`${fmt(o?.win_rate ?? 0)}%`} label="Win Rate" icon="🎯" color={C.win} />
        </div>

        {/* ── Charts row ──────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
          {/* Win rate over time */}
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 14, fontFamily: "JetBrains Mono" }}>
              📈 Running Win Rate
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={runningWR}>
                <defs>
                  <linearGradient id="wrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.accent} stopOpacity={.25} />
                    <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 9, fontFamily: "JetBrains Mono" }} />
                <YAxis domain={[0, 100]} tick={{ fill: C.dim, fontSize: 9, fontFamily: "JetBrains Mono" }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="wr" stroke={C.accent} strokeWidth={2}
                  fill="url(#wrGrad)" dot={false} activeDot={{ r: 4, fill: C.accent }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Win rate by bet type */}
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 14, fontFamily: "JetBrains Mono" }}>
              🎯 Win Rate by Bet Type
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={stats?.by_bet_type ?? []} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="bet_type" tick={{ fill: C.dim, fontSize: 11, fontFamily: "JetBrains Mono" }} />
                <YAxis domain={[0, 100]} tick={{ fill: C.dim, fontSize: 9, fontFamily: "JetBrains Mono" }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="win_rate" fill={C.accent} radius={[5,5,0,0]}
                  label={{ position: "top", fontSize: 10, fill: C.muted, fontFamily: "JetBrains Mono" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Main 3-col layout ───────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 320px", gap: 12 }}>

          {/* LEFT: Predictions / Schedule */}
          <div style={{ gridColumn: "1 / 3" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button className={`tab-btn ${tab === "predictions" ? "active" : "inactive"}`} onClick={() => setTab("predictions")}>
                📊 Predictions
              </button>
              <button className={`tab-btn ${tab === "schedule" ? "active" : "inactive"}`} onClick={() => setTab("schedule")}>
                📅 Schedule
              </button>
            </div>

            {/* Predictions table */}
            {tab === "predictions" && (
              <div className="card" style={{ overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Match</th>
                      <th>Type</th>
                      <th>Pick</th>
                      <th>Conf</th>
                      <th>Parlay</th>
                      <th>Result</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.match_name}</div>
                          <div style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: C.muted, marginTop: 2 }}>
                            {new Date(p.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                          </div>
                        </td>
                        <td>
                          <span className={`badge b-${p.bet_type.toLowerCase()}`}>{p.bet_type}</span>
                        </td>
                        <td style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: C.text, maxWidth: 160 }}>
                          {p.predicted_pick}
                        </td>
                        <td><ConfBar val={p.confidence} /></td>
                        <td>
                          {p.include_in_parlay
                            ? <span style={{ fontSize: 13 }}>✅</span>
                            : <span className="badge b-skip">SKIP</span>
                          }
                        </td>
                        <td>
                          {p.outcome
                            ? <span className={`badge b-${p.outcome}`}>{p.outcome.toUpperCase()}</span>
                            : <span className="badge b-pending">PENDING</span>
                          }
                        </td>
                        <td style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: C.muted }}>
                          {p.actual_result ?? "—"}
                        </td>
                      </tr>
                    ))}
                    {predictions.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: 32, color: C.muted, fontFamily: "JetBrains Mono", fontSize: 12 }}>
                          No predictions yet. Send matches via Telegram to start.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Schedule */}
            {tab === "schedule" && (
              <div className="card" style={{ overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.muted }}>COMPETITION</span>
                  <select className="comp-select" value={competition} onChange={e => setCompetition(e.target.value)}>
                    {["PL","CL","PD","SA","BL1","FL1","ELC","PPL","DED"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <table className="data-table">
                  <thead>
                    <tr><th>Home</th><th>Away</th><th>Competition</th><th>Kickoff</th></tr>
                  </thead>
                  <tbody>
                    {schedule.map((m, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{m.home}</td>
                        <td style={{ fontWeight: 600 }}>{m.away}</td>
                        <td style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.muted }}>{m.competition}</td>
                        <td style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.muted }}>
                          {new Date(m.kickoff).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                    {schedule.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: 32, color: C.muted, fontFamily: "JetBrains Mono", fontSize: 12 }}>
                          No upcoming matches
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT: Live logs + Parlay */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Live log feed */}
            <div className="card" style={{ display: "flex", flexDirection: "column", height: 360 }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div className="pulse-dot" style={{ background: wsConnected ? C.win : C.dim }} />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".5px" }}>Live Feed</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: C.muted, marginLeft: "auto" }}>
                  {logs.length} events
                </span>
              </div>
              <div ref={logsRef} style={{
                flex: 1, overflowY: "auto", padding: "10px",
                display: "flex", flexDirection: "column", gap: 7,
              }}>
                {logs.length === 0 && (
                  <div style={{ textAlign: "center", padding: "30px 0", color: C.muted, fontFamily: "JetBrains Mono", fontSize: 11 }}>
                    Waiting for AI activity...
                  </div>
                )}
                {logs.map((log, i) => <LogCard key={i} log={log} />)}
              </div>
            </div>

            {/* Latest parlay */}
            <div className="card" style={{ flexShrink: 0 }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>🏆</span>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".5px" }}>Latest Parlay</span>
              </div>
              <div style={{ padding: "12px" }}>
                <ParlayPanel latestParlay={latestParlay} />
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 24, textAlign: "center", fontFamily: "JetBrains Mono", fontSize: 10, color: C.dim, letterSpacing: ".5px" }}>
          PARLAY AI • FOR ENTERTAINMENT ONLY • BET RESPONSIBLY
        </div>

      </div>
    </>
  );
}
