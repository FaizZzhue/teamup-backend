const mongoose = require('mongoose');
const Tim = require('../Models/Tim');
const { errorHttp } = require('../Middlewares/errorHandler');
const { formatGalatMongoose } = require('./penggunaController');

// Memeriksa apakah pengguna adalah ketua atau anggota aktif pada tim
function adalahAnggotaTim(tim, idPengguna) {
    if (tim.ketua && String(tim.ketua._id || tim.ketua) === String(idPengguna)) return true;
    return Array.isArray(tim.anggota) && tim.anggota.some((a) => a.status === 'aktif' && a.pengguna && String(a.pengguna._id || a.pengguna) === String(idPengguna));
}

// GET /api/tim/tim-saya (mahasiswa/admin): daftar tim tempat pengguna menjadi ketua atau anggota aktif
async function ambilTimSaya(req, res, next) {
    try {
        const daftarTim = await Tim.find({
            $or: [
                { ketua: req.pengguna._id },
                { anggota: { $elemMatch: { pengguna: req.pengguna._id, status: 'aktif' } } },
            ],
        })
            .sort({ updatedAt: -1 })
            .populate('ketua', 'namaLengkap email universitas jurusan')
            .populate('kompetisi', 'nama penyelenggara kategori batasPendaftaran')
            .populate('anggota.pengguna', 'namaLengkap universitas jurusan spesialisasi keahlian')
            .lean();

        return res.status(200).json({ sukses: true, pesan: 'Daftar tim saya berhasil diambil', data: daftarTim });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// GET /api/tim/:id (anggota tim/admin): detail ruang kerja tim beserta anggota dan tugas
async function ambilDetailTim(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return next(errorHttp(400, 'Format ID tim tidak valid'));

        const tim = await Tim.findById(id)
            .populate('ketua', 'namaLengkap email universitas jurusan spesialisasi')
            .populate('kompetisi', 'nama penyelenggara kategori totalHadiah batasPendaftaran')
            .populate('anggota.pengguna', 'namaLengkap email universitas jurusan spesialisasi keahlian')
            .populate('tugas.ditugaskanKe', 'namaLengkap email universitas')
            .lean();
        if (!tim) return next(errorHttp(404, 'Tim tidak ditemukan'));
        if (!adalahAnggotaTim(tim, req.pengguna._id) && req.pengguna.peran !== 'admin') return next(errorHttp(403, 'Anda tidak memiliki akses ke ruang kerja tim ini'));

        return res.status(200).json({ sukses: true, pesan: 'Detail ruang kerja tim berhasil diambil', data: tim });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// POST /api/tim/:id/tugas (anggota tim): tambah tugas baru di ruang kerja tim
async function tambahTugasTim(req, res, next) {
    try {
        const { id } = req.params;
        const { judul, deskripsi, ditugaskanKe, status, tenggat } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id)) return next(errorHttp(400, 'Format ID tim tidak valid'));
        if (!judul || String(judul).trim() === '') return next(errorHttp(400, 'Judul tugas wajib diisi'));

        const tim = await Tim.findById(id);
        if (!tim) return next(errorHttp(404, 'Tim tidak ditemukan'));
        if (!adalahAnggotaTim(tim, req.pengguna._id)) return next(errorHttp(403, 'Hanya anggota aktif tim yang dapat menambahkan tugas'));

        if (ditugaskanKe) {
            if (!mongoose.Types.ObjectId.isValid(ditugaskanKe)) return next(errorHttp(400, 'Format ID ditugaskanKe tidak valid'));
            if (!adalahAnggotaTim(tim, ditugaskanKe)) return next(errorHttp(400, 'Pengguna pada ditugaskanKe bukan anggota aktif tim ini'));
        }

        tim.tugas.push({
            judul: String(judul).trim(),
            deskripsi: deskripsi ? String(deskripsi).trim() : '',
            ditugaskanKe: ditugaskanKe || null,
            status: status || 'belum',
            tenggat: tenggat || null,
        });

        await tim.save();
        await tim.populate('tugas.ditugaskanKe', 'namaLengkap email universitas');

        return res.status(201).json({ sukses: true, pesan: 'Tugas tim berhasil ditambahkan', data: tim.tugas[tim.tugas.length - 1] });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// PATCH /api/tim/:id/tugas/:idTugas (anggota tim): ubah detail atau status tugas
async function ubahTugasTim(req, res, next) {
    try {
        const { id, idTugas } = req.params;
        const { judul, deskripsi, ditugaskanKe, status, tenggat } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(idTugas)) {
            return next(errorHttp(400, 'Format ID tim atau ID tugas tidak valid'));
        }

        const tim = await Tim.findById(id);
        if (!tim) return next(errorHttp(404, 'Tim tidak ditemukan'));
        if (!adalahAnggotaTim(tim, req.pengguna._id)) return next(errorHttp(403, 'Hanya anggota aktif tim yang dapat mengubah tugas'));

        const tugas = tim.tugas.id(idTugas);
        if (!tugas) return next(errorHttp(404, 'Tugas tidak ditemukan pada tim ini'));

        if (ditugaskanKe !== undefined && ditugaskanKe !== null && ditugaskanKe !== '') {
            if (!mongoose.Types.ObjectId.isValid(ditugaskanKe)) return next(errorHttp(400, 'Format ID ditugaskanKe tidak valid'));
            if (!adalahAnggotaTim(tim, ditugaskanKe)) return next(errorHttp(400, 'Pengguna pada ditugaskanKe bukan anggota aktif tim ini'));
            tugas.ditugaskanKe = ditugaskanKe;
        } else if (ditugaskanKe === null || ditugaskanKe === '') {
            tugas.ditugaskanKe = null;
        }

        if (judul !== undefined) tugas.judul = String(judul).trim();
        if (deskripsi !== undefined) tugas.deskripsi = String(deskripsi).trim();
        if (status !== undefined) tugas.status = status;
        if (tenggat !== undefined) tugas.tenggat = tenggat;

        await tim.save();
        await tim.populate('tugas.ditugaskanKe', 'namaLengkap email universitas');

        return res.status(200).json({ sukses: true, pesan: 'Tugas tim berhasil diperbarui', data: tim.tugas.id(idTugas) });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

module.exports = { ambilTimSaya, ambilDetailTim, tambahTugasTim, ubahTugasTim, adalahAnggotaTim };
