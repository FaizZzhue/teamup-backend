const express = require('express');
const router = express.Router();
const { kirimUndangan, ambilDaftarKecocokan, responUndangan } = require('../Controllers/kecocokanController');
const { verifikasiToken } = require('../Middlewares/authMiddleware');

// Semua rute di file ini memerlukan autentikasi
router.use(verifikasiToken);

router.post('/undang', kirimUndangan);
router.get('/', ambilDaftarKecocokan);
router.patch('/:id/respon', responUndangan);

module.exports = router;
