"""
Data processor module for French Learning App.
Handles pure calculations, text transformations, and spaced repetition logic.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List

def calculate_srs_next_review(current_level: int, rating: str, base_intervals: List[int]) -> Dict[str, Any]:
    """
    Calculate next review timestamp based on Spaced Repetition (SRS).
    rating: 'again' (reset), 'hard' (level stay), 'good' (+1 level), 'easy' (+2 levels)
    """
    if rating == "again":
        new_level = 0
        days_ahead = 0.5  # review same day or next morning
    elif rating == "hard":
        new_level = max(0, current_level)
        days_ahead = base_intervals[min(new_level, len(base_intervals) - 1)] * 0.75
    elif rating == "good":
        new_level = min(current_level + 1, len(base_intervals) - 1)
        days_ahead = base_intervals[new_level]
    elif rating == "easy":
        new_level = min(current_level + 2, len(base_intervals) - 1)
        days_ahead = base_intervals[new_level] * 1.5
    else:
        new_level = current_level
        days_ahead = 1

    next_date = datetime.now() + timedelta(days=days_ahead)
    return {
        "level": new_level,
        "next_review": next_date.strftime("%Y-%m-%d"),
        "interval_days": round(days_ahead, 1),
        "last_reviewed": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

def update_user_stats(stats: Dict[str, Any], is_correct: bool) -> Dict[str, Any]:
    """Update global usage statistics."""
    total = stats.get("total_answered", 0) + 1
    correct = stats.get("correct_count", 0) + (1 if is_correct else 0)
    accuracy = round((correct / total) * 100, 1) if total > 0 else 0.0

    today_str = datetime.now().strftime("%Y-%m-%d")
    last_date = stats.get("last_active_date", today_str)

    # Streak calculation
    streak = stats.get("streak_days", 1)
    if last_date != today_str:
        try:
            last_dt = datetime.strptime(last_date, "%Y-%m-%d")
            diff = (datetime.now() - last_dt).days
            if diff == 1:
                streak += 1
            elif diff > 1:
                streak = 1
        except Exception:
            streak = 1

    return {
        "total_answered": total,
        "correct_count": correct,
        "accuracy_percent": accuracy,
        "streak_days": streak,
        "last_active_date": today_str
    }

def heuristic_text_analysis(text: str) -> Dict[str, Any]:
    """
    Offline heuristic analyzer for French essays when AI API is unavailable.
    Detects key 10th grade Gymnasium elements: connecteurs logiques, subjonctif hints.
    """
    cleaned = text.strip()
    words = cleaned.split()
    word_count = len(words)

    known_connectors = [
        "à mon avis", "tout d'abord", "en premier lieu", "de plus", "en outre",
        "cependant", "néanmoins", "en revanche", "par conséquent", "c'est pourquoi",
        "bien que", "pour conclure", "en conclusion", "d'une part", "d'autre part",
        "non seulement", "malgré"
    ]
    detected_connectors = [c for c in known_connectors if c in cleaned.lower()]

    subjonctif_markers = ["bien que", "il faut que", "pour que", "avant que", "exiger que"]
    detected_markers = [m for m in subjonctif_markers if m in cleaned.lower()]

    paragraphs = [p.strip() for p in cleaned.split("\n\n") if p.strip()]

    # Score estimation based on length, structure, connectors
    score = 8  # base
    if word_count >= 100: score += 2
    if word_count >= 130: score += 1
    if len(paragraphs) >= 3: score += 2
    if len(detected_connectors) >= 3: score += 2
    if len(detected_markers) >= 1: score += 1

    score = min(score, 15)

    return {
        "word_count": word_count,
        "paragraph_count": len(paragraphs),
        "detected_connectors": detected_connectors,
        "detected_subjonctif_markers": detected_markers,
        "estimated_score_15": score,
        "status": "offline_heuristic"
    }
