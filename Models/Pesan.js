const mongoose = require('mongoose');
const { Schema } = mongoose;

const skemaPesan = new Schema({
    // Referencing: pesan disimpan di koleksi tersendiri agar dokumen Pengguna/Tim tidak membengkak
    pengirim: { type: Schema.Types.ObjectId, ref: 'Pengguna', required: [true, 'Pengirim pesan wajib diisi'] },
    penerima: { type: Schema.Types.ObjectId, ref: 'Pengguna', default: null },
    idTim: { type: Schema.Types.ObjectId, ref: 'Tim', default: null },
    isi: { type: String, required: [true, 'Isi pesan teks wajib diisi'], trim: true, minlength: [1, 'Isi pesan tidak boleh kosong'], maxlength: [2000, 'Isi pesan maksimal 2000 karakter'] },
    sudahDibaca: { type: Boolean, default: false },
    dibacaOleh: { type: [{ type: Schema.Types.ObjectId, ref: 'Pengguna' }], default: [] },
}, { timestamps: true });

skemaPesan.index({ pengirim: 1, penerima: 1, createdAt: -1 });
skemaPesan.index({ idTim: 1, createdAt: -1 });

// Pesan harus ditujukan ke tepat satu target: penerima (pesan pribadi) atau idTim (obrolan tim)
skemaPesan.pre('validate', function () {
    const adaPenerima = Boolean(this.penerima);
    const adaTim = Boolean(this.idTim);

    if (!adaPenerima && !adaTim) this.invalidate('penerima', 'Pesan harus memiliki tujuan penerima (pribadi) atau idTim (obrolan tim)');
    if (adaPenerima && adaTim) this.invalidate('idTim', 'Pesan hanya boleh ditujukan ke penerima ATAU idTim, tidak keduanya bersamaan');
    if (adaPenerima && this.pengirim && this.pengirim.equals(this.penerima)) this.invalidate('penerima', 'Pengirim dan penerima pesan tidak boleh sama');
});

module.exports = mongoose.model('Pesan', skemaPesan, 'pesan');
