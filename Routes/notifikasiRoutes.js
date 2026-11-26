const express = require('express');
const router = express.Router();
const { ambilNotifikasi, tandaiDibaca, tandaiSemuaDibaca } = require('../Controllers/notifikasiController');
const { verifikasiToken } = require('../Middlewares/authMiddleware');

// Semua rute di file ini memerlukan autentikasi (/baca-semua dipasang sebelum /:id/baca)
router.use(verifikasiToken);

router.get('/', ambilNotifikasi);
router.patch('/baca-semua', tandaiSemuaDibaca);
router.patch('/:id/baca', tandaiDibaca);

module.exports = router;
