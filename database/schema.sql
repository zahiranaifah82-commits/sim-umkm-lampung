-- ============================================================================
-- SISTEM INFORMASI MANAJEMEN (SIM) UMKM MULTITENANT BERBASIS WEB (SHOPEEFOOD)
-- CAKUPAN WILAYAH: KOTA BANDAR LAMPUNG
-- MODEL ISOLASI: Shared Database, Shared Schema dengan tenant_id
-- COMPATIBLE: PostgreSQL (Supabase, Neon, Railway, Render)
-- ============================================================================

-- 1. TABEL: tenants (Profil UMKM / Merchant)
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(160) NOT NULL UNIQUE,
    owner_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'trial' 
        CHECK (subscription_status IN ('trial', 'active', 'suspended', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(subscription_status);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- 2. TABEL: users (Multi-Role User Management)
-- tenant_id bernilai NULL khusus role 'super_admin' & 'customer'
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL 
        CHECK (role IN ('super_admin', 'tenant_admin', 'staff', 'courier', 'customer')),
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 3. TABEL: districts (Referensi Wilayah Kecamatan & Kelurahan Kota Bandar Lampung)
CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    district_name VARCHAR(100) NOT NULL,     -- Contoh: Way Halim, Kedaton, Teluk Betung
    subdistrict_name VARCHAR(100) NOT NULL,  -- Contoh: Way Halim Permai, Sukamenanti
    postal_code VARCHAR(10) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_districts_name ON districts(district_name);

-- 4. TABEL: merchant_locations (Koordinat GPS Cabang UMKM untuk radius Haversine)
CREATE TABLE IF NOT EXISTS merchant_locations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    district_id INTEGER REFERENCES districts(id) ON DELETE SET NULL,
    address_detail TEXT NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,        -- Contoh koordinat BDL: -5.397140
    longitude DECIMAL(10, 7) NOT NULL,       -- Contoh koordinat BDL: 105.266792
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_merchant_loc_tenant ON merchant_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_loc_geo ON merchant_locations(latitude, longitude);

-- 5. TABEL: categories (Kategori Menu Makanan / Minuman per Tenant)
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);

-- 6. TABEL: products (Katalog Menu Makanan / Minuman)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_tenant_avail ON products(tenant_id, is_available);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- 7. TABEL: product_addons (Kustomisasi Menu ala ShopeeFood: Level Pedas, Extra Keju, dll.)
CREATE TABLE IF NOT EXISTS product_addons (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,              -- Contoh: Level Pedas 3, Extra Sambal Seruit, Keju Melt
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_addons_product ON product_addons(product_id);
CREATE INDEX IF NOT EXISTS idx_addons_tenant ON product_addons(tenant_id);

-- 8. TABEL: orders (Pusat Transaksi Pemesanan Real-Time)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    courier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'cooking', 'ready_for_pickup', 'on_delivery', 'completed', 'cancelled')),
    delivery_address TEXT NOT NULL,
    delivery_latitude DECIMAL(10, 7) NOT NULL,
    delivery_longitude DECIMAL(10, 7) NOT NULL,
    distance_km DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(12, 2) NOT NULL,
    delivery_fee DECIMAL(12, 2) NOT NULL,
    service_fee DECIMAL(12, 2) NOT NULL DEFAULT 2000.00,
    total_amount DECIMAL(12, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- 9. TABEL: order_items (Rincian Item dalam Pesanan)
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    selected_addons JSONB DEFAULT '[]'::jsonb, -- Array object addons terpilih [{id, name, price}]
    item_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 10. TABEL: inventories (Manajemen Stok Produk UMKM Otomatis)
CREATE TABLE IF NOT EXISTS inventories (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    min_stock_alert INTEGER NOT NULL DEFAULT 5,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventories_tenant ON inventories(tenant_id);

-- 11. TABEL: transactions_ledger (Buku Kas & Pembukuan Arus Kas Mini UMKM)
CREATE TABLE IF NOT EXISTS transactions_ledger (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT NOT NULL,
    reference_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_tenant_type ON transactions_ledger(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON transactions_ledger(created_at DESC);

-- 12. TABEL: payments (Integrasi Status Pembayaran QRIS / Midtrans / Cash)
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    payment_method VARCHAR(20) NOT NULL 
        CHECK (payment_method IN ('qris', 'midtrans', 'xendit', 'cash', 'bank_transfer')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),
    amount DECIMAL(12, 2) NOT NULL,
    transaction_id VARCHAR(100),
    payment_url TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status ON payments(tenant_id, payment_status);
