import express from 'express';
import cors from 'cors';
import apiRoutes from '../src/routes/api.js';
import { runMigrations } from '../src/database/migrate.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
const handleHealthCheck = (req, res) => {
  res.json({
    status: 'healthy',
    app: 'SIM UMKM Multitenant Kota Bandar Lampung (Vercel Serverless)',
    database: process.env.DATABASE_URL ? 'PostgreSQL Supabase Connected' : 'SQLite Local',
    timestamp: new Date().toISOString()
  });
};

app.get('/api/health', handleHealthCheck);
app.get('/health', handleHealthCheck);

// Endpoint trigger migrasi database (opsional)
app.get('/api/migrate', async (req, res) => {
  try {
    await runMigrations();
    res.json({ success: true, message: 'Migrasi & seeder berhasil dijalankan.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mount API router
app.use('/api', apiRoutes);
app.use('/', apiRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

export default app;
