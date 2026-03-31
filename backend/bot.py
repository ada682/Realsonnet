# ── bot.py ────────────────────────────────────────────────────────────────────
# Parlay Prediction Bot v6
# - Admin-only access (all commands restricted to ADMIN_CHAT_IDS)
# - /hasil removed (results now auto-tracked via website + football-data API)
# - Fully async / non-blocking with asyncio.create_task
# - Multiple users processed simultaneously
# - WIN THE PARLAY OR WE DIE 💀

import asyncio
import logging
import re
from telegram import Update, Message
from telegram.ext import (
    ApplicationBuilder, CommandHandler,
    MessageHandler, ContextTypes, filters
)
from telegram.error import BadRequest
from agents import AgentDebateEngine
from database import get_db
from learning_engine import get_learning_engine
from deepseek_wrapper import set_telegram_notifier
from config import TELEGRAM_TOKEN, ADMIN_CHAT_IDS   # list of admin chat IDs

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

BET_EMOJI = {"1X2": "🏆", "OU": "⚽", "AH": "⚖️"}
TG_LIMIT  = 4000


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN GUARD
# ═══════════════════════════════════════════════════════════════════════════════

def is_admin(update: Update) -> bool:
    """Return True only if sender's chat ID is in ADMIN_CHAT_IDS."""
    chat_id = update.effective_chat.id
    return chat_id in ADMIN_CHAT_IDS


async def reject_non_admin(update: Update):
    await update.message.reply_text(
        "🔒 *Access Denied*\n\nBot ini hanya untuk admin.",
        parse_mode="Markdown"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# TELEGRAM NOTIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

def send_telegram_notification(error_msg: str, context: str = ""):
    if not ADMIN_CHAT_IDS:
        logger.warning("ADMIN_CHAT_IDS empty, cannot send notification")
        return
    try:
        import requests
        message = f"🚨 *BOT ALERT*\n\n{error_msg}"
        if context:
            message += f"\n\n📋 Context:\n```{context[:500]}```"
        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
        for cid in ADMIN_CHAT_IDS:
            requests.post(url, json={
                "chat_id": cid,
                "text": message,
                "parse_mode": "Markdown"
            }, timeout=10)
    except Exception as e:
        logger.error(f"Failed to send Telegram notification: {e}")


set_telegram_notifier(send_telegram_notification)


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def parse_matches(text: str) -> list:
    if "\n" not in text and "," in text:
        text = text.replace(",", "\n")
    matches = []
    for line in text.strip().splitlines():
        line = re.sub(r"^[\d]+[\.\)]\s*", "", line.strip())
        line = re.sub(r"^[-*•]\s*", "", line)
        if re.search(r"\s+vs?\.?\s+", line, re.IGNORECASE):
            matches.append(line.strip())
    return matches


async def safe_edit(msg: Message, text: str):
    if len(text) > TG_LIMIT:
        text = text[:TG_LIMIT - 3] + "..."
    try:
        await msg.edit_text(text, parse_mode="Markdown")
    except BadRequest as e:
        if "not modified" not in str(e).lower():
            logger.warning(f"Edit failed: {e}")


async def safe_send(update: Update, text: str) -> Message:
    if len(text) <= TG_LIMIT:
        return await update.message.reply_text(text, parse_mode="Markdown")
    chunk = text[:TG_LIMIT].rsplit("\n", 1)[0]
    msg   = await update.message.reply_text(chunk, parse_mode="Markdown")
    rest  = text[len(chunk):].lstrip("\n")
    if rest:
        await update.message.reply_text(rest[:TG_LIMIT], parse_mode="Markdown")
    return msg


def trunc(text: str, limit: int = 140) -> str:
    return text[:limit] + "..." if len(text) > limit else text


# ═══════════════════════════════════════════════════════════════════════════════
# FORMATTERS
# ═══════════════════════════════════════════════════════════════════════════════

def fmt_match_summary_line(match: str, result: dict) -> str:
    best    = result["best_bet"]
    cons    = result["consensus"]
    rounds  = result.get("rounds", "?")
    include = result.get("include", True)
    bt_emj  = BET_EMOJI.get(best["bet_type"], "🎯")

    conf_filled = min(int(best["confidence"] / 20), 5)
    conf_bar    = "🟩" * conf_filled + "⬜" * (5 - conf_filled)

    agent_picks = "  ".join(
        f"{a['emoji']}`{a['pick'][:10]}`"
        for a in result["agents"]
    )

    status_line = "✅ *MASUK PARLAY*" if include else "❌ *SKIP — Discussion Leader: tidak ada edge cukup*"

    lines = [
        f"⚽ *{match}*  _{rounds} rounds_  {status_line}",
        f"  {bt_emj} `[{best['bet_type']}]` *{best['pick']}*  {conf_bar} {best['confidence']}%",
        f"  🤝 Consensus ({cons['votes']}): `[{cons['bet_type']}]` {cons['pick']} ({cons['confidence']}%)",
        f"  {agent_picks}",
        f"  _{trunc(best['reasoning'], 120)}_",
    ]
    if cons.get("summary"):
        lines.append(f"  📋 _{trunc(cons['summary'], 120)}_")
    return "\n".join(lines)


def fmt_all_matches(all_results: dict) -> str:
    lines = [
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        "🤖 *HASIL DEBAT ANALYST*",
        "_WIN THE PARLAY OR WE DIE_ 💀",
        f"_{len(all_results)} match dianalisa oleh 5 AI analysts + 1 Discussion Leader_",
        "",
    ]
    for match, result in all_results.items():
        lines.append(fmt_match_summary_line(match, result))
        lines.append("")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)


def fmt_parlay(parlay: dict) -> str:
    lines = [
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        "🏆 *FINAL PARLAY RECOMMENDATIONS*",
        "_WIN THE PARLAY OR WE DIE_ 💀",
        "",
    ]

    sections = [
        ("1x2", "🏆", "*1X2 PARLAY*  _(Match Result)_", "✅"),
        ("ou",  "⚽", "*OVER/UNDER PARLAY*  _(Goals)_",  "🔵"),
        ("ah",  "⚖️", "*ASIAN HANDICAP PARLAY*",          "🟡"),
    ]

    for key, emj, title, bullet in sections:
        data   = parlay.get(key, {})
        picks  = data.get("picks", [])
        reason = data.get("reasoning", "")
        lines.append(f"{emj} {title}")
        for p in picks:
            lines.append(f"  {bullet} {p}")
        if reason:
            lines.append(f"  💬 _{trunc(reason, 200)}_")
        lines.append("")

    warning = parlay.get("warning", "")
    if warning:
        lines += [
            "⚠️ *Contrarian Warning:*",
            f"_{trunc(warning, 250)}_",
            "",
        ]

    lines += [
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        "⚠️ _For entertainment only. Bet responsibly._",
    ]
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
# CORE PREDICTION TASK (runs in background — non-blocking)
# ═══════════════════════════════════════════════════════════════════════════════

async def _run_prediction_task(update: Update, matches: list, status: Message):
    """
    Runs the AI prediction in an asyncio background task so the bot
    stays responsive to other users while this is processing.
    """
    engine = AgentDebateEngine()

    try:
        all_results = {}
        total = len(matches)

        for i, match in enumerate(matches, 1):
            await safe_edit(
                status,
                f"🔄 *Analyzing match {i}/{total}...*\n\n"
                f"⚽ `{match}`\n\n"
                f"_5 AI analysts are debating..._"
            )
            # Run synchronous AI work in executor so event loop stays free
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, engine.run_match_debate, match
            )
            all_results[match] = result

        await safe_edit(status, "🎰 *Building parlay recommendations...*")
        loop = asyncio.get_event_loop()
        parlay = await loop.run_in_executor(
            None, engine.run_parlay_room, all_results
        )

        summary_text = fmt_all_matches(all_results)
        parlay_text  = fmt_parlay(parlay)

        await safe_edit(status, summary_text)
        await safe_send(update, parlay_text)
        await update.message.reply_text(
            f"✅ *Analisa selesai untuk {total} match!*\n"
            f"_WIN THE PARLAY OR WE DIE_ 💀\n\n"
            f"💡 Hasil prediksi tersimpan. Cek website untuk tracking real-time."
        )

    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        send_telegram_notification(
            "❌ Error dalam memproses prediksi",
            f"User: {update.effective_user.id}\nError: {str(e)}"
        )
        await safe_edit(
            status,
            f"❌ *Error:*\n`{str(e)}`\n\nAdmin telah diberitahu. Silakan coba lagi nanti."
        )


# ═══════════════════════════════════════════════════════════════════════════════
# COMMAND HANDLERS
# ═══════════════════════════════════════════════════════════════════════════════

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        await reject_non_admin(update)
        return
    await update.message.reply_text(
        "🎯 *PARLAY PREDICTION BOT v6*\n"
        "_WIN THE PARLAY OR WE DIE_ 💀\n\n"
        "Kirim daftar pertandingan, sistem akan:\n"
        "  🔍 5 AI analysts analisa secara independen\n"
        "  💬 Discussion Leader moderasi debat\n"
        "  🔄 Debat terus sampai ≥3/5 analyst sepakat\n"
        "  📊 Simpan prediksi untuk tracking\n"
        "  📦 Output: 1 ringkasan semua match + 3 parlay\n\n"
        "*Format Input Match:*\n"
        "```\n"
        "Man City vs Arsenal\n"
        "Real Madrid vs Barcelona\n"
        "AC Milan vs Juventus\n"
        "```\n\n"
        "*Commands:*\n"
        "`/stats` — statistik performa prediksi\n"
        "`/report` — laporan learning\n"
        "`/pending` — match belum ada hasil\n\n"
        "📊 Hasil & tracking real-time tersedia di website.",
        parse_mode="Markdown"
    )


async def handle_matches(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        await reject_non_admin(update)
        return

    text    = update.message.text.strip()
    matches = parse_matches(text)

    if not matches:
        await update.message.reply_text(
            "⚠️ *Tidak ada match terdeteksi!*\n\n"
            "Format: `Team A vs Team B`\n"
            "Contoh:\n`Man City vs Arsenal\nReal Madrid vs Barcelona`",
            parse_mode="Markdown"
        )
        return

    status = await update.message.reply_text(
        f"🚀 *Memulai analisa {len(matches)} match...*\n\n"
        f"_5 AI analysts sedang bekerja secara paralel..._",
        parse_mode="Markdown"
    )

    # Fire-and-forget: does not block the bot event loop
    asyncio.create_task(_run_prediction_task(update, matches, status))


async def show_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        await reject_non_admin(update)
        return

    db       = get_db()
    stats    = db.get_overall_stats()
    bt_stats = db.get_bet_type_stats()

    lines = [
        "📊 *STATISTIK PREDIKSI*",
        "━━━━━━━━━━━━━━━━━━━━━",
        "",
        f"📈 *Overall:*",
        f"   Total Prediksi: {stats['total_predictions']}",
        f"   Hasil Tercatat: {stats['results_recorded']}",
        f"   ✅ Wins: {stats['wins']}",
        f"   ❌ Losses: {stats['losses']}",
        f"   📊 Win Rate: {stats['win_rate']}%",
        f"   ⏳ Pending: {stats['pending']}",
        "",
        f"🎯 *By Bet Type:*",
    ]
    for bt in bt_stats:
        emoji = "✅" if bt['win_rate'] >= 50 else "⚠️"
        lines.append(
            f"   {emoji} {bt['bet_type']}: {bt['win_rate']}% "
            f"({bt['wins']}/{bt['total']})"
        )

    lines += ["", "💡 Gunakan `/report` untuk laporan lengkap"]
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def show_report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        await reject_non_admin(update)
        return
    report = get_learning_engine().get_performance_report()
    await update.message.reply_text(report, parse_mode="Markdown")


async def show_pending(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        await reject_non_admin(update)
        return

    db = get_db()
    with db._get_conn() as conn:
        rows = conn.execute("""
            SELECT p.match_name, p.predicted_pick, p.bet_type, p.created_at
            FROM predictions p
            LEFT JOIN match_results r ON p.id = r.prediction_id
            WHERE r.id IS NULL
            ORDER BY p.created_at DESC
            LIMIT 20
        """).fetchall()

    if not rows:
        await update.message.reply_text(
            "✅ *Semua prediksi sudah dievaluasi!*\n\nTidak ada match pending.",
            parse_mode="Markdown"
        )
        return

    lines = [
        "⏳ *MATCH PENDING (Belum Ada Hasil)*",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "Hasil akan di-update otomatis dari football-data API.",
        "",
    ]
    for row in rows:
        date = row['created_at'][:10] if row['created_at'] else "?"
        lines.append(
            f"• `{row['match_name']}`\n"
            f"  Prediksi: [{row['bet_type']}] {row['predicted_pick']}\n"
            f"  Tanggal: {date}"
        )

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    if not TELEGRAM_TOKEN or "YOUR_" in TELEGRAM_TOKEN:
        raise ValueError("Set TELEGRAM_TOKEN in config.py")
    if not ADMIN_CHAT_IDS:
        raise ValueError("Set ADMIN_CHAT_IDS list in config.py")

    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()

    app.add_handler(CommandHandler("start",   start))
    app.add_handler(CommandHandler("help",    start))
    app.add_handler(CommandHandler("stats",   show_stats))
    app.add_handler(CommandHandler("report",  show_report))
    app.add_handler(CommandHandler("pending", show_pending))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_matches))

    logger.info("🚀 Parlay Bot v6 running (admin-only, async)!")
    app.run_polling()


if __name__ == "__main__":
    main()
