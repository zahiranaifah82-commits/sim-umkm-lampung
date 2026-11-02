import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { generateToken } from '../middlewares/auth.middleware.js';

export const authController = {
  /**
   * Registrasi Customer Baru via HP
   */
  async registerCustomer(req, res) {
    try {
      const { name, email, password, phone } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Nama, email, dan password wajib diisi.'
        });
      }

      // Cek apakah email sudah terdaftar
      const checkUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (checkUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Email sudah terdaftar. Silakan login atau gunakan email lain.'
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const insertQuery = await db.query(
        `INSERT INTO users (tenant_id, name, email, password, role, phone) 
         VALUES (NULL, $1, $2, $3, 'customer', $4) RETURNING id, name, email, role, phone`,
        [name, email, hashedPassword, phone || null]
      );

      const newUser = insertQuery.rows[0];
      const token = generateToken({
        id: newUser.id,
        tenant_id: null,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      });

      res.status(201).json({
        success: true,
        message: 'Registrasi pelanggan berhasil.',
        data: {
          user: newUser,
          token
        }
      });
    } catch (err) {
      console.error('❌ Error registrasi customer:', err);
      res.status(500).json({ success: false, message: 'Gagal melakukan registrasi.' });
    }
  },

  /**
   * Login Pengguna untuk Semua Role (Customer, Tenant Admin, Courier, Super Admin)
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email dan password wajib diisi.'
        });
      }

      const userQuery = await db.query(
        `SELECT u.id, u.tenant_id, u.name, u.email, u.password, u.role, u.phone, 
                t.name as tenant_name, t.subscription_status
         FROM users u
         LEFT JOIN tenants t ON u.tenant_id = t.id
         WHERE u.email = $1`,
        [email]
      );

      if (userQuery.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Kredensial tidak valid. Email atau kata sandi salah.'
        });
      }

      const user = userQuery.rows[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Kredensial tidak valid. Email atau kata sandi salah.'
        });
      }

      // Cek status subscription jika role adalah tenant_admin/staff
      if ((user.role === 'tenant_admin' || user.role === 'staff') && user.tenant_id) {
        if (user.subscription_status === 'suspended') {
          return res.status(403).json({
            success: false,
            message: 'Akun UMKM Anda sedang ditangguhkan (Suspended).'
          });
        }
      }

      const token = generateToken({
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        role: user.role
      });

      res.json({
        success: true,
        message: `Selamat datang kembali, ${user.name}!`,
        data: {
          user: {
            id: user.id,
            tenant_id: user.tenant_id,
            tenant_name: user.tenant_name,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            subscription_status: user.subscription_status
          },
          token
        }
      });
    } catch (err) {
      console.error('❌ Error login pengguna:', err);
      res.status(500).json({ success: false, message: 'Gagal melakukan login.' });
    }
  },

  /**
   * Dapatkan profil saat ini dari token
   */
  async getMe(req, res) {
    try {
      const userQuery = await db.query(
        `SELECT u.id, u.tenant_id, u.name, u.email, u.role, u.phone, 
                t.name as tenant_name, t.subscription_status
         FROM users u
         LEFT JOIN tenants t ON u.tenant_id = t.id
         WHERE u.id = $1`,
        [req.user.id]
      );

      if (userQuery.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
      }

      res.json({
        success: true,
        data: userQuery.rows[0]
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Gagal mengambil profil.' });
    }
  }
};

export default authController;
