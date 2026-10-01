// Question Bank Management & Dev Launch Controller
import * as Audio from './audio.js';

let currentElement = 'thunder';
let loadedQuestions = [];

function showToast(id, msg, isSuccess) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `status-toast ${isSuccess ? 'success' : 'error'}`;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
  }, 4500);
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BANK STATS & EXPLORER
// ─────────────────────────────────────────────────────────────────────────────
async function refreshQuestionStats() {
  try {
    const res = await fetch('/api/admin/questions/stats');
    if (!res.ok) return;
    const data = await res.json();
    const stats = data.stats || data;
    const elTh = document.getElementById('stat-thunder');
    const elFi = document.getElementById('stat-fire');
    const elFr = document.getElementById('stat-frost');
    if (elTh) elTh.textContent = `${stats.thunder || 0} câu`;
    if (elFi) elFi.textContent = `${stats.fire || 0} câu`;
    if (elFr) elFr.textContent = `${stats.frost || 0} câu`;
  } catch (e) {
    console.warn('[admin] Error fetching stats:', e);
  }
}

async function loadQuestionExplorer(element = 'thunder') {
  currentElement = element;
  const listEl = document.getElementById('explorer-list');
  const titleEl = document.getElementById('explorer-elem-title');
  const countEl = document.getElementById('explorer-count');

  if (titleEl) {
    const names = { thunder: 'HỆ SÉT', fire: 'HỆ LỬA', frost: 'HỆ BĂNG' };
    titleEl.textContent = names[element] || element.toUpperCase();
  }

  // Update active badge UI
  ['thunder', 'fire', 'frost'].forEach(el => {
    const badge = document.getElementById(`badge-${el}`);
    if (badge) badge.classList.toggle('active', el === element);
  });

  const selUploadEl = document.getElementById('q-upload-element');
  if (selUploadEl) selUploadEl.value = element;

  if (listEl) {
    listEl.innerHTML = '<div style="text-align:center; color:#64748b; padding:40px;">Đang tải danh sách câu hỏi...</div>';
  }

  try {
    const res = await fetch(`/api/questions/${element}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Không tải được câu hỏi');

    loadedQuestions = data.questions || [];
    if (countEl) countEl.textContent = loadedQuestions.length;
    renderQuestionList(loadedQuestions);
  } catch (err) {
    if (listEl) {
      listEl.innerHTML = `<div style="text-align:center; color:#ef4444; padding:30px;">Lỗi: ${err.message}</div>`;
    }
  }
}

function renderQuestionList(questions) {
  const listEl = document.getElementById('explorer-list');
  if (!listEl) return;

  if (!questions || questions.length === 0) {
    listEl.innerHTML = '<div style="text-align:center; color:#64748b; padding:40px;">Hệ này chưa có câu hỏi nào. Hãy tải lên file .docx / .xlsx / .json để nạp.</div>';
    return;
  }

  listEl.innerHTML = '';
  questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'q-card';

    const opts = Array.isArray(q.options)
      ? q.options
      : ['A', 'B', 'C', 'D'].map(k => q.options?.[k] || '');

    const correctIdx = q.correctIndex !== undefined ? q.correctIndex : 0;
    const letters = ['A', 'B', 'C', 'D'];

    let optionsHtml = '';
    opts.forEach((optText, oIdx) => {
      const isCorrect = oIdx === correctIdx;
      optionsHtml += `
        <div class="q-opt ${isCorrect ? 'correct' : ''}">
          <b>${letters[oIdx]}.</b> ${escapeHtml(optText)}
        </div>
      `;
    });

    card.innerHTML = `
      <div class="q-header">
        <span class="q-num">#${idx + 1}</span>
        <span>${escapeHtml(q.text || q.question || '')}</span>
      </div>
      <div class="q-options">
        ${optionsHtml}
      </div>
    `;

    listEl.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD & CLEAR ACTIONS
// ─────────────────────────────────────────────────────────────────────────────
function setupQuestionManager() {
  refreshQuestionStats();
  loadQuestionExplorer('thunder');

  // Badge click switcher
  ['thunder', 'fire', 'frost'].forEach(el => {
    document.getElementById(`badge-${el}`)?.addEventListener('click', () => {
      loadQuestionExplorer(el);
    });
  });

  // Search input filter
  const searchInput = document.getElementById('explorer-search');
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      renderQuestionList(loadedQuestions);
      return;
    }
    const filtered = loadedQuestions.filter(q => {
      const text = (q.text || q.question || '').toLowerCase();
      const opts = Array.isArray(q.options) ? q.options.join(' ').toLowerCase() : '';
      return text.includes(query) || opts.includes(query);
    });
    renderQuestionList(filtered);
  });

  const btnUpload = document.getElementById('btn-upload-questions');
  const btnClear = document.getElementById('btn-clear-questions');
  const fileInput = document.getElementById('q-upload-file');
  const selElement = document.getElementById('q-upload-element');
  const selMode = document.getElementById('q-upload-mode');

  selElement?.addEventListener('change', () => {
    loadQuestionExplorer(selElement.value);
  });

  btnUpload?.addEventListener('click', async () => {
    const file = fileInput?.files?.[0];
    if (!file) {
      showToast('toast-questions', 'Vui lòng chọn file câu hỏi (.docx / .xlsx / .json)', false);
      return;
    }
    const element = selElement?.value || 'thunder';
    const mode = selMode?.value || 'replace';

    btnUpload.disabled = true;
    btnUpload.textContent = 'Đang nạp câu hỏi...';

    const fd = new FormData();
    fd.append('file', file);
    fd.append('element', element);
    fd.append('mode', mode);

    try {
      const res = await fetch('/api/admin/questions/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Nạp câu hỏi thất bại');

      showToast('toast-questions', `✓ Đã nạp thành công ${data.added || 0} câu hỏi (Tổng: ${data.total})!`, true);
      refreshQuestionStats();
      loadQuestionExplorer(element);
    } catch (e) {
      showToast('toast-questions', `Lỗi: ${e.message}`, false);
    } finally {
      btnUpload.disabled = false;
      btnUpload.innerHTML = '<span>📤</span> Nạp Vào Ngân Hàng';
    }
  });

  btnClear?.addEventListener('click', async () => {
    const element = selElement?.value || 'thunder';
    if (!confirm(`Bạn có chắc chắn muốn xóa sạch ngân hàng câu hỏi của hệ ${element.toUpperCase()}?`)) return;

    try {
      const res = await fetch(`/api/admin/questions/clear?element=${element}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Xóa thất bại');
      showToast('toast-questions', `✓ Đã xóa sạch ngân hàng câu hỏi hệ ${element.toUpperCase()}!`, true);
      refreshQuestionStats();
      loadQuestionExplorer(element);
    } catch (e) {
      showToast('toast-questions', `Lỗi: ${e.message}`, false);
    }
  });

  const btnPermanent = document.getElementById('btn-upload-permanent');
  btnPermanent?.addEventListener('click', async () => {
    const element = selElement?.value || 'thunder';
    const file = fileInput?.files?.[0];

    btnPermanent.disabled = true;
    btnPermanent.textContent = 'Đang khóa vĩnh viễn...';

    try {
      let res, data;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('element', element);
        res = await fetch('/api/admin/questions/upload-permanent', { method: 'POST', body: fd });
      } else if (loadedQuestions && loadedQuestions.length > 0) {
        res = await fetch('/api/admin/questions/upload-permanent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ element, questions: loadedQuestions })
        });
      } else {
        throw new Error('Vui lòng chọn file hoặc đảm bảo hệ đã có câu hỏi');
      }

      data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Khóa vĩnh viễn thất bại');

      showToast('toast-questions', `✓ ${data.message || `Đã khóa vĩnh viễn ${data.total} câu hỏi!`}`, true);
      refreshQuestionStats();
      loadQuestionExplorer(element);
    } catch (e) {
      showToast('toast-questions', `Lỗi: ${e.message}`, false);
    } finally {
      btnPermanent.disabled = false;
      btnPermanent.innerHTML = '<span>🔒</span> Khóa Vĩnh Viễn Thành Mặc Định (data/question/*.json)';
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK LAUNCH & DEV TEST
// ─────────────────────────────────────────────────────────────────────────────
function setupDevLaunch() {
  const getSelectedOutfit = () => {
    const el = document.getElementById('dev-player-outfit');
    const raw = (el && el.value) ? el.value : (sessionStorage.getItem('selectedOutfit') || localStorage.getItem('selectedOutfit') || 'default');
    const clean = (typeof raw === 'string') ? raw.toLowerCase().trim() : 'default';
    return ['default', 'thunder', 'fire', 'frost'].includes(clean) ? clean : 'default';
  };

  const applyOutfitToStorage = (outfit) => {
    const clean = ['default', 'thunder', 'fire', 'frost'].includes(outfit) ? outfit : 'default';
    try {
      localStorage.setItem('player_equipped', JSON.stringify({ outfit: clean, weapon: clean }));
      sessionStorage.setItem('selectedOutfit', clean);
      localStorage.setItem('selectedOutfit', clean);
    } catch (e) {}
  };

  const devOutfitSelect = document.getElementById('dev-player-outfit');
  if (devOutfitSelect) {
    const raw = sessionStorage.getItem('selectedOutfit') || localStorage.getItem('selectedOutfit') || 'default';
    const clean = (typeof raw === 'string') ? raw.toLowerCase().trim() : 'default';
    const savedOutfit = ['default', 'thunder', 'fire', 'frost'].includes(clean) ? clean : 'default';
    devOutfitSelect.value = savedOutfit;
    devOutfitSelect.addEventListener('change', (e) => {
      applyOutfitToStorage(e.target.value);
    });
  }

  document.getElementById('btn-dev-test-match')?.addEventListener('click', async () => {
    const outfit = getSelectedOutfit();
    applyOutfitToStorage(outfit);
    try {
      const res = await fetch('/api/dev-questions?code=DEV99', { method: 'POST' });
      if (res.ok) {
        window.location.href = `/?dev=1&outfit=${encodeURIComponent(outfit)}`;
      } else {
        window.location.href = `/?outfit=${encodeURIComponent(outfit)}`;
      }
    } catch (e) {
      window.location.href = `/?outfit=${encodeURIComponent(outfit)}`;
    }
  });

  document.getElementById('btn-launch-thunder')?.addEventListener('click', () => {
    const outfit = getSelectedOutfit();
    applyOutfitToStorage(outfit);
    window.location.href = `/?element=thunder&outfit=${outfit}`;
  });

  document.getElementById('btn-launch-fire')?.addEventListener('click', () => {
    const outfit = getSelectedOutfit();
    applyOutfitToStorage(outfit);
    window.location.href = `/?element=fire&outfit=${outfit}`;
  });

  document.getElementById('btn-launch-frost')?.addEventListener('click', () => {
    const outfit = getSelectedOutfit();
    applyOutfitToStorage(outfit);
    window.location.href = `/?element=frost&outfit=${outfit}`;
  });

  document.getElementById('btn-launch-lobby')?.addEventListener('click', () => {
    window.location.href = '/';
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  try { Audio.stopBGM?.(); } catch (e) {}
  setupQuestionManager();
  setupDevLaunch();
});
