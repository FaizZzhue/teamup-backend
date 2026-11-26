const mongoose = require('mongoose');
const Kecocokan = require('../Models/Kecocokan');
const Pengguna = require('../Models/Pengguna');
const Tim = require('../Models/Tim');
const Rekrutmen = require('../Models/Rekrutmen');
const Notifikasi = require('../Models/Notifikasi');
const { errorHttp } = require('../Middlewares/errorHandler');
const { formatGalatMongoose } = require('./penggunaController');
const { hitungSkorKecocokan } = require('./talentaController');

// POST /api/kecocokan/undang (ketua): kirim undangan bergabung ke kandidat & buat notifikasi
async function kirimUndangan(req, res, next) {
    try {
        const body = req.body || {};
        const idPenerima = body.idPenerima || body.penerima;
        const idTim = body.idTim || body.tim || null;
        const idRekrutmen = body.idRekrutmen || body.rekrutmen || null;
        const { pesan = '', skorKecocokan } = body;

        if (!idPenerima || !mongoose.Types.ObjectId.isValid(idPenerima)) return next(errorHttp(400, 'ID kandidat penerima (idPenerima) wajib diisi dan valid'));
        if (req.pengguna._id.equals(idPenerima)) return next(errorHttp(400, 'Anda tidak dapat mengirim undangan ke diri sendiri'));
        if (!idTim && !idRekrutmen) return next(errorHttp(400, 'Minimal salah satu dari idTim atau idRekrutmen wajib diisi'));

        const penerima = await Pengguna.findById(idPenerima).lean();
        if (!penerima) return next(errorHttp(404, 'Kandidat penerima tidak ditemukan'));

        let timTerpilih = null;
        let rekrutmenTerpilih = null;
        let namaTujuan = '';

        if (idTim) {
            if (!mongoose.Types.ObjectId.isValid(idTim)) return next(errorHttp(400, 'Format idTim tidak valid'));
            const tim = await Tim.findById(idTim);
            if (!tim) return next(errorHttp(404, 'Tim tidak ditemukan'));
            if (!tim.ketua.equals(req.pengguna._id)) return next(errorHttp(403, 'Hanya ketua tim yang dapat mengirim undangan tim'));
            if (tim.anggota.some((a) => a.pengguna.equals(idPenerima) && a.status === 'aktif')) {
                return next(errorHttp(409, 'Kandidat sudah menjadi anggota aktif tim ini'));
            }
            timTerpilih = tim._id;
            namaTujuan = tim.nama;
        }

        if (idRekrutmen) {
            if (!mongoose.Types.ObjectId.isValid(idRekrutmen)) return next(errorHttp(400, 'Format idRekrutmen tidak valid'));
            const rekrutmen = await Rekrutmen.findById(idRekrutmen);
            if (!rekrutmen) return next(errorHttp(404, 'Postingan rekrutmen tidak ditemukan'));
            if (!rekrutmen.ketua.equals(req.pengguna._id)) return next(errorHttp(403, 'Hanya ketua rekrutmen yang dapat mengirim undangan'));
            rekrutmenTerpilih = rekrutmen._id;
            if (!timTerpilih && rekrutmen.tim) timTerpilih = rekrutmen.tim;
            if (!namaTujuan) namaTujuan = rekrutmen.judul;
        }

        const cekDuplikat = { pengirim: req.pengguna._id, penerima: idPenerima, status: 'menunggu' };
        if (timTerpilih) cekDuplikat.tim = timTerpilih;
        if (rekrutmenTerpilih) cekDuplikat.rekrutmen = rekrutmenTerpilih;

        const sudahAda = await Kecocokan.findOne(cekDuplikat);
        if (sudahAda) return next(errorHttp(409, 'Undangan yang masih menunggu untuk kandidat pada tim/rekrutmen ini sudah ada'));

        // Hitung skorKecocokan otomatis bila tidak dikirim oleh klien
        const skorAkhir = skorKecocokan !== undefined && skorKecocokan !== null && skorKecocokan !== ''
            ? Number(skorKecocokan)
            : hitungSkorKecocokan(req.pengguna, penerima).skorKecocokan;

        const kecocokanBaru = await Kecocokan.create({
            pengirim: req.pengguna._id,
            penerima: idPenerima,
            tim: timTerpilih,
            rekrutmen: rekrutmenTerpilih,
            skorKecocokan: skorAkhir,
            pesan: String(pesan).trim(),
            status: 'menunggu',
        });

        await Notifikasi.create({
            penerima: idPenerima,
            tipe: 'undangan_tim',
            judul: 'Undangan Bergabung Tim',
            pesan: `${req.pengguna.namaLengkap} mengundang kamu bergabung ke "${namaTujuan}" (${kecocokanBaru.skorKecocokan}% kecocokan).`,
            idReferensi: kecocokanBaru._id,
            modelReferensi: 'Kecocokan',
        });

        const hasil = await Kecocokan.findById(kecocokanBaru._id)
            .populate('pengirim', 'namaLengkap universitas jurusan spesialisasi keahlian')
            .populate('penerima', 'namaLengkap universitas jurusan spesialisasi keahlian')
            .populate('tim', 'nama deskripsi')
            .populate('rekrutmen', 'judul status komitmen');

        return res.status(201).json({ sukses: true, pesan: 'Undangan kecocokan berhasil dikirim', data: hasil });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// GET /api/kecocokan (mahasiswa/admin): daftar undangan masuk & keluar
async function ambilDaftarKecocokan(req, res, next) {
    try {
        const { arah = 'semua', status } = req.query;
        if (!['semua', 'masuk', 'keluar'].includes(arah)) return next(errorHttp(400, "Parameter arah harus 'semua', 'masuk', atau 'keluar'"));
        if (status && !['menunggu', 'diterima', 'ditolak'].includes(status)) return next(errorHttp(400, "Parameter status harus 'menunggu', 'diterima', atau 'ditolak'"));

        const filter = {};
        if (status) filter.status = status;
        if (arah === 'masuk') filter.penerima = req.pengguna._id;
        else if (arah === 'keluar') filter.pengirim = req.pengguna._id;
        else filter.$or = [{ penerima: req.pengguna._id }, { pengirim: req.pengguna._id }];

        const daftar = await Kecocokan.find(filter)
            .sort({ createdAt: -1 })
            .populate('pengirim', 'namaLengkap universitas fakultas jurusan spesialisasi keahlian')
            .populate('penerima', 'namaLengkap universitas fakultas jurusan spesialisasi keahlian')
            .populate('tim', 'nama deskripsi kompetisi')
            .populate('rekrutmen', 'judul status komitmen')
            .lean();

        const masuk = daftar.filter((m) => m.penerima && String(m.penerima._id) === String(req.pengguna._id));
        const keluar = daftar.filter((m) => m.pengirim && String(m.pengirim._id) === String(req.pengguna._id));

        return res.status(200).json({
            sukses: true,
            pesan: 'Daftar undangan kecocokan berhasil diambil',
            data: { masuk, keluar, totalMasuk: masuk.length, totalKeluar: keluar.length },
        });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// PATCH /api/kecocokan/:id/respon (penerima): terima atau tolak undangan; jika diterima, masuk ke Tim
async function responUndangan(req, res, next) {
    try {
        const { id } = req.params;
        const { status, peran } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id)) return next(errorHttp(400, 'Format ID kecocokan tidak valid'));
        if (!['diterima', 'ditolak'].includes(status)) return next(errorHttp(400, "Status respon harus 'diterima' atau 'ditolak'"));

        const kecocokan = await Kecocokan.findById(id);
        if (!kecocokan) return next(errorHttp(404, 'Undangan kecocokan tidak ditemukan'));
        if (!kecocokan.penerima.equals(req.pengguna._id)) return next(errorHttp(403, 'Hanya penerima undangan yang dapat merespon undangan ini'));
        if (kecocokan.status !== 'menunggu') return next(errorHttp(400, `Undangan ini sudah direspon dengan status '${kecocokan.status}'`));

        kecocokan.status = status;
        await kecocokan.save();

        let timDiikuti = null;

        if (status === 'diterima') {
            let idTimTujuan = kecocokan.tim;
            if (!idTimTujuan && kecocokan.rekrutmen) {
                const rekrutmen = await Rekrutmen.findById(kecocokan.rekrutmen).select('tim');
                if (rekrutmen && rekrutmen.tim) idTimTujuan = rekrutmen.tim;
            }

            if (idTimTujuan) {
                const tim = await Tim.findById(idTimTujuan);
                if (tim) {
                    const peranAnggota = peran && String(peran).trim() ? String(peran).trim() : req.pengguna.spesialisasi || 'Anggota Tim';
                    const anggotaAda = tim.anggota.find((a) => a.pengguna.equals(req.pengguna._id));
                    if (anggotaAda) {
                        anggotaAda.peran = peranAnggota;
                        anggotaAda.status = 'aktif';
                    } else {
                        tim.anggota.push({ pengguna: req.pengguna._id, peran: peranAnggota, status: 'aktif' });
                    }
                    await tim.save();
                    timDiikuti = tim;
                }
            }
        }

        await Notifikasi.create({
            penerima: kecocokan.pengirim,
            tipe: 'undangan_tim',
            judul: status === 'diterima' ? 'Undangan Tim Diterima' : 'Undangan Tim Ditolak',
            pesan: status === 'diterima'
                ? `${req.pengguna.namaLengkap} menerima undangan bergabung ke tim kamu.`
                : `${req.pengguna.namaLengkap} menolak undangan bergabung ke tim kamu.`,
            idReferensi: kecocokan._id,
            modelReferensi: 'Kecocokan',
        });

        return res.status(200).json({
            sukses: true,
            pesan: status === 'diterima' ? 'Undangan diterima dan kamu berhasil bergabung ke tim' : 'Undangan berhasil ditolak',
            data: { kecocokan, tim: timDiikuti },
        });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

module.exports = { kirimUndangan, ambilDaftarKecocokan, responUndangan };
