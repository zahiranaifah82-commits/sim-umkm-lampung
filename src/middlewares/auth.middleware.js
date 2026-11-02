import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'lampung-food-super-secret-key-2026';

/**
 * Middleware untuk verifikasi JWT Token
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak. Token otentikasi tidak ditemukan.'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Sesi berakhir atau token tidak valid. Silakan login kembali.'
      });
    }
    req.user = decodedUser;
    next();
  });
}

/**
 * Middleware Otorisasi Berdasarkan Role
 * Contoh: requireRoles('tenant_admin', 'staff')
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Pengguna belum terotentikasi.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses dilarang. Role '${req.user.role}' tidak memiliki izin mengakses endpoint ini.`
      });
    }

    next();
  };
}

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
