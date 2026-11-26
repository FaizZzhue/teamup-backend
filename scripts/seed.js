// Mengisi data contoh awal ke MongoDB (26 pengguna, 12 kompetisi, 6 tim & rekrutmen, 4 kecocokan, 5 notifikasi, 4 pesan).
// Pakai: npm run seed
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const Pengguna = require('../Models/Pengguna');
const Kompetisi = require('../Models/Kompetisi');
const Tim = require('../Models/Tim');
const Rekrutmen = require('../Models/Rekrutmen');
const Kecocokan = require('../Models/Kecocokan');
const Notifikasi = require('../Models/Notifikasi');
const Pesan = require('../Models/Pesan');

const DAFTAR_UNIVERSITAS = ['Universitas MDP', 'Universitas Indonesia', 'Institut Teknologi Bandung', 'Universitas Gadjah Mada', 'Universitas Sriwijaya'];
const DAFTAR_KEAHLIAN = [
    ['Node.js', 'Express.js', 'MongoDB', 'React', 'Docker'],
    ['React', 'Tailwind CSS', 'TypeScript', 'Figma', 'Next.js'],
    ['Python', 'PyTorch', 'TensorFlow', 'Data Science', 'SQL'],
    ['Figma', 'Desain UI/UX', 'Prototyping', 'Riset Pengguna', 'Webflow'],
    ['Flutter', 'Dart', 'Firebase', 'REST API', 'Git'],
    ['Strategi Bisnis', 'Pitch Deck', 'Pemodelan Keuangan', 'Riset Pasar'],
    ['Java', 'Spring Boot', 'PostgreSQL', 'Microservices', 'Redis'],
    ['Go', 'Kubernetes', 'gRPC', 'Arsitektur Cloud', 'CI/CD'],
];
const DAFTAR_SPESIALISASI = ['Pengembang Backend', 'Pengembang Frontend', 'Insinyur AI & Data', 'Desainer UI/UX', 'Pengembang Mobile', 'Analis Bisnis', 'Pengembang Fullstack', 'Insinyur DevOps & Cloud'];
const DAFTAR_KATEGORI = ['Hackathon', 'UI/UX', 'AI & Sains Data', 'Rencana Bisnis', 'Pengembangan Web'];

async function isiDataAwal() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('MONGODB_URI belum diatur pada file .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUri);
        console.log('Terhubung ke MongoDB. Membersihkan koleksi lama...');

        await Promise.all([
            Pengguna.deleteMany({}),
            Kompetisi.deleteMany({}),
            Tim.deleteMany({}),
            Rekrutmen.deleteMany({}),
            Kecocokan.deleteMany({}),
            Notifikasi.deleteMany({}),
            Pesan.deleteMany({}),
        ]);

        const admin = await Pengguna.create({
            namaLengkap: 'Admin TEAMUP',
            email: 'admin@teamup.ac.id',
            kataSandi: 'AdminTeamup123!',
            peran: 'admin',
            universitas: 'Universitas MDP',
            fakultas: 'Fakultas Ilmu Komputer dan Rekayasa',
            jurusan: 'Sistem Informasi',
            bio: 'Administrator kurasi kompetisi dan moderasi platform TEAMUP.',
            spesialisasi: 'Administrator Platform',
            tersedia: false,
        });

        const namaMahasiswa = [
            'Achmad Faiz Yudha Ramadhan', 'Rayhan Primal', 'Rizky Apryandi Triadmojo', 'M Rezki Riopaldy', 'Siti Chairunnisah Suyta',
            'Budi Santoso', 'Alya Putri Maharani', 'Dimas Pratama', 'Nadia Kusuma', 'Fajar Hidayat',
            'Rina Oktaviani', 'Kevin Wijaya', 'Tari Wulandari', 'Hendra Gunawan', 'Citra Lestari',
            'Bagas Saputra', 'Dewi Anggraini', 'Ilham Ramadhan', 'Putri Salsabila', 'Rafi Mahendra',
            'Intan Permata', 'Yoga Prasetyo', 'Laila Rahmawati', 'Andika Nugraha', 'Zahra Aulia',
        ];

        const daftarMahasiswa = [];
        for (let i = 0; i < namaMahasiswa.length; i++) {
            const nama = namaMahasiswa[i];
            const slug = nama.toLowerCase().replace(/[^a-z0-9]+/g, '.');
            const keahlian = DAFTAR_KEAHLIAN[i % DAFTAR_KEAHLIAN.length];
            const spesialisasi = DAFTAR_SPESIALISASI[i % DAFTAR_SPESIALISASI.length];
            const universitas = DAFTAR_UNIVERSITAS[i % DAFTAR_UNIVERSITAS.length];
            const kategori = DAFTAR_KATEGORI[i % DAFTAR_KATEGORI.length];

            const mhs = await Pengguna.create({
                namaLengkap: nama,
                email: `${slug}@mhs.mdp.ac.id`,
                kataSandi: 'Password123!',
                peran: 'mahasiswa',
                universitas,
                fakultas: 'Fakultas Ilmu Komputer dan Rekayasa',
                jurusan: i % 2 === 0 ? 'Sistem Informasi' : 'Informatika',
                bio: `Mahasiswa ${universitas} yang fokus pada ${spesialisasi} dan aktif mengikuti kompetisi nasional.`,
                spesialisasi,
                keahlian,
                portofolio: [{ judul: `Proyek ${spesialisasi} #${i + 1}`, deskripsi: `Implementasi solusi digital pada kategori ${kategori}.`, kategori, tautan: `https://github.com/teamup-demo/proyek-${i + 1}` }],
                jumlahDukungan: (i * 3) % 25,
                tersedia: i % 5 !== 4,
            });
            daftarMahasiswa.push(mhs);
        }

        const templateKompetisi = [
            ['GEMASTIK 2026 - Pengembangan Perangkat Lunak', 'Kemendikbudristek', 'Pengembangan Web', 'Rp 50.000.000', 15],
            ['COMPFEST 18 Hackathon', 'BEM Fasilkom UI', 'Hackathon', 'Rp 40.000.000', 22],
            ['Arkavidia AI & Data Challenge', 'HMIF ITB', 'AI & Sains Data', 'Rp 30.000.000', 28],
            ['FIND IT! UGM UI/UX Competition', 'KMTETI UGM', 'UI/UX', 'Rp 20.000.000', 35],
            ['MDP Startup Business Plan 2026', 'Universitas MDP', 'Rencana Bisnis', 'Rp 15.000.000', 10],
            ['Garuda Hacks 2026', 'Garuda Hacks', 'Hackathon', 'Rp 60.000.000', 40],
            ['HOLOGY Brawijaya Software Dev', 'FILKOM UB', 'Pengembangan Web', 'Rp 25.000.000', 18],
            ['JOINTS UGM Data Mining', 'Himakom UGM', 'AI & Sains Data', 'Rp 22.000.000', 45],
            ['ICN UI/UX Design Sprint', 'Universitas Sriwijaya', 'UI/UX', 'Rp 12.000.000', 12],
            ['National Fintech Case Challenge', 'OJK & Kampus Merdeka', 'Rencana Bisnis', 'Rp 35.000.000', 50],
            ['Smart Campus IoT & Web Hackathon', 'APJII', 'Hackathon', 'Rp 45.000.000', 30],
            ['Open Source Campus Challenge 2025', 'Komunitas Developer ID', 'Pengembangan Web', 'Rp 10.000.000', 60],
        ];

        const sekarang = Date.now();
        const daftarKompetisi = [];
        for (let i = 0; i < templateKompetisi.length; i++) {
            const [nama, penyelenggara, kategori, totalHadiah, hariKedepan] = templateKompetisi[i];
            const comp = await Kompetisi.create({
                nama,
                penyelenggara,
                deskripsi: `${nama} adalah kompetisi mahasiswa tingkat nasional di bidang ${kategori} yang diselenggarakan oleh ${penyelenggara}.`,
                kategori,
                totalHadiah,
                tanggalMulaiDaftar: new Date(sekarang - 5 * 86400000),
                batasPendaftaran: new Date(sekarang + hariKedepan * 86400000),
                ukuranTim: { minimal: 2, maksimal: 4 },
                status: i === templateKompetisi.length - 1 ? 'arsip' : 'aktif',
                disimpanOleh: [daftarMahasiswa[0]._id, daftarMahasiswa[1]._id],
                dibuatOleh: admin._id,
            });
            daftarKompetisi.push(comp);
        }

        daftarMahasiswa[0].riwayatKompetisi.push({ kompetisi: daftarKompetisi[0]._id, namaKompetisi: daftarKompetisi[0].nama, pencapaian: 'Finalis', peran: 'Pengembang Backend', tahun: 2025 });
        await daftarMahasiswa[0].save();

        const daftarTim = [];
        const daftarRekrutmen = [];
        const daftarKomitmen = ['Sprint Hackathon', 'Tinggi', 'Sedang', 'Tinggi', 'Rendah', 'Sedang'];

        for (let i = 0; i < 6; i++) {
            const ketua = daftarMahasiswa[i];
            const rekan = daftarMahasiswa[i + 6];
            const comp = daftarKompetisi[i];

            const tim = await Tim.create({
                nama: `Tim TEAMUP ${i + 1}`,
                deskripsi: `Tim kolaborasi mahasiswa untuk mengikuti ${comp.nama}.`,
                ketua: ketua._id,
                kompetisi: comp._id,
                anggota: [
                    { pengguna: ketua._id, peran: ketua.spesialisasi, status: 'aktif' },
                    { pengguna: rekan._id, peran: rekan.spesialisasi, status: 'aktif' },
                ],
                tugas: [
                    { judul: 'Riset kebutuhan & arsitektur sistem', deskripsi: 'Susun dokumen kebutuhan dan rancangan API.', ditugaskanKe: ketua._id, status: 'selesai', tenggat: new Date(sekarang + 3 * 86400000) },
                    { judul: 'Implementasi MVP & integrasi antarmuka', deskripsi: 'Hubungkan halaman React dengan REST API Express.', ditugaskanKe: rekan._id, status: 'dikerjakan', tenggat: new Date(sekarang + 7 * 86400000) },
                ],
            });
            daftarTim.push(tim);

            const rek = await Rekrutmen.create({
                judul: `Buka Rekrutmen ${tim.nama} — ${comp.nama}`,
                deskripsi: `Kami mencari rekan tim berdedikasi untuk ${comp.nama}.`,
                ketua: ketua._id,
                tim: tim._id,
                kompetisi: comp._id,
                peranDibutuhkan: [
                    { namaPeran: 'Pengembang Frontend', keahlianDibutuhkan: ['React', 'Tailwind CSS'], kuota: 2, terisi: 0 },
                    { namaPeran: 'Desainer UI/UX', keahlianDibutuhkan: ['Figma', 'Prototyping'], kuota: 1, terisi: 0 },
                ],
                komitmen: daftarKomitmen[i],
                status: 'terbuka',
                pelamar: [{ pengguna: daftarMahasiswa[i + 12]._id, peranDilamar: 'Pengembang Frontend', pesanMotivasi: 'Saya berpengalaman membangun aplikasi React dan siap berkontribusi penuh.', tautanPortofolio: 'https://github.com/teamup-demo/portofolio-fe', status: 'menunggu' }],
            });
            daftarRekrutmen.push(rek);
        }

        const kecocokan1 = await Kecocokan.create({ pengirim: daftarMahasiswa[0]._id, penerima: daftarMahasiswa[1]._id, tim: daftarTim[0]._id, rekrutmen: daftarRekrutmen[0]._id, skorKecocokan: 88, pesan: 'Hai Rayhan, keahlian React kamu cocok banget buat Tim TEAMUP 1!', status: 'menunggu' });
        await Kecocokan.create([
            { pengirim: daftarMahasiswa[0]._id, penerima: daftarMahasiswa[2]._id, tim: daftarTim[0]._id, skorKecocokan: 82, pesan: 'Yuk gabung jadi Desainer UI/UX di tim GEMASTIK kami.', status: 'diterima' },
            { pengirim: daftarMahasiswa[1]._id, penerima: daftarMahasiswa[3]._id, tim: daftarTim[1]._id, skorKecocokan: 76, pesan: 'Tertarik ikut COMPFEST Hackathon bareng kami?', status: 'menunggu' },
            { pengirim: daftarMahasiswa[2]._id, penerima: daftarMahasiswa[4]._id, tim: daftarTim[2]._id, skorKecocokan: 91, pesan: 'Kami butuh QA & Dokumentasi untuk Arkavidia!', status: 'ditolak' },
        ]);

        await Notifikasi.create([
            { penerima: daftarMahasiswa[1]._id, tipe: 'undangan_tim', judul: 'Undangan Bergabung Tim', pesan: `${daftarMahasiswa[0].namaLengkap} mengundang kamu bergabung ke "${daftarTim[0].nama}" (88% kecocokan).`, idReferensi: kecocokan1._id, modelReferensi: 'Kecocokan', sudahDibaca: false },
            { penerima: daftarMahasiswa[0]._id, tipe: 'status_lamaran', judul: 'Lamaran Baru Masuk', pesan: `${daftarMahasiswa[12].namaLengkap} melamar sebagai Pengembang Frontend pada "${daftarRekrutmen[0].judul}".`, idReferensi: daftarRekrutmen[0]._id, modelReferensi: 'Rekrutmen', sudahDibaca: false },
            { penerima: daftarMahasiswa[0]._id, tipe: 'tenggat', judul: 'Pengingat Batas Pendaftaran', pesan: `Pendaftaran "${daftarKompetisi[0].nama}" segera ditutup.`, idReferensi: daftarKompetisi[0]._id, modelReferensi: 'Kompetisi', sudahDibaca: false },
            { penerima: daftarMahasiswa[1]._id, tipe: 'sistem', judul: 'Selamat Datang di TEAMUP', pesan: 'Lengkapi profil dan portofolio kamu untuk meningkatkan skor kecocokan!', sudahDibaca: true },
            { penerima: daftarMahasiswa[2]._id, tipe: 'undangan_tim', judul: 'Undangan Tim Diterima', pesan: 'Kamu telah bergabung ke Tim TEAMUP 1.', idReferensi: daftarTim[0]._id, modelReferensi: 'Tim', sudahDibaca: true },
        ]);

        await Pesan.create([
            { pengirim: daftarMahasiswa[0]._id, penerima: daftarMahasiswa[1]._id, isi: 'Halo Rayhan, boleh diskusi sebentar soal ide GEMASTIK?', sudahDibaca: true, dibacaOleh: [daftarMahasiswa[0]._id, daftarMahasiswa[1]._id] },
            { pengirim: daftarMahasiswa[1]._id, penerima: daftarMahasiswa[0]._id, isi: 'Halo Faiz! Boleh banget, malam ini jam 20.00 WIB ya.', sudahDibaca: false, dibacaOleh: [daftarMahasiswa[1]._id] },
            { pengirim: daftarMahasiswa[0]._id, idTim: daftarTim[0]._id, isi: 'Selamat datang di ruang kerja Tim TEAMUP 1!', sudahDibaca: false, dibacaOleh: [daftarMahasiswa[0]._id] },
            { pengirim: daftarMahasiswa[6]._id, idTim: daftarTim[0]._id, isi: 'Siap ketua! Saya mulai kerjakan integrasi endpoint sekarang.', sudahDibaca: false, dibacaOleh: [daftarMahasiswa[6]._id] },
        ]);

        console.log('Data awal berhasil diisi ke MongoDB!');
        console.log(`pengguna: ${daftarMahasiswa.length + 1} | kompetisi: ${daftarKompetisi.length} | tim: ${daftarTim.length} | rekrutmen: ${daftarRekrutmen.length} | kecocokan: 4 | notifikasi: 5 | pesan: 4`);
        console.log(`Akun cepat -> Admin: admin@teamup.ac.id / AdminTeamup123! | Mahasiswa: ${daftarMahasiswa[0].email} / Password123!`);
    } catch (err) {
        console.error('Gagal mengisi data awal:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

isiDataAwal();
