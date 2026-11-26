const express = require('express');
const router = express.Router();
const { ambilSemuaPengguna, ubahPeranPengguna, ambilDetailPengguna, ubahProfil, dukungPengguna } = require('../Controllers/penggunaController');
const { verifikasiToken, autentikasiOpsional, hanyaPeran } = require('../Middlewares/authMiddleware');

// admin saja
router.get('/', verifikasiToken, hanyaPeran('admin'), ambilSemuaPengguna);
router.patch('/:id/peran', verifikasiToken, hanyaPeran('admin'), ubahPeranPengguna);

// mahasiswa dan admin (/profil dipasang sebelum /:id)
router.put('/profil', verifikasiToken, ubahProfil);
router.post('/:id/dukung', verifikasiToken, dukungPengguna);

// Publik
router.get('/:id', autentikasiOpsional, ambilDetailPengguna);

module.exports = router;
