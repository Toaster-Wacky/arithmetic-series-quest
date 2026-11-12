/**
 * config.js
 * ------------------------------------------------------------------
 * ไฟล์ตั้งค่าเดียวของระบบ — แก้ที่นี่ที่เดียวพอ
 *
 * หมายเหตุ: ไฟล์นี้ถูกส่งไปที่เบราว์เซอร์ของนักเรียน จึงเป็นข้อมูล "สาธารณะ" เสมอ
 *     ค่า apiKey ของ Firebase ไม่ใช่ "รหัสลับ" แต่เป็นตัวระบุโปรเจกต์
 *     การป้องกันที่แท้จริงอยู่ที่ Security Rules + HTTP Referrer restrictions
 *     อ่านขั้นตอนทั้งหมดใน README.md หัวข้อ "ความปลอดภัย"
 * ------------------------------------------------------------------
 */

/**
 * ค่าที่ได้จาก Firebase Console → Project settings → Your apps → Web app
 * ถ้ายังไม่ได้ตั้งค่า (ปล่อยเป็น PASTE_... ไว้) ระบบจะทำงานใน "โหมดออฟไลน์"
 * โดยเก็บข้อมูลลง localStorage ของเครื่องนั้น ๆ แทน (ใช้ซ้อมหรือสอนเครื่องเดียวได้)
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBTyxuquu-Qnzss6salbDLTAa8LRhglZ0k',
  authDomain: 'arichmetric.firebaseapp.com',
  databaseURL: 'https://arichmetric-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'arichmetric',
  storageBucket: 'arichmetric.firebasestorage.app',
  messagingSenderId: '946485830716',
  appId: '1:946485830716:web:2049b5b2e3fc588988cf39',
};

/** ตั้งค่าเกี่ยวกับตัวเกมและห้องเรียน */
export const APP_CONFIG = {
  /** รหัสห้องเรียน — เปลี่ยนค่านี้เพื่อ "ล้างกระดาน" เริ่มคาบใหม่ เช่น 'M5-1-2568-W1' */
  roomCode: 'ARITH-SERIES-01',

  /** จำนวนกลุ่มผู้เล่น */
  groupCount: 6,

  /** หัวใจเริ่มต้นของแต่ละข้อ (เริ่มใหม่ทุกข้อ ไม่ใช่ต่อขั้น) */
  maxHearts: 3,

  /** ตอบผิดรวมกี่ครั้งในข้อนั้น ระบบจึงเฉลยทั้งข้อให้ */
  revealAfterWrong: 5,

  /** คะแนนเต็มของแต่ละข้อ เมื่อผ่านทุกขั้นโดยไม่ผิดและไม่เปิดคำใบ้ */
  basePoints: 100,

  /** หักคะแนนต่อการตอบผิด 1 ครั้ง (นับรวมทุกขั้นในข้อนั้น) */
  penaltyPerWrong: 20,

  /** หักคะแนนต่อการกดขอคำใบ้ 1 ครั้ง (ไม่เสียหัวใจ) */
  penaltyPerHint: 10,

  /** คะแนนขั้นต่ำที่ยังได้ ถ้าทำสำเร็จทุกขั้นโดยหัวใจยังไม่หมด */
  minPoints: 20,

  /** รหัสผ่านอย่างง่ายสำหรับปุ่มรีเซ็ตในกระดานครู (กันนักเรียนกดเล่น) */
  teacherPin: '1234',

  /** ค่าคลาดเคลื่อนที่ยอมรับได้สำหรับคำตอบแบบพิมพ์ตัวเลข */
  numericTolerance: 1e-6,
};

/**
 * ชื่อและสีประจำกลุ่ม (ไม่ใช้ emoji — ใช้ตัวเลขบนตราสีแทน
 * เพื่อให้หน้าตาเหมือนกันทุกเครื่องและควบคุมธีมสีได้)
 */
const GROUP_COLORS = ['#6c5ce7', '#22d3a7', '#ffb340', '#4cc9f0', '#ff6b81', '#a78bfa'];

export const GROUPS = Array.from({ length: APP_CONFIG.groupCount }, (_, i) => ({
  id: `group-${i + 1}`,
  name: `กลุ่มที่ ${i + 1}`,
  short: String(i + 1),
  color: GROUP_COLORS[i % GROUP_COLORS.length],
}));

/** ตรวจว่าผู้ใช้กรอกค่า Firebase จริงหรือยัง */
export const isFirebaseConfigured = () =>
  !Object.values(FIREBASE_CONFIG).some((value) => String(value).startsWith('PASTE_'));
