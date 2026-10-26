#!/usr/bin/env python3
"""
Server module for French Learning App.
Serves static assets and provides REST API routes.
"""

import os
import sys
import json
import mimetypes
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from modules.quiz_manager import (
    get_config, update_config, get_vocabulary, get_grammar_exercises,
    get_exam_simulations, get_writing_templates, get_user_progress,
    record_answer_result, record_srs_rating, record_exam_result,
    get_custom_quizzes, add_custom_quiz_group
)
from modules.api_client import evaluate_essay_with_ai, generate_quiz_from_notes, ask_ai_tutor

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class AppRequestHandler(BaseHTTPRequestHandler):
    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_file(self, filepath, content_type=None):
        if not os.path.exists(filepath):
            self.send_error(404, f"File not found: {filepath}")
            return
        if not content_type:
            content_type, _ = mimetypes.guess_type(filepath)
            content_type = content_type or 'application/octet-stream'

        try:
            with open(filepath, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {e}")

    def _read_json_body(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length == 0:
                return {}
            raw = self.rfile.read(length).decode('utf-8')
            return json.loads(raw)
        except Exception:
            return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Static assets
        if path == '/' or path == '/index.html':
            target_html = os.path.join(BASE_DIR, 'index.html')
            if not os.path.exists(target_html):
                target_html = os.path.join(BASE_DIR, 'templates', 'index.html')
            self._serve_file(target_html, 'text/html; charset=utf-8')
            return
        elif path.startswith('/static/'):
            relative_path = path[len('/static/'):]
            full_path = os.path.join(BASE_DIR, 'static', relative_path)
            self._serve_file(full_path)
            return
        elif path.startswith('/data/'):
            relative_path = path[len('/data/'):]
            full_path = os.path.join(BASE_DIR, 'data', relative_path)
            self._serve_file(full_path)
            return

        # API routes
        if path == '/api/config':
            self._send_json(get_config())
        elif path == '/api/vocabulary':
            self._send_json(get_vocabulary())
        elif path == '/api/grammar':
            self._send_json(get_grammar_exercises())
        elif path == '/api/exams':
            self._send_json(get_exam_simulations())
        elif path == '/api/writing':
            self._send_json(get_writing_templates())
        elif path == '/api/progress':
            self._send_json(get_user_progress())
        elif path == '/api/custom_quizzes':
            self._send_json(get_custom_quizzes())
        else:
            self.send_error(404, "API endpoint not found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()
        cfg = get_config()
        api_key = cfg.get("gemini_api_key", "")

        if path == '/api/config':
            saved = update_config(body)
            self._send_json(saved)

        elif path == '/api/answer':
            q_id = body.get('question_id', '')
            is_correct = body.get('is_correct', False)
            q_obj = body.get('question_obj')
            res = record_answer_result(q_id, is_correct, q_obj)
            self._send_json(res)

        elif path == '/api/srs_rate':
            w_id = body.get('word_id', '')
            rating = body.get('rating', 'good')
            res = record_srs_rating(w_id, rating)
            self._send_json(res)

        elif path == '/api/exam_submit':
            e_id = body.get('exam_id', '')
            total = body.get('total_score', 0)
            max_s = body.get('max_score', 50)
            breakdown = body.get('breakdown', {})
            res = record_exam_result(e_id, total, max_s, breakdown)
            self._send_json(res)

        elif path == '/api/evaluate_essay':
            prompt = body.get('prompt', '')
            essay = body.get('essay', '')
            res = evaluate_essay_with_ai(prompt, essay, api_key=api_key)
            self._send_json(res)

        elif path == '/api/generate_quiz':
            notes = body.get('lecture_text', '')
            res = generate_quiz_from_notes(notes, api_key=api_key)
            if res.get('success'):
                add_custom_quiz_group(res)
            self._send_json(res)

        elif path == '/api/ask_tutor':
            q = body.get('question', '')
            ctx = body.get('context', '')
            res = ask_ai_tutor(q, ctx, api_key=api_key)
            self._send_json(res)

        else:
            self.send_error(404, "API endpoint not found")

def run(port: int = 8765, open_browser: bool = False):
    server_address = ('127.0.0.1', port)
    httpd = HTTPServer(server_address, AppRequestHandler)
    print(f"===========================================================")
    print(f"🇫🇷 Gymnasium 10e Français Studio gestartet!")
    print(f"🌐 Gehe im Browser auf: http://localhost:{port}")
    print(f"===========================================================")
    if open_browser:
        webbrowser.open(f"http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer beendet.")
        httpd.server_close()

if __name__ == '__main__':
    cfg = get_config()
    port = cfg.get("port", 8765)
    run(port=port, open_browser=False)
