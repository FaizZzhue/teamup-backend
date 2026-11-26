const mongoose = require('mongoose');
const { Schema } = mongoose;

const skemaNotifikasi = new Schema({
    penerima: { type: Schema.Types.ObjectId, ref: 'Pengguna', required: [true, 'Pengguna penerima notifikasi wajib diisi'] },
    tipe: { type: String, required: [true, 'Tipe notifikasi wajib diisi'], enum: { values: ['undangan_tim', 'status_lamaran', 'tenggat', 'sistem'], message: 'Tipe notifikasi harus bernilai undangan_tim, status_lamaran, tenggat, atau sistem' } },
    judul: { type: String, required: [true, 'Judul notifikasi wajib diisi'], trim: true, maxlength: [200, 'Judul notifikasi maksimal 200 karakter'] },
    pesan: { type: String, required: [true, 'Pesan notifikasi wajib diisi'], trim: true, maxlength: [1000, 'Pesan notifikasi maksimal 1000 karakter'] },
    // Referencing polimorfik: idReferensi merujuk ke model yang disebut pada modelReferensi
    idReferensi: { type: Schema.Types.ObjectId, refPath: 'modelReferensi', default: null },
    modelReferensi: { type: String, enum: { values: ['Kecocokan', 'Rekrutmen', 'Kompetisi', 'Tim', 'Pesan', null], message: 'modelReferensi tidak valid' }, default: null },
    sudahDibaca: { type: Boolean, default: false },
}, { timestamps: true });

skemaNotifikasi.index({ penerima: 1, sudahDibaca: 1, createdAt: -1 });

module.exports = mongoose.model('Notifikasi', skemaNotifikasi, 'notifikasi');
