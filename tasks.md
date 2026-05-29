# Implementation Plan: Expense & Budget Visualizer

## Overview

Implementasi aplikasi web satu halaman berbasis Vanilla JavaScript dengan pola MVC. Semua logika berada di tiga file: `index.html`, `css/styles.css`, dan `js/app.js`. Tidak ada build tools, tidak ada framework, tidak ada dependensi eksternal. Pengujian menggunakan **fast-check** untuk property-based tests dan test runner standar Node.js (misalnya Vitest atau Jest) untuk unit tests.

---

## Tasks

- [ ] 1. Buat struktur file proyek dan markup HTML
  - Buat `index.html` dengan elemen statis: form input (field nama, jumlah, dropdown kategori, tombol submit), container daftar transaksi, area balance display, elemen `<canvas>` untuk chart, dan area notifikasi/toast
  - Buat `css/styles.css` dengan layout dasar, styling form, daftar transaksi, balance display, canvas chart, dan pesan error inline
  - Buat `js/app.js` sebagai file kosong dengan komentar struktur modul (StorageService, State, BalanceFormatter, TransactionController, ChartRenderer, View, App)
  - Pastikan semua `<script>` menggunakan `src` eksternal (tidak ada inline script) agar kompatibel dengan Manifest V3
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 2. Implementasi StorageService dan BalanceFormatter
  - [ ] 2.1 Implementasi `StorageService`
    - Tulis objek `StorageService` dengan metode `load(key)` dan `save(key, value)` di `js/app.js`
    - Bungkus semua panggilan `localStorage` dalam try/catch; `load` mengembalikan `null` saat error, `save` mengembalikan `false` saat error
    - Definisikan `StorageService.KEYS.TRANSACTIONS = "ebv_transactions"`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 2.2 Implementasi `BalanceFormatter`
    - Tulis objek `BalanceFormatter` dengan metode `format(amount)` di `js/app.js`
    - Aturan: awalan `"Rp "`, pemisah ribuan menggunakan titik, tanpa desimal; `format(0)` → `"Rp 0"`
    - _Requirements: 3.4_

  - [ ]* 2.3 Tulis property test untuk `BalanceFormatter` (Property 5)
    - **Property 5: Balance Rp formatting is correct for all amounts**
    - Gunakan fast-check `fc.integer({ min: 0, max: 999_999_999 })` untuk menghasilkan angka sembarang
    - Verifikasi: hasil diawali `"Rp "`, menggunakan titik sebagai pemisah ribuan, tanpa desimal, dan `format(0)` → `"Rp 0"`
    - **Validates: Requirements 3.4**
    - Tag: `// Feature: expense-budget-visualizer, Property 5: Balance Rp formatting correct for all amounts`

  - [ ]* 2.4 Tulis unit tests untuk `StorageService`
    - Mock `localStorage` dengan objek in-memory yang mengimplementasikan `getItem`/`setItem`
    - Test: load berhasil, load gagal (JSON malformed) mengembalikan null, save berhasil mengembalikan true, save gagal mengembalikan false
    - _Requirements: 5.3, 5.4, 5.5_

- [ ] 3. Implementasi State dan TransactionController
  - [ ] 3.1 Implementasi `State` dan `TransactionController.validateForm`
    - Definisikan objek `State` dengan array `transactions: []`
    - Definisikan `CATEGORIES = ["Food", "Transport", "Fun"]`
    - Tulis `TransactionController.validateForm(formData)` yang mengembalikan array pesan error untuk: nama kosong/hanya spasi, jumlah kosong/bukan angka/di luar rentang 0.01–999,999,999.99, kategori tidak valid
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [ ]* 3.2 Tulis property test untuk `validateForm` (Property 6)
    - **Property 6: Validation rejects invalid form inputs**
    - Gunakan fast-check untuk menghasilkan kombinasi input tidak valid: nama kosong/spasi, jumlah di luar rentang, kategori tidak valid
    - Verifikasi: `validateForm` selalu mengembalikan array error tidak kosong untuk input tidak valid
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
    - Tag: `// Feature: expense-budget-visualizer, Property 6: Validation rejects invalid form inputs`

  - [ ] 3.3 Implementasi `TransactionController.add`
    - Tulis `TransactionController.add(formData)` yang: memanggil `validateForm`, jika valid membuat objek Transaction baru dengan `crypto.randomUUID()` (fallback `Date.now().toString()`), menambahkan ke `State.transactions`, memanggil `StorageService.save`, mengembalikan `{ ok: true }` atau `{ ok: false, errors }`
    - Sertakan fallback UUID: jika `crypto.randomUUID` tidak tersedia, gunakan `Date.now() + '-' + Math.random().toString(36).slice(2)`
    - _Requirements: 1.6, 5.1_

  - [ ]* 3.4 Tulis property test untuk `TransactionController.add` — valid submission (Property 7)
    - **Property 7: Valid submission adds transaction and clears form**
    - Gunakan fast-check untuk menghasilkan formData valid sembarang (nama non-kosong ≤100 karakter, jumlah dalam rentang, kategori valid)
    - Verifikasi: setelah `add`, `State.transactions` bertambah tepat satu entri dengan nama/jumlah/kategori yang sesuai
    - **Validates: Requirements 1.6**
    - Tag: `// Feature: expense-budget-visualizer, Property 7: Valid submission adds transaction and clears form`

  - [ ] 3.5 Implementasi `TransactionController.delete`
    - Tulis `TransactionController.delete(id)` yang: menghapus transaksi dengan ID tersebut dari `State.transactions`, memanggil `StorageService.save`, mengembalikan `{ ok: true }` atau `{ ok: false, error }`
    - Jika `StorageService.save` gagal, batalkan penghapusan dari `State.transactions` (rollback) dan kembalikan `{ ok: false }`
    - _Requirements: 2.3, 2.6, 5.2_

  - [ ]* 3.6 Tulis property test untuk `TransactionController.delete` (Property 3)
    - **Property 3: Deleting a transaction removes it from state and Storage**
    - Gunakan fast-check untuk menghasilkan daftar transaksi tidak kosong, pilih ID sembarang dari daftar tersebut
    - Verifikasi: setelah `delete(id)`, `State.transactions` tidak lagi mengandung ID tersebut, dan nilai yang dibaca dari mock Storage juga tidak mengandung ID tersebut
    - **Validates: Requirements 2.3, 5.2**
    - Tag: `// Feature: expense-budget-visualizer, Property 3: Deleting a transaction removes it from state and Storage`

- [ ] 4. Checkpoint — Verifikasi logika inti
  - Pastikan semua tests untuk StorageService, BalanceFormatter, validateForm, add, dan delete lulus. Tanyakan kepada pengguna jika ada pertanyaan sebelum melanjutkan.

- [ ] 5. Implementasi View (rendering DOM)
  - [ ] 5.1 Implementasi `View.renderTransactionList`
    - Tulis `View.renderTransactionList(transactions)` yang merender setiap transaksi sebagai item daftar dengan nama item, jumlah dalam format `BalanceFormatter.format(amount)`, label kategori, dan tombol hapus
    - Jika `transactions` kosong, tampilkan teks `"Belum ada transaksi. Tambahkan pengeluaran pertama Anda."`; sembunyikan pesan ini jika ada minimal satu transaksi
    - Setiap tombol hapus harus menyimpan ID transaksi (misalnya via `data-id` attribute)
    - _Requirements: 2.1, 2.2, 2.4, 2.5_

  - [ ]* 5.2 Tulis property test untuk `View.renderTransactionList` (Property 8)
    - **Property 8: Transaction list renders correct format for all transactions**
    - Gunakan fast-check untuk menghasilkan array transaksi sembarang
    - Verifikasi: setiap item yang dirender mengandung nama item, jumlah dalam format `"Rp X.XXX"`, dan label kategori yang sesuai
    - **Validates: Requirements 2.1**
    - Tag: `// Feature: expense-budget-visualizer, Property 8: Transaction list renders correct format for all transactions`

  - [ ] 5.3 Implementasi `View.renderBalance`
    - Tulis `View.renderBalance(transactions)` yang menghitung total semua amount dan memperbarui elemen Balance_Display menggunakan `BalanceFormatter.format(total)`
    - Jika `transactions` kosong, tampilkan `"Rp 0"`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 5.4 Tulis property test untuk `View.renderBalance` (Property 2)
    - **Property 2: Balance equals sum of all transaction amounts**
    - Gunakan fast-check untuk menghasilkan array transaksi sembarang (termasuk array kosong)
    - Verifikasi: teks yang dirender di Balance_Display sama dengan `BalanceFormatter.format(sum of all amounts)`, dan array kosong menghasilkan `"Rp 0"`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - Tag: `// Feature: expense-budget-visualizer, Property 2: Balance equals sum of all transaction amounts`

  - [ ] 5.5 Implementasi `View.showError` dan `View.resetForm`
    - Tulis `View.showError(message)` yang menampilkan toast/notifikasi non-blocking
    - Tulis `View.resetForm()` yang mengosongkan semua field pada Input_Form dan menghapus pesan error inline
    - _Requirements: 1.6, 2.6, 5.3, 5.4, 5.5_

- [ ] 6. Implementasi ChartRenderer
  - [ ] 6.1 Implementasi `ChartRenderer.draw` dan `ChartRenderer.drawEmpty`
    - Tulis `ChartRenderer.draw(categoryTotals)` yang menggambar pie chart pada elemen `<canvas>` menggunakan Canvas 2D API
    - Hitung sudut irisan proporsional dari `categoryTotals`; gunakan warna tetap: Food `#FF6384`, Transport `#36A2EB`, Fun `#FFCE56`
    - Render legenda di bawah/samping chart dengan nama kategori dan warna yang sesuai
    - Kecualikan kategori dengan total nol dari chart dan legenda
    - Tulis `ChartRenderer.drawEmpty()` yang menampilkan teks `"Belum ada data pengeluaran"` di tengah canvas
    - _Requirements: 4.1, 4.4, 4.5, 4.6_

  - [ ]* 6.2 Tulis property test untuk `ChartRenderer` — category totals (Property 4)
    - **Property 4: Chart category totals match transaction data**
    - Gunakan fast-check untuk menghasilkan array transaksi sembarang
    - Verifikasi: (a) jumlah semua total kategori sama dengan jumlah semua amount transaksi, dan (b) setiap total kategori sama dengan jumlah amount transaksi dalam kategori tersebut
    - Gunakan mock `CanvasRenderingContext2D` untuk menghindari ketergantungan browser
    - **Validates: Requirements 4.1, 4.6**
    - Tag: `// Feature: expense-budget-visualizer, Property 4: Chart category totals match transaction data`

  - [ ]* 6.3 Tulis unit tests untuk `ChartRenderer`
    - Test: `drawEmpty()` dipanggil saat `categoryTotals` kosong
    - Test: `draw()` dipanggil dengan total kategori yang benar untuk daftar transaksi yang diketahui
    - _Requirements: 4.1, 4.5, 4.6_

- [ ] 7. Implementasi App (bootstrap dan event wiring)
  - [ ] 7.1 Implementasi `App.init` — load state dan render awal
    - Tulis `App.init()` yang berjalan pada `DOMContentLoaded`
    - Muat transaksi dari `StorageService.load(StorageService.KEYS.TRANSACTIONS)`; tangani kasus null (Storage tidak tersedia), JSON malformed (data corrupt), dan array valid
    - Tampilkan banner/notifikasi yang sesuai untuk setiap kasus kegagalan (Req 5.3, 5.5)
    - Panggil `View.renderTransactionList`, `View.renderBalance`, dan `View.renderChart` dengan state yang dimuat
    - _Requirements: 5.3, 5.5, 6.2_

  - [ ] 7.2 Implementasi event listener untuk form submit
    - Hubungkan event listener `submit` pada Input_Form ke `TransactionController.add`
    - Jika `add` mengembalikan errors, tampilkan pesan error inline di bawah field yang bermasalah
    - Jika `add` berhasil, panggil `View.resetForm()`, `View.renderTransactionList`, `View.renderBalance`, dan `ChartRenderer.draw/drawEmpty`
    - Jika `StorageService.save` gagal (dikembalikan oleh `add`), tampilkan toast via `View.showError`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 5.1, 5.4_

  - [ ] 7.3 Implementasi event listener untuk tombol hapus (event delegation)
    - Hubungkan event listener `click` pada container Transaction_List menggunakan event delegation
    - Saat tombol hapus diklik, tampilkan konfirmasi (`confirm()` browser atau modal kustom)
    - Jika dikonfirmasi, panggil `TransactionController.delete(id)`; jika berhasil, perbarui semua komponen View; jika gagal, tampilkan error dan batalkan penghapusan dari tampilan
    - _Requirements: 2.3, 2.6, 5.2_

  - [ ]* 7.4 Tulis property test untuk persistence round-trip (Property 1)
    - **Property 1: Transaction persistence round-trip**
    - Gunakan fast-check untuk menghasilkan transaksi valid sembarang
    - Verifikasi: setelah `TransactionController.add`, membaca kembali dari mock Storage menghasilkan koleksi yang mengandung transaksi dengan nama, jumlah, dan kategori yang sama
    - **Validates: Requirements 5.1, 5.3**
    - Tag: `// Feature: expense-budget-visualizer, Property 1: Transaction persistence round-trip`

  - [ ]* 7.5 Tulis unit tests untuk `App.init` — error handling Storage
    - Test: Storage tidak tersedia → state kosong + banner notifikasi ditampilkan
    - Test: data corrupt di Storage → state kosong + notifikasi "data sebelumnya tidak dapat dipulihkan" ditampilkan
    - Test: data valid di Storage → transaksi dimuat dan dirender dengan benar
    - _Requirements: 5.3, 5.5_

- [ ] 8. Checkpoint — Verifikasi integrasi penuh
  - Pastikan semua tests lulus. Buka `index.html` via `file://` di browser dan verifikasi secara manual: tambah transaksi, hapus transaksi, balance diperbarui, chart diperbarui, data persisten setelah refresh. Tanyakan kepada pengguna jika ada pertanyaan.

- [ ] 9. Packaging Manifest V3 (opsional)
  - [ ] 9.1 Buat `manifest.json` untuk browser extension
    - Tulis `manifest.json` dengan `manifest_version: 3`, `action.default_popup: "index.html"`, dan `permissions: ["storage"]`
    - Buat direktori `icons/` dengan placeholder untuk `icon16.png`, `icon48.png`, `icon128.png`
    - Verifikasi bahwa `index.html` tidak mengandung inline `<script>` (sudah dipastikan di task 1)
    - _Requirements: 6.3_

---

## Notes

- Task bertanda `*` bersifat opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirements spesifik untuk keterlacakan
- Property tests menggunakan **fast-check** dan berjalan di Node.js dengan test runner pilihan (Vitest atau Jest)
- Unit tests menggunakan mock `localStorage` (objek in-memory) dan mock `CanvasRenderingContext2D`
- Semua 8 correctness properties dari design document diimplementasikan sebagai property-based tests
- Checkpoint memastikan validasi inkremental sebelum melanjutkan ke fase berikutnya
- Tidak ada inline `<script>` di `index.html` — wajib untuk kompatibilitas Manifest V3

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2"] },
    { "id": 1, "tasks": ["2.3", "2.4", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3"] },
    { "id": 3, "tasks": ["3.4", "3.5"] },
    { "id": 4, "tasks": ["3.6", "5.1", "5.3", "5.5", "6.1"] },
    { "id": 5, "tasks": ["5.2", "5.4", "6.2", "6.3", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3"] },
    { "id": 7, "tasks": ["7.4", "7.5"] },
    { "id": 8, "tasks": ["9.1"] }
  ]
}
```
