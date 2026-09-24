const mammoth = require('mammoth');

// ─────────────────────────────────────────────────────────────────────────────
// Core parser — works on plain text (from docx extraction or direct paste)
//
// HANDLES BOTH:
//   • Multi-line format — each option on its own line
//   • Single-line format — everything on one line, e.g.:
//       "1. Question text A. Opt1 B. Opt2 C. Opt3 D. Opt4"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} rawText
 * @returns {{ question, options:{A,B,C,D}, answer, correctIndex }[]}
 */
function parseText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  // ── Normalise ─────────────────────────────────────────────────────────────
  let text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2019/g, "'")
    .replace(/[\u201C\u201D]/g, '"');

  // ── Utility: strip asterisks and trim ─────────────────────────────────────
  const strip = (s) => (s || '').replace(/\*/g, '').trim();

  // ── Option separator regex ────────────────────────────────────────────────
  // Matches: "A." "A)" "A:" "[A]" "(A)" — upper or lower, with optional star
  // Used to inject newlines so single-line quizzes parse correctly.
  //
  // IMPORTANT: this must NOT match the question-number prefix (e.g. "1. ").
  // We guard it by requiring the letter to be A-D/a-d only.
  const OPTION_SEP = /(?<!\d)(\*?\s*[\[(]?\b([A-Da-d])[\].):])\s+(?=\S)/g;

  // Pre-process: inject '\n' before every option marker so multi-line and
  // single-line formats are treated identically.
  text = text.replace(OPTION_SEP, (match, full, letter) => {
    // Don't inject inside the answer-key block (heuristic: 4+ digits already seen)
    return '\n' + full + ' ';
  });

  // ── Answer-key block at the bottom ──────────────────────────────────────
  const answerKey = {};
  const ansKeyRe  = /(?:đ[aá]p\s*[aá]n|answer\s*key|answers?)\s*[:\-]?\s*([\s\S]+)/i;
  const keyMatch  = text.match(ansKeyRe);
  if (keyMatch) {
    const tokens = keyMatch[1].matchAll(/(\d+)\s*[-–./]?\s*([A-Da-d])/gi);
    for (const t of tokens) answerKey[t[1]] = t[2].toUpperCase();
  }

  // ── Split into question blocks ────────────────────────────────────────────
  // A block starts with: optional Vietnamese prefix + a number + separator
  // e.g. "Câu 1." / "1." / "Bài 2:" / "Question 3)"
  const qStartRe = /^(?:(?:c[a\u00e2]u(?:\s*h[o\u1ecf]i)?|b[a\u00e2]i|question)\s+)?(\d+)\s*[./:)\-]/i;

  const lines = text.split('\n');
  const blocks = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // A line that is ONLY an option marker (A. / *B) / [C] etc.)
    // should never be treated as a question start.
    const isOptionLine =
      /^[\[(]?\*?[A-Da-d][\].):\s]/.test(line) && !/^\d/.test(line);

    if (!isOptionLine && qStartRe.test(line)) {
      if (current) blocks.push(current);
      const numMatch = line.match(/(\d+)/);
      current = { num: numMatch ? numMatch[1] : null, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);

  // ── Per-block option regexes ──────────────────────────────────────────────
  // A line that begins with an option letter (with or without leading star)
  const optLineRe    = /^[\[(]?([A-Da-d])[\].):\s]\s*(.*)/;   // A. text | A: text | A) text | [A] text
  const starStartRe  = /^\*\s*[\[(]?([A-Da-d])[\].):\s]\s*(.*)/; // *B. text
  const starEndRe    = /^[\[(]?([A-Da-d])[\].):\s]\s*(.*?)\s*\*\s*$/; // B. text*

  const OPTION_ORDER = ['A', 'B', 'C', 'D'];

  // ── Parse each block ──────────────────────────────────────────────────────
  const questions = [];

  for (const block of blocks) {
    const { num, lines: bLines } = block;
    if (bLines.some(l => ansKeyRe.test(l))) continue; // skip answer-key block

    let qText          = '';
    const options      = {};
    let detectedAnswer = null;

    for (let i = 0; i < bLines.length; i++) {
      const line = bLines[i];

      // ── Line 0: extract question stem ──────────────────────────────────
      if (i === 0) {
        qText = strip(
          line.replace(/^(?:(?:c[a\u00e2]u(?:\s*h[o\u1ecf]i)?|b[a\u00e2]i|question)\s+)?\d+\s*[./:)\-]\s*/i, '')
        );
        // Inline ANS: tag (rare but supported)
        const ansInline = qText.match(/\bANS\s*:\s*([A-D])\b/i);
        if (ansInline) {
          detectedAnswer = ansInline[1].toUpperCase();
          qText = qText.replace(/\bANS\s*:.*$/i, '').trim();
        }
        continue;
      }

      // ── Standalone answer-marker line ───────────────────────────────────
      const ansLine = line.match(/^(?:ANS|answer|đ[aá]p\s*[aá]n|dap\s*an)\s*[:\-]\s*([A-D])\s*$/i);
      if (ansLine) { detectedAnswer = ansLine[1].toUpperCase(); continue; }

      // ── Star-before option (*B. text) → correct answer ──────────────────
      const ss = line.match(starStartRe);
      if (ss) {
        const key      = ss[1].toUpperCase();
        options[key]   = strip(ss[2]);
        detectedAnswer = key;
        continue;
      }

      // ── Star-after option (B. text*) → correct answer ───────────────────
      const se = line.match(starEndRe);
      if (se) {
        const key      = se[1].toUpperCase();
        options[key]   = strip(se[2]);
        detectedAnswer = key;
        continue;
      }

      // ── Normal option line (A. / A) / A: / [A]) ─────────────────────────
      const om = line.match(optLineRe);
      if (om) {
        options[om[1].toUpperCase()] = strip(om[2]);
        continue;
      }

      // ── Continuation of question stem ────────────────────────────────────
      if (Object.keys(options).length === 0) {
        qText += ' ' + strip(line);
      }
    }

    // Answer-key block fallback
    if (!detectedAnswer && num && answerKey[num]) {
      detectedAnswer = answerKey[num];
    }

    // Safe default
    if (!detectedAnswer) detectedAnswer = 'A';

    // Fill any missing options
    for (const k of OPTION_ORDER) {
      if (!options[k]) options[k] = `(${k})`;
    }

    const correctIndex = OPTION_ORDER.indexOf(detectedAnswer);

    if (qText.trim()) {
      questions.push({
        question:     qText.trim(),
        options,          // { A, B, C, D } — zero asterisks guaranteed
        answer:       detectedAnswer,
        correctIndex,
      });
    }
  }

  return questions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich-docx parser — uses mammoth for bold detection
// ─────────────────────────────────────────────────────────────────────────────
async function parseDocx(filePath) {
  const [rawResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ path: filePath }),
    mammoth.convertToHtml({ path: filePath }).catch(() => null),
  ]);

  const rawText = rawResult.value;
  let questions = parseText(rawText);

  if (htmlResult) {
    const html = htmlResult.value;
    const enriched = html
      .replace(/<strong>([\s\S]*?)<\/strong>/g, (_, inner) => `*${inner}`)
      .replace(/<[^>]+>/g, '\n');
    const enrichedQs = parseText(enriched);
    const richCount  = enrichedQs.filter(q => q.answer !== 'A').length;
    const plainCount = questions.filter(q => q.answer !== 'A').length;
    if (richCount > plainCount) questions = enrichedQs;
  }

  if (questions.length < 1) {
    throw new Error(
      'No questions could be parsed from the file. ' +
      'Supported: numbered questions (1., Câu 1:, Bài 1:) with A/B/C/D options ' +
      'and optional * or ANS: answer markers — inline or multi-line.'
    );
  }
  return questions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo bank
// ─────────────────────────────────────────────────────────────────────────────
function getDemoQuestions() {
  const make = (question, options, answer) => ({
    question, options, answer,
    correctIndex: ['A','B','C','D'].indexOf(answer),
  });
  return [
    make('What is the capital of France?',                   { A:'London',   B:'Paris',              C:'Berlin',            D:'Rome'          }, 'B'),
    make('Which planet is known as the Red Planet?',         { A:'Earth',    B:'Venus',              C:'Mars',              D:'Jupiter'       }, 'C'),
    make('What is the largest ocean on Earth?',              { A:'Atlantic', B:'Indian',             C:'Arctic',            D:'Pacific'       }, 'D'),
    make("Who wrote 'Romeo and Juliet'?",                    { A:'Dickens',  B:'Shakespeare',        C:'Mark Twain',        D:'Jane Austen'   }, 'B'),
    make('What is the chemical symbol for Gold?',            { A:'Au',       B:'Ag',                 C:'Fe',                D:'Pb'            }, 'A'),
    make('Which continent is the Sahara Desert located on?', { A:'Asia',     B:'Africa',             C:'Australia',         D:'South America' }, 'B'),
    make('How many legs does a spider have?',                { A:'6',        B:'8',                  C:'10',                D:'12'            }, 'B'),
    make('What is the hardest natural substance on Earth?',  { A:'Iron',     B:'Diamond',            C:'Quartz',            D:'Granite'       }, 'B'),
    make('Who painted the Mona Lisa?',                       { A:'Van Gogh', B:'Picasso',            C:'Leonardo da Vinci', D:'Monet'         }, 'C'),
    make('What is the square root of 64?',                   { A:'6',        B:'7',                  C:'8',                 D:'9'             }, 'C'),
  ];
}

module.exports = { parseDocx, parseText, getDemoQuestions };
