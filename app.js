require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const logger = require('./Middlewares/logger');
const { notFoundHandler, errorHandler } = require('./Middlewares/errorHandler');
const ruteUtama = require('./Routes');
const autentikasiRoutes = require('./Routes/autentikasiRoutes');
const penggunaRoutes = require('./Routes/penggunaRoutes');
const talentaRoutes = require('./Routes/talentaRoutes');
const kompetisiRoutes = require('./Routes/kompetisiRoutes');
const rekrutmenRoutes = require('./Routes/rekrutmenRoutes');
const kecocokanRoutes = require('./Routes/kecocokanRoutes');
const timRoutes = require('./Routes/timRoutes');
const notifikasiRoutes = require('./Routes/notifikasiRoutes');
const pesanRoutes = require('./Routes/pesanRoutes');
const adminRoutes = require('./Routes/adminRoutes');

// Tolak menyala bila JWT_SECRET belum diisi di .env
if (require.main === module && !process.env.JWT_SECRET) {
    console.error('JWT_SECRET belum diisi di .env');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

const daftarOriginMentah = process.env.CLIENT_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
const originDiizinkan = daftarOriginMentah.split(',').map((o) => o.trim()).filter(Boolean);

const opsiCors = {
    origin(origin, callback) {
        if (!origin || originDiizinkan.includes('*') || originDiizinkan.includes(origin)) return callback(null, true);
        return callback(new Error('Origin tidak diizinkan oleh kebijakan CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};

app.use(logger);
app.use(cors(opsiCors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Express 5: req.body bernilai undefined bila request tidak membawa body JSON
app.use((req, res, next) => {
    req.body ??= {};
    next();
});

let janjiKoneksi = null;
async function hubungkanDB() {
    if (mongoose.connection.readyState === 1) return mongoose.connection;

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('Variabel lingkungan MONGODB_URI belum diatur pada file .env');

    if (!janjiKoneksi) {
        janjiKoneksi = mongoose.connect(mongoUri)
            .then((conn) => {
                console.log(`Terhubung ke MongoDB: ${conn.connection.host}/${conn.connection.name}`);
                return conn.connection;
            })
            .catch((err) => {
                janjiKoneksi = null;
                throw err;
            });
    }
    return janjiKoneksi;
}

// Health check root (publik)
app.get('/', (req, res) => {
    const statusDb = ['terputus', 'terhubung', 'menghubungkan', 'memutus'];
    res.status(200).json({ sukses: true, layanan: 'TEAMUP Backend API', database: statusDb[mongoose.connection.readyState] || 'tidak diketahui' });
});

// Serverless Vercel: pastikan koneksi MongoDB siap sebelum rute /api dijalankan
app.use('/api', async (req, res, next) => {
    if (process.env.VERCEL && mongoose.connection.readyState !== 1) {
        try {
            await hubungkanDB();
        } catch (err) {
            return next(err);
        }
    }
    return next();
});

app.use('/api', ruteUtama);
app.use('/api/auth', autentikasiRoutes);
app.use('/api/pengguna', penggunaRoutes);
app.use('/api/talenta', talentaRoutes);
app.use('/api/kompetisi', kompetisiRoutes);
app.use('/api/rekrutmen', rekrutmenRoutes);
app.use('/api/kecocokan', kecocokanRoutes);
app.use('/api/tim', timRoutes);
app.use('/api/notifikasi', notifikasiRoutes);
app.use('/api/pesan', pesanRoutes);
app.use('/api/admin', adminRoutes);

// Error handling terpusat harus didaftarkan paling akhir setelah semua route
app.use(notFoundHandler);
app.use(errorHandler);

async function mulaiServer() {
    try {
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET belum diisi di .env');
            process.exit(1);
        }
        await hubungkanDB();
        app.listen(PORT, () => console.log(`Server TEAMUP berjalan di http://localhost:${PORT}`));
    } catch (err) {
        console.error('Gagal memulai server TEAMUP:', err.message);
        process.exit(1);
    }
}

if (require.main === module) mulaiServer();

app.app = app;
app.hubungkanDB = hubungkanDB;
app.mulaiServer = mulaiServer;

module.exports = app;
