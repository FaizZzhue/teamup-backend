const mongoose = require('mongoose');
const Kompetisi = require('../Models/Kompetisi');
const { errorHttp } = require('../Middlewares/errorHandler');
const { formatGalatMongoose, parseUrutan, parseKolom } = require('./penggunaController');

const URUTAN_KOMPETISI_DIIZINKAN = ['batasPendaftaran', 'tanggalMulaiDaftar', 'nama', 'kategori', 'status', 'createdAt'];
const KOLOM_KOMPETISI_DIIZINKAN = ['nama', 'penyelenggara', 'deskripsi', 'kategori', 'totalHadiah', 'tanggalMulaiDaftar', 'batasPendaftaran', 'ukuranTim', 'status', 'disimpanOleh', 'dibuatOleh', 'createdAt', 'updatedAt'];

function amankanRegex(nilai) {
    return String(nilai).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatKompetisi(item, idPenggunaAktif, pakaiProyeksi) {
    if (pakaiProyeksi) return item;
    const disimpanOleh = Array.isArray(item.disimpanOleh) ? item.disimpanOleh : [];
    const sudahDisimpan = idPenggunaAktif ? disimpanOleh.some((id) => String(id) === String(idPenggunaAktif)) : false;
    return { ...item, jumlahSimpan: disimpanOleh.length, sudahDisimpan };
}

// GET /api/kompetisi (publik): daftar kompetisi/hackathon dengan filter, sort, fields, dan pagination
async function ambilSemuaKompetisi(req, res, next) {
    try {
        const { kategori, cari, status = 'aktif', hanyaDisimpan, urutkan, sort, kolom, fields, halaman, page, batas, limit } = req.query;

        // 1. Filtering
        const filter = {};
        if (status && status !== 'semua') {
            if (!['aktif', 'arsip'].includes(status)) return next(errorHttp(400, "Parameter status harus 'aktif', 'arsip', atau 'semua'"));
            filter.status = status;
        }
        if (kategori && kategori.trim() !== '') filter.kategori = { $regex: amankanRegex(kategori.trim()), $options: 'i' };
        if (cari && cari.trim() !== '') {
            const regex = new RegExp(amankanRegex(cari.trim()), 'i');
            filter.$or = [{ nama: regex }, { penyelenggara: regex }, { deskripsi: regex }, { kategori: regex }];
        }
        if ((hanyaDisimpan === 'true' || hanyaDisimpan === '1') && req.pengguna) filter.disimpanOleh = req.pengguna._id;

        // 2. Pagination dengan batas maksimum
        const nomorHalaman = Math.max(1, parseInt(halaman || page || '1', 10) || 1);
        const jumlahBatas = Math.min(50, Math.max(1, parseInt(batas || limit || '10', 10) || 10));

        // 3. Sorting (bawaan: batas pendaftaran terdekat) & 4. Projection
        const urutan = parseUrutan(urutkan || sort, URUTAN_KOMPETISI_DIIZINKAN, { batasPendaftaran: 1, createdAt: -1 });
        const proyeksi = parseKolom(kolom || fields, KOLOM_KOMPETISI_DIIZINKAN);

        const total = await Kompetisi.countDocuments(filter);
        const totalHalaman = Math.max(1, Math.ceil(total / jumlahBatas));

        let kueri = Kompetisi.find(filter).sort(urutan).skip((nomorHalaman - 1) * jumlahBatas).limit(jumlahBatas);
        // populate() hanya dipanggil bila tidak ada pemilihan kolom agar proyeksi tetap bersih
        kueri = proyeksi ? kueri.select(proyeksi) : kueri.populate('dibuatOleh', 'namaLengkap email universitas');

        const daftar = await kueri.lean();
        const idAktif = req.pengguna ? req.pengguna._id : null;
        const data = daftar.map((item) => formatKompetisi(item, idAktif, Boolean(proyeksi)));

        return res.status(200).json({ sukses: true, pesan: 'Daftar kompetisi berhasil diambil', data, halaman: nomorHalaman, batas: jumlahBatas, total, totalHalaman });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// GET /api/kompetisi/:id (publik): detail satu kompetisi/hackathon
async function ambilDetailKompetisi(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return next(errorHttp(400, 'Format ID kompetisi tidak valid'));

        const kompetisi = await Kompetisi.findById(id).populate('dibuatOleh', 'namaLengkap email universitas').lean();
        if (!kompetisi) return next(errorHttp(404, 'Kompetisi tidak ditemukan'));

        const idAktif = req.pengguna ? req.pengguna._id : null;
        return res.status(200).json({ sukses: true, pesan: 'Detail kompetisi berhasil diambil', data: formatKompetisi(kompetisi, idAktif, false) });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// POST /api/kompetisi (admin): membuat kompetisi baru
async function buatKompetisi(req, res, next) {
    try {
        const { nama, penyelenggara, deskripsi, kategori, totalHadiah, tanggalMulaiDaftar, batasPendaftaran, ukuranTim, status } = req.body || {};

        const kompetisi = await Kompetisi.create({
            nama,
            penyelenggara,
            deskripsi,
            kategori,
            totalHadiah,
            tanggalMulaiDaftar,
            batasPendaftaran,
            ukuranTim,
            status: status || 'aktif',
            dibuatOleh: req.pengguna._id,
        });

        return res.status(201).json({ sukses: true, pesan: 'Kompetisi berhasil dibuat', data: kompetisi });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// PUT /api/kompetisi/:id (admin): memperbarui data kompetisi
async function ubahKompetisi(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return next(errorHttp(400, 'Format ID kompetisi tidak valid'));

        const kompetisi = await Kompetisi.findById(id);
        if (!kompetisi) return next(errorHttp(404, 'Kompetisi tidak ditemukan'));

        const kolomUbah = ['nama', 'penyelenggara', 'deskripsi', 'kategori', 'totalHadiah', 'tanggalMulaiDaftar', 'batasPendaftaran', 'ukuranTim', 'status'];
        for (const kolom of kolomUbah) {
            if (req.body && req.body[kolom] !== undefined) kompetisi[kolom] = req.body[kolom];
        }

        await kompetisi.save(); // save() menjalankan validasi silang batas pendaftaran & ukuran tim
        return res.status(200).json({ sukses: true, pesan: 'Kompetisi berhasil diperbarui', data: kompetisi });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// DELETE /api/kompetisi/:id (admin): menghapus kompetisi (204 No Content)
async function hapusKompetisi(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return next(errorHttp(400, 'Format ID kompetisi tidak valid'));

        const terhapus = await Kompetisi.findByIdAndDelete(id);
        if (!terhapus) return next(errorHttp(404, 'Kompetisi tidak ditemukan'));

        return res.status(204).send();
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// POST /api/kompetisi/:id/simpan (mahasiswa/admin): toggle simpan/hapus bookmark kompetisi
async function toggleSimpanKompetisi(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return next(errorHttp(400, 'Format ID kompetisi tidak valid'));

        const kompetisi = await Kompetisi.findById(id);
        if (!kompetisi) return next(errorHttp(404, 'Kompetisi tidak ditemukan'));

        const idPengguna = req.pengguna._id;
        const sudahDisimpan = kompetisi.disimpanOleh.some((uid) => uid.equals(idPengguna));
        if (sudahDisimpan) kompetisi.disimpanOleh.pull(idPengguna);
        else kompetisi.disimpanOleh.push(idPengguna);

        await kompetisi.save();

        return res.status(200).json({
            sukses: true,
            pesan: sudahDisimpan ? 'Simpanan kompetisi berhasil dihapus' : 'Kompetisi berhasil disimpan',
            data: { idKompetisi: kompetisi._id, sudahDisimpan: !sudahDisimpan, jumlahSimpan: kompetisi.disimpanOleh.length },
        });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

module.exports = { ambilSemuaKompetisi, ambilDetailKompetisi, buatKompetisi, ubahKompetisi, hapusKompetisi, toggleSimpanKompetisi };
