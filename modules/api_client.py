"""
API Client module for AI-assisted French learning.
Communicates with Google Gemini via google.genai SDK or fallback HTTPS requests.
"""

import os
import json
from typing import Dict, Any, Optional
from modules.processor import heuristic_text_analysis

def get_effective_api_key(provided_key: Optional[str] = None) -> str:
    """Resolve API key from parameter or environment."""
    if provided_key and provided_key.strip():
        return provided_key.strip()
    return os.environ.get("GEMINI_API_KEY", "").strip()

def evaluate_essay_with_ai(prompt: str, essay: str, api_key: str = "", model_name: str = "gemini-2.5-flash") -> Dict[str, Any]:
    """
    Evaluate student's essay using Gemini or heuristic fallback.
    Gymnasium 10th grade criteria (15 points maximum, B1 standard).
    """
    key = get_effective_api_key(api_key)
    if not key:
        heuristic = heuristic_text_analysis(essay)
        return {
            "mode": "offline",
            "score": heuristic["estimated_score_15"],
            "max_score": 15,
            "word_count": heuristic["word_count"],
            "feedback": (
                f"Modus: Lokale Heuristik (Kein Gemini API-Schlüssel eingegeben).\n"
                f"Wortanzahl: {heuristic['word_count']} Wörter. "
                f"Absätze: {heuristic['paragraph_count']}.\n"
                f"Gefundene Konnektoren ({len(heuristic['detected_connectors'])}): {', '.join(heuristic['detected_connectors']) or 'Keine'}.\n"
                f"Tipp für 10. Klasse: Verwende gezielt 'Bien que + Subjonctif' und strukturiere nach dem PEE-Prinzip."
            ),
            "suggestions": [
                "Achte auf die Übereinstimmung des Participe Passé mit avoir/être.",
                "Ersetze einfache Bindewörter wie 'et' / 'mais' durch 'en outre' oder 'néanmoins'.",
                "Füge im Hauptteil konkrete Beispiele ein (z.B. 'Par exemple...')."
            ],
            "upgraded_sample": "Bien que ce soit un sujet complexe, il est essentiel de considérer les deux points de vue avec nuance."
        }

    try:
        from google import genai
        client = genai.Client(api_key=key)
        
        system_instruction = (
            "Du bist ein erfahrener Französischlehrer an einem deutschen Gymnasium für die 10. Klasse (Niveau B1/B1+). "
            "Bewerte den folgenden Schüleraufsatz nach den Kriterien: Inhalt & Struktur (PEE-Prinzip), Grammatik & Tempus (insb. Subjonctif, Conditionnel, Participe), "
            "Wortschatz & Konnektoren (Connecteurs logiques). "
            "Gib deine Antwort als valides JSON zurück mit folgenden Feldern:\n"
            "score (Zahl von 0 bis 15 Punkten),\n"
            "word_count (Zahl),\n"
            "feedback (detaillierte konstruktive Rückmeldung auf Deutsch),\n"
            "grammar_corrections (Liste von konkreten Fehlern im Text mit Korrekturvorschlag),\n"
            "upgraded_sentences (Liste von Beispielsätzen, wie der Schüler seine Sätze auf B1+/B2-Niveau aufwerten kann),\n"
            "connectors_used (Liste der erkannten Konnektoren)."
        )

        user_content = f"Thema / Aufgabenstellung:\n{prompt}\n\nAufsatz des Schülers:\n{essay}"
        
        response = client.models.generate_content(
            model=model_name,
            contents=[system_instruction, user_content],
            config={
                "response_mime_type": "application/json"
            }
        )

        result_text = response.text.strip()
        data = json.loads(result_text)
        data["mode"] = "ai"
        data["max_score"] = 15
        return data

    except Exception as e:
        heuristic = heuristic_text_analysis(essay)
        return {
            "mode": "offline_fallback",
            "score": heuristic["estimated_score_15"],
            "max_score": 15,
            "word_count": heuristic["word_count"],
            "feedback": f"AI-Aufruf fehlgeschlagen ({str(e)[:80]}). Lokale Heuristik angewendet.",
            "suggestions": [
                "Überprüfe deinen Text auf den Einsatz von mindestens 3 Konnektoren.",
                "Nutze das Conditionnel oder den Subjonctif für eine höhere Grammatiknote."
            ]
        }

def generate_quiz_from_notes(lecture_text: str, api_key: str = "", model_name: str = "gemini-2.5-flash") -> Dict[str, Any]:
    """
    Generate multiple-choice & fill-in-the-blank questions from school lecture notes.
    """
    key = get_effective_api_key(api_key)
    if not key:
        return {
            "success": False,
            "error": "Bitte hinterlege in den Einstellungen einen Gemini API-Key, um aus Notizen automatische Übungen zu generieren."
        }

    try:
        from google import genai
        client = genai.Client(api_key=key)

        prompt = (
            "Du bist ein Didaktik-Experte für Gymnasialfranzösisch (10. Klasse, Niveau B1). "
            "Erstelle aus den folgenden Unterrichtsnotizen / Vokabeln / Grammatikthemen 4 bis 6 anspruchsvolle Multiple-Choice-Übungsfragen. "
            "Fokussiere auf typische Fallstricke (Subjonctif, Si-Sätze, Pronomen y/en, Kollokationen). "
            "Antworte AUSSCHLIESSLICH im JSON-Format mit dieser Struktur:\n"
            "{\n"
            "  'quiz_title': 'Titel der Übungsgruppe',\n"
            "  'questions': [\n"
            "     {\n"
            "        'id': 'custom_1',\n"
            "        'prompt': 'Frage oder Lückensatz auf Französisch',\n"
            "        'options': ['Option A', 'Option B', 'Option C', 'Option D'],\n"
            "        'answer': 0, // Index 0 bis 3 der richtigen Antwort\n"
            "        'explanation_de': 'Erklärung auf Deutsch',\n"
            "        'explanation_zh': 'Erklärung auf Chinesisch',\n"
            "        'rule_tip': 'Kurze Merkhilfe'\n"
            "     }\n"
            "  ]\n"
            "}\n\n"
            f"Unterrichtstext / Notizen:\n{lecture_text}"
        )

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )

        parsed = json.loads(response.text.strip())
        parsed["success"] = True
        return parsed

    except Exception as e:
        return {
            "success": False,
            "error": f"Fehler bei der KI-Generierung: {str(e)}"
        }

def ask_ai_tutor(question: str, context: str = "", api_key: str = "", model_name: str = "gemini-2.5-flash") -> Dict[str, Any]:
    """
    Ask the AI French Tutor for grammar help or sentence analysis.
    """
    key = get_effective_api_key(api_key)
    if not key:
        return {
            "success": True,
            "reply": "💡 Lokaler Tipp: Im 10. Gymnasiumsjahrgang sind vor allem die Auslöser für den Subjonctif (Gefühl, Wille, Zweifel, 'bien que') sowie Si-Sätze Typ 1-3 prüfungsentscheidend. Gib in den Einstellungen einen Gemini API-Key ein, um mit dem interaktiven KI-Tutor live zu chatten!"
        }

    try:
        from google import genai
        client = genai.Client(api_key=key)

        system = (
            "Du bist ein hilfsbereiter, ermutigender Französisch-Tutor für einen Schüler der 10. Gymnasialklasse. "
            "Erkläre Grammatikregeln einfach, präzise und mit klaren Beispielen. "
            "Antworte primär auf Deutsch, ergänze bei grammatischen Kernbegriffen auch französische und chinesische Erläuterungen."
        )

        full_prompt = f"Frage des Schülers: {question}\nKontext/Aufgabe: {context}"
        response = client.models.generate_content(
            model=model_name,
            contents=[system, full_prompt]
        )

        return {
            "success": True,
            "reply": response.text.strip()
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Tutor-Anfrage fehlgeschlagen: {str(e)}"
        }
