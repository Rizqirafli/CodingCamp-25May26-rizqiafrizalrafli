# Requirements Document

## Introduction

Expense & Budget Visualizer adalah aplikasi web berbasis klien yang memungkinkan pengguna mencatat, mengelola, dan memvisualisasikan pengeluaran mereka berdasarkan kategori. Aplikasi ini dibangun menggunakan HTML, CSS, dan Vanilla JavaScript tanpa backend, menyimpan semua data di browser melalui Local Storage. Tujuannya adalah memberikan gambaran visual yang jelas tentang distribusi pengeluaran sehingga pengguna dapat membuat keputusan keuangan yang lebih baik.

## Glossary

- **App**: Aplikasi web Expense & Budget Visualizer secara keseluruhan.
- **Transaction**: Satu entri pengeluaran yang terdiri dari nama item, jumlah, dan kategori.
- **Category**: Klasifikasi pengeluaran; salah satu dari: Food, Transport, atau Fun.
- **Transaction_List**: Komponen UI yang menampilkan semua transaksi yang telah ditambahkan.
- **Input_Form**: Komponen UI berupa formulir untuk memasukkan data transaksi baru.
- **Balance_Display**: Komponen UI yang menampilkan total keseluruhan pengeluaran.
- **Chart**: Komponen visualisasi pie chart yang menampilkan distribusi pengeluaran per kategori.
- **Local_Storage**: Browser Local Storage API yang digunakan untuk menyimpan data transaksi secara persisten di sisi klien.
- **Validator**: Komponen logika yang memvalidasi input dari pengguna sebelum transaksi disimpan.

---

## Requirements

### Requirement 1: Input Transaksi

**User Story:** Sebagai pengguna, saya ingin mengisi formulir dengan nama item, jumlah, dan kategori, sehingga saya dapat mencatat pengeluaran saya dengan cepat.

#### Acceptance Criteria

1. THE Input_Form SHALL menyediakan field teks untuk nama item (maksimal 100 karakter), field angka untuk jumlah (rentang 0.01–999,999,999.99), dan dropdown untuk memilih kategori (Food, Transport, Fun).
2. WHEN pengguna mengklik tombol submit, THE Validator SHALL memeriksa bahwa semua field (nama item, jumlah, dan kategori) telah terisi dan tidak hanya berisi spasi.
3. IF salah satu field kosong atau hanya berisi spasi saat submit, THEN THE Input_Form SHALL menampilkan pesan kesalahan inline di bawah field yang bermasalah, menyebutkan nama field tersebut secara eksplisit.
4. WHEN semua field terisi, THE Validator SHALL memeriksa bahwa jumlah yang dimasukkan adalah angka dalam rentang 0.01–999,999,999.99.
5. IF jumlah berada di luar rentang yang valid atau bukan angka, THEN THE Validator SHALL menampilkan pesan kesalahan inline yang menyebutkan rentang nilai yang diterima.
6. WHEN semua field valid dan pengguna mengklik submit, THE App SHALL menambahkan transaksi baru ke Transaction_List dan mengosongkan semua field pada Input_Form.

---

### Requirement 2: Daftar Transaksi

**User Story:** Sebagai pengguna, saya ingin melihat semua transaksi yang telah saya catat dalam sebuah daftar, sehingga saya dapat meninjau riwayat pengeluaran saya.

#### Acceptance Criteria

1. THE Transaction_List SHALL menampilkan semua transaksi yang tersimpan, masing-masing dengan nama item, jumlah dalam format mata uang (Rp X.XXX), dan label kategori.
2. IF jumlah transaksi melebihi area tampilan yang tersedia, THEN THE Transaction_List SHALL dapat di-scroll secara vertikal untuk menampilkan semua item.
3. WHEN pengguna mengklik tombol hapus pada sebuah transaksi, THE App SHALL menghapus transaksi tersebut dari Transaction_List dan memperbarui Balance_Display serta Chart secara otomatis.
4. WHEN penghapusan transaksi terakhir selesai dilakukan, THE Transaction_List SHALL menampilkan teks "Belum ada transaksi. Tambahkan pengeluaran pertama Anda." kepada pengguna.
5. WHILE masih ada minimal satu transaksi yang tersimpan, THE Transaction_List SHALL menyembunyikan pesan kosong tersebut.
6. IF terjadi kegagalan saat menghapus transaksi dari Local_Storage, THEN THE App SHALL menampilkan notifikasi kesalahan dan membatalkan penghapusan dari tampilan.

---

### Requirement 3: Total Balance

**User Story:** Sebagai pengguna, saya ingin melihat total keseluruhan pengeluaran saya di bagian atas halaman, sehingga saya dapat mengetahui berapa banyak yang telah saya keluarkan secara keseluruhan.

#### Acceptance Criteria

1. THE Balance_Display SHALL menampilkan jumlah total dari semua transaksi yang tersimpan (tanpa filter) di bagian atas halaman; WHEN tidak ada transaksi, THE Balance_Display SHALL menampilkan "Rp 0".
2. WHEN sebuah transaksi baru ditambahkan, THE Balance_Display SHALL memperbarui total secara otomatis tanpa memerlukan reload halaman.
3. WHEN sebuah transaksi dihapus, THE Balance_Display SHALL memperbarui total secara otomatis tanpa memerlukan reload halaman.
4. THE Balance_Display SHALL memformat angka total dengan awalan "Rp", pemisah ribuan menggunakan titik, dan tanpa desimal (contoh: Rp 150.000); IF total bernilai nol, THEN ditampilkan sebagai "Rp 0".

---

### Requirement 4: Visualisasi Pie Chart

**User Story:** Sebagai pengguna, saya ingin melihat pie chart yang menampilkan distribusi pengeluaran berdasarkan kategori, sehingga saya dapat memahami pola pengeluaran saya secara visual.

#### Acceptance Criteria

1. THE Chart SHALL menampilkan pie chart yang memvisualisasikan proporsi pengeluaran untuk setiap kategori (Food, Transport, Fun) yang memiliki nilai lebih dari nol.
2. WHEN sebuah transaksi baru ditambahkan, THE Chart SHALL memperbarui tampilannya secara otomatis dalam waktu ≤1 detik untuk mencerminkan distribusi terbaru.
3. WHEN sebuah transaksi dihapus, THE Chart SHALL memperbarui tampilannya secara otomatis dalam waktu ≤1 detik untuk mencerminkan distribusi terbaru.
4. THE Chart SHALL menggunakan warna yang berbeda dan konsisten untuk setiap kategori selama satu sesi pengguna, disertai legenda yang menampilkan nama kategori dan warna yang sesuai.
5. IF tidak ada transaksi yang tersisa, THEN THE Chart SHALL beralih ke tampilan yang menampilkan teks "Belum ada data pengeluaran" dalam waktu ≤500ms.
6. WHEN sebuah kategori tidak memiliki transaksi, THE Chart SHALL mengecualikan kategori tersebut dari tampilan pie chart dan legenda.

---

### Requirement 5: Persistensi Data

**User Story:** Sebagai pengguna, saya ingin data pengeluaran saya tetap tersimpan saat saya menutup atau me-refresh browser, sehingga saya tidak kehilangan riwayat transaksi saya.

#### Acceptance Criteria

1. WHEN pengguna menambahkan sebuah transaksi, THE App SHALL menyimpan data transaksi tersebut ke Local_Storage sebelum memperbarui tampilan.
2. WHEN pengguna menghapus sebuah transaksi, THE App SHALL memperbarui data di Local_Storage untuk mencerminkan penghapusan tersebut.
3. WHEN App dimuat di browser, THE App SHALL membaca semua transaksi yang tersimpan dari Local_Storage dan menampilkannya di Transaction_List; IF terjadi kegagalan saat membaca Local_Storage, THEN THE App SHALL menampilkan notifikasi bahwa data tidak dapat dimuat dan memulai dengan daftar kosong.
4. IF Local_Storage tidak tersedia atau mengalami kegagalan saat penulisan, THEN THE App SHALL menampilkan banner notifikasi yang terlihat jelas kepada pengguna bahwa data tidak dapat disimpan secara persisten, dan notifikasi tersebut harus dapat ditutup oleh pengguna.
5. IF data yang tersimpan di Local_Storage tidak dapat di-parse (corrupt atau format tidak valid), THEN THE App SHALL mengabaikan data tersebut, menginisialisasi dengan daftar transaksi kosong, dan menampilkan notifikasi kepada pengguna bahwa data sebelumnya tidak dapat dipulihkan.

---

### Requirement 6: Kompatibilitas Browser

**User Story:** Sebagai pengguna, saya ingin aplikasi berjalan dengan baik di berbagai browser modern, sehingga saya dapat menggunakannya tanpa bergantung pada browser tertentu.

#### Acceptance Criteria

1. THE App SHALL berfungsi tanpa error JavaScript, tampilan yang rusak, atau fitur yang tidak dapat digunakan pada Chrome versi 120+, Firefox versi 121+, Edge versi 120+, dan Safari versi 17+.
2. THE App SHALL dapat dijalankan sebagai standalone web app yang dibuka langsung dari file sistem (protokol `file://`) tanpa memerlukan server; semua fitur inti (Input_Form, Transaction_List, Balance_Display, Chart, dan Local_Storage) SHALL berfungsi penuh dalam mode ini.
3. THE App SHALL dapat dipaket sebagai browser extension (Manifest V3) tanpa mengubah logika inti di dalam `js/` dan `css/`; hanya file manifest dan wrapper yang boleh ditambahkan.

---

### Requirement 7: Performa UI

**User Story:** Sebagai pengguna, saya ingin antarmuka merespons dengan cepat saat saya menambah atau menghapus transaksi, sehingga pengalaman penggunaan terasa lancar dan tidak mengganggu.

#### Acceptance Criteria

1. WHEN pengguna menambahkan atau menghapus transaksi, THE App SHALL memperbarui Transaction_List, Balance_Display, dan Chart dalam waktu kurang dari 300ms, diukur dari saat aksi pengguna selesai hingga seluruh komponen tersebut selesai dirender.
2. WHEN pengguna membuka App, THE App SHALL memuat dan menampilkan antarmuka awal dalam waktu kurang dari 2 detik pada koneksi dengan bandwidth minimum 10 Mbps dan latency maksimum 50ms.
3. WHILE pengguna berinteraksi dengan Input_Form, THE App SHALL merespons setiap input pengguna dalam waktu kurang dari 100ms per keystroke.
