/**
 * student.js
 * ------------------------------------------------------------------
 * ตรรกะของ "หน้าจอนักเรียน" (Student View)
 *
 * แนวคิด SCAFFOLDING
 * ------------------------------------------------------------------
 * แต่ละข้อไม่ถามคำตอบสุดท้ายทันที แต่เป็น "บันไดคำถามย่อย" ที่ต้องตอบทีละขั้น
 * ตอบขั้นไหนถูก ระบบยืนยันด้วยคำอธิบายสั้น ๆ แล้วปลดล็อกขั้นถัดไปให้เอง
 * นักเรียนจึงถูกพาไปถึงคำตอบ ไม่ใช่อ่านคำใบ้แล้วคิดต่อเอง
 *
 * กติกา
 *  • หัวใจ 3 ดวงต่อ "หนึ่งข้อ" (ไม่ใช่ต่อขั้น) เริ่มใหม่ทุกข้อ
 *  • ตอบผิดขั้นใดก็ตาม → เสียหัวใจ 1 ดวง และระบบเปิดคำใบ้ของขั้นนั้นให้อัตโนมัติ
 *  • หัวใจหมด → ข้อนี้ได้ 0 คะแนน แต่ยังเดินบันไดต่อได้จนจบ (เรียนรู้ต่อ)
 *  • ตอบผิดรวม 5 ครั้งในข้อเดียว → ระบบเฉลยทั้งข้อ แล้วไปข้อถัดไป
 *  • กดขอคำใบ้เอง → ไม่เสียหัวใจ แต่หักคะแนน
 * ------------------------------------------------------------------
 */

import { APP_CONFIG, GROUPS } from './config.js';
import { QUESTIONS } from './questions.js';
import { getBackend, createEmptyGroupState } from './backend.js';
import { icon, hearts } from './icons.js';

const backend = getBackend();
const $ = (id) => document.getElementById(id);

/** สถานะของผู้เล่นในหน่วยความจำ (ซิงก์ขึ้น backend ทุกครั้งที่เปลี่ยน) */
const session = {
  group: null,
  state: null,
  questionIndex: 0,
  stepIndex: 0, // ขั้นที่กำลังทำอยู่ในข้อปัจจุบัน
  wrongCount: 0, // จำนวนครั้งที่ตอบผิดรวมทั้งข้อ
  hintCount: 0, // จำนวนครั้งที่กดขอคำใบ้เองรวมทั้งข้อ
  stepLog: [], // บันทึกผลแต่ละขั้น { answerText, wrong, hinted }
  revealedHints: new Set(), // ขั้นที่เปิดคำใบ้แล้ว
  finishedQuestion: false,
};

const showScreen = (screenId) => {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('screen--active'));
  $(screenId).classList.add('screen--active');
};

const currentQuestion = () => QUESTIONS[session.questionIndex];
const currentStep = () => currentQuestion()?.steps[session.stepIndex];

/* ======================================================================
 * หน้าจอที่ 1 — เลือกกลุ่ม
 * =================================================================== */
function renderGroupPicker() {
  const container = $('group-picker');
  container.innerHTML = '';

  GROUPS.forEach((group) => {
    const button = document.createElement('button');
    button.className = 'group-btn';
    button.dataset.groupId = group.id;
    button.style.setProperty('--group-color', group.color);
    button.innerHTML = `
      <span class="group-badge group-badge--lg">${group.short}</span>
      <span class="group-btn__name">${group.name}</span>
      <span class="group-btn__status" data-role="status">ยังไม่เริ่ม</span>`;
    button.addEventListener('click', () => startSession(group));
    container.appendChild(button);
  });

  // อัปเดตป้ายสถานะแบบ real-time เพื่อไม่ให้สองกลุ่มเลือกชนกัน
  backend.subscribeGroups((groups) => {
    Object.entries(groups ?? {}).forEach(([groupId, data]) => {
      const label = container.querySelector(`[data-group-id="${groupId}"] [data-role="status"]`);
      if (!label) return;
      label.textContent =
        data.status === 'finished'
          ? 'จบภารกิจแล้ว'
          : `กำลังทำข้อ ${Math.min((data.currentIndex ?? 0) + 1, QUESTIONS.length)} · ${data.totalScore ?? 0} คะแนน`;
      label.classList.add('is-active');
    });
  });
}

/** เริ่ม (หรือเล่นต่อ) ในนามของกลุ่มที่เลือก */
async function startSession(group) {
  session.group = group;

  const groups = await backend.getGroups();
  session.state = { ...createEmptyGroupState(group.id, group.name), ...(groups[group.id] ?? {}) };
  session.questionIndex = Math.min(session.state.currentIndex ?? 0, QUESTIONS.length);
  session.state.status = session.questionIndex >= QUESTIONS.length ? 'finished' : 'playing';

  backend.saveGroup(group.id, { name: group.name, status: session.state.status });

  $('hud-badge').textContent = group.short;
  $('hud-badge').style.setProperty('--group-color', group.color);
  $('hud-name').textContent = group.name;

  if (session.state.status === 'finished') {
    renderFinishScreen();
  } else {
    showScreen('screen-quest');
    loadQuestion();
  }
}

/* ======================================================================
 * หน้าจอที่ 2 — เล่นเกม
 * =================================================================== */

/** โหลดโจทย์ตาม session.questionIndex และรีเซ็ตสถานะของข้อนั้น */
function loadQuestion() {
  const question = currentQuestion();
  if (!question) return renderFinishScreen();

  // กู้ความก้าวหน้าเดิมของข้อนี้ (กรณีเผลอรีเฟรชหน้าระหว่างเล่น)
  const saved = session.state.progress?.[question.id] ?? {};
  session.stepIndex = Math.min(saved.stepIndex ?? 0, question.steps.length - 1);
  session.wrongCount = saved.wrongCount ?? 0;
  session.hintCount = saved.hintCount ?? 0;
  session.stepLog = Array.isArray(saved.stepLog) ? saved.stepLog : [];
  session.revealedHints = new Set();
  session.finishedQuestion = false;

  renderQuestionCard(question);
  renderLadder();
  $('solution-box').classList.add('hidden');
  updateHud();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderQuestionCard(question) {
  $('q-badge').textContent = `ด่านที่ ${session.questionIndex + 1} จาก ${QUESTIONS.length}`;
  $('q-difficulty').textContent = `ระดับ ${'●'.repeat(question.difficulty)}${'○'.repeat(3 - question.difficulty)}`;
  $('q-title').textContent = question.title;
  $('q-statement').innerHTML = question.statement;

  const body = $('q-figure-body');
  if (question.image?.src) {
    body.innerHTML = `<img src="${question.image.src}" alt="${question.image.alt ?? ''}" loading="lazy">`;
  } else {
    body.innerHTML = '';
  }
  $('q-figure-caption').textContent = question.image?.caption ?? '';
}

/* ---------------------- บันไดคำถามย่อย ---------------------- */

/** วาดบันไดทั้งหมดใหม่: ขั้นที่ผ่านแล้ว / ขั้นปัจจุบัน / ขั้นที่ยังล็อก */
function renderLadder() {
  const question = currentQuestion();
  const list = $('step-list');
  list.innerHTML = '';

  question.steps.forEach((step, index) => {
    const li = document.createElement('li');

    if (index < session.stepIndex) {
      li.className = 'step step--done';
      li.innerHTML = renderDoneStep(step, index);
    } else if (index === session.stepIndex && !session.finishedQuestion) {
      li.className = 'step step--active';
      li.innerHTML = renderActiveStep(step, index);
    } else if (index === session.stepIndex && session.finishedQuestion) {
      li.className = 'step step--done';
      li.innerHTML = renderDoneStep(step, index);
    } else {
      li.className = 'step step--locked';
      li.innerHTML = `
        <div class="step__head">
          <span class="step__label">${step.label}</span>
          <span class="step__goal">${step.goal}</span>
          <span class="step__status">${icon('lock', 16)}</span>
        </div>`;
    }
    list.appendChild(li);
  });

  $('ladder-counter').textContent = session.finishedQuestion
    ? 'ครบทุกขั้นแล้ว'
    : `ขั้นที่ ${session.stepIndex + 1} / ${question.steps.length}`;

  if (!session.finishedQuestion) bindActiveStep();
}

/** ขั้นที่ตอบผ่านแล้ว — ย่อให้เหลือคำตอบกับคำอธิบายสั้น ๆ */
function renderDoneStep(step, index) {
  const log = session.stepLog[index] ?? {};
  return `
    <div class="step__head">
      <span class="step__label">${step.label}</span>
      <span class="step__goal">${step.goal}</span>
      <span class="step__status step__status--ok">${icon('check', 16)}</span>
    </div>
    <p class="step__answered">ตอบ: <b>${log.answerText ?? '—'}</b></p>
    <p class="step__explain">${step.explain}</p>`;
}

/** ขั้นที่กำลังทำ — แสดงคำถามและช่องตอบ */
function renderActiveStep(step, index) {
  const answerArea =
    step.type === 'number'
      ? `<div class="input-row">
           <input id="step-input" type="text" inputmode="decimal" autocomplete="off"
                  placeholder="พิมพ์คำตอบเป็นตัวเลข">
           <span class="input-unit">${step.unit ?? ''}</span>
         </div>`
      : `<div id="step-choices" class="answer-choice">
           ${step.options
             .map(
               (option, i) => `
             <button type="button" class="choice" data-index="${i}">
               <span class="choice__key">${'กขคงจ'[i] ?? i + 1}</span><span>${option}</span>
             </button>`,
             )
             .join('')}
         </div>`;

  const hintShown = session.revealedHints.has(index);

  return `
    <div class="step__head">
      <span class="step__label">${step.label}</span>
      <span class="step__goal">${step.goal}</span>
      <span class="step__status step__status--now">${icon('target', 16)}</span>
    </div>
    <p class="step__prompt">${step.prompt}</p>
    ${answerArea}
    <div class="step__actions">
      <button id="btn-submit" class="btn btn--primary">ส่งคำตอบขั้นนี้</button>
      <button id="btn-hint" class="btn btn--ghost" ${hintShown ? 'disabled' : ''}>
        ${icon('bulb', 16)} ขอคำใบ้
      </button>
    </div>
    <p id="feedback" class="feedback hidden"></p>
    <div id="hint-box" class="hint-box ${hintShown ? '' : 'hidden'}">
      <h4 class="hint-box__title">${icon('bulb', 15)} คำใบ้ของขั้นนี้</h4>
      <p>${step.hint}</p>
    </div>`;
}

/** ผูกอีเวนต์ให้องค์ประกอบของขั้นที่กำลังทำ (ต้องเรียกใหม่ทุกครั้งที่ re-render) */
function bindActiveStep() {
  const step = currentStep();
  if (!step) return;

  $('btn-submit')?.addEventListener('click', handleSubmit);
  $('btn-hint')?.addEventListener('click', handleHintRequest);
  $('step-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleSubmit();
  });
  $('step-input')?.focus();

  document.querySelectorAll('#step-choices .choice').forEach((choice) => {
    choice.addEventListener('click', () => {
      document.querySelectorAll('#step-choices .choice').forEach((el) => el.classList.remove('is-selected'));
      choice.classList.add('is-selected');
    });
  });
}

/** อัปเดตแถบสถานะด้านบน */
function updateHud() {
  const heartsLeft = Math.max(0, APP_CONFIG.maxHearts - session.wrongCount);
  $('hud-hearts').innerHTML = hearts(heartsLeft, APP_CONFIG.maxHearts, 17);
  $('hud-score').textContent = session.state.totalScore ?? 0;
  $('hud-progress-text').textContent = `ข้อ ${session.questionIndex + 1} จาก ${QUESTIONS.length}`;

  // ความก้าวหน้าแบบละเอียด: นับเป็นขั้น ไม่ใช่นับเป็นข้อ
  const stepsDone = QUESTIONS.slice(0, session.questionIndex).reduce((s, q) => s + q.steps.length, 0)
    + session.stepIndex;
  const stepsAll = QUESTIONS.reduce((s, q) => s + q.steps.length, 0);
  $('hud-progress-bar').style.width = `${(stepsDone / stepsAll) * 100}%`;
}

/* ---------------------- ตรวจคำตอบของขั้น ---------------------- */

/** คืน { ok, text } ; ok เป็น null เมื่อยังไม่ได้ตอบ */
function readAnswer(step) {
  if (step.type === 'number') {
    const raw = $('step-input').value.trim().replace(/[,\s]/g, '');
    if (raw === '') return { ok: null, text: '' };
    const value = Number(raw);
    if (Number.isNaN(value)) return { ok: false, text: $('step-input').value.trim() };
    return { ok: Math.abs(value - step.value) <= APP_CONFIG.numericTolerance, text: raw };
  }

  const selected = document.querySelector('#step-choices .choice.is-selected');
  if (!selected) return { ok: null, text: '' };
  const index = Number(selected.dataset.index);
  // เก็บเป็นข้อความล้วน เพื่อให้ครูอ่านง่ายในกระดาน
  const text = `${'กขคงจ'[index] ?? index + 1}) ${stripTags(step.options[index])}`;
  return { ok: index === step.correctIndex, text };
}

const stripTags = (html) => html.replace(/<[^>]*>/g, '');

/** คะแนนที่จะได้ของข้อนี้ ณ ตอนนี้ */
function currentQuestionScore() {
  if (session.wrongCount >= APP_CONFIG.maxHearts) return 0; // หัวใจหมด = ไม่ได้คะแนน
  const raw =
    APP_CONFIG.basePoints
    - session.wrongCount * APP_CONFIG.penaltyPerWrong
    - session.hintCount * APP_CONFIG.penaltyPerHint;
  return Math.max(APP_CONFIG.minPoints, raw);
}

function showFeedback(message, tone) {
  const node = $('feedback');
  if (!node) return;
  node.className = `feedback feedback--${tone}`;
  node.innerHTML = message;
}

/** บันทึกความก้าวหน้าของข้อปัจจุบันขึ้น backend */
function persistProgress(extra = {}) {
  const question = currentQuestion();
  const previous = session.state.progress?.[question.id] ?? {};
  const record = {
    status: 'in_progress',
    score: 0,
    wrongAnswers: [],
    ...previous,
    order: session.questionIndex + 1,
    title: question.title,
    stepIndex: session.stepIndex,
    stepTotal: question.steps.length,
    wrongCount: session.wrongCount,
    hintCount: session.hintCount,
    stepLog: session.stepLog,
    ...extra,
  };

  session.state.progress = { ...(session.state.progress ?? {}), [question.id]: record };

  backend.saveGroup(session.group.id, {
    name: session.group.name,
    status: 'playing',
    currentIndex: session.questionIndex,
    currentStep: session.stepIndex,
    totalScore: session.state.totalScore ?? 0,
    hearts: Math.max(0, APP_CONFIG.maxHearts - session.wrongCount),
    progress: session.state.progress,
  });
}

/* ---------------------- การกระทำของผู้เล่น ---------------------- */

function handleSubmit() {
  const question = currentQuestion();
  const step = currentStep();
  const { ok, text } = readAnswer(step);

  if (ok === null) {
    showFeedback('กรุณาเลือกหรือพิมพ์คำตอบก่อนกดส่งนะครับ', 'warn');
    return;
  }

  if (ok) {
    // ---- ตอบถูก: บันทึกผลขั้นนี้แล้วปลดล็อกขั้นถัดไป ----
    session.stepLog[session.stepIndex] = {
      answerText: text,
      hinted: session.revealedHints.has(session.stepIndex),
    };

    const isLastStep = session.stepIndex + 1 >= question.steps.length;
    if (isLastStep) {
      finishQuestion();
    } else {
      session.stepIndex += 1;
      persistProgress();
      renderLadder();
      updateHud();
      showFeedback('ถูกต้อง ไปต่อขั้นถัดไปได้เลย', 'success');
      document.querySelector('.step--active')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  // ---- ตอบผิด ----
  session.wrongCount += 1;
  const wrongAnswers = [
    ...(session.state.progress?.[question.id]?.wrongAnswers ?? []),
    `${step.label}: ${text}`,
  ];

  if (session.wrongCount >= APP_CONFIG.revealAfterWrong) {
    persistProgress({ status: 'revealed', score: 0, wrongAnswers, finishedAt: Date.now() });
    revealWholeQuestion();
    return;
  }

  // เปิดคำใบ้ของขั้นนี้ให้อัตโนมัติ (scaffolding — ยังไม่เฉลยคำตอบ)
  const hadHint = session.revealedHints.has(session.stepIndex);
  session.revealedHints.add(session.stepIndex);
  if (!hadHint) {
    $('hint-box')?.classList.remove('hidden');
    const hintButton = $('btn-hint');
    if (hintButton) hintButton.disabled = true;
  }

  const heartsLeft = Math.max(0, APP_CONFIG.maxHearts - session.wrongCount);
  if (heartsLeft === 0) {
    showFeedback(
      `พลังชีวิตหมดแล้ว ข้อนี้จะไม่ได้คะแนน แต่ยังเดินต่อจนจบได้
       (ตอบผิดอีก <b>${APP_CONFIG.revealAfterWrong - session.wrongCount} ครั้ง</b> ระบบจะเฉลยให้)
       ลองอ่านคำใบ้ด้านล่างอีกครั้ง`,
      'warn',
    );
  } else {
    showFeedback(
      `ยังไม่ถูก เหลือพลังชีวิต <b>${heartsLeft}</b> ดวง — เปิดคำใบ้ของขั้นนี้ให้แล้วด้านล่าง`,
      'error',
    );
  }

  persistProgress({ wrongAnswers });
  updateHud();
}

/** ขอคำใบ้เอง : ไม่เสียหัวใจ แต่หักคะแนน */
function handleHintRequest() {
  if (session.revealedHints.has(session.stepIndex)) return;
  session.revealedHints.add(session.stepIndex);
  session.hintCount += 1;

  $('hint-box')?.classList.remove('hidden');
  const hintButton = $('btn-hint');
  if (hintButton) hintButton.disabled = true;

  showFeedback(`เปิดคำใบ้แล้ว — ถ้าทำข้อนี้สำเร็จจะได้ ${currentQuestionScore()} คะแนน`, 'info');
  persistProgress();
}

/** เดินครบทุกขั้นแล้ว — คิดคะแนนและแสดงเฉลยเต็ม */
function finishQuestion() {
  const question = currentQuestion();
  const earned = currentQuestionScore();
  session.state.totalScore = (session.state.totalScore ?? 0) + earned;
  session.finishedQuestion = true;

  persistProgress({ status: 'solved', score: earned, finishedAt: Date.now() });
  renderLadder();
  updateHud();

  $('solution-icon').innerHTML = icon('book', 17);
  $('solution-body').innerHTML = `
    <p class="solution-box__verdict">
      ${icon('check', 16)} ทำครบทุกขั้นแล้ว ได้ <b>${earned} คะแนน</b>
      ${earned === 0 ? '(ไม่ได้คะแนนเพราะพลังชีวิตหมด แต่สำคัญที่เข้าใจวิธีคิด)' : ''}
    </p>
    ${question.solution}`;
  showSolutionBox();
}

/** ตอบผิดครบเกณฑ์ — เฉลยทั้งข้อ */
function revealWholeQuestion() {
  const question = currentQuestion();
  session.finishedQuestion = true;
  renderLadder();
  updateHud();

  $('solution-icon').innerHTML = icon('book', 17);
  $('solution-body').innerHTML = `
    <p class="solution-box__verdict solution-box__verdict--reveal">
      ไม่เป็นไรครับ ลองอ่านวิธีทำทั้งหมดด้านล่าง แล้วไปลุยข้อต่อไปกัน
    </p>
    ${question.solution}`;
  showSolutionBox();
}

function showSolutionBox() {
  const isLast = session.questionIndex + 1 >= QUESTIONS.length;
  $('btn-next').innerHTML = `${isLast ? 'ดูสรุปผลภารกิจ' : 'ไปข้อถัดไป'} ${icon('arrowRight', 16)}`;
  $('solution-box').classList.remove('hidden');
  $('solution-box').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function handleNext() {
  session.questionIndex += 1;

  if (session.questionIndex >= QUESTIONS.length) {
    session.state.currentIndex = QUESTIONS.length;
    session.state.status = 'finished';
    backend.saveGroup(session.group.id, {
      status: 'finished',
      currentIndex: QUESTIONS.length,
      totalScore: session.state.totalScore ?? 0,
      finishedAt: Date.now(),
    });
    return renderFinishScreen();
  }

  session.state.currentIndex = session.questionIndex;
  backend.saveGroup(session.group.id, { currentIndex: session.questionIndex, currentStep: 0 });
  loadQuestion();
}

/* ======================================================================
 * หน้าจอที่ 3 — สรุปผล
 * =================================================================== */
function renderFinishScreen() {
  const maxScore = QUESTIONS.length * APP_CONFIG.basePoints;
  $('finish-icon').innerHTML = icon('flag', 46);
  $('finish-group').textContent = session.group.name;
  $('finish-score').textContent = session.state.totalScore ?? 0;
  $('finish-max').textContent = maxScore;

  const tbody = $('finish-tbody');
  tbody.innerHTML = '';
  QUESTIONS.forEach((question, index) => {
    const record = session.state.progress?.[question.id];
    const verdict =
      record?.status === 'solved' ? 'เดินครบทุกขั้น'
      : record?.status === 'revealed' ? 'ระบบเฉลยให้'
      : 'ยังไม่ได้ทำ';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}. ${question.title}</td>
      <td>${verdict}</td>
      <td>${record?.wrongCount ?? 0} ครั้ง</td>
      <td>${record?.hintCount ?? 0} ครั้ง</td>
      <td><b>${record?.score ?? 0}</b></td>`;
    tbody.appendChild(row);
  });

  showScreen('screen-finish');
}

/* ======================================================================
 * เริ่มต้นระบบ
 * =================================================================== */
$('btn-next').addEventListener('click', handleNext);
renderGroupPicker();
