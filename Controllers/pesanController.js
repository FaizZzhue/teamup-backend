const mongoose = require('mongoose');
const Pesan = require('../Models/Pesan');
const Pengguna = require('../Models/Pengguna');
const Tim = require('../Models/Tim');
const { errorHttp } = require('../Middlewares/errorHandler');
const { formatGalatMongoose } = require('./penggunaController');
const { adalahAnggotaTim } = require('./timController');

// POST /api/pesan (mahasiswa/admin): kirim pesan teks ke pengguna (pribadi) atau grup tim (idTim)
async function kirimPesan(req, res, next) {
    try {
        const body = req.body || {};
        const idPenerima = body.idPenerima || body.penerima || null;
        const idTim = body.idTim || null;
        const { isi } = body;

        if (!isi || String(isi).trim() === '') return next(errorHttp(400, 'Isi pesan wajib diisi'));
        if (!idPenerima && !idTim) return next(errorHttp(400, 'Tujuan pesan (idPenerima untuk pribadi atau idTim untuk obrolan tim) wajib diisi'));
        if (idPenerima && idTim) return next(errorHttp(400, 'Pesan hanya boleh ditujukan ke idPenerima ATAU idTim, tidak keduanya'));

        if (idPenerima) {
            if (!mongoose.Types.ObjectId.isValid(idPenerima)) return next(errorHttp(400, 'Format idPenerima tidak valid'));
            if (req.pengguna._id.equals(idPenerima)) return next(errorHttp(400, 'Anda tidak dapat mengirim pesan ke diri sendiri'));
            const penerima = await Pengguna.findById(idPenerima).select('_id');
            if (!penerima) return next(errorHttp(404, 'Pengguna penerima pesan tidak ditemukan'));
        }

        if (idTim) {
            if (!mongoose.Types.ObjectId.isValid(idTim)) return next(errorHttp(400, 'Format idTim tidak valid'));
            const tim = await Tim.findById(idTim);
            if (!tim) return next(errorHttp(404, 'Tim tujuan tidak ditemukan'));
            if (!adalahAnggotaTim(tim, req.pengguna._id)) return next(errorHttp(403, 'Hanya anggota aktif tim yang dapat mengirim pesan di grup tim'));
        }

        const pesanBaru = await Pesan.create({
            pengirim: req.pengguna._id,
            penerima: idPenerima || null,
            idTim: idTim || null,
            isi: String(isi).trim(),
            sudahDibaca: false,
            dibacaOleh: [req.pengguna._id],
        });

        const hasil = await Pesan.findById(pesanBaru._id)
            .populate('pengirim', 'namaLengkap universitas jurusan')
            .populate('penerima', 'namaLengkap universitas jurusan')
            .populate('idTim', 'nama');

        return res.status(201).json({ sukses: true, pesan: 'Pesan berhasil dikirim', data: hasil });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

// GET /api/pesan/:idTarget (mahasiswa/admin): ambil riwayat percakapan pribadi atau grup tim
async function ambilPercakapan(req, res, next) {
    try {
        const { idTarget } = req.params;
        const { tipe, halaman, page, batas, limit } = req.query;

        if (!mongoose.Types.ObjectId.isValid(idTarget)) return next(errorHttp(400, 'Format idTarget tidak valid'));
        if (tipe && !['pribadi', 'pengguna', 'tim'].includes(tipe)) return next(errorHttp(400, "Parameter tipe harus 'pribadi' atau 'tim'"));

        const nomorHalaman = Math.max(1, parseInt(halaman || page || '1', 10) || 1);
        const jumlahBatas = Math.min(100, Math.max(1, parseInt(batas || limit || '50', 10) || 50));

        let jenisObrolan = null;
        let timTarget = null;
        let penggunaTarget = null;

        if (tipe === 'tim') {
            timTarget = await Tim.findById(idTarget);
            if (!timTarget) return next(errorHttp(404, 'Tim tidak ditemukan'));
            jenisObrolan = 'tim';
        } else if (tipe === 'pribadi' || tipe === 'pengguna') {
            penggunaTarget = await Pengguna.findById(idTarget).select('namaLengkap universitas jurusan spesialisasi');
            if (!penggunaTarget) return next(errorHttp(404, 'Pengguna tujuan tidak ditemukan'));
            jenisObrolan = 'pribadi';
        } else {
            // Bila ?tipe tidak dikirim, deteksi otomatis apakah idTarget milik Tim atau Pengguna
            timTarget = await Tim.findById(idTarget);
            if (timTarget) {
                jenisObrolan = 'tim';
            } else {
                penggunaTarget = await Pengguna.findById(idTarget).select('namaLengkap universitas jurusan spesialisasi');
                if (penggunaTarget) jenisObrolan = 'pribadi';
            }
        }

        if (!jenisObrolan) return next(errorHttp(404, 'Target percakapan (pengguna atau tim) tidak ditemukan'));

        let filter;
        if (jenisObrolan === 'tim') {
            if (!adalahAnggotaTim(timTarget, req.pengguna._id)) return next(errorHttp(403, 'Anda bukan anggota aktif tim ini'));
            filter = { idTim: timTarget._id };
            await Pesan.updateMany({ idTim: timTarget._id, dibacaOleh: { $ne: req.pengguna._id } }, { $addToSet: { dibacaOleh: req.pengguna._id } });
        } else {
            filter = { $or: [{ pengirim: req.pengguna._id, penerima: penggunaTarget._id }, { pengirim: penggunaTarget._id, penerima: req.pengguna._id }] };
            await Pesan.updateMany({ pengirim: penggunaTarget._id, penerima: req.pengguna._id, sudahDibaca: false }, { $set: { sudahDibaca: true }, $addToSet: { dibacaOleh: req.pengguna._id } });
        }

        const total = await Pesan.countDocuments(filter);
        const totalHalaman = Math.max(1, Math.ceil(total / jumlahBatas));

        const daftarPesan = await Pesan.find(filter)
            .sort({ createdAt: 1 })
            .skip((nomorHalaman - 1) * jumlahBatas)
            .limit(jumlahBatas)
            .populate('pengirim', 'namaLengkap universitas jurusan')
            .populate('penerima', 'namaLengkap universitas jurusan')
            .populate('idTim', 'nama')
            .lean();

        return res.status(200).json({
            sukses: true,
            pesan: 'Riwayat percakapan berhasil diambil',
            data: { jenisObrolan, target: jenisObrolan === 'tim' ? { id: timTarget._id, nama: timTarget.nama } : penggunaTarget, pesan: daftarPesan },
            halaman: nomorHalaman,
            batas: jumlahBatas,
            total,
            totalHalaman,
        });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

module.exports = { kirimPesan, ambilPercakapan };
