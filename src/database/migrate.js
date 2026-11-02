import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('🚀 [Migration] Memulai inisialisasi skema database...');

  if (db.isPostgres) {
    const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf-8');
    await db.query(sql);
    console.log('✅ [Migration] PostgreSQL Schema berhasil dieksekusi.');
  } else {
    // Skema DDL khusus SQLite untuk pengujian lokal instan
    const sqliteDDL = `
      CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        owner_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'suspended', 'expired')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('super_admin', 'tenant_admin', 'staff', 'courier', 'customer')),
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS districts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        district_name TEXT NOT NULL,
        subdistrict_name TEXT NOT NULL,
        postal_code TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS merchant_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        district_id INTEGER REFERENCES districts(id) ON DELETE SET NULL,
        address_detail TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, slug)
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        image_url TEXT,
        is_available INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS product_addons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0.00,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        customer_id INTEGER NOT NULL REFERENCES users(id),
        courier_id INTEGER REFERENCES users(id),
        order_number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cooking', 'ready_for_pickup', 'on_delivery', 'completed', 'cancelled')),
        delivery_address TEXT NOT NULL,
        delivery_latitude REAL NOT NULL,
        delivery_longitude REAL NOT NULL,
        distance_km REAL NOT NULL DEFAULT 0.00,
        subtotal REAL NOT NULL,
        delivery_fee REAL NOT NULL,
        service_fee REAL NOT NULL DEFAULT 2000.00,
        total_amount REAL NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        selected_addons TEXT,
        item_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS inventories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        min_stock_alert INTEGER NOT NULL DEFAULT 5,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        reference_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        payment_method TEXT NOT NULL CHECK (payment_method IN ('qris', 'midtrans', 'xendit', 'cash', 'bank_transfer')),
        payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),
        amount REAL NOT NULL,
        transaction_id TEXT,
        payment_url TEXT,
        paid_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Split and execute each statement
    const statements = sqliteDDL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await db.query(stmt);
    }
    console.log('✅ [Migration] SQLite local schema berhasil dibuat.');
  }

  // Cek apakah data seed perlu dimasukkan
  const checkTenants = await db.query('SELECT COUNT(*) as cnt FROM tenants');
  const count = parseInt(checkTenants.rows[0].cnt || checkTenants.rows[0].count || 0, 10);

  if (count === 0) {
    console.log('🌱 [Seeder] Menyuntikkan data awal Kota Bandar Lampung & UMKM...');
    await seedInitialData();
  } else {
    console.log(`ℹ️ [Seeder] Database sudah berisi ${count} tenant. Melewati seeding otomatis.`);
  }
}

export async function seedInitialData() {
  const defaultPassword = await bcrypt.hash('password123', 10);

  // 1. Districts Bandar Lampung
  const districts = [
    ['Way Halim', 'Way Halim Permai', '35141'],
    ['Way Halim', 'Perumnas Way Halim', '35141'],
    ['Kedaton', 'Kedaton', '35145'],
    ['Kedaton', 'Sukamenanti', '35146'],
    ['Sukarame', 'Sukarame', '35131'],
    ['Sukarame', 'Way Dadi', '35131'],
    ['Teluk Betung Selatan', 'Pesawahan', '35223'],
    ['Teluk Betung Utara', 'Kupang Kota', '35211'],
    ['Tanjung Karang Pusat', 'Palapa', '35116'],
    ['Tanjung Karang Pusat', 'Pasir Gintung', '35113'],
    ['Kemiling', 'Kemiling Permai', '35153'],
    ['Rajabasa', 'Rajabasa Nunyai', '35144'],
    ['Enggal', 'Enggal', '35118']
  ];

  for (const d of districts) {
    await db.query(
      'INSERT INTO districts (district_name, subdistrict_name, postal_code) VALUES ($1, $2, $3)',
      d
    );
  }

  // 2. Tenants (UMKM)
  const tenants = [
    ['Pempek 123 Asli Lampung', 'pempek-123-lampung', 'Hj. Rosdiana', '081272001122', 'info@pempek123.com', 'active'],
    ['Kopi Ketje Way Halim', 'kopi-ketje-wayhalim', 'Rian Sanjaya', '081379112233', 'admin@kopiketje.com', 'active'],
    ['Ayam Bakar & Sambal Seruit Bu Lin', 'sambal-seruit-bu-lin', 'Ibu Herlina', '085269445566', 'pemilik@sambalseruit.com', 'active'],
    ['Bebek Sinjay Raden Intan', 'bebek-sinjay-radenintan', 'Bambang Irawan', '082188776655', 'kontak@bebeksinjay.com', 'trial']
  ];

  for (const t of tenants) {
    await db.query(
      'INSERT INTO tenants (name, slug, owner_name, phone, email, subscription_status) VALUES ($1, $2, $3, $4, $5, $6)',
      t
    );
  }

  // 3. Users
  const users = [
    // Super Admin
    [null, 'Super Administrator BDL', 'superadmin@lampungfood.id', defaultPassword, 'super_admin', '08117200001'],
    // Tenant Admins
    [1, 'Admin Pempek 123', 'admin@pempek123.com', defaultPassword, 'tenant_admin', '081272001122'],
    [2, 'Admin Kopi Ketje', 'admin@kopiketje.com', defaultPassword, 'tenant_admin', '081379112233'],
    [3, 'Admin Seruit Bu Lin', 'admin@sambalseruit.com', defaultPassword, 'tenant_admin', '085269445566'],
    [4, 'Admin Bebek Sinjay', 'admin@bebeksinjay.com', defaultPassword, 'tenant_admin', '082188776655'],
    // Couriers
    [null, 'Wayan Kurniawan (Kurir)', 'kurir.wayan@lampungfood.id', defaultPassword, 'courier', '089611223344'],
    [null, 'Agus Prasetyo (Kurir)', 'kurir.agus@lampungfood.id', defaultPassword, 'courier', '089655667788'],
    // Customers
    [null, 'Budi Santoso', 'budi@gmail.com', defaultPassword, 'customer', '081299887766'],
    [null, 'Siti Aminah', 'siti@gmail.com', defaultPassword, 'customer', '081388776655']
  ];

  for (const u of users) {
    await db.query(
      'INSERT INTO users (tenant_id, name, email, password, role, phone) VALUES ($1, $2, $3, $4, $5, $6)',
      u
    );
  }

  // 4. Merchant Locations (Bandar Lampung GPS Coordinates)
  const locations = [
    [1, 7, 'Jl. Ikan Hiu No. 12, Pesawahan, Teluk Betung', -5.4485000, 105.2638000],
    [2, 1, 'Jl. Kimaja No. 45, Way Halim Permai', -5.3852000, 105.2754000],
    [3, 3, 'Jl. Teuku Umar No. 88, Kedaton (Dekat Pasar Koga)', -5.3789000, 105.2571000],
    [4, 9, 'Jl. Raden Intan No. 102, Tj. Karang Pusat', -5.4124000, 105.2583000]
  ];

  for (const loc of locations) {
    await db.query(
      'INSERT INTO merchant_locations (tenant_id, district_id, address_detail, latitude, longitude, is_active) VALUES ($1, $2, $3, $4, $5, 1)',
      loc
    );
  }

  // 5. Categories
  const categories = [
    [1, 'Paket Pempek Komplit', 'paket-pempek', 'Pempek ikan tenggiri asli dengan cuko hitam khas'],
    [1, 'Minuman Segar', 'minuman-segar', 'Es kacang merah dan jus buah'],
    [2, 'Espresso & Signature Robusta', 'signature-coffee', 'Kopi Robusta Lampung pilihan'],
    [2, 'Toast & Kudapan', 'snack-toast', 'Roti panggang aneka rasa'],
    [3, 'Menu Paket Seruit', 'paket-seruit', 'Paket nasi, ikan/ayam dengan sambal seruit tempoyak'],
    [4, 'Bebek & Ayam Bumbu Madura', 'bebek-ayam', 'Olahan bebek empuk gurih rempah serundeng']
  ];

  for (const c of categories) {
    await db.query(
      'INSERT INTO categories (tenant_id, name, slug, description) VALUES ($1, $2, $3, $4)',
      c
    );
  }

  // 6. Products
  const products = [
    [1, 1, 'Paket Pempek Campur (10 Pcs)', 'Isi 2 Kapal Selam kecil, 3 Lenjer, 3 Adaan, 2 Kulit + Cuko Pedas', 45000, 'https://images.unsplash.com/photo-1628294895950-9805252327bc?w=500'],
    [1, 1, 'Pempek Kapal Selam Jumbo', 'Pempek isi telur bebek utuh dengan kerenyahan kulit luar', 22000, 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=500'],
    [1, 2, 'Es Kacang Merah Khas Lampung', 'Kacang merah empuk manis berpadu susu kental manis dan serutan es', 15000, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500'],
    [2, 3, 'Kopi Susu Gula Aren Lampung', 'Espresso Robusta Tanggamus dipadu susu creamy dan gula aren asli', 18000, 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500'],
    [2, 3, 'Ice Americano Ulubelu', 'Kopi hitam dingin segar dengan aroma nutty khas Lampung Barat', 15000, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500'],
    [2, 4, 'Roti Panggang Cokelat Keju Melt', 'Roti brioche bakar dengan keju cheddar gurih dan saus cokelat lumer', 16000, 'https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=500'],
    [3, 5, 'Paket Nasi Seruit Ikan Baung', 'Nasi putih, Ikan Baung bakar, Sambal Seruit Tempoyak mangga & Lalapan komplit', 38000, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'],
    [3, 5, 'Paket Ayam Bakar Madu Seruit', 'Ayam bakar madu legit disajikan dengan cocolan sambal seruit terasi khas pesisir', 30000, 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500'],
    [4, 6, 'Bebek Goreng Kremes Crispy + Nasi', 'Bebek empuk bumbu rempah kuning dengan taburan serundeng kremes', 35000, 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=500']
  ];

  for (const p of products) {
    const res = await db.query(
      'INSERT INTO products (tenant_id, category_id, name, description, price, image_url, is_available) VALUES ($1, $2, $3, $4, $5, $6, 1)',
      p
    );
    const prodId = res.rows[0]?.id || res.lastID;

    // Tambah inventory awal
    await db.query(
      'INSERT INTO inventories (tenant_id, product_id, stock_quantity, min_stock_alert) VALUES ($1, $2, $3, $4)',
      [p[0], prodId, 50, 10]
    );
  }

  // 7. Product Addons
  const addons = [
    [1, 1, 'Ekstra Cuko Hitam Pedas (100ml)', 5000],
    [1, 1, 'Ekstra Timun & Ebi Kering Bubuk', 3000],
    [1, 2, 'Cuko Ekstra Pedas Mantap', 3000],
    [2, 4, 'Extra Shot Espresso Robusta', 4000],
    [2, 4, 'Ganti Susu Oatmilk', 6000],
    [2, 6, 'Ekstra Keju Mozzarella Melt', 5000],
    [3, 7, 'Level Pedas: Sangat Pedas (Cabai Rawit)', 0],
    [3, 7, 'Tambah Tempoyak Durian Asli', 5000],
    [3, 7, 'Nasi Putih Ekstra 1 Porsi', 5000],
    [4, 9, 'Ekstra Sambal Ijo Bumbu Bebek', 4000]
  ];

  for (const a of addons) {
    await db.query(
      'INSERT INTO product_addons (tenant_id, product_id, name, price, is_active) VALUES ($1, $2, $3, $4, 1)',
      a
    );
  }

  // 8. Financial Ledger Initial Entry
  await db.query(
    'INSERT INTO transactions_ledger (tenant_id, type, amount, description, reference_number) VALUES ($1, $2, $3, $4, $5)',
    [1, 'income', 500000, 'Saldo Kas Awal Outlet Teluk Betung', 'INIT-001']
  );
  await db.query(
    'INSERT INTO transactions_ledger (tenant_id, type, amount, description, reference_number) VALUES ($1, $2, $3, $4, $5)',
    [2, 'income', 750000, 'Kas Awal Harian Outlet Way Halim', 'INIT-002']
  );
  await db.query(
    'INSERT INTO transactions_ledger (tenant_id, type, amount, description, reference_number) VALUES ($1, $2, $3, $4, $5)',
    [3, 'income', 600000, 'Kas Awal Harian Outlet Kedaton', 'INIT-003']
  );

  console.log('✅ [Seeder] Seeding data Kota Bandar Lampung selesai! Akun uji coba:');
  console.log('   - Super Admin: superadmin@lampungfood.id / password123');
  console.log('   - Tenant Admin: admin@pempek123.com / password123 (Tenant ID: 1)');
  console.log('   - Kurir: kurir.wayan@lampungfood.id / password123');
  console.log('   - Customer: budi@gmail.com / password123');
}

// Eksekusi jika dijalankan secara langsung via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      console.log('🏁 Migrasi & seeding selesai.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Gagal menjalankan migrasi:', err);
      process.exit(1);
    });
}
