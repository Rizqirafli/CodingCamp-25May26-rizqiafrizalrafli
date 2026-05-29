# Design Document: Expense & Budget Visualizer

## Overview

Expense & Budget Visualizer adalah aplikasi web satu halaman (*single-page*) berbasis klien yang dibangun dengan HTML, CSS, dan Vanilla JavaScript murni. Tidak memerlukan backend, build tools, atau dependensi eksternal — hanya browser modern. Semua data disimpan secara persisten di browser melalui Local Storage.

Aplikasi ini memungkinkan pengguna mencatat transaksi pengeluaran, melihat total balance dalam format Rupiah, dan memvisualisasikan distribusi pengeluaran per kategori melalui pie chart berbasis Canvas.

### File yang Dikirimkan

```
expense-budget-visualizer/
├── index.html          ← markup dan struktur halaman
├── css/
│   └── styles.css      ← semua styling dan responsive layout
├── js/
│   └── app.js          ← semua logika aplikasi
├── manifest.json       ← Manifest V3 untuk browser extension (opsional)
└── icons/              ← ikon ekstensi (opsional, hanya untuk packaging MV3)
```

> **Catatan Desain — Fitur di Luar Scope Requirements:**
> Requirements saat ini (Req 1–7) tidak mencakup custom categories, monthly summary, atau sorting. Fitur-fitur tersebut **tidak diimplementasikan** dalam versi ini. Kategori yang tersedia adalah tiga kategori tetap: Food, Transport, Fun. Jika fitur-fitur tersebut dibutuhkan di masa depan, dapat ditambahkan sebagai requirements baru.

---

## Architecture

Aplikasi mengikuti pola **Model–View–Controller (MVC)** sederhana yang diimplementasikan sepenuhnya di `js/app.js`, tanpa framework. Ini menjaga kode tetap terorganisir dan dapat diuji tanpa kompleksitas build.

```
┌─────────────────────────────────────────────────────────┐
│                        index.html                        │
│  (markup statis: form, list, balance, canvas chart)      │
└────────────────────────┬────────────────────────────────┘
                         │ DOM events / DOM updates
┌────────────────────────▼────────────────────────────────┐
│                        js/app.js                         │
│                                                          │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │  Model   │◄──│  Controller  │──►│      View        │ │
│  │(State +  │   │ (event       │   │ (DOM rendering,  │ │
│  │ Storage) │   │  handlers)   │   │  chart drawing)  │ │
│  └──────────┘   └──────────────┘   └──────────────────┘ │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   Browser Local Storage                  │
│  Key: "ebv_transactions"  →  JSON array of transactions  │
└─────────────────────────────────────────────────────────┘
```

### Keputusan Arsitektur Utama

- **Tanpa library eksternal**: Pie chart digambar pada elemen `<canvas>` menggunakan Canvas 2D API. Ini menghindari dependensi Chart.js dan menjaga ukuran bundle tetap nol — penting untuk kompatibilitas `file://` dan packaging MV3.
- **Single source of truth**: Semua state aplikasi hidup dalam satu array in-memory (`transactions`). Setiap pembaruan UI adalah re-render murni dari state ini.
- **ID immutable**: Setiap transaksi diberi `crypto.randomUUID()` (atau fallback berbasis timestamp untuk Safari lama) saat dibuat. ID tidak pernah digunakan ulang.
- **Defensive Storage access**: Semua panggilan `localStorage` dibungkus dalam try/catch. Kegagalan ditampilkan sebagai peringatan UI non-blocking, bukan crash.
- **Kompatibilitas `file://`**: Tidak ada penggunaan `fetch()`, modul ES, atau API yang memerlukan origin HTTP. Semua kode berjalan sebagai skrip inline atau `<script src="">` biasa.
- **Performa**: Re-render dilakukan secara sinkron dalam satu event loop tick. Tidak ada debouncing yang tidak perlu. Ini memastikan pembaruan UI selesai dalam <300ms untuk operasi add/delete (Req 7.1) dan respons keystroke <100ms (Req 7.3).

---

## Components and Interfaces

### 1. StorageService

Bertanggung jawab atas semua baca/tulis ke `localStorage`. Mengekspos antarmuka key/value sederhana sehingga bagian lain aplikasi tidak pernah memanggil `localStorage` secara langsung.

```js
StorageService = {
  load(key)        → any | null   // JSON.parse; returns null on error
  save(key, value) → boolean      // JSON.stringify; returns false on error
  KEYS: {
    TRANSACTIONS: "ebv_transactions"
  }
}
```

### 2. State (Model)

Objek plain yang menyimpan state in-memory aplikasi yang kanonik. Tidak pernah dimutasi langsung — hanya melalui fungsi Controller.

```js
State = {
  transactions: Transaction[]   // semua transaksi, urutan insertion
}
```

### 3. TransactionController

Menangani operasi add dan delete. Memvalidasi input, memutasi State, menyimpan ke Storage, lalu memicu re-render View penuh.

```js
TransactionController = {
  add(formData)          → { ok: boolean, errors: string[] }
  delete(id)             → { ok: boolean, error?: string }
  validateForm(formData) → string[]   // returns array of error messages
}
```

### 4. View

Fungsi rendering murni. Setiap fungsi membaca dari State dan memperbarui DOM. Tidak ada fungsi View yang membaca dari Storage atau memutasi State.

```js
View = {
  renderTransactionList(transactions) → void
  renderBalance(transactions)         → void
  renderChart(transactions)           → void
  showError(message)                  → void   // non-blocking toast
  resetForm()                         → void
}
```

**Teks UI dalam Bahasa Indonesia:**
- Empty state Transaction_List: `"Belum ada transaksi. Tambahkan pengeluaran pertama Anda."`
- Empty state Chart: `"Belum ada data pengeluaran"`
- Balance nol: `"Rp 0"`

### 5. ChartRenderer

Menggambar pie chart pada elemen `<canvas>` menggunakan Canvas 2D API. Menerima map `{ category → total }` dan merender irisan proporsional dengan legenda.

```js
ChartRenderer = {
  draw(categoryTotals: Map<string, number>) → void
  drawEmpty()                               → void   // tampilkan "Belum ada data pengeluaran"
  COLORS: {
    Food:      "#FF6384",
    Transport: "#36A2EB",
    Fun:       "#FFCE56"
  }
}
```

### 6. BalanceFormatter

Fungsi utilitas murni untuk memformat angka ke format Rupiah sesuai Req 3.4.

```js
BalanceFormatter = {
  format(amount: number) → string
  // format(150000)  → "Rp 150.000"
  // format(1500000) → "Rp 1.500.000"
  // format(0)       → "Rp 0"
  // Aturan: awalan "Rp ", pemisah ribuan titik, tanpa desimal
}
```

### 7. App (bootstrap)

Entry point. Berjalan pada `DOMContentLoaded`. Memuat state dari Storage, menghubungkan semua event listener, dan memicu render awal.

```js
App = {
  init() → void
}
```

---

## Data Models

### Transaction

```js
{
  id:        string,   // crypto.randomUUID() atau Date.now().toString()
  name:      string,   // nama item, 1–100 karakter
  amount:    number,   // angka positif, 0.01–999,999,999.99, disimpan sebagai number
  category:  string,   // salah satu dari: "Food", "Transport", "Fun"
  createdAt: string    // timestamp ISO 8601, mis. "2025-01-15T10:30:00.000Z"
}
```

### Kategori

Kategori bersifat tetap (tidak dapat dikustomisasi oleh pengguna dalam versi ini):

```js
const CATEGORIES = ["Food", "Transport", "Fun"];
```

Kategori-kategori ini tidak disimpan ke Storage — selalu tersedia secara hardcoded di runtime.

### Storage Layout

| Key | Tipe | Deskripsi |
|-----|------|-----------|
| `ebv_transactions` | `Transaction[]` | Semua transaksi, urutan insertion |

### Aturan Validasi

| Field | Aturan |
|-------|--------|
| Nama item | String non-kosong, tidak hanya spasi, maksimal 100 karakter |
| Jumlah | Angka, 0.01 ≤ amount ≤ 999,999,999.99 |
| Kategori | Harus salah satu dari: "Food", "Transport", "Fun" |

### Format Balance (Req 3.4)

| Input | Output |
|-------|--------|
| `0` | `"Rp 0"` |
| `1500` | `"Rp 1.500"` |
| `150000` | `"Rp 150.000"` |
| `1500000` | `"Rp 1.500.000"` |

Aturan: awalan `"Rp "`, pemisah ribuan menggunakan titik (`.`), tanpa desimal.

### Struktur File untuk Browser Extension (Req 6.3)

Untuk packaging sebagai Manifest V3, hanya perlu menambahkan dua file tanpa mengubah `js/` atau `css/`:

```
expense-budget-visualizer/
├── index.html          ← tidak diubah
├── css/styles.css      ← tidak diubah
├── js/app.js           ← tidak diubah
├── manifest.json       ← BARU: Manifest V3 descriptor
└── icons/
    ├── icon16.png      ← BARU: ikon ekstensi
    ├── icon48.png
    └── icon128.png
```

Contoh `manifest.json` minimal:

```json
{
  "manifest_version": 3,
  "name": "Expense & Budget Visualizer",
  "version": "1.0.0",
  "description": "Catat dan visualisasikan pengeluaran Anda.",
  "action": {
    "default_popup": "index.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "permissions": ["storage"]
}
```

> **Catatan**: Manifest V3 tidak mengizinkan `eval()` atau inline scripts. Semua JavaScript harus berada di file eksternal (`js/app.js`). Tidak ada inline `<script>` di `index.html`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transaction persistence round-trip

*For any* valid transaction (nama item non-kosong, jumlah dalam rentang 0.01–999,999,999.99, kategori valid), menambahkannya ke aplikasi dan kemudian membaca semua transaksi dari Storage harus menghasilkan koleksi yang mengandung transaksi dengan nama, jumlah, dan kategori yang sama.

**Validates: Requirements 5.1, 5.3**

---

### Property 2: Balance equals sum of all transaction amounts

*For any* daftar transaksi (termasuk daftar kosong), Balance yang ditampilkan harus sama dengan jumlah aritmatika dari semua jumlah transaksi, diformat sebagai "Rp X.XXX" dengan pemisah ribuan titik dan tanpa desimal; jika daftar kosong, harus menampilkan "Rp 0".

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

### Property 3: Deleting a transaction removes it from state and Storage

*For any* daftar transaksi yang tidak kosong, menghapus sebuah transaksi berdasarkan ID-nya harus menghasilkan daftar transaksi yang tidak lagi mengandung ID tersebut, dan nilai yang dibaca kembali dari Storage harus mencerminkan penghapusan yang sama.

**Validates: Requirements 2.3, 5.2**

---

### Property 4: Chart category totals match transaction data

*For any* daftar transaksi, total kategori yang dihitung untuk chart harus memenuhi dua invariant: (a) jumlah semua total kategori sama dengan jumlah semua jumlah transaksi, dan (b) setiap total kategori individual sama dengan jumlah amount untuk transaksi yang termasuk dalam kategori tersebut; kategori dengan total nol tidak boleh muncul di chart.

**Validates: Requirements 4.1, 4.6**

---

### Property 5: Balance Rp formatting is correct for all amounts

*For any* angka non-negatif yang merepresentasikan total balance, fungsi format harus menghasilkan string yang diawali "Rp ", menggunakan titik sebagai pemisah ribuan, tanpa desimal, dan menampilkan "Rp 0" untuk nilai nol.

**Validates: Requirements 3.4**

---

### Property 6: Validation rejects invalid form inputs

*For any* kombinasi input formulir di mana setidaknya satu field kosong, hanya berisi spasi, atau jumlah berada di luar rentang 0.01–999,999,999.99, fungsi `validateForm` harus mengembalikan array error yang tidak kosong yang mengidentifikasi field yang bermasalah secara eksplisit.

**Validates: Requirements 1.2, 1.3, 1.4, 1.5**

---

### Property 7: Valid submission adds transaction and clears form

*For any* data formulir yang valid (nama non-kosong, jumlah dalam rentang, kategori valid), mengirimkan formulir harus menambahkan tepat satu transaksi baru ke daftar transaksi dan mengosongkan semua field formulir.

**Validates: Requirements 1.6**

---

### Property 8: Transaction list renders correct format for all transactions

*For any* daftar transaksi, setiap item yang dirender dalam Transaction_List harus menampilkan nama item, jumlah dalam format "Rp X.XXX" (dengan pemisah ribuan titik), dan label kategori yang sesuai.

**Validates: Requirements 2.1**

---

## Error Handling

### Storage Errors

Semua operasi `localStorage` dibungkus dalam try/catch:

- **Saat gagal load**: Aplikasi diinisialisasi dengan state kosong dan menampilkan banner non-blocking: *"Data tidak dapat dimuat. Memulai dengan daftar kosong."* (Req 5.3)
- **Saat gagal tulis setelah add/delete**: State in-memory tetap konsisten (operasi tercermin di UI), tetapi toast non-blocking ditampilkan: *"Data Anda mungkin tidak tersimpan."* (Req 5.4)
- **Saat data corrupt/tidak valid di Storage**: Data diabaikan, aplikasi diinisialisasi dengan daftar kosong, dan notifikasi ditampilkan kepada pengguna bahwa data sebelumnya tidak dapat dipulihkan. (Req 5.5)
- **Saat penghapusan gagal di Storage**: Penghapusan dari tampilan dibatalkan (transaksi tetap terlihat di UI), dan notifikasi error ditampilkan. (Req 2.6)

### Validation Errors

- **Formulir transaksi**: Pesan error inline muncul di bawah setiap field yang tidak valid, menyebutkan nama field secara eksplisit. Formulir tidak disubmit. Error dihapus pada submit valid berikutnya. (Req 1.3, 1.5)
- **Kategori tidak valid**: Jika kategori yang dipilih tidak ada dalam daftar CATEGORIES, transaksi ditolak dengan pesan error.

### Confirmation Before Delete

Menghapus transaksi memerlukan konfirmasi pengguna (dialog `confirm()` browser atau modal kustom). Jika pengguna membatalkan, tidak ada tindakan yang diambil.

### Edge Cases

| Skenario | Perilaku |
|----------|----------|
| Semua transaksi dihapus | Balance menampilkan "Rp 0"; chart menampilkan "Belum ada data pengeluaran"; Transaction_List menampilkan "Belum ada transaksi. Tambahkan pengeluaran pertama Anda." |
| Storage quota terlampaui | Ditangkap sebagai write error; toast non-blocking ditampilkan |
| `crypto.randomUUID` tidak tersedia | Fallback ke `Date.now() + Math.random()` string |
| JSON malformed di Storage | Diperlakukan sebagai load failure; aplikasi mulai dengan state kosong |
| Jumlah dengan lebih dari 2 desimal | Validasi menolak dengan pesan spesifik |
| Aplikasi dibuka via `file://` | Semua fitur berfungsi penuh; tidak ada panggilan `fetch()` atau modul ES |

---

## Testing Strategy

### Overview

Aplikasi menggunakan **pendekatan pengujian ganda**:
- **Unit / example-based tests** untuk perilaku spesifik, edge case, dan kondisi error
- **Property-based tests** untuk properti kebenaran universal di seluruh ruang input

Karena logika inti (validasi, agregasi, serialisasi, formatting) terdiri dari fungsi-fungsi murni yang beroperasi pada struktur data plain, property-based testing sangat cocok di sini.

### Property-Based Testing

**Library**: [fast-check](https://github.com/dubzzz/fast-check) (JavaScript, berjalan di Node.js dengan test runner apa pun)

**Konfigurasi**: Setiap property test berjalan minimal **100 iterasi**.

**Format tag**: Setiap property test diberi tag dengan komentar:
```
// Feature: expense-budget-visualizer, Property N: <teks properti>
```

**Properties yang diimplementasikan sebagai PBT tests**:

| Property | Deskripsi Test |
|----------|----------------|
| Property 1 | Transaction persistence round-trip |
| Property 2 | Balance equals sum of amounts (Rp format) |
| Property 3 | Delete removes from state and Storage |
| Property 4 | Chart category totals match transaction data |
| Property 5 | Balance Rp formatting correct for all amounts |
| Property 6 | Validation rejects invalid form inputs |
| Property 7 | Valid submission adds transaction and clears form |
| Property 8 | Transaction list renders correct format |

### Unit / Example-Based Tests

Fokus pada:
- Pesan error validasi spesifik (field yang benar diidentifikasi, aturan yang benar dikutip)
- Balance menampilkan "Rp 0" saat tidak ada transaksi
- Chart merender teks "Belum ada data pengeluaran" saat daftar transaksi kosong
- Transaction_List menampilkan "Belum ada transaksi. Tambahkan pengeluaran pertama Anda." saat daftar kosong
- Kegagalan Storage saat load menginisialisasi state kosong dengan peringatan
- Kegagalan Storage saat write menampilkan toast dan mempertahankan state UI
- Data corrupt di Storage diabaikan dan notifikasi ditampilkan
- Penghapusan gagal di Storage membatalkan penghapusan dari tampilan

### Integration Points

- `StorageService` diuji dengan mock `localStorage` (objek in-memory yang mengimplementasikan `getItem`/`setItem`/`removeItem`) untuk menghindari ketergantungan browser nyata dalam tests.
- `ChartRenderer` diuji dengan mock `CanvasRenderingContext2D` untuk memverifikasi bahwa `draw()` dipanggil dengan total kategori yang benar.
- `BalanceFormatter.format()` diuji sebagai fungsi murni tanpa mock.

### Performance Testing

Persyaratan performa (Req 7) diverifikasi melalui:

| Persyaratan | Metode Verifikasi |
|-------------|-------------------|
| Add/delete memperbarui semua komponen dalam <300ms (Req 7.1) | Benchmark manual: `performance.now()` sebelum/sesudah operasi di DevTools |
| Initial load <2 detik pada 10 Mbps / 50ms latency (Req 7.2) | Lighthouse performance audit; throttle jaringan di DevTools |
| Respons keystroke <100ms (Req 7.3) | DevTools Performance profiler; input event timing |

**Mengapa arsitektur memenuhi threshold ini**: Re-render dilakukan secara sinkron dalam satu event loop tick tanpa debouncing. Tidak ada operasi async di jalur kritis. Canvas 2D API sangat cepat untuk 3 kategori. Ukuran payload Storage kecil (array JSON sederhana). Ini memastikan semua operasi UI selesai jauh di bawah 300ms bahkan pada perangkat kelas bawah.

### Browser Compatibility Testing

Smoke test manual pada versi stabil saat ini dari Chrome 120+, Firefox 121+, Edge 120+, dan Safari 17+ untuk memverifikasi:
- Aplikasi memuat dan merender dengan benar (Req 6.1)
- Semua interaksi berfungsi (add, delete, chart update)
- Chart merender dengan benar pada implementasi Canvas masing-masing browser
- Aplikasi berfungsi penuh saat dibuka via `file://` (Req 6.2)
- Packaging MV3 valid dan ekstensi dapat dimuat di Chrome (Req 6.3)

### Accessibility Testing

- Pengujian manual dengan screen reader (NVDA + Chrome, VoiceOver + Safari) untuk memverifikasi semua kontrol memiliki accessible names.
- Pemeriksaan otomatis dengan axe-core untuk pelanggaran WCAG 2.1 AA.
