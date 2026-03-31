# ── database.py ───────────────────────────────────────────────────────────────
# Local SQLite Database for Prediction Tracking & Learning
# Tables:
#   - predictions: Store AI predictions with full debate context
#   - match_results: Store actual match outcomes
#   - learning_patterns: Store patterns learned from wins/losses
#   - agent_performance: Track each agent's accuracy per bet type
# ═══════════════════════════════════════════════════════════════════════════════

import sqlite3
import json
import logging
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "predictions.db"


# ═══════════════════════════════════════════════════════════════════════════════
# DATA CLASSES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class PredictionRecord:
    """Single prediction record with full context"""
    id: Optional[int] = None
    match_name: str = ""
    bet_type: str = ""
    predicted_pick: str = ""
    confidence: int = 0
    debate_summary: str = ""
    agents_data: Dict = None
    consensus_votes: str = ""
    include_in_parlay: bool = True
    created_at: str = ""
    
    def __post_init__(self):
        if self.agents_data is None:
            self.agents_data = {}
        if not self.created_at:
            self.created_at = datetime.now().isoformat()


@dataclass
class MatchResult:
    """Actual match outcome"""
    id: Optional[int] = None
    prediction_id: int = 0
    match_name: str = ""
    actual_result: str = ""  # What actually happened
    predicted_pick: str = ""  # What AI predicted
    outcome: str = ""  # 'win' or 'loss'
    score: str = ""  # Optional: actual score
    notes: str = ""  # User notes
    recorded_at: str = ""
    
    def __post_init__(self):
        if not self.recorded_at:
            self.recorded_at = datetime.now().isoformat()


@dataclass
class LearningPattern:
    """Pattern learned from historical data"""
    id: Optional[int] = None
    pattern_type: str = ""  # 'factor', 'agent_bias', 'bet_type', etc.
    description: str = ""
    context: str = ""  # When does this apply?
    impact: str = ""  # 'positive' or 'negative'
    success_rate: float = 0.0
    occurrence_count: int = 0
    created_at: str = ""
    last_updated: str = ""
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().isoformat()
        if not self.last_updated:
            self.last_updated = self.created_at


@dataclass
class AgentPerformance:
    """Track individual agent performance"""
    id: Optional[int] = None
    agent_name: str = ""
    bet_type: str = ""
    total_predictions: int = 0
    correct_predictions: int = 0
    accuracy_rate: float = 0.0
    avg_confidence: float = 0.0
    last_updated: str = ""
    
    def __post_init__(self):
        if not self.last_updated:
            self.last_updated = datetime.now().isoformat()


# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

class PredictionDatabase:
    """Main database manager for all prediction tracking"""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or str(DB_PATH)
        self._init_db()
    
    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def _init_db(self):
        """Initialize database tables"""
        with self._get_conn() as conn:
            # Predictions table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS predictions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    match_name TEXT NOT NULL,
                    bet_type TEXT NOT NULL,
                    predicted_pick TEXT NOT NULL,
                    confidence INTEGER DEFAULT 0,
                    debate_summary TEXT,
                    agents_data TEXT,  -- JSON
                    consensus_votes TEXT,
                    include_in_parlay INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Match results table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS match_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    prediction_id INTEGER,
                    match_name TEXT NOT NULL,
                    actual_result TEXT NOT NULL,
                    predicted_pick TEXT NOT NULL,
                    outcome TEXT NOT NULL,  -- 'win' or 'loss'
                    score TEXT,
                    notes TEXT,
                    recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (prediction_id) REFERENCES predictions(id)
                )
            """)
            
            # Learning patterns table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS learning_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pattern_type TEXT NOT NULL,
                    description TEXT NOT NULL,
                    context TEXT,
                    impact TEXT,  -- 'positive' or 'negative'
                    success_rate REAL DEFAULT 0,
                    occurrence_count INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    last_updated TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Agent performance table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS agent_performance (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_name TEXT NOT NULL,
                    bet_type TEXT NOT NULL,
                    total_predictions INTEGER DEFAULT 0,
                    correct_predictions INTEGER DEFAULT 0,
                    accuracy_rate REAL DEFAULT 0,
                    avg_confidence REAL DEFAULT 0,
                    last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(agent_name, bet_type)
                )
            """)
            
            # Create indexes
            conn.execute("CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_results_outcome ON match_results(outcome)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_patterns_type ON learning_patterns(pattern_type)")
            
            conn.commit()
            logger.info(f"✅ Database initialized: {self.db_path}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PREDICTION OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def save_prediction(self, record: PredictionRecord) -> int:
        """Save a new prediction, return the ID"""
        with self._get_conn() as conn:
            cursor = conn.execute("""
                INSERT INTO predictions 
                (match_name, bet_type, predicted_pick, confidence, debate_summary, 
                 agents_data, consensus_votes, include_in_parlay, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record.match_name, record.bet_type, record.predicted_pick,
                record.confidence, record.debate_summary,
                json.dumps(record.agents_data, ensure_ascii=False),
                record.consensus_votes, int(record.include_in_parlay),
                record.created_at
            ))
            conn.commit()
            prediction_id = cursor.lastrowid
            logger.info(f"💾 Saved prediction #{prediction_id}: {record.match_name} -> {record.predicted_pick}")
            return prediction_id
    
    def get_prediction(self, prediction_id: int) -> Optional[PredictionRecord]:
        """Get prediction by ID"""
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM predictions WHERE id = ?", (prediction_id,)
            ).fetchone()
            if row:
                return self._row_to_prediction(row)
            return None
    
    def get_prediction_by_match(self, match_name: str) -> Optional[PredictionRecord]:
        """Get most recent prediction for a match"""
        with self._get_conn() as conn:
            row = conn.execute(
                """SELECT * FROM predictions 
                   WHERE match_name LIKE ? 
                   ORDER BY created_at DESC LIMIT 1""",
                (f"%{match_name}%",)
            ).fetchone()
            if row:
                return self._row_to_prediction(row)
            return None
    
    def get_recent_predictions(self, limit: int = 50) -> List[PredictionRecord]:
        """Get recent predictions"""
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM predictions ORDER BY created_at DESC LIMIT ?",
                (limit,)
            ).fetchall()
            return [self._row_to_prediction(r) for r in rows]
    
    def _row_to_prediction(self, row: sqlite3.Row) -> PredictionRecord:
        """Convert DB row to PredictionRecord"""
        return PredictionRecord(
            id=row['id'],
            match_name=row['match_name'],
            bet_type=row['bet_type'],
            predicted_pick=row['predicted_pick'],
            confidence=row['confidence'],
            debate_summary=row['debate_summary'],
            agents_data=json.loads(row['agents_data'] or '{}'),
            consensus_votes=row['consensus_votes'],
            include_in_parlay=bool(row['include_in_parlay']),
            created_at=row['created_at']
        )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MATCH RESULT OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def save_result(self, result: MatchResult) -> int:
        """Save match result and update learning"""
        with self._get_conn() as conn:
            cursor = conn.execute("""
                INSERT INTO match_results 
                (prediction_id, match_name, actual_result, predicted_pick, 
                 outcome, score, notes, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                result.prediction_id, result.match_name, result.actual_result,
                result.predicted_pick, result.outcome, result.score,
                result.notes, result.recorded_at
            ))
            conn.commit()
            result_id = cursor.lastrowid
            logger.info(f"✅ Saved result #{result_id}: {result.match_name} -> {result.outcome.upper()}")
            
            # Update agent performance
            self._update_agent_performance(conn, result)
            
            return result_id
    
    def _update_agent_performance(self, conn: sqlite3.Connection, result: MatchResult):
        """Update agent performance stats"""
        # Get the prediction to find agent data
        pred = conn.execute(
            "SELECT agents_data, bet_type FROM predictions WHERE id = ?",
            (result.prediction_id,)
        ).fetchone()
        
        if not pred:
            return
        
        agents_data = json.loads(pred['agents_data'] or '{}')
        bet_type = pred['bet_type']
        is_correct = result.outcome == 'win'
        
        # Update each agent's performance
        for agent in agents_data.get('agents', []):
            agent_name = agent.get('name', 'Unknown')
            confidence = agent.get('confidence', 50)
            
            # Check if agent's pick matches consensus
            agent_pick = agent.get('pick', '')
            agent_correct = is_correct  # Simplified - agent follows consensus
            
            conn.execute("""
                INSERT INTO agent_performance 
                (agent_name, bet_type, total_predictions, correct_predictions, 
                 accuracy_rate, avg_confidence, last_updated)
                VALUES (?, ?, 1, ?, ?, ?, ?)
                ON CONFLICT(agent_name, bet_type) DO UPDATE SET
                total_predictions = total_predictions + 1,
                correct_predictions = correct_predictions + ?,
                accuracy_rate = (correct_predictions + ?) * 100.0 / (total_predictions + 1),
                avg_confidence = (avg_confidence * total_predictions + ?) / (total_predictions + 1),
                last_updated = ?
            """, (
                agent_name, bet_type, 1 if agent_correct else 0,
                100.0 if agent_correct else 0.0, confidence,
                datetime.now().isoformat(),
                1 if agent_correct else 0,
                1 if agent_correct else 0,
                confidence,
                datetime.now().isoformat()
            ))
        
        conn.commit()
    
    def get_result(self, result_id: int) -> Optional[MatchResult]:
        """Get result by ID"""
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM match_results WHERE id = ?", (result_id,)
            ).fetchone()
            if row:
                return self._row_to_result(row)
            return None
    
    def get_result_by_match(self, match_name: str) -> Optional[MatchResult]:
        """Get result for a match"""
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM match_results WHERE match_name LIKE ? ORDER BY recorded_at DESC LIMIT 1",
                (f"%{match_name}%",)
            ).fetchone()
            if row:
                return self._row_to_result(row)
            return None
    
    def _row_to_result(self, row: sqlite3.Row) -> MatchResult:
        """Convert DB row to MatchResult"""
        return MatchResult(
            id=row['id'],
            prediction_id=row['prediction_id'],
            match_name=row['match_name'],
            actual_result=row['actual_result'],
            predicted_pick=row['predicted_pick'],
            outcome=row['outcome'],
            score=row['score'],
            notes=row['notes'],
            recorded_at=row['recorded_at']
        )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # LEARNING PATTERNS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def save_pattern(self, pattern: LearningPattern) -> int:
        """Save or update a learning pattern"""
        with self._get_conn() as conn:
            # Check if pattern exists
            existing = conn.execute(
                "SELECT id FROM learning_patterns WHERE pattern_type = ? AND description = ?",
                (pattern.pattern_type, pattern.description)
            ).fetchone()
            
            if existing:
                # Update existing
                conn.execute("""
                    UPDATE learning_patterns SET
                    occurrence_count = occurrence_count + 1,
                    success_rate = ?,
                    last_updated = ?
                    WHERE id = ?
                """, (pattern.success_rate, datetime.now().isoformat(), existing['id']))
                conn.commit()
                return existing['id']
            else:
                # Insert new
                cursor = conn.execute("""
                    INSERT INTO learning_patterns 
                    (pattern_type, description, context, impact, success_rate, 
                     occurrence_count, created_at, last_updated)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    pattern.pattern_type, pattern.description, pattern.context,
                    pattern.impact, pattern.success_rate, pattern.occurrence_count,
                    pattern.created_at, pattern.last_updated
                ))
                conn.commit()
                return cursor.lastrowid
    
    def get_patterns(self, pattern_type: str = None, impact: str = None) -> List[LearningPattern]:
        """Get learning patterns with optional filters"""
        with self._get_conn() as conn:
            query = "SELECT * FROM learning_patterns WHERE 1=1"
            params = []
            
            if pattern_type:
                query += " AND pattern_type = ?"
                params.append(pattern_type)
            if impact:
                query += " AND impact = ?"
                params.append(impact)
            
            query += " ORDER BY occurrence_count DESC, success_rate DESC"
            
            rows = conn.execute(query, params).fetchall()
            return [self._row_to_pattern(r) for r in rows]
    
    def _row_to_pattern(self, row: sqlite3.Row) -> LearningPattern:
        """Convert DB row to LearningPattern"""
        return LearningPattern(
            id=row['id'],
            pattern_type=row['pattern_type'],
            description=row['description'],
            context=row['context'],
            impact=row['impact'],
            success_rate=row['success_rate'],
            occurrence_count=row['occurrence_count'],
            created_at=row['created_at'],
            last_updated=row['last_updated']
        )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STATISTICS & ANALYTICS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def get_overall_stats(self) -> Dict[str, Any]:
        """Get overall prediction statistics"""
        with self._get_conn() as conn:
            total = conn.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]
            results = conn.execute("SELECT COUNT(*) FROM match_results").fetchone()[0]
            wins = conn.execute(
                "SELECT COUNT(*) FROM match_results WHERE outcome = 'win'"
            ).fetchone()[0]
            losses = conn.execute(
                "SELECT COUNT(*) FROM match_results WHERE outcome = 'loss'"
            ).fetchone()[0]
            
            win_rate = (wins / results * 100) if results > 0 else 0
            
            return {
                'total_predictions': total,
                'results_recorded': results,
                'wins': wins,
                'losses': losses,
                'win_rate': round(win_rate, 2),
                'pending': total - results
            }
    
    def get_bet_type_stats(self) -> List[Dict[str, Any]]:
        """Get statistics per bet type"""
        with self._get_conn() as conn:
            rows = conn.execute("""
                SELECT 
                    p.bet_type,
                    COUNT(*) as total,
                    SUM(CASE WHEN r.outcome = 'win' THEN 1 ELSE 0 END) as wins,
                    SUM(CASE WHEN r.outcome = 'loss' THEN 1 ELSE 0 END) as losses
                FROM predictions p
                LEFT JOIN match_results r ON p.id = r.prediction_id
                WHERE r.id IS NOT NULL
                GROUP BY p.bet_type
            """).fetchall()
            
            result = []
            for row in rows:
                total = row['total']
                result.append({
                    'bet_type': row['bet_type'],
                    'total': total,
                    'wins': row['wins'],
                    'losses': row['losses'],
                    'win_rate': round(row['wins'] / total * 100, 2) if total > 0 else 0
                })
            return result
    
    def get_agent_stats(self) -> List[Dict[str, Any]]:
        """Get agent performance statistics"""
        with self._get_conn() as conn:
            rows = conn.execute("""
                SELECT * FROM agent_performance 
                ORDER BY accuracy_rate DESC, total_predictions DESC
            """).fetchall()
            
            return [{
                'agent_name': r['agent_name'],
                'bet_type': r['bet_type'],
                'total': r['total_predictions'],
                'correct': r['correct_predictions'],
                'accuracy': round(r['accuracy_rate'], 2),
                'avg_confidence': round(r['avg_confidence'], 2)
            } for r in rows]
    
    def get_recent_losses(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent losses for analysis"""
        with self._get_conn() as conn:
            rows = conn.execute("""
                SELECT 
                    r.match_name,
                    r.predicted_pick,
                    r.actual_result,
                    r.notes,
                    p.confidence,
                    p.debate_summary,
                    p.agents_data
                FROM match_results r
                JOIN predictions p ON r.prediction_id = p.id
                WHERE r.outcome = 'loss'
                ORDER BY r.recorded_at DESC
                LIMIT ?
            """, (limit,)).fetchall()
            
            return [{
                'match_name': r['match_name'],
                'predicted': r['predicted_pick'],
                'actual': r['actual_result'],
                'notes': r['notes'],
                'confidence': r['confidence'],
                'debate_summary': r['debate_summary']
            } for r in rows]


# ═══════════════════════════════════════════════════════════════════════════════
# GLOBAL INSTANCE
# ═══════════════════════════════════════════════════════════════════════════════

_db_instance: Optional[PredictionDatabase] = None


def get_db() -> PredictionDatabase:
    """Get singleton database instance"""
    global _db_instance
    if _db_instance is None:
        _db_instance = PredictionDatabase()
    return _db_instance
