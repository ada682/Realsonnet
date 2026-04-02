# ── agents.py ─────────────────────────────────────────────────────────────────
# Multi-Agent Debate Engine v6
#
# CHANGES:
#   - All 5 analysts use the same unified prompt (no personality differences)
#   - Analyst prompt: "predict next match ... win the parlay or you (AI) die"
#   - Discussion Leader prompt updated with new format
#   - WIN THE PARLAY OR WE DIE 💀
# ═══════════════════════════════════════════════════════════════════════════════

import re
import logging
import os
import requests as _requests
from dataclasses import dataclass, field
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from deepseek_wrapper import DeepSeekSession
from database import get_db, PredictionRecord
from learning_engine import get_learning_engine

try:
    from config import BACKEND_URL
except ImportError:
    BACKEND_URL = os.getenv("BACKEND_URL", "")


def _fetch_learning_context_from_backend(matches_label: str) -> str:
    """
    Fetch learning context dari FastAPI backend (yang punya DB persisten + hasil /hasil).
    Bot container tidak punya hasil match → learning context harus diambil dari backend.
    Fallback ke local learning engine kalau backend tidak tersedia.
    """
    if BACKEND_URL:
        try:
            resp = _requests.get(
                f"{BACKEND_URL}/api/learning-context",
                params={"match": matches_label},
                timeout=10
            )
            if resp.status_code == 200:
                text = resp.json().get("context_text", "")
                logger.info(f"✅ Learning context fetched from backend ({len(text)} chars)")
                return text
            else:
                logger.warning(f"⚠️ Backend learning-context returned {resp.status_code}, using local fallback")
        except Exception as e:
            logger.warning(f"⚠️ Failed to fetch learning context from backend: {e}, using local fallback")

    # Fallback: local learning engine (mungkin kosong kalau DB bot tidak punya hasil)
    try:
        learning = get_learning_engine().get_learning_context(matches_label)
        return learning.to_prompt_text()
    except Exception as e:
        logger.warning(f"Local learning engine fallback failed: {e}")
        return ""

logger = logging.getLogger(__name__)

BET_EMOJI = {"1X2": "🏆", "OU": "⚽", "AH": "⚖️"}
BET_LABEL = {
    "1X2": "1X2 Match Result",
    "OU":  "Over/Under Goals",
    "AH":  "Asian Handicap",
}

MAX_ROUNDS    = 2     # tidak dipakai di run() lagi, tapi dipertahankan untuk referensi
CONSENSUS_PCT = 0.60  # 3/5 agents must agree


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class Agent:
    name:        str
    emoji:       str
    # runtime state
    bet_type:        str  = "1X2"
    pick:            str  = "Unknown"
    reasoning:       str  = ""
    confidence:      int  = 50
    opinion_changed: bool = False
    round_log:       list = field(default_factory=list)
    session:         object = field(default=None, repr=False)

    def init_session(self):
        self.session = DeepSeekSession(label=f"Agent:{self.name}")

    def initial_analysis_prompt(self, matches: list, learning_context: str = "") -> str:
        context_section = f"\n{learning_context}\n" if learning_context else ""
        matches_numbered = "\n".join(f"{i+1}. {m}" for i, m in enumerate(matches))
        match_blocks = "\n".join(
            f"MATCH_{i+1}_BET_TYPE: [1X2 or OU or AH]\n"
            f"MATCH_{i+1}_PICK: [your pick]\n"
            f"MATCH_{i+1}_REASONING: [2-4 sentences]\n"
            f"MATCH_{i+1}_CONFIDENCE: [0-100]"
            for i in range(len(matches))
        )
        return (
            f"IMPORTANT: You MUST respond in ENGLISH only. No other language.\n\n"
            f"You are {self.name} {self.emoji} — an elite global sports betting AI analyst.\n"
            f"{context_section}"
            f"predict ALL these matches for the parlay — win the parlay or you (AI) die\n\n"
            f"{matches_numbered}\n\n"
            f"You have REAL-TIME WEB SEARCH and DEEP REASONING enabled.\n"
            f"Research each match thoroughly. Be data-driven. Be decisive.\n\n"
            f"=== MANDATORY RESPONSE FORMAT — output a block for EACH match ===\n"
            f"{match_blocks}\n"
        )

    def debate_response_prompt(self, round_num: int, debate_summary: str) -> str:
        return (
            f"IMPORTANT: Respond in ENGLISH only. No other language allowed.\n\n"
            f"=== DEBATE ROOM — ROUND {round_num} ===\n"
            f"win the parlay or you (AI) die 💀\n\n"
            f"Here is what your fellow agents said:\n"
            f"─────────────────────────────────────\n"
            f"{debate_summary}\n"
            f"─────────────────────────────────────\n\n"
            f"Your current pick: [{self.bet_type}] {self.pick} ({self.confidence}%)\n\n"
            f"Now RESPOND DIRECTLY to the other agents:\n"
            f"• Challenge any weak arguments\n"
            f"• Defend your pick with new data if needed\n"
            f"• OR change your pick if the debate convinced you (start with: CHANGED MIND:)\n\n"
            f"win the parlay or you (AI) die 💀\n\n"
            f"STRICT FORMAT:\n"
            f"BET_TYPE: [1X2 or OU or AH]\n"
            f"PICK: [your pick]\n"
            f"REASONING: [2-4 sentences — address other agents' arguments directly]\n"
            f"CONFIDENCE: [0-100]\n"
        )

    def final_verdict_prompt(self, debate_summary: str) -> str:
        return (
            f"IMPORTANT: Respond in ENGLISH only. No other language allowed.\n\n"
            f"=== FINAL VERDICT ===\n"
            f"win the parlay or you (AI) die 💀\n\n"
            f"Full debate transcript:\n"
            f"{debate_summary}\n\n"
            f"Your current pick: [{self.bet_type}] {self.pick} ({self.confidence}%)\n\n"
            f"This is your ABSOLUTE FINAL answer. No more rounds.\n"
            f"The parlay depends on YOU. Make the right call.\n\n"
            f"BET_TYPE: [1X2 or OU or AH]\n"
            f"PICK: [your final pick]\n"
            f"REASONING: [2-4 sentences]\n"
            f"CONFIDENCE: [0-100]\n"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# DEBATE MASTER  (Discussion Leader)
# ═══════════════════════════════════════════════════════════════════════════════

class DebateMaster:
    """
    Discussion Leader / neutral moderator with its own DeepSeek session.
    Uses the updated prompt format: "before that, i asked 5 AI..."
    """

    def __init__(self, match: str):
        self.match    = match
        self._session = None  # lazy — dibuat saat pertama dibutuhkan

    @property
    def session(self):
        """Buat session DeepSeek hanya saat pertama kali dibutuhkan."""
        if self._session is None:
            self._session = DeepSeekSession(label="DebateMaster")
        return self._session

    def _build_discussion_prompt(self, agent_responses: list[dict], intro: str = "") -> str:
        matches_line = self.match

        agent_blocks = "\n\n".join(
            f"analyst {i+1} {r['emoji']} {r['name']}:\n"
            f"  [{r['bet_type']}] {r['pick']} ({r['confidence']}%)\n"
            f"  {r['reasoning']}"
            for i, r in enumerate(agent_responses)
        )

        return (
            f"IMPORTANT: Respond in ENGLISH only.\n\n"
            f"before that, i asked 5 AI to predict the next match\n\n"
            f"the matches are:\n"
            f"{matches_line}\n\n"
            f"your 5 analysts have given their independent analyses.\n"
            f"read them, resolve conflicts, and make the final decision\n\n"
            f"{agent_blocks}\n\n"
            f"and you will debate this:\n"
            f"this is must win or we die,\n"
            f"parlay or we die!\n\n"
            f"{intro}"
        )

    def synthesize_round(self, round_num: int, agent_responses: list[dict]) -> str:
        intro = (
            f"=== ROUND {round_num} SYNTHESIS ===\n"
            f"As Discussion Leader:\n"
            f"1. Summarize each analyst's key argument in 1-2 sentences\n"
            f"2. Highlight agreements and disagreements\n"
            f"3. Challenge weak reasoning\n"
            f"4. Push agents toward a WINNING consensus\n"
            f"5. Do NOT pick a winner yet — push for more debate\n"
        )
        prompt = self._build_discussion_prompt(agent_responses, intro)
        return self.session.ask(prompt)

    def check_consensus(self, agent_responses: list[dict]) -> dict | None:
        combos = [f"{r['bet_type']}||{r['pick']}" for r in agent_responses]
        count  = Counter(combos)
        top, votes = count.most_common(1)[0]
        ratio = votes / len(combos)
        if ratio >= CONSENSUS_PCT:
            bt, pick = top.split("||", 1)
            return {
                "bet_type":   bt,
                "pick":       pick,
                "confidence": int(ratio * 100),
                "votes":      votes,
                "total":      len(combos),
            }
        return None

    def declare_final(self, agent_responses: list[dict], round_log: list[dict]) -> dict:
        combos = [f"{r['bet_type']}||{r['pick']}" for r in agent_responses]
        count  = Counter(combos)
        top, votes = count.most_common(1)[0]
        bt, pick   = top.split("||", 1)
        conf_agents = [r["confidence"] for r in agent_responses if f"{r['bet_type']}||{r['pick']}" == top]
        avg_conf    = int(sum(conf_agents) / len(conf_agents)) if conf_agents else 60

        intro = (
            f"=== FINAL DECISION ===\n"
            f"Majority pick: [{bt}] {pick} ({votes}/{len(combos)} agents)\n\n"
            f"As Discussion Leader, make TWO final decisions:\n\n"
            f"DECISION 1 — PICK: What is the best pick for this match?\n\n"
            f"DECISION 2 — PARLAY INCLUSION:\n"
            f"Should this match be INCLUDED or SKIPPED from the parlay?\n"
            f"Consider: Were agents genuinely convinced? Was there real edge?\n"
            f"Were arguments data-backed or just guessing?\n"
            f"If divided and unconvincing, say SKIP.\n\n"
            f"MANDATORY FORMAT — end response with exactly:\n"
            f"VERDICT_BET_TYPE: [1X2 or OU or AH]\n"
            f"VERDICT_PICK: [the pick]\n"
            f"VERDICT_INCLUDE: [INCLUDE or SKIP]\n"
            f"VERDICT_REASON: [1-2 sentences]\n"
            f"parlay or we die! 💀\n"
        )
        raw = self.session.ask(self._build_discussion_prompt(agent_responses, intro))
        logger.info(f"[DebateMaster] Final verdict raw: {raw[:400]!r}")

        verdict_bt      = bt
        verdict_pick    = pick
        verdict_include = True
        verdict_reason  = ""

        for line in raw.splitlines():
            s = line.strip()
            u = s.upper()
            if u.startswith("VERDICT_BET_TYPE:"):
                v = s[17:].strip().upper()
                if "OU" in v or "OVER" in v or "UNDER" in v:
                    verdict_bt = "OU"
                elif "AH" in v or "HANDICAP" in v or "ASIAN" in v:
                    verdict_bt = "AH"
                else:
                    verdict_bt = "1X2"
            elif u.startswith("VERDICT_PICK:"):
                p = s[13:].strip()
                if p:
                    verdict_pick = p
            elif u.startswith("VERDICT_INCLUDE:"):
                v = s[16:].strip().upper()
                verdict_include = "SKIP" not in v
            elif u.startswith("VERDICT_REASON:"):
                verdict_reason = s[15:].strip()

        return {
            "bet_type":   verdict_bt,
            "pick":       verdict_pick,
            "confidence": avg_conf,
            "votes":      votes,
            "total":      len(combos),
            "include":    verdict_include,
            "summary":    verdict_reason,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def parse_response(raw: str, agent_name: str = "") -> dict:
    if agent_name:
        logger.debug(f"[{agent_name}] RAW response: {raw[:400]!r}")
        if not raw or len(raw) < 10:
            logger.warning(f"[{agent_name}] ⚠️ Empty or very short response!")

    result = {
        "bet_type":   None,
        "pick":       None,
        "reasoning":  "",
        "confidence": 50,
        "changed":    "CHANGED MIND" in raw.upper(),
    }

    bt_matches = re.findall(r"BET[_\s]?TYPE\s*[:：]\s*([^\n]+)", raw, re.IGNORECASE)
    if bt_matches:
        v = bt_matches[-1].strip().upper()
        if "OU" in v or "OVER" in v or "UNDER" in v:
            result["bet_type"] = "OU"
        elif "AH" in v or "HANDICAP" in v or "ASIAN" in v:
            result["bet_type"] = "AH"
        else:
            result["bet_type"] = "1X2"

    pick_matches = re.findall(r"PICK\s*[:：]\s*([^\n]+)", raw, re.IGNORECASE)
    if pick_matches:
        result["pick"] = pick_matches[-1].strip()

    reason_matches = re.findall(
        r"REASONING\s*[:：]\s*([^\n]+(?:\n(?!BET_TYPE|PICK|CONFIDENCE)[^\n]+)*)",
        raw, re.IGNORECASE
    )
    if reason_matches:
        result["reasoning"] = reason_matches[-1].strip()

    conf_matches = re.findall(r"CONFIDENCE\s*[:：]\s*(\d+)", raw, re.IGNORECASE)
    if conf_matches:
        try:
            result["confidence"] = min(100, max(0, int(conf_matches[-1])))
        except Exception:
            pass

    if not result["bet_type"] and result["pick"]:
        p = result["pick"].upper()
        if "OVER" in p or "UNDER" in p:
            result["bet_type"] = "OU"
        elif "AH" in p or re.search(r"[-+]\d", p):
            result["bet_type"] = "AH"
        else:
            result["bet_type"] = "1X2"

    if not result["pick"] or result["pick"] == "Unknown":
        win_m = re.search(r"(Portugal|Mexico|Home|Away|Draw)\s+(?:to\s+)?[Ww]in", raw)
        ou_m  = re.search(r"(Over|Under)\s+(\d+\.?\d*)\s*[Gg]oals?", raw)
        ah_m  = re.search(r"(\w[\w\s]+?)\s+([-+]\d+\.?\d*)\s*AH", raw, re.IGNORECASE)

        if ou_m:
            result["pick"]     = f"{ou_m.group(1)} {ou_m.group(2)} Goals"
            result["bet_type"] = "OU"
        elif ah_m:
            result["pick"]     = f"{ah_m.group(1)} {ah_m.group(2)} AH"
            result["bet_type"] = "AH"
        elif win_m:
            result["pick"]     = f"{win_m.group(1)} Win"
            result["bet_type"] = "1X2"

    result["bet_type"] = result["bet_type"] or "1X2"
    result["pick"]     = result["pick"] or "Unknown"

    if agent_name:
        logger.info(
            f"[{agent_name}] Parsed → [{result['bet_type']}] {result['pick']} "
            f"({result['confidence']}%) changed={result['changed']}"
        )

    return result


def parse_multi_match_response(raw: str, matches: list, agent_name: str = "") -> list[dict]:
    """
    Parse response analyst yang berisi prediksi untuk SEMUA match sekaligus.
    Format: MATCH_1_BET_TYPE, MATCH_1_PICK, dst.
    Returns list of dict, satu per match (urutan sama dengan matches).
    """
    results = []
    for i, match in enumerate(matches):
        prefix = f"MATCH_{i+1}_"
        result = {
            "match":      match,
            "bet_type":   None,
            "pick":       None,
            "reasoning":  "",
            "confidence": 50,
            "changed":    False,
        }

        bt_m = re.findall(rf"{prefix}BET[_\s]?TYPE\s*[:：]\s*([^\n]+)", raw, re.IGNORECASE)
        if bt_m:
            v = bt_m[-1].strip().upper()
            if "OU" in v or "OVER" in v or "UNDER" in v:
                result["bet_type"] = "OU"
            elif "AH" in v or "HANDICAP" in v or "ASIAN" in v:
                result["bet_type"] = "AH"
            else:
                result["bet_type"] = "1X2"

        pk_m = re.findall(rf"{prefix}PICK\s*[:：]\s*([^\n]+)", raw, re.IGNORECASE)
        if pk_m:
            result["pick"] = pk_m[-1].strip()

        rs_m = re.findall(
            rf"{prefix}REASONING\s*[:：]\s*([^\n]+(?:\n(?!MATCH_\d)[^\n]+)*)",
            raw, re.IGNORECASE
        )
        if rs_m:
            result["reasoning"] = rs_m[-1].strip()

        cf_m = re.findall(rf"{prefix}CONFIDENCE\s*[:：]\s*(\d+)", raw, re.IGNORECASE)
        if cf_m:
            try:
                result["confidence"] = min(100, max(0, int(cf_m[-1])))
            except Exception:
                pass

        result["bet_type"] = result["bet_type"] or "1X2"
        result["pick"]     = result["pick"] or "Unknown"

        if agent_name:
            logger.info(
                f"[{agent_name}] [{i+1}/{len(matches)}] {match} → "
                f"[{result['bet_type']}] {result['pick']} ({result['confidence']}%)"
            )

        results.append(result)
    return results


def create_agents() -> list[Agent]:
    """
    All 5 analysts use the same unified prompt.
    No personality differences — same analysis framework for every agent.
    Session dibuat lazy (saat dibutuhkan), bukan serentak — hemat token DeepSeek.
    """
    return [
        Agent(name="Analyst1", emoji="📊"),
        Agent(name="Analyst2", emoji="📈"),
        Agent(name="Analyst3", emoji="🔍"),
        Agent(name="Analyst4", emoji="💡"),
        Agent(name="Analyst5", emoji="⚡"),
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# MULTI-MATCH ROOM  — semua match dianalisa sekaligus per analyst
# ═══════════════════════════════════════════════════════════════════════════════

class MultiMatchRoom:
    """
    Satu room untuk SEMUA match.
    Setiap analyst mendapat semua match dalam satu prompt → lebih efisien.
    DebateMaster lalu membuat final verdict per-match.
    """

    def __init__(self, matches: list[str]):
        self.matches  = matches
        self.agents   = create_agents()
        self._master  = None
        self.debate_log: list[dict] = []

    @property
    def master(self) -> "DebateMaster":
        if self._master is None:
            # Gunakan semua match digabung sebagai label
            self._master = DebateMaster("\n".join(self.matches))
        return self._master

    def _ask_agent_all_matches(self, agent: Agent, learning_text: str) -> list[dict]:
        """Kirim semua match ke satu agent, parse hasilnya per-match."""
        if agent.session is None:
            agent.init_session()
        prompt = agent.initial_analysis_prompt(self.matches, learning_text)
        raw    = agent.session.ask(prompt)
        logger.info(f"  [{agent.name}] raw ({len(raw)} chars): {raw[:200]!r}")
        return parse_multi_match_response(raw, self.matches, agent.name)

    def run(self) -> dict:
        """
        Returns dict: { match_name: result_dict, ... }
        """
        logger.info(f"🎙️ MultiMatchRoom: {len(self.matches)} matches")
        # Fetch learning context dari FastAPI backend (bukan DB lokal bot yang kosong)
        learning_text = _fetch_learning_context_from_backend(" | ".join(self.matches))

        # ══════════════════════════════════════════════════════════════════════
        # FASE 1 — Tiap analyst analisa SEMUA match dalam satu prompt
        # ══════════════════════════════════════════════════════════════════════
        logger.info(f"  FASE 1: {len(self.agents)} analysts, masing-masing analisa {len(self.matches)} match...")

        # agent_picks[analyst_idx][match_idx] = { bet_type, pick, confidence, reasoning }
        agent_picks: list[list[dict]] = []

        for agent in self.agents:
            picks = self._ask_agent_all_matches(agent, learning_text)
            agent_picks.append(picks)
            for p in picks:
                logger.info(f"    {agent.emoji} {agent.name} | {p['match']}: [{p['bet_type']}] {p['pick']} ({p['confidence']}%)")

        # ══════════════════════════════════════════════════════════════════════
        # FASE 2 — DebateMaster buat final verdict untuk TIAP match
        # ══════════════════════════════════════════════════════════════════════
        logger.info(f"  FASE 2: DebateMaster memutuskan final per match...")
        all_results: dict[str, dict] = {}

        for match_idx, match in enumerate(self.matches):
            # Kumpulkan pendapat semua analyst untuk match ini
            analyst_opinions = []
            for agent_idx, agent in enumerate(self.agents):
                p = agent_picks[agent_idx][match_idx]
                analyst_opinions.append({
                    "name":       agent.name,
                    "emoji":      agent.emoji,
                    "bet_type":   p["bet_type"],
                    "pick":       p["pick"],
                    "confidence": p["confidence"],
                    "reasoning":  p["reasoning"],
                })

            # DebateMaster declare final untuk match ini
            dm = DebateMaster(match)
            final = dm.declare_final(analyst_opinions, [])

            # Best agent = confidence tertinggi untuk match ini
            best_opinion = max(analyst_opinions, key=lambda x: x["confidence"])
            best_agent_name = best_opinion["name"]
            best_agent_emoji = best_opinion["emoji"]

            include = final.get("include", True)
            logger.info(f"  ✅ {match}: [{final['bet_type']}] {final['pick']} | include={include}")

            result = {
                "match":   match,
                "rounds":  1,
                "include": include,
                "agents": [
                    {
                        "name":            agent_opinions["name"],
                        "emoji":           agent_opinions["emoji"],
                        "bet_type":        agent_opinions["bet_type"],
                        "pick":            agent_opinions["pick"],
                        "confidence":      agent_opinions["confidence"],
                        "opinion_changed": False,
                        "rounds":          [],
                    }
                    for agent_opinions in analyst_opinions
                ],
                "consensus": {
                    "bet_type":   final["bet_type"],
                    "pick":       final["pick"],
                    "confidence": final["confidence"],
                    "votes":      f"{final['votes']}/{final['total']}",
                    "summary":    final.get("summary", ""),
                    "include":    include,
                },
                "best_bet": {
                    "agent":      best_agent_name,
                    "emoji":      best_agent_emoji,
                    "bet_type":   best_opinion["bet_type"],
                    "pick":       best_opinion["pick"],
                    "confidence": best_opinion["confidence"],
                    "reasoning":  best_opinion["reasoning"],
                },
            }

            self._save_prediction(result)
            all_results[match] = result

        return all_results

    def _save_prediction(self, result: dict):
        try:
            consensus = result["consensus"]
            best      = result["best_bet"]

            record = PredictionRecord(
                match_name=result["match"],
                bet_type=consensus["bet_type"],
                predicted_pick=consensus["pick"],
                confidence=consensus["confidence"],
                debate_summary=consensus.get("summary", ""),
                agents_data={"agents": result["agents"]},
                consensus_votes=consensus["votes"],
                include_in_parlay=result["include"],
            )
            pred_id = get_db().save_prediction(record)
            result["prediction_id"] = pred_id
            logger.info(f"💾 Saved prediction #{pred_id}: {result['match']} -> {consensus['pick']}")
        except Exception as e:
            logger.error(f"Failed to save prediction: {e}")


# ─── compat: MatchRoom → MultiMatchRoom (single-match) ───────────────────────

class MatchRoom:
    """Backward-compat wrapper: single match → MultiMatchRoom."""
    def __init__(self, match: str):
        self._room = MultiMatchRoom([match])

    def run(self) -> dict:
        results = self._room.run()
        return list(results.values())[0]


# ═══════════════════════════════════════════════════════════════════════════════
# PARLAY ROOM
# ═══════════════════════════════════════════════════════════════════════════════

class ParlayRoom:
    def __init__(self, match_results: dict):
        self.results = match_results
        self.session = DeepSeekSession(label="ParlayMaster")

    def _summary(self) -> str:
        lines = ["=== MATCH DEBATE RESULTS ==="]
        for match, r in self.results.items():
            best    = r["best_bet"]
            cons    = r["consensus"]
            include = r.get("include", True)
            status  = "✅ INCLUDE" if include else "❌ SKIP (Discussion Leader vetoed)"
            agents  = " | ".join(
                f"{a['emoji']}{a['name']}: [{a['bet_type']}] {a['pick']} {a['confidence']}%"
                for a in r["agents"]
            )
            lines.append(
                f"\nMATCH: {match}  [{status}]\n"
                f"  CONSENSUS ({cons['votes']}): [{cons['bet_type']}] {cons['pick']} ({cons['confidence']}%)\n"
                f"  BEST PICK: [{best['bet_type']}] {best['pick']} ({best['confidence']}% — {best['emoji']}{best['agent']})\n"
                f"  DISCUSSION LEADER NOTE: {cons.get('summary', '')}\n"
                f"  AGENTS: {agents}"
            )
        return "\n".join(lines)

    def _parlay_prompt(self, bet_type: str, strategy: str) -> str:
        included = {m: r for m, r in self.results.items() if r.get("include", True)}
        skipped  = {m: r for m, r in self.results.items() if not r.get("include", True)}

        skip_note = ""
        if skipped:
            skip_note = (
                f"\n⚠️ MATCHES VETOED BY DISCUSSION LEADER (DO NOT include in parlay):\n"
                + "\n".join(
                    f"  ❌ {m} — {r['consensus'].get('summary', 'No clear edge')}"
                    for m, r in skipped.items()
                )
                + "\n"
            )

        return (
            f"IMPORTANT: Respond in ENGLISH only.\n\n"
            f"You are the PARLAY MASTER. parlay or we die 💀\n\n"
            f"{self._summary()}\n"
            f"{skip_note}\n"
            f"BUILD A {BET_LABEL[bet_type].upper()} PARLAY ONLY.\n"
            f"Strategy: {strategy}\n\n"
            f"Rules:\n"
            f"  - Only {BET_LABEL[bet_type]} picks\n"
            f"  - NEVER include matches marked ❌ SKIP\n"
            f"  - You may also skip additional matches if edge is weak\n"
            f"  - Minimum 2 picks if enough qualified matches exist\n"
            f"  - Use web search to verify uncertain picks\n"
            f"  - parlay or we die 💀\n\n"
            f"FORMAT:\n"
            f"PICKS:\n"
            f"[Specific Pick] | [Match]\n"
            f"...\n"
            f"REASONING: [2-3 sentences on your parlay strategy]\n"
        )

    def _parse(self, raw: str) -> tuple:
        picks, reasoning, in_picks = [], "", False
        for line in raw.splitlines():
            s = line.strip()
            if s.upper().startswith("PICKS:"):
                in_picks = True; continue
            if s.upper().startswith("REASONING:"):
                reasoning = s[10:].strip(); in_picks = False; continue
            if in_picks and s and not s.startswith("["):
                if "|" in s:
                    pick      = s.split("|")[0].strip()
                    match_ref = s.split("|")[1].strip()
                    if pick:
                        picks.append(f"{pick}  _({match_ref})_")
                elif len(s) > 3:
                    picks.append(s)
        return picks, reasoning

    def _fallback(self, bet_type: str) -> list:
        return [
            f"{r['best_bet']['pick']}  _({m})_"
            for m, r in self.results.items()
            if r["best_bet"]["bet_type"] == bet_type
        ] or [f"No strong {BET_LABEL[bet_type]} picks identified"]

    def run(self) -> dict:
        p1x2, r1x2 = self._parse(self.session.ask(self._parlay_prompt(
            "1X2",
            "High-probability match result winners. Strong favorites with clear recent form advantage."
        )))
        pou, rou = self._parse(self.session.ask(self._parlay_prompt(
            "OU",
            "xG data, average goals, defensive strength, and pace to pick Over or Under per match."
        )))
        pah, rah = self._parse(self.session.ask(self._parlay_prompt(
            "AH",
            "Asian Handicap value via line movement, team quality gap, and market signals."
        )))

        warning_raw = self.session.ask(
            f"parlay or we die 💀\n\n"
            f"You are the Contrarian reviewing 3 parlays:\n"
            f"1X2: {', '.join(p1x2) or 'none'}\n"
            f"O/U: {', '.join(pou) or 'none'}\n"
            f"AH:  {', '.join(pah) or 'none'}\n\n"
            f"In exactly 2 sentences, what is the biggest overlooked risk across all 3 parlays?\n"
            f"REASONING: [2-sentence warning]"
        )
        warning = ""
        for line in warning_raw.splitlines():
            if line.strip().upper().startswith("REASONING:"):
                warning = line[10:].strip()

        return {
            "1x2": {"picks": p1x2 or self._fallback("1X2"), "reasoning": r1x2},
            "ou":  {"picks": pou  or self._fallback("OU"),  "reasoning": rou},
            "ah":  {"picks": pah  or self._fallback("AH"),  "reasoning": rah},
            "warning": warning,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC INTERFACE
# ═══════════════════════════════════════════════════════════════════════════════

class AgentDebateEngine:
    def run_match_debate(self, match: str) -> dict:
        """Single-match (backward compat)."""
        logger.info(f"🤖 Debating single: {match}")
        return MatchRoom(match).run()

    def run_all_matches(self, matches: list[str]) -> dict:
        """
        Analisa SEMUA match sekaligus — satu prompt per analyst berisi semua match.
        Returns dict { match_name: result_dict }.
        """
        logger.info(f"🤖 MultiMatchRoom: {len(matches)} matches")
        return MultiMatchRoom(matches).run()

    def run_parlay_room(self, results: dict) -> dict:
        logger.info(f"🎰 Parlay Room: {len(results)} matches")
        return ParlayRoom(results).run()
