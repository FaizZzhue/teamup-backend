const express = require('express');
const router = express.Router();
const { ambilSemuaRekrutmen, ambilDetailRekrutmen, buatRekrutmen, lamarRekrutmen, prosesPelamar } = require('../Controllers/rekrutmenController');
const { verifikasiToken, autentikasiOpsional } = require('../Middlewares/authMiddleware');

// Publik
router.get('/', autentikasiOpsional, ambilSemuaRekrutmen);
router.get('/:id', autentikasiOpsional, ambilDetailRekrutmen);

// mahasiswa dan admin
router.post('/', verifikasiToken, buatRekrutmen);
router.post('/:id/lamar', verifikasiToken, lamarRekrutmen);
router.patch('/:id/pelamar/:idPelamar', verifikasiToken, prosesPelamar);

module.exports = router;
