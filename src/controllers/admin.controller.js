import db from '../config/db.js';

export const adminController = {
  /**
   * Menampilkan Seluruh Tenant UMKM Beserta Cabang & Status Langganan
   */
  async getAllTenants(req, res) {
    try {
      const sql = `
        SELECT t.id, t.name, t.slug, t.owner_name, t.phone, t.email, 
               t.subscription_status, t.created_at,
               ml.address_detail, d.district_name, d.subdistrict_name,
               (SELECT COUNT(id) FROM products WHERE tenant_id = t.id) as total_products,
               (SELECT COUNT(id) FROM orders WHERE tenant_id = t.id) as total_orders
        FROM tenants t
        LEFT JOIN merchant_locations ml ON t.id = ml.tenant_id
        LEFT JOIN districts d ON ml.district_id = d.id
        ORDER BY t.id ASC
      `;

      const result = await db.query(sql);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (err) {
      console.error('❌ Error super admin get tenants:', err);
      res.status(500).json({ success: false, message: 'Gagal memuat daftar seluruh tenant.' });
    }
  },

  /**
   * Mengubah Status Langganan Tenant (trial, active, suspended, expired)
   */
  async updateSubscription(req, res) {
    try {
      const { id } = req.params;
      const { subscription_status } = req.body;

      const validStatuses = ['trial', 'active', 'suspended', 'expired'];
      if (!validStatuses.includes(subscription_status)) {
        return res.status(400).json({
          success: false,
          message: `Status langganan tidak valid. Pilih antara: ${validStatuses.join(', ')}`
        });
      }

      await db.query(
        'UPDATE tenants SET subscription_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [subscription_status, id]
      );

      res.json({
        success: true,
        message: `Status langganan tenant #${id} berhasil diubah menjadi '${subscription_status}'.`
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Gagal mengubah status langganan.' });
    }
  },

  /**
   * Master Data Kecamatan & Kelurahan Kota Bandar Lampung
   */
  async getDistricts(req, res) {
    try {
      const result = await db.query(
        'SELECT id, district_name, subdistrict_name, postal_code FROM districts ORDER BY district_name ASC, subdistrict_name ASC'
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Gagal memuat data referensi wilayah.' });
    }
  }
};

export default adminController;
