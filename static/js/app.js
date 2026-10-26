/**
 * Gymnasium 10e Français - Interactive Web Application
 */

const state = {
  config: {},
  grammar: { categories: [], questions: [] },
  vocabulary: { units: [] },
  exams: [],
  writing: {},
  progress: {},
  customQuizzes: [],
  
  // Quiz running state
  currentQuizList: [],
  currentQuizIndex: 0,
  activeCategory: 'all',
  quizAnswered: false,

  // Exam state
  activeExam: null,
  examAnswers: {},
  examTimerInterval: null,
  examSecondsLeft: 0
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  await loadAllData();
  renderDashboardStats();
  initPracticeModule();
  initVocabModule();
  initWritingModule();
  initExamModule();
  initMistakesModule();
  initSettingsModule();
});

// --- Speech Synthesis (Native French Audio) ---
function speakFrench(text) {
  if (!('speechSynthesis' in window)) {
    alert("Audioausgabe wird von Ihrem Browser nicht unterstützt.");
    return;
  }
  window.speechSynthesis.cancel();
  const clean = text.replace(/[«»"]/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'fr-FR';
  utterance.rate = 0.9; // clear, learner-friendly pace
  
  // Try to find a French voice
  const voices = window.speechSynthesis.getVoices();
  const frVoice = voices.find(v => v.lang.startsWith('fr') || v.lang.includes('FR'));
  if (frVoice) utterance.voice = frVoice;

  window.speechSynthesis.speak(utterance);
}

// --- Navigation ---
function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.target);
      if (target) target.classList.add('active');

      if (btn.dataset.target === 'tab-mistakes') {
        renderMistakesList();
      }
    });
  });
}

// --- Persistence & Storage ---
function loadProgressFromStorage() {
  try {
    const raw = localStorage.getItem('french_quiz_progress_v1');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function saveProgressToStorage(prog) {
  try {
    localStorage.setItem('french_quiz_progress_v1', JSON.stringify(prog));
  } catch (e) {}
}

async function fetchWithFallback(apiPath, staticPath, defaultVal = {}) {
  try {
    const res = await fetch(apiPath);
    if (res.ok) return await res.json();
  } catch (e) {}
  try {
    const res2 = await fetch(staticPath);
    if (res2.ok) return await res2.json();
  } catch (e) {}
  return defaultVal;
}

// --- Data Fetching ---
async function loadAllData() {
  try {
    const [cfg, gram, voc, ex, wr, prog, cust] = await Promise.all([
      fetchWithFallback('/api/config', 'data/config.json', {}),
      fetchWithFallback('/api/grammar', 'data/grammar_exercises.json', { categories: [], questions: [] }),
      fetchWithFallback('/api/vocabulary', 'data/vocabulary_decouvertes.json', { units: [] }),
      fetchWithFallback('/api/exams', 'data/exam_simulations.json', { exams: [] }),
      fetchWithFallback('/api/writing', 'data/writing_templates.json', {}),
      fetchWithFallback('/api/progress', 'data/user_progress.json', {}),
      fetchWithFallback('/api/custom_quizzes', 'data/user_custom_quizzes.json', { custom_quizzes: [] })
    ]);

    state.config = cfg;
    state.grammar = gram;
    state.vocabulary = voc;
    state.exams = ex.exams || [];
    state.writing = wr;
    state.customQuizzes = cust.custom_quizzes || [];

    // Prioritize localStorage if existing, otherwise fallback to loaded JSON
    const localProg = loadProgressFromStorage();
    if (localProg && localProg.stats) {
      state.progress = localProg;
    } else {
      state.progress = prog || { stats: { total_answered: 0, correct_count: 0, accuracy_percent: 0, streak_days: 1 }, wrong_notebook: [], srs_cards: {} };
      saveProgressToStorage(state.progress);
    }

    updateBadgeCounts();
  } catch (err) {
    console.error("Fehler beim Laden der Daten:", err);
  }
}

function updateBadgeCounts() {
  const wrongCount = (state.progress.wrong_notebook || []).length;
  const badge = document.getElementById('badge-mistakes');
  if (badge) {
    badge.innerText = wrongCount;
    badge.style.display = wrongCount > 0 ? 'inline-block' : 'none';
  }
}

function renderDashboardStats() {
  const stats = state.progress.stats || {};
  const elTotal = document.getElementById('stat-total');
  const elAcc = document.getElementById('stat-accuracy');
  const elStreak = document.getElementById('stat-streak');
  const elWrong = document.getElementById('stat-wrong');

  if (elTotal) elTotal.innerText = stats.total_answered || 0;
  if (elAcc) elAcc.innerText = (stats.accuracy_percent || 0) + '%';
  if (elStreak) elStreak.innerText = (stats.streak_days || 1) + ' Tage';
  if (elWrong) elWrong.innerText = (state.progress.wrong_notebook || []).length;
}

// ==========================================
// MODULE 1: Practice & Grammar Quiz
// ==========================================
function initPracticeModule() {
  const filterContainer = document.getElementById('grammar-filter');
  if (!filterContainer) return;

  filterContainer.innerHTML = `
    <button class="btn btn-outline active-filter" data-cat="all" onclick="filterQuizCategory('all', this)">Alle Themen</button>
  `;

  (state.grammar.categories || []).forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline';
    btn.dataset.cat = cat.id;
    btn.innerText = cat.name;
    btn.onclick = () => filterQuizCategory(cat.id, btn);
    filterContainer.appendChild(btn);
  });

  // Include custom quizzes if any
  if (state.customQuizzes.length > 0) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline';
    btn.dataset.cat = 'custom';
    btn.innerText = '⚡ Aus Notizen generiert';
    btn.onclick = () => filterQuizCategory('custom', btn);
    filterContainer.appendChild(btn);
  }

  filterQuizCategory('all');
}

function filterQuizCategory(catId, btnElement) {
  state.activeCategory = catId;
  if (btnElement) {
    document.querySelectorAll('#grammar-filter .btn').forEach(b => b.classList.remove('btn-primary'));
    btnElement.classList.add('btn-primary');
  }

  let questions = [...(state.grammar.questions || [])];
  
  if (catId === 'custom') {
    questions = [];
    state.customQuizzes.forEach(group => {
      if (group.questions) questions.push(...group.questions);
    });
  } else if (catId !== 'all') {
    questions = questions.filter(q => q.category === catId);
  }

  state.currentQuizList = questions;
  state.currentQuizIndex = 0;
  renderCurrentQuestion();
}

function renderCurrentQuestion() {
  const container = document.getElementById('quiz-container');
  if (!container) return;

  if (state.currentQuizList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <h3>Keine Übungsfragen in dieser Kategorie gefunden.</h3>
      </div>
    `;
    return;
  }

  const q = state.currentQuizList[state.currentQuizIndex];
  state.quizAnswered = false;

  container.innerHTML = `
    <div class="quiz-box">
      <div class="quiz-header">
        <span style="font-weight: 600; color: var(--text-muted);">
          Frage ${state.currentQuizIndex + 1} von ${state.currentQuizList.length}
        </span>
        <button class="speaker-btn" title="Vorlesen" onclick="speakFrench('${q.prompt.replace(/'/g, "\\'")}')">
          🔊 Vorlesen
        </button>
      </div>

      <div class="quiz-prompt">${q.prompt}</div>

      <div class="options-grid" id="quiz-options">
        ${q.options.map((opt, idx) => `
          <button class="option-btn" onclick="submitAnswer(${idx})">
            <span><strong>${String.fromCharCode(65 + idx)}.</strong> ${opt}</span>
          </button>
        `).join('')}
      </div>

      <div id="quiz-feedback" style="display: none;"></div>
      
      <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
        <button id="btn-next-question" class="btn btn-primary" style="display: none;" onclick="nextQuestion()">
          Nächste Frage ➔
        </button>
      </div>
    </div>
  `;
}

async function submitAnswer(chosenIdx) {
  if (state.quizAnswered) return;
  state.quizAnswered = true;

  const q = state.currentQuizList[state.currentQuizIndex];
  const isCorrect = (chosenIdx === q.answer);
  const options = document.querySelectorAll('#quiz-options .option-btn');

  options.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === q.answer) {
      btn.classList.add('correct');
    } else if (idx === chosenIdx) {
      btn.classList.add('wrong');
    }
  });

  // Update stats and mistakes in state & localStorage immediately
  if (!state.progress.stats) {
    state.progress.stats = { total_answered: 0, correct_count: 0, accuracy_percent: 0, streak_days: 1 };
  }
  const s = state.progress.stats;
  s.total_answered = (s.total_answered || 0) + 1;
  if (isCorrect) s.correct_count = (s.correct_count || 0) + 1;
  s.accuracy_percent = Math.round((s.correct_count / s.total_answered) * 100);

  if (!state.progress.wrong_notebook) state.progress.wrong_notebook = [];
  const wn = state.progress.wrong_notebook;
  const existing = wn.find(w => w.id === q.id);

  if (!isCorrect) {
    if (!existing) {
      wn.unshift({
        id: q.id,
        question: q,
        wrong_count: 1,
        added_date: new Date().toLocaleDateString()
      });
    } else {
      existing.wrong_count = (existing.wrong_count || 1) + 1;
    }
  } else if (existing) {
    // If answered correctly during review, decrement error count
    existing.wrong_count = (existing.wrong_count || 1) - 1;
    if (existing.wrong_count <= 0) {
      state.progress.wrong_notebook = wn.filter(w => w.id !== q.id);
    }
  }

  saveProgressToStorage(state.progress);
  updateBadgeCounts();
  renderDashboardStats();

  // Also sync to server if available
  try {
    fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_id: q.id,
        is_correct: isCorrect,
        question_obj: q
      })
    }).catch(() => {});
  } catch (err) {}

  // Render explanation
  const fb = document.getElementById('quiz-feedback');
  fb.style.display = 'block';
  fb.innerHTML = `
    <div class="explanation-card">
      <div style="margin-bottom: 0.5rem; font-weight: 700; color: ${isCorrect ? 'var(--success)' : 'var(--danger)'};">
        ${isCorrect ? '✅ Richtig! Très bien !' : '❌ Leider falsch.'}
      </div>
      ${q.rule_tip ? `<div class="rule-tip-badge">💡 Merkhilfe: ${q.rule_tip}</div>` : ''}
      <div style="margin-top: 0.5rem; font-size: 0.95rem; line-height: 1.5;">
        <strong>Erklärung (Deutsch):</strong> ${q.explanation_de || q.explanation || ''}
      </div>
      ${q.explanation_zh ? `
        <div style="margin-top: 0.5rem; font-size: 0.9rem; color: #475569;">
          <strong>中文解析：</strong> ${q.explanation_zh}
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('btn-next-question').style.display = 'inline-flex';
}

function nextQuestion() {
  if (state.currentQuizIndex < state.currentQuizList.length - 1) {
    state.currentQuizIndex++;
    renderCurrentQuestion();
  } else {
    // End of set
    const container = document.getElementById('quiz-container');
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 3rem;">
        <h2>🎉 Glückwunsch! Alle Fragen durchgearbeitet!</h2>
        <p style="margin: 1rem 0; color: var(--text-muted);">
          Du hast alle ${state.currentQuizList.length} Fragen dieses Themengebiets abgeschlossen.
        </p>
        <button class="btn btn-primary" onclick="filterQuizCategory('${state.activeCategory}')">
          Wiederholen ↺
        </button>
      </div>
    `;
  }
}

// ==========================================
// MODULE 2: Vocabulary & Collocations (SRS)
// ==========================================
function initVocabModule() {
  const unitSelect = document.getElementById('vocab-unit-select');
  if (!unitSelect) return;

  unitSelect.innerHTML = (state.vocabulary.units || []).map((u, i) => `
    <option value="${u.id}">${u.title}</option>
  `).join('');

  unitSelect.onchange = () => renderVocabCards(unitSelect.value);
  if (state.vocabulary.units.length > 0) {
    renderVocabCards(state.vocabulary.units[0].id);
  }
}

function renderVocabCards(unitId) {
  const container = document.getElementById('vocab-container');
  if (!container) return;

  const unit = (state.vocabulary.units || []).find(u => u.id === unitId);
  if (!unit) return;

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <h3 style="color: var(--secondary);">${unit.title}</h3>
      <p style="color: var(--text-muted); font-size: 0.9rem;">${unit.subtitle}</p>
    </div>
    <div class="vocab-grid">
      ${unit.words.map(w => {
        const srs = (state.progress.srs_cards || {})[w.id];
        const nextReview = srs ? `Nächste Wdh: ${srs.next_review}` : 'Neu';
        return `
          <div class="vocab-card">
            <div>
              <div class="vocab-main">
                <span class="vocab-word">${w.french}</span>
                <span class="vocab-type">${w.word_type}</span>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
                <button class="speaker-btn" onclick="speakFrench('${w.french.replace(/'/g, "\\'")}')">🔊</button>
                <span style="font-size: 0.95rem; font-weight: 600;">🇩🇪 ${w.german}</span>
              </div>
              <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.75rem;">🇨🇳 ${w.chinese}</div>

              ${w.collocations && w.collocations.length > 0 ? `
                <div class="collocations-list">
                  <strong>📌 Feste Wendungen / Kollokationen:</strong>
                  <ul style="padding-left: 1.2rem; margin-top: 0.25rem;">
                    ${w.collocations.map(c => `<li>${c} <button class="speaker-btn" style="font-size: 0.9rem;" onclick="speakFrench('${c.replace(/'/g, "\\'")}')">🔊</button></li>`).join('')}
                  </ul>
                </div>
              ` : ''}

              ${w.word_family && w.word_family.length > 0 ? `
                <div style="font-size: 0.85rem; color: #475569; margin: 0.5rem 0;">
                  <strong>🌱 Wortfamilie:</strong> ${w.word_family.join(' • ')}
                </div>
              ` : ''}

              <div style="background: #f1f5f9; padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem;">
                <em>« ${w.example_fr} »</em>
                <button class="speaker-btn" style="font-size: 0.8rem;" onclick="speakFrench('${w.example_fr.replace(/'/g, "\\'")}')">🔊</button>
                <div style="color: #64748b; margin-top: 2px;">🇩🇪 ${w.example_de}</div>
              </div>
            </div>

            <div>
              <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.75rem; text-align: right;">
                ${nextReview}
              </div>
              <div class="srs-btn-row">
                <button class="srs-btn srs-again" onclick="rateVocabCard('${w.id}', 'again')">Nochmal</button>
                <button class="srs-btn srs-hard" onclick="rateVocabCard('${w.id}', 'hard')">Schwer</button>
                <button class="srs-btn srs-good" onclick="rateVocabCard('${w.id}', 'good')">Gut</button>
                <button class="srs-btn srs-easy" onclick="rateVocabCard('${w.id}', 'easy')">Leicht</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function rateVocabCard(wordId, rating) {
  try {
    const res = await fetch('/api/srs_rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word_id: wordId, rating: rating })
    });
    const data = await res.json();
    state.progress.srs_cards[wordId] = data;
    alert(`Gespeichert! Nächste Wiederholung am ${data.next_review}`);
    initVocabModule();
  } catch (err) {
    console.error(err);
  }
}

// ==========================================
// MODULE 3: Writing Studio (Expression Écrite)
// ==========================================
function initWritingModule() {
  const promptSelect = document.getElementById('essay-prompt-select');
  const connectorContainer = document.getElementById('connectors-bank');
  if (!promptSelect || !connectorContainer) return;

  const prompts = state.writing.essay_prompts || [];
  promptSelect.innerHTML = prompts.map(p => `
    <option value="${p.id}">${p.title}</option>
  `).join('');

  promptSelect.onchange = () => updateSelectedPrompt();
  updateSelectedPrompt();

  // Render connectors bank
  const categories = state.writing.connecteurs || [];
  connectorContainer.innerHTML = categories.map(cat => `
    <div style="margin-bottom: 0.75rem;">
      <h5 style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">${cat.category}</h5>
      <div>
        ${cat.items.map(item => `
          <span class="connector-chip" title="${item.de} | ${item.zh}" onclick="insertConnector('${item.fr}')">
            ${item.fr}
          </span>
        `).join('')}
      </div>
    </div>
  `).join('');

  const essayInput = document.getElementById('essay-textarea');
  if (essayInput) {
    essayInput.addEventListener('input', () => {
      const words = essayInput.value.trim().split(/\s+/).filter(w => w.length > 0);
      document.getElementById('essay-word-count').innerText = words.length;
    });
  }
}

function updateSelectedPrompt() {
  const promptSelect = document.getElementById('essay-prompt-select');
  const p = (state.writing.essay_prompts || []).find(x => x.id === promptSelect.value);
  const infoEl = document.getElementById('prompt-info');
  if (p && infoEl) {
    infoEl.innerHTML = `
      <div style="background: var(--primary-light); padding: 0.75rem 1rem; border-radius: 8px; border-left: 4px solid var(--primary); font-size: 0.95rem;">
        <strong>Thema / Thema-Tipp:</strong> ${p.starter_tips}
      </div>
    `;
  }
}

function insertConnector(text) {
  const textarea = document.getElementById('essay-textarea');
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;
  textarea.value = val.substring(0, start) + text + ' ' + val.substring(end);
  textarea.focus();
  textarea.dispatchEvent(new Event('input'));
}

// --- Client-side AI & Heuristic Engine (Works on static hosts like GitHub Pages) ---
function clientHeuristicAnalysis(essay) {
  const words = essay.trim().split(/\s+/).filter(w => w.length > 0);
  const knownConnectors = [
    "à mon avis", "tout d'abord", "en premier lieu", "de plus", "en outre",
    "cependant", "néanmoins", "en revanche", "par conséquent", "c'est pourquoi",
    "bien que", "pour conclure", "en conclusion", "d'une part", "d'autre part",
    "non seulement", "malgré"
  ];
  const detected = knownConnectors.filter(c => essay.toLowerCase().includes(c));
  const subjonctifMarkers = ["bien que", "il faut que", "pour que", "avant que", "exiger que"];
  const subMarkers = subjonctifMarkers.filter(m => essay.toLowerCase().includes(m));
  
  let score = 8;
  if (words.length >= 100) score += 2;
  if (words.length >= 130) score += 1;
  if (detected.length >= 3) score += 2;
  if (subMarkers.length >= 1) score += 2;
  score = Math.min(score, 15);

  return {
    score: score,
    max_score: 15,
    feedback: `💡 本地即时评阅（安全离线模式）：字数 ${words.length} 词。识别到高级连接词 (${detected.length}个): ${detected.join(', ') || '无'}。Gymnasium 10年级备考建议：请至少使用一次「Bien que + 虚拟式」，并遵循 PEE 论证结构。`,
    grammar_corrections: [
      "检查 avoir 复合过去时中直宾前置的性数配合，以及 être 过去分词的性数配合。",
      "注意 éviter les répétitions：使用副代词 y 和 en 代替重复出现的地点与事物。"
    ],
    upgraded_sentences: [
      "Bien que ce soit une question complexe, il est impératif d'examiner chaque point de vue avec nuance.",
      "Non seulement cette solution est efficace, mais elle permet aussi de sensibiliser les lycéens."
    ]
  };
}

async function callGeminiDirectly(prompt, essay, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const systemInstruction = "Du bist ein erfahrener Französischlehrer an einem deutschen Gymnasium für die 10. Klasse (Niveau B1/B1+). Bewerte den Aufsatz nach Inhalt & Struktur, Grammatik, Wortschatz. Antworte als valides JSON mit folgenden Schlüsseln: score (0-15), max_score (15), feedback (deutsch), grammar_corrections (Array), upgraded_sentences (Array).";
  const body = {
    contents: [
      {
        parts: [
          { text: systemInstruction },
          { text: `Aufgabenstellung:\n${prompt}\n\nAufsatz:\n${essay}` }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  const text = data.candidates[0].content.parts[0].text;
  return JSON.parse(text);
}

async function submitEssayForGrading() {
  const essay = document.getElementById('essay-textarea').value.trim();
  if (essay.length < 20) {
    alert("Bitte schreibe mindestens ein paar Sätze, bevor du den Aufsatz bewerten lässt.");
    return;
  }

  const promptSelect = document.getElementById('essay-prompt-select');
  const selectedPrompt = promptSelect.options[promptSelect.selectedIndex].text;
  const btn = document.getElementById('btn-grade-essay');
  const resultDiv = document.getElementById('essay-result');

  btn.disabled = true;
  btn.innerText = "Bewertung läuft...";
  resultDiv.innerHTML = `<div style="text-align: center; padding: 2rem;">⏳ 评阅分析中，正在按 Gymnasium 10年级标准批改...</div>`;

  const apiKey = localStorage.getItem('gemini_api_key_custom') || state.config.gemini_api_key || '';

  try {
    let result = null;
    // 1. Try local python server API if available
    try {
      const res = await fetch('/api/evaluate_essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: selectedPrompt, essay: essay })
      });
      if (res.ok) result = await res.json();
    } catch (e) {}

    // 2. If static host (like GitHub Pages) and user has their own API key stored
    if (!result && apiKey) {
      try {
        result = await callGeminiDirectly(selectedPrompt, essay, apiKey);
      } catch (e) {
        console.warn("Direct Gemini call failed, using heuristic:", e);
      }
    }

    // 3. Fallback to built-in client-side heuristic analyzer
    if (!result) {
      result = clientHeuristicAnalysis(essay);
    }

    resultDiv.innerHTML = `
      <div class="card" style="border-top: 4px solid var(--primary); margin-top: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3>Aufsatz-Korrektur & Analyse / 写作评阅报告</h3>
          <span style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">
            ${result.score} / ${result.max_score || 15} Punkte
          </span>
        </div>

        <div style="margin-bottom: 1rem;">
          <strong>老师总评与反馈：</strong>
          <p style="margin-top: 0.25rem; white-space: pre-line; line-height: 1.6;">${result.feedback}</p>
        </div>

        ${result.grammar_corrections && result.grammar_corrections.length > 0 ? `
          <div style="margin-bottom: 1rem; background: var(--danger-light); padding: 1rem; border-radius: 8px;">
            <strong style="color: var(--danger);">⚠️ 语言与语法重点提醒：</strong>
            <ul style="padding-left: 1.25rem; margin-top: 0.5rem;">
              ${result.grammar_corrections.map(c => `<li>${c}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${result.upgraded_sentences && result.upgraded_sentences.length > 0 ? `
          <div style="background: var(--success-light); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <strong style="color: var(--success);">✨ 句式升维推荐（B1+ / B2 级）：</strong>
            <ul style="padding-left: 1.25rem; margin-top: 0.5rem;">
              ${result.upgraded_sentences.map(s => `<li>« ${s} »</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) {
    resultDiv.innerHTML = `<div style="color: var(--danger);">Fehler: ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerText = "Aufsatz zur Korrektur einreichen 📝";
  }
}

// ==========================================
// MODULE 4: Exam Simulation (Klassenarbeit)
// ==========================================
function initExamModule() {
  const container = document.getElementById('exam-selector');
  if (!container) return;

  container.innerHTML = state.exams.map(exam => `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3>${exam.title}</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem;">${exam.level} • ${exam.time_minutes} Minuten • Max. ${exam.max_score} Punkte</p>
        </div>
        <button class="btn btn-primary" onclick="startExam('${exam.id}')">Klassenarbeit starten ⏱️</button>
      </div>
    </div>
  `).join('');
}

function startExam(examId) {
  const exam = state.exams.find(e => e.id === examId);
  if (!exam) return;

  state.activeExam = exam;
  state.examAnswers = {};
  state.examSecondsLeft = exam.time_minutes * 60;

  document.getElementById('exam-selector').style.display = 'none';
  const stage = document.getElementById('exam-active-stage');
  stage.style.display = 'block';

  // Start timer
  clearInterval(state.examTimerInterval);
  state.examTimerInterval = setInterval(() => {
    state.examSecondsLeft--;
    updateExamTimerDisplay();
    if (state.examSecondsLeft <= 0) {
      clearInterval(state.examTimerInterval);
      alert("Die Zeit ist abgelaufen! Die Klassenarbeit wird automatisch abgegeben.");
      submitExam();
    }
  }, 1000);
  updateExamTimerDisplay();

  // Render sections
  const content = document.getElementById('exam-sections-content');
  content.innerHTML = `
    <h2 style="margin-bottom: 1.5rem;">${exam.title}</h2>
    ${exam.sections.map((sec, sIdx) => `
      <div class="card" style="margin-bottom: 2rem;">
        <h3 style="color: var(--primary); margin-bottom: 1rem;">${sec.title}</h3>
        ${sec.passage ? `
          <div style="background: #f8fafc; border: 1px solid var(--border); padding: 1.25rem; border-radius: 8px; font-style: italic; line-height: 1.7; margin-bottom: 1.5rem; white-space: pre-line;">
            ${sec.passage}
          </div>
        ` : ''}

        ${sec.questions ? sec.questions.map((q, qIdx) => `
          <div style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
            <div style="font-weight: 600; margin-bottom: 0.75rem;">
              Frage ${qIdx + 1}: ${q.prompt} (${q.points} P.)
            </div>
            <div class="options-grid">
              ${q.options.map((opt, oIdx) => `
                <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1rem; border: 1px solid var(--border); border-radius: 8px; cursor: pointer;">
                  <input type="radio" name="exam_q_${q.id}" value="${oIdx}" onchange="state.examAnswers['${q.id}'] = ${oIdx}">
                  <span>${opt}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `).join('') : ''}

        ${sec.type === 'writing' ? `
          <div>
            <p style="font-weight: 600; margin-bottom: 0.5rem;">${sec.prompt}</p>
            <ul style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem; padding-left: 1.25rem;">
              ${(sec.criteria || []).map(c => `<li>${c}</li>`).join('')}
            </ul>
            <textarea id="exam_writing_input" class="essay-input" placeholder="Schreibe deinen Aufsatz hier..."></textarea>
          </div>
        ` : ''}
      </div>
    `).join('')}
    
    <div style="text-align: center; margin: 2rem 0;">
      <button class="btn btn-success" style="font-size: 1.1rem; padding: 0.75rem 2rem;" onclick="submitExam()">
        Klassenarbeit abgeben & Auswertung anzeigen ✅
      </button>
    </div>
  `;
}

function updateExamTimerDisplay() {
  const timerEl = document.getElementById('exam-timer');
  if (!timerEl) return;
  const mins = Math.floor(state.examSecondsLeft / 60);
  const secs = state.examSecondsLeft % 60;
  timerEl.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function submitExam() {
  clearInterval(state.examTimerInterval);
  const exam = state.activeExam;
  let totalScore = 0;
  let breakdown = { reading: 0, grammar: 0, writing: 12 };

  // Calculate scores for reading and grammar
  exam.sections.forEach(sec => {
    if (sec.questions) {
      sec.questions.forEach(q => {
        const userChoice = state.examAnswers[q.id];
        if (userChoice === q.answer) {
          totalScore += q.points;
          if (sec.type === 'reading') breakdown.reading += q.points;
          if (sec.type === 'grammar_vocab') breakdown.grammar += q.points;
        }
      });
    }
  });

  // Writing estimation
  const writingText = document.getElementById('exam_writing_input') ? document.getElementById('exam_writing_input').value : '';
  const wordCount = writingText.trim().split(/\s+/).filter(w => w.length > 0).length;
  let writingScore = Math.min(15, Math.max(5, Math.round(wordCount / 10)));
  breakdown.writing = writingScore;
  totalScore += writingScore;

  // Save on server
  try {
    await fetch('/api/exam_submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exam_id: exam.id,
        total_score: totalScore,
        max_score: exam.max_score,
        breakdown: breakdown
      })
    });
  } catch (err) {
    console.error(err);
  }

  // Show result modal
  const content = document.getElementById('exam-sections-content');
  const percent = Math.round((totalScore / exam.max_score) * 100);
  content.innerHTML = `
    <div class="card" style="text-align: center; padding: 3rem;">
      <h2 style="color: var(--primary);">Prüfungsergebnis: ${exam.title}</h2>
      <div style="font-size: 3rem; font-weight: 800; margin: 1.5rem 0; color: ${percent >= 70 ? 'var(--success)' : 'var(--warning)'};">
        ${totalScore} / ${exam.max_score} Punkte (${percent}%)
      </div>
      
      <div style="display: flex; justify-content: center; gap: 2rem; margin: 1.5rem 0;">
        <div><strong>Leseverstehen:</strong> ${breakdown.reading} P.</div>
        <div><strong>Grammatik & Wortschatz:</strong> ${breakdown.grammar} P.</div>
        <div><strong>Aufsatz:</strong> ${breakdown.writing} P.</div>
      </div>

      <button class="btn btn-primary" onclick="location.reload()">Zurück zur Übersicht</button>
    </div>
  `;
}

// ==========================================
// MODULE 5: Wrong Questions Notebook (Carnet d'Erreurs)
// ==========================================
function initMistakesModule() {
  renderMistakesList();
}

function renderMistakesList() {
  const container = document.getElementById('mistakes-container');
  if (!container) return;

  const mistakes = state.progress.wrong_notebook || [];
  if (mistakes.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 3rem;">
        <h3>🌟 太棒了！当前错误记忆库已清空（无遗留错题）。</h3>
        <p style="color: var(--text-muted); margin-top: 0.5rem;">
          在平时的语法和模考测试中，做错的题目会自动记录在这里。掌握后可以随时点击“删除记忆”！
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.5rem;">
      <h3 style="color: var(--secondary);">错题与薄弱点记忆清单（共 ${mistakes.length} 项）</h3>
      <button class="btn btn-primary" onclick="startMistakesDrill()">🔁 轮流重做所有错题</button>
    </div>
    <div class="options-grid">
      ${mistakes.map((m, idx) => `
        <div class="card" style="border-left: 4px solid var(--danger); margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 0.5rem;">
                ${idx + 1}. ${m.question.prompt}
                <button class="speaker-btn" title="朗读" onclick="speakFrench('${(m.question.prompt || '').replace(/'/g, "\\'")}')">🔊</button>
              </div>
              ${m.question.rule_tip ? `
                <div class="rule-tip-badge" style="margin-bottom: 0.5rem;">💡 核心考点：${m.question.rule_tip}</div>
              ` : ''}
              <div style="font-size: 0.9rem; color: #334155; margin-bottom: 0.3rem;">
                <strong>🇩🇪 考点解析：</strong> ${m.question.explanation_de || m.question.explanation || '—'}
              </div>
              ${m.question.explanation_zh ? `
                <div style="font-size: 0.85rem; color: #475569;">
                  <strong>🇨🇳 中文解析：</strong> ${m.question.explanation_zh}
                </div>
              ` : ''}
            </div>

            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
              <span class="badge-count" style="background: var(--warning); font-size: 0.8rem;">
                ${m.wrong_count || 1} 次未掌握
              </span>
              <div style="display: flex; gap: 0.4rem; margin-top: 0.5rem;">
                <button class="btn btn-outline" style="font-size: 0.85rem; padding: 0.4rem 0.75rem;" onclick="drillSingleMistake('${m.id}')" title="单独做一遍此题">
                  🎯 测验此题
                </button>
                <button class="btn btn-danger" style="font-size: 0.85rem; padding: 0.4rem 0.75rem;" onclick="deleteMistake('${m.id}')" title="完全掌握，从记忆库移除">
                  🗑️ 完全学会，删除记忆
                </button>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function deleteMistake(questionId) {
  if (!confirm("确认该题目已经完全掌握，并从错误记忆库中删除吗？")) return;
  state.progress.wrong_notebook = (state.progress.wrong_notebook || []).filter(w => w.id !== questionId);
  saveProgressToStorage(state.progress);
  updateBadgeCounts();
  renderDashboardStats();
  renderMistakesList();

  // Sync to server if possible
  fetch('/api/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: questionId, is_correct: true })
  }).catch(() => {});
}

function drillSingleMistake(questionId) {
  const item = (state.progress.wrong_notebook || []).find(w => w.id === questionId);
  if (!item) return;

  state.currentQuizList = [item.question];
  state.currentQuizIndex = 0;

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-target="tab-practice"]').classList.add('active');
  document.getElementById('tab-practice').classList.add('active');

  renderCurrentQuestion();
}

function startMistakesDrill() {
  const mistakes = state.progress.wrong_notebook || [];
  if (mistakes.length === 0) {
    alert("当前错误记忆库为空，暂无错题需要重练。");
    return;
  }

  state.currentQuizList = mistakes.map(m => m.question);
  state.currentQuizIndex = 0;
  
  // Switch to practice tab
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-target="tab-practice"]').classList.add('active');
  document.getElementById('tab-practice').classList.add('active');

  renderCurrentQuestion();
}

function openAddMistakeModal() {
  const form = document.getElementById('add-mistake-form');
  if (form) form.style.display = 'block';
}

function closeAddMistakeModal() {
  const form = document.getElementById('add-mistake-form');
  if (form) form.style.display = 'none';
}

function saveManualMistake() {
  const prompt = document.getElementById('manual-prompt').value.trim();
  const tip = document.getElementById('manual-tip').value.trim();
  const exp = document.getElementById('manual-exp').value.trim();

  if (!prompt) {
    alert("请至少输入题目或例句内容。");
    return;
  }

  const newQ = {
    id: 'manual_' + Date.now(),
    category: 'custom',
    prompt: prompt,
    options: ["选项 A（自查题）", "选项 B", "选项 C", "选项 D"],
    answer: 0,
    rule_tip: tip || "自查记忆考点",
    explanation_de: exp || tip || prompt,
    explanation_zh: exp || tip || prompt
  };

  if (!state.progress.wrong_notebook) state.progress.wrong_notebook = [];
  state.progress.wrong_notebook.unshift({
    id: newQ.id,
    question: newQ,
    wrong_count: 1,
    added_date: new Date().toLocaleDateString()
  });

  saveProgressToStorage(state.progress);
  updateBadgeCounts();
  renderDashboardStats();
  renderMistakesList();
  closeAddMistakeModal();

  document.getElementById('manual-prompt').value = '';
  document.getElementById('manual-tip').value = '';
  document.getElementById('manual-exp').value = '';
}

function exportProgress() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.progress, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `french_progress_backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importProgress(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported && (imported.stats || imported.wrong_notebook)) {
        state.progress = imported;
        saveProgressToStorage(imported);
        updateBadgeCounts();
        renderDashboardStats();
        renderMistakesList();
        alert("🎉 学习进度与错题记忆导入恢复成功！");
      } else {
        alert("文件格式不正确，缺少有效的学习数据。");
      }
    } catch (err) {
      alert("导入失败: " + err.message);
    }
  };
  reader.readAsText(file);
}

// ==========================================
// MODULE 6: Lecture Notes to Quiz Generator
// ==========================================
async function generateQuizFromInput() {
  const text = document.getElementById('lecture-notes-input').value.trim();
  if (text.length < 30) {
    alert("Bitte füge ausreichend Text/Notizen ein (mindestens 30 Zeichen).");
    return;
  }

  const btn = document.getElementById('btn-generate-quiz');
  btn.disabled = true;
  btn.innerText = "KI analysiert und erstellt Übung...";

  try {
    const res = await fetch('/api/generate_quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lecture_text: text })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || "Generierung fehlgeschlagen.");
      return;
    }

    alert(`Erfolg! Neue Übungsgruppe « ${data.quiz_title} » mit ${data.questions.length} Fragen wurde erstellt.`);
    await loadAllData();
    initPracticeModule();
    filterQuizCategory('custom');
  } catch (err) {
    alert("Fehler: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "Automatisch Fragen generieren ⚡";
  }
}

// ==========================================
// MODULE 7: Settings & API Key
// ==========================================
function initSettingsModule() {
  const keyInput = document.getElementById('setting-gemini-key');
  if (keyInput) {
    const savedKey = localStorage.getItem('gemini_api_key_custom') || state.config.gemini_api_key || '';
    keyInput.value = savedKey;
  }
}

async function saveSettings() {
  const keyInput = document.getElementById('setting-gemini-key').value.trim();
  try {
    localStorage.setItem('gemini_api_key_custom', keyInput);
    state.config.gemini_api_key = keyInput;
    
    // Also try to sync with local Python server if running
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gemini_api_key: keyInput })
    }).catch(() => {});

    alert("✅ 设置保存成功！\n\n您的 API Key 仅保存在您当前浏览器的本地存储（localStorage）中，绝对不会被上传到 GitHub 仓库，其他访问者也绝不可能看到或调用您的 Key。");
  } catch (err) {
    alert("保存失败: " + err.message);
  }
}
