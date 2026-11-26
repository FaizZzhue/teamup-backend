const express = require('express');
const router = express.Router();
const { kirimPesan, ambilPercakapan } = require('../Controllers/pesanController');
const { verifikasiToken } = require('../Middlewares/authMiddleware');

// Semua rute di file ini memerlukan autentikasi
router.use(verifikasiToken);

router.post('/', kirimPesan);
router.get('/:idTarget', ambilPercakapan);

module.exports = router;
