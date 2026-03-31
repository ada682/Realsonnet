// frontend/pages/index.tsx
"use client";
import { useEffect, useState, useRef } from "react";
import Head from "next/head";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const WS  = process.env.NEXT_PUBLIC_WS_URL || "";

// ── types ────────────────────────────────────────────────────────────────────
interface Stats {
  overall: {
    total_predictions: number;
    results_recorded:  number;
    wins:              number;
    losses:            number;
    win_rate:          number;
    pending:           number;
  };
  by_bet_type: { bet_type: string; win_rate: number; wins: number; total: number }[];
}

interface Prediction {
  id:              number;
  match_name:      string;
  bet_type:        string;
  predicted_pick:  string;
  confidence:      number;
  include_in_parlay: number;
  created_at:      string;
  outcome:         string | null;
  actual_result:   string | null;
}

interface LogEntry {
  ts:    string;
  event: string;
  data:  Record<string, unknown>;
}

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n?.toFixed(1) ?? "—";
const color = {
  win:    "#22c55e",
  loss:   "#ef4444",
  pending:"#f59e0b",
  accent: "#6366f1",
  bg:     "#0f0f13",
  card:   "#16161e",
  border: "#1e1e2e",
  text:   "#e2e2e8",
  muted:  "#6b6b80",
};

export default function Dashboard() {
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [logs,        setLogs]        = useState<LogEntry[]>([]);
  const [tab,         setTab]         = useState<"predictions" | "schedule">("predictions");
  const [schedule,    setSchedule]    = useState<any[]>([]);
  const [competition, setCompetition] = useState("PL");
  const [loading,     setLoading]     = useState(true);
  const logsRef = useRef<HTMLDivElement>(null);

  // Fetch data
  const load = async () => {
    try {
      const [s, p] = await Promise.all([
        fetch(`${API}/api/stats`).then(r => r.json()),
        fetch(`${API}/api/predictions?limit=30`).then(r => r.json()),
      ]);
      setStats(s);
      setPredictions(p);
    } catch {}
    setLoading(false);
  };

  const loadSchedule = async (comp: string) => {
    try {
      const data = await fetch(`${API}/api/schedule?competition=${comp}`).then(r => r.json());
      setSchedule(data.matches || []);
    } catch {}
  };

  // WebSocket live log
  useEffect(() => {
    load();
    const ws = new WebSocket(WS);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data) as LogEntry;
      setLogs(prev => [msg, ...prev].slice(0, 100));
      if (msg.event === "new_prediction" || msg.event === "result_tracked") {
        load();
      }
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    loadSchedule(competition);
  }, [competition]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = 0;
  }, [logs]);

  // Win-rate chart data (last 20 predictions with results)
  const chartData = predictions
    .filter(p => p.outcome)
    .slice(0, 20)
    .reverse()
    .map((p, i) => ({
      name:    `#${p.id}`,
      correct: p.outcome === "win" ? 1 : 0,
      conf:    p.confidence,
    }));

  // Running win-rate line
  const runningWR = chartData.map((_, i) => {
    const slice = chartData.slice(0, i + 1);
    const wr    = (slice.filter(x => x.correct).length / slice.length) * 100;
    return { name: chartData[i].name, wr: Math.round(wr) };
  });

  if (loading) return (
    <div style={{ background: color.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <NeuralAnimation />
    </div>
  );

  const o = stats?.overall;

  return (
    <>
      <Head>
        <title>Parlay AI — WIN THE PARLAY OR WE DIE 💀</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${color.bg}; color: ${color.text}; font-family: 'Inter', -apple-system, sans-serif; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: ${color.bg}; }
        ::-webkit-scrollbar-thumb { background: ${color.border}; border-radius: 2px; }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes scan { 0% { top: 0 } 100% { top: 100% } }
        .live-dot { width:8px; height:8px; border-radius:50%; background:${color.win}; animation:pulse 1.5s infinite; }
        .card { background:${color.card}; border:1px solid ${color.border}; border-radius:12px; padding:20px; }
        .tab { padding:8px 18px; border-radius:8px; cursor:pointer; font-size:14px; font-weight:500; border:none; transition:all .2s; }
        .tab.active { background:${color.accent}; color:#fff; }
        .tab.inactive { background:transparent; color:${color.muted}; }
        .tab.inactive:hover { color:${color.text}; }
        .badge { display:inline-block; padding:2px 8px; border-radius:20px; font-size:11px; font-weight:600; }
        .badge-win    { background:#14532d; color:${color.win}; }
        .badge-loss   { background:#450a0a; color:${color.loss}; }
        .badge-pending{ background:#451a03; color:${color.pending}; }
        .badge-1x2    { background:#1e1b4b; color:#a78bfa; }
        .badge-ou     { background:#0c4a6e; color:#38bdf8; }
        .badge-ah     { background:#1c1917; color:#d6d3d1; }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th { text-align:left; padding:10px 12px; color:${color.muted}; font-weight:500; border-bottom:1px solid ${color.border}; font-size:12px; text-transform:uppercase; letter-spacing:.05em; }
        td { padding:10px 12px; border-bottom:1px solid ${color.border}22; vertical-align:middle; }
        tr:last-child td { border-bottom:none; }
        tr:hover td { background:${color.border}33; }
        .stat-val { font-size:28px; font-weight:700; letter-spacing:-1px; }
        .stat-lbl { font-size:12px; color:${color.muted}; margin-top:4px; text-transform:uppercase; letter-spacing:.06em; }
        .comp-select { background:${color.card}; border:1px solid ${color.border}; color:${color.text}; padding:6px 12px; border-radius:8px; font-size:13px; outline:none; }
      `}</style>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 16px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
              ⚽ Parlay AI
            </h1>
            <p style={{ color: color.muted, fontSize: 13, marginTop: 4 }}>
              Win the parlay or we die 💀
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="live-dot" />
            <span style={{ fontSize: 12, color: color.muted }}>LIVE</span>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
          {[
            { val: o?.total_predictions ?? 0,    lbl: "Total Predictions", clr: color.text },
            { val: `${fmt(o?.win_rate ?? 0)}%`,  lbl: "Win Rate",          clr: color.win  },
            { val: o?.wins ?? 0,                  lbl: "Wins",              clr: color.win  },
            { val: o?.losses ?? 0,                lbl: "Losses",            clr: color.loss },
            { val: o?.pending ?? 0,               lbl: "Pending",           clr: color.pending },
          ].map(({ val, lbl, clr }) => (
            <div key={lbl} className="card">
              <div className="stat-val" style={{ color: clr }}>{val}</div>
              <div className="stat-lbl">{lbl}</div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>

          {/* Win rate trend */}
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>📈 Win Rate Over Time</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={runningWR}>
                <CartesianGrid strokeDasharray="3 3" stroke={color.border} />
                <XAxis dataKey="name" tick={{ fill: color.muted, fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: color.muted, fontSize: 10 }} />
                <Tooltip contentStyle={{ background: color.card, border: `1px solid ${color.border}`, fontSize: 12 }} />
                <Line type="monotone" dataKey="wr" stroke={color.accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Win/loss per bet type */}
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>🎯 Win Rate by Bet Type</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats?.by_bet_type ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={color.border} />
                <XAxis dataKey="bet_type" tick={{ fill: color.muted, fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: color.muted, fontSize: 10 }} />
                <Tooltip contentStyle={{ background: color.card, border: `1px solid ${color.border}`, fontSize: 12 }} />
                <Bar dataKey="win_rate" fill={color.accent} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Main content + Live logs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14 }}>

          {/* Left panel */}
          <div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button className={`tab ${tab === "predictions" ? "active" : "inactive"}`}
                onClick={() => setTab("predictions")}>
                📊 Predictions
              </button>
              <button className={`tab ${tab === "schedule" ? "active" : "inactive"}`}
                onClick={() => setTab("schedule")}>
                📅 Schedule
              </button>
            </div>

            {tab === "predictions" && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Match</th>
                      <th>Type</th>
                      <th>Pick</th>
                      <th>Conf</th>
                      <th>Result</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500, maxWidth: 180 }}>
                          <div style={{ fontSize: 13 }}>{p.match_name}</div>
                          <div style={{ fontSize: 11, color: color.muted }}>
                            {new Date(p.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge-${p.bet_type.toLowerCase().replace("/","-")}`}>
                            {p.bet_type}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, maxWidth: 120, color: "#c4c4d4" }}>{p.predicted_pick}</td>
                        <td>
                          <ConfBar val={p.confidence} />
                        </td>
                        <td>
                          {p.outcome
                            ? <span className={`badge badge-${p.outcome}`}>{p.outcome.toUpperCase()}</span>
                            : <span className="badge badge-pending">PENDING</span>}
                        </td>
                        <td style={{ fontSize: 12, color: color.muted }}>{p.actual_result ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "schedule" && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${color.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: color.muted }}>Competition:</span>
                  <select className="comp-select" value={competition} onChange={e => setCompetition(e.target.value)}>
                    {["PL","CL","PD","SA","BL1","FL1","ELC","PPL","DED"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Match</th>
                      <th>Competition</th>
                      <th>Kickoff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((m, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>
                          {m.home} <span style={{ color: color.muted }}>vs</span> {m.away}
                        </td>
                        <td style={{ fontSize: 12, color: color.muted }}>{m.competition}</td>
                        <td style={{ fontSize: 12, color: color.muted }}>
                          {new Date(m.kickoff).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {schedule.length === 0 && (
                      <tr><td colSpan={3} style={{ color: color.muted, textAlign: "center", padding: 24 }}>
                        No upcoming matches found
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right panel — Live logs */}
          <div>
            <div className="card" style={{ height: 560, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div className="live-dot" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Live Logs</span>
              </div>
              <div
                ref={logsRef}
                style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}
              >
                {logs.length === 0 && (
                  <div style={{ color: color.muted, fontSize: 12, textAlign: "center", marginTop: 20 }}>
                    Waiting for AI activity...
                  </div>
                )}
                {logs.map((log, i) => (
                  <LogCard key={i} log={log} />
                ))}
              </div>
            </div>

            {/* Neural animation card */}
            <div className="card" style={{ marginTop: 14, height: 130, overflow: "hidden", position: "relative" }}>
              <NeuralAnimation />
              <div style={{ position: "absolute", bottom: 12, left: 12, fontSize: 11, color: color.muted }}>
                AI Learning Active
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfBar({ val }: { val: number }) {
  const filled = Math.round(val / 20);
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{
          width: 6, height: 12, borderRadius: 2,
          background: i < filled ? color.accent : color.border
        }} />
      ))}
      <span style={{ fontSize: 11, color: color.muted, marginLeft: 4 }}>{val}%</span>
    </div>
  );
}

function LogCard({ log }: { log: LogEntry }) {
  const time = new Date(log.ts).toLocaleTimeString();
  const eventColors: Record<string, string> = {
    new_prediction:  "#6366f1",
    result_tracked:  "#22c55e",
    error:           "#ef4444",
  };
  const bgColors: Record<string, string> = {
    new_prediction:  "#1e1b4b",
    result_tracked:  "#14532d",
    error:           "#450a0a",
  };
  const bg  = bgColors[log.event]  || "#1e1e2e";
  const clr = eventColors[log.event] || "#94a3b8";

  return (
    <div style={{ background: bg, border: `1px solid ${clr}33`, borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: clr, textTransform: "uppercase" }}>
          {log.event.replace(/_/g, " ")}
        </span>
        <span style={{ fontSize: 10, color: "#6b6b80" }}>{time}</span>
      </div>
      <div style={{ fontSize: 12, color: "#c4c4d4", lineHeight: 1.4 }}>
        {log.event === "new_prediction" && (
          <>{(log.data as any).match} — [{(log.data as any).bet_type}] {(log.data as any).pick}</>
        )}
        {log.event === "result_tracked" && (
          <>{(log.data as any).match} {(log.data as any).score} → {(log.data as any).outcome?.toUpperCase()}</>
        )}
        {!["new_prediction","result_tracked"].includes(log.event) && (
          <>{JSON.stringify(log.data).slice(0, 80)}</>
        )}
      </div>
    </div>
  );
}

function NeuralAnimation() {
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.35 }} viewBox="0 0 300 130">
      <defs>
        <radialGradient id="ng" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* nodes */}
      {[
        [40,65],[90,30],[90,100],[150,65],[150,20],[150,110],[210,45],[210,90],[260,65]
      ].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="5" fill="#6366f1" opacity="0.7">
          <animate attributeName="opacity" values="0.7;0.3;0.7" dur={`${1.5+i*0.3}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {/* edges */}
      {[
        [40,65,90,30],[40,65,90,100],[90,30,150,20],[90,30,150,65],[90,100,150,65],[90,100,150,110],
        [150,20,210,45],[150,65,210,45],[150,65,210,90],[150,110,210,90],[210,45,260,65],[210,90,260,65]
      ].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6366f1" strokeWidth="1" opacity="0.4">
          <animate attributeName="opacity" values="0.4;0.1;0.4" dur={`${2+i*0.2}s`} repeatCount="indefinite" />
        </line>
      ))}
    </svg>
  );
}
