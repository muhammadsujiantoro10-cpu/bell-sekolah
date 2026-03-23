/* ============================================================
   SMART SCHOOL BELL SYSTEM PRO — script.js  v6.0
   SMPN 2 Umbulsari
   ─────────────────────────────────────────────────────────────
   FITUR UTAMA v6:
   • Upload musik PER JADWAL dari komputer — tersimpan IndexedDB
   • Audio disimpan sebagai ArrayBuffer (offline 100%)
   • Perpustakaan suara bersama + suara khusus per jadwal
   • 6 hari (Senin–Sabtu) × 3 mode (Normal/Ujian/Ramadan)
   • Auto-save setiap perubahan ke IndexedDB
   • Bell otomatis + TTS + Bell peringatan
   • PWA offline
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════════════════════════
   1. INDEXEDDB  (semua data + audio tersimpan offline)
══════════════════════════════════════════════════════════════ */
const DB_NAME    = 'SmartBellDB_v6';
const DB_VERSION = 1;
let   db         = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('schedules')) {
        d.createObjectStore('schedules', { keyPath: 'idbId', autoIncrement: true });
      }
      // sounds store: id = custom string, data = ArrayBuffer
      if (!d.objectStoreNames.contains('sounds')) {
        d.createObjectStore('sounds', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('history')) {
        d.createObjectStore('history', { keyPath: 'idbId', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains('settings')) {
        d.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror   = e => reject(e.target.error);
  });
}

const idb = {
  getAll : (store)        => new Promise((r,j)=>{ const q = db.transaction(store,'readonly').objectStore(store).getAll(); q.onsuccess=()=>r(q.result); q.onerror=e=>j(e); }),
  get    : (store, key)   => new Promise((r,j)=>{ const q = db.transaction(store,'readonly').objectStore(store).get(key); q.onsuccess=()=>r(q.result); q.onerror=e=>j(e); }),
  put    : (store, data)  => new Promise((r,j)=>{ const q = db.transaction(store,'readwrite').objectStore(store).put(data); q.onsuccess=()=>r(q.result); q.onerror=e=>j(e); }),
  add    : (store, data)  => new Promise((r,j)=>{ const q = db.transaction(store,'readwrite').objectStore(store).add(data); q.onsuccess=()=>r(q.result); q.onerror=e=>j(e); }),
  del    : (store, key)   => new Promise((r,j)=>{ const q = db.transaction(store,'readwrite').objectStore(store).delete(key); q.onsuccess=()=>r(); q.onerror=e=>j(e); }),
  clear  : (store)        => new Promise((r,j)=>{ const q = db.transaction(store,'readwrite').objectStore(store).clear(); q.onsuccess=()=>r(); q.onerror=e=>j(e); }),
};

/* ══════════════════════════════════════════════════════════════
   2. CONSTANTS
══════════════════════════════════════════════════════════════ */
const DAYS_ID  = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const DAYSK    = ['senin','selasa','rabu','kamis','jumat','sabtu'];
const MONTHS   = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const WDAYS    = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MODE_LBL = { normal:'Normal', ujian:'Ujian', ramadan:'Ramadan' };
const AUDIO_EXT = ['mp3','wav','ogg','aac','flac','m4a','opus','webm','weba','mp4','m4b'];

/* ══════════════════════════════════════════════════════════════
   3. STATE  (in-memory, selalu sinkron dengan IndexedDB)
══════════════════════════════════════════════════════════════ */
const S = {
  settings: {
    schoolName: 'SMPN 2 Umbulsari',
    logo: null,
    volume: 80,
    bellDuration: 5,
    warningEnabled: true,
    warningMinutes: 5,
    voiceEnabled: true,
    voiceLang: 'id-ID',
    activeMode: 'normal',
    defaultSoundId: 'builtin',
  },
  schedules: { normal:{}, ujian:{}, ramadan:{} },
  // sounds: [{ id, name, ext, size, arrayBuffer, isBuiltin }]
  sounds: [],
  history: [],
  curDay: { normal:'senin', ujian:'senin', ramadan:'senin' },
  nextId: 1,
};

/* ══════════════════════════════════════════════════════════════
   4. DEFAULT SCHEDULES
══════════════════════════════════════════════════════════════ */
function mkId() { return S.nextId++; }

function defItems(arr) {
  return arr.map(x => ({ ...x, id: mkId(), soundId: null }));
}

const DEF = {
  normal: {
    senin:   defItems([{time:'07:00',name:'Masuk Sekolah',bell:true,voice:true,announce:'Selamat datang di SMPN 2 Umbulsari, silakan masuk ke kelas'},{time:'07:10',name:'Pelajaran 1',bell:true,voice:false,announce:''},{time:'08:30',name:'Pelajaran 2',bell:true,voice:false,announce:''},{time:'09:50',name:'Pelajaran 3',bell:true,voice:false,announce:''},{time:'10:10',name:'Istirahat',bell:true,voice:true,announce:'Waktu istirahat dimulai'},{time:'10:30',name:'Pelajaran 4',bell:true,voice:false,announce:''},{time:'11:50',name:'Pelajaran 5',bell:true,voice:false,announce:''},{time:'12:00',name:'Pulang Sekolah',bell:true,voice:true,announce:'Kegiatan belajar selesai, silakan pulang'}]),
    selasa:  defItems([{time:'07:00',name:'Masuk Sekolah',bell:true,voice:true,announce:'Selamat datang'},{time:'07:10',name:'Pelajaran 1',bell:true,voice:false,announce:''},{time:'08:30',name:'Pelajaran 2',bell:true,voice:false,announce:''},{time:'09:50',name:'Istirahat',bell:true,voice:true,announce:'Waktu istirahat'},{time:'10:10',name:'Pelajaran 3',bell:true,voice:false,announce:''},{time:'11:30',name:'Pelajaran 4',bell:true,voice:false,announce:''},{time:'12:00',name:'Pulang',bell:true,voice:true,announce:'Selesai belajar'}]),
    rabu:    defItems([{time:'07:00',name:'Masuk Sekolah',bell:true,voice:true,announce:'Selamat pagi'},{time:'07:10',name:'Pelajaran 1',bell:true,voice:false,announce:''},{time:'08:30',name:'Pelajaran 2',bell:true,voice:false,announce:''},{time:'09:50',name:'Istirahat',bell:true,voice:true,announce:'Istirahat'},{time:'10:10',name:'Pelajaran 3',bell:true,voice:false,announce:''},{time:'12:00',name:'Pulang',bell:true,voice:true,announce:'Selesai'}]),
    kamis:   defItems([{time:'07:00',name:'Masuk Sekolah',bell:true,voice:true,announce:'Selamat pagi'},{time:'07:10',name:'Pelajaran 1',bell:true,voice:false,announce:''},{time:'08:30',name:'Pelajaran 2',bell:true,voice:false,announce:''},{time:'09:50',name:'Istirahat',bell:true,voice:true,announce:'Istirahat'},{time:'10:10',name:'Pelajaran 3',bell:true,voice:false,announce:''},{time:'12:00',name:'Pulang',bell:true,voice:true,announce:'Selesai'}]),
    jumat:   defItems([{time:'07:00',name:'Masuk Sekolah',bell:true,voice:true,announce:'Selamat pagi, selamat hari Jumat'},{time:'07:10',name:'Senam / Tadarus',bell:true,voice:true,announce:'Kegiatan pagi dimulai'},{time:'08:00',name:'Pelajaran 1',bell:true,voice:false,announce:''},{time:'09:30',name:'Istirahat',bell:true,voice:true,announce:'Istirahat'},{time:'09:50',name:'Pelajaran 2',bell:true,voice:false,announce:''},{time:'11:30',name:'Sholat Jumat / Pulang',bell:true,voice:true,announce:'Jangan lupa sholat Jumat'}]),
    sabtu:   defItems([{time:'07:00',name:'Masuk Sekolah',bell:true,voice:true,announce:'Selamat pagi'},{time:'07:10',name:'Pelajaran 1',bell:true,voice:false,announce:''},{time:'08:30',name:'Pelajaran 2',bell:true,voice:false,announce:''},{time:'09:50',name:'Istirahat',bell:true,voice:true,announce:'Istirahat'},{time:'10:10',name:'Pelajaran 3',bell:true,voice:false,announce:''},{time:'11:30',name:'Pulang',bell:true,voice:true,announce:'Sampai Senin'}]),
  },
  ujian: {
    senin:   defItems([{time:'07:00',name:'Masuk Sekolah',bell:true,voice:true,announce:'Silakan masuk ruang ujian'},{time:'07:30',name:'Ujian Sesi 1',bell:true,voice:true,announce:'Ujian sesi pertama dimulai, harap tenang'},{time:'09:30',name:'Selesai Sesi 1',bell:true,voice:true,announce:'Letakkan lembar jawaban'},{time:'09:45',name:'Istirahat',bell:true,voice:true,announce:'Waktu istirahat'},{time:'10:00',name:'Ujian Sesi 2',bell:true,voice:true,announce:'Ujian sesi dua dimulai'},{time:'12:00',name:'Ujian Selesai',bell:true,voice:true,announce:'Ujian selesai, silakan pulang'}]),
    selasa:  defItems([{time:'07:00',name:'Masuk',bell:true,voice:true,announce:'Masuk ruang ujian'},{time:'07:30',name:'Ujian Sesi 1',bell:true,voice:true,announce:'Ujian dimulai'},{time:'09:30',name:'Selesai Sesi 1',bell:true,voice:true,announce:'Sesi 1 selesai'},{time:'09:45',name:'Istirahat',bell:true,voice:false,announce:''},{time:'10:00',name:'Ujian Sesi 2',bell:true,voice:true,announce:'Sesi 2 dimulai'},{time:'12:00',name:'Selesai',bell:true,voice:true,announce:'Ujian selesai'}]),
    rabu:    defItems([{time:'07:00',name:'Masuk',bell:true,voice:true,announce:'Masuk ruang ujian'},{time:'07:30',name:'Ujian',bell:true,voice:true,announce:'Ujian dimulai'},{time:'09:30',name:'Selesai',bell:true,voice:true,announce:'Selesai'},{time:'09:45',name:'Istirahat',bell:true,voice:false,announce:''},{time:'10:00',name:'Ujian Sesi 2',bell:true,voice:true,announce:'Dimulai'},{time:'12:00',name:'Selesai',bell:true,voice:true,announce:'Selesai'}]),
    kamis:   defItems([{time:'07:00',name:'Masuk',bell:true,voice:true,announce:'Masuk'},{time:'07:30',name:'Ujian Sesi 1',bell:true,voice:true,announce:'Ujian dimulai'},{time:'09:30',name:'Selesai',bell:true,voice:true,announce:'Selesai'},{time:'09:45',name:'Istirahat',bell:true,voice:false,announce:''},{time:'10:00',name:'Ujian Sesi 2',bell:true,voice:true,announce:'Dimulai'},{time:'12:00',name:'Selesai',bell:true,voice:true,announce:'Selesai'}]),
    jumat:   defItems([{time:'07:00',name:'Masuk',bell:true,voice:true,announce:'Masuk'},{time:'07:30',name:'Ujian',bell:true,voice:true,announce:'Dimulai'},{time:'09:30',name:'Selesai',bell:true,voice:true,announce:'Selesai'},{time:'09:45',name:'Istirahat',bell:true,voice:false,announce:''},{time:'10:00',name:'Ujian Sesi 2',bell:true,voice:true,announce:'Dimulai'},{time:'11:30',name:'Selesai',bell:true,voice:true,announce:'Ujian selesai'}]),
    sabtu:   defItems([{time:'07:00',name:'Masuk',bell:true,voice:true,announce:'Masuk'},{time:'07:30',name:'Ujian',bell:true,voice:true,announce:'Dimulai'},{time:'09:30',name:'Selesai',bell:true,voice:true,announce:'Selesai'},{time:'10:00',name:'Ujian Sesi 2',bell:true,voice:true,announce:'Dimulai'},{time:'11:30',name:'Selesai',bell:true,voice:true,announce:'Ujian selesai'}]),
  },
  ramadan: {
    senin:   defItems([{time:'06:30',name:'Masuk Sekolah',bell:true,voice:true,announce:'Selamat berpuasa, silakan masuk kelas'},{time:'06:40',name:'Pelajaran 1',bell:true,voice:false,announce:''},{time:'07:50',name:'Pelajaran 2',bell:true,voice:false,announce:''},{time:'08:30',name:'Pelajaran 3',bell:true,voice:false,announce:''},{time:'09:10',name:'Istirahat',bell:true,voice:true,announce:'Waktu istirahat'},{time:'09:25',name:'Pelajaran 4',bell:true,voice:false,announce:''},{time:'10:30',name:'Pulang',bell:true,voice:true,announce:'Selesai, semoga puasa diterima'}]),
    selasa:  defItems([{time:'06:30',name:'Masuk',bell:true,voice:true,announce:'Selamat berpuasa'},{time:'06:40',name:'Pelajaran 1',bell:true,voice:false,announce:''},{time:'07:50',name:'Pelajaran 2',bell:true,voice:false,announce:''},{time:'08:30',name:'Istirahat',bell:true,voice:true,announce:'Istirahat'},{time:'08:45',name:'Pelajaran 3',bell:true,voice:false,announce:''},{time:'10:30',name:'Pulang',bell:true,voice:true,announce:'Selesai'}]),
    rabu:    defItems([{time:'06:30',name:'Masuk',bell:true,voice:true,announce:'Selamat berpuasa'},{time:'06:40',name:'Pelajaran 1',bell:true,voice:false,announce:''},{time:'07:50',name:'Pelajaran 2',bell:true,voice:false,announce:''},{time:'08:30',name:'Istirahat',bell:true,voice:true,announce:'Istirahat'},{time:'08:45',name:'Pelajaran 3',bell:true,voice:false,announce:''},{time:'10:30',name:'Pulang',bell:true,voice:true,announce:'Selesai'}]),
    kamis:   defItems([{time:'06:30',name:'Masuk',bell:true,voice:true,announce:'Selamat berpuasa'},{time:'06:40',name:'Pelajaran 1',bell:true,voice:false,announce:''},{time:'07:50',name:'Pelajaran 2',bell:true,voice:false,announce:''},{time:'08:30',name:'Istirahat',bell:true,voice:true,announce:'Istirahat'},{time:'08:45',name:'Pelajaran 3',bell:true,voice:false,announce:''},{time:'10:30',name:'Pulang',bell:true,voice:true,announce:'Selesai'}]),
    jumat:   defItems([{time:'06:30',name:'Masuk',bell:true,voice:true,announce:'Selamat berpuasa'},{time:'06:40',name:'Pelajaran 1',bell:true,voice:false,announce:''},{time:'07:50',name:'Pelajaran 2',bell:true,voice:false,announce:''},{time:'09:00',name:'Sholat Jumat / Pulang',bell:true,voice:true,announce:'Jangan lupa sholat'}]),
    sabtu:   defItems([{time:'06:30',name:'Masuk',bell:true,voice:true,announce:'Selamat berpuasa'},{time:'06:40',name:'Pelajaran 1',bell:true,voice:false,announce:''},{time:'07:50',name:'Pelajaran 2',bell:true,voice:false,announce:''},{time:'09:10',name:'Istirahat',bell:true,voice:true,announce:'Istirahat'},{time:'09:25',name:'Pelajaran 3',bell:true,voice:false,announce:''},{time:'10:30',name:'Pulang',bell:true,voice:true,announce:'Selesai'}]),
  },
};

/* ══════════════════════════════════════════════════════════════
   5. AUDIO ENGINE  (IndexedDB‐backed, ArrayBuffer)
══════════════════════════════════════════════════════════════ */
let audioCtx    = null;
let currentSrc  = null;    // AudioBufferSourceNode or HTMLAudioElement
let waveTimer   = null;
const blobURLs  = {};      // soundId → ObjectURL (cache, tidak disimpan)

function getACtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Buat / ambil Blob URL dari ArrayBuffer (cache di blobURLs)
async function getBlobURL(soundId) {
  if (blobURLs[soundId]) return blobURLs[soundId];
  const rec = await idb.get('sounds', soundId);
  if (!rec || !rec.arrayBuffer) return null;
  const blob = new Blob([rec.arrayBuffer], { type: rec.mimeType || 'audio/mpeg' });
  blobURLs[soundId] = URL.createObjectURL(blob);
  return blobURLs[soundId];
}

function playBuiltinBell(vol) {
  vol = vol ?? 0.75;
  const ctx = getACtx();
  const t   = ctx.currentTime;
  [523, 659, 784, 1047].forEach((f, fi) => {
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f; o.type = 'sine';
      const st = t + i * 0.55 + fi * 0.07;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(vol * 0.27, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.44);
      o.start(st); o.stop(st + 0.5);
    }
  });
  animWaveDefault();
}

async function playSound(soundId, vol) {
  vol = vol ?? (S.settings.volume / 100);
  stopAudio();

  // Tentukan soundId aktif
  const id = soundId || S.settings.defaultSoundId;
  if (!id || id === 'builtin') { playBuiltinBell(vol); return; }

  try {
    const url = await getBlobURL(id);
    if (!url) { playBuiltinBell(vol); return; }
    const audio = new Audio(url);
    audio.volume = Math.min(vol, 1);
    currentSrc = audio;
    const p = audio.play();
    if (p && p.catch) p.catch(() => playBuiltinBell(vol));
    audio.onended = () => { currentSrc = null; stopWave(); };
    animWaveAudio(audio);
  } catch(e) {
    console.warn('[Audio]', e);
    playBuiltinBell(vol);
  }
}

function stopAudio() {
  if (currentSrc) {
    try { currentSrc.pause(); currentSrc.currentTime = 0; } catch(e){}
    currentSrc = null;
  }
  stopWave();
}

// ── Waveform ──
function animWaveDefault() {
  const c = document.getElementById('wcanvas'); if (!c) return;
  c.width = c.offsetWidth || 300; c.height = 42;
  const ctx = c.getContext('2d'); const W = c.width, H = c.height;
  let fr = 0; if (waveTimer) cancelAnimationFrame(waveTimer);
  (function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,201,255,.65)'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const amp = H/2 * .6 * Math.exp(-x/W * 1.1);
      const y   = H/2 + Math.sin(x/W*Math.PI*8 + fr*.08) * amp;
      x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.stroke(); fr++;
    if (fr < 200) waveTimer = requestAnimationFrame(draw); else stopWave();
  })();
}

function animWaveAudio(audio) {
  const c = document.getElementById('wcanvas'); if (!c) return;
  c.width = c.offsetWidth || 300; c.height = 42;
  const ctx = c.getContext('2d'); const W = c.width, H = c.height;
  let ph = 0; if (waveTimer) cancelAnimationFrame(waveTimer);
  (function draw() {
    ctx.clearRect(0, 0, W, H);
    const prog = audio.duration ? audio.currentTime / audio.duration : 0;
    ctx.fillStyle = 'rgba(0,201,255,.1)'; ctx.fillRect(0, 0, W*prog, H);
    ctx.strokeStyle = 'rgba(0,201,255,.7)'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const amp = H/2 * .65 * (1 - Math.abs(x/W-.5)*.5);
      const y   = H/2 + Math.sin(x/W*Math.PI*12+ph) * amp * (.5+Math.random()*.15);
      x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.stroke(); ph += .07;
    if (audio.duration) {
      const fmt = n => `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
      const wtEl = document.getElementById('wtime');
      if (wtEl) wtEl.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
    }
    if (currentSrc === audio) waveTimer = requestAnimationFrame(draw);
  })();
}

function stopWave() {
  if (waveTimer) { cancelAnimationFrame(waveTimer); waveTimer = null; }
  const c = document.getElementById('wcanvas');
  if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
  const wt = document.getElementById('wtime');
  if (wt) wt.textContent = '0:00 / 0:00';
}

/* ══════════════════════════════════════════════════════════════
   6. SAVE / LOAD  (IndexedDB)
══════════════════════════════════════════════════════════════ */

// Simpan semua jadwal ke IndexedDB
async function saveSchedules() {
  await idb.clear('schedules');
  const all = [];
  ['normal','ujian','ramadan'].forEach(m => {
    DAYSK.forEach(d => {
      (S.schedules[m][d] || []).forEach(it => {
        all.push({ mode: m, day: d, ...it });
      });
    });
  });
  for (const row of all) await idb.add('schedules', row);
}

// Simpan setting ke IndexedDB
async function saveSettings() {
  const copy = { ...S.settings };
  // Jangan simpan logo besar di settings (sudah ada di sounds store jika perlu)
  await idb.put('settings', { key: 'main', value: copy });
}

// Simpan history ke IndexedDB (simpan 200 terakhir)
async function saveHistory() {
  await idb.clear('history');
  for (const h of S.history.slice(0, 200)) {
    const { idbId: _, ...data } = h;
    await idb.add('history', data);
  }
}

// Simpan sound ke IndexedDB (dengan ArrayBuffer)
async function saveSoundToDB(rec) {
  await idb.put('sounds', rec);
}

// Auto‐save terpusat
let autoSaveTimer = null;
function triggerAutoSave(opts = {}) {
  clearTimeout(autoSaveTimer);
  setEl('autoSaveLbl', 'Menyimpan...');
  autoSaveTimer = setTimeout(async () => {
    try {
      if (opts.schedules !== false) await saveSchedules();
      if (opts.settings  !== false) await saveSettings();
      if (opts.history   !== false) await saveHistory();
      const now = new Date().toLocaleTimeString('id-ID',{ hour:'2-digit', minute:'2-digit' });
      setEl('autoSaveLbl', `✓ Tersimpan ${now}`);
    } catch(e) {
      console.error('[AutoSave]', e);
      setEl('autoSaveLbl', '⚠ Gagal simpan');
    }
  }, 500);
}

// Load semua dari IndexedDB
async function loadAll() {
  // Settings
  const settRec = await idb.get('settings', 'main');
  if (settRec && settRec.value) Object.assign(S.settings, settRec.value);

  // Schedules
  ['normal','ujian','ramadan'].forEach(m => DAYSK.forEach(d => S.schedules[m][d] = []));
  const rows = await idb.getAll('schedules');
  if (rows.length > 0) {
    rows.forEach(row => {
      const { mode, day, idbId, ...item } = row;
      if (S.schedules[mode] && DAYSK.includes(day)) {
        S.schedules[mode][day].push(item);
      }
      if (item.id >= S.nextId) S.nextId = item.id + 1;
    });
  } else {
    // First run: load defaults
    ['normal','ujian','ramadan'].forEach(m => DAYSK.forEach(d => {
      S.schedules[m][d] = DEF[m][d] ? DEF[m][d].map(x => ({...x})) : [];
    }));
    await saveSchedules(); // Persist defaults
  }

  // Sounds metadata (bukan ArrayBuffer, itu lazy-loaded)
  const sndRows = await idb.getAll('sounds');
  S.sounds = sndRows.map(r => ({
    id: r.id, name: r.name, ext: r.ext,
    size: r.size, mimeType: r.mimeType,
    isBuiltin: !!r.isBuiltin,
    // arrayBuffer tidak disimpan di state, lazy-loaded via getBlobURL
  }));
  if (!S.sounds.find(x => x.isBuiltin)) {
    S.sounds.unshift({ id: 'builtin', name: 'Default Bell', ext: 'builtin', size: 0, isBuiltin: true });
  }

  // History
  const hRows = await idb.getAll('history');
  S.history = hRows.sort((a,b) => (b.ts||0)-(a.ts||0));
}

/* ══════════════════════════════════════════════════════════════
   7. SCHEDULE AUDIO UPLOAD  (per jadwal, dari komputer)
══════════════════════════════════════════════════════════════ */

// Upload audio langsung ke jadwal tertentu (id, mode, day)
async function uploadAudioForItem(files, itemId, mode, day) {
  const file = files[0]; if (!file) return;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!file.type.startsWith('audio/') && !AUDIO_EXT.includes(ext)) {
    toast('Format tidak didukung! Gunakan MP3, WAV, dll.', 'e'); return;
  }
  if (file.size > 15 * 1024 * 1024) {
    toast('File terlalu besar! Maks 15MB per file', 'w'); return;
  }

  toast('⏳ Mengupload...', 'i');
  try {
    const arrayBuffer = await file.arrayBuffer();
    const soundId = `item_${itemId}_${Date.now()}`;
    const mimeType = file.type || 'audio/mpeg';

    // Simpan ke IndexedDB
    await saveSoundToDB({ id: soundId, name: file.name.replace(/\.[^.]+$/, ''), ext, size: file.size, mimeType, arrayBuffer, isBuiltin: false });

    // Tambah ke state sounds jika belum ada
    if (!S.sounds.find(x => x.id === soundId)) {
      S.sounds.push({ id: soundId, name: file.name.replace(/\.[^.]+$/, ''), ext, size: file.size, mimeType, isBuiltin: false });
    }

    // Pasang ke jadwal
    const list = S.schedules[mode][day] || [];
    const item = list.find(x => x.id === itemId);
    if (item) {
      // Hapus sound lama yang item-specific jika ada
      if (item.soundId && item.soundId.startsWith('item_')) {
        await removeSoundById(item.soundId, false); // silent
      }
      item.soundId = soundId;
      await saveSchedules();
    }

    toast(`✅ "${file.name}" berhasil diupload & dipasang!`, 's');
    renderSchedulePanel(mode);
    renderLib();
  } catch(e) {
    console.error('[Upload]', e);
    toast('❌ Upload gagal: ' + e.message, 'e');
  }
}

// Upload ke perpustakaan (tanpa pasang ke jadwal)
async function uploadToLibrary(files) {
  let added = 0, skipped = 0;
  toast('⏳ Mengupload file...', 'i');
  for (const file of Array.from(files)) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!file.type.startsWith('audio/') && !AUDIO_EXT.includes(ext)) { skipped++; continue; }
    if (file.size > 15 * 1024 * 1024) { skipped++; continue; }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const soundId = `lib_${Date.now()}_${Math.random().toString(36).slice(2,5)}`;
      const mimeType = file.type || 'audio/mpeg';
      await saveSoundToDB({ id: soundId, name: file.name.replace(/\.[^.]+$/, ''), ext, size: file.size, mimeType, arrayBuffer, isBuiltin: false });
      S.sounds.push({ id: soundId, name: file.name.replace(/\.[^.]+$/, ''), ext, size: file.size, mimeType, isBuiltin: false });
      added++;
    } catch(e) { skipped++; }
  }
  if (added > 0) toast(`✅ ${added} file berhasil diupload!`, 's');
  if (skipped > 0) toast(`⚠ ${skipped} file dilewati`, 'w');
  renderLib();
}

async function removeSoundById(id, withConfirm = true) {
  if (withConfirm && !confirm('Hapus file ini?')) return;
  // Revoke blob URL cache
  if (blobURLs[id]) { URL.revokeObjectURL(blobURLs[id]); delete blobURLs[id]; }
  // Hapus dari DB
  await idb.del('sounds', id);
  // Hapus dari state
  const idx = S.sounds.findIndex(x => x.id === id);
  if (idx >= 0) S.sounds.splice(idx, 1);
  // Reset jadwal yang memakai ini
  ['normal','ujian','ramadan'].forEach(m => DAYSK.forEach(d => {
    (S.schedules[m][d] || []).forEach(it => { if (it.soundId === id) it.soundId = null; });
  }));
  if (S.settings.defaultSoundId === id) S.settings.defaultSoundId = 'builtin';
  await saveSchedules();
  await saveSettings();
  renderLib(); renderAllModes();
  if (withConfirm) toast('🗑️ File dihapus', 'w');
}

/* ══════════════════════════════════════════════════════════════
   8. CLOCK & BELL LOGIC
══════════════════════════════════════════════════════════════ */
let lastMin = '', warnSet = new Set(), firedSet = new Set();

function startClock() {
  tickClock();
  setInterval(tickClock, 1000);
}

function tickClock() {
  const now = new Date();
  const hh  = pad(now.getHours()), mm = pad(now.getMinutes()), ss = pad(now.getSeconds());
  const ct  = `${hh}:${mm}`;
  setHTML('clk', `${hh}<span class="col">:</span>${mm}`);
  setEl('clks', ss);
  setEl('clkd', `${WDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`);
  updateStatus(ct, now);
}

function updateStatus(ct, now) {
  const today = getTodayKey();
  const list  = S.schedules[S.settings.activeMode][today] || [];
  let cur = null, nxt = null;
  for (let i = list.length - 1; i >= 0; i--) { if (list[i].time <= ct) { cur = list[i]; break; } }
  for (const it of list) { if (it.time > ct) { nxt = it; break; } }

  setEl('curAct',  cur ? cur.name : 'Belum mulai');
  setEl('curActT', cur ? `Sejak ${cur.time}` : '—');
  setEl('nextAct', nxt ? nxt.name : 'Tidak ada');
  setEl('nextActT',nxt ? `Pukul ${nxt.time}` : '—');

  // Bell check (per menit)
  if (ct !== lastMin) {
    lastMin = ct;
    list.forEach(it => {
      const fk = `${S.settings.activeMode}${today}${it.time}${it.id}`;
      if (it.time === ct && it.bell && !firedSet.has(fk)) {
        firedSet.add(fk); triggerBell(it, today);
      }
      if (S.settings.warningEnabled) {
        const wt = subMins(it.time, S.settings.warningMinutes);
        const wk = `w${fk}`;
        if (wt === ct && !warnSet.has(wk)) {
          warnSet.add(wk);
          toast(`⏰ ${S.settings.warningMinutes}m sebelum: ${it.name}`, 'w');
        }
      }
    });
  }

  // Countdown
  if (nxt) {
    const [nh, nm] = nxt.time.split(':').map(Number);
    const diff = (nh*3600000+nm*60000) - (now.getHours()*3600000+now.getMinutes()*60000+now.getSeconds()*1000);
    if (diff > 0) {
      const m = Math.floor(diff/60000), s = Math.floor((diff%60000)/1000);
      setEl('cdval', `${pad(m)}:${pad(s)}`); setEl('cdlbl', `→ ${nxt.name}`);
      return;
    }
  }
  setEl('cdval','--:--'); setEl('cdlbl','—');
}

async function triggerBell(item, day) {
  const vol = S.settings.volume / 100;
  const sid = item.soundId || S.settings.defaultSoundId;
  await playSound(sid, vol);

  // Popup
  setEl('bpname', item.name);
  setEl('bptime',  item.time);
  setEl('bpmode', `Mode ${MODE_LBL[S.settings.activeMode]} · ${DAYS_ID[DAYSK.indexOf(day)]}`);
  showOverlay('bellPop');
  setTimeout(() => hideOverlay('bellPop'), (S.settings.bellDuration + 3) * 1000);

  // TTS
  if (S.settings.voiceEnabled && item.voice && item.announce && 'speechSynthesis' in window) {
    setTimeout(() => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(item.announce);
      u.lang = S.settings.voiceLang || 'id-ID';
      window.speechSynthesis.speak(u);
    }, 600);
  }

  // History
  S.history.unshift({
    time: item.time, name: item.name,
    mode: S.settings.activeMode, day,
    ts: Date.now(),
    soundName: getSoundName(sid),
  });
  if (S.history.length > 200) S.history.pop();
  if (panelActive('history')) renderHist(null);
  triggerAutoSave({ schedules: false });
}

/* ══════════════════════════════════════════════════════════════
   9. MODE & DAY
══════════════════════════════════════════════════════════════ */
async function setMode(m) {
  S.settings.activeMode = m;
  document.body.setAttribute('data-mode', m);
  setEl('amtxt',      MODE_LBL[m]);
  setEl('sActiveTxt', MODE_LBL[m]);
  setEl('fmode',      `Mode: ${MODE_LBL[m]}`);
  setEl('di-mode',    m.toUpperCase());
  ['normal','ujian','ramadan'].forEach(x => {
    const b = ge(`ba-${x}`); if (!b) return;
    b.textContent = x === m ? '✅ Aktif' : '▶ Aktifkan';
    b.classList.toggle('is-active', x === m);
  });
  renderSchedulePanel(m);
  triggerAutoSave({ schedules: false });
  toast(`✅ Mode ${MODE_LBL[m]} diaktifkan`, 's');
}

function switchDay(m, d) {
  S.curDay[m] = d;
  renderDayTabs(m);
  renderScheduleList(m);
}

function getTodayKey() {
  const d = new Date().getDay(); return DAYSK[d-1] || 'senin';
}

/* ══════════════════════════════════════════════════════════════
   10. RENDER
══════════════════════════════════════════════════════════════ */
function renderAllModes()          { ['normal','ujian','ramadan'].forEach(renderSchedulePanel); }
function renderSchedulePanel(m)    { renderDayTabs(m); renderScheduleList(m); }

function renderDayTabs(m) {
  const el = ge(`dtabs-${m}`); if (!el) return;
  const today = getTodayKey();
  el.innerHTML = DAYSK.map((d, i) => {
    const cnt = (S.schedules[m][d] || []).length;
    const on  = S.curDay[m] === d;
    const tod = d === today;
    return `<button class="dtab${on?' on':''}${tod?' today-tab':''}" onclick="switchDay('${m}','${d}')">${DAYS_ID[i]}${cnt?` (${cnt})`:''}</button>`;
  }).join('');
}

function renderScheduleList(m) {
  const day  = S.curDay[m];
  const list = S.schedules[m][day] || [];
  const el   = ge(`sl-${m}`); if (!el) return;
  setEl(`sc-${m}`,        `${list.length} jadwal`);
  const dtEl = ge(`daytitle-${m}`);
  if (dtEl) dtEl.textContent = DAYS_ID[DAYSK.indexOf(day)];

  if (!list.length) {
    el.innerHTML = `<div class="empty"><div class="empty-ic">📋</div><p>Belum ada jadwal.<br>Klik ➕ Tambah Jadwal.</p></div>`;
    return;
  }

  const now = new Date();
  const ct  = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const isToday = day === getTodayKey() && m === S.settings.activeMode;
  let curIdx = -1;
  if (isToday) for (let i = list.length-1; i >= 0; i--) { if (list[i].time <= ct) { curIdx = i; break; } }

  const vc = { normal:'--n', ujian:'--u', ramadan:'--r' };

  el.innerHTML = list.map((it, idx) => {
    const past   = isToday && it.time < ct && idx !== curIdx;
    const cur    = isToday && idx === curIdx;
    const sid    = it.soundId || null;
    const sName  = sid ? getSoundName(sid) : '🔔 Default';
    const sShort = sName.length > 12 ? sName.slice(0, 12) + '…' : sName;
    const sIcon  = sid && sid !== 'builtin' ? '🎵' : '🔔';
    const isCustom = sid && sid !== 'builtin';

    return `<div class="si${cur?' cur':''}${past?' past':''}" id="si-${it.id}">
      <span class="sitime" style="color:var(${vc[m]})">${it.time}</span>
      <span class="siname">${esc(it.name)}</span>
      <div class="si-tags">
        ${it.bell ? '<span class="tag tb">🔔</span>' : '<span class="tag toff">Off</span>'}
        ${it.voice ? '<span class="tag tv">🗣️</span>' : ''}
        <div class="si-snd${isCustom?' custom':''}" onclick="openSoundOpts(${it.id},'${m}','${day}')" title="Suara bell jadwal ini">
          <span>${sIcon}</span>
          <span class="sn">${esc(sShort)}</span>
          <span class="arr">▾</span>
        </div>
      </div>
      <div class="siacts">
        <button class="iab" onclick="openEditModal(${it.id},'${m}')" title="Edit">✏️</button>
        <button class="iab del" onclick="deleteItem(${it.id},'${m}')" title="Hapus">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

/* ── Sound library render ── */
function renderLib() {
  const el = ge('libList'); if (!el) return;
  setEl('libcnt',   `${S.sounds.length} file`);
  setEl('di-snd',   `${S.sounds.length} file`);
  if (!S.sounds.length) {
    el.innerHTML = `<div class="empty"><div class="empty-ic">🎵</div><p>Belum ada file audio.</p></div>`;
    return;
  }
  const EXC = {mp3:'rgba(0,201,255,.1)',wav:'rgba(0,230,118,.1)',ogg:'rgba(255,179,0,.1)',aac:'rgba(167,139,250,.1)',flac:'rgba(255,107,53,.1)',m4a:'rgba(64,196,255,.1)',builtin:'rgba(0,201,255,.1)'};
  const ECC = {mp3:'#00c9ff',wav:'#00e676',ogg:'#ffb300',aac:'#a78bfa',flac:'#ff6b35',m4a:'#40c4ff',builtin:'#00c9ff'};
  el.innerHTML = S.sounds.map(s => {
    const isDef = s.id === S.settings.defaultSoundId;
    const bg  = EXC[s.ext] || 'rgba(100,100,100,.1)';
    const cc  = ECC[s.ext] || '#8fa8d0';
    const sz  = s.size ? (s.size > 1048576 ? (s.size/1048576).toFixed(1)+' MB' : (s.size/1024).toFixed(0)+' KB') : '';
    return `<div class="slib-item${isDef?' is-def':''}">
      <span style="font-size:17px;">${s.isBuiltin?'🔔':'🎵'}</span>
      <div style="flex:1;min-width:0;">
        <div class="slib-name">${esc(s.name)}</div>
        <div class="slib-meta">
          <span class="extb" style="background:${bg};color:${cc};border:1px solid ${cc.replace('ff','80')};">${s.ext.toUpperCase()}</span>
          ${sz ? `<span>${sz}</span>` : ''}
          ${isDef ? '<span class="def-bdg">✓ Default Bell</span>' : ''}
        </div>
      </div>
      <div style="display:flex;gap:4px;">
        <button class="slibtn play" onclick="previewLib('${s.id}')" title="Preview">▶</button>
        ${!isDef ? `<button class="slibtn setd" onclick="setDefaultBell('${s.id}')" title="Jadikan Default">✓</button>` : ''}
        ${!s.isBuiltin ? `<button class="slibtn rm" onclick="removeSoundById('${s.id}')" title="Hapus">✕</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function previewLib(id) {
  stopAudio();
  playSound(id, S.settings.volume/100);
  toast(`▶ Preview: ${getSoundName(id)}`, 'i');
}

async function setDefaultBell(id) {
  S.settings.defaultSoundId = id;
  await saveSettings();
  renderLib();
  toast(`✅ "${getSoundName(id)}" jadi default bell`, 's');
}

/* ── History render ── */
let histFilter = 'all';
function renderHist(f) {
  if (f !== null) histFilter = f || 'all';
  const el = ge('histList'); if (!el) return;
  const list = histFilter === 'all' ? [...S.history] : S.history.filter(h => h.mode === histFilter);
  if (!list.length) {
    el.innerHTML = `<div class="empty"><div class="empty-ic">📊</div><p>Belum ada riwayat.</p></div>`;
    return;
  }
  const MC = {normal:'n',ujian:'u',ramadan:'r'};
  el.innerHTML = list.slice(0,100).map(h => {
    const d   = new Date(h.ts);
    const ts  = d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
    const ds  = d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'});
    const mc  = MC[h.mode] || 'n';
    return `<div class="hitem">
      <div class="htime" style="color:var(--${mc==='n'?'n':mc==='u'?'u':'r'})">${h.time}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">🔔 ${esc(h.name)}</div>
        <div style="font-size:9px;color:var(--t3);margin-top:1px;">${ds} · ${ts}${h.soundName ? ' · '+esc(h.soundName) : ''}</div>
      </div>
      <span class="htag ht-${mc}">${MODE_LBL[h.mode]}</span>
    </div>`;
  }).join('');
}

function filterHist(f) {
  histFilter = f;
  ['all','normal','ujian','ramadan'].forEach(x => {
    const b = ge(`hf-${x}`); if (!b) return;
    b.style.borderColor = x === f ? 'var(--ac)' : '';
    b.style.color       = x === f ? 'var(--ac)' : '';
  });
  renderHist(f);
}

/* ══════════════════════════════════════════════════════════════
   11. SOUND OPTIONS POPUP (per jadwal)
══════════════════════════════════════════════════════════════ */
let soundOptCtx = { itemId: null, mode: null, day: null };

function openSoundOpts(itemId, mode, day) {
  soundOptCtx = { itemId, mode, day };
  const item = (S.schedules[mode][day] || []).find(x => x.id === itemId);
  const curSid = item ? (item.soundId || null) : null;

  const el = ge('soList'); if (!el) return;

  // Section 1: Upload dari komputer
  const uploadSection = `
    <div style="padding:10px 12px;background:rgba(0,201,255,.06);border:1px solid rgba(0,201,255,.18);border-radius:8px;margin-bottom:10px;">
      <div style="font-size:10px;font-weight:700;color:var(--n);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">📁 Upload Langsung dari Komputer</div>
      <div class="upload-zone-sm" onclick="ge('soFileInput').click()" id="soDropZone">
        <input type="file" id="soFileInput" accept="audio/*,.mp3,.wav,.ogg,.aac,.flac,.m4a,.opus" style="display:none;" onchange="handleItemUpload(this)">
        <span style="font-size:22px;">🎵</span>
        <div style="font-size:11px;font-weight:700;color:var(--t1);margin-top:5px;">Klik atau Drop file audio</div>
        <div style="font-size:9px;color:var(--t2);margin-top:3px;">MP3, WAV, OGG, AAC, FLAC, M4A · Maks 15MB</div>
      </div>
    </div>
  `;

  // Section 2: Pilih dari perpustakaan
  const libItems = S.sounds.map(s => {
    const isSel = s.id === (curSid || S.settings.defaultSoundId);
    return `<div class="sp-item${isSel?' sel':''}" onclick="selectSoundForItem('${s.id}')">
      <span style="font-size:16px;">${s.isBuiltin ? '🔔' : '🎵'}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s.name)}</div>
        <div style="font-size:9px;color:var(--t3);">${s.ext.toUpperCase()}${s.size ? ' · '+(s.size>1048576?(s.size/1048576).toFixed(1)+'MB':(s.size/1024).toFixed(0)+'KB') : ''}</div>
      </div>
      <div style="display:flex;gap:4px;align-items:center;">
        <button class="slibtn play" onclick="event.stopPropagation();previewLib('${s.id}')" title="Preview">▶</button>
        ${isSel ? '<span style="color:var(--ok);font-size:14px;">✓</span>' : ''}
      </div>
    </div>`;
  }).join('');

  const resetBtn = curSid ? `<button class="btng" style="width:100%;margin-top:8px;text-align:center;" onclick="resetItemSound()">🔄 Reset ke Default Bell</button>` : '';

  el.innerHTML = uploadSection + `
    <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px;">Atau pilih dari perpustakaan:</div>
    <div style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">${libItems}</div>
    ${resetBtn}
  `;

  // Setup drag-drop di soDropZone setelah render
  setTimeout(() => {
    const dz = ge('soDropZone');
    if (dz) {
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
      dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('drag');
        const fi = ge('soFileInput');
        const dt = new DataTransfer();
        Array.from(e.dataTransfer.files||[]).forEach(f => dt.items.add(f));
        fi.files = dt.files;
        handleItemUpload(fi);
      });
    }
  }, 0);

  showOverlay('soundOptModal');
}

function handleItemUpload(input) {
  const { itemId, mode, day } = soundOptCtx;
  if (itemId !== null) {
    uploadAudioForItem(input.files, itemId, mode, day);
  }
  hideOverlay('soundOptModal');
  input.value = '';
}

async function selectSoundForItem(soundId) {
  const { itemId, mode, day } = soundOptCtx;
  const item = (S.schedules[mode][day] || []).find(x => x.id === itemId);
  if (item) {
    item.soundId = soundId === 'builtin' ? null : soundId;
    await saveSchedules();
    renderScheduleList(mode);
    setEl('autoSaveLbl', `✓ Tersimpan`);
    toast(`✅ "${getSoundName(soundId)}" dipasang ke jadwal`, 's');
  }
  hideOverlay('soundOptModal');
}

async function resetItemSound() {
  const { itemId, mode, day } = soundOptCtx;
  const item = (S.schedules[mode][day] || []).find(x => x.id === itemId);
  if (item) {
    item.soundId = null;
    await saveSchedules();
    renderScheduleList(mode);
    toast('🔄 Direset ke Default Bell', 'i');
  }
  hideOverlay('soundOptModal');
}

/* ══════════════════════════════════════════════════════════════
   12. ADD / EDIT SCHEDULE MODAL
══════════════════════════════════════════════════════════════ */
let editCtx = { mode: null, day: null, id: null, soundId: null };

function openAddModal(m) {
  editCtx = { mode: m, day: S.curDay[m], id: null, soundId: null };
  setEl('mttl',    '➕ Tambah Jadwal');
  const lb = ge('mmodelbdg');
  if (lb) { lb.className = `mbdg mb-${m}`; lb.textContent = { normal:'🏫 Normal', ujian:'📝 Ujian', ramadan:'🌙 Ramadan' }[m]; }
  setEl('mdaylbl', DAYS_ID[DAYSK.indexOf(editCtx.day)]);
  ge('mtime').value = '07:00'; ge('mname').value = '';
  ge('mannounce').value = '';
  setEl('mSndName', 'Default Bell'); setEl('mSndIcon', '🔔');
  setSw('mbell', true); setSw('mvoice', false);
  showOverlay('schedModal');
}

function openEditModal(id, m) {
  const day  = S.curDay[m];
  const item = (S.schedules[m][day] || []).find(x => x.id === id);
  if (!item) { toast('Item tidak ditemukan', 'e'); return; }
  editCtx = { mode: m, day, id, soundId: item.soundId || null };
  setEl('mttl', '✏️ Edit Jadwal');
  const lb = ge('mmodelbdg');
  if (lb) { lb.className = `mbdg mb-${m}`; lb.textContent = { normal:'🏫 Normal', ujian:'📝 Ujian', ramadan:'🌙 Ramadan' }[m]; }
  setEl('mdaylbl', DAYS_ID[DAYSK.indexOf(day)]);
  ge('mtime').value = item.time; ge('mname').value = item.name;
  ge('mannounce').value = item.announce || '';
  const sid = item.soundId || null;
  setEl('mSndIcon', sid ? '🎵' : '🔔');
  setEl('mSndName', sid ? getSoundName(sid) : 'Default Bell');
  setSw('mbell', item.bell); setSw('mvoice', item.voice);
  showOverlay('schedModal');
}

function openModalSoundPicker() {
  // Gunakan soundOptCtx kosong, target = modal
  soundOptCtx = { itemId: '__modal__', mode: editCtx.mode, day: editCtx.day };
  const el = ge('soList'); if (!el) return;
  const curSid = editCtx.soundId;

  const uploadSection = `
    <div style="padding:10px 12px;background:rgba(0,201,255,.06);border:1px solid rgba(0,201,255,.18);border-radius:8px;margin-bottom:10px;">
      <div style="font-size:10px;font-weight:700;color:var(--n);margin-bottom:8px;">📁 Upload Langsung dari Komputer</div>
      <div class="upload-zone-sm" onclick="ge('soFileInput2').click()">
        <input type="file" id="soFileInput2" accept="audio/*,.mp3,.wav,.ogg,.aac,.flac,.m4a,.opus" style="display:none;" onchange="handleModalSoundUpload(this)">
        <span style="font-size:22px;">🎵</span>
        <div style="font-size:11px;font-weight:700;color:var(--t1);margin-top:5px;">Klik atau Drop file audio</div>
        <div style="font-size:9px;color:var(--t2);margin-top:3px;">MP3, WAV, OGG, AAC, FLAC · Maks 15MB</div>
      </div>
    </div>
    <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px;">Atau pilih dari perpustakaan:</div>
  `;
  const libItems = S.sounds.map(s => {
    const isSel = s.id === (curSid || 'builtin');
    return `<div class="sp-item${isSel?' sel':''}" onclick="selectSoundForModal('${s.id}')">
      <span style="font-size:16px;">${s.isBuiltin?'🔔':'🎵'}</span>
      <div style="flex:1;min-width:0;"><div style="font-size:11px;font-weight:700;">${esc(s.name)}</div></div>
      <div style="display:flex;gap:4px;align-items:center;">
        <button class="slibtn play" onclick="event.stopPropagation();previewLib('${s.id}')">▶</button>
        ${isSel ? '<span style="color:var(--ok);font-size:14px;">✓</span>' : ''}
      </div>
    </div>`;
  }).join('');

  el.innerHTML = uploadSection + `<div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">${libItems}</div>`;
  showOverlay('soundOptModal');
}

async function handleModalSoundUpload(input) {
  const file = input.files && input.files[0]; if (!file) return;
  const ext = (file.name.split('.').pop()||'').toLowerCase();
  if (!file.type.startsWith('audio/') && !AUDIO_EXT.includes(ext)) { toast('Bukan file audio!','e'); return; }
  if (file.size > 15*1024*1024) { toast('Maks 15MB!','w'); return; }
  toast('⏳ Mengupload...','i');
  try {
    const ab = await file.arrayBuffer();
    const id = `lib_${Date.now()}_${Math.random().toString(36).slice(2,5)}`;
    const mt = file.type || 'audio/mpeg';
    await saveSoundToDB({id, name:file.name.replace(/\.[^.]+$/,''), ext, size:file.size, mimeType:mt, arrayBuffer:ab, isBuiltin:false});
    S.sounds.push({id, name:file.name.replace(/\.[^.]+$/,''), ext, size:file.size, mimeType:mt, isBuiltin:false});
    editCtx.soundId = id;
    setEl('mSndIcon','🎵'); setEl('mSndName', file.name.replace(/\.[^.]+$/,''));
    toast(`✅ "${file.name}" diupload!`, 's');
    hideOverlay('soundOptModal');
    renderLib();
  } catch(e) { toast('❌ Upload gagal','e'); }
  input.value = '';
}

function selectSoundForModal(soundId) {
  editCtx.soundId = soundId === 'builtin' ? null : soundId;
  setEl('mSndIcon', editCtx.soundId ? '🎵' : '🔔');
  setEl('mSndName', editCtx.soundId ? getSoundName(editCtx.soundId) : 'Default Bell');
  hideOverlay('soundOptModal');
}

async function saveItem() {
  const time = ge('mtime').value;
  const name = (ge('mname').value || '').trim();
  if (!time || !name) { toast('Waktu dan nama wajib diisi!', 'e'); return; }
  const bell     = getSw('mbell'), voice = getSw('mvoice');
  const announce = (ge('mannounce').value || '').trim();
  const soundId  = editCtx.soundId || null;
  const m = editCtx.mode, day = editCtx.day;
  if (!S.schedules[m][day]) S.schedules[m][day] = [];
  if (editCtx.id !== null) {
    const idx = S.schedules[m][day].findIndex(x => x.id === editCtx.id);
    if (idx >= 0) S.schedules[m][day][idx] = { ...S.schedules[m][day][idx], time, name, bell, voice, announce, soundId };
    toast('✅ Jadwal diperbarui', 's');
  } else {
    S.schedules[m][day].push({ id: mkId(), time, name, bell, voice, announce, soundId });
    toast('✅ Jadwal ditambahkan', 's');
  }
  S.schedules[m][day].sort((a,b) => a.time.localeCompare(b.time));
  renderSchedulePanel(m);
  hideOverlay('schedModal');
  triggerAutoSave();
}

async function deleteItem(id, m) {
  if (!confirm('Hapus jadwal ini?')) return;
  const day = S.curDay[m];
  S.schedules[m][day] = (S.schedules[m][day] || []).filter(x => x.id !== id);
  renderSchedulePanel(m);
  triggerAutoSave();
  toast('🗑️ Dihapus', 'w');
}

/* ══════════════════════════════════════════════════════════════
   13. COPY / REPLACE
══════════════════════════════════════════════════════════════ */
function togDrop(id) {
  const dd = ge(id); if (!dd) return;
  const wasOpen = dd.classList.contains('op');
  document.querySelectorAll('.cpdrop.op').forEach(x => x.classList.remove('op'));
  if (!wasOpen) { updateDropCounts(); dd.classList.add('op'); }
}
function updateDropCounts() {
  ['normal','ujian','ramadan'].forEach(m => ['normal','ujian','ramadan'].filter(x=>x!==m).forEach(src => {
    const el = ge(`ccd-${m}-${src}`);
    if (el) el.textContent = `${(S.schedules[src][S.curDay[m]]||[]).length} item → Tambahkan`;
  }));
}
document.addEventListener('click', e => { if (!e.target.closest('.cpwrap')) document.querySelectorAll('.cpdrop.op').forEach(x=>x.classList.remove('op')); });

async function copyDay(tgt, src) {
  const day = S.curDay[tgt], sl = S.schedules[src][day] || [];
  if (!sl.length) { toast(`Mode ${MODE_LBL[src]} tidak punya jadwal ${DAYS_ID[DAYSK.indexOf(day)]}!`,'e'); return; }
  const copies = sl.map(it => ({ ...it, id: mkId(), mode: tgt }));
  if (!S.schedules[tgt][day]) S.schedules[tgt][day] = [];
  S.schedules[tgt][day].push(...copies);
  S.schedules[tgt][day].sort((a,b) => a.time.localeCompare(b.time));
  document.querySelectorAll('.cpdrop.op').forEach(x => x.classList.remove('op'));
  renderSchedulePanel(tgt); triggerAutoSave();
  toast(`✅ ${sl.length} jadwal disalin ke Mode ${MODE_LBL[tgt]}`,'s');
}

async function replaceDay(tgt, src) {
  const day = S.curDay[tgt], sl = S.schedules[src][day] || [];
  if (!sl.length) { toast(`Mode ${MODE_LBL[src]} kosong untuk hari ini!`,'e'); return; }
  S.schedules[tgt][day] = sl.map(it => ({ ...it, id: mkId(), mode: tgt }));
  document.querySelectorAll('.cpdrop.op').forEach(x => x.classList.remove('op'));
  renderSchedulePanel(tgt); triggerAutoSave();
  toast(`✅ Jadwal diganti dengan Mode ${MODE_LBL[src]}`,'s');
}

async function resetDayMode(m) {
  const day = S.curDay[m], def = DEF[m][day] || [];
  S.schedules[m][day] = def.map(it => ({ ...it, id: mkId() }));
  renderSchedulePanel(m); triggerAutoSave();
  toast(`✅ Jadwal ${DAYS_ID[DAYSK.indexOf(day)]} direset ke default`,'s');
}

/* ══════════════════════════════════════════════════════════════
   14. SETTINGS
══════════════════════════════════════════════════════════════ */
async function applySettings() {
  const name = (ge('settSchoolName').value || '').trim() || 'SMPN 2 Umbulsari';
  S.settings.schoolName       = name;
  S.settings.volume           = parseInt(ge('svol').value) || 80;
  S.settings.bellDuration     = parseInt(ge('sdur').value) || 5;
  S.settings.warningEnabled   = getSw('swarn');
  S.settings.warningMinutes   = parseInt(ge('swarnm').value) || 5;
  S.settings.voiceEnabled     = getSw('svoice');
  S.settings.voiceLang        = (ge('svoiceLang').value) || 'id-ID';
  setEl('hSchoolName', name);
  setEl('di-school', name.toUpperCase());
  await saveSettings();
  toast('✅ Pengaturan disimpan!', 's');
}

function loadSettingsUI() {
  const s = S.settings;
  const n = ge('settSchoolName'); if (n) n.value = s.schoolName;
  const v = ge('svol');           if (v) { v.value = s.volume; setEl('svolv', s.volume+'%'); }
  const d = ge('sdur');           if (d) d.value = s.bellDuration;
  const wm= ge('swarnm');         if (wm) wm.value = s.warningMinutes;
  const vl= ge('svoiceLang');     if (vl) vl.value = s.voiceLang || 'id-ID';
  setSw('swarn',  s.warningEnabled);
  setSw('svoice', s.voiceEnabled);
  if (s.logo) applyLogo(s.logo);
}

async function handleLogoUpload(input) {
  const file = input.files && input.files[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Pilih file gambar!','e'); return; }
  if (file.size > 2 * 1024 * 1024) { toast('Logo maks 2MB','w'); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    S.settings.logo = e.target.result;
    applyLogo(e.target.result);
    await saveSettings();
    toast('✅ Logo berhasil diupload!','s');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function applyLogo(src) {
  const hle = ge('hLogoEl');     if (hle) hle.innerHTML = `<img src="${src}" alt="Logo">`;
  const lpb = ge('logoPreviewBox'); if (lpb) lpb.innerHTML = `<img src="${src}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:var(--rad);">`;
}

function speakTest() {
  if (!('speechSynthesis' in window)) { toast('TTS tidak didukung browser ini','w'); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance('Ini adalah tes pengumuman suara SMPN 2 Umbulsari');
  u.lang = S.settings.voiceLang || 'id-ID';
  window.speechSynthesis.speak(u);
  toast('🗣️ Tes pengumuman suara...','i');
}

/* ══════════════════════════════════════════════════════════════
   15. EXPORT / IMPORT
══════════════════════════════════════════════════════════════ */
function buildExportData() {
  const data = {
    _app: 'SmartSchoolBellPRO', _version: '6.0.0',
    _school: S.settings.schoolName,
    _exported: new Date().toISOString(),
    activeMode: S.settings.activeMode,
    defaultSoundId: S.settings.defaultSoundId,
  };
  if (ge('expSched')    && ge('expSched').checked)    data.schedules = JSON.parse(JSON.stringify(S.schedules));
  if (ge('expSettings') && ge('expSettings').checked) data.settings  = { ...S.settings };
  if (ge('expHistory')  && ge('expHistory').checked)  data.history   = S.history;
  if (ge('expSounds')   && ge('expSounds').checked)   data.soundsInfo= S.sounds.map(s => ({ id:s.id, name:s.name, ext:s.ext, size:s.size, isBuiltin:s.isBuiltin }));
  return data;
}

function exportToFile() {
  const data = buildExportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob), a = document.createElement('a');
  const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
  a.href = url; a.download = `SmartBell_SMPN2Umbulsari_${date}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  toast('✅ File berhasil diunduh ke komputer!','s');
}

// localStorage backup (metadata saja, tanpa ArrayBuffer)
function saveToBrowser() {
  try {
    const data = buildExportData();
    localStorage.setItem('smartbell_v6_backup', JSON.stringify(data));
    localStorage.setItem('smartbell_v6_saved_at', new Date().toISOString());
    updateBSInfo();
    setEl('di-saved', new Date().toLocaleTimeString('id-ID'));
    toast('✅ Data disimpan ke browser (localStorage)!','s');
  } catch(e) {
    toast('⚠ localStorage penuh atau tidak tersedia','w');
  }
}

function loadFromBrowser() {
  const raw = localStorage.getItem('smartbell_v6_backup');
  if (!raw) { toast('Tidak ada data di browser!','e'); return; }
  try {
    const data = JSON.parse(raw);
    applyImport(data, 'browser');
  } catch(e) { toast('❌ Data browser rusak!','e'); }
}

function updateBSInfo() {
  const btn  = ge('btnLoadBrowser');
  const info = ge('browserDataInfo');
  const raw  = localStorage.getItem('smartbell_v6_backup');
  if (raw) {
    try {
      const d = JSON.parse(raw);
      const t = new Date(d._exported).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      if (info) info.textContent = `Tersedia · ${t}`;
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    } catch(e) {
      if (info) info.textContent = 'Data rusak';
      if (btn) { btn.disabled = true; btn.style.opacity = '.4'; }
    }
  } else {
    if (info) info.textContent = 'Belum ada data tersimpan';
    if (btn) { btn.disabled = true; btn.style.opacity = '.4'; }
  }
}

function importFromFile(input) {
  const file = input.files && input.files[0]; if (!file) return;
  if (!file.name.endsWith('.json')) { toast('Hanya file .json!','e'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data._app !== 'SmartSchoolBellPRO') { toast('⚠ Bukan file backup SmartBell!','e'); return; }
      applyImport(data, 'file');
    } catch(err) { toast('❌ File rusak!','e'); console.error(err); }
  };
  reader.readAsText(file);
  input.value = '';
}

async function applyImport(data, src) {
  if (!confirm(`Impor dari ${src==='file'?'file komputer':'browser'}?\nData saat ini akan DIGANTI.`)) return;
  if (data.schedules) {
    ['normal','ujian','ramadan'].forEach(m => {
      if (data.schedules[m]) DAYSK.forEach(d => {
        if (data.schedules[m][d]) S.schedules[m][d] = data.schedules[m][d];
      });
    });
  }
  if (data.settings) { Object.assign(S.settings, data.settings); loadSettingsUI(); setEl('hSchoolName', S.settings.schoolName); }
  if (data.activeMode) await setMode(data.activeMode);
  if (data.history) S.history = data.history;
  if (data.defaultSoundId) S.settings.defaultSoundId = data.defaultSoundId;
  await saveSchedules(); await saveSettings(); await saveHistory();
  renderAllModes(); renderHist(null); updateExportInfo();
  toast(`✅ Berhasil diimpor dari ${src==='file'?'komputer':'browser'}!`,'s');
}

function updateExportInfo() {
  setEl('di-school', S.settings.schoolName.toUpperCase());
  setEl('di-mode',   S.settings.activeMode.toUpperCase());
  let total = 0;
  ['normal','ujian','ramadan'].forEach(m => DAYSK.forEach(d => { total += (S.schedules[m][d]||[]).length; }));
  setEl('di-sch',  `${total} item total`);
  setEl('di-snd',  `${S.sounds.length} file`);
  setEl('di-hist', `${S.history.length} entri`);
  updateBSInfo();
}

/* ══════════════════════════════════════════════════════════════
   16. TAB SWITCHING
══════════════════════════════════════════════════════════════ */
function switchTab(t) {
  document.querySelectorAll('.mtab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.id === `panel-${t}`));
  if (t === 'history')  renderHist(null);
  if (t === 'audio')    renderLib();
  if (t === 'settings') loadSettingsUI();
  if (t === 'export')   updateExportInfo();
}

function panelActive(t) { const p = ge(`panel-${t}`); return p && p.classList.contains('on'); }

/* ══════════════════════════════════════════════════════════════
   17. UI HELPERS
══════════════════════════════════════════════════════════════ */
const ge     = id => document.getElementById(id);
const setEl  = (id, v) => { const e = ge(id); if (e) e.textContent = v; };
const setHTML= (id, v) => { const e = ge(id); if (e) e.innerHTML = v; };
const esc    = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const pad    = n => String(n).padStart(2,'0');
const subMins= (t, m) => { const [h,mn]=t.split(':').map(Number); const tot=h*60+mn-m; if(tot<0)return'00:00'; return `${pad(Math.floor(tot/60))}:${pad(tot%60)}`; };

function getSoundName(id) {
  if (!id || id === 'builtin') return 'Default Bell';
  const s = S.sounds.find(x => x.id === id);
  return s ? s.name : 'Default Bell';
}

function showOverlay(id) { const e = ge(id); if (e) e.classList.add('op'); }
function hideOverlay(id) { const e = ge(id); if (e) e.classList.remove('op'); }

function setSw(id, val) { const e = ge(id); if (e) e.classList.toggle('on', !!val); }
function getSw(id)      { const e = ge(id); return e ? e.classList.contains('on') : false; }
function toggleSw(id)   { const e = ge(id); if (e) e.classList.toggle('on'); }

function toast(msg, type) {
  type = type || 'i';
  const ic = { s:'✅', w:'⚠️', e:'❌', i:'ℹ️' };
  const c  = ge('tcon'); if (!c) return;
  const t  = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span style="font-size:13px;">${ic[type]||'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(12px)'; t.style.transition = '.22s';
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
  }, 3200);
}

/* ══════════════════════════════════════════════════════════════
   18. OVERLAYS (click-outside & ESC)
══════════════════════════════════════════════════════════════ */
['schedModal','soundOptModal','bellPop'].forEach(id => {
  const el = ge(id);
  if (el) el.addEventListener('click', e => { if (e.target === el) hideOverlay(id); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['schedModal','soundOptModal','bellPop'].forEach(hideOverlay);
  }
});

/* ══════════════════════════════════════════════════════════════
   19. PWA — SERVICE WORKER
══════════════════════════════════════════════════════════════ */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('[SW] Registered:', reg.scope);
    }).catch(err => console.warn('[SW]', err));
  }
}

/* ══════════════════════════════════════════════════════════════
   20. INIT
══════════════════════════════════════════════════════════════ */
async function init() {
  try {
    // 1. Buka IndexedDB
    await openDB();

    // 2. Load semua data
    await loadAll();

    // 3. Sinkron UI
    setEl('hSchoolName', S.settings.schoolName);
    setEl('di-school', S.settings.schoolName.toUpperCase());
    if (S.settings.logo) applyLogo(S.settings.logo);

    // 4. Set hari hari ini
    const today = getTodayKey();
    ['normal','ujian','ramadan'].forEach(m => S.curDay[m] = today);

    // 5. Apply mode
    document.body.setAttribute('data-mode', S.settings.activeMode);
    setEl('amtxt',      MODE_LBL[S.settings.activeMode]);
    setEl('sActiveTxt', MODE_LBL[S.settings.activeMode]);
    setEl('fmode',      `Mode: ${MODE_LBL[S.settings.activeMode]}`);

    // 6. Update activate buttons
    ['normal','ujian','ramadan'].forEach(m => {
      const b = ge(`ba-${m}`); if (!b) return;
      b.textContent = m === S.settings.activeMode ? '✅ Aktif' : '▶ Aktifkan';
      b.classList.toggle('is-active', m === S.settings.activeMode);
    });

    // 7. Render
    renderAllModes();
    renderLib();
    renderHist(null);
    loadSettingsUI();

    // 8. Clock
    startClock();

    // 9. SW
    registerSW();

    // 10. Auto‐save label
    setEl('autoSaveLbl', '✓ Tersimpan (IndexedDB)');

    // 11. Update browser storage info
    updateBSInfo();

    console.log('[SmartBell v6] ✅ Init OK — SMPN 2 Umbulsari');
  } catch(e) {
    console.error('[SmartBell] Init error:', e);
    toast('⚠ Gagal memuat data. Coba refresh halaman.','e');
  }
}

// Jalankan saat DOM siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
