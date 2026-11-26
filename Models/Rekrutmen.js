const mongoose = require('mongoose');
const { Schema } = mongoose;

// Embedding: daftar peran dan kuota melekat pada satu lowongan rekrutmen
const skemaPeranDibutuhkan = new Schema({
    namaPeran: { type: String, required: [true, 'Nama peran yang dibutuhkan wajib diisi'], trim: true, maxlength: [100, 'Nama peran maksimal 100 karakter'] },
    keahlianDibutuhkan: { type: [{ type: String, trim: true, maxlength: [60, 'Nama keahlian maksimal 60 karakter'] }], default: [] },
    kuota: { type: Number, required: [true, 'Kuota peran wajib diisi'], min: [1, 'Kuota peran minimal 1'] },
    terisi: { type: Number, default: 0, min: [0, 'Jumlah terisi tidak boleh negatif'] },
}, { _id: true });

// Embedding: daftar pelamar selalu dikelola bersama postingan rekrutmennya
const skemaPelamar = new Schema({
    pengguna: { type: Schema.Types.ObjectId, ref: 'Pengguna', required: [true, 'Referensi pelamar wajib diisi'] },
    peranDilamar: { type: String, required: [true, 'Peran yang dilamar wajib diisi'], trim: true, maxlength: [100, 'Peran yang dilamar maksimal 100 karakter'] },
    pesanMotivasi: { type: String, required: [true, 'Pesan motivasi wajib diisi'], trim: true, maxlength: [1500, 'Pesan motivasi maksimal 1500 karakter'] },
    tautanPortofolio: {
        type: String,
        trim: true,
        default: '',
        validate: { validator: (value) => !value || /^https?:\/\/.+/i.test(value), message: 'Tautan portofolio harus berupa URL yang valid (http/https)' },
    },
    status: { type: String, enum: { values: ['menunggu', 'diterima', 'ditolak'], message: 'Status pelamar harus bernilai menunggu, diterima, atau ditolak' }, default: 'menunggu' },
    tanggalLamar: { type: Date, default: Date.now },
}, { _id: true });

const skemaRekrutmen = new Schema({
    judul: { type: String, required: [true, 'Judul rekrutmen wajib diisi'], trim: true, minlength: [3, 'Judul rekrutmen minimal 3 karakter'], maxlength: [200, 'Judul rekrutmen maksimal 200 karakter'] },
    deskripsi: { type: String, required: [true, 'Deskripsi proyek/tim wajib diisi'], trim: true, maxlength: [3000, 'Deskripsi proyek/tim maksimal 3000 karakter'] },
    // Referencing: terhubung ke ketua, tim awal, dan kompetisi target
    ketua: { type: Schema.Types.ObjectId, ref: 'Pengguna', required: [true, 'Ketua rekrutmen wajib diisi'] },
    tim: { type: Schema.Types.ObjectId, ref: 'Tim', default: null },
    kompetisi: { type: Schema.Types.ObjectId, ref: 'Kompetisi', required: [true, 'Kompetisi terkait wajib diisi'] },
    peranDibutuhkan: {
        type: [skemaPeranDibutuhkan],
        validate: { validator: (peran) => Array.isArray(peran) && peran.length > 0, message: 'Minimal satu peran yang dibutuhkan harus ditambahkan' },
    },
    komitmen: { type: String, required: [true, 'Tingkat komitmen wajib diisi'], enum: { values: ['Rendah', 'Sedang', 'Tinggi', 'Sprint Hackathon'], message: 'Komitmen harus bernilai Rendah, Sedang, Tinggi, atau Sprint Hackathon' }, default: 'Sedang' },
    status: { type: String, enum: { values: ['terbuka', 'ditutup'], message: 'Status rekrutmen harus bernilai terbuka atau ditutup' }, default: 'terbuka' },
    pelamar: { type: [skemaPelamar], default: [] },
}, { timestamps: true });

skemaRekrutmen.index({ status: 1, createdAt: -1 });
skemaRekrutmen.index({ ketua: 1 });
skemaRekrutmen.index({ kompetisi: 1 });
skemaRekrutmen.index({ 'pelamar.pengguna': 1 });

// Pastikan jumlah terisi pada tiap peran tidak melebihi kuota
skemaRekrutmen.pre('validate', function () {
    if (Array.isArray(this.peranDibutuhkan)) {
        this.peranDibutuhkan.forEach((item, idx) => {
            if (item.terisi > item.kuota) this.invalidate(`peranDibutuhkan.${idx}.terisi`, 'Jumlah peran terisi tidak boleh melebihi kuota');
        });
    }
});

module.exports = mongoose.model('Rekrutmen', skemaRekrutmen, 'rekrutmen');
