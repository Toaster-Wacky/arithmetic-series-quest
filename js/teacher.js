/**
 * teacher.js
 * ------------------------------------------------------------------
 * ตรรกะของ "กระดานสำหรับครู" (Teacher Dashboard)
 *
 * หน้าที่หลัก
 *  1. ฟังข้อมูลทุกกลุ่มแบบ real-time แล้ววาดใหม่ทุกครั้งที่มีการเปลี่ยนแปลง
 *  2. ตารางภาพรวม กลุ่ม × ข้อ — เห็นในพริบตาว่าใครติดข้อไหน และติดที่ "ขั้นไหน"
 *  3. แสดงคำตอบที่ผิดรายขั้น เพื่อวิเคราะห์ความเข้าใจคลาดเคลื่อน
 *  4. ปุ่มรีเซ็ต (ทั้งห้อง / รายกลุ่ม) ป้องกันด้วย PIN อย่างง่าย
 *
 * หน้านี้ "อ่านอย่างเดียว" ยกเว้นการรีเซ็ต จึงไม่แตะ state ของเกม
 * ------------------------------------------------------------------
 */

import { APP_CONFIG, GROUPS, isFirebaseConfigured } from './config.js';
import { QUESTIONS } from './questions.js';
import { getBackend } from './backend.js';
import { icon, hearts } from './icons.js';

const backend = getBackend();
const $ = (id) => document.getElementById(id);

/* ======================================================================
 * ส่วนหัว
 * =================================================================== */
function renderHeader() {
  $('meta-room').textContent = APP_CONFIG.roomCode;
  $('btn-reset-all').innerHTML = `${icon('reset', 16)} รีเซ็ตทั้งห้อง`;

  const badge = $('meta-mode');
  if (isFirebaseConfigured()) {
    badge.className = 'badge badge--online';
    badge.textContent = 'เรียลไทม์ผ่าน Firebase';
  } else {
    badge.className = 'badge badge--offline';
    badge.textContent = 'โหมดออฟไลน์ (เฉพาะเครื่องนี้)';
  }
}

/* ======================================================================
 * แถบ KPI สรุปภาพรวม
 * =================================================================== */
function renderKpi(snapshot) {
  const records = Object.values(snapshot);
  const started = records.filter((group) => (group.currentIndex ?? 0) > 0 || group.status === 'playing');
  const finished = records.filter((group) => group.status === 'finished');

  $('kpi-active').textContent = `${started.length} / ${GROUPS.length}`;
  $('kpi-finished').textContent = String(finished.length);

  // นับจำนวนครั้งที่ตอบผิดรวมของแต่ละข้อ เพื่อหาข้อที่ "สะดุด" มากที่สุดของห้อง
  const wrongByQuestion = new Map();
  records.forEach((group) => {
    Object.entries(group.progress ?? {}).forEach(([questionId, record]) => {
      wrongByQuestion.set(questionId, (wrongByQuestion.get(questionId) ?? 0) + (record.wrongCount ?? 0));
    });
  });
  const hardest = [...wrongByQuestion.entries()].sort((a, b) => b[1] - a[1])[0];
  if (hardest && hardest[1] > 0) {
    const index = QUESTIONS.findIndex((question) => question.id === hardest[0]);
    $('kpi-hardest').textContent = `ข้อ ${index + 1} · ผิด ${hardest[1]} ครั้ง`;
  } else {
    $('kpi-hardest').textContent = '—';
  }

  const average = records.length
    ? Math.round(records.reduce((sum, group) => sum + (group.totalScore ?? 0), 0) / records.length)
    : 0;
  $('kpi-average').textContent = String(average);
}

/* ======================================================================
 * ตารางภาพรวม กลุ่ม × ข้อ
 * =================================================================== */
function renderMatrix(snapshot) {
  $('matrix-head').innerHTML = `<tr>
      <th class="matrix__corner">กลุ่ม</th>
      ${QUESTIONS.map((question, index) =>
        `<th title="${question.title}"><span class="matrix__qnum">${index + 1}</span></th>`).join('')}
      <th class="matrix__total">คะแนน</th>
    </tr>`;

  $('matrix-body').innerHTML = GROUPS.map((group) => {
    const data = snapshot[group.id];
    const currentIndex = data?.currentIndex ?? 0;

    const cells = QUESTIONS.map((question, index) => {
      const record = data?.progress?.[question.id];
      let modifier = 'idle';
      let label = '';

      if (record?.status === 'solved') {
        modifier = 'solved';
        label = String(record.score ?? 0);
      } else if (record?.status === 'revealed') {
        modifier = 'revealed';
        label = '0';
      } else if (data && index === currentIndex && data.status === 'playing') {
        // กำลังทำอยู่ — บอกด้วยว่าเดินมาถึงขั้นที่เท่าไรของบันได
        modifier = 'current';
        const step = (record?.stepIndex ?? 0) + 1;
        label = `${step}/${question.steps.length}`;
      }

      const wrong = record?.wrongCount ?? 0;
      const wrongTag = wrong > 0 ? `<em class="matrix__wrong">${wrong}</em>` : '';
      return `<td><span class="cell cell--${modifier}">${label}${wrongTag}</span></td>`;
    }).join('');

    return `<tr>
        <th class="matrix__group">
          <span class="group-badge" style="--group-color:${group.color}">${group.short}</span>
          ${group.name}
        </th>
        ${cells}
        <td class="matrix__total"><b>${data?.totalScore ?? 0}</b></td>
      </tr>`;
  }).join('');
}

/* ======================================================================
 * การ์ดรายกลุ่ม
 * =================================================================== */
function renderGroupCards(snapshot) {
  const grid = $('group-grid');
  grid.innerHTML = '';

  GROUPS.forEach((group) => {
    const data = snapshot[group.id];
    const currentIndex = data?.currentIndex ?? 0;
    const donePercent = Math.round((Math.min(currentIndex, QUESTIONS.length) / QUESTIONS.length) * 100);
    const heartsLeft = data?.hearts ?? APP_CONFIG.maxHearts;

    // รวบรวมคำตอบที่ผิดของทุกข้อ พร้อมบอกว่าผิดที่ขั้นไหน
    const mistakes = Object.entries(data?.progress ?? {})
      .filter(([, record]) => (record.wrongAnswers ?? []).length > 0)
      .map(([questionId, record]) => {
        const index = QUESTIONS.findIndex((question) => question.id === questionId);
        const answers = (record.wrongAnswers ?? [])
          .map((answer) => `<code>${escapeHtml(answer)}</code>`)
          .join(' ');
        return `<li><b>ข้อ ${index + 1}</b> ${QUESTIONS[index]?.title ?? ''}<br>${answers}</li>`;
      })
      .join('');

    let statusLabel = 'ยังไม่เริ่ม';
    if (data?.status === 'finished') {
      statusLabel = 'จบภารกิจแล้ว';
    } else if (data?.status === 'playing') {
      const question = QUESTIONS[Math.min(currentIndex, QUESTIONS.length - 1)];
      const record = data.progress?.[question.id];
      const step = (record?.stepIndex ?? 0) + 1;
      statusLabel = `ข้อ ${Math.min(currentIndex + 1, QUESTIONS.length)} · ขั้นที่ ${step}/${question.steps.length}`;
    }

    const card = document.createElement('article');
    card.className = `dash-card ${data ? '' : 'dash-card--empty'}`;
    card.innerHTML = `
      <header class="dash-card__head">
        <span class="group-badge" style="--group-color:${group.color}">${group.short}</span>
        <div class="dash-card__id">
          <strong>${group.name}</strong>
          <span>${statusLabel}</span>
        </div>
        <span class="dash-card__score">${data?.totalScore ?? 0}</span>
      </header>

      <div class="progress-track progress-track--sm">
        <div class="progress-track__fill" style="width:${donePercent}%"></div>
      </div>
      <p class="dash-card__meta">
        <span>ความก้าวหน้า ${donePercent}%</span>
        ${data?.status === 'finished'
          ? '<span>ทำครบทุกข้อแล้ว</span>'
          : data
            ? `<span class="dash-card__hearts">${hearts(heartsLeft, APP_CONFIG.maxHearts, 14)}</span>`
            : '<span>ยังไม่เข้าสู่ระบบ</span>'}
      </p>

      <details class="dash-card__mistakes" ${mistakes ? '' : 'hidden'}>
        <summary>ดูคำตอบที่ผิด</summary>
        <ul>${mistakes}</ul>
      </details>

      <button class="btn btn--ghost btn--sm" data-reset="${group.id}">รีเซ็ตกลุ่มนี้</button>`;

    card.querySelector('[data-reset]').addEventListener('click', () => resetGroup(group));
    grid.appendChild(card);
  });
}

/** กัน HTML injection จากข้อความที่นักเรียนพิมพ์เข้ามา */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

/* ======================================================================
 * ปุ่มรีเซ็ต (ป้องกันด้วย PIN อย่างง่าย)
 * =================================================================== */
function verifyPin() {
  const input = window.prompt('ใส่ PIN ของครูเพื่อยืนยันการรีเซ็ต');
  if (input === null) return false;
  if (input !== APP_CONFIG.teacherPin) {
    window.alert('PIN ไม่ถูกต้อง');
    return false;
  }
  return true;
}

async function resetGroup(group) {
  if (!window.confirm(`ลบข้อมูลของ ${group.name} ทั้งหมด? การกระทำนี้ย้อนกลับไม่ได้`)) return;
  if (!verifyPin()) return;
  await backend.resetGroup(group.id);
}

async function resetRoom() {
  if (!window.confirm('ลบข้อมูลของทุกกลุ่มในห้องนี้? การกระทำนี้ย้อนกลับไม่ได้')) return;
  if (!verifyPin()) return;
  await backend.resetRoom();
}

/* ======================================================================
 * เริ่มต้นระบบ — ฟังข้อมูลครั้งเดียว แล้ววาดใหม่ทุกครั้งที่เปลี่ยน
 * =================================================================== */
renderHeader();
$('btn-reset-all').addEventListener('click', resetRoom);

backend.subscribeGroups((snapshot) => {
  const data = snapshot ?? {};
  renderKpi(data);
  renderMatrix(data);
  renderGroupCards(data);
});
