// Membuat akun admin pertama, atau menaikkan akun yang sudah ada menjadi admin.
// Pakai: npm run create-admin -- <email> <kataSandi> "<namaLengkap>"
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Pengguna = require('../Models/Pengguna');

async function buatAdmin() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('MONGODB_URI belum diatur pada file .env');
        process.exit(1);
    }

    const email = (process.argv[2] || process.env.ADMIN_EMAIL || 'admin@teamup.ac.id').trim().toLowerCase();
    const kataSandi = process.argv[3] || process.env.ADMIN_PASSWORD || 'AdminTeamup123!';
    const namaLengkap = process.argv[4] || 'Admin TEAMUP';

    if (kataSandi.length < 8) {
        console.error('Kata sandi admin minimal 8 karakter.');
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUri);
        console.log('Terhubung ke MongoDB...');

        const sudahAda = await Pengguna.findOne({ email });
        if (sudahAda) {
            if (sudahAda.peran !== 'admin') {
                sudahAda.peran = 'admin'; // akun sudah ada: dinaikkan menjadi admin
                await sudahAda.save();
                console.log(`Akun '${email}' sudah ada dan perannya dinaikkan menjadi 'admin'.`);
            } else {
                console.log(`Akun admin '${email}' sudah terdaftar.`);
            }
            return;
        }

        const admin = await Pengguna.create({
            namaLengkap,
            email,
            kataSandi,
            peran: 'admin',
            universitas: 'Universitas MDP',
            fakultas: 'Fakultas Ilmu Komputer dan Rekayasa',
            jurusan: 'Sistem Informasi',
            bio: 'Administrator platform TEAMUP.',
            spesialisasi: 'Administrator Platform',
            tersedia: false,
        });

        console.log(`Admin siap -> ID: ${admin._id} | Email: ${admin.email} | Kata Sandi: ${kataSandi} | Peran: ${admin.peran}`);
    } catch (err) {
        console.error('Gagal membuat akun admin:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

buatAdmin();
