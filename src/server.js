import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { runMigrations } from './database/migrate.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Global
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Frontend Web / PWA Statics
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));

// Healthcheck Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'SIM UMKM Multitenant Kota Bandar Lampung',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Mount API Router
app.use('/api', apiRoutes);

// Fallback untuk Single Page Application (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.resolve(publicDir, 'index.html'));
});

// Jalankan Server & Migrasi Otomatis
async function startServer() {
  try {
    await runMigrations();
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 SIM UMKM MULTITENANT KOTA BANDAR LAMPUNG RUNNING!`);
      console.log(`🌐 Akses Browser / HP: http://localhost:${PORT}`);
      console.log(`📡 RESTful API Endpoint: http://localhost:${PORT}/api`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('❌ Gagal menjalankan server:', err);
    process.exit(1);
  }
}

startServer();
