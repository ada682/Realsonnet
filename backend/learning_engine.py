# ── learning_engine.py ─────────────────────────────────────────────────────────
# Learning Engine - Analyzes historical predictions and extracts patterns
# to improve future predictions. Provides context to agents based on
# past successes and failures.
# ═══════════════════════════════════════════════════════════════════════════════

import json
import logging
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from database import get_db, LearningPattern, PredictionRecord, MatchResult

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# LEARNING CONTEXT
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class LearningContext:
    """Context provided to agents for learning"""
    overall_win_rate: float = 0.0
    bet_type_win_rates: Dict[str, float] = None
    agent_performance: Dict[str, float] = None
    relevant_patterns: List[Dict] = None
    similar_match_history: List[Dict] = None
    recent_losses_analysis: str = ""
    confidence_calibration: str = ""
    
    def __post_init__(self):
        if self.bet_type_win_rates is None:
            self.bet_type_win_rates = {}
        if self.agent_performance is None:
            self.agent_performance = {}
        if self.relevant_patterns is None:
            self.relevant_patterns = []
        if self.similar_match_history is None:
            self.similar_match_history = []
    
    def to_prompt_text(self) -> str:
        """Convert learning context to text for agent prompts"""
        lines = ["\n=== 📚 HISTORICAL LEARNING DATA ===\n"]
        
        # Overall performance
        lines.append(f"📊 Overall Win Rate: {self.overall_win_rate}%")
        lines.append(f"📈 Bet Type Performance:")
        for bt, rate in self.bet_type_win_rates.items():
            lines.append(f"   • {bt}: {rate}%")
        
        # Agent performance
        if self.agent_performance:
            lines.append(f"\n🤖 Agent Accuracy:")
            for agent, rate in self.agent_performance.items():
                lines.append(f"   • {agent}: {rate}%")
        
        # Relevant patterns
        if self.relevant_patterns:
            lines.append(f"\n💡 Key Patterns from Past:")
            for p in self.relevant_patterns[:5]:  # Top 5
                impact = "✅" if p.get('impact') == 'positive' else "❌"
                lines.append(f"   {impact} {p.get('description')} "
                           f"(Success: {p.get('success_rate', 0)}%)")
        
        # Similar match history
        if self.similar_match_history:
            lines.append(f"\n📋 Similar Past Matches:")
            for m in self.similar_match_history[:3]:  # Top 3
                outcome = "✅ WIN" if m.get('outcome') == 'win' else "❌ LOSS"
                lines.append(f"   • {m.get('match', 'Unknown')}: {outcome}")
                if m.get('lesson'):
                    lines.append(f"     Lesson: {m.get('lesson')}")
        
        # Recent losses analysis
        if self.recent_losses_analysis:
            lines.append(f"\n⚠️ Common Mistakes to Avoid:")
            lines.append(f"   {self.recent_losses_analysis}")
        
        # Confidence calibration
        if self.confidence_calibration:
            lines.append(f"\n🎯 Confidence Calibration:")
            lines.append(f"   {self.confidence_calibration}")
        
        lines.append("\n=== USE THIS DATA TO IMPROVE YOUR ANALYSIS ===\n")
        return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
# LEARNING ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class LearningEngine:
    """
    Analyzes historical data and extracts patterns for better predictions.
    Provides learning context to agents before they make predictions.
    """
    
    def __init__(self):
        self.db = get_db()
    
    def get_learning_context(self, match_name: str, bet_type: str = None) -> LearningContext:
        """
        Build learning context for a specific match.
        This is called before agents analyze a match.
        """
        context = LearningContext()
        
        # Get overall stats
        stats = self.db.get_overall_stats()
        context.overall_win_rate = stats.get('win_rate', 0)
        
        # Get bet type stats
        bt_stats = self.db.get_bet_type_stats()
        for bt in bt_stats:
            context.bet_type_win_rates[bt['bet_type']] = bt['win_rate']
        
        # Get agent performance
        agent_stats = self.db.get_agent_stats()
        for agent in agent_stats:
            key = f"{agent['agent_name']} ({agent['bet_type']})"
            context.agent_performance[key] = agent['accuracy']
        
        # Get relevant patterns
        patterns = self.db.get_patterns()
        context.relevant_patterns = [
            {
                'description': p.description,
                'context': p.context,
                'impact': p.impact,
                'success_rate': p.success_rate,
                'occurrence_count': p.occurrence_count
            }
            for p in patterns
        ]
        
        # Find similar matches
        context.similar_match_history = self._find_similar_matches(match_name)
        
        # Analyze recent losses
        context.recent_losses_analysis = self._analyze_recent_losses()
        
        # Calibrate confidence
        context.confidence_calibration = self._calibrate_confidence()
        
        return context
    
    def _find_similar_matches(self, match_name: str) -> List[Dict]:
        """Find historically similar matches and their outcomes"""
        # Extract team names from match
        teams = self._extract_teams(match_name)
        if not teams:
            return []
        
        similar = []
        db = get_db()
        
        with db._get_conn() as conn:
            # Search for matches with similar team names
            for team in teams:
                rows = conn.execute("""
                    SELECT 
                        p.match_name,
                        p.predicted_pick,
                        p.confidence,
                        r.outcome,
                        r.notes
                    FROM predictions p
                    JOIN match_results r ON p.id = r.prediction_id
                    WHERE p.match_name LIKE ?
                    ORDER BY p.created_at DESC
                    LIMIT 3
                """, (f"%{team}%",)).fetchall()
                
                for row in rows:
                    similar.append({
                        'match': row['match_name'],
                        'predicted': row['predicted_pick'],
                        'confidence': row['confidence'],
                        'outcome': row['outcome'],
                        'lesson': row['notes']
                    })
        
        return similar
    
    def _extract_teams(self, match_name: str) -> List[str]:
        """Extract team names from match string"""
        # Common patterns: "Team A vs Team B", "Team A v Team B", "Team A - Team B"
        patterns = [
            r'(.+?)\s+(?:vs?\.?|v\.?|–|-)\s+(.+)',
            r'(.+?)\s+VS\s+(.+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, match_name, re.IGNORECASE)
            if match:
                return [match.group(1).strip(), match.group(2).strip()]
        
        return []
    
    def _analyze_recent_losses(self) -> str:
        """Analyze recent losses to find common mistakes"""
        losses = self.db.get_recent_losses(limit=10)
        
        if not losses:
            return "No loss data available yet."
        
        # Analyze patterns in losses
        high_conf_losses = [l for l in losses if l.get('confidence', 0) > 70]
        
        insights = []
        
        if len(high_conf_losses) > len(losses) / 2:
            insights.append(f"{len(high_conf_losses)}/{len(losses)} recent losses had >70% confidence. "
                          "Be cautious with overconfident picks.")
        
        # Check for common factors in debate summaries
        debate_factors = []
        for loss in losses:
            summary = loss.get('debate_summary', '').lower()
            if 'injury' in summary or 'suspension' in summary:
                debate_factors.append('underestimated injury impact')
            if 'home' in summary and 'away' in summary:
                debate_factors.append('home/away form misjudgment')
            if 'xG' in summary or 'expected goals' in summary.lower():
                debate_factors.append('over-relied on xG data')
        
        if debate_factors:
            from collections import Counter
            common = Counter(debate_factors).most_common(2)
            insights.append(f"Common issues: {', '.join([f[0] for f in common])}")
        
        return " | ".join(insights) if insights else "Analyze each match independently."
    
    def _calibrate_confidence(self) -> str:
        """Provide confidence calibration advice based on history"""
        stats = self.db.get_overall_stats()
        
        if stats['results_recorded'] < 10:
            return "Not enough data for calibration yet."
        
        # Check if high confidence predictions are more accurate
        db = get_db()
        with db._get_conn() as conn:
            high_conf = conn.execute("""
                SELECT COUNT(*) as total,
                       SUM(CASE WHEN r.outcome = 'win' THEN 1 ELSE 0 END) as wins
                FROM predictions p
                JOIN match_results r ON p.id = r.prediction_id
                WHERE p.confidence >= 75
            """).fetchone()
            
            low_conf = conn.execute("""
                SELECT COUNT(*) as total,
                       SUM(CASE WHEN r.outcome = 'win' THEN 1 ELSE 0 END) as wins
                FROM predictions p
                JOIN match_results r ON p.id = r.prediction_id
                WHERE p.confidence < 60
            """).fetchone()
        
        insights = []
        
        if high_conf['total'] > 0:
            high_rate = high_conf['wins'] / high_conf['total'] * 100
            insights.append(f"High confidence (≥75%): {high_rate:.0f}% win rate ({high_conf['wins']}/{high_conf['total']})")
        
        if low_conf['total'] > 0:
            low_rate = low_conf['wins'] / low_conf['total'] * 100
            insights.append(f"Low confidence (<60%): {low_rate:.0f}% win rate ({low_conf['wins']}/{low_conf['total']})")
        
        return " | ".join(insights)
    
    def analyze_and_learn(self, prediction_id: int, actual_result: str, outcome: str):
        """
        Analyze a completed prediction and extract learning patterns.
        Called after match result is recorded.
        """
        pred = self.db.get_prediction(prediction_id)
        if not pred:
            logger.warning(f"Prediction {prediction_id} not found for learning")
            return
        
        # Extract patterns from this result
        self._extract_patterns(pred, actual_result, outcome)
        
        # Update pattern success rates
        self._update_pattern_rates()
        
        logger.info(f"🧠 Learning analysis complete for prediction #{prediction_id}")
    
    def _extract_patterns(self, pred: PredictionRecord, actual_result: str, outcome: str):
        """Extract patterns from a prediction result"""
        impact = 'positive' if outcome == 'win' else 'negative'
        
        # Pattern 1: Bet type performance
        self.db.save_pattern(LearningPattern(
            pattern_type='bet_type',
            description=f"{pred.bet_type} predictions",
            context=f"When betting {pred.bet_type}",
            impact=impact,
            success_rate=100.0 if outcome == 'win' else 0.0,
            occurrence_count=1
        ))
        
        # Pattern 2: Confidence level
        conf_range = f"{pred.confidence // 10 * 10}-{(pred.confidence // 10 + 1) * 10}%"
        self.db.save_pattern(LearningPattern(
            pattern_type='confidence',
            description=f"{conf_range} confidence level",
            context=f"When confidence is {conf_range}",
            impact=impact,
            success_rate=100.0 if outcome == 'win' else 0.0,
            occurrence_count=1
        ))
        
        # Pattern 3: Debate consensus strength
        if pred.consensus_votes:
            try:
                votes, total = pred.consensus_votes.split('/')
                consensus_pct = int(votes) / int(total)
                if consensus_pct >= 0.8:
                    consensus_desc = "Strong consensus (≥80%)"
                elif consensus_pct >= 0.6:
                    consensus_desc = "Moderate consensus (60-80%)"
                else:
                    consensus_desc = "Weak consensus (<60%)"
                
                self.db.save_pattern(LearningPattern(
                    pattern_type='consensus',
                    description=consensus_desc,
                    context=f"When {consensus_desc}",
                    impact=impact,
                    success_rate=100.0 if outcome == 'win' else 0.0,
                    occurrence_count=1
                ))
            except:
                pass
        
        # Pattern 4: Agent-specific patterns
        for agent in pred.agents_data.get('agents', []):
            agent_name = agent.get('name', 'Unknown')
            agent_pick = agent.get('pick', '')
            agent_conf = agent.get('confidence', 50)
            
            # Check if agent was correct
            agent_correct = outcome == 'win'  # Simplified
            
            self.db.save_pattern(LearningPattern(
                pattern_type='agent',
                description=f"{agent_name} predictions",
                context=f"When {agent_name} makes picks",
                impact='positive' if agent_correct else 'negative',
                success_rate=100.0 if agent_correct else 0.0,
                occurrence_count=1
            ))
    
    def _update_pattern_rates(self):
        """Recalculate success rates for all patterns"""
        db = get_db()
        with db._get_conn() as conn:
            patterns = conn.execute("SELECT * FROM learning_patterns").fetchall()
            
            for pattern in patterns:
                # Get related predictions
                # This is simplified - in practice you'd track which predictions
                # contributed to each pattern
                pass
    
    def get_performance_report(self) -> str:
        """Generate a performance report"""
        stats = self.db.get_overall_stats()
        bt_stats = self.db.get_bet_type_stats()
        agent_stats = self.db.get_agent_stats()
        
        lines = [
            "📊 *PERFORMANCE REPORT*",
            f"━━━━━━━━━━━━━━━━━━━━━",
            f"",
            f"📈 Overall Statistics:",
            f"   Total Predictions: {stats['total_predictions']}",
            f"   Results Recorded: {stats['results_recorded']}",
            f"   Wins: {stats['wins']} ✅",
            f"   Losses: {stats['losses']} ❌",
            f"   Win Rate: {stats['win_rate']}%",
            f"   Pending: {stats['pending']}",
            f"",
            f"🎯 By Bet Type:",
        ]
        
        for bt in bt_stats:
            lines.append(f"   {bt['bet_type']}: {bt['win_rate']}% ({bt['wins']}/{bt['total']})")
        
        lines.append("")
        lines.append("🤖 Agent Performance:")
        
        for agent in agent_stats[:10]:  # Top 10
            lines.append(f"   {agent['agent_name']} ({agent['bet_type']}): "
                        f"{agent['accuracy']}% ({agent['correct']}/{agent['total']})")
        
        lines.append("")
        lines.append("💡 Top Patterns:")
        
        patterns = self.db.get_patterns()
        for p in patterns[:5]:
            emoji = "✅" if p.impact == 'positive' else "❌"
            lines.append(f"   {emoji} {p.description}: {p.success_rate:.0f}% "
                        f"({p.occurrence_count} cases)")
        
        return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
# GLOBAL INSTANCE
# ═══════════════════════════════════════════════════════════════════════════════

_learning_engine: Optional[LearningEngine] = None


def get_learning_engine() -> LearningEngine:
    """Get singleton learning engine instance"""
    global _learning_engine
    if _learning_engine is None:
        _learning_engine = LearningEngine()
    return _learning_engine
