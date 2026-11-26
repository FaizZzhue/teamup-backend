const express = require('express');
const router = express.Router();
const { ambilStatistikAdmin } = require('../Controllers/adminController');
const { verifikasiToken, hanyaPeran } = require('../Middlewares/authMiddleware');

// Semua rute di file ini hanya untuk admin
router.use(verifikasiToken, hanyaPeran('admin'));

router.get('/statistik', ambilStatistikAdmin);

module.exports = router;

