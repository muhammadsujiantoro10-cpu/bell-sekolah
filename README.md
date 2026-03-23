# 🔔 Smart School Bell System PRO v6.0
## SMPN 2 Umbulsari

Aplikasi bell sekolah otomatis berbasis PWA (Progressive Web App) yang berjalan **100% offline**.

---

## 📁 Struktur File

```
smart-bell/
├── index.html      ← Halaman utama aplikasi
├── script.js       ← Logika utama (IndexedDB, audio, bell)
├── style.css       ← Tampilan / UI
├── sw.js           ← Service Worker (offline PWA)
├── manifest.json   ← Manifest PWA (install ke HP/desktop)
├── favicon.png     ← Ikon browser
├── icon-*.png      ← Ikon berbagai ukuran untuk PWA
└── README.md       ← Panduan ini
```

---

## 🚀 Cara Deploy

### Opsi 1 — Jalankan Lokal (tanpa internet)
1. Copy semua file ke satu folder
2. Buka dengan server lokal:
   - **Python:** `python -m http.server 8080` → buka http://localhost:8080
   - **Node.js:** `npx serve .` → buka di browser
   - **VS Code:** Install ekstensi "Live Server" → klik "Go Live"
3. Buka di browser (Chrome/Edge direkomendasikan)

> ⚠️ **Wajib pakai server lokal** — tidak bisa dibuka langsung dengan `file://` karena Service Worker memerlukan HTTP/HTTPS.

### Opsi 2 — Deploy ke Hosting Gratis
Upload semua file ke:
- **GitHub Pages** — gratis, HTTPS otomatis
- **Netlify** — drag & drop folder ke netlify.com/drop
- **Vercel** — `vercel deploy`
- **Firebase Hosting** — `firebase deploy`

### Opsi 3 — Server Sekolah / Intranet
Upload ke folder web server (Apache/Nginx) di komputer sekolah.
Akses dari semua komputer di jaringan sekolah via IP lokal.

---

## ✨ Fitur Utama

| Fitur | Keterangan |
|-------|-----------|
| 🏫 Multi Mode | Normal, Ujian, Ramadan — masing-masing punya jadwal sendiri |
| 📅 6 Hari | Senin s/d Sabtu per mode |
| 🎵 Upload Audio Per Jadwal | Upload MP3/WAV/dll langsung ke jadwal tertentu |
| 💾 Auto-Save IndexedDB | Data + audio tersimpan permanen, tidak hilang saat refresh |
| 🔊 Bell Otomatis | Berbunyi sesuai jadwal yang diatur |
| 🗣️ Text-to-Speech | Pengumuman suara otomatis |
| ⚠️ Bell Peringatan | Bunyi N menit sebelum jadwal |
| 📋 Salin Jadwal Antar Mode | Copy jadwal dari mode lain per hari |
| 💾 Ekspor/Impor JSON | Backup ke komputer atau localStorage |
| 📱 PWA | Bisa diinstall di HP & desktop, jalan offline |

---

## 🎵 Format Audio Didukung
MP3, WAV, OGG, AAC, FLAC, M4A, OPUS, WEBM — Maks 15MB per file

---

## 🛡️ Data & Keamanan
- Semua data tersimpan di **IndexedDB browser** (tidak ke server)
- Audio disimpan sebagai **ArrayBuffer** di IndexedDB
- Tidak perlu internet setelah pertama kali dibuka
- Backup manual via **Ekspor → Download JSON**

---

## 📱 Install sebagai Aplikasi
1. Buka di Chrome/Edge
2. Klik ikon install di address bar (atau menu ⋮ → "Install app")
3. Aplikasi muncul di desktop/homescreen seperti app native

---

## 🔧 Persyaratan Browser
- Chrome 80+ / Edge 80+ / Firefox 75+ / Safari 14+
- IndexedDB harus aktif (default aktif di semua browser modern)
- JavaScript harus diaktifkan

---

*Dibuat untuk SMPN 2 Umbulsari — Smart School Bell System PRO v6.0*
