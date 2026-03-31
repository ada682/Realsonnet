// frontend/pages/index.js
"use client";
import { useEffect, useState, useRef } from "react";
import Head from "next/head";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const WS = process.env.NEXT_PUBLIC_WS_URL || "";

// warna
const color = {
  win: "#22c55e",
  loss: "#ef4444",
  pending: "#f59e0b",
  accent: "#6366f1",
  bg: "#0f0f13",
  card: "#16161e",
  border: "#1e1e2e",
  text: "#e2e2e8",
  muted: "#6b6b80",
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState("predictions");
  const [schedule, setSchedule] = useState([]);
  const [competition, setCompetition] = useState("PL");
  const [loading, setLoading] = useState(true);
  const logsRef = useRef(null);

  const load = async () => {
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
  };

  const loadSchedule = async (comp) => {
    try {
      const data = await fetch(`${API}/api/schedule?competition=${comp}`).then(r => r.json());
      setSchedule(data.matches || []);
    } catch (err) {
      console.error("Schedule error:", err);
    }
  };

  useEffect(() => {
    load();
    const ws = new WebSocket(WS);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
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

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = 0;
  }, [logs]);

  const fmt = (n) => n?.toFixed(1) ?? "—";
  const o = stats?.overall;

  if (loading) return (
    <div style={{ background: color.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div>Loading...</div>
    </div>
  );

  // Chart data
  const chartData = predictions
    .filter(p => p.outcome)
    .slice(0, 20)
    .reverse()
    .map((p, i) => ({
      name: `#${p.id}`,
      correct: p.outcome === "win" ? 1 : 0,
      conf: p.confidence,
    }));

  const runningWR = chartData.map((_, i) => {
    const slice = chartData.slice(0, i + 1);
    const wr = (slice.filter(x => x.correct).length / slice.length) * 100;
    return { name: chartData[i].name, wr: Math.round(wr) };
  });

  return (
    <>
      <Head>
        <title>Parlay AI — WIN THE PARLAY OR WE DIE 💀</title>
      </Head>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${color.bg}; color: ${color.text}; font-family: 'Inter', -apple-system, sans-serif; }
        .live-dot { width:8px; height:8px; border-radius:50%; background:${color.win}; animation:pulse 1.5s infinite; }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        .card { background:${color.card}; border:1px solid ${color.border}; border-radius:12px; padding:20px; }
        .tab { padding:8px 18px; border-radius:8px; cursor:pointer; font-size:14px; font-weight:500; border:none; transition:all .2s; }
        .tab.active { background:${color.accent}; color:#fff; }
        .tab.inactive { background:transparent; color:${color.muted}; }
        .badge { display:inline-block; padding:2px 8px; border-radius:20px; font-size:11px; font-weight:600; }
        .badge-win    { background:#14532d; color:${color.win}; }
        .badge-loss   { background:#450a0a; color:${color.loss}; }
        .badge-pending{ background:#451a03; color:${color.pending}; }
        .badge-1x2    { background:#1e1b4b; color:#a78bfa; }
        .badge-ou     { background:#0c4a6e; color:#38bdf8; }
        .badge-ah     { background:#1c1917; color:#d6d3d1; }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th { text-align:left; padding:10px 12px; color:${color.muted}; border-bottom:1px solid ${color.border}; }
        td { padding:10px 12px; border-bottom:1px solid ${color.border}22; }
        .stat-val { font-size:28px; font-weight:700; }
        .stat-lbl { font-size:12px; color:${color.muted}; margin-top:4px; text-transform:uppercase; }
        .comp-select { background:${color.card}; border:1px solid ${color.border}; color:${color.text}; padding:6px 12px; border-radius:8px; }
      `}</style>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>⚽ Parlay AI</h1>
            <p style={{ color: color.muted, fontSize: 13, marginTop: 4 }}>Win the parlay or we die 💀</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="live-dot" />
            <span style={{ fontSize: 12, color: color.muted }}>LIVE</span>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
          {[
            { val: o?.total_predictions ?? 0, lbl: "Total Predictions", clr: color.text },
            { val: `${fmt(o?.win_rate ?? 0)}%`, lbl: "Win Rate", clr: color.win },
            { val: o?.wins ?? 0, lbl: "Wins", clr: color.win },
            { val: o?.losses ?? 0, lbl: "Losses", clr: color.loss },
            { val: o?.pending ?? 0, lbl: "Pending", clr: color.pending },
          ].map(({ val, lbl, clr }) => (
            <div key={lbl} className="card">
              <div className="stat-val" style={{ color: clr }}>{val}</div>
              <div className="stat-lbl">{lbl}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>📈 Win Rate Over Time</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={runningWR}>
                <CartesianGrid strokeDasharray="3 3" stroke={color.border} />
                <XAxis dataKey="name" tick={{ fill: color.muted, fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: color.muted, fontSize: 10 }} />
                <Tooltip contentStyle={{ background: color.card, border: `1px solid ${color.border}` }} />
                <Line type="monotone" dataKey="wr" stroke={color.accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>🎯 Win Rate by Bet Type</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats?.by_bet_type ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={color.border} />
                <XAxis dataKey="bet_type" tick={{ fill: color.muted, fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: color.muted, fontSize: 10 }} />
                <Tooltip contentStyle={{ background: color.card, border: `1px solid ${color.border}` }} />
                <Bar dataKey="win_rate" fill={color.accent} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14 }}>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button className={`tab ${tab === "predictions" ? "active" : "inactive"}`} onClick={() => setTab("predictions")}>
                📊 Predictions
              </button>
              <button className={`tab ${tab === "schedule" ? "active" : "inactive"}`} onClick={() => setTab("schedule")}>
                📅 Schedule
              </button>
            </div>

            {tab === "predictions" && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%" }}>
                  <thead>
                    <tr><th>Match</th><th>Type</th><th>Pick</th><th>Conf</th><th>Result</th><th>Score</th></tr>
                  </thead>
                  <tbody>
                    {predictions.map(p => (
                      <tr key={p.id}>
                        <td><div style={{ fontSize: 13 }}>{p.match_name}</div><div style={{ fontSize: 11, color: color.muted }}>{new Date(p.created_at).toLocaleDateString()}</div></td>
                        <td><span className={`badge badge-${p.bet_type.toLowerCase()}`}>{p.bet_type}</span></td>
                        <td style={{ fontSize: 12, color: "#c4c4d4" }}>{p.predicted_pick}</td>
                        <td><ConfBar val={p.confidence} /></td>
                        <td>{p.outcome ? <span className={`badge badge-${p.outcome}`}>{p.outcome.toUpperCase()}</span> : <span className="badge badge-pending">PENDING</span>}</td>
                        <td style={{ fontSize: 12, color: color.muted }}>{p.actual_result ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "schedule" && (
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${color.border}` }}>
                  <select className="comp-select" value={competition} onChange={e => setCompetition(e.target.value)}>
                    {["PL","CL","PD","SA","BL1","FL1","ELC","PPL","DED"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <table style={{ width: "100%" }}>
                  <thead><tr><th>Match</th><th>Competition</th><th>Kickoff</th></tr></thead>
                  <tbody>
                    {schedule.map((m, i) => (
                      <tr key={i}><td>{m.home} <span style={{ color: color.muted }}>vs</span> {m.away}</td><td style={{ fontSize: 12, color: color.muted }}>{m.competition}</td><td style={{ fontSize: 12, color: color.muted }}>{new Date(m.kickoff).toLocaleString()}</td></tr>
                    ))}
                    {schedule.length === 0 && <tr><td colSpan="3" style={{ textAlign: "center", padding: 24, color: color.muted }}>No upcoming matches</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Logs */}
          <div>
            <div className="card" style={{ height: 560, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div className="live-dot" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Live Logs</span>
              </div>
              <div ref={logsRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {logs.length === 0 && <div style={{ color: color.muted, fontSize: 12, textAlign: "center" }}>Waiting for AI activity...</div>}
                {logs.map((log, i) => <LogCard key={i} log={log} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ConfBar({ val }) {
  const filled = Math.round(val / 20);
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[0,1,2,3,4].map(i => <div key={i} style={{ width: 6, height: 12, borderRadius: 2, background: i < filled ? color.accent : color.border }} />)}
      <span style={{ fontSize: 11, color: color.muted, marginLeft: 4 }}>{val}%</span>
    </div>
  );
}

function LogCard({ log }) {
  const time = new Date(log.ts).toLocaleTimeString();
  const eventColors = { new_prediction: "#6366f1", result_tracked: "#22c55e", error: "#ef4444" };
  const bgColors = { new_prediction: "#1e1b4b", result_tracked: "#14532d", error: "#450a0a" };
  const bg = bgColors[log.event] || "#1e1e2e";
  const clr = eventColors[log.event] || "#94a3b8";
  return (
    <div style={{ background: bg, border: `1px solid ${clr}33`, borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: clr, textTransform: "uppercase" }}>{log.event.replace(/_/g, " ")}</span>
        <span style={{ fontSize: 10, color: "#6b6b80" }}>{time}</span>
      </div>
      <div style={{ fontSize: 12, color: "#c4c4d4" }}>
        {log.event === "new_prediction" && <>{log.data?.match} — [{log.data?.bet_type}] {log.data?.pick}</>}
        {log.event === "result_tracked" && <>{log.data?.match} {log.data?.score} → {log.data?.outcome?.toUpperCase()}</>}
        {!["new_prediction","result_tracked"].includes(log.event) && <>{JSON.stringify(log.data).slice(0, 80)}</>}
      </div>
    </div>
  );
}
