"""
Quiz Manager module for French Learning App.
Handles storage, retrieval, and updating of all JSON data resources.
"""

import os
import json
from typing import Dict, Any, List, Optional
from modules.processor import calculate_srs_next_review, update_user_stats

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

def _load_json(filename: str, default: Any) -> Any:
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        return default
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def _save_json(filename: str, data: Any) -> bool:
    filepath = os.path.join(DATA_DIR, filename)
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving {filename}: {e}")
        return False

# Public accessors
def get_config() -> Dict[str, Any]:
    return _load_json("config.json", {})

def update_config(updates: Dict[str, Any]) -> Dict[str, Any]:
    cfg = get_config()
    cfg.update(updates)
    _save_json("config.json", cfg)
    return cfg

def get_vocabulary() -> Dict[str, Any]:
    return _load_json("vocabulary_decouvertes.json", {"units": []})

def get_grammar_exercises() -> Dict[str, Any]:
    return _load_json("grammar_exercises.json", {"categories": [], "questions": []})

def get_exam_simulations() -> Dict[str, Any]:
    return _load_json("exam_simulations.json", {"exams": []})

def get_writing_templates() -> Dict[str, Any]:
    return _load_json("writing_templates.json", {})

def get_user_progress() -> Dict[str, Any]:
    return _load_json("user_progress.json", {
        "stats": {"total_answered": 0, "correct_count": 0, "accuracy_percent": 0, "streak_days": 1},
        "wrong_notebook": [],
        "srs_cards": {},
        "exam_history": []
    })

def save_user_progress(progress: Dict[str, Any]) -> bool:
    return _save_json("user_progress.json", progress)

def get_custom_quizzes() -> Dict[str, Any]:
    return _load_json("user_custom_quizzes.json", {"custom_quizzes": []})

def add_custom_quiz_group(group: Dict[str, Any]) -> bool:
    custom = get_custom_quizzes()
    custom.setdefault("custom_quizzes", []).append(group)
    return _save_json("user_custom_quizzes.json", custom)

def record_answer_result(question_id: str, is_correct: bool, question_obj: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Update user stats and Wrong Notebook (Carnet d'erreurs)."""
    progress = get_user_progress()
    stats = update_user_stats(progress.get("stats", {}), is_correct)
    progress["stats"] = stats

    wrong_list = progress.get("wrong_notebook", [])

    if not is_correct and question_obj:
        # Check if already in wrong list
        existing = next((w for w in wrong_list if w.get("id") == question_id), None)
        if not existing:
            wrong_list.append({
                "id": question_id,
                "question": question_obj,
                "wrong_count": 1
            })
        else:
            existing["wrong_count"] = existing.get("wrong_count", 1) + 1
    elif is_correct:
        # If answered correctly in review, decrement or remove
        existing = next((w for w in wrong_list if w.get("id") == question_id), None)
        if existing:
            if existing.get("wrong_count", 1) <= 1:
                wrong_list = [w for w in wrong_list if w.get("id") != question_id]
            else:
                existing["wrong_count"] -= 1

    progress["wrong_notebook"] = wrong_list
    save_user_progress(progress)
    return {"stats": stats, "wrong_count": len(wrong_list)}

def record_srs_rating(word_id: str, rating: str) -> Dict[str, Any]:
    """Record spaced repetition rating for vocabulary."""
    cfg = get_config()
    intervals = cfg.get("srs_intervals_days", [1, 2, 4, 7, 15, 30])
    progress = get_user_progress()
    cards = progress.get("srs_cards", {})

    current_level = cards.get(word_id, {}).get("level", 0)
    card_info = calculate_srs_next_review(current_level, rating, intervals)
    cards[word_id] = card_info

    progress["srs_cards"] = cards
    save_user_progress(progress)
    return card_info

def record_exam_result(exam_id: str, total_score: float, max_score: float, breakdown: Dict[str, Any]) -> Dict[str, Any]:
    """Save completed exam simulation result."""
    progress = get_user_progress()
    history = progress.get("exam_history", [])
    from datetime import datetime
    record = {
        "exam_id": exam_id,
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "total_score": total_score,
        "max_score": max_score,
        "percentage": round((total_score / max_score) * 100, 1) if max_score > 0 else 0,
        "breakdown": breakdown
    }
    history.append(record)
    progress["exam_history"] = history
    save_user_progress(progress)
    return record
