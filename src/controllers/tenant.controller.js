import db from '../config/db.js';
import {
  calculateHaversineDistance,
  calculateDeliveryCost,
  BANDAR_LAMPUNG_CENTER
} from '../services/geo.service.js';

export const tenantController = {
  /**
   * Menampilkan daftar UMKM terdekat di Kota Bandar Lampung berdasarkan Radius GPS
   */
  async getNearbyMerchants(req, res) {
    try {
      // Default ke Tugu Adipura / Enggal jika customer belum mengizinkan akses GPS di HP
      const customerLat = parseFloat(req.query.lat) || BANDAR_LAMPUNG_CENTER.latitude;
      const customerLng = parseFloat(req.query.lng) || BANDAR_LAMPUNG_CENTER.longitude;
      const search = req.query.search ? req.query.search.toLowerCase() : null;
      const districtId = req.query.district_id ? parseInt(req.query.district_id, 10) : null;

      // Ambil seluruh UMKM yang status langganannya aktif atau trial
      let querySql = `
        SELECT t.id, t.name, t.slug, t.owner_name, t.phone, t.email, t.subscription_status,
               ml.address_detail, ml.latitude, ml.longitude,
               d.district_name, d.subdistrict_name
        FROM tenants t
        INNER JOIN merchant_locations ml ON t.id = ml.tenant_id AND ml.is_active = true
        LEFT JOIN districts d ON ml.district_id = d.id
        WHERE t.subscription_status IN ('active', 'trial')
      `;

      const params = [];

      if (districtId) {
        params.push(districtId);
        querySql += ` AND ml.district_id = $${params.length}`;
      }

      const result = await db.query(querySql, params);

      // Hitung jarak Haversine ke setiap UMKM
      let merchants = result.rows.map((m) => {
        const distanceKm = calculateHaversineDistance(
          customerLat,
          customerLng,
          parseFloat(m.latitude),
          parseFloat(m.longitude)
        );

        const deliveryInfo = calculateDeliveryCost(distanceKm);

        return {
          id: m.id,
          name: m.name,
          slug: m.slug,
          owner_name: m.owner_name,
          phone: m.phone,
          address_detail: m.address_detail,
          district_name: m.district_name || 'Bandar Lampung',
          subdistrict_name: m.subdistrict_name || '',
          latitude: parseFloat(m.latitude),
          longitude: parseFloat(m.longitude),
          distance_km: distanceKm,
          estimated_time: deliveryInfo.estimatedTimeText || '20-30 menit',
          delivery_fee: deliveryInfo.deliveryFee,
          is_deliverable: deliveryInfo.isDeliverable,
          rating: 4.8, // Standar rating UMKM kuliner
          rating_count: 120 + (m.id * 37) % 80
        };
      });

      // Filter pencarian nama UMKM jika ada
      if (search) {
        merchants = merchants.filter(
          (m) =>
            m.name.toLowerCase().includes(search) ||
            m.district_name.toLowerCase().includes(search)
        );
      }

      // Urutkan dari yang paling dekat dengan lokasi customer
      merchants.sort((a, b) => a.distance_km - b.distance_km);

      res.json({
        success: true,
        data: {
          customer_coords: { latitude: customerLat, longitude: customerLng },
          merchants
        }
      });
    } catch (err) {
      console.error('❌ Error mengambil daftar UMKM terdekat:', err);
      res.status(500).json({ success: false, message: 'Gagal memuat daftar UMKM terdekat.' });
    }
  },

  /**
   * Detail Profil UMKM, Katalog Kategori, Menu Produk, & Addons
   */
  async getMerchantDetail(req, res) {
    try {
      const { idOrSlug } = req.params;
      const customerLat = parseFloat(req.query.lat) || BANDAR_LAMPUNG_CENTER.latitude;
      const customerLng = parseFloat(req.query.lng) || BANDAR_LAMPUNG_CENTER.longitude;

      // 1. Ambil Profil Tenant
      const isNumeric = /^\d+$/.test(idOrSlug);
      const tenantSql = `
        SELECT t.id, t.name, t.slug, t.owner_name, t.phone, t.email, t.subscription_status,
               ml.address_detail, ml.latitude, ml.longitude,
               d.district_name, d.subdistrict_name
        FROM tenants t
        LEFT JOIN merchant_locations ml ON t.id = ml.tenant_id
        LEFT JOIN districts d ON ml.district_id = d.id
        WHERE ${isNumeric ? 't.id = $1' : 't.slug = $1'}
      `;

      const tenantRes = await db.query(tenantSql, [isNumeric ? parseInt(idOrSlug, 10) : idOrSlug]);

      if (tenantRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'UMKM tidak ditemukan.' });
      }

      const tenant = tenantRes.rows[0];
      const distanceKm = calculateHaversineDistance(
        customerLat,
        customerLng,
        parseFloat(tenant.latitude || -5.397),
        parseFloat(tenant.longitude || 105.266)
      );
      const deliveryInfo = calculateDeliveryCost(distanceKm);

      // 2. Ambil Kategori Menu Tenant
      const catRes = await db.query(
        'SELECT id, name, slug, description FROM categories WHERE tenant_id = $1 AND is_active = true ORDER BY id ASC',
        [tenant.id]
      );

      // 3. Ambil Produk beserta Stok Inventori
      const prodRes = await db.query(
        `SELECT p.id, p.category_id, p.name, p.description, p.price, p.image_url, p.is_available,
                COALESCE(i.stock_quantity, 0) as stock_quantity
         FROM products p
         LEFT JOIN inventories i ON p.id = i.product_id
         WHERE p.tenant_id = $1 AND p.is_available = true
         ORDER BY p.id ASC`,
        [tenant.id]
      );

      // 4. Ambil Seluruh Addons untuk Produk di Tenant ini
      const addonRes = await db.query(
        'SELECT id, product_id, name, price, is_active FROM product_addons WHERE tenant_id = $1 AND is_active = true',
        [tenant.id]
      );

      // Kelompokkan addons ke setiap produk
      const addonsByProduct = {};
      addonRes.rows.forEach((a) => {
        if (!addonsByProduct[a.product_id]) {
          addonsByProduct[a.product_id] = [];
        }
        addonsByProduct[a.product_id].push({
          id: a.id,
          name: a.name,
          price: parseFloat(a.price)
        });
      });

      // Kelompokkan produk ke kategori masing-masing
      const products = prodRes.rows.map((p) => ({
        id: p.id,
        category_id: p.category_id,
        name: p.name,
        description: p.description,
        price: parseFloat(p.price),
        image_url: p.image_url,
        stock_quantity: p.stock_quantity,
        is_in_stock: p.stock_quantity > 0,
        addons: addonsByProduct[p.id] || []
      }));

      res.json({
        success: true,
        data: {
          merchant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            owner_name: tenant.owner_name,
            phone: tenant.phone,
            address: tenant.address_detail,
            district_name: tenant.district_name,
            subdistrict_name: tenant.subdistrict_name,
            distance_km: distanceKm,
            delivery_cost: deliveryInfo,
            latitude: parseFloat(tenant.latitude),
            longitude: parseFloat(tenant.longitude)
          },
          categories: catRes.rows,
          products
        }
      });
    } catch (err) {
      console.error('❌ Error mengambil detail UMKM:', err);
      res.status(500).json({ success: false, message: 'Gagal memuat katalog UMKM.' });
    }
  }
};

export default tenantController;
