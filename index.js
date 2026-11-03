import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from '../src/routes/api.js';
import { runMigrations } from '../src/database/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Frontend Web Statics
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));

let isMigrated = false;
app.use(async (req, res, next) => {
  if (!isMigrated && process.env.DATABASE_URL) {
    try {
      await runMigrations();
      isMigrated = true;
    } catch (e) {
      console.error('Migration note:', e.message);
      isMigrated = true; // Jangan looping jika tabel sudah ada
    }
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'SIM UMKM Multitenant Kota Bandar Lampung (Vercel Production)',
    timestamp: new Date().toISOString()
  });
});

// Mount API Router
app.use('/api', apiRoutes);

// Fallback untuk SPA
app.get('*', (req, res) => {
  res.sendFile(path.resolve(publicDir, 'index.html'));
});

export default app;
