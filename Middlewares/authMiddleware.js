const jwt = require('jsonwebtoken');
const Pengguna = require('../Models/Pengguna');
const { errorHttp } = require('./errorHandler');

function ambilBearerToken(req) {
    const [skema, token] = (req.headers.authorization || '').split(' ');
    if (skema !== 'Bearer' || !token) return null;
    return token.trim();
}

// Memverifikasi header Authorization: Bearer <token> dan memasang data pengguna ke req.pengguna
async function verifikasiToken(req, res, next) {
    try {
        const token = ambilBearerToken(req);
        if (!token) return next(errorHttp(401, 'Token autentikasi tidak ditemukan. Gunakan header Authorization: Bearer <token>'));
        if (!process.env.JWT_SECRET) return next(errorHttp(500, 'JWT_SECRET belum dikonfigurasi pada server'));

        const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        const pengguna = await Pengguna.findById(payload.id);
        if (!pengguna) return next(errorHttp(401, 'Pengguna terkait token tidak ditemukan'));

        req.pengguna = pengguna;
        return next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') return next(errorHttp(401, 'Token autentikasi sudah kedaluwarsa, silakan masuk kembali'));
        if (err.name === 'JsonWebTokenError') return next(errorHttp(401, 'Token autentikasi tidak valid'));
        return next(err);
    }
}

// Versi opsional untuk rute publik yang tetap memanfaatkan req.pengguna bila token dikirim
async function autentikasiOpsional(req, res, next) {
    try {
        const token = ambilBearerToken(req);
        if (!token || !process.env.JWT_SECRET) return next();

        const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        const pengguna = await Pengguna.findById(payload.id);
        if (pengguna) req.pengguna = pengguna;
        return next();
    } catch {
        return next();
    }
}

// Membuat middleware yang hanya meloloskan peran tertentu.
// Dipasang SETELAH verifikasiToken, karena membaca req.pengguna.
function hanyaPeran(...peranDiizinkan) {
    return (req, res, next) => {
        if (!req.pengguna) return next(errorHttp(401, 'Autentikasi diperlukan'));
        if (!peranDiizinkan.includes(req.pengguna.peran)) return next(errorHttp(403, 'Akses ditolak: peran Anda tidak diizinkan'));
        return next();
    };
}

module.exports = { verifikasiToken, autentikasiOpsional, hanyaPeran };
