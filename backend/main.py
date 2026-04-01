# ── backend/main.py ───────────────────────────────────────────────────────────
# FastAPI Backend for Parlay Prediction System
# API Football: TheSportsDB (FREE, no signup — API key = "123")
# Docs: https://www.thesportsdb.com/documentation
# Endpoint base: https://www.thesportsdb.com/api/v1/json/123/

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
    from config import SECRET_KEY
except ImportError:
    SECRET_KEY = os.getenv("SECRET_KEY", "changeme")

logger = logging.getLogger(__name__)

app = FastAPI(title="Parlay Prediction API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── TheSportsDB (FREE — tidak perlu daftar, langsung pakai) ──────────────────
# Docs: https://www.thesportsdb.com/documentation
# Free key: 123  (bisa diisi key premium kalau punya, tapi 123 sudah cukup)
TSDB_KEY  = os.getenv("THESPORTSDB_KEY", "123")
TSDB_BASE = f"https://www.thesportsdb.com/api/v1/json/{TSDB_KEY}"

# Mapping kode liga → League ID di TheSportsDB
# Cari ID di: https://www.thesportsdb.com/sport/leagues  → pilih liga → lihat URL
# Contoh: https://www.thesportsdb.com/league/4328  → ID = 4328
# Semua liga di bawah tersedia di TheSportsDB FREE tier (key = "123")
LEAGUE_CODE_TO_ID = {
    # ── Top 5 Europe ────────────────────────────────────────────────────────────
    "PL":  "4328",   # English Premier League
    "PD":  "4335",   # Spanish La Liga
    "SA":  "4332",   # Italian Serie A
    "BL1": "4331",   # German Bundesliga
    "FL1": "4334",   # French Ligue 1
    # ── European cups ───────────────────────────────────────────────────────────
    "UCL": "4480",   # UEFA Champions League
    "UEL": "4481",   # UEFA Europa League
    # ── Other Europe ────────────────────────────────────────────────────────────
    "ELC": "4329",   # English Championship (2nd div)
    "PPL": "4344",   # Primeira Liga (Portugal)
    "DED": "4337",   # Eredivisie (Netherlands)
    # ── Americas ────────────────────────────────────────────────────────────────
    "BSA": "4351",   # Brasileirão Série A
    "MLS": "4346",   # Major League Soccer (USA)
}
SUPPORTED_COMPETITIONS = list(LEAGUE_CODE_TO_ID.keys())
# Nama display untuk setiap kode (dipakai di log, API response, dsb.)
COMPETITION_NAMES = {
    "PL":  "Premier League",
    "PD":  "La Liga",
    "SA":  "Serie A",
    "BL1": "Bundesliga",
    "FL1": "Ligue 1",
    "UCL": "Champions League",
    "UEL": "Europa League",
    "ELC": "Championship",
    "PPL": "Primeira Liga",
    "DED": "Eredivisie",
    "BSA": "Brasileirão",
    "MLS": "MLS",
}

# ── Prediksi dari AI untuk tim yang TIDAK ditemukan di API ────────────────────
_unknown_team_predictions: dict[str, datetime] = {}
UNKNOWN_TEAM_TTL_HOURS = 24

# ── Team name → TheSportsDB team ID cache ─────────────────────────────────────
_team_name_to_id: dict[str, str] = {}   # "Liverpool" → "133602"
_team_id_to_name: dict[str, str] = {}   # "133602" → "Liverpool"

# ── Next match cache ───────────────────────────────────────────────────────────
_next_match_cache: dict[str, tuple[dict | None, float]] = {}
NEXT_MATCH_CACHE_TTL = 1800  # 30 menit

# ── Schedule cache (per competition) ───────────────────────────────────────────
_schedule_cache: dict[str, tuple[list, float]] = {}
SCHEDULE_CACHE_TTL = 900  # 15 menit — cukup fresh, hemat request

# ── Global rate-limit semaphore (TheSportsDB free: ~30 req/min) ────────────────
# Batasi 4 request paralel sekaligus agar tidak 429
_tsdb_semaphore = asyncio.Semaphore(4)


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
# THESPORTSDB API HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

async def fetch_tsdb(endpoint: str, params: dict = None, _retries: int = 3) -> dict:
    """
    Fetch dari TheSportsDB v1 API dengan rate-limit guard dan retry/backoff.
    - Semaphore: maks 4 request paralel
    - Retry: hingga 3x jika kena 429, dengan exponential backoff (2s, 4s, 8s)
    """
    url = f"{TSDB_BASE}/{endpoint}"
    async with _tsdb_semaphore:
        for attempt in range(_retries):
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    r = await client.get(url, params=params)
                    if r.status_code == 429:
                        wait = 2 ** (attempt + 1)  # 2, 4, 8 detik
                        logger.warning(
                            f"TheSportsDB 429 ({endpoint}), retry #{attempt+1} in {wait}s"
                        )
                        await asyncio.sleep(wait)
                        continue
                    r.raise_for_status()
                    return r.json()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429 and attempt < _retries - 1:
                    wait = 2 ** (attempt + 1)
                    logger.warning(f"TheSportsDB 429 ({endpoint}), retry #{attempt+1} in {wait}s")
                    await asyncio.sleep(wait)
                    continue
                raise
        raise httpx.HTTPStatusError(
            f"TheSportsDB 429 after {_retries} retries",
            request=None, response=None  # type: ignore[arg-type]
        )


async def get_upcoming_matches(competition_code: str = "PL", days: int = 7) -> list:
    """
    Ambil fixtures mendatang untuk satu liga.
    Endpoint: eventsnextleague.php?id=<league_id>
    Free plan: mengembalikan ~15 event berikutnya.
    Hasil di-cache 15 menit per kompetisi untuk menghindari 429.
    """
    import time
    league_id = LEAGUE_CODE_TO_ID.get(competition_code)
    if not league_id:
        logger.warning(f"Kode liga tidak dikenal: {competition_code}")
        return []

    # ── Serve from cache jika masih fresh ────────────────────────────────────
    now_ts = time.time()
    if competition_code in _schedule_cache:
        cached_list, cached_at = _schedule_cache[competition_code]
        if now_ts - cached_at < SCHEDULE_CACHE_TTL:
            logger.debug(f"schedule cache hit: {competition_code}")
            return cached_list

    try:
        data = await fetch_tsdb("eventsnextleague.php", params={"id": league_id})
        events = data.get("events") or []
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=days)
        result = []
        for e in events:
            kickoff_str = e.get("strTimestamp") or e.get("dateEvent")
            try:
                if "T" in str(kickoff_str):
                    ko = datetime.fromisoformat(kickoff_str.replace("Z", "+00:00"))
                else:
                    # hanya tanggal, pakai jam dari strTime kalau ada
                    t = e.get("strTime", "00:00:00") or "00:00:00"
                    ko = datetime.fromisoformat(f"{kickoff_str}T{t}+00:00")
                # Make ko timezone-aware if it's naive
                if ko.tzinfo is None:
                    ko = ko.replace(tzinfo=timezone.utc)
            except Exception:
                continue
            if ko > cutoff:
                continue
            result.append({
                "id":          e.get("idEvent"),
                "competition": e.get("strLeague", competition_code),
                "home":        e.get("strHomeTeam", ""),
                "away":        e.get("strAwayTeam", ""),
                "kickoff":     ko.isoformat(),
                "status":      e.get("strStatus", "NS"),
                "home_id":     e.get("idHomeTeam"),
                "away_id":     e.get("idAwayTeam"),
            })
        # ── Simpan ke cache ───────────────────────────────────────────────────
        import time as _time
        _schedule_cache[competition_code] = (result, _time.time())
        return result
    except Exception as e:
        logger.error(f"get_upcoming_matches error ({competition_code}): {e}")
        # Kalau ada cached data (even stale), kembalikan itu daripada kosong
        if competition_code in _schedule_cache:
            logger.warning(f"Returning stale cache for {competition_code} after error")
            return _schedule_cache[competition_code][0]
        return []


async def get_finished_matches(competition_code: str = "PL") -> list:
    """
    Ambil hasil pertandingan terakhir untuk satu liga.
    Endpoint: eventspastleague.php?id=<league_id>
    Free plan: ~15 event terakhir.
    """
    league_id = LEAGUE_CODE_TO_ID.get(competition_code)
    if not league_id:
        return []
    try:
        data = await fetch_tsdb("eventspastleague.php", params={"id": league_id})
        events = data.get("events") or []
        result = []
        for e in events:
            # Hanya ambil yang sudah ada skor
            home_score = e.get("intHomeScore")
            away_score = e.get("intAwayScore")
            if home_score is None or away_score is None:
                continue
            result.append({
                "id":          e.get("idEvent"),
                "competition": e.get("strLeague", competition_code),
                "home":        e.get("strHomeTeam", ""),
                "away":        e.get("strAwayTeam", ""),
                "kickoff":     e.get("dateEvent", ""),
                "score": {
                    "home": int(home_score),
                    "away": int(away_score),
                },
            })
        return result
    except Exception as e:
        logger.error(f"get_finished_matches error ({competition_code}): {e}")
        return []


async def refresh_team_cache():
    """
    Isi _team_name_to_id dari semua liga yang disupport.
    Endpoint: lookup_all_teams.php?id=<league_id>
    """
    global _team_name_to_id, _team_id_to_name
    new_name: dict[str, str] = {}
    new_id:   dict[str, str] = {}
    for comp_code, league_id in LEAGUE_CODE_TO_ID.items():
        try:
            data = await fetch_tsdb("lookup_all_teams.php", params={"id": league_id})
            for t in (data.get("teams") or []):
                tid  = str(t.get("idTeam", ""))
                name = t.get("strTeam", "")
                if not tid or not name:
                    continue
                new_name[name.lower()] = tid
                new_id[tid] = name
                # alias pendek: "strTeamShort" kalau ada
                short = t.get("strTeamShort", "")
                if short:
                    new_name[short.lower()] = tid
        except Exception as e:
            logger.warning(f"team cache skip {comp_code}: {e}")
    _team_name_to_id.update(new_name)
    _team_id_to_name.update(new_id)
    logger.info(f"✅ Team cache refreshed: {len(_team_name_to_id)} entries")


def _find_team_id(team_name: str) -> Optional[str]:
    """Cari TheSportsDB team ID dari nama tim (case-insensitive, partial match)."""
    key = team_name.lower().strip()
    if key in _team_name_to_id:
        return _team_name_to_id[key]
    for k, v in _team_name_to_id.items():
        if key in k or k in key:
            return v
    return None


async def get_next_match_for_team(team_id: str) -> Optional[dict]:
    """
    Ambil event berikutnya untuk satu tim.
    Endpoint: eventsnext.php?id=<team_id>
    Free plan: mengembalikan 1 event (home only). Premium: 10 events.
    """
    import time
    now = time.time()
    if team_id in _next_match_cache:
        cached, cached_at = _next_match_cache[team_id]
        if now - cached_at < NEXT_MATCH_CACHE_TTL:
            return cached

    try:
        data = await fetch_tsdb("eventsnext.php", params={"id": team_id})
        events = data.get("events") or []
        if not events:
            _next_match_cache[team_id] = (None, now)
            return None
        e = events[0]
        kickoff_str = e.get("strTimestamp") or e.get("dateEvent", "")
        try:
            if "T" in str(kickoff_str):
                ko = datetime.fromisoformat(kickoff_str.replace("Z", "+00:00"))
            else:
                t = e.get("strTime", "00:00:00") or "00:00:00"
                ko = datetime.fromisoformat(f"{kickoff_str}T{t}+00:00")
            # Make ko timezone-aware if it's naive
            if ko.tzinfo is None:
                ko = ko.replace(tzinfo=timezone.utc)
            kickoff_utc = ko.isoformat()
        except Exception:
            kickoff_utc = kickoff_str

        result = {
            "id":          e.get("idEvent"),
            "competition": e.get("strLeague", ""),
            "home":        e.get("strHomeTeam", ""),
            "away":        e.get("strAwayTeam", ""),
            "kickoff_utc": kickoff_utc,
            "status":      e.get("strStatus", "NS"),
        }
        _next_match_cache[team_id] = (result, now)
        return result
    except Exception as e:
        logger.warning(f"get_next_match_for_team {team_id}: {e}")
        _next_match_cache[team_id] = (None, now)
        return None


def _is_team_in_api(match_name: str) -> bool:
    if " vs " not in match_name:
        return False
    parts = match_name.split(" vs ", 1)
    return (
        _find_team_id(parts[0].strip()) is not None
        or _find_team_id(parts[1].strip()) is not None
    )


def _cleanup_unknown_predictions():
    now = datetime.now(timezone.utc)
    expired = [k for k, ts in _unknown_team_predictions.items()
               if (now - ts).total_seconds() > UNKNOWN_TEAM_TTL_HOURS * 3600]
    for k in expired:
        del _unknown_team_predictions[k]
        logger.info(f"🗑️  Removed expired: {k}")
    return expired


# ═══════════════════════════════════════════════════════════════════════════════
# AUTO RESULT TRACKER
# ═══════════════════════════════════════════════════════════════════════════════

async def auto_track_results():
    db = get_db()
    while True:
        try:
            expired = _cleanup_unknown_predictions()
            if expired:
                await broadcast_log("system", {"msg": f"Removed {len(expired)} expired predictions"})

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
                                notes="Auto-tracked via TheSportsDB"
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
            import re
            line_match = re.search(r"(\d+\.?\d*)", pick)
            line = float(line_match.group(1)) if line_match else 2.5
            return "win" if total > line else "loss"
        if "under" in pick:
            import re
            line_match = re.search(r"(\d+\.?\d*)", pick)
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
    logger.info("🚀 Backend started. TheSportsDB API aktif.")


async def _team_cache_refresh_loop():
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
    import time
    cached = _schedule_cache.get(competition)
    cache_age = round(time.time() - cached[1]) if cached else None
    matches = await get_upcoming_matches(competition)
    return {
        "matches": matches,
        "competition": competition,
        "cache_age_sec": cache_age,
        "from_cache": cached is not None and cache_age is not None and cache_age < SCHEDULE_CACHE_TTL,
    }


@app.delete("/api/cache/schedule")
async def clear_schedule_cache(competition: str = None):
    """Hapus schedule cache (semua atau per kompetisi) — untuk debugging."""
    if competition:
        removed = _schedule_cache.pop(competition, None) is not None
        return {"cleared": [competition] if removed else []}
    keys = list(_schedule_cache.keys())
    _schedule_cache.clear()
    return {"cleared": keys}


@app.get("/api/finished")
async def get_finished(competition: str = "PL"):
    matches = await get_finished_matches(competition)
    return {"matches": matches, "competition": competition}


@app.get("/api/competitions")
async def list_competitions():
    return {"competitions": SUPPORTED_COMPETITIONS}


@app.get("/api/next-match/{team_name}")
async def get_next_match(team_name: str):
    team_id = _find_team_id(team_name)
    if team_id is None:
        return {
            "team_name":  team_name,
            "not_in_api": True,
            "next_match": None,
            "msg":        f"Team '{team_name}' tidak ditemukan di TheSportsDB",
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

    kickoff_utc = datetime.fromisoformat(match["kickoff_utc"].replace("Z", "+00:00"))
    now_utc     = datetime.now(timezone.utc)
    delta       = kickoff_utc - now_utc
    seconds_left = max(int(delta.total_seconds()), 0)
    hours_left   = seconds_left // 3600
    mins_left    = (seconds_left % 3600) // 60
    kickoff_wib  = kickoff_utc + timedelta(hours=7)

    return {
        "team_name":  team_name,
        "team_id":    team_id,
        "not_in_api": False,
        "next_match": {
            **match,
            "kickoff_wib":     kickoff_wib.strftime("%Y-%m-%dT%H:%M:%S+07:00"),
            "time_left_sec":   seconds_left,
            "time_left_str":   f"{hours_left}h {mins_left}m" if hours_left > 0 else f"{mins_left}m",
            "already_started": seconds_left == 0,
        },
    }


@app.get("/api/upcoming-predictions")
async def get_upcoming_predictions():
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

    team_id_map: dict[str, str | None] = {}
    for p in pending:
        mn    = p["match_name"]
        parts = mn.split(" vs ", 1) if " vs " in mn else [mn]
        tid   = _find_team_id(parts[0].strip())
        if not tid and len(parts) > 1:
            tid = _find_team_id(parts[1].strip())
        team_id_map[mn] = tid

    unique_ids = list({v for v in team_id_map.values() if v is not None})
    id_to_match: dict[str, dict | None] = {}
    if unique_ids:
        fetched = await asyncio.gather(
            *[get_next_match_for_team(tid) for tid in unique_ids],
            return_exceptions=True
        )
        for tid, res in zip(unique_ids, fetched):
            id_to_match[tid] = res if isinstance(res, dict) else None

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
    expired = _cleanup_unknown_predictions()
    return {"removed": expired, "count": len(expired)}


# ── Push dari bot ─────────────────────────────────────────────────────────────

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
    try:
        from database import PredictionRecord
        db = get_db()
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
            logger.info(f"💾 saved #{pred_id}: {data.match}")
        else:
            logger.info(f"⏭️  skip duplicate: {data.match}")
    except Exception as e:
        logger.error(f"push-prediction DB error: {e}")

    await broadcast_log("new_prediction", data.dict())

    if not _is_team_in_api(data.match):
        if data.match not in _unknown_team_predictions:
            _unknown_team_predictions[data.match] = datetime.now(timezone.utc)
        logger.warning(f"⚠️  Unknown team (24h TTL): {data.match}")

    return {"ok": True}


class ParlayPush(BaseModel):
    parlay_1x2:  list
    parlay_ou:   list
    parlay_ah:   list
    warning:     str
    match_count: int

@app.post("/api/push-parlay")
async def push_parlay(data: ParlayPush):
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
