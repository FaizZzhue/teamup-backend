const mongoose = require('mongoose');
const Pengguna = require('../Models/Pengguna');
const { errorHttp } = require('../Middlewares/errorHandler');

const PERAN_VALID = ['mahasiswa', 'admin'];
const URUTAN_PENGGUNA_DIIZINKAN = ['createdAt', 'namaLengkap', 'universitas', 'jumlahDukungan', 'peran'];
const KOLOM_PENGGUNA_DIIZINKAN = ['namaLengkap', 'email', 'peran', 'universitas', 'fakultas', 'jurusan', 'bio', 'spesialisasi', 'keahlian', 'portofolio', 'riwayatKompetisi', 'jumlahDukungan', 'tersedia', 'createdAt', 'updatedAt'];

function amankanRegex(nilai) {
    return String(nilai).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Mem-parsing ?urutkan= / ?sort= berdasarkan daftar putih; field di luar daftar putih dibalas 400
function parseUrutan(paramUrutan, kolomDiizinkan, bawaan = { createdAt: -1 }) {
    if (!paramUrutan || typeof paramUrutan !== 'string' || !paramUrutan.trim()) return bawaan;

    const hasil = {};
    const bagian = paramUrutan.split(',').map((p) => p.trim()).filter(Boolean);
    if (bagian.length === 0) return bawaan;

    for (const item of bagian) {
        const arah = item.startsWith('-') ? -1 : 1;
        const kolom = item.startsWith('-') || item.startsWith('+') ? item.slice(1) : item;
        if (!kolomDiizinkan.includes(kolom)) {
            throw errorHttp(400, `Kolom pengurutan '${kolom}' tidak diizinkan. Gunakan: ${kolomDiizinkan.join(', ')}`);
        }
        hasil[kolom] = arah;
    }
    return hasil;
}

// Mem-parsing ?kolom= / ?fields= (projection) berdasarkan daftar putih
function parseKolom(paramKolom, kolomDiizinkan) {
    if (!paramKolom || typeof paramKolom !== 'string' || !paramKolom.trim()) return null;

    const diminta = paramKolom.split(',').map((f) => f.trim()).filter(Boolean);
    if (diminta.length === 0) return null;

    const valid = [];
    for (const kolom of diminta) {
        if (!kolomDiizinkan.includes(kolom)) {
            throw errorHttp(400, `Kolom proyeksi '${kolom}' tidak diizinkan. Gunakan: ${kolomDiizinkan.join(', ')}`);
        }
        valid.push(kolom);
    }
    return valid.join(' ');
}

function pilihKolom(objek, daftarKolom) {
    if (!daftarKolom || daftarKolom.length === 0) return objek;
    const hasil = { _id: objek._id };
    for (const nama of daftarKolom) {
        if (objek[nama] !== undefined) hasil[nama] = objek[nama];
    }
    return hasil;
}

// Menghitung persentase kelengkapan profil mahasiswa (0 - 100%)
function hitungKekuatanProfil(pengguna) {
    let skor = 0;
    const fieldBelumLengkap = [];

    if (pengguna.namaLengkap && pengguna.email && pengguna.universitas) skor += 20;
    else fieldBelumLengkap.push('identitas dasar');

    if (pengguna.fakultas && pengguna.fakultas.trim().length > 0) skor += 8;
    else fieldBelumLengkap.push('fakultas');

    if (pengguna.jurusan && pengguna.jurusan.trim().length > 0) skor += 7;
    else fieldBelumLengkap.push('jurusan');

    if (pengguna.bio && pengguna.bio.trim().length >= 10) skor += 15;
    else fieldBelumLengkap.push('bio');

    if (pengguna.spesialisasi && pengguna.spesialisasi.trim().length > 0) skor += 10;
    else fieldBelumLengkap.push('spesialisasi');

    const jumlahKeahlian = Array.isArray(pengguna.keahlian) ? pengguna.keahlian.filter(Boolean).length : 0;
    if (jumlahKeahlian >= 3) skor += 15;
    else if (jumlahKeahlian >= 1) {
        skor += 10;
        fieldBelumLengkap.push('keahlian (tambahkan minimal 3 keahlian)');
    } else fieldBelumLengkap.push('keahlian');

    if (Array.isArray(pengguna.portofolio) && pengguna.portofolio.length >= 1) skor += 15;
    else fieldBelumLengkap.push('portofolio');

    if (Array.isArray(pengguna.riwayatKompetisi) && pengguna.riwayatKompetisi.length >= 1) skor += 10;
    else fieldBelumLengkap.push('riwayatKompetisi');

    return { kekuatanProfil: Math.min(100, skor), fieldBelumLengkap };
}

// Memetakan galat Mongoose (ValidationError, CastError, unique 11000) ke errorHttp
function formatGalatMongoose(err) {
    if (err.name === 'ValidationError') {
        const daftarPesan = Object.values(err.errors).map((item) => item.message);
        return errorHttp(400, daftarPesan.join('; '));
    }
    if (err.name === 'CastError') return errorHttp(400, `Format nilai untuk kolom '${err.path}' tidak valid`);
    if (err.code === 11000) {
        const kolom = Object.keys(err.keyPattern || {})[0] || 'data';
        return errorHttp(409, `${kolom} sudah terdaftar`);
    }
    return err;
}

function bersihkanKeahlian(daftar) {
    const tercatat = new Set();
    const bersih = [];
    for (const mentah of daftar) {
        if (typeof mentah !== 'string') continue;
        const rapi = mentah.trim();
        if (!rapi) continue;
        const kunci = rapi.toLowerCase();
        if (!tercatat.has(kunci)) {
            tercatat.add(kunci);
            bersih.push(rapi);
        }
    }
    return bersih;
}

// GET /api/pengguna (admin): daftar semua pengguna tanpa hash kata sandi
async function ambilSemuaPengguna(req, res, next) {
    try {
        const { peran, universitas, cari, urutkan, sort, kolom, fields, halaman, page, batas, limit } = req.query;

        // 1. Filtering
        const filter = {};
        if (peran && peran.trim() !== '') {
            if (!PERAN_VALID.includes(peran.trim())) return next(errorHttp(400, `peran hanya boleh: ${PERAN_VALID.join(', ')}`));
            filter.peran = peran.trim();
        }
        if (universitas && universitas.trim() !== '') filter.universitas = { $regex: amankanRegex(universitas.trim()), $options: 'i' };
        if (cari && cari.trim() !== '') {
            const regex = new RegExp(amankanRegex(cari.trim()), 'i');
            filter.$or = [{ namaLengkap: regex }, { email: regex }, { universitas: regex }];
        }

        // 2. Pagination dengan batas maksimum
        const nomorHalaman = Math.max(1, parseInt(halaman || page || '1', 10) || 1);
        const jumlahBatas = Math.min(50, Math.max(1, parseInt(batas || limit || '10', 10) || 10));

        // 3. Sorting & 4. Projection
        const urutan = parseUrutan(urutkan || sort, URUTAN_PENGGUNA_DIIZINKAN, { createdAt: 1 });
        const proyeksi = parseKolom(kolom || fields, KOLOM_PENGGUNA_DIIZINKAN);

        const total = await Pengguna.countDocuments(filter);
        const totalHalaman = Math.max(1, Math.ceil(total / jumlahBatas));

        let kueri = Pengguna.find(filter).sort(urutan).skip((nomorHalaman - 1) * jumlahBatas).limit(jumlahBatas);
        if (proyeksi) kueri = kueri.select(proyeksi);

        const data = await kueri.lean();
        return res.status(200).json({ sukses: true, pesan: 'Daftar pengguna berhasil diambil', data, halaman: nomorHalaman, batas: jumlahBatas, total, totalHalaman });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// PATCH /api/pengguna/:id/peran (admin): mengubah peran pengguna lain
async function ubahPeranPengguna(req, res, next) {
    try {
        const { id } = req.params;
        const { peran } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id)) return next(errorHttp(400, 'Format ID pengguna tidak valid'));
        if (req.pengguna._id.equals(id)) return next(errorHttp(400, 'Tidak dapat mengubah peran akun sendiri'));
        // Wajib diperiksa: body kosong {} akan menghapus field peran bila langsung dipakai
        if (typeof peran !== 'string' || !PERAN_VALID.includes(peran)) return next(errorHttp(400, `peran hanya boleh: ${PERAN_VALID.join(', ')}`));

        const pengguna = await Pengguna.findById(id);
        if (!pengguna) return next(errorHttp(404, 'Pengguna tidak ditemukan'));

        pengguna.peran = peran;
        await pengguna.save(); // save() menjalankan validasi enum peran

        return res.status(200).json({ sukses: true, pesan: 'Peran pengguna berhasil diperbarui', data: pengguna });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// GET /api/pengguna/:id (publik): detail profil mahasiswa beserta keahlian, portofolio, dan riwayat kompetisi
async function ambilDetailPengguna(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return next(errorHttp(400, 'Format ID pengguna tidak valid'));

        const pengguna = await Pengguna.findById(id)
            .populate('riwayatKompetisi.kompetisi', 'nama penyelenggara kategori batasPendaftaran')
            .lean();
        if (!pengguna) return next(errorHttp(404, 'Profil pengguna tidak ditemukan'));

        const { kekuatanProfil, fieldBelumLengkap } = hitungKekuatanProfil(pengguna);
        return res.status(200).json({ sukses: true, pesan: 'Detail profil mahasiswa berhasil diambil', data: { ...pengguna, kekuatanProfil, fieldBelumLengkap } });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// PUT /api/pengguna/profil (mahasiswa/admin): ubah profil, portofolio, dan hitung kekuatanProfil
async function ubahProfil(req, res, next) {
    try {
        const pengguna = await Pengguna.findById(req.pengguna._id);
        if (!pengguna) return next(errorHttp(404, 'Pengguna tidak ditemukan'));

        const { namaLengkap, universitas, fakultas, jurusan, bio, spesialisasi, keahlian, tersedia, riwayatKompetisi, portofolio, tambahPortofolio, hapusIdPortofolio, daftarHapusPortofolio } = req.body || {};

        if (namaLengkap !== undefined) pengguna.namaLengkap = namaLengkap;
        if (universitas !== undefined) pengguna.universitas = universitas;
        if (fakultas !== undefined) pengguna.fakultas = fakultas;
        if (jurusan !== undefined) pengguna.jurusan = jurusan;
        if (bio !== undefined) pengguna.bio = bio;
        if (spesialisasi !== undefined) pengguna.spesialisasi = spesialisasi;

        if (keahlian !== undefined) {
            if (!Array.isArray(keahlian)) return next(errorHttp(400, 'Field keahlian harus berupa array string'));
            pengguna.keahlian = bersihkanKeahlian(keahlian);
        }
        if (tersedia !== undefined) {
            if (typeof tersedia !== 'boolean') return next(errorHttp(400, 'Field tersedia harus berupa boolean (true/false)'));
            pengguna.tersedia = tersedia;
        }
        if (riwayatKompetisi !== undefined) {
            if (!Array.isArray(riwayatKompetisi)) return next(errorHttp(400, 'Field riwayatKompetisi harus berupa array'));
            pengguna.riwayatKompetisi = riwayatKompetisi;
        }
        if (portofolio !== undefined) {
            if (!Array.isArray(portofolio)) return next(errorHttp(400, 'Field portofolio harus berupa array'));
            pengguna.portofolio = portofolio;
        }
        if (tambahPortofolio !== undefined) {
            const daftarTambah = Array.isArray(tambahPortofolio) ? tambahPortofolio : [tambahPortofolio];
            for (const item of daftarTambah) {
                if (!item || typeof item !== 'object') return next(errorHttp(400, 'Format item pada tambahPortofolio tidak valid'));
                pengguna.portofolio.push(item);
            }
        }

        const idHapus = [];
        if (hapusIdPortofolio) idHapus.push(hapusIdPortofolio);
        if (Array.isArray(daftarHapusPortofolio)) idHapus.push(...daftarHapusPortofolio);

        for (const idItem of idHapus) {
            if (!mongoose.Types.ObjectId.isValid(idItem)) return next(errorHttp(400, `Format ID portofolio '${idItem}' tidak valid`));
            const itemAda = pengguna.portofolio.id(idItem);
            if (!itemAda) return next(errorHttp(404, `Item portofolio dengan ID '${idItem}' tidak ditemukan`));
            itemAda.deleteOne();
        }

        await pengguna.save();

        const hasil = pengguna.toObject();
        const { kekuatanProfil, fieldBelumLengkap } = hitungKekuatanProfil(hasil);
        return res.status(200).json({ sukses: true, pesan: 'Profil berhasil diperbarui', data: { ...hasil, kekuatanProfil, fieldBelumLengkap } });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// POST /api/pengguna/:id/dukung (mahasiswa/admin): tambah dukungan keahlian pada mahasiswa lain
async function dukungPengguna(req, res, next) {
    try {
        const { id } = req.params;
        const { keahlian } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id)) return next(errorHttp(400, 'Format ID pengguna tidak valid'));
        if (req.pengguna._id.equals(id)) return next(errorHttp(400, 'Anda tidak dapat memberikan dukungan ke profil sendiri'));

        const target = await Pengguna.findById(id);
        if (!target) return next(errorHttp(404, 'Profil mahasiswa tidak ditemukan'));

        let keahlianDidukung = null;
        if (keahlian !== undefined && keahlian !== null && String(keahlian).trim() !== '') {
            if (typeof keahlian !== 'string') return next(errorHttp(400, 'Field keahlian harus berupa teks (string)'));
            const cocok = target.keahlian.find((item) => item.toLowerCase() === keahlian.trim().toLowerCase());
            if (!cocok) return next(errorHttp(400, `Keahlian '${keahlian}' tidak ditemukan pada daftar keahlian mahasiswa ini`));
            keahlianDidukung = cocok;
        }

        const diperbarui = await Pengguna.findByIdAndUpdate(id, { $inc: { jumlahDukungan: 1 } }, { new: true });
        return res.status(200).json({
            sukses: true,
            pesan: keahlianDidukung ? `Dukungan untuk keahlian '${keahlianDidukung}' berhasil ditambahkan` : 'Dukungan berhasil ditambahkan',
            data: {
                idPengguna: diperbarui._id,
                namaLengkap: diperbarui.namaLengkap,
                keahlianDidukung,
                jumlahDukungan: diperbarui.jumlahDukungan,
                didukungOleh: { id: req.pengguna._id, namaLengkap: req.pengguna.namaLengkap },
            },
        });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

module.exports = { ambilSemuaPengguna, ubahPeranPengguna, ambilDetailPengguna, ubahProfil, dukungPengguna, hitungKekuatanProfil, formatGalatMongoose, parseUrutan, parseKolom, pilihKolom };
