const express = require('express');
const router = express.Router();
const { ambilTimSaya, ambilDetailTim, tambahTugasTim, ubahTugasTim } = require('../Controllers/timController');
const { verifikasiToken } = require('../Middlewares/authMiddleware');

// Semua rute di file ini memerlukan autentikasi (/tim-saya dipasang sebelum /:id)
router.use(verifikasiToken);

router.get('/tim-saya', ambilTimSaya);
router.get('/:id', ambilDetailTim);
router.post('/:id/tugas', tambahTugasTim);
router.patch('/:id/tugas/:idTugas', ubahTugasTim);

module.exports = router;
