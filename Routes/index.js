const express = require('express');
const router = express.Router();

// Publik
router.get('/', (req, res) => {
    res.status(200).json({ sukses: true, pesan: 'Selamat datang di TEAMUP REST API', versi: '1.0.0' });
});

router.get('/health', (req, res) => {
    res.status(200).json({ sukses: true, status: 'ok', waktu: new Date().toISOString() });
});

module.exports = router;
