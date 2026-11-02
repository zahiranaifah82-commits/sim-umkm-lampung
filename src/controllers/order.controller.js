import db from '../config/db.js';
import { calculateHaversineDistance, calculateDeliveryCost } from '../services/geo.service.js';
import paymentService from '../services/payment.service.js';

export const orderController = {
  /**
   * Alur Checkout Pemesanan Makanan (ShopeeFood Concept)
   * Menggunakan Transaksi Database ACID untuk Menjamin Konsistensi Stok & Perhitungan Harga
   */
  async createOrder(req, res) {
    try {
      const customerId = req.user.id;
      const {
        tenant_id,
        items, // Array: [{ product_id, quantity, selected_addon_ids, item_notes }]
        delivery_address,
        delivery_latitude,
        delivery_longitude,
        payment_method = 'qris',
        order_notes = ''
      } = req.body;

      if (!tenant_id || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Data pesanan tidak lengkap. Minimal harus memilih 1 produk.'
        });
      }

      if (!delivery_address || !delivery_latitude || !delivery_longitude) {
        return res.status(400).json({
          success: false,
          message: 'Alamat tujuan dan titik koordinat GPS pengantaran wajib disertakan.'
        });
      }

      // 1. Eksekusi Atomic Transaction
      const orderResult = await db.transaction(async (trx) => {
        // A. Cek Status Tenant UMKM
        const tenantQuery = await trx.query(
          'SELECT id, name, subscription_status FROM tenants WHERE id = $1',
          [tenant_id]
        );

        if (tenantQuery.rows.length === 0) {
          throw new Error('UMKM tujuan tidak ditemukan.');
        }

        const tenant = tenantQuery.rows[0];
        if (tenant.subscription_status === 'suspended' || tenant.subscription_status === 'expired') {
          throw new Error(`UMKM ${tenant.name} sedang tidak dapat menerima pesanan saat ini.`);
        }

        // B. Ambil Lokasi GPS Merchant Cabang Bandar Lampung
        const locQuery = await trx.query(
          'SELECT latitude, longitude, address_detail FROM merchant_locations WHERE tenant_id = $1 AND is_active = true LIMIT 1',
          [tenant_id]
        );

        if (locQuery.rows.length === 0) {
          throw new Error('Titik koordinat cabang UMKM belum terdaftar.');
        }

        const merchantLoc = locQuery.rows[0];

        // C. Hitung Jarak Haversine & Ongkir Pengantaran
        const distanceKm = calculateHaversineDistance(
          parseFloat(delivery_latitude),
          parseFloat(delivery_longitude),
          parseFloat(merchantLoc.latitude),
          parseFloat(merchantLoc.longitude)
        );

        const deliveryCalculation = calculateDeliveryCost(distanceKm);
        if (!deliveryCalculation.isDeliverable) {
          throw new Error(deliveryCalculation.message);
        }

        // D. Verifikasi & Hitung Setiap Item Pesanan dari Database
        let calculatedSubtotal = 0;
        const verifiedOrderItems = [];

        for (const item of items) {
          const { product_id, quantity, selected_addon_ids = [], item_notes = '' } = item;
          const qty = parseInt(quantity, 10);

          if (!qty || qty <= 0) {
            throw new Error('Kuantitas item harus lebih dari 0.');
          }

          // Query produk & ketersediaan
          const prodQuery = await trx.query(
            `SELECT p.id, p.name, p.price, p.is_available, COALESCE(i.stock_quantity, 0) as stock_quantity
             FROM products p
             LEFT JOIN inventories i ON p.id = i.product_id
             WHERE p.id = $1 AND p.tenant_id = $2`,
            [product_id, tenant_id]
          );

          if (prodQuery.rows.length === 0) {
            throw new Error(`Produk dengan ID ${product_id} tidak valid untuk UMKM ini.`);
          }

          const product = prodQuery.rows[0];
          if (!product.is_available) {
            throw new Error(`Menu "${product.name}" sedang tidak tersedia saat ini.`);
          }

          // Cek Stok Inventori Produk
          if (product.stock_quantity < qty) {
            throw new Error(`Stok menu "${product.name}" tidak mencukupi (Tersisa: ${product.stock_quantity}).`);
          }

          // Kurangi Stok Inventori Otomatis
          await trx.query(
            `UPDATE inventories 
             SET stock_quantity = stock_quantity - $1, last_updated = CURRENT_TIMESTAMP 
             WHERE product_id = $2 AND tenant_id = $3`,
            [qty, product_id, tenant_id]
          );

          // Hitung Addons jika ada
          let addonsTotalUnit = 0;
          const selectedAddonsData = [];

          if (selected_addon_ids && selected_addon_ids.length > 0) {
            for (const addonId of selected_addon_ids) {
              const addonQuery = await trx.query(
                `SELECT id, name, price FROM product_addons 
                 WHERE id = $1 AND product_id = $2 AND tenant_id = $3 AND is_active = true`,
                [addonId, product_id, tenant_id]
              );

              if (addonQuery.rows.length > 0) {
                const add = addonQuery.rows[0];
                const addPrice = parseFloat(add.price);
                addonsTotalUnit += addPrice;
                selectedAddonsData.push({
                  id: add.id,
                  name: add.name,
                  price: addPrice
                });
              }
            }
          }

          const unitPrice = parseFloat(product.price) + addonsTotalUnit;
          const itemSubtotal = unitPrice * qty;
          calculatedSubtotal += itemSubtotal;

          verifiedOrderItems.push({
            product_id,
            product_name: product.name,
            quantity: qty,
            unit_price: unitPrice,
            subtotal: itemSubtotal,
            selected_addons: selectedAddonsData,
            item_notes
          });
        }

        // E. Kalkulasi Total Akhir
        const deliveryFee = deliveryCalculation.deliveryFee;
        const serviceFee = deliveryCalculation.serviceFee;
        const grandTotal = calculatedSubtotal + deliveryFee + serviceFee;

        // F. Generate Nomor Order Unik (Contoh: BDL-20261102-8492)
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const orderNumber = `BDL-${dateStr}-${randomDigits}`;

        // G. Simpan ke Tabel orders
        const insertOrderSql = `
          INSERT INTO orders (
            tenant_id, customer_id, courier_id, order_number, status,
            delivery_address, delivery_latitude, delivery_longitude, distance_km,
            subtotal, delivery_fee, service_fee, total_amount, notes
          ) VALUES ($1, $2, NULL, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
        `;

        const orderInsertRes = await trx.query(insertOrderSql, [
          tenant_id,
          customerId,
          orderNumber,
          delivery_address,
          delivery_latitude,
          delivery_longitude,
          distanceKm,
          calculatedSubtotal,
          deliveryFee,
          serviceFee,
          grandTotal,
          order_notes
        ]);

        const orderId = orderInsertRes.rows[0]?.id || orderInsertRes.lastID;

        // H. Simpan ke Tabel order_items
        for (const oi of verifiedOrderItems) {
          await trx.query(
            `INSERT INTO order_items (
              order_id, product_id, quantity, unit_price, subtotal, selected_addons, item_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              orderId,
              oi.product_id,
              oi.quantity,
              oi.unit_price,
              oi.subtotal,
              JSON.stringify(oi.selected_addons),
              oi.item_notes
            ]
          );
        }

        // I. Inisialisasi Transaksi Pembayaran di Tabel payments
        const paymentPayload = await paymentService.createPayment({
          orderId,
          tenantId: tenant_id,
          amount: grandTotal,
          paymentMethod: payment_method
        });

        await trx.query(
          `INSERT INTO payments (
            order_id, tenant_id, payment_method, payment_status, amount, transaction_id, payment_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            orderId,
            tenant_id,
            paymentPayload.paymentMethod,
            paymentPayload.paymentStatus,
            paymentPayload.amount,
            paymentPayload.transactionId,
            paymentPayload.paymentUrl
          ]
        );

        return {
          order_id: orderId,
          order_number: orderNumber,
          tenant_name: tenant.name,
          distance_km: distanceKm,
          subtotal: calculatedSubtotal,
          delivery_fee: deliveryFee,
          service_fee: serviceFee,
          total_amount: grandTotal,
          payment: paymentPayload,
          items: verifiedOrderItems
        };
      });

      res.status(201).json({
        success: true,
        message: 'Pesanan berhasil dibuat. Silakan lakukan pembayaran.',
        data: orderResult
      });
    } catch (err) {
      console.error('❌ Gagal membuat order checkout:', err.message);
      res.status(400).json({
        success: false,
        message: err.message || 'Terjadi kesalahan saat memproses pesanan.'
      });
    }
  },

  /**
   * Pelacakan Status Pesanan Real-Time (ShopeeFood Tracking Timeline)
   */
  async trackOrder(req, res) {
    try {
      const { id } = req.params;

      const orderSql = `
        SELECT o.id, o.order_number, o.status, o.delivery_address, 
               o.delivery_latitude, o.delivery_longitude, o.distance_km,
               o.subtotal, o.delivery_fee, o.service_fee, o.total_amount, o.notes,
               o.created_at, o.updated_at,
               t.name as tenant_name, t.phone as tenant_phone,
               ml.address_detail as merchant_address, ml.latitude as merchant_lat, ml.longitude as merchant_lng,
               c.name as courier_name, c.phone as courier_phone,
               p.payment_method, p.payment_status, p.payment_url, p.amount as payment_amount
        FROM orders o
        JOIN tenants t ON o.tenant_id = t.id
        LEFT JOIN merchant_locations ml ON t.id = ml.tenant_id
        LEFT JOIN users c ON o.courier_id = c.id
        LEFT JOIN payments p ON o.id = p.order_id
        WHERE o.id = $1
      `;

      const orderRes = await db.query(orderSql, [id]);

      if (orderRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
      }

      const order = orderRes.rows[0];

      // Ambil Rincian Item Pesanan
      const itemsRes = await db.query(
        `SELECT oi.id, oi.product_id, p.name as product_name, oi.quantity, 
                oi.unit_price, oi.subtotal, oi.selected_addons, oi.item_notes
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [id]
      );

      const items = itemsRes.rows.map((item) => ({
        ...item,
        unit_price: parseFloat(item.unit_price),
        subtotal: parseFloat(item.subtotal),
        selected_addons:
          typeof item.selected_addons === 'string'
            ? JSON.parse(item.selected_addons || '[]')
            : item.selected_addons || []
      }));

      // Timeline tahapan status ShopeeFood
      const orderStages = [
        { key: 'pending', title: 'Menunggu Pembayaran / Konfirmasi', icon: 'credit-card' },
        { key: 'confirmed', title: 'Pesanan Dikonfirmasi Resto', icon: 'check-circle' },
        { key: 'cooking', title: 'Makanan Sedang Dimasak', icon: 'cooking-pot' },
        { key: 'ready_for_pickup', title: 'Siap Diambil Kurir', icon: 'package' },
        { key: 'on_delivery', title: 'Kurir Menuju Lokasi Anda', icon: 'moped' },
        { key: 'completed', title: 'Pesanan Telah Tiba & Selesai', icon: 'house' }
      ];

      const currentStageIndex = orderStages.findIndex((s) => s.key === order.status);

      res.json({
        success: true,
        data: {
          order: {
            ...order,
            distance_km: parseFloat(order.distance_km),
            subtotal: parseFloat(order.subtotal),
            delivery_fee: parseFloat(order.delivery_fee),
            service_fee: parseFloat(order.service_fee),
            total_amount: parseFloat(order.total_amount),
            merchant_lat: parseFloat(order.merchant_lat),
            merchant_lng: parseFloat(order.merchant_lng),
            delivery_latitude: parseFloat(order.delivery_latitude),
            delivery_longitude: parseFloat(order.delivery_longitude)
          },
          items,
          timeline: {
            current_status: order.status,
            current_stage_index: currentStageIndex !== -1 ? currentStageIndex : 0,
            stages: orderStages
          }
        }
      });
    } catch (err) {
      console.error('❌ Error melacak pesanan:', err);
      res.status(500).json({ success: false, message: 'Gagal memuat status pelacakan pesanan.' });
    }
  },

  /**
   * Simulasi Pembayaran Sukses (Testing QRIS / Gateway Webhook)
   */
  async simulatePaymentSuccess(req, res) {
    try {
      const { id } = req.params;

      await db.query(
        `UPDATE payments 
         SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE order_id = $1`,
        [id]
      );

      await db.query(
        `UPDATE orders 
         SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND status = 'pending'`,
        [id]
      );

      res.json({
        success: true,
        message: 'Simulasi pembayaran berhasil diverifikasi. Pesanan diteruskan ke dapur UMKM.'
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Gagal memproses simulasi pembayaran.' });
    }
  },

  /**
   * Riwayat Pesanan Customer
   */
  async getMyOrders(req, res) {
    try {
      const customerId = req.user.id;
      const ordersRes = await db.query(
        `SELECT o.id, o.order_number, o.status, o.total_amount, o.distance_km, o.created_at,
                t.name as tenant_name
         FROM orders o
         JOIN tenants t ON o.tenant_id = t.id
         WHERE o.customer_id = $1
         ORDER BY o.created_at DESC`,
        [customerId]
      );

      res.json({
        success: true,
        data: ordersRes.rows
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Gagal memuat riwayat pesanan.' });
    }
  }
};

export default orderController;
