# TEAMUP Backend REST API

Backend REST API untuk aplikasi **TEAMUP (Campus Talent & Competition Matching Platform)** — Proyek Akhir Mata Kuliah **Pengembangan Aplikasi Web II (SI5C, Universitas MDP)**.

Dibangun menggunakan **Node.js**, **Express.js 5**, **MongoDB (Mongoose)**, dan **JWT Stateless Authentication** dengan pola arsitektur **MVC / Layered** (`Models`, `Controllers`, `Routes`, `Middlewares`). Seluruh koleksi database, kolom skema, dan endpoint entitas menggunakan **Bahasa Indonesia** agar konsisten dan mudah dipahami.

---

## 1. Struktur Folder & Koleksi Database

```text
BE/
├── Controllers/       # autentikasi, pengguna, talenta, kompetisi, rekrutmen, kecocokan, tim, notifikasi, pesan, admin
├── Middlewares/       # logger, errorHandler, authMiddleware (JWT & RBAC), cekApiKey
├── Models/            # 7 Skema Mongoose -> koleksi: pengguna, kompetisi, tim, rekrutmen, kecocokan, notifikasi, pesan
├── Routes/            # Pemetaan endpoint RESTful per modul
├── scripts/
│   ├── buatAdmin.js   # Skrip server untuk membuat akun admin pertama
│   └── seed.js        # Skrip pengisi data awal (> 50 dokumen lintas 7 koleksi)
├── postman/           # Postman Collection & Environment JSON dengan automated tests
├── app.js             # Entry point Express, CORS, koneksi MongoDB, mount routes & errorHandler
├── vercel.json        # Konfigurasi deployment Vercel Serverless
├── .env.example       # Contoh variabel lingkungan (tanpa rahasia sungguhan)
└── package.json
```

---

## 2. Konfigurasi & Menjalankan Server

1. Salin `.env.example` menjadi `.env`:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/teamup
   JWT_SECRET=<generate-dengan-crypto-randomBytes-48>
   JWT_EXPIRES_IN=1h
   CLIENT_URL=http://localhost:5173
   ```
   Buat `JWT_SECRET` acak 96 karakter:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   *(Server akan menolak menyala bila `JWT_SECRET` belum diisi di `.env`.)*

2. Install dependency:
   ```bash
   npm install
   ```

3. Buat akun **admin pertama** lewat skrip server (bukan lewat endpoint register):
   ```bash
   npm run create-admin
   ```
   *(Bawaan: `admin@teamup.ac.id` / `AdminTeamup123!`.)*

4. Isi data contoh (26 pengguna, 12 kompetisi, 6 tim & rekrutmen, 4 kecocokan, 5 notifikasi, 4 pesan):
   ```bash
   npm run seed
   ```

5. Jalankan server:
   ```bash
   npm run dev
   ```

---

## 3. Desain Relasi NoSQL (Embedding vs Referencing)

| Hubungan | Pola | Alasan Pemilihan |
| :--- | :--- | :--- |
| `pengguna` → `portofolio` & `riwayatKompetisi` | **Embedding** | Selalu dibaca bersama profil mahasiswa, jumlahnya terbatas, dan hanya dimiliki satu pengguna. |
| `tim` → `anggota` & `tugas` | **Embedding** | Daftar anggota dan tugas ruang kerja selalu ditampilkan langsung saat membuka detail tim. |
| `rekrutmen` → `peranDibutuhkan` & `pelamar` | **Embedding** | Kuota peran dan daftar lamaran terikat langsung pada satu postingan rekrutmen. |
| `tim` / `rekrutmen` → `pengguna` (`ketua`) & `kompetisi` | **Referencing (`ObjectId` + `populate`)** | Satu pengguna/kompetisi dapat dirujuk oleh banyak tim & rekrutmen; data profil/kompetisi dapat berubah independen. |
| `kompetisi` → `disimpanOleh` (`Pengguna[]`) | **Referencing** | Relasi many-to-many antara mahasiswa dan kompetisi; menghindari duplikasi data profil pengguna. |
| `kecocokan` → `pengirim`, `penerima`, `tim`, `rekrutmen` | **Referencing** | Menghubungkan dua akun mahasiswa dan konteks tim/lowongan secara terpisah. |
| `notifikasi` → `penerima` & `idReferensi` (`refPath`) | **Referencing (Polimorfik)** | Satu pengguna memiliki banyak notifikasi yang merujuk ke berbagai entitas (`Kecocokan`, `Rekrutmen`, `Kompetisi`, `Tim`). |
| `pesan` → `pengirim`, `penerima` / `idTim` | **Referencing** | Jumlah pesan terus bertambah tanpa batas; disimpan di koleksi tersendiri agar dokumen `pengguna`/`tim` tidak membengkak. |

---

## 4. Autentikasi JWT & Cara Mendapatkan Token

- **Register Mahasiswa**: `POST /api/auth/register` — kata sandi minimal 8 karakter & maksimal 72 byte (di-hash `bcryptjs`), peran selalu ditetapkan server sebagai `mahasiswa` (mengabaikan field `peran` pada body).
- **Login**: `POST /api/auth/login` — mengembalikan `data.token` (JWT bertanda tangan `JWT_SECRET` dengan `expiresIn` dari `JWT_EXPIRES_IN`).
- **Profil Aktif**: `GET /api/auth/me` — sertakan header `Authorization: Bearer <token>`.

---

## 5. Matriks Hak Akses (Role-Based Access Control)

| Fitur / Endpoint | Publik (Tanpa Token) | `mahasiswa` (JWT) | `admin` (JWT) |
| :--- | :---: | :---: | :---: |
| `GET /`, `GET /api`, `GET /api/health` | ✅ | ✅ | ✅ |
| `POST /api/auth/register`, `POST /api/auth/login` | ✅ | ✅ | ✅ |
| `GET /api/auth/me` | ❌ `401` | ✅ | ✅ |
| `GET /api/pengguna/:id` | ✅ | ✅ | ✅ |
| `PUT /api/pengguna/profil`, `POST /api/pengguna/:id/dukung` | ❌ `401` | ✅ | ✅ |
| `GET /api/pengguna`, `PATCH /api/pengguna/:id/peran` | ❌ `401` | ❌ `403` | ✅ |
| `GET /api/admin/statistik` | ❌ `401` | ❌ `403` | ✅ |
| `GET /api/talenta` | ❌ `401` | ✅ | ✅ |
| `GET /api/kompetisi`, `GET /api/kompetisi/:id` | ✅ | ✅ | ✅ |
| `POST /api/kompetisi/:id/simpan` | ❌ `401` | ✅ | ✅ |
| `POST / PUT / DELETE /api/kompetisi` | ❌ `401` | ❌ `403` | ✅ |
| `GET /api/rekrutmen`, `GET /api/rekrutmen/:id` | ✅ | ✅ | ✅ |
| `POST /api/rekrutmen`, `POST /api/rekrutmen/:id/lamar` | ❌ `401` | ✅ | ✅ |
| `PATCH /api/rekrutmen/:id/pelamar/:idPelamar` | ❌ `401` | ✅ *(Ketua)* | ✅ *(Ketua)* |
| `POST /api/kecocokan/undang`, `GET /api/kecocokan`, `PATCH /api/kecocokan/:id/respon` | ❌ `401` | ✅ *(Ketua/Penerima)* | ✅ |
| `GET /api/tim/tim-saya`, `GET /api/tim/:id`, `POST/PATCH /api/tim/:id/tugas` | ❌ `401` | ✅ *(Anggota Tim)* | ✅ |
| `GET /api/notifikasi`, `PATCH /api/notifikasi/:id/baca`, `PATCH /api/notifikasi/baca-semua` | ❌ `401` | ✅ *(Milik Sendiri)* | ✅ |
| `POST /api/pesan`, `GET /api/pesan/:idTarget` | ❌ `401` | ✅ *(Pribadi / Anggota Tim)* | ✅ |

---

## 6. Query Lanjutan (`filtering`, `urutkan/sort`, `kolom/fields`, `halaman/page`, `batas/limit`)

Endpoint daftar (`/api/kompetisi`, `/api/rekrutmen`, `/api/talenta`, `/api/pengguna`, `/api/notifikasi`) mendukung:
- **Pagination**: `?halaman=1&batas=10` (atau alias `?page=1&limit=10`, batas maks 50) dengan format `{ data, halaman, batas, total, totalHalaman }`.
- **Sorting (Whitelist)**: `?urutkan=-createdAt` atau `?sort=batasPendaftaran`. Nilai di luar whitelist mengembalikan `400 Bad Request`.
- **Projection (Whitelist)**: `?kolom=nama,kategori,batasPendaftaran` (atau `?fields=...`). Nilai di luar whitelist mengembalikan `400 Bad Request`.

---

## 7. Pengujian Otomatis (Postman Collection)

Impor kedua file berikut ke Postman:
- `postman/TEAMUP_Collection.postman_collection.json`
- `postman/TEAMUP_Local.postman_environment.json`

Pastikan server berjalan (`npm run dev`) dan akun admin sudah dibuat (`npm run create-admin` atau `npm run seed`), lalu jalankan seluruh folder melalui **Collection Runner**.
