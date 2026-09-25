const mammoth = require('mammoth');

// ─────────────────────────────────────────────────────────────────────────────
// Core parser — works on plain text (from docx extraction or direct paste)
//
// HANDLES:
//   • Multi-line: each option on its own line
//   • Single-line: "1. Question A. Opt1 B. Opt2 C. Opt3 D. Opt4"
//   • No-space: "A.Nước" treated as label=A, text="Nước"
//   • Lowercase labels: "a. text" or "a) text"
//   • Asterisk before/after: "*A. text" or "A. text*"
//   • Explicit answer line: "Đáp án: B" / "Answer: B" / "ANS: B"
//   • Bold via HTML enrichment from mammoth
//   • Answer-key block at file bottom: "1. A   2. B ..."
//   • Falls back to correctIndex=0 (option A) when no answer detected —
//     never silently drops a question that has 4 valid options.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} rawText
 * @returns {{ question, options:{A,B,C,D}, answer, correctIndex, _num, _answerDetected }[]}
 */
function parseText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  // ── Normalise whitespace / smart quotes ──────────────────────────────────
  let text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2019/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, '-');

  // ── Utility: strip asterisks and trim ───────────────────────────────────
  const strip = (s) => (s || '').replace(/\*/g, '').trim();

  // ── Answer-key block at the bottom ──────────────────────────────────────
  // Matches: "Đáp án: 1.A 2.B..." or "Answer key: 1-A ..."
  const answerKey = {};
  const ansKeyBlockRe = /(?:đ[aá]p\s*[aá]n|answer\s*key|answers?)\s*[:\-]?\s*([\s\S]+)/i;
  const keyMatch = text.match(ansKeyBlockRe);
  if (keyMatch) {
    const tokens = keyMatch[1].matchAll(/(\d+)\s*[-–./]?\s*([A-Da-d])/gi);
    for (const t of tokens) answerKey[t[1]] = t[2].toUpperCase();
  }

  // ── Option separator: inject newlines before "A." "B)" etc. so that
  //    single-line quizzes parse identically to multi-line ones.
  //    Handles no-space (A.Nước), upper+lower, all separator styles.
  // Guard: letter must not be immediately preceded by a digit (avoids "1.A" in answer keys)
  const OPTION_SEP = /(?<!\d)(\*?\s*[\[(]?\b([A-Da-d])[.\]):])(?=\S|\s)/g;
  text = text.replace(OPTION_SEP, (match, full, letter) => '\n' + full + ' ');

  // ── Question-start regex ─────────────────────────────────────────────────
  // Matches: "Câu 1." / "1." / "Bài 2:" / "Q3)" / "Question 4-" etc.
  // Extra patterns vs old parser:
  //   \bQ\b before number, hyphen/em-dash as separator
  const qStartRe =
    /^(?:(?:c[aâ]u(?:\s*h[oỏ]i)?|b[aâ]i|question|\bq)\s+)?(\d+)\s*[./:)\-–—]/i;

  // ── Per-option regexes (more flexible than before) ───────────────────────
  //   Handles: A. | A) | A: | [A] | (A) | a. | A.NoSpace
  const optLineRe   = /^[\[(]?([A-Da-d])[.\]):]\s*(.*)/;   // normal
  const starStartRe = /^\*\s*[\[(]?([A-Da-d])[.\]):]\s*(.*)/; // *A. text
  const starEndRe   = /^[\[(]?([A-Da-d])[.\]):]\s*(.*?)\s*\*\s*$/; // A. text*
  // Explicit answer line patterns
  const answerLineRe =
    /^(?:ANS|answer|đ[áa]p\s*[áa]n|dap\s*an)\s*[:\-]\s*([A-Da-d])\s*$/i;

  const OPTION_ORDER = ['A', 'B', 'C', 'D'];

  // ── Split into lines, gather question blocks ─────────────────────────────
  const lines = text.split('\n');
  const blocks = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // An option line starts with A-D letter — never treat as question start
    const isOptionLine =
      /^[\[(]?\*?[A-Da-d][.\]):\s]/.test(line) && !/^\d/.test(line);

    if (!isOptionLine && qStartRe.test(line)) {
      if (current) blocks.push(current);
      const numMatch = line.match(/(\d+)/);
      current = { num: numMatch ? numMatch[1] : null, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);

  // ── Parse each block ─────────────────────────────────────────────────────
  const questions = [];

  for (const block of blocks) {
    const { num, lines: bLines } = block;

    // Skip the answer-key block itself
    if (bLines.some(l => ansKeyBlockRe.test(l))) continue;

    let qText          = '';
    const options      = {};
    let detectedAnswer = null;
    let answerDetected = false;   // track whether we found an explicit marker

    for (let i = 0; i < bLines.length; i++) {
      const line = bLines[i];

      // ── Line 0: extract question stem ────────────────────────────────────
      if (i === 0) {
        qText = strip(
          line.replace(
            /^(?:(?:c[aâ]u(?:\s*h[oỏ]i)?|b[aâ]i|question|\bq)\s+)?\d+\s*[./:)\-–—]\s*/i,
            ''
          )
        );
        // Inline ANS: tag (rare but supported)
        const ansInline = qText.match(/\bANS\s*:\s*([A-D])\b/i);
        if (ansInline) {
          detectedAnswer = ansInline[1].toUpperCase();
          answerDetected = true;
          qText = qText.replace(/\bANS\s*:.*$/i, '').trim();
        }
        continue;
      }

      // ── Explicit answer line ──────────────────────────────────────────────
      const ansLineM = line.match(answerLineRe);
      if (ansLineM) {
        detectedAnswer = ansLineM[1].toUpperCase();
        answerDetected = true;
        continue;
      }

      // ── Star-before option (*A. text → correct) ───────────────────────────
      const ss = line.match(starStartRe);
      if (ss) {
        const key = ss[1].toUpperCase();
        options[key] = strip(ss[2]);
        detectedAnswer = key;
        answerDetected = true;
        continue;
      }

      // ── Star-after option (A. text* → correct) ────────────────────────────
      const se = line.match(starEndRe);
      if (se) {
        const key = se[1].toUpperCase();
        options[key] = strip(se[2]);
        detectedAnswer = key;
        answerDetected = true;
        continue;
      }

      // ── Normal option line ────────────────────────────────────────────────
      const om = line.match(optLineRe);
      if (om) {
        options[om[1].toUpperCase()] = strip(om[2]);
        continue;
      }

      // ── Continuation of question stem (before any option seen) ────────────
      if (Object.keys(options).length === 0) {
        qText += ' ' + strip(line);
      }
    }

    // ── Answer-key block fallback ─────────────────────────────────────────
    if (!answerDetected && num && answerKey[num]) {
      detectedAnswer = answerKey[num];
      answerDetected = true;
    }

    // ── Default to A if no marker found — NEVER drop the question ─────────
    if (!detectedAnswer) {
      detectedAnswer = 'A';
      // answerDetected stays false so caller knows this was a fallback
    }

    // Fill any missing options with placeholder
    for (const k of OPTION_ORDER) {
      if (!options[k]) options[k] = `(${k})`;
    }

    const correctIndex = OPTION_ORDER.indexOf(detectedAnswer);

    if (qText.trim()) {
      questions.push({
        question:      qText.trim(),
        options,
        answer:        detectedAnswer,
        correctIndex,
        _num:          num,            // original question number (for drop reporting)
        _answerDetected: answerDetected,
      });
    }
  }

  return questions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich-docx parser — uses mammoth for bold/underline detection
// Returns { questions, dropped }
// ─────────────────────────────────────────────────────────────────────────────
async function parseDocx(filePath) {
  const [rawResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ path: filePath }),
    mammoth.convertToHtml({ path: filePath }).catch(() => null),
  ]);

  const rawText = rawResult.value;
  let questions = parseText(rawText);

  if (htmlResult) {
    // Map bold runs to asterisk markers (our star-correct convention)
    const html = htmlResult.value
      .replace(/<strong>([\s\S]*?)<\/strong>/g, (_, inner) => `*${inner}`)
      .replace(/<u>([\s\S]*?)<\/u>/g, (_, inner) => `*${inner}`)   // underline = answer too
      .replace(/<[^>]+>/g, '\n');
    const enrichedQs = parseText(html);

    // Prefer enriched parse if it found more explicit answer markers
    const richCount  = enrichedQs.filter(q => q._answerDetected).length;
    const plainCount = questions.filter(q => q._answerDetected).length;
    if (richCount > plainCount) questions = enrichedQs;
  }

  if (questions.length < 1) {
    throw new Error(
      'Không tìm thấy câu hỏi nào trong file. ' +
      'Định dạng hỗ trợ: câu hỏi đánh số (1., Câu 1:, Bài 1:) ' +
      'với đáp án A/B/C/D và dấu * hoặc "Đáp án:" để đánh dấu đáp án đúng.'
    );
  }

  // Build list of questions that had no explicit answer marker (fallback to A)
  const dropped = questions
    .filter(q => !q._answerDetected)
    .map(q => q._num ? `Câu ${q._num}` : q.question.substring(0, 40));

  if (dropped.length > 0) {
    console.warn(
      `[parser] ${dropped.length} câu không tìm thấy dấu đáp án — mặc định A: ${dropped.join(', ')}`
    );
  }

  // Strip internal meta fields before returning
  const clean = questions.map(({ question, options, answer, correctIndex }) =>
    ({ question, options, answer, correctIndex })
  );

  return { questions: clean, dropped };
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
