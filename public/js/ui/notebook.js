// public/js/ui/notebook.js
// "Sổ ghi nhớ": the explanation sheet shown after every answer, the reporting
// of answers to the server, and the notebook screen with its review mode.
// Shared by every game of the hub — a game only needs:
//   recordAnswer({...})          after each answer
//   showExplanation({...})       to explain it (returns a promise when blocking)
//   hideExplanation()            when the next question appears
//   openNotebook()               from any menu

import * as Auth from '../auth.js';

const ELEMENT_NAMES = { fire: 'Lửa', thunder: 'Sét', frost: 'Băng' };
const LETTERS = ['A', 'B', 'C', 'D'];

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
};

function currentUserId() {
  const u = Auth.getCurrentUser ? Auth.getCurrentUser() : null;
  return u && u.id ? u.id : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporting answers
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Report one answer to the notebook (fire-and-forget; guests are skipped).
 * @param {{ game, element, question, options[], correctIndex, chosenIndex, correct }} a
 *        chosenIndex = null when the time ran out
 */
export function recordAnswer(a) {
  const userId = currentUserId();
  if (!userId || !a || !a.question) return false;
  const options = Array.isArray(a.options) ? a.options : [];
  const body = {
    userId,
    game: a.game || 'battle',
    element: a.element || '',
    question: a.question,
    options,
    correctText: options[a.correctIndex] ?? '',
    chosenText: a.chosenIndex == null ? null : (options[a.chosenIndex] ?? null),
    correct: Boolean(a.correct),
  };
  try {
    fetch('/api/notebook/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch (e) { /* offline: nothing to do */ }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Explanation sheet (bottom of the battle screen)
// ─────────────────────────────────────────────────────────────────────────────
let _sheetResolve = null;

export function hideExplanation() {
  const sheet = document.getElementById('explain-sheet');
  if (sheet) sheet.remove();
  if (_sheetResolve) { const r = _sheetResolve; _sheetResolve = null; r(); }
}

/**
 * @param {{ isCorrect, timedOut, correctLetter, correctText, explanation, blocking, saved }} o
 *   blocking = wait for the player to tap "Đã hiểu" (single player, wrong answer)
 *   saved    = the question went into the notebook (shows a small note)
 * @returns {Promise<void>} resolves when the sheet is dismissed (at once if not blocking)
 */
export function showExplanation(o) {
  hideExplanation();
  const hasText = Boolean(o.explanation);
  // A right answer with nothing to explain needs no sheet
  if (o.isCorrect && !hasText) return Promise.resolve();

  const sheet = el('div', `explain-sheet ${o.isCorrect ? 'is-correct' : 'is-wrong'}`);
  sheet.id = 'explain-sheet';
  sheet.setAttribute('role', 'status');

  const title = o.isCorrect ? '✓ Chính xác!' : (o.timedOut ? '⏰ Hết giờ!' : '✗ Chưa đúng rồi!');
  sheet.appendChild(el('div', 'explain-title', title));

  if (!o.isCorrect && o.correctText) {
    const line = el('div', 'explain-answer');
    line.appendChild(el('span', 'explain-label', 'Đáp án đúng: '));
    const strong = el('b', null, `${o.correctLetter ? o.correctLetter + '. ' : ''}${o.correctText}`);
    line.appendChild(strong);
    sheet.appendChild(line);
  }
  if (hasText) sheet.appendChild(el('div', 'explain-text', o.explanation));
  if (!o.isCorrect && o.saved) sheet.appendChild(el('div', 'explain-note', '📒 Câu này đã được ghi vào Sổ ghi nhớ để ôn lại.'));

  let done = Promise.resolve();
  if (o.blocking) {
    const btn = el('button', 'explain-btn', 'Đã hiểu, câu tiếp ▶');
    btn.type = 'button';
    btn.onclick = () => hideExplanation();
    sheet.appendChild(btn);
    done = new Promise((resolve) => { _sheetResolve = resolve; });
  } else if (!o.isCorrect) {
    sheet.appendChild(el('div', 'explain-note', 'Câu tiếp theo sẽ tới sau vài giây…'));
  }

  (document.getElementById('screen-game') || document.body).appendChild(sheet);
  return done;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notebook screen
// ─────────────────────────────────────────────────────────────────────────────
const state = { entries: [], tab: 'open', element: 'all', streakToMaster: 2 };

function closeNotebook() {
  const m = document.getElementById('notebook-modal');
  if (m) m.remove();
}

export async function openNotebook() {
  closeNotebook();
  const overlay = el('div', 'notebook-overlay');
  overlay.id = 'notebook-modal';
  overlay.onclick = (e) => { if (e.target === overlay) closeNotebook(); };
  const panel = el('div', 'notebook-panel');
  overlay.appendChild(panel);

  const head = el('div', 'notebook-head');
  head.appendChild(el('div', 'notebook-title', '📒 Sổ ghi nhớ'));
  const x = el('button', 'notebook-close', '✕');
  x.type = 'button';
  x.setAttribute('aria-label', 'Đóng');
  x.onclick = closeNotebook;
  head.appendChild(x);
  panel.appendChild(head);

  const body = el('div', 'notebook-body');
  panel.appendChild(body);
  document.body.appendChild(overlay);

  const userId = currentUserId();
  if (!userId) {
    body.appendChild(el('p', 'notebook-empty', 'Hãy đăng nhập để dùng Sổ ghi nhớ: những câu em trả lời sai sẽ được ghi lại ở đây để ôn tập.'));
    return;
  }
  body.appendChild(el('p', 'notebook-empty', 'Đang mở sổ…'));
  try {
    const res = await fetch(`/api/notebook/${userId}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Lỗi tải sổ');
    state.entries = data.entries || [];
    state.streakToMaster = data.streakToMaster || 2;
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('p', 'notebook-empty', 'Không mở được sổ, em thử lại sau nhé.'));
    return;
  }
  renderList(body);
}

function filtered(mastered) {
  return state.entries.filter(e => Boolean(e.mastered) === mastered
    && (state.element === 'all' || e.element === state.element));
}

function renderList(body) {
  body.innerHTML = '';
  const open = filtered(false);
  const done = filtered(true);

  // Tabs
  const tabs = el('div', 'notebook-tabs');
  [['open', `Cần ôn (${open.length})`], ['done', `Đã thuộc (${done.length})`]].forEach(([id, label]) => {
    const t = el('button', `notebook-tab${state.tab === id ? ' active' : ''}`, label);
    t.type = 'button';
    t.onclick = () => { state.tab = id; renderList(body); };
    tabs.appendChild(t);
  });
  body.appendChild(tabs);

  // Element filter (only the elements that appear in the notebook)
  const present = [...new Set(state.entries.map(e => e.element).filter(Boolean))];
  if (present.length > 1) {
    const chips = el('div', 'notebook-chips');
    ['all', ...present].forEach((id) => {
      const c = el('button', `notebook-chip${state.element === id ? ' active' : ''}`, id === 'all' ? 'Tất cả' : `Hệ ${ELEMENT_NAMES[id] || id}`);
      c.type = 'button';
      c.onclick = () => { state.element = id; renderList(body); };
      chips.appendChild(c);
    });
    body.appendChild(chips);
  }

  const list = state.tab === 'open' ? open : done;
  if (state.tab === 'open' && open.length > 0) {
    const n = Math.min(10, open.length);
    const go = el('button', 'notebook-review-btn', `▶ Ôn tập ${n} câu`);
    go.type = 'button';
    go.onclick = () => startReview(body, open);
    body.appendChild(go);
    body.appendChild(el('p', 'notebook-hint', `Trả lời đúng ${state.streakToMaster} lần liên tiếp thì câu đó được gạch khỏi sổ.`));
  }

  if (list.length === 0) {
    body.appendChild(el('p', 'notebook-empty', state.tab === 'open'
      ? 'Sổ đang trống: chưa có câu nào cần ôn. Giỏi lắm!'
      : 'Chưa có câu nào được gạch khỏi sổ.'));
    return;
  }
  list.forEach(e => body.appendChild(entryCard(e)));
}

function entryCard(e) {
  const card = el('div', `notebook-card${e.mastered ? ' mastered' : ''}`);
  const meta = el('div', 'notebook-meta');
  if (e.subject) meta.appendChild(el('span', 'notebook-subject', e.subject));
  if (e.element) meta.appendChild(el('span', 'notebook-element', `Hệ ${ELEMENT_NAMES[e.element] || e.element}`));
  card.appendChild(meta);
  card.appendChild(el('div', 'notebook-question', e.question));
  const right = el('div', 'notebook-right');
  right.appendChild(el('span', null, 'Đáp án đúng: '));
  right.appendChild(el('b', null, e.correctText || '—'));
  card.appendChild(right);
  if (!e.mastered && e.lastChosen) {
    const wrong = el('div', 'notebook-wrong');
    wrong.appendChild(el('span', null, 'Lần gần nhất em chọn: '));
    wrong.appendChild(el('b', null, e.lastChosen));
    card.appendChild(wrong);
  }
  if (e.explanation) card.appendChild(el('div', 'notebook-expl', e.explanation));
  const foot = el('div', 'notebook-foot', e.mastered
    ? `✓ Đã thuộc · từng sai ${e.wrongCount || 1} lần`
    : `Sai ${e.wrongCount || 1} lần · đúng liên tiếp ${e.streak || 0}/${state.streakToMaster}`);
  card.appendChild(foot);
  return card;
}

// ── Review mode ───────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startReview(body, openEntries) {
  const pool = shuffle(openEntries.filter(e => Array.isArray(e.options) && e.options.includes(e.correctText))).slice(0, 10);
  const run = { items: pool, i: 0, right: 0, cleared: 0 };
  if (pool.length === 0) { renderList(body); return; }
  showReviewQuestion(body, run);
}

function showReviewQuestion(body, run) {
  body.innerHTML = '';
  const e = run.items[run.i];
  const opts = shuffle(e.options.filter(Boolean));
  const correctIdx = opts.indexOf(e.correctText);

  body.appendChild(el('div', 'review-progress', `Câu ${run.i + 1}/${run.items.length}${e.subject ? ' · ' + e.subject : ''}`));
  body.appendChild(el('div', 'review-question', e.question));
  const grid = el('div', 'review-options');
  const feedback = el('div', 'review-feedback');
  const buttons = opts.map((text, idx) => {
    const b = el('button', 'review-option');
    b.type = 'button';
    b.appendChild(el('span', 'review-letter', LETTERS[idx]));
    b.appendChild(el('span', null, text));
    b.onclick = () => answer(idx);
    grid.appendChild(b);
    return b;
  });
  body.appendChild(grid);
  body.appendChild(feedback);

  function answer(idx) {
    const ok = idx === correctIdx;
    buttons.forEach((b, k) => {
      b.disabled = true;
      if (k === correctIdx) b.classList.add('right');
      else if (k === idx) b.classList.add('wrong');
    });
    if (ok) {
      run.right++;
      if ((e.streak || 0) + 1 >= state.streakToMaster) { run.cleared++; e.mastered = true; }
      e.streak = (e.streak || 0) + 1;
    } else {
      e.streak = 0;
      e.wrongCount = (e.wrongCount || 0) + 1;
      e.lastChosen = opts[idx];
    }
    recordAnswer({ game: 'notebook', element: e.element, question: e.question, options: opts, correctIndex: correctIdx, chosenIndex: idx, correct: ok });

    feedback.appendChild(el('div', `review-verdict ${ok ? 'right' : 'wrong'}`, ok
      ? (e.mastered ? '✓ Chính xác! Câu này đã được gạch khỏi sổ.' : '✓ Chính xác! Đúng thêm 1 lần nữa là thuộc.')
      : `✗ Chưa đúng. Đáp án: ${e.correctText}`));
    if (e.explanation) feedback.appendChild(el('div', 'notebook-expl', e.explanation));
    const last = run.i + 1 >= run.items.length;
    const next = el('button', 'notebook-review-btn', last ? 'Xem kết quả' : 'Câu tiếp ▶');
    next.type = 'button';
    next.onclick = () => {
      run.i++;
      if (last) showReviewSummary(body, run); else showReviewQuestion(body, run);
    };
    feedback.appendChild(next);
    next.focus();
  }
}

function showReviewSummary(body, run) {
  body.innerHTML = '';
  body.appendChild(el('div', 'review-summary', `Em trả lời đúng ${run.right}/${run.items.length} câu.`));
  body.appendChild(el('p', 'notebook-hint', run.cleared > 0
    ? `${run.cleared} câu đã thuộc và được gạch khỏi sổ.`
    : 'Ôn thêm một lượt nữa để gạch các câu khỏi sổ nhé.'));
  const back = el('button', 'notebook-review-btn', '← Về Sổ ghi nhớ');
  back.type = 'button';
  back.onclick = () => { state.tab = 'open'; renderList(body); };
  body.appendChild(back);
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin overview: every player's notebook
// ─────────────────────────────────────────────────────────────────────────────
export async function openAdminOverview() {
  closeNotebook();
  const overlay = el('div', 'notebook-overlay');
  overlay.id = 'notebook-modal';
  overlay.onclick = (e) => { if (e.target === overlay) closeNotebook(); };
  const panel = el('div', 'notebook-panel');
  overlay.appendChild(panel);
  const head = el('div', 'notebook-head');
  head.appendChild(el('div', 'notebook-title', '📒 Sổ ghi nhớ của các con'));
  const x = el('button', 'notebook-close', '✕');
  x.type = 'button';
  x.onclick = closeNotebook;
  head.appendChild(x);
  panel.appendChild(head);
  const body = el('div', 'notebook-body');
  panel.appendChild(body);
  document.body.appendChild(overlay);
  body.appendChild(el('p', 'notebook-empty', 'Đang tải…'));

  let players = [];
  try {
    const data = await (await fetch('/api/admin/notebooks')).json();
    players = data.players || [];
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('p', 'notebook-empty', 'Không tải được dữ liệu.'));
    return;
  }
  body.innerHTML = '';
  if (players.length === 0) {
    body.appendChild(el('p', 'notebook-empty', 'Chưa có con nào trả lời sai câu nào.'));
    return;
  }
  players.forEach((p) => {
    const card = el('div', 'notebook-card');
    const title = el('div', 'notebook-question', p.username);
    card.appendChild(title);
    const last = p.lastWrongAt ? new Date(p.lastWrongAt).toLocaleString('vi-VN') : '—';
    card.appendChild(el('div', 'notebook-foot', `Cần ôn: ${p.toReview} câu · Đã thuộc: ${p.mastered} câu · Sai gần nhất: ${last}`));
    if (p.topMissed.length) {
      card.appendChild(el('div', 'notebook-hint', 'Các câu sai nhiều nhất:'));
      p.topMissed.forEach((m) => {
        const row = el('div', 'notebook-right');
        row.appendChild(el('span', null, `(${m.wrongCount} lần${m.subject ? ' · ' + m.subject : ''}) ${m.question} → `));
        row.appendChild(el('b', null, m.correctText || '—'));
        card.appendChild(row);
      });
    }
    body.appendChild(card);
  });
}
