const mongoose = require('mongoose');
const { Schema } = mongoose;

const skemaKecocokan = new Schema({
    // Referencing: menghubungkan pengirim, penerima, dan tim/rekrutmen terkait
    pengirim: { type: Schema.Types.ObjectId, ref: 'Pengguna', required: [true, 'Pengirim undangan wajib diisi'] },
    penerima: { type: Schema.Types.ObjectId, ref: 'Pengguna', required: [true, 'Penerima undangan wajib diisi'] },
    tim: { type: Schema.Types.ObjectId, ref: 'Tim', default: null },
    rekrutmen: { type: Schema.Types.ObjectId, ref: 'Rekrutmen', default: null },
    skorKecocokan: { type: Number, required: [true, 'Skor kecocokan wajib diisi'], min: [0, 'Skor kecocokan minimal 0'], max: [100, 'Skor kecocokan maksimal 100'] },
    pesan: { type: String, trim: true, default: '', maxlength: [1000, 'Pesan undangan maksimal 1000 karakter'] },
    status: { type: String, enum: { values: ['menunggu', 'diterima', 'ditolak'], message: 'Status kecocokan harus bernilai menunggu, diterima, atau ditolak' }, default: 'menunggu' },
}, { timestamps: true });

skemaKecocokan.index({ pengirim: 1, status: 1 });
skemaKecocokan.index({ penerima: 1, status: 1 });
skemaKecocokan.index({ pengirim: 1, penerima: 1, tim: 1, rekrutmen: 1 });

// Mencegah undangan ke diri sendiri dan memastikan terhubung ke tim atau rekrutmen
skemaKecocokan.pre('validate', function () {
    if (this.pengirim && this.penerima && this.pengirim.equals(this.penerima)) {
        this.invalidate('penerima', 'Pengirim dan penerima undangan tidak boleh sama');
    }
    if (!this.tim && !this.rekrutmen) {
        this.invalidate('tim', 'Undangan kecocokan harus terhubung ke minimal satu Tim atau Rekrutmen');
    }
});

module.exports = mongoose.model('Kecocokan', skemaKecocokan, 'kecocokan');
