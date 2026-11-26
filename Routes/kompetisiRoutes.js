const express = require('express');
const router = express.Router();
const { ambilSemuaKompetisi, ambilDetailKompetisi, buatKompetisi, ubahKompetisi, hapusKompetisi, toggleSimpanKompetisi } = require('../Controllers/kompetisiController');
const { verifikasiToken, autentikasiOpsional, hanyaPeran } = require('../Middlewares/authMiddleware');

// Publik
router.get('/', autentikasiOpsional, ambilSemuaKompetisi);
router.get('/:id', autentikasiOpsional, ambilDetailKompetisi);

// mahasiswa dan admin
router.post('/:id/simpan', verifikasiToken, toggleSimpanKompetisi);

// admin saja
router.post('/', verifikasiToken, hanyaPeran('admin'), buatKompetisi);
router.put('/:id', verifikasiToken, hanyaPeran('admin'), ubahKompetisi);
router.delete('/:id', verifikasiToken, hanyaPeran('admin'), hapusKompetisi);

module.exports = router;
