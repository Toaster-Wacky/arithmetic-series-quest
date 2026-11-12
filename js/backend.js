/**
 * backend.js
 * ------------------------------------------------------------------
 * ชั้นเชื่อมต่อข้อมูล (Data Layer) — แยกออกจาก UI ทั้งหมด
 *
 * ให้ "สัญญา" (interface) เดียวกันกับทั้งหน้านักเรียนและกระดานครู:
 *
 *   backend.mode                       -> 'firebase' | 'offline'
 *   backend.getGroups()                -> อ่านข้อมูลทุกกลุ่มครั้งเดียว (Promise)
 *   backend.subscribeGroups(callback)  -> คืนฟังก์ชัน unsubscribe
 *   backend.saveGroup(groupId, patch)  -> เขียนทับเฉพาะ field ที่ส่งมา
 *   backend.resetRoom()                -> ล้างข้อมูลทั้งห้อง
 *   backend.resetGroup(groupId)        -> ล้างข้อมูลเฉพาะกลุ่ม
 *
 * มี 2 การทำงานเบื้องหลัง:
 *   1) FirebaseBackend  — Realtime Database (ใช้จริงในห้องเรียน หลายเครื่อง)
 *   2) OfflineBackend   — localStorage + BroadcastChannel (ซ้อม/เดโมเครื่องเดียว)
 * ------------------------------------------------------------------
 */

import { FIREBASE_CONFIG, APP_CONFIG, isFirebaseConfigured } from './config.js';

/** โครงสร้างข้อมูลเริ่มต้นของหนึ่งกลุ่ม */
export function createEmptyGroupState(groupId, name) {
  return {
    groupId,
    name,
    status: 'idle', // 'idle' | 'playing' | 'finished'
    currentIndex: 0, // ลำดับข้อที่กำลังทำ (เริ่มที่ 0)
    totalScore: 0,
    hearts: APP_CONFIG.maxHearts,
    updatedAt: Date.now(),
    progress: {}, // { [questionId]: { status, wrongCount, hintLevel, score, wrongAnswers[] } }
  };
}

/* ========================================================================
 * 1) Firebase Realtime Database
 * ===================================================================== */
class FirebaseBackend {
  constructor() {
    this.mode = 'firebase';
    // สำคัญ: ต้องตั้งค่า _roomPath ตรงนี้ (ไม่ใช่ใน _init) เพราะเมธอดอื่น
    // อ่านค่านี้แบบ synchronous ก่อนจะ await _ready ถ้าไปตั้งใน _init
    // หน้าที่เรียก subscribeGroups ทันทีตอนโหลด (เช่นกระดานครู) จะได้ path
    // เป็น undefined ซึ่งชี้ไปที่ root ของฐานข้อมูล แล้วโดน Rules ปฏิเสธเงียบ ๆ
    this._roomPath = `rooms/${APP_CONFIG.roomCode}/groups`;
    this._ready = this._init();
  }

  /** โหลด SDK แบบ dynamic import เพื่อไม่ให้โหมดออฟไลน์ต้องพึ่งอินเทอร์เน็ต */
  async _init() {
    const appModule = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const dbModule = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js');

    this._db = dbModule;
    const app = appModule.initializeApp(FIREBASE_CONFIG);
    this._database = dbModule.getDatabase(app);
  }

  async _ref(path) {
    await this._ready;
    return this._db.ref(this._database, path);
  }

  /** อ่านข้อมูลทุกกลุ่มครั้งเดียว (ใช้ตอนเข้าสู่ระบบเพื่อกู้ความก้าวหน้าเดิม) */
  async getGroups() {
    const groupsRef = await this._ref(this._roomPath);
    const snapshot = await this._db.get(groupsRef);
    return snapshot.val() ?? {};
  }

  /** ฟังการเปลี่ยนแปลงของทุกกลุ่มแบบ real-time */
  subscribeGroups(callback) {
    let detach = () => {};
    this._ref(this._roomPath).then((groupsRef) => {
      const unsubscribe = this._db.onValue(
        groupsRef,
        (snapshot) => callback(snapshot.val() ?? {}),
        // ถ้า Rules ปฏิเสธหรือเน็ตมีปัญหา ต้องเห็นสาเหตุ ไม่ใช่หน้าจอว่างเปล่าเงียบ ๆ
        (error) => console.error('[backend] อ่านข้อมูลจาก Firebase ไม่สำเร็จ:', error.message),
      );
      detach = unsubscribe;
    });
    return () => detach();
  }

  /** อัปเดตเฉพาะบางฟิลด์ของกลุ่ม (merge ไม่ทับทั้งก้อน) */
  async saveGroup(groupId, patch) {
    const groupRef = await this._ref(`${this._roomPath}/${groupId}`);
    await this._db.update(groupRef, { ...patch, updatedAt: Date.now() });
  }

  async resetGroup(groupId) {
    const groupRef = await this._ref(`${this._roomPath}/${groupId}`);
    await this._db.remove(groupRef);
  }

  async resetRoom() {
    const roomRef = await this._ref(this._roomPath);
    await this._db.remove(roomRef);
  }
}

/* ========================================================================
 * 2) โหมดออฟไลน์ — localStorage (ใช้เมื่อยังไม่ได้ใส่คีย์ Firebase)
 *    ซิงก์ข้ามแท็บในเครื่องเดียวกันผ่าน BroadcastChannel + storage event
 * ===================================================================== */
class OfflineBackend {
  constructor() {
    this.mode = 'offline';
    this._storageKey = `arith-quest:${APP_CONFIG.roomCode}`;
    this._listeners = new Set();
    this._channel = 'BroadcastChannel' in window ? new BroadcastChannel(this._storageKey) : null;

    // รับสัญญาณจากแท็บอื่นในเครื่องเดียวกัน
    this._channel?.addEventListener('message', () => this._emit());
    window.addEventListener('storage', (event) => {
      if (event.key === this._storageKey) this._emit();
    });
  }

  _readAll() {
    try {
      return JSON.parse(localStorage.getItem(this._storageKey) ?? '{}');
    } catch {
      return {};
    }
  }

  _writeAll(data) {
    localStorage.setItem(this._storageKey, JSON.stringify(data));
    this._channel?.postMessage('changed');
    this._emit();
  }

  _emit() {
    const snapshot = this._readAll();
    this._listeners.forEach((listener) => listener(snapshot));
  }

  async getGroups() {
    return this._readAll();
  }

  subscribeGroups(callback) {
    this._listeners.add(callback);
    callback(this._readAll()); // ส่งค่าปัจจุบันทันทีเหมือน onValue ของ Firebase
    return () => this._listeners.delete(callback);
  }

  async saveGroup(groupId, patch) {
    const all = this._readAll();
    all[groupId] = { ...(all[groupId] ?? {}), ...patch, updatedAt: Date.now() };
    this._writeAll(all);
  }

  async resetGroup(groupId) {
    const all = this._readAll();
    delete all[groupId];
    this._writeAll(all);
  }

  async resetRoom() {
    this._writeAll({});
  }
}

/* ========================================================================
 * Factory — เลือกอัตโนมัติว่าจะใช้ backend ตัวไหน
 * ===================================================================== */
let singleton = null;

export function getBackend() {
  if (!singleton) {
    singleton = isFirebaseConfigured() ? new FirebaseBackend() : new OfflineBackend();
  }
  return singleton;
}
