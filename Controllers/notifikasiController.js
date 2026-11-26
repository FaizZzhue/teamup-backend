const mongoose = require('mongoose');
const Notifikasi = require('../Models/Notifikasi');
const { errorHttp } = require('../Middlewares/errorHandler');
const { formatGalatMongoose, parseUrutan } = require('./penggunaController');

const URUTAN_NOTIFIKASI_DIIZINKAN = ['createdAt', 'tipe', 'sudahDibaca'];

// GET /api/notifikasi (mahasiswa/admin): daftar notifikasi milik pengguna aktif
async function ambilNotifikasi(req, res, next) {
    try {
        const { hanyaBelumDibaca, tipe, urutkan, sort, halaman, page, batas, limit } = req.query;

        // 1. Filtering
        const filter = { penerima: req.pengguna._id };
        if (hanyaBelumDibaca === 'true' || hanyaBelumDibaca === '1') filter.sudahDibaca = false;

        if (tipe && tipe.trim() !== '') {
            const tipeValid = ['undangan_tim', 'status_lamaran', 'tenggat', 'sistem'];
            if (!tipeValid.includes(tipe)) return next(errorHttp(400, `Parameter tipe harus salah satu dari: ${tipeValid.join(', ')}`));
            filter.tipe = tipe;
        }

        // 2. Pagination dengan batas maksimum & 3. Sorting
        const nomorHalaman = Math.max(1, parseInt(halaman || page || '1', 10) || 1);
        const jumlahBatas = Math.min(50, Math.max(1, parseInt(batas || limit || '20', 10) || 20));
        const urutan = parseUrutan(urutkan || sort, URUTAN_NOTIFIKASI_DIIZINKAN, { createdAt: -1 });

        const [total, jumlahBelumDibaca, data] = await Promise.all([
            Notifikasi.countDocuments(filter),
            Notifikasi.countDocuments({ penerima: req.pengguna._id, sudahDibaca: false }),
            Notifikasi.find(filter).sort(urutan).skip((nomorHalaman - 1) * jumlahBatas).limit(jumlahBatas).lean(),
        ]);

        const totalHalaman = Math.max(1, Math.ceil(total / jumlahBatas));
        return res.status(200).json({ sukses: true, pesan: 'Daftar notifikasi berhasil diambil', data, jumlahBelumDibaca, halaman: nomorHalaman, batas: jumlahBatas, total, totalHalaman });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// PATCH /api/notifikasi/:id/baca (mahasiswa/admin): tandai satu notifikasi sudah dibaca
async function tandaiDibaca(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return next(errorHttp(400, 'Format ID notifikasi tidak valid'));

        const notifikasi = await Notifikasi.findOneAndUpdate({ _id: id, penerima: req.pengguna._id }, { sudahDibaca: true }, { new: true });
        if (!notifikasi) return next(errorHttp(404, 'Notifikasi tidak ditemukan'));

        return res.status(200).json({ sukses: true, pesan: 'Notifikasi berhasil ditandai sudah dibaca', data: notifikasi });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// PATCH /api/notifikasi/baca-semua (mahasiswa/admin): tandai seluruh notifikasi milik pengguna sudah dibaca
async function tandaiSemuaDibaca(req, res, next) {
    try {
        const hasil = await Notifikasi.updateMany({ penerima: req.pengguna._id, sudahDibaca: false }, { sudahDibaca: true });
        return res.status(200).json({ sukses: true, pesan: 'Seluruh notifikasi telah ditandai sudah dibaca', data: { jumlahDiubah: hasil.modifiedCount } });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

module.exports = { ambilNotifikasi, tandaiDibaca, tandaiSemuaDibaca };
