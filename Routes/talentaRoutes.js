const express = require('express');
const router = express.Router();
const { temukanTalenta } = require('../Controllers/talentaController');
const { verifikasiToken } = require('../Middlewares/authMiddleware');

// mahasiswa dan admin
router.get('/', verifikasiToken, temukanTalenta);

module.exports = router;
