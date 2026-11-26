const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

// Embedding: portofolio selalu dibaca bersama profil mahasiswa
const skemaPortofolio = new Schema({
    judul: { type: String, required: [true, 'Judul portofolio wajib diisi'], trim: true, maxlength: [150, 'Judul portofolio maksimal 150 karakter'] },
    deskripsi: { type: String, trim: true, default: '', maxlength: [1000, 'Deskripsi portofolio maksimal 1000 karakter'] },
    kategori: { type: String, required: [true, 'Kategori portofolio wajib diisi'], trim: true, maxlength: [80, 'Kategori portofolio maksimal 80 karakter'] },
    tautan: { type: String, required: [true, 'Tautan portofolio wajib diisi'], trim: true, match: [/^https?:\/\/.+/i, 'Tautan portofolio harus berupa URL yang valid (http/https)'] },
}, { _id: true });

// Embedding: riwayat kompetisi terikat pada satu mahasiswa (opsional merujuk ke Kompetisi)
const skemaRiwayatKompetisi = new Schema({
    kompetisi: { type: Schema.Types.ObjectId, ref: 'Kompetisi', default: null },
    namaKompetisi: { type: String, required: [true, 'Nama kompetisi pada riwayat wajib diisi'], trim: true, maxlength: [200, 'Nama kompetisi maksimal 200 karakter'] },
    pencapaian: { type: String, trim: true, default: 'Peserta', maxlength: [150, 'Pencapaian maksimal 150 karakter'] },
    peran: { type: String, trim: true, default: '', maxlength: [100, 'Peran maksimal 100 karakter'] },
    tahun: { type: Number, min: [2000, 'Tahun kompetisi tidak valid'], max: [2100, 'Tahun kompetisi tidak valid'] },
}, { _id: true });

const skemaPengguna = new Schema({
    namaLengkap: { type: String, required: [true, 'Nama lengkap wajib diisi'], trim: true, minlength: [2, 'Nama lengkap minimal 2 karakter'], maxlength: [100, 'Nama lengkap maksimal 100 karakter'] },
    email: { type: String, required: [true, 'Email kampus wajib diisi'], unique: true, lowercase: true, trim: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Format email kampus tidak valid'] },
    // select: false -> hash tidak ikut terbaca kecuali diminta dengan .select('+kataSandi')
    kataSandi: { type: String, required: [true, 'Kata sandi wajib diisi'], minlength: [8, 'Kata sandi minimal 8 karakter'], select: false },
    // Peran pengguna: register selalu menghasilkan 'mahasiswa'
    peran: { type: String, enum: { values: ['mahasiswa', 'admin'], message: 'Peran harus bernilai mahasiswa atau admin' }, default: 'mahasiswa' },
    universitas: { type: String, required: [true, 'Nama universitas wajib diisi'], trim: true, maxlength: [150, 'Nama universitas maksimal 150 karakter'] },
    fakultas: { type: String, trim: true, default: '', maxlength: [150, 'Nama fakultas maksimal 150 karakter'] },
    jurusan: { type: String, trim: true, default: '', maxlength: [150, 'Nama jurusan maksimal 150 karakter'] },
    bio: { type: String, trim: true, default: '', maxlength: [500, 'Bio maksimal 500 karakter'] },
    spesialisasi: { type: String, trim: true, default: '', maxlength: [120, 'Spesialisasi maksimal 120 karakter'] },
    keahlian: { type: [{ type: String, trim: true, maxlength: [60, 'Nama keahlian maksimal 60 karakter'] }], default: [] },
    portofolio: { type: [skemaPortofolio], default: [] },
    riwayatKompetisi: { type: [skemaRiwayatKompetisi], default: [] },
    jumlahDukungan: { type: Number, default: 0, min: [0, 'Jumlah dukungan tidak boleh negatif'] },
    tersedia: { type: Boolean, default: true },
}, { timestamps: true });

skemaPengguna.index({ universitas: 1, tersedia: 1 });
skemaPengguna.index({ keahlian: 1 });

// Hash kata sandi otomatis dengan bcrypt sebelum disimpan bila berubah
skemaPengguna.pre('save', async function () {
    if (!this.isModified('kataSandi')) return;
    const salt = await bcrypt.genSalt(10);
    this.kataSandi = await bcrypt.hash(this.kataSandi, salt);
});

skemaPengguna.methods.cocokkanKataSandi = async function (kandidat) {
    return bcrypt.compare(kandidat, this.kataSandi);
};

module.exports = mongoose.model('Pengguna', skemaPengguna, 'pengguna');
