# ── backend/main.py ───────────────────────────────────────────────────────────
# FastAPI Backend for Parlay Prediction System
# - REST API for predictions, stats, results
# - WebSocket for real-time live log streaming
# - Auto result tracking via football-data.org API
# - CORS enabled for Next.js frontend

import asyncio
import httpx
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── adjust sys.path so we can import from the bot directory ───────────────────
import sys, os

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
    allow_origins=["*"],   # Lock this down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FOOTBALL_DATA_BASE = "https://api.football-data.org/v4"
SUPPORTED_COMPETITIONS = ["PL", "CL", "PD", "SA", "BL1", "FL1", "ELC", "PPL", "DED", "BSA"]

# ═══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET MANAGER  (live log broadcast)
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
    """Push a live log event to all connected WebSocket clients."""
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
        data = await fetch_football_data(f"/competitions/{competition_code}/matches?status=SCHEDULED")
        matches = data.get("matches", [])[:20]
        return [
            {
                "id":          m["id"],
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
        data = await fetch_football_data(f"/competitions/{competition_code}/matches?status=FINISHED")
        matches = data.get("matches", [])[:20]
        return [
            {
                "id":          m["id"],
                "competition": m["competition"]["name"],
                "home":        m["homeTeam"]["name"],
                "away":        m["awayTeam"]["name"],
                "kickoff":     m["utcDate"],
                "score":       {
                    "home": m["score"]["fullTime"]["home"],
                    "away": m["score"]["fullTime"]["away"],
                },
            }
            for m in matches
        ]
    except Exception as e:
        logger.error(f"football-data fetch error: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════════════
# AUTO RESULT TRACKER
# ═══════════════════════════════════════════════════════════════════════════════

async def auto_track_results():
    """
    Background task: every 30 min, fetch finished matches from football-data API
    and auto-update pending predictions in DB.
    """
    db = get_db()
    while True:
        try:
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

        await asyncio.sleep(1800)  # every 30 minutes


def _evaluate_prediction(pred, home_goals: int, away_goals: int) -> Optional[str]:
    """Simple heuristic to evaluate a prediction against a final score."""
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
    logger.info("🚀 Backend started. Auto-tracker running.")


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


# Push new prediction result from bot (called internally)
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
    await broadcast_log("new_prediction", data.dict())
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET
# ═══════════════════════════════════════════════════════════════════════════════

@app.websocket("/ws/live")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()   # keep-alive ping
    except WebSocketDisconnect:
        manager.disconnect(ws)


# ═══════════════════════════════════════════════════════════════════════════════
# RUN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
