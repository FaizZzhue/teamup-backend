const Pengguna = require('../Models/Pengguna');
const { errorHttp } = require('../Middlewares/errorHandler');
const { hitungKekuatanProfil, formatGalatMongoose, parseUrutan, parseKolom, pilihKolom } = require('./penggunaController');

const URUTAN_TALENTA_DIIZINKAN = ['skorKecocokan', 'jumlahDukungan', 'kekuatanProfil', 'namaLengkap', 'universitas', 'createdAt'];
const KOLOM_TALENTA_DIIZINKAN = ['namaLengkap', 'email', 'universitas', 'fakultas', 'jurusan', 'bio', 'spesialisasi', 'keahlian', 'portofolio', 'riwayatKompetisi', 'jumlahDukungan', 'tersedia', 'skorKecocokan', 'keahlianCocok', 'minatCocok', 'kekuatanProfil', 'createdAt'];

function amankanRegex(nilai) {
    return String(nilai).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalisasiDaftar(daftar) {
    if (!Array.isArray(daftar)) return [];
    const unik = new Map();
    for (const item of daftar) {
        if (typeof item !== 'string') continue;
        const rapi = item.trim();
        if (!rapi) continue;
        const kunci = rapi.toLowerCase();
        if (!unik.has(kunci)) unik.set(kunci, rapi);
    }
    return Array.from(unik.entries());
}

function ekstrakMinat(pengguna) {
    const token = new Map();
    if (Array.isArray(pengguna.portofolio)) {
        for (const item of pengguna.portofolio) {
            if (item && typeof item.kategori === 'string' && item.kategori.trim()) {
                const label = item.kategori.trim();
                token.set(label.toLowerCase(), label);
            }
        }
    }
    if (typeof pengguna.spesialisasi === 'string' && pengguna.spesialisasi.trim()) {
        for (const bagian of pengguna.spesialisasi.split(/[,/|&]+/)) {
            const label = bagian.trim();
            if (label.length >= 2) token.set(label.toLowerCase(), label);
        }
    }
    return token;
}

// Menghitung skorKecocokan dinamis (0 - 100%): keahlian 60%, minat/kategori 25%, kampus & ketersediaan 15%
function hitungSkorKecocokan(penggunaAktif, kandidat) {
    const keahlianAktif = new Map(normalisasiDaftar(penggunaAktif.keahlian));
    const keahlianKandidat = new Map(normalisasiDaftar(kandidat.keahlian));

    const keahlianCocok = [];
    for (const [kunci, label] of keahlianKandidat.entries()) {
        if (keahlianAktif.has(kunci)) keahlianCocok.push(label);
    }

    let skorKeahlian = 0;
    if (keahlianAktif.size > 0 && keahlianKandidat.size > 0) {
        const gabungan = new Set([...keahlianAktif.keys(), ...keahlianKandidat.keys()]).size;
        skorKeahlian = (0.5 * (keahlianCocok.length / gabungan) + 0.5 * (keahlianCocok.length / keahlianAktif.size)) * 60;
    }

    const minatAktif = ekstrakMinat(penggunaAktif);
    const minatKandidat = ekstrakMinat(kandidat);

    const minatCocok = [];
    for (const [kunci, label] of minatKandidat.entries()) {
        if (minatAktif.has(kunci)) minatCocok.push(label);
    }

    let skorMinat = 0;
    if (minatAktif.size > 0 && minatKandidat.size > 0) {
        const gabungan = new Set([...minatAktif.keys(), ...minatKandidat.keys()]).size;
        skorMinat = (minatCocok.length / gabungan) * 25;
    }

    let skorKonteks = 0;
    if (penggunaAktif.universitas && kandidat.universitas && penggunaAktif.universitas.trim().toLowerCase() === kandidat.universitas.trim().toLowerCase()) {
        skorKonteks += 10;
    }
    if (kandidat.tersedia) skorKonteks += 5;

    return { skorKecocokan: Math.min(100, Math.round(skorKeahlian + skorMinat + skorKonteks)), keahlianCocok, minatCocok };
}

function bandingkanUrutan(a, b, urutan) {
    for (const [kolom, arah] of Object.entries(urutan)) {
        const valA = a[kolom];
        const valB = b[kolom];
        if (valA === valB) continue;
        if (kolom === 'createdAt') return (new Date(valA) - new Date(valB)) * arah;
        if (typeof valA === 'string' && typeof valB === 'string') return valA.localeCompare(valB) * arah;
        return ((valA ?? 0) - (valB ?? 0)) * arah;
    }
    return 0;
}

// GET /api/talenta (mahasiswa/admin): temukan talenta dengan filter, skorKecocokan dinamis, sort, fields, dan pagination
async function temukanTalenta(req, res, next) {
    try {
        const { cari, keahlian, universitas, hanyaTersedia, skorMinimal, urutkan, sort, kolom, fields, halaman, page, batas, limit } = req.query;

        // 1. Filtering (kecualikan diri sendiri dan hanya peran mahasiswa)
        const filter = { _id: { $ne: req.pengguna._id }, peran: 'mahasiswa' };
        if (hanyaTersedia === 'true' || hanyaTersedia === '1') filter.tersedia = true;
        if (universitas && universitas.trim() !== '') filter.universitas = { $regex: amankanRegex(universitas.trim()), $options: 'i' };

        if (keahlian && keahlian.trim() !== '') {
            const daftarKeahlian = keahlian.split(',').map((s) => s.trim()).filter(Boolean);
            if (daftarKeahlian.length > 0) filter.keahlian = { $in: daftarKeahlian.map((s) => new RegExp(`^${amankanRegex(s)}$`, 'i')) };
        }

        if (cari && cari.trim() !== '') {
            const regex = new RegExp(amankanRegex(cari.trim()), 'i');
            filter.$or = [{ namaLengkap: regex }, { bio: regex }, { spesialisasi: regex }, { universitas: regex }, { fakultas: regex }, { jurusan: regex }, { keahlian: regex }];
        }

        let nilaiSkorMin = 0;
        if (skorMinimal !== undefined && skorMinimal !== '') {
            nilaiSkorMin = Number(skorMinimal);
            if (Number.isNaN(nilaiSkorMin) || nilaiSkorMin < 0 || nilaiSkorMin > 100) {
                return next(errorHttp(400, 'Parameter skorMinimal harus berupa angka antara 0 dan 100'));
            }
        }

        // 2. Pagination dengan batas maksimum
        const nomorHalaman = Math.max(1, parseInt(halaman || page || '1', 10) || 1);
        const jumlahBatas = Math.min(50, Math.max(1, parseInt(batas || limit || '10', 10) || 10));

        // 3. Sorting & 4. Projection
        const urutan = parseUrutan(urutkan || sort, URUTAN_TALENTA_DIIZINKAN, { skorKecocokan: -1, jumlahDukungan: -1, createdAt: -1 });
        const proyeksiStr = parseKolom(kolom || fields, KOLOM_TALENTA_DIIZINKAN);
        const kolomDipilih = proyeksiStr ? proyeksiStr.split(' ') : null;

        const kandidatList = await Pengguna.find(filter).lean();

        const kandidatTerhitung = kandidatList
            .map((kandidat) => {
                const { skorKecocokan, keahlianCocok, minatCocok } = hitungSkorKecocokan(req.pengguna, kandidat);
                const { kekuatanProfil } = hitungKekuatanProfil(kandidat);
                return { ...kandidat, skorKecocokan, keahlianCocok, minatCocok, kekuatanProfil };
            })
            .filter((item) => item.skorKecocokan >= nilaiSkorMin)
            .sort((a, b) => bandingkanUrutan(a, b, urutan));

        const total = kandidatTerhitung.length;
        const totalHalaman = Math.max(1, Math.ceil(total / jumlahBatas));
        const awal = (nomorHalaman - 1) * jumlahBatas;
        const data = kandidatTerhitung
            .slice(awal, awal + jumlahBatas)
            .map((item) => (kolomDipilih ? pilihKolom(item, kolomDipilih) : item));

        return res.status(200).json({ sukses: true, pesan: 'Daftar talenta berhasil diambil', data, halaman: nomorHalaman, batas: jumlahBatas, total, totalHalaman });
    } catch (err) {
        return next(formatGalatMongoose(err));
    }
}

module.exports = { temukanTalenta, hitungSkorKecocokan };
