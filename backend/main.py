# ── backend/main.py ───────────────────────────────────────────────────────────
# FastAPI Backend for Parlay Prediction System
# TAMBAHAN: /api/push-parlay endpoint + broadcast parlay final ke WebSocket

import asyncio
import httpx
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database import get_db
from learning_engine import get_learning_engine

try:
    from config import FOOTBALL_DATA_API_KEY, SECRET_KEY
except ImportError:
    FOOTBALL_DATA_API_KEY = os.getenv("FOOTBALL_DATA_API_KEY", "")
    SECRET_KEY            = os.getenv("SECRET_KEY", "changeme")

logger = logging.getLogger(__name__)

app = FastAPI(title="Parlay Prediction API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FOOTBALL_DATA_BASE      = "https://api.football-data.org/v4"
SUPPORTED_COMPETITIONS = ["PL", "PD", "SA", "BL1", "FL1"]

# Liga yang tersedia di free tier untuk endpoint /competitions/{code}/teams
# FL1 (Ligue 1) sering tidak tersedia di free plan → gunakan list terpisah
TEAM_CACHE_COMPETITIONS = ["PL", "PD", "SA", "BL1"]

# ── Team name → ID cache (diisi saat startup dari API) ─────────────────────
_team_name_to_id: dict[str, int] = {}      # "Liverpool FC" → 64
_team_id_to_name: dict[int, str] = {}      # 64 → "Liverpool FC"

# ── Prediksi dari AI untuk tim yang TIDAK ditemukan di football-data API ──
# Format: { "Manchester City vs Bayern": datetime_added }
_unknown_team_predictions: dict[str, datetime] = {}
UNKNOWN_TEAM_TTL_HOURS = 24                # hapus setelah 24 jam


# ═══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active_connections:
            self.active_connections.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active_connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()


async def broadcast_log(event: str, data: dict):
    await manager.broadcast({"event": event, "data": data, "ts": datetime.utcnow().isoformat()})


# ═══════════════════════════════════════════════════════════════════════════════
# FOOTBALL DATA API HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

async def fetch_football_data(path: str) -> dict:
    headers = {"X-Auth-Token": FOOTBALL_DATA_API_KEY}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{FOOTBALL_DATA_BASE}{path}", headers=headers)
        r.raise_for_status()
        return r.json()


async def get_upcoming_matches(competition_code: str = "PL", days: int = 7) -> list:
    try:
        today  = datetime.utcnow().date()
        future = today + timedelta(days=days)
        # Gunakan endpoint global /matches (support dateFrom/dateTo di semua tier)
        # Endpoint /competitions/{code}/matches?dateFrom=... butuh tier berbayar
        path   = f"/matches?dateFrom={today}&dateTo={future}&competitions={competition_code}"
        data   = await fetch_football_data(path)
        matches = [m for m in data.get("matches", []) if m.get("status") in ("SCHEDULED", "TIMED")][:20]
        return [
            {
                "id":          m["id"],
                "home_id":     m["homeTeam"]["id"],
                "away_id":     m["awayTeam"]["id"],
                "competition": m["competition"]["name"],
                "home":        m["homeTeam"]["name"],
                "away":        m["awayTeam"]["name"],
                "kickoff":     m["utcDate"],
                "status":      m["status"],
            }
            for m in matches
        ]
    except Exception as e:
        logger.error(f"football-data fetch error: {e}")
        return []


async def get_finished_matches(competition_code: str = "PL") -> list:
    try:
        today = datetime.utcnow().date()
        past  = today - timedelta(days=7)
        # Gunakan endpoint global /matches (support dateFrom/dateTo di semua tier)
        data  = await fetch_football_data(
            f"/matches?dateFrom={past}&dateTo={today}&status=FINISHED&competitions={competition_code}"
        )
        matches = [m for m in data.get("matches", []) if m.get("status") == "FINISHED"][:20]
        return [
            {
                "id":          m["id"],
                "home_id":     m["homeTeam"]["id"],
                "away_id":     m["awayTeam"]["id"],
                "competition": m["competition"]["name"],
                "home":        m["homeTeam"]["name"],
                "away":        m["awayTeam"]["name"],
                "kickoff":     m["utcDate"],
                "score": {
                    "home": m["score"]["fullTime"]["home"],
                    "away": m["score"]["fullTime"]["away"],
                },
            }
            for m in matches
        ]
    except Exception as e:
        logger.error(f"football-data fetch error: {e}")
        return []


async def refresh_team_cache():
    """Ambil semua tim dari liga yang support endpoint /teams, simpan ke cache nama→ID.
    
    Catatan: Tidak semua liga tersedia di free tier untuk endpoint /competitions/{code}/teams.
    Gunakan TEAM_CACHE_COMPETITIONS (tanpa FL1) untuk menghindari error 400/403.
    """
    global _team_name_to_id, _team_id_to_name
    new_name_map: dict[str, int] = {}
    new_id_map:   dict[int, str] = {}
    for comp in TEAM_CACHE_COMPETITIONS:
        try:
            data = await fetch_football_data(f"/competitions/{comp}/teams")
            for t in data.get("teams", []):
                tid  = t["id"]
                name = t["name"]
                new_name_map[name.lower()] = tid
                new_id_map[tid] = name
                # juga simpan shortName / tla kalau ada
                if t.get("shortName"):
                    new_name_map[t["shortName"].lower()] = tid
                if t.get("tla"):
                    new_name_map[t["tla"].lower()] = tid
        except Exception as e:
            logger.warning(f"team cache refresh skip {comp}: {e} — kompetisi ini mungkin tidak tersedia di tier kamu")
    _team_name_to_id.update(new_name_map)
    _team_id_to_name.update(new_id_map)
    logger.info(f"✅ Team cache refreshed: {len(_team_name_to_id)} entries")


def _find_team_id(team_name: str) -> Optional[int]:
    """Cari team ID dari nama tim (fuzzy, case-insensitive)."""
    key = team_name.lower().strip()
    if key in _team_name_to_id:
        return _team_name_to_id[key]
    # partial match
    for k, v in _team_name_to_id.items():
        if key in k or k in key:
            return v
    return None


# ── Next match cache: team_id → match dict, TTL 30 menit ──────────────────
_next_match_cache: dict[int, tuple[dict | None, float]] = {}  # id → (match, timestamp)
NEXT_MATCH_CACHE_TTL = 1800  # 30 menit


async def get_next_match_for_team(team_id: int) -> Optional[dict]:
    """Ambil 1 pertandingan terdekat (SCHEDULED) untuk team_id tertentu.
    Hasil di-cache 30 menit supaya endpoint upcoming-predictions cepat.
    """
    import time
    now = time.time()
    if team_id in _next_match_cache:
        cached_match, cached_at = _next_match_cache[team_id]
        if now - cached_at < NEXT_MATCH_CACHE_TTL:
            return cached_match

    try:
        data = await fetch_football_data(f"/teams/{team_id}/matches?status=SCHEDULED&limit=5")
        matches = data.get("matches", [])
        if not matches:
            _next_match_cache[team_id] = (None, now)
            return None
        m = matches[0]
        result = {
            "id":          m["id"],
            "competition": m["competition"]["name"],
            "home":        m["homeTeam"]["name"],
            "away":        m["awayTeam"]["name"],
            "kickoff_utc": m["utcDate"],
            "status":      m["status"],
        }
        _next_match_cache[team_id] = (result, now)
        return result
    except Exception as e:
        logger.warning(f"get_next_match_for_team {team_id}: {e}")
        _next_match_cache[team_id] = (None, now)
        return None


def _is_team_in_api(match_name: str) -> bool:
    """Cek apakah salah satu tim dalam 'Home vs Away' ada di cache API."""
    if " vs " not in match_name:
        return False
    parts = match_name.split(" vs ", 1)
    home_found = _find_team_id(parts[0].strip()) is not None
    away_found = _find_team_id(parts[1].strip()) is not None
    return home_found or away_found


def _cleanup_unknown_predictions():
    """Hapus prediksi tim unknown yang sudah lebih dari 24 jam."""
    now = datetime.now(timezone.utc)
    expired = [k for k, ts in _unknown_team_predictions.items()
               if (now - ts).total_seconds() > UNKNOWN_TEAM_TTL_HOURS * 3600]
    for k in expired:
        del _unknown_team_predictions[k]
        logger.info(f"🗑️  Removed expired unknown-team prediction: {k}")
    return expired


# ═══════════════════════════════════════════════════════════════════════════════
# AUTO RESULT TRACKER
# ═══════════════════════════════════════════════════════════════════════════════

async def auto_track_results():
    db = get_db()
    while True:
        try:
            # ── Cleanup tim unknown yang sudah expired ──
            expired = _cleanup_unknown_predictions()
            if expired:
                await broadcast_log("system", {"msg": f"Removed {len(expired)} expired unknown-team predictions"})

            for comp in SUPPORTED_COMPETITIONS:
                finished = await get_finished_matches(comp)
                for match in finished:
                    match_str = f"{match['home']} vs {match['away']}"
                    pred = db.get_prediction_by_match(match_str)
                    if pred and not db.get_result_by_match(pred.match_name):
                        score   = match["score"]
                        h, a    = score["home"], score["away"]
                        outcome = _evaluate_prediction(pred, h, a)
                        if outcome:
                            from database import MatchResult
                            result = MatchResult(
                                prediction_id=pred.id,
                                match_name=pred.match_name,
                                actual_result=f"{h}-{a}",
                                predicted_pick=pred.predicted_pick,
                                outcome=outcome,
                                notes="Auto-tracked via football-data API"
                            )
                            db.save_result(result)
                            get_learning_engine().analyze_and_learn(pred.id, f"{h}-{a}", outcome)
                            await broadcast_log("result_tracked", {
                                "match":   pred.match_name,
                                "score":   f"{h}-{a}",
                                "outcome": outcome,
                            })
                            logger.info(f"✅ Auto-tracked: {pred.match_name} → {outcome}")
        except Exception as e:
            logger.error(f"auto_track_results error: {e}")

        await asyncio.sleep(1800)


def _evaluate_prediction(pred, home_goals: int, away_goals: int) -> Optional[str]:
    if pred is None or home_goals is None or away_goals is None:
        return None
    pick = pred.predicted_pick.lower()
    bet  = pred.bet_type

    if bet == "1X2":
        if "home win" in pick or pred.match_name.split(" vs ")[0].lower() in pick:
            return "win" if home_goals > away_goals else "loss"
        if "away win" in pick or pred.match_name.split(" vs ")[-1].lower() in pick:
            return "win" if away_goals > home_goals else "loss"
        if "draw" in pick:
            return "win" if home_goals == away_goals else "loss"
    elif bet == "OU":
        total = home_goals + away_goals
        if "over" in pick:
            line_match = __import__("re").search(r"(\d+\.?\d*)", pick)
            line = float(line_match.group(1)) if line_match else 2.5
            return "win" if total > line else "loss"
        if "under" in pick:
            line_match = __import__("re").search(r"(\d+\.?\d*)", pick)
            line = float(line_match.group(1)) if line_match else 2.5
            return "win" if total < line else "loss"
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# STARTUP
# ═══════════════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    asyncio.create_task(auto_track_results())
    asyncio.create_task(_team_cache_refresh_loop())
    logger.info("🚀 Backend started. Auto-tracker + team cache running.")


async def _team_cache_refresh_loop():
    """Refresh team cache setiap 6 jam."""
    while True:
        await refresh_team_cache()
        await asyncio.sleep(6 * 3600)


# ═══════════════════════════════════════════════════════════════════════════════
# REST ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/stats")
async def get_stats():
    db    = get_db()
    stats = db.get_overall_stats()
    bt    = db.get_bet_type_stats()
    return {"overall": stats, "by_bet_type": bt}


@app.get("/api/predictions")
async def get_predictions(limit: int = 50):
    db = get_db()
    with db._get_conn() as conn:
        rows = conn.execute("""
            SELECT p.id, p.match_name, p.bet_type, p.predicted_pick,
                   p.confidence, p.include_in_parlay, p.created_at,
                   r.outcome, r.actual_result
            FROM predictions p
            LEFT JOIN match_results r ON p.id = r.prediction_id
            ORDER BY p.created_at DESC
            LIMIT ?
        """, (limit,)).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/results")
async def get_results(limit: int = 50):
    db = get_db()
    with db._get_conn() as conn:
        rows = conn.execute("""
            SELECT r.*, p.bet_type, p.confidence
            FROM match_results r
            JOIN predictions p ON r.prediction_id = p.id
            ORDER BY r.created_at DESC
            LIMIT ?
        """, (limit,)).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/report")
async def get_report():
    report = get_learning_engine().get_performance_report()
    return {"report": report}


@app.get("/api/schedule")
async def get_schedule(competition: str = "PL"):
    matches = await get_upcoming_matches(competition)
    return {"matches": matches, "competition": competition}


@app.get("/api/finished")
async def get_finished(competition: str = "PL"):
    matches = await get_finished_matches(competition)
    return {"matches": matches, "competition": competition}


@app.get("/api/competitions")
async def list_competitions():
    return {"competitions": SUPPORTED_COMPETITIONS}


@app.get("/api/next-match/{team_name}")
async def get_next_match(team_name: str):
    """
    Cari pertandingan terdekat untuk satu tim.
    Kalau tim tidak ada di API → return not_in_api: true
    """
    team_id = _find_team_id(team_name)
    if team_id is None:
        return {
            "team_name":   team_name,
            "not_in_api":  True,
            "next_match":  None,
            "msg":         f"Team '{team_name}' tidak ditemukan di football-data API",
        }
    match = await get_next_match_for_team(team_id)
    if match is None:
        return {
            "team_name":  team_name,
            "team_id":    team_id,
            "not_in_api": False,
            "next_match": None,
            "msg":        "Tidak ada jadwal mendatang",
        }

    # Hitung time_left ke kickoff (WIB +7)
    kickoff_utc = datetime.fromisoformat(match["kickoff_utc"].replace("Z", "+00:00"))
    now_utc     = datetime.now(timezone.utc)
    delta       = kickoff_utc - now_utc
    seconds_left = max(int(delta.total_seconds()), 0)
    hours_left   = seconds_left // 3600
    mins_left    = (seconds_left % 3600) // 60

    # Konversi ke WIB
    kickoff_wib = kickoff_utc + timedelta(hours=7)

    return {
        "team_name":     team_name,
        "team_id":       team_id,
        "not_in_api":    False,
        "next_match":    {
            **match,
            "kickoff_wib":   kickoff_wib.strftime("%Y-%m-%dT%H:%M:%S+07:00"),
            "time_left_sec": seconds_left,
            "time_left_str": f"{hours_left}h {mins_left}m" if hours_left > 0 else f"{mins_left}m",
            "already_started": seconds_left == 0,
        },
    }


@app.get("/api/upcoming-predictions")
async def get_upcoming_predictions():
    """
    Ambil prediksi pending + next match info per tim.
    - Tim ada di API  → tampilkan next match + countdown WIB
    - Tim tidak ada   → api_status='unknown', auto-hapus setelah 24h
    - Team cache kosong → fallback: parse match_name langsung dari jadwal liga
    """
    db = get_db()
    with db._get_conn() as conn:
        rows = conn.execute("""
            SELECT p.id, p.match_name, p.bet_type, p.predicted_pick,
                   p.confidence, p.include_in_parlay, p.created_at,
                   r.outcome, r.actual_result
            FROM predictions p
            LEFT JOIN match_results r ON p.id = r.prediction_id
            WHERE r.outcome IS NULL
            ORDER BY p.created_at DESC
            LIMIT 30
        """).fetchall()

    pending = [dict(r) for r in rows]
    if not pending:
        return []

    # ── Kumpulkan semua team ID yang dibutuhkan dulu ─────────────────────────
    team_id_map: dict[str, int | None] = {}   # match_name → team_id (home)
    for p in pending:
        mn = p["match_name"]
        parts = mn.split(" vs ", 1) if " vs " in mn else [mn]
        tid = _find_team_id(parts[0].strip())
        if not tid and len(parts) > 1:
            tid = _find_team_id(parts[1].strip())
        team_id_map[mn] = tid

    # ── Fetch next match secara PARALEL untuk semua tim yang ditemukan ───────
    unique_ids = list({v for v in team_id_map.values() if v is not None})
    if unique_ids:
        tasks = [get_next_match_for_team(tid) for tid in unique_ids]
        fetched = await asyncio.gather(*tasks, return_exceptions=True)
        id_to_match: dict[int, dict | None] = {}
        for tid, res in zip(unique_ids, fetched):
            id_to_match[tid] = res if isinstance(res, dict) else None
    else:
        id_to_match = {}

    # ── Susun hasil ──────────────────────────────────────────────────────────
    now_utc = datetime.now(timezone.utc)
    result  = []
    for p in pending:
        mn     = p["match_name"]
        tid    = team_id_map.get(mn)
        in_api = tid is not None

        if not in_api:
            if mn not in _unknown_team_predictions:
                _unknown_team_predictions[mn] = now_utc
            ts      = _unknown_team_predictions[mn]
            age_hrs = (now_utc - ts).total_seconds() / 3600
            p["api_status"]      = "unknown"
            p["unknown_age_hrs"] = round(age_hrs, 1)
            p["will_expire_hrs"] = round(UNKNOWN_TEAM_TTL_HOURS - age_hrs, 1)
            p["next_match"]      = None
            result.append(p)
            continue

        next_m = id_to_match.get(tid)
        if next_m:
            kickoff_utc  = datetime.fromisoformat(next_m["kickoff_utc"].replace("Z", "+00:00"))
            delta        = kickoff_utc - now_utc
            seconds_left = max(int(delta.total_seconds()), 0)
            kickoff_wib  = kickoff_utc + timedelta(hours=7)
            h   = seconds_left // 3600
            min = (seconds_left % 3600) // 60
            next_m = {
                **next_m,
                "kickoff_wib":     kickoff_wib.strftime("%Y-%m-%dT%H:%M:%S+07:00"),
                "time_left_sec":   seconds_left,
                "time_left_str":   f"{h}h {min}m" if h > 0 else f"{min}m",
                "already_started": seconds_left == 0,
            }

        p["api_status"] = "found"
        p["next_match"] = next_m
        result.append(p)

    return result


@app.delete("/api/cleanup-unknown")
async def cleanup_unknown():
    """Manual trigger untuk hapus prediksi tim unknown yang expired."""
    expired = _cleanup_unknown_predictions()
    return {"removed": expired, "count": len(expired)}


# ── Push dari bot: prediksi per match ────────────────────────────────────────

class PredictionPush(BaseModel):
    match:       str
    bet_type:    str
    pick:        str
    confidence:  int
    include:     bool
    summary:     str
    agents:      list

@app.post("/api/push-prediction")
async def push_prediction(data: PredictionPush):
    """Bot memanggil endpoint ini setelah tiap match selesai dianalisa.
    
    PENTING: Endpoint ini juga menyimpan ke database agar data tidak hilang
    saat web di-refresh. (agents.py sudah save sendiri, tapi kalau bot jalan
    di mesin berbeda dari backend, DB-nya berbeda — endpoint ini adalah
    satu-satunya sumber kebenaran untuk web.)
    """
    # ── Simpan ke database supaya /api/predictions tetap ada setelah refresh ──
    try:
        from database import PredictionRecord
        db = get_db()

        # Hindari duplikat: cek apakah match ini sudah ada dalam 5 menit terakhir
        with db._get_conn() as conn:
            existing = conn.execute(
                """SELECT id FROM predictions
                   WHERE match_name = ? AND bet_type = ?
                   AND datetime(created_at) >= datetime('now', '-5 minutes')""",
                (data.match, data.bet_type),
            ).fetchone()

        if not existing:
            record = PredictionRecord(
                match_name=data.match,
                bet_type=data.bet_type,
                predicted_pick=data.pick,
                confidence=data.confidence,
                debate_summary=data.summary,
                agents_data={"agents": data.agents},
                consensus_votes="",
                include_in_parlay=data.include,
            )
            pred_id = db.save_prediction(record)
            logger.info(f"💾 push-prediction saved to DB: #{pred_id} {data.match}")
        else:
            logger.info(f"⏭️  push-prediction skip duplicate: {data.match}")
    except Exception as e:
        logger.error(f"push-prediction DB save error: {e}")

    # ── Broadcast ke semua WebSocket client ──
    await broadcast_log("new_prediction", data.dict())

    # ── Cek apakah tim ada di API, kalau tidak → track sebagai unknown ──
    if not _is_team_in_api(data.match):
        if data.match not in _unknown_team_predictions:
            _unknown_team_predictions[data.match] = datetime.now(timezone.utc)
        logger.warning(f"⚠️  Team not in API, tracked as unknown (24h TTL): {data.match}")

    return {"ok": True}


# ── Push dari bot: parlay final ───────────────────────────────────────────────

class ParlayPush(BaseModel):
    parlay_1x2:  list
    parlay_ou:   list
    parlay_ah:   list
    warning:     str
    match_count: int

@app.post("/api/push-parlay")
async def push_parlay(data: ParlayPush):
    """Bot memanggil endpoint ini setelah parlay final selesai dibangun."""
    await broadcast_log("parlay_ready", data.dict())
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET
# ═══════════════════════════════════════════════════════════════════════════════

@app.websocket("/ws/live")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


# ═══════════════════════════════════════════════════════════════════════════════
# RUN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
