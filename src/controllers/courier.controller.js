import db from '../config/db.js';

export const courierController = {
  /**
   * Menampilkan Daftar Pesanan Siap Antar (status: ready_for_pickup)
   */
  async getAvailableOrders(req, res) {
    try {
      const sql = `
        SELECT o.id, o.order_number, o.status, o.delivery_address, o.distance_km,
               o.delivery_fee, o.total_amount, o.notes, o.created_at,
               t.name as tenant_name, t.phone as tenant_phone,
               ml.address_detail as merchant_address, ml.latitude as merchant_lat, ml.longitude as merchant_lng,
               o.delivery_latitude, o.delivery_longitude,
               u.name as customer_name, u.phone as customer_phone
        FROM orders o
        JOIN tenants t ON o.tenant_id = t.id
        LEFT JOIN merchant_locations ml ON t.id = ml.tenant_id
        JOIN users u ON o.customer_id = u.id
        WHERE o.status = 'ready_for_pickup'
        ORDER BY o.created_at ASC
      `;

      const result = await db.query(sql);

      res.json({
        success: true,
        data: result.rows.map((r) => ({
          ...r,
          distance_km: parseFloat(r.distance_km),
          delivery_fee: parseFloat(r.delivery_fee),
          total_amount: parseFloat(r.total_amount),
          merchant_lat: parseFloat(r.merchant_lat),
          merchant_lng: parseFloat(r.merchant_lng),
          delivery_latitude: parseFloat(r.delivery_latitude),
          delivery_longitude: parseFloat(r.delivery_longitude)
        }))
      });
    } catch (err) {
      console.error('❌ Error mengambil pesanan untuk kurir:', err);
      res.status(500).json({ success: false, message: 'Gagal memuat daftar pesanan kurir.' });
    }
  },

  /**
   * Kurir Mengambil & Mengunci Pesanan untuk Diantar (on_delivery)
   */
  async claimOrder(req, res) {
    try {
      const courierId = req.user.id;
      const { id } = req.params;

      const orderCheck = await db.query(
        'SELECT id, status FROM orders WHERE id = $1',
        [id]
      );

      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
      }

      if (orderCheck.rows[0].status !== 'ready_for_pickup') {
        return res.status(400).json({
          success: false,
          message: 'Pesanan ini tidak dalam status siap diantar atau sudah diambil kurir lain.'
        });
      }

      await db.query(
        `UPDATE orders 
         SET courier_id = $1, status = 'on_delivery', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [courierId, id]
      );

      res.json({
        success: true,
        message: 'Pesanan berhasil diambil! Silakan mulai pengantaran ke alamat pelanggan.'
      });
    } catch (err) {
      console.error('❌ Error claim pesanan:', err);
      res.status(500).json({ success: false, message: 'Gagal mengambil pesanan.' });
    }
  },

  /**
   * Kurir Menyelesaikan Pengantaran (status: completed)
   * Otomatis Mencatat Pendapatan ke Buku Kas (Transactions Ledger) UMKM
   */
  async completeDelivery(req, res) {
    try {
      const courierId = req.user.id;
      const { id } = req.params;

      const result = await db.transaction(async (trx) => {
        const orderRes = await trx.query(
          `SELECT o.id, o.tenant_id, o.order_number, o.status, o.subtotal, o.total_amount,
                  p.payment_method, p.payment_status
           FROM orders o
           LEFT JOIN payments p ON o.id = p.order_id
           WHERE o.id = $1 AND o.courier_id = $2`,
          [id, courierId]
        );

        if (orderRes.rows.length === 0) {
          throw new Error('Pesanan tidak ditemukan atau bukan milik pengantaran Anda.');
        }

        const order = orderRes.rows[0];
        if (order.status !== 'on_delivery') {
          throw new Error('Pesanan tidak dalam status pengantaran.');
        }

        // Update status order menjadi completed
        await trx.query(
          `UPDATE orders 
           SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [id]
        );

        // Jika metode pembayaran Tunai (COD), update payment menjadi paid
        if (order.payment_status !== 'paid') {
          await trx.query(
            `UPDATE payments 
             SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
             WHERE order_id = $1`,
            [id]
          );
        }

        // Catat Otomatis ke Buku Kas UMKM (Transactions Ledger)
        const subtotalAmount = parseFloat(order.subtotal);
        await trx.query(
          `INSERT INTO transactions_ledger (
            tenant_id, order_id, type, amount, description, reference_number
          ) VALUES ($1, $2, 'income', $3, $4, $5)`,
          [
            order.tenant_id,
            order.id,
            subtotalAmount,
            `Pendapatan Pesanan Selesai #${order.order_number}`,
            order.order_number
          ]
        );

        return order;
      });

      res.json({
        success: true,
        message: 'Pengantaran sukses diselesaikan! Pendapatan telah dibukukan ke UMKM.',
        data: result
      });
    } catch (err) {
      console.error('❌ Error menyelesaikan pengantaran:', err.message);
      res.status(400).json({ success: false, message: err.message || 'Gagal menyelesaikan pengantaran.' });
    }
  },

  /**
   * Daftar Pengantaran Aktif Milik Kurir
   */
  async getMyDeliveries(req, res) {
    try {
      const courierId = req.user.id;
      const sql = `
        SELECT o.id, o.order_number, o.status, o.delivery_address, o.distance_km,
               o.delivery_fee, o.total_amount, o.notes, o.created_at,
               t.name as tenant_name, t.phone as tenant_phone,
               ml.address_detail as merchant_address,
               u.name as customer_name, u.phone as customer_phone
        FROM orders o
        JOIN tenants t ON o.tenant_id = t.id
        LEFT JOIN merchant_locations ml ON t.id = ml.tenant_id
        JOIN users u ON o.customer_id = u.id
        WHERE o.courier_id = $1
        ORDER BY o.updated_at DESC
      `;

      const result = await db.query(sql, [courierId]);

      res.json({ success: true, data: result.rows });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Gagal memuat pengantaran saya.' });
    }
  }
};

export default courierController;
