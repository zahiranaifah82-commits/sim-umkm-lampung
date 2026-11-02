import db from '../config/db.js';

/**
 * Middleware Isolasi Data Multitenant (Shared Database, Shared Schema)
 * Memastikan setiap operasi database oleh tenant_admin atau staff 
 * terikat secara mutlak pada tenant_id miliknya dan tidak dapat bocor ke tenant lain.
 */
export async function enforceTenantIsolation(req, res, next) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Pengguna tidak terotentikasi.'
      });
    }

    let tenantId = null;

    if (user.role === 'super_admin') {
      // Super admin memiliki akses lintas tenant atau dapat memilih tenant spesifik via header
      const headerTenant = req.headers['x-tenant-id'];
      tenantId = headerTenant ? parseInt(headerTenant, 10) : null;
    } else if (user.role === 'tenant_admin' || user.role === 'staff') {
      // Wajib menggunakan tenant_id milik pengguna yang tertera di token JWT
      tenantId = user.tenant_id;
      if (!tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Akun Anda tidak terasosiasi dengan UMKM / Tenant manapun.'
        });
      }
    } else {
      // Customer dan Kurir tidak memiliki tenant_id tetap di profil mereka
      // Mereka mengakses tenant secara publik atau saat checkout
      return next();
    }

    if (tenantId) {
      // Periksa status langganan tenant secara real-time
      const tenantQuery = await db.query(
        'SELECT id, name, slug, subscription_status FROM tenants WHERE id = $1',
        [tenantId]
      );

      if (tenantQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Data Tenant UMKM tidak ditemukan di sistem.'
        });
      }

      const tenant = tenantQuery.rows[0];

      // Proteksi Status Langganan UMKM
      if (tenant.subscription_status === 'suspended') {
        return res.status(403).json({
          success: false,
          message: 'Layanan UMKM Anda sedang ditangguhkan (Suspended). Harap hubungi Super Admin.'
        });
      }

      if (tenant.subscription_status === 'expired') {
        return res.status(402).json({
          success: false,
          message: 'Masa aktif langganan aplikasi SIM UMKM Anda telah habis (Expired). Silakan perbarui paket langganan.'
        });
      }

      // Simpan konteks tenant ke object request
      req.tenantId = tenantId;
      req.tenant = tenant;
    }

    next();
  } catch (err) {
    console.error('❌ Error pada tenant isolation middleware:', err);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan validasi isolasi tenant.'
    });
  }
}
