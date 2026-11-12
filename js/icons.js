/**
 * icons.js
 * ------------------------------------------------------------------
 * ชุดไอคอน SVG ของระบบ — ใช้แทน emoji ทั้งหมด
 *
 * เหตุผลที่ไม่ใช้ emoji: หน้าตาต่างกันในแต่ละระบบปฏิบัติการและเบราว์เซอร์
 * ควบคุมสี/ขนาดไม่ได้ และอ่านด้วย screen reader ได้ไม่ดี
 * ไอคอนในไฟล์นี้ใช้ currentColor จึงรับสีจาก CSS ได้ทั้งหมด
 *
 * วิธีใช้:  element.innerHTML = icon('heart', 18);
 * ------------------------------------------------------------------
 */

const PATHS = {
  // หัวใจเต็ม / หัวใจว่าง (ใช้คู่กันเพื่อแสดงพลังชีวิต)
  heart: '<path d="M12 20.5 3.8 12.6a5.1 5.1 0 0 1 7.2-7.2l1 1 1-1a5.1 5.1 0 0 1 7.2 7.2z" fill="currentColor"/>',
  heartEmpty: '<path d="M12 20.5 3.8 12.6a5.1 5.1 0 0 1 7.2-7.2l1 1 1-1a5.1 5.1 0 0 1 7.2 7.2z" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.45"/>',

  // สถานะการตอบ
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  cross: '<path d="M6 6 18 18 M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',

  // คำใบ้ / เฉลย
  bulb: '<path d="M9 18h6M10 21h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.1.9 1.8v.3h5.2v-.3c0-.7.3-1.3.9-1.8A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  book: '<path d="M4 5.5A2 2 0 0 1 6 3.5h13v15H6a2 2 0 0 0-2 2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 18.5a2 2 0 0 1 2-2h13" fill="none" stroke="currentColor" stroke-width="1.8"/>',

  // นำทาง / สถานะด่าน
  arrowRight: '<path d="M5 12h13M12.5 5.5 19 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  flag: '<path d="M6 21V4M6 4h11l-2.2 3.6L17 11H6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  target: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/>',

  // หน้าแรก / บทบาท
  student: '<path d="M3 8.6 12 4.5l9 4.1-9 4.1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 10.6v4.6c0 1.6 2.2 2.8 5 2.8s5-1.2 5-2.8v-4.6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  dashboard: '<rect x="3.5" y="4" width="17" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 16v-4M12 16V8.5M16 16v-2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',

  // เครื่องมือของครู
  reset: '<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M19.8 4.5v4.2h-4.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  chevron: '<path d="M9 5.5 15.5 12 9 18.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};

/**
 * คืนสตริง SVG ของไอคอน
 * @param {keyof PATHS} name ชื่อไอคอน
 * @param {number} size ขนาดเป็น px
 */
export function icon(name, size = 20) {
  const body = PATHS[name];
  if (!body) return '';
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${body}</svg>`;
}

/**
 * แถบหัวใจ เช่น hearts(2, 3) => หัวใจเต็ม 2 ดวง + หัวใจว่าง 1 ดวง
 */
export function hearts(remaining, total, size = 18) {
  let out = '';
  for (let i = 0; i < total; i += 1) {
    out += `<span class="heart ${i < remaining ? 'heart--on' : 'heart--off'}">${icon(i < remaining ? 'heart' : 'heartEmpty', size)}</span>`;
  }
  return out;
}
