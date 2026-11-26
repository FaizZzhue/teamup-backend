const mongoose = require('mongoose');
const Rekrutmen = require('../Models/Rekrutmen');
const Tim = require('../Models/Tim');
const Kompetisi = require('../Models/Kompetisi');
const Notifikasi = require('../Models/Notifikasi');
const { errorHttp } = require('../Middlewares/errorHandler');
const { formatGalatMongoose, parseUrutan, parseKolom } = require('./penggunaController');

const URUTAN_REKRUTMEN_DIIZINKAN = ['createdAt', 'judul', 'komitmen', 'status'];
const KOLOM_REKRUTMEN_DIIZINKAN = ['judul', 'deskripsi', 'ketua', 'tim', 'kompetisi', 'peranDibutuhkan', 'komitmen', 'status', 'pelamar', 'createdAt', 'updatedAt'];

function amankanRegex(nilai) {
    return String(nilai).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/rekrutmen (publik): daftar lowongan tim dengan filter kategori, komitmen, sort, fields, dan pagination
async function ambilSemuaRekrutmen(req, res, next) {
    try {
        const { kategori, komitmen, status = 'terbuka', kompetisi, cari, urutkan, sort, kolom, fields, halaman, page, batas, limit } = req.query;

        // 1. Filtering
        const filter = {};
        if (status && status !== 'semua') {
            if (!['terbuka', 'ditutup'].includes(status)) return next(errorHttp(400, "Parameter status harus 'terbuka', 'ditutup', atau 'semua'"));
            filter.status = status;
        }
        if (komitmen && komitmen.trim() !== '') filter.komitmen = komitmen.trim();
        if (kompetisi && kompetisi.trim() !== '') {
            if (!mongoose.Types.ObjectId.isValid(kompetisi)) return next(errorHttp(400, 'Format ID kompetisi pada query tidak valid'));
            filter.kompetisi = kompetisi;
        }

        if (kategori && kategori.trim() !== '') {
            const kompetisiCocok = await Kompetisi.find({ kategori: { $regex: amankanRegex(kategori.trim()), $options: 'i' } }).select('_id').lean();
            const daftarId = kompetisiCocok.map((c) => c._id);

            if (filter.kompetisi) {
                const ada = daftarId.some((cid) => String(cid) === String(filter.kompetisi));
                // Kategori tidak cocok dengan kompetisi yang diminta -> hasil kosong, bukan error
                if (!ada) {
                    return res.status(200).json({ sukses: true, pesan: 'Daftar lowongan tim berhasil diambil', data: [], halaman: Math.max(1, parseInt(halaman || page || '1', 10) || 1), batas: Math.min(50, Math.max(1, parseInt(batas || limit || '10', 10) || 10)), total: 0, totalHalaman: 1 });
                }
            } else {
                filter.kompetisi = { $in: daftarId };
            }
        }

        if (cari && cari.trim() !== '') {
            const regex = new RegExp(amankanRegex(cari.trim()), 'i');
            filter.$or = [{ judul: regex }, { deskripsi: regex }, { 'peranDibutuhkan.namaPeran': regex }, { 'peranDibutuhkan.keahlianDibutuhkan': regex }];
        }

        // 2. Pagination dengan batas maksimum
        const nomorHalaman = Math.max(1, parseInt(halaman || page || '1', 10) || 1);
        const jumlahBatas = Math.min(50, Math.max(1, parseInt(batas || limit || '10', 10) || 10));

        // 3. Sorting & 4. Projection
        const urutan = parseUrutan(urutkan || sort, URUTAN_REKRUTMEN_DIIZINKAN, { createdAt: -1 });
        const proyeksi = parseKolom(kolom || fields, KOLOM_REKRUTMEN_DIIZINKAN);

        const total = await Rekrutmen.countDocuments(filter);
        const totalHalaman = Math.max(1, Math.ceil(total / jumlahBatas));

        let kueri = Rekrutmen.find(filter).sort(urutan).skip((nomorHalaman - 1) * jumlahBatas).limit(jumlahBatas);
        if (proyeksi) {
            kueri = kueri.select(proyeksi);
        } else {
            kueri = kueri
                .populate('ketua', 'namaLengkap universitas fakultas jurusan spesialisasi keahlian')
                .populate('kompetisi', 'nama penyelenggara kategori totalHadiah batasPendaftaran')
                .populate('tim', 'nama anggota');
        }

        const data = await kueri.lean();
        return res.status(200).json({ sukses: true, pesan: 'Daftar lowongan tim berhasil diambil', data, halaman: nomorHalaman, batas: jumlahBatas, total, totalHalaman });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// GET /api/rekrutmen/:id (publik): detail lowongan tim beserta daftar pelamar
async function ambilDetailRekrutmen(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return next(errorHttp(400, 'Format ID rekrutmen tidak valid'));

        const rekrutmen = await Rekrutmen.findById(id)
            .populate('ketua', 'namaLengkap email universitas fakultas jurusan spesialisasi keahlian')
            .populate('kompetisi', 'nama penyelenggara kategori totalHadiah batasPendaftaran ukuranTim')
            .populate('tim', 'nama deskripsi anggota')
            .populate('pelamar.pengguna', 'namaLengkap universitas fakultas jurusan spesialisasi keahlian portofolio')
            .lean();
        if (!rekrutmen) return next(errorHttp(404, 'Postingan rekrutmen tidak ditemukan'));

        return res.status(200).json({ sukses: true, pesan: 'Detail rekrutmen berhasil diambil', data: rekrutmen });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// POST /api/rekrutmen (mahasiswa/admin): buat lowongan baru sekaligus buat record Tim awal
async function buatRekrutmen(req, res, next) {
    try {
        const { judul, deskripsi, kompetisi, peranDibutuhkan, komitmen, namaTim, deskripsiTim, peranKetua } = req.body || {};

        if (!kompetisi || !mongoose.Types.ObjectId.isValid(kompetisi)) {
            return next(errorHttp(400, 'ID kompetisi terkait wajib diisi dan harus valid'));
        }

        const dokKompetisi = await Kompetisi.findById(kompetisi);
        if (!dokKompetisi) return next(errorHttp(404, 'Kompetisi terkait tidak ditemukan'));

        const timAwal = new Tim({
            nama: namaTim && String(namaTim).trim() ? String(namaTim).trim() : judul,
            deskripsi: deskripsiTim && String(deskripsiTim).trim() ? String(deskripsiTim).trim() : deskripsi,
            ketua: req.pengguna._id,
            kompetisi: dokKompetisi._id,
            anggota: [{ pengguna: req.pengguna._id, peran: peranKetua && String(peranKetua).trim() ? String(peranKetua).trim() : 'Ketua Tim', status: 'aktif' }],
        });

        const rekrutmen = new Rekrutmen({
            judul,
            deskripsi,
            ketua: req.pengguna._id,
            tim: timAwal._id,
            kompetisi: dokKompetisi._id,
            peranDibutuhkan,
            komitmen: komitmen || 'Sedang',
            status: 'terbuka',
        });

        // Validasi kedua dokumen sebelum menyimpan agar tidak ada Tim yatim bila Rekrutmen gagal
        await timAwal.validate();
        await rekrutmen.validate();

        await timAwal.save();
        try {
            await rekrutmen.save();
        } catch (galatSimpan) {
            await Tim.findByIdAndDelete(timAwal._id);
            throw galatSimpan;
        }

        const hasilRekrutmen = await Rekrutmen.findById(rekrutmen._id)
            .populate('ketua', 'namaLengkap universitas jurusan')
            .populate('kompetisi', 'nama penyelenggara kategori batasPendaftaran')
            .populate('tim', 'nama anggota');

        return res.status(201).json({ sukses: true, pesan: 'Postingan rekrutmen dan tim awal berhasil dibuat', data: { rekrutmen: hasilRekrutmen, tim: timAwal } });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// POST /api/rekrutmen/:id/lamar (mahasiswa/admin): melamar peran pada rekrutmen & kirim notifikasi ke ketua
async function lamarRekrutmen(req, res, next) {
    try {
        const { id } = req.params;
        const { peranDilamar, pesanMotivasi, tautanPortofolio } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id)) return next(errorHttp(400, 'Format ID rekrutmen tidak valid'));
        if (!peranDilamar || !pesanMotivasi) return next(errorHttp(400, 'Field peranDilamar dan pesanMotivasi wajib diisi'));

        const rekrutmen = await Rekrutmen.findById(id);
        if (!rekrutmen) return next(errorHttp(404, 'Postingan rekrutmen tidak ditemukan'));
        if (rekrutmen.status !== 'terbuka') return next(errorHttp(400, 'Lowongan rekrutmen ini sudah ditutup'));
        if (rekrutmen.ketua.equals(req.pengguna._id)) return next(errorHttp(400, 'Ketua tidak dapat melamar ke rekrutmen miliknya sendiri'));

        const sudahLamar = rekrutmen.pelamar.some((p) => p.pengguna.equals(req.pengguna._id));
        if (sudahLamar) return next(errorHttp(409, 'Anda sudah pernah melamar pada rekrutmen ini'));

        const peranTarget = rekrutmen.peranDibutuhkan.find((r) => r.namaPeran.trim().toLowerCase() === String(peranDilamar).trim().toLowerCase());
        if (!peranTarget) return next(errorHttp(400, `Peran '${peranDilamar}' tidak tersedia pada rekrutmen ini`));
        if (peranTarget.terisi >= peranTarget.kuota) return next(errorHttp(400, `Kuota untuk peran '${peranTarget.namaPeran}' sudah terpenuhi`));

        rekrutmen.pelamar.push({
            pengguna: req.pengguna._id,
            peranDilamar: peranTarget.namaPeran,
            pesanMotivasi: String(pesanMotivasi).trim(),
            tautanPortofolio: tautanPortofolio ? String(tautanPortofolio).trim() : '',
            status: 'menunggu',
        });

        await rekrutmen.save();
        const pelamarBaru = rekrutmen.pelamar[rekrutmen.pelamar.length - 1];

        await Notifikasi.create({
            penerima: rekrutmen.ketua,
            tipe: 'status_lamaran',
            judul: 'Lamaran Baru Masuk',
            pesan: `${req.pengguna.namaLengkap} melamar sebagai ${peranTarget.namaPeran} pada "${rekrutmen.judul}".`,
            idReferensi: rekrutmen._id,
            modelReferensi: 'Rekrutmen',
        });

        return res.status(201).json({ sukses: true, pesan: 'Lamaran berhasil dikirim ke ketua tim', data: pelamarBaru });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// PATCH /api/rekrutmen/:id/pelamar/:idPelamar (ketua): terima/tolak pelamar & masukkan ke anggota Tim
async function prosesPelamar(req, res, next) {
    try {
        const { id, idPelamar } = req.params;
        const { status } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(idPelamar)) {
            return next(errorHttp(400, 'Format ID rekrutmen atau pelamar tidak valid'));
        }
        if (!['diterima', 'ditolak'].includes(status)) return next(errorHttp(400, "Status keputusan harus 'diterima' atau 'ditolak'"));

        const rekrutmen = await Rekrutmen.findById(id);
        if (!rekrutmen) return next(errorHttp(404, 'Postingan rekrutmen tidak ditemukan'));
        if (!rekrutmen.ketua.equals(req.pengguna._id)) return next(errorHttp(403, 'Hanya ketua rekrutmen yang dapat memproses pelamar'));

        const pelamar = rekrutmen.pelamar.id(idPelamar);
        if (!pelamar) return next(errorHttp(404, 'Data pelamar tidak ditemukan'));
        if (pelamar.status !== 'menunggu') return next(errorHttp(400, `Lamaran ini sudah diproses dengan status '${pelamar.status}'`));

        let timTerbaru = null;

        if (status === 'diterima') {
            const peranTarget = rekrutmen.peranDibutuhkan.find((r) => r.namaPeran.trim().toLowerCase() === pelamar.peranDilamar.trim().toLowerCase());
            if (peranTarget) {
                if (peranTarget.terisi >= peranTarget.kuota) return next(errorHttp(400, `Kuota untuk peran '${peranTarget.namaPeran}' sudah terpenuhi`));
                peranTarget.terisi += 1;
            }

            // Tutup lowongan otomatis bila seluruh kuota peran sudah penuh
            if (rekrutmen.peranDibutuhkan.every((r) => r.terisi >= r.kuota)) rekrutmen.status = 'ditutup';

            if (rekrutmen.tim) {
                const tim = await Tim.findById(rekrutmen.tim);
                if (tim) {
                    const anggotaAda = tim.anggota.find((a) => a.pengguna.equals(pelamar.pengguna));
                    if (anggotaAda) {
                        anggotaAda.peran = pelamar.peranDilamar;
                        anggotaAda.status = 'aktif';
                    } else {
                        tim.anggota.push({ pengguna: pelamar.pengguna, peran: pelamar.peranDilamar, status: 'aktif' });
                    }
                    await tim.save();
                    timTerbaru = tim;
                }
            }
        }

        pelamar.status = status;
        await rekrutmen.save();

        await Notifikasi.create({
            penerima: pelamar.pengguna,
            tipe: 'status_lamaran',
            judul: status === 'diterima' ? 'Lamaran Tim Diterima' : 'Lamaran Tim Ditolak',
            pesan: status === 'diterima'
                ? `Selamat! Lamaran kamu sebagai ${pelamar.peranDilamar} pada "${rekrutmen.judul}" telah diterima dan kamu sudah masuk ke anggota tim.`
                : `Mohon maaf, lamaran kamu sebagai ${pelamar.peranDilamar} pada "${rekrutmen.judul}" belum dapat diterima.`,
            idReferensi: rekrutmen._id,
            modelReferensi: 'Rekrutmen',
        });

        return res.status(200).json({
            sukses: true,
            pesan: status === 'diterima' ? 'Pelamar diterima dan berhasil ditambahkan ke anggota tim' : 'Pelamar berhasil ditolak',
            data: { pelamar, statusRekrutmen: rekrutmen.status, tim: timTerbaru },
        });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

module.exports = { ambilSemuaRekrutmen, ambilDetailRekrutmen, buatRekrutmen, lamarRekrutmen, prosesPelamar };
