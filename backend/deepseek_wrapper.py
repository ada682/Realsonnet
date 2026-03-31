# ── deepseek_wrapper.py ───────────────────────────────────────────────────────
# DeepSeek API wrapper — per-session instances.
# NO global singleton. Each caller creates its own DeepSeekSession.
# search=True and thinking=True always on.
#
# MULTI-TOKEN SUPPORT:
#   - Set DEEPSEEK_TOKENS = ["token1", "token2", ...] in config.py
#   - Fallback: single DEEPSEEK_TOKEN still works
#   - TokenPool distributes sessions via round-robin
#   - Token put on cooldown if rate-limited / empty response
#   - Session auto-switches token on failure before recreating
#
# RETRY LOGIC:
#   - On error: retry up to MAX_RETRIES with same token
#   - After max retries: switch to next available token and retry
#   - If all tokens exhausted: recreate session + notify Telegram
#   - If still failing: raise exception
# ═══════════════════════════════════════════════════════════════════════════════

import requests
import json
import base64
import struct
import ctypes
import logging
import time
import traceback
import threading

# Support both DEEPSEEK_TOKENS (list) and legacy DEEPSEEK_TOKEN (single)
try:
    from config import DEEPSEEK_TOKENS
    if not isinstance(DEEPSEEK_TOKENS, list) or not DEEPSEEK_TOKENS:
        raise ImportError("DEEPSEEK_TOKENS is empty or not a list")
except ImportError:
    try:
        from config import DEEPSEEK_TOKEN
        DEEPSEEK_TOKENS = [DEEPSEEK_TOKEN]
    except ImportError:
        raise RuntimeError("config.py must define DEEPSEEK_TOKENS (list) or DEEPSEEK_TOKEN (str)")

logger = logging.getLogger(__name__)

BASE_URL = "https://chat.deepseek.com"

BASE_HEADERS = {
    "Host":              "chat.deepseek.com",
    "User-Agent":        "DeepSeek/1.0.13 Android/35",
    "Accept":            "application/json",
    "Accept-Encoding":   "identity",
    "Content-Type":      "application/json",
    "x-client-platform": "android",
    "x-client-version":  "1.3.0-auto-resume",
    "x-client-locale":   "zh_CN",
    "accept-charset":    "UTF-8",
    "referer":           "https://chat.deepseek.com/",
}

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

MAX_RETRIES          = 3   # Max retries per token
RETRY_DELAY          = 2   # Delay between retries (seconds)
SESSION_RECREATE_DELAY = 5 # Delay before recreating session
TOKEN_COOLDOWN       = 60  # Seconds to cool down a rate-limited token

# Telegram notification callback (set from bot.py)
_telegram_notifier = None


def set_telegram_notifier(callback):
    """Set callback function for Telegram notifications"""
    global _telegram_notifier
    _telegram_notifier = callback


def notify_telegram_error(error_msg: str, context: str = ""):
    """Send error notification to Telegram"""
    if _telegram_notifier:
        try:
            _telegram_notifier(error_msg, context)
        except Exception as e:
            logger.error(f"Failed to send Telegram notification: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# TOKEN POOL  — round-robin with per-token cooldown
# ═══════════════════════════════════════════════════════════════════════════════

class TokenPool:
    """
    Manages a pool of DeepSeek tokens.

    Strategy:
      - Round-robin assignment: each new session gets the next token in line
      - On rate-limit / empty response: mark token on cooldown for TOKEN_COOLDOWN s
      - get_next() always returns an available (not cooling down) token
      - Thread-safe via Lock
    """

    def __init__(self, tokens: list[str]):
        if not tokens:
            raise ValueError("TokenPool requires at least one token")
        self._tokens    = list(tokens)
        self._index     = 0
        self._cooldowns: dict[str, float] = {}  # token -> cooldown_until timestamp
        self._lock      = threading.Lock()
        logger.info(f"[TokenPool] Initialized with {len(self._tokens)} token(s)")

    def _available_tokens(self) -> list[str]:
        """Return tokens not currently in cooldown."""
        now = time.time()
        return [t for t in self._tokens if now >= self._cooldowns.get(t, 0)]

    def get_next(self) -> str | None:
        """
        Return the next available token (round-robin).
        Returns None if every token is cooling down.
        """
        with self._lock:
            available = self._available_tokens()
            if not available:
                # All cooling — return the one with shortest remaining cooldown
                soonest = min(self._tokens, key=lambda t: self._cooldowns.get(t, 0))
                wait = max(0, self._cooldowns[soonest] - time.time())
                logger.warning(f"[TokenPool] All tokens cooling down. Soonest available in {wait:.1f}s")
                return None

            # Advance round-robin index over available tokens
            token = available[self._index % len(available)]
            self._index = (self._index + 1) % len(available)
            return token

    def mark_rate_limited(self, token: str):
        """Put token in cooldown after rate-limit / empty response."""
        with self._lock:
            until = time.time() + TOKEN_COOLDOWN
            self._cooldowns[token] = until
            available = len(self._available_tokens())
            logger.warning(
                f"[TokenPool] Token ...{token[-8:]} cooling down for {TOKEN_COOLDOWN}s. "
                f"{available}/{len(self._tokens)} tokens available."
            )
            notify_telegram_error(
                f"⚠️ DeepSeek token rate-limited",
                f"Token: ...{token[-8:]}\nCooldown: {TOKEN_COOLDOWN}s\n"
                f"Available tokens: {available}/{len(self._tokens)}"
            )

    def mark_ok(self, token: str):
        """Clear any cooldown on a token after a successful request."""
        with self._lock:
            if token in self._cooldowns:
                del self._cooldowns[token]

    def get_headers(self, token: str) -> dict:
        """Build request headers for a specific token."""
        h = BASE_HEADERS.copy()
        h["authorization"] = f"Bearer {token}"
        return h

    @property
    def count(self) -> int:
        return len(self._tokens)

    @property
    def available_count(self) -> int:
        return len(self._available_tokens())


# Global token pool shared across all sessions
TOKEN_POOL = TokenPool(DEEPSEEK_TOKENS)


# ═══════════════════════════════════════════════════════════════════════════════
# PoW SOLVER
# ═══════════════════════════════════════════════════════════════════════════════

def _solve_pow_python(challenge: dict) -> int:
    import hashlib
    salt         = challenge.get("salt", "")
    expire_at    = challenge.get("expire_at", "")
    difficulty   = challenge.get("difficulty", 100000)
    prefix       = f"{salt}_{expire_at}_"
    target_zeros = max(1, int(difficulty / 10))
    for nonce in range(0, 10_000_000):
        attempt = f"{prefix}{nonce}"
        h = hashlib.sha3_256(attempt.encode()).hexdigest()
        if h.startswith("0" * target_zeros):
            return nonce
    return 0


def _try_wasm_solver(challenge: dict):
    try:
        import wasmtime, os
        wasm_path = "sha3.wasm"
        if not os.path.exists(wasm_path):
            raise FileNotFoundError("sha3.wasm not found")

        engine   = wasmtime.Engine()
        module   = wasmtime.Module.from_file(engine, wasm_path)
        linker   = wasmtime.Linker(engine)
        store    = wasmtime.Store(engine)
        instance = linker.instantiate(store, module)
        exports  = instance.exports(store)

        memory       = exports["memory"]
        alloc        = exports["__wbindgen_export_0"]
        add_to_stack = exports["__wbindgen_add_to_stack_pointer"]
        wasm_solve   = exports["wasm_solve"]

        salt          = challenge["salt"]
        expire_at     = challenge["expire_at"]
        difficulty    = challenge["difficulty"]
        challenge_str = challenge["challenge"]
        prefix        = f"{salt}_{expire_at}_"

        def write_str(text):
            data = text.encode("utf-8")
            ptr  = alloc(store, len(data), 1)
            base = ctypes.cast(memory.data_ptr(store), ctypes.c_void_p).value
            ctypes.memmove(base + ptr, data, len(data))
            return ptr, len(data)

        retptr       = add_to_stack(store, -16)
        p_ch, l_ch   = write_str(challenge_str)
        p_pre, l_pre = write_str(prefix)
        wasm_solve(store, retptr, p_ch, l_ch, p_pre, l_pre, float(difficulty))

        base   = ctypes.cast(memory.data_ptr(store), ctypes.c_void_p).value
        status = struct.unpack("<i", ctypes.string_at(base + retptr, 4))[0]
        answer = None
        if status != 0:
            answer = int(struct.unpack("<d", ctypes.string_at(base + retptr + 8, 8))[0])
        add_to_stack(store, 16)
        return answer

    except Exception as e:
        logger.debug(f"WASM unavailable ({e}), fallback to Python PoW")
        return _solve_pow_python(challenge)


def _do_pow(headers: dict) -> str:
    try:
        resp = requests.post(
            BASE_URL + "/api/v0/chat/create_pow_challenge",
            headers=headers,
            json={"target_path": "/api/v0/chat/completion"},
            timeout=15,
        )
        challenge = resp.json().get("data", {}).get("biz_data", {}).get("challenge")
        if not challenge:
            return ""
        answer = _try_wasm_solver(challenge)
        pow_dict = {
            "algorithm":   "DeepSeekHashV1",
            "challenge":   challenge["challenge"],
            "salt":        challenge["salt"],
            "answer":      answer,
            "signature":   challenge["signature"],
            "target_path": "/api/v0/chat/completion",
        }
        return base64.b64encode(
            json.dumps(pow_dict, separators=(",", ":")).encode()
        ).decode()
    except Exception as e:
        logger.warning(f"PoW failed: {e}")
        return ""


# ═══════════════════════════════════════════════════════════════════════════════
# SESSION
# ═══════════════════════════════════════════════════════════════════════════════

class DeepSeekSession:
    """
    ONE independent DeepSeek chat session with its own history.
    - Each agent gets its own instance → different personality/memory
    - Debate master gets its own instance → neutral moderator memory
    - Session stays alive across all rounds of a match
    - thinking=True + search=True always enabled
    - Pulls token from global TOKEN_POOL (round-robin)
    - On rate-limit: marks current token, switches to next available token
    """

    def __init__(self, label: str = "session"):
        self._label      = label
        self._session_id: str | None = None
        self._parent_id:  str | None = None
        self._token:      str | None = None
        self._headers:    dict       = {}
        self._init_session()

    # ── internal helpers ──────────────────────────────────────────────────────

    def _pick_token(self) -> bool:
        """Grab the next available token from the pool."""
        token = TOKEN_POOL.get_next()
        if not token:
            return False
        self._token   = token
        self._headers = TOKEN_POOL.get_headers(token)
        return True

    def _init_session(self, new_token: bool = False):
        """
        Initialize (or reinitialize) a DeepSeek chat session.
        If new_token=True, pick a fresh token from the pool first.
        """
        if new_token or not self._token:
            if not self._pick_token():
                logger.error(f"[{self._label}] No tokens available in pool")
                return

        try:
            logger.info(f"[{self._label}] Creating session (token ...{self._token[-8:]})...")
            resp = requests.post(
                BASE_URL + "/api/v0/chat_session/create",
                headers=self._headers,
                json={},
                timeout=30,
            )
            logger.info(f"[{self._label}] HTTP {resp.status_code}")

            if resp.status_code != 200:
                logger.error(f"[{self._label}] Failed: {resp.text[:200]}")
                return

            try:
                result = resp.json()
            except Exception as e:
                logger.error(f"[{self._label}] Non-JSON body: {e} | {resp.text[:200]}")
                return

            if not isinstance(result, dict):
                logger.error(f"[{self._label}] Unexpected type: {type(result)}")
                return

            biz = (result.get("data") or {}).get("biz_data") or {}
            self._session_id = biz.get("id")

            if self._session_id:
                logger.info(f"[{self._label}] ✅ Session ready: {self._session_id}")
            else:
                logger.error(
                    f"[{self._label}] ❌ No session ID — check token ...{self._token[-8:]}. "
                    f"Got: {result}"
                )
        except Exception as e:
            logger.error(f"[{self._label}] Init error: {e}")
            traceback.print_exc()

    def _collect_stream(self, response) -> str:
        parts          = []
        last_line_str  = None
        new_message_id = None

        try:
            for line in response.iter_lines():
                if not line:
                    continue
                s = line.decode("utf-8")

                if not s.startswith("data: "):
                    last_line_str = s
                    continue

                try:
                    data = json.loads(s[6:])
                except Exception:
                    last_line_str = s
                    continue

                if last_line_str and last_line_str.startswith("event: "):
                    if last_line_str[7:] == "ready":
                        new_message_id = data.get("response_message_id")

                if "p" in data:
                    if data["p"] == "response/content":
                        parts.append(str(data.get("v", "")))
                else:
                    v = data.get("v")
                    if isinstance(v, list):
                        for frag in v:
                            if isinstance(frag, dict) and frag.get("type") == "RESPONSE":
                                parts.append(frag.get("content", ""))
                    elif isinstance(v, str):
                        parts.append(v)

                last_line_str = s

        except Exception as e:
            logger.warning(f"[{self._label}] Stream error: {e}")

        if new_message_id:
            self._parent_id = new_message_id

        return "".join(parts).strip()

    def _send_request(self, prompt: str) -> str:
        """Send a single request to DeepSeek using the current token."""
        if not self._session_id:
            raise RuntimeError(f"[{self._label}] No session ID available")

        pow_token = _do_pow(self._headers)
        headers   = self._headers.copy()
        if pow_token:
            headers["x-ds-pow-response"] = pow_token

        payload = {
            "chat_session_id":   self._session_id,
            "parent_message_id": self._parent_id,
            "prompt":            prompt,
            "ref_file_ids":      [],
            "thinking_enabled":  True,
            "search_enabled":    True,
            "preempt":           False,
        }

        response = requests.post(
            BASE_URL + "/api/v0/chat/completion",
            headers=headers,
            json=payload,
            stream=True,
            timeout=120,
        )

        if response.status_code == 429:
            raise RateLimitError(f"HTTP 429 rate limit on token ...{self._token[-8:]}")

        if response.status_code != 200:
            raise RuntimeError(f"HTTP {response.status_code}: {response.text[:200]}")

        result = self._collect_stream(response)
        if not result:
            raise EmptyResponseError(f"Empty response (possible rate limit) on token ...{self._token[-8:]}")

        return result

    # ── public API ────────────────────────────────────────────────────────────

    def ask(self, prompt: str) -> str:
        """
        Send a message with multi-token retry logic:

        Phase 1  — Try current token up to MAX_RETRIES times.
        Phase 2  — On rate-limit/empty: mark token, switch to next, retry.
                   (Cycles through all available tokens before giving up.)
        Phase 3  — Last resort: recreate session with a fresh token + notify Telegram.
        """
        tried_tokens: set[str] = set()

        while True:
            current_token = self._token
            tried_tokens.add(current_token)
            last_error    = None

            # ── Phase 1: retry on current token ──────────────────────────────
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    logger.info(
                        f"[{self._label}] Attempt {attempt}/{MAX_RETRIES} "
                        f"(token ...{current_token[-8:]})"
                    )
                    result = self._send_request(prompt)
                    TOKEN_POOL.mark_ok(current_token)
                    logger.info(f"[{self._label}] ✅ Success on attempt {attempt}")
                    return result

                except (RateLimitError, EmptyResponseError) as e:
                    # Rate-limited — no point retrying this token
                    last_error = e
                    logger.warning(f"[{self._label}] Rate-limit/empty on token ...{current_token[-8:]}: {e}")
                    TOKEN_POOL.mark_rate_limited(current_token)
                    break  # Jump straight to token switch

                except Exception as e:
                    last_error = e
                    logger.warning(f"[{self._label}] Attempt {attempt} failed: {e}")
                    if attempt < MAX_RETRIES:
                        logger.info(f"[{self._label}] Retrying in {RETRY_DELAY}s...")
                        time.sleep(RETRY_DELAY)

            # ── Phase 2: switch to next available token ───────────────────────
            next_token = TOKEN_POOL.get_next()

            # Skip tokens we've already tried
            attempts_to_find_new = 0
            while next_token and next_token in tried_tokens and attempts_to_find_new < TOKEN_POOL.count:
                next_token = TOKEN_POOL.get_next()
                attempts_to_find_new += 1

            if next_token and next_token not in tried_tokens:
                logger.warning(
                    f"[{self._label}] Switching token: ...{current_token[-8:]} → ...{next_token[-8:]}"
                )
                self._token   = next_token
                self._headers = TOKEN_POOL.get_headers(next_token)
                self._parent_id = None   # New token = new session history
                self._init_session()
                continue  # Loop back to Phase 1 with new token

            # ── Phase 3: all tokens exhausted — last-resort recreate ──────────
            logger.error(f"[{self._label}] All tokens tried/cooling. Last resort: recreate session.")

            notify_telegram_error(
                f"❌ DeepSeek all tokens exhausted",
                f"Session: {self._label}\nLast error: {last_error}\n"
                f"Available: {TOKEN_POOL.available_count}/{TOKEN_POOL.count} tokens\n"
                f"Attempting session recreation..."
            )

            time.sleep(SESSION_RECREATE_DELAY)
            # Force pick a token (even if cooling, get soonest)
            self._pick_token()
            self._parent_id = None
            self._init_session()

            if not self._session_id:
                err = f"[{self._label}] Failed to recreate session — all tokens failing"
                notify_telegram_error(
                    "❌ DeepSeek completely failed",
                    f"Session: {self._label}\nManual intervention required."
                )
                raise RuntimeError(err)

            try:
                logger.info(f"[{self._label}] Last-resort retry with new session...")
                result = self._send_request(prompt)
                logger.info(f"[{self._label}] ✅ Recovered after session recreation")
                notify_telegram_error(
                    "✅ DeepSeek recovered",
                    f"Session: {self._label}\nRecovered after full token rotation."
                )
                return result

            except Exception as e:
                err = f"[{self._label}] Failed even after session recreation: {e}"
                logger.error(err)
                notify_telegram_error(
                    "❌ DeepSeek completely failed",
                    f"Session: {self._label}\nError: {e}\nManual intervention required."
                )
                raise RuntimeError(err)

    @property
    def ready(self) -> bool:
        return self._session_id is not None

    def reset(self):
        """Reset the session (create new one, keep same token)."""
        logger.info(f"[{self._label}] Resetting session...")
        self._parent_id = None
        self._init_session()


# ═══════════════════════════════════════════════════════════════════════════════
# CUSTOM EXCEPTIONS
# ═══════════════════════════════════════════════════════════════════════════════

class RateLimitError(RuntimeError):
    """Raised when DeepSeek returns HTTP 429."""
    pass


class EmptyResponseError(RuntimeError):
    """Raised when DeepSeek returns an empty stream (likely soft rate-limit)."""
    pass
