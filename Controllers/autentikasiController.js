const jwt = require('jsonwebtoken');
const Pengguna = require('../Models/Pengguna');
const { errorHttp } = require('../Middlewares/errorHandler');
const { hitungKekuatanProfil, formatGalatMongoose } = require('./penggunaController');

const KATA_SANDI_MIN = 8;
const KATA_SANDI_MAKS_BYTE = 72; // batas bcrypt: karakter setelah byte ke-72 diabaikan

function buatToken(pengguna) {
    if (!process.env.JWT_SECRET) throw errorHttp(500, 'JWT_SECRET belum dikonfigurasi pada server');
    return jwt.sign({ id: pengguna._id, email: pengguna.email, peran: pengguna.peran }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
}

function ringkasPengguna(dokumen) {
    const pengguna = typeof dokumen.toObject === 'function' ? dokumen.toObject() : { ...dokumen };
    const { kekuatanProfil } = hitungKekuatanProfil(pengguna);

    return {
        id: pengguna._id,
        namaLengkap: pengguna.namaLengkap,
        email: pengguna.email,
        peran: pengguna.peran,
        universitas: pengguna.universitas,
        fakultas: pengguna.fakultas,
        jurusan: pengguna.jurusan,
        spesialisasi: pengguna.spesialisasi,
        tersedia: pengguna.tersedia,
        kekuatanProfil,
    };
}

function adalahTeksValid(nilai) {
    return typeof nilai === 'string' && nilai.trim().length > 0;
}

// POST /api/auth/register (publik): registrasi mahasiswa baru dan buat token JWT
async function daftar(req, res, next) {
    try {
        const { namaLengkap, email, kataSandi, universitas, fakultas, jurusan, bio, spesialisasi, keahlian } = req.body || {};

        // Harus berupa teks: mencegah objek seperti { "$ne": null } masuk ke kueri
        const fieldWajib = { namaLengkap, email, kataSandi, universitas, fakultas, jurusan };
        for (const [namaField, nilai] of Object.entries(fieldWajib)) {
            if (nilai === undefined || nilai === null) return next(errorHttp(400, `Field '${namaField}' wajib diisi`));
            if (typeof nilai !== 'string') return next(errorHttp(400, `Field '${namaField}' harus berupa teks (string)`));
            if (nilai.trim().length === 0) return next(errorHttp(400, `Field '${namaField}' tidak boleh kosong`));
        }

        if (kataSandi.length < KATA_SANDI_MIN) return next(errorHttp(400, `Kata sandi minimal terdiri dari ${KATA_SANDI_MIN} karakter`));
        if (Buffer.byteLength(kataSandi, 'utf8') > KATA_SANDI_MAKS_BYTE) return next(errorHttp(400, `Kata sandi maksimal ${KATA_SANDI_MAKS_BYTE} byte`));
        if (bio !== undefined && typeof bio !== 'string') return next(errorHttp(400, 'Field bio harus berupa teks (string)'));
        if (spesialisasi !== undefined && typeof spesialisasi !== 'string') return next(errorHttp(400, 'Field spesialisasi harus berupa teks (string)'));
        if (keahlian !== undefined && !Array.isArray(keahlian)) return next(errorHttp(400, 'Field keahlian harus berupa array string'));

        const emailNormal = email.trim().toLowerCase();
        const sudahAda = await Pengguna.findOne({ email: emailNormal });
        if (sudahAda) return next(errorHttp(409, 'Email kampus sudah terdaftar'));

        // peran TIDAK diambil dari req.body: akun hasil register selalu 'mahasiswa'
        const penggunaBaru = await Pengguna.create({
            namaLengkap: namaLengkap.trim(),
            email: emailNormal,
            kataSandi,
            peran: 'mahasiswa',
            universitas: universitas.trim(),
            fakultas: fakultas.trim(),
            jurusan: jurusan.trim(),
            bio: bio ? bio.trim() : '',
            spesialisasi: spesialisasi ? spesialisasi.trim() : '',
            keahlian: Array.isArray(keahlian) ? keahlian.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : [],
        });

        const token = buatToken(penggunaBaru);
        return res.status(201).json({ sukses: true, pesan: 'Registrasi mahasiswa berhasil', data: { token, pengguna: ringkasPengguna(penggunaBaru) } });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// POST /api/auth/login (publik): autentikasi email kampus & kata sandi, kembalikan token JWT
async function masuk(req, res, next) {
    try {
        const { email, kataSandi } = req.body || {};

        // Harus berupa teks: mencegah objek seperti { "$ne": null } masuk ke kueri
        if (!adalahTeksValid(email) || !adalahTeksValid(kataSandi)) {
            return next(errorHttp(400, 'Email kampus dan kata sandi wajib diisi dan harus berupa teks (string)'));
        }

        const emailNormal = email.trim().toLowerCase();
        const pengguna = await Pengguna.findOne({ email: emailNormal }).select('+kataSandi');
        const cocok = pengguna ? await pengguna.cocokkanKataSandi(kataSandi) : false;
        // Pesan sama untuk "email tidak ada" dan "kata sandi salah"
        if (!cocok) return next(errorHttp(401, 'Email atau kata sandi tidak valid'));

        const token = buatToken(pengguna);
        return res.status(200).json({ sukses: true, pesan: 'Login berhasil', data: { token, pengguna: ringkasPengguna(pengguna) } });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// GET /api/auth/me (mahasiswa/admin): mengambil data profil pengguna yang sedang login
async function profilSaya(req, res, next) {
    try {
        const pengguna = await Pengguna.findById(req.pengguna._id)
            .populate('riwayatKompetisi.kompetisi', 'nama penyelenggara kategori batasPendaftaran')
            .lean();
        if (!pengguna) return next(errorHttp(404, 'Pengguna tidak ditemukan'));

        const { kekuatanProfil, fieldBelumLengkap } = hitungKekuatanProfil(pengguna);
        return res.status(200).json({ sukses: true, pesan: 'Profil pengguna aktif berhasil diambil', data: { ...pengguna, kekuatanProfil, fieldBelumLengkap } });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

module.exports = { daftar, masuk, profilSaya };
