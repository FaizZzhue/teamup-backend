const mongoose = require('mongoose');
const { Schema } = mongoose;

const skemaKompetisi = new Schema({
    nama: { type: String, required: [true, 'Nama kompetisi/hackathon wajib diisi'], trim: true, minlength: [3, 'Nama kompetisi minimal 3 karakter'], maxlength: [200, 'Nama kompetisi maksimal 200 karakter'] },
    penyelenggara: { type: String, required: [true, 'Penyelenggara kompetisi wajib diisi'], trim: true, maxlength: [150, 'Nama penyelenggara maksimal 150 karakter'] },
    deskripsi: { type: String, required: [true, 'Deskripsi kompetisi wajib diisi'], trim: true, maxlength: [3000, 'Deskripsi kompetisi maksimal 3000 karakter'] },
    kategori: { type: String, required: [true, 'Kategori kompetisi wajib diisi'], trim: true, maxlength: [100, 'Kategori kompetisi maksimal 100 karakter'] },
    totalHadiah: { type: String, trim: true, default: '', maxlength: [150, 'Informasi hadiah maksimal 150 karakter'] },
    tanggalMulaiDaftar: { type: Date, default: null },
    batasPendaftaran: { type: Date, required: [true, 'Tanggal batas pendaftaran wajib diisi'] },
    ukuranTim: {
        minimal: { type: Number, required: [true, 'Jumlah minimal anggota tim wajib diisi'], min: [1, 'Minimal anggota tim adalah 1'], default: 1 },
        maksimal: { type: Number, required: [true, 'Jumlah maksimal anggota tim wajib diisi'], min: [1, 'Maksimal anggota tim minimal 1'], default: 5 },
    },
    status: { type: String, enum: { values: ['aktif', 'arsip'], message: 'Status kurasi harus bernilai aktif atau arsip' }, default: 'aktif' },
    // Referencing: daftar pengguna yang menyimpan bookmark kompetisi ini
    disimpanOleh: { type: [{ type: Schema.Types.ObjectId, ref: 'Pengguna' }], default: [] },
    dibuatOleh: { type: Schema.Types.ObjectId, ref: 'Pengguna', default: null },
}, { timestamps: true });

skemaKompetisi.index({ status: 1, batasPendaftaran: 1 });
skemaKompetisi.index({ kategori: 1 });

// Validasi silang: batas anggota tim dan urutan tanggal pendaftaran
skemaKompetisi.pre('validate', function () {
    if (this.ukuranTim && this.ukuranTim.maksimal < this.ukuranTim.minimal) {
        this.invalidate('ukuranTim.maksimal', 'Jumlah maksimal anggota tim tidak boleh lebih kecil dari minimal');
    }
    if (this.tanggalMulaiDaftar && this.batasPendaftaran && this.batasPendaftaran < this.tanggalMulaiDaftar) {
        this.invalidate('batasPendaftaran', 'Tanggal batas pendaftaran tidak boleh sebelum tanggal mulai pendaftaran');
    }
});

module.exports = mongoose.model('Kompetisi', skemaKompetisi, 'kompetisi');
