const Pengguna = require('../Models/Pengguna');
const Kompetisi = require('../Models/Kompetisi');
const Rekrutmen = require('../Models/Rekrutmen');
const Tim = require('../Models/Tim');
const Kecocokan = require('../Models/Kecocokan');
const Notifikasi = require('../Models/Notifikasi');
const Pesan = require('../Models/Pesan');
const { formatGalatMongoose } = require('./penggunaController');

// GET /api/admin/statistik (admin): ringkasan statistik & laporan aktivitas platform
async function ambilStatistikAdmin(req, res, next) {
    try {
        const [totalPengguna, totalMahasiswa, totalAdmin, mahasiswaTersedia, totalKompetisi, kompetisiAktif, totalRekrutmen, rekrutmenTerbuka, totalTim, totalKecocokan, kecocokanDiterima, totalNotifikasi, totalPesan] = await Promise.all([
            Pengguna.countDocuments(),
            Pengguna.countDocuments({ peran: 'mahasiswa' }),
            Pengguna.countDocuments({ peran: 'admin' }),
            Pengguna.countDocuments({ peran: 'mahasiswa', tersedia: true }),
            Kompetisi.countDocuments(),
            Kompetisi.countDocuments({ status: 'aktif' }),
            Rekrutmen.countDocuments(),
            Rekrutmen.countDocuments({ status: 'terbuka' }),
            Tim.countDocuments(),
            Kecocokan.countDocuments(),
            Kecocokan.countDocuments({ status: 'diterima' }),
            Notifikasi.countDocuments(),
            Pesan.countDocuments(),
        ]);

        return res.status(200).json({
            sukses: true,
            pesan: 'Statistik dashboard admin berhasil diambil',
            data: {
                pengguna: { total: totalPengguna, mahasiswa: totalMahasiswa, admin: totalAdmin, mahasiswaTersedia },
                kompetisi: { total: totalKompetisi, aktif: kompetisiAktif, arsip: totalKompetisi - kompetisiAktif },
                rekrutmen: { total: totalRekrutmen, terbuka: rekrutmenTerbuka, ditutup: totalRekrutmen - rekrutmenTerbuka },
                tim: { total: totalTim },
                kecocokan: { total: totalKecocokan, diterima: kecocokanDiterima },
                aktivitas: { totalNotifikasi, totalPesan },
            },
        });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

module.exports = { ambilStatistikAdmin };
