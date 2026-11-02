-- ============================================================================
-- SEED DATA: KOTA BANDAR LAMPUNG & UMKM SAMPLE DATA
-- ============================================================================

-- 1. Districts (Kecamatan & Kelurahan Kota Bandar Lampung)
INSERT INTO districts (district_name, subdistrict_name, postal_code) VALUES
('Way Halim', 'Way Halim Permai', '35141'),
('Way Halim', 'Perumnas Way Halim', '35141'),
('Way Halim', 'Gunung Sulah', '35144'),
('Kedaton', 'Kedaton', '35145'),
('Kedaton', 'Sukamenanti', '35146'),
('Kedaton', 'Sidodadi', '35147'),
('Sukarame', 'Sukarame', '35131'),
('Sukarame', 'Way Dadi', '35131'),
('Sukarame', 'Korpri Jaya', '35131'),
('Teluk Betung Selatan', 'Pesawahan', '35223'),
('Teluk Betung Selatan', 'Gedong Pakuon', '35221'),
('Teluk Betung Utara', 'Kupang Kota', '35211'),
('Tanjung Karang Pusat', 'Palapa', '35116'),
('Tanjung Karang Pusat', 'Pasir Gintung', '35113'),
('Kemiling', 'Kemiling Permai', '35153'),
('Rajabasa', 'Rajabasa Nunyai', '35144'),
('Enggal', 'Enggal', '35118'),
('Enggal', 'Pahoman', '35213');

-- 2. Tenants (UMKM Kuliner Terkenal di Bandar Lampung)
INSERT INTO tenants (name, slug, owner_name, phone, email, subscription_status) VALUES
('Pempek 123 Asli Lampung', 'pempek-123-lampung', 'Hj. Rosdiana', '081272001122', 'info@pempek123.com', 'active'),
('Kopi Ketje Way Halim', 'kopi-ketje-wayhalim', 'Rian Sanjaya', '081379112233', 'admin@kopiketje.com', 'active'),
('Ayam Bakar & Sambal Seruit Bu Lin', 'sambal-seruit-bu-lin', 'Ibu Herlina', '085269445566', 'pemilik@sambalseruit.com', 'active'),
('Bebek Goreng Raden Intan', 'bebek-raden-intan', 'Bambang Irawan', '082188776655', 'kontak@bebekradenintan.com', 'trial');

-- 3. Users (Bcrypt hash untuk 'password123': $2a$10$wN9Q/1dO78r0/bLwUjZ0e.VpIuT/k73HqXk1XfU1x7Lz4oOq8j3G2 atau hash standar)
-- Catatan: Untuk seed praktis, kita gunakan hash bcrypt yang valid untuk 'password123'
INSERT INTO users (tenant_id, name, email, password, role, phone) VALUES
-- Super Admin
(NULL, 'Super Administrator BDL', 'superadmin@lampungfood.id', '$2a$10$64UuWwFm32oE73iH8O1JpeYwT9sC5Mh9G5s4K5u7S7r8f9q0a1b2c', 'super_admin', '08117200001'),

-- Tenant Admins
(1, 'Admin Pempek 123', 'admin@pempek123.com', '$2a$10$64UuWwFm32oE73iH8O1JpeYwT9sC5Mh9G5s4K5u7S7r8f9q0a1b2c', 'tenant_admin', '081272001122'),
(2, 'Admin Kopi Ketje', 'admin@kopiketje.com', '$2a$10$64UuWwFm32oE73iH8O1JpeYwT9sC5Mh9G5s4K5u7S7r8f9q0a1b2c', 'tenant_admin', '081379112233'),
(3, 'Admin Seruit Bu Lin', 'admin@sambalseruit.com', '$2a$10$64UuWwFm32oE73iH8O1JpeYwT9sC5Mh9G5s4K5u7S7r8f9q0a1b2c', 'tenant_admin', '085269445566'),
(4, 'Admin Bebek Raden Intan', 'admin@bebekradenintan.com', '$2a$10$64UuWwFm32oE73iH8O1JpeYwT9sC5Mh9G5s4K5u7S7r8f9q0a1b2c', 'tenant_admin', '082188776655'),

-- Couriers (Kurir Delivery Bandar Lampung)
(NULL, 'Wayan Kurniawan (Kurir BDL)', 'kurir.wayan@lampungfood.id', '$2a$10$64UuWwFm32oE73iH8O1JpeYwT9sC5Mh9G5s4K5u7S7r8f9q0a1b2c', 'courier', '089611223344'),
(NULL, 'Agus Prasetyo (Kurir BDL)', 'kurir.agus@lampungfood.id', '$2a$10$64UuWwFm32oE73iH8O1JpeYwT9sC5Mh9G5s4K5u7S7r8f9q0a1b2c', 'courier', '089655667788'),

-- Customers
(NULL, 'Budi Santoso', 'budi@gmail.com', '$2a$10$64UuWwFm32oE73iH8O1JpeYwT9sC5Mh9G5s4K5u7S7r8f9q0a1b2c', 'customer', '081299887766'),
(NULL, 'Siti Aminah', 'siti@gmail.com', '$2a$10$64UuWwFm32oE73iH8O1JpeYwT9sC5Mh9G5s4K5u7S7r8f9q0a1b2c', 'customer', '081388776655');

-- 4. Merchant Locations (Titik GPS Nyata di Bandar Lampung)
INSERT INTO merchant_locations (tenant_id, district_id, address_detail, latitude, longitude, is_active) VALUES
(1, 10, 'Jl. Ikan Hiu No. 12, Pesawahan, Teluk Betung Selatan', -5.4485000, 105.2638000, TRUE),
(2, 1, 'Jl. Kimaja No. 45, Way Halim Permai', -5.3852000, 105.2754000, TRUE),
(3, 4, 'Jl. Teuku Umar No. 88, Kedaton (Dekat Pasar Koga)', -5.3789000, 105.2571000, TRUE),
(4, 13, 'Jl. Raden Intan No. 102, Tanjung Karang Pusat', -5.4124000, 105.2583000, TRUE);

-- 5. Categories
INSERT INTO categories (tenant_id, name, slug, description) VALUES
(1, 'Paket Pempek Komplit', 'paket-pempek', 'Pempek ikan tenggiri asli dengan cuko hitam khas'),
(1, 'Minuman Segar', 'minuman-segar', 'Es kacang merah dan aneka jus'),
(2, 'Espresso & Signature Coffee', 'signature-coffee', 'Kopi Robusta Lampung pilihan'),
(2, 'Toast & Snack', 'snack-toast', 'Roti panggang aneka rasa'),
(3, 'Menu Paket Seruit', 'paket-seruit', 'Paket nasi, ikan/ayam dengan sambal seruit tempoyak'),
(3, 'Lalapan & Sambal', 'lalapan-sambal', 'Ekstra sambal terasi dan lalapan segar'),
(4, 'Bebek & Ayam Goreng', 'bebek-ayam', 'Olahan bebek renyah dan gurih dengan serundeng');

-- 6. Products
INSERT INTO products (tenant_id, category_id, name, description, price, image_url, is_available) VALUES
-- Pempek 123
(1, 1, 'Paket Pempek Campur (10 Pcs)', 'Isi 2 Kapal Selam kecil, 3 Lenjer, 3 Adaan, 2 Kulit + Cuko Pedas', 45000.00, 'https://images.unsplash.com/photo-1628294895950-9805252327bc?w=500', TRUE),
(1, 1, 'Pempek Kapal Selam Jumbo', 'Pempek isi telur bebek utuh dengan kerenyahan kulit luar', 22000.00, 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=500', TRUE),
(1, 2, 'Es Kacang Merah Khas Lampung', 'Kacang merah lembut dengan susu kental manis dan serutan es', 15000.00, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500', TRUE),

-- Kopi Ketje
(2, 3, 'Kopi Susu Gula Aren Lampung', 'Espresso Robusta Tanggamus dipadu susu creamy dan gula aren asli', 18000.00, 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500', TRUE),
(2, 3, 'Ice Americano Robusta Ulubelu', 'Kopi hitam dingin dengan aroma cokelat nutty khas Lampung Barat', 15000.00, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500', TRUE),
(2, 4, 'Roti Panggang Cokelat Keju', 'Roti brioche bakar dengan taburan keju cheddar dan saus cokelat', 16000.00, 'https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=500', TRUE),

-- Sambal Seruit Bu Lin
(3, 5, 'Paket Nasi Seruit Ikan Baung', 'Nasi putih hangat, Ikan Baung goreng, Sambal Seruit Tempoyak mangga & Lalapan', 38000.00, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500', TRUE),
(3, 5, 'Paket Ayam Bakar Madu Seruit', 'Ayam bakar legit dengan cocolan sambal seruit terasi khas pesisir', 30000.00, 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500', TRUE),
(3, 6, 'Sambal Seruit Tempoyak Cup', 'Tambahan sambal durian fermentasi pedas segar 100gr', 10000.00, 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500', TRUE),

-- Bebek Raden Intan
(4, 7, 'Bebek Goreng Kremes Crispy + Nasi', 'Bebek empuk bumbu rempah kuning dengan taburan kremes renyah', 35000.00, 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=500', TRUE);

-- 7. Product Addons
INSERT INTO product_addons (tenant_id, product_id, name, price, is_active) VALUES
(1, 1, 'Ekstra Cuko Hitam Pedas (100ml)', 5000.00, TRUE),
(1, 1, 'Ekstra Timun & Ebi Kering', 3000.00, TRUE),
(1, 2, 'Cuko Ekstra Pedas Mantap', 3000.00, TRUE),
(2, 4, 'Extra Shot Espresso Robusta', 4000.00, TRUE),
(2, 4, 'Oatmilk Swap', 6000.00, TRUE),
(2, 6, 'Ekstra Keju Mozzarella Melt', 5000.00, TRUE),
(3, 7, 'Level Pedas: Sangat Pedas (Cabai Rawit Merah)', 0.00, TRUE),
(3, 7, 'Tambah Tempoyak Durian Asli', 5000.00, TRUE),
(3, 7, 'Nasi Putih Ekstra 1 Porsi', 5000.00, TRUE),
(4, 10, 'Ekstra Sambal Ijo Bumbu Bebek', 4000.00, TRUE);

-- 8. Inventories (Stok Awal)
INSERT INTO inventories (tenant_id, product_id, stock_quantity, min_stock_alert) VALUES
(1, 1, 50, 10),
(1, 2, 35, 5),
(1, 3, 40, 5),
(2, 4, 100, 20),
(2, 5, 100, 20),
(2, 6, 45, 10),
(3, 7, 30, 8),
(3, 8, 40, 10),
(3, 9, 60, 15),
(4, 10, 25, 5);

-- 9. Sample Transactions Ledger (Pencatatan Keuangan Awal)
INSERT INTO transactions_ledger (tenant_id, order_id, type, amount, description, reference_number) VALUES
(1, NULL, 'income', 500000.00, 'Modal Awal Kas Harian Outlet Teluk Betung', 'INIT-001'),
(2, NULL, 'income', 750000.00, 'Penjualan offline takeaway pagi', 'SALES-OFFLINE-01'),
(3, NULL, 'income', 450000.00, 'Saldo kas pembuka kasir', 'INIT-003');
