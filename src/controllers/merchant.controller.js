import db from '../config/db.js';

export const merchantController = {
  /**
   * Ringkasan Dashboard UMKM (Revenue Hari Ini, Pesanan Aktif, Alert Stok Rendah)
   */
  async getDashboardOverview(req, res) {
    try {
      const tenantId = req.tenantId;

      // 1. Total Penjualan & Pendapatan Hari Ini
      const revenueQuery = await db.query(
        `SELECT COUNT(id) as total_orders_today,
                COALESCE(SUM(subtotal), 0) as today_revenue
         FROM orders 
         WHERE tenant_id = $1 
           AND status = 'completed'
           AND DATE(created_at) = CURRENT_DATE`,
        [tenantId]
      );

      // 2. Pesanan Masuk yang Butuh Tindakan (pending, confirmed, cooking)
      const activeOrdersQuery = await db.query(
        `SELECT COUNT(id) as active_count
         FROM orders 
         WHERE tenant_id = $1 
           AND status IN ('pending', 'confirmed', 'cooking')`,
        [tenantId]
      );

      // 3. Peringatan Stok Menipis (inventories.stock_quantity <= min_stock_alert)
      const lowStockQuery = await db.query(
        `SELECT p.id, p.name, i.stock_quantity, i.min_stock_alert
         FROM inventories i
         JOIN products p ON i.product_id = p.id
         WHERE i.tenant_id = $1 
           AND i.stock_quantity <= i.min_stock_alert`,
        [tenantId]
      );

      // 4. Saldo Buku Kas Saat Ini (Transactions Ledger)
      const ledgerQuery = await db.query(
        `SELECT 
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as current_balance
         FROM transactions_ledger
         WHERE tenant_id = $1`,
        [tenantId]
      );

      // 5. Pesanan Terbaru
      const recentOrders = await db.query(
        `SELECT id, order_number, status, total_amount, created_at
         FROM orders 
         WHERE tenant_id = $1
         ORDER BY created_at DESC LIMIT 5`,
        [tenantId]
      );

      res.json({
        success: true,
        data: {
          tenant_name: req.tenant.name,
          subscription_status: req.tenant.subscription_status,
          today_revenue: parseFloat(revenueQuery.rows[0].today_revenue),
          total_orders_today: parseInt(revenueQuery.rows[0].total_orders_today, 10),
          active_orders_count: parseInt(activeOrdersQuery.rows[0].active_count, 10),
          current_cash_balance: parseFloat(ledgerQuery.rows[0].current_balance),
          low_stock_alerts: lowStockQuery.rows,
          recent_orders: recentOrders.rows
        }
      });
    } catch (err) {
      console.error('❌ Error dashboard UMKM:', err);
      res.status(500).json({ success: false, message: 'Gagal memuat statistik dashboard UMKM.' });
    }
  },

  /**
   * Manajemen Pesanan Masuk (Realtime Kitchen View)
   */
  async getOrders(req, res) {
    try {
      const tenantId = req.tenantId;
      const { status } = req.query;

      let sql = `
        SELECT o.id, o.order_number, o.status, o.subtotal, o.delivery_fee, o.total_amount,
               o.delivery_address, o.notes, o.created_at,
               u.name as customer_name, u.phone as customer_phone,
               p.payment_method, p.payment_status
        FROM orders o
        JOIN users u ON o.customer_id = u.id
        LEFT JOIN payments p ON o.id = p.order_id
        WHERE o.tenant_id = $1
      `;

      const params = [tenantId];
      if (status) {
        params.push(status);
        sql += ` AND o.status = $${params.length}`;
      }

      sql += ` ORDER BY o.created_at DESC`;

      const ordersRes = await db.query(sql, params);

      // Ambil items untuk setiap order
      const orders = [];
      for (const ord of ordersRes.rows) {
        const itemsRes = await db.query(
          `SELECT oi.id, oi.quantity, oi.unit_price, oi.subtotal, oi.selected_addons, oi.item_notes,
                  p.name as product_name
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1`,
          [ord.id]
        );

        orders.push({
          ...ord,
          subtotal: parseFloat(ord.subtotal),
          total_amount: parseFloat(ord.total_amount),
          items: itemsRes.rows.map((it) => ({
            ...it,
            selected_addons:
              typeof it.selected_addons === 'string'
                ? JSON.parse(it.selected_addons || '[]')
                : it.selected_addons || []
          }))
        });
      }

      res.json({ success: true, data: orders });
    } catch (err) {
      console.error('❌ Error mengambil pesanan UMKM:', err);
      res.status(500).json({ success: false, message: 'Gagal memuat pesanan UMKM.' });
    }
  },

  /**
   * Mengubah Status Pesanan oleh Resto (confirmed, cooking, ready_for_pickup)
   */
  async updateOrderStatus(req, res) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;
      const { status } = req.body;

      const allowedTransitions = ['confirmed', 'cooking', 'ready_for_pickup', 'cancelled'];
      if (!allowedTransitions.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status tidak valid. Pilihan yang diizinkan: ${allowedTransitions.join(', ')}`
        });
      }

      // Pastikan order milik tenant ini
      const checkOrder = await db.query(
        'SELECT id, status, subtotal FROM orders WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );

      if (checkOrder.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan pada UMKM ini.' });
      }

      await db.query(
        'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
        [status, id, tenantId]
      );

      res.json({
        success: true,
        message: `Status pesanan #${id} berhasil diubah menjadi '${status}'.`
      });
    } catch (err) {
      console.error('❌ Error memperbarui status order:', err);
      res.status(500).json({ success: false, message: 'Gagal memperbarui status pesanan.' });
    }
  },

  /**
   * Manajemen Katalog Produk (CRUD Produk UMKM)
   */
  async getProducts(req, res) {
    try {
      const tenantId = req.tenantId;
      const productsRes = await db.query(
        `SELECT p.id, p.name, p.description, p.price, p.image_url, p.is_available,
                c.name as category_name, c.id as category_id,
                COALESCE(i.stock_quantity, 0) as stock_quantity,
                COALESCE(i.min_stock_alert, 5) as min_stock_alert
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN inventories i ON p.id = i.product_id
         WHERE p.tenant_id = $1
         ORDER BY p.id DESC`,
        [tenantId]
      );

      res.json({ success: true, data: productsRes.rows });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Gagal mengambil produk.' });
    }
  },

  async createProduct(req, res) {
    try {
      const tenantId = req.tenantId;
      const { name, category_id, description, price, image_url, initial_stock = 20, min_stock_alert = 5 } = req.body;

      if (!name || !price) {
        return res.status(400).json({ success: false, message: 'Nama dan harga menu wajib diisi.' });
      }

      const insertRes = await db.query(
        `INSERT INTO products (tenant_id, category_id, name, description, price, image_url, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
        [tenantId, category_id || null, name, description || '', price, image_url || '']
      );

      const productId = insertRes.rows[0]?.id || insertRes.lastID;

      // Inisialisasi inventori stok
      await db.query(
        `INSERT INTO inventories (tenant_id, product_id, stock_quantity, min_stock_alert)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, productId, initial_stock, min_stock_alert]
      );

      res.status(201).json({
        success: true,
        message: 'Menu berhasil ditambahkan ke katalog UMKM.',
        data: { id: productId, name, price }
      });
    } catch (err) {
      console.error('❌ Error tambah produk:', err);
      res.status(500).json({ success: false, message: 'Gagal menambahkan produk baru.' });
    }
  },

  /**
   * Manajemen Stok Inventori
   */
  async updateStock(req, res) {
    try {
      const tenantId = req.tenantId;
      const { productId } = req.params;
      const { stock_quantity, min_stock_alert } = req.body;

      await db.query(
        `UPDATE inventories 
         SET stock_quantity = COALESCE($1, stock_quantity),
             min_stock_alert = COALESCE($2, min_stock_alert),
             last_updated = CURRENT_TIMESTAMP
         WHERE product_id = $3 AND tenant_id = $4`,
        [stock_quantity, min_stock_alert, productId, tenantId]
      );

      res.json({ success: true, message: 'Stok inventori berhasil diperbarui.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Gagal mengubah stok produk.' });
    }
  },

  /**
   * Modul Pembukuan Keuangan Mini (Transactions Ledger: Income/Expense)
   */
  async getLedger(req, res) {
    try {
      const tenantId = req.tenantId;
      const ledgerRes = await db.query(
        `SELECT id, order_id, type, amount, description, reference_number, created_at
         FROM transactions_ledger
         WHERE tenant_id = $1
         ORDER BY created_at DESC`,
        [tenantId]
      );

      // Hitung akumulasi
      let totalIncome = 0;
      let totalExpense = 0;

      ledgerRes.rows.forEach((r) => {
        const amt = parseFloat(r.amount);
        if (r.type === 'income') totalIncome += amt;
        if (r.type === 'expense') totalExpense += amt;
      });

      res.json({
        success: true,
        data: {
          total_income: totalIncome,
          total_expense: totalExpense,
          net_balance: totalIncome - totalExpense,
          entries: ledgerRes.rows
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Gagal memuat buku kas UMKM.' });
    }
  },

  async addExpense(req, res) {
    try {
      const tenantId = req.tenantId;
      const { amount, description, reference_number } = req.body;

      if (!amount || !description) {
        return res.status(400).json({
          success: false,
          message: 'Nominal pengeluaran dan keterangan wajib diisi.'
        });
      }

      await db.query(
        `INSERT INTO transactions_ledger (tenant_id, order_id, type, amount, description, reference_number)
         VALUES ($1, NULL, 'expense', $2, $3, $4)`,
        [tenantId, amount, description, reference_number || `EXP-${Date.now()}`]
      );

      res.status(201).json({
        success: true,
        message: 'Catatan pengeluaran operasional berhasil disimpan di buku kas.'
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Gagal mencatat pengeluaran.' });
    }
  }
};

export default merchantController;
