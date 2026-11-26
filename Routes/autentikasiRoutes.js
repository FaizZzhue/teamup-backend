const express = require('express');
const router = express.Router();
const { daftar, masuk, profilSaya } = require('../Controllers/autentikasiController');
const { verifikasiToken } = require('../Middlewares/authMiddleware');

// Publik
router.post('/register', daftar);
router.post('/login', masuk);

// mahasiswa dan admin
router.get('/me', verifikasiToken, profilSaya);

module.exports = router;
