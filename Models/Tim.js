const mongoose = require('mongoose');
const { Schema } = mongoose;

// Embedding: daftar anggota (roster) selalu dibaca bersama detail tim
const skemaAnggota = new Schema({
    pengguna: { type: Schema.Types.ObjectId, ref: 'Pengguna', required: [true, 'Referensi pengguna anggota tim wajib diisi'] },
    peran: { type: String, required: [true, 'Peran anggota dalam tim wajib diisi'], trim: true, maxlength: [80, 'Nama peran maksimal 80 karakter'] },
    status: { type: String, enum: { values: ['aktif', 'diundang', 'keluar'], message: 'Status anggota harus bernilai aktif, diundang, atau keluar' }, default: 'aktif' },
    tanggalGabung: { type: Date, default: Date.now },
}, { _id: true });

// Embedding: daftar tugas sederhana di dalam ruang kerja tim
const skemaTugas = new Schema({
    judul: { type: String, required: [true, 'Judul tugas wajib diisi'], trim: true, maxlength: [200, 'Judul tugas maksimal 200 karakter'] },
    deskripsi: { type: String, trim: true, default: '', maxlength: [1000, 'Deskripsi tugas maksimal 1000 karakter'] },
    ditugaskanKe: { type: Schema.Types.ObjectId, ref: 'Pengguna', default: null },
    status: { type: String, enum: { values: ['belum', 'dikerjakan', 'selesai'], message: 'Status tugas harus bernilai belum, dikerjakan, atau selesai' }, default: 'belum' },
    tenggat: { type: Date, default: null },
}, { _id: true, timestamps: true });

const skemaTim = new Schema({
    nama: { type: String, required: [true, 'Nama tim wajib diisi'], trim: true, minlength: [2, 'Nama tim minimal 2 karakter'], maxlength: [120, 'Nama tim maksimal 120 karakter'] },
    deskripsi: { type: String, trim: true, default: '', maxlength: [1500, 'Deskripsi tim maksimal 1500 karakter'] },
    // Referencing: ketua dan kompetisi dapat dirujuk banyak tim
    ketua: { type: Schema.Types.ObjectId, ref: 'Pengguna', required: [true, 'Ketua tim wajib diisi'] },
    anggota: { type: [skemaAnggota], default: [] },
    kompetisi: { type: Schema.Types.ObjectId, ref: 'Kompetisi', default: null },
    tugas: { type: [skemaTugas], default: [] },
}, { timestamps: true });

skemaTim.index({ ketua: 1 });
skemaTim.index({ kompetisi: 1 });
skemaTim.index({ 'anggota.pengguna': 1 });

module.exports = mongoose.model('Tim', skemaTim, 'tim');
