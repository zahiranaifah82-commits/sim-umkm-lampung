# SIM UMKM Multitenant Kota Bandar Lampung (Konsep ShopeeFood)

Sistem Informasi Manajemen (SIM) UMKM Kuliner Multitenant berbasis Web & Progressive Web App (PWA) ala **ShopeeFood** yang dirancang khusus untuk cakupan wilayah **Kota Bandar Lampung**. Menggunakan arsitektur database terpusat dengan pendekatan **Shared Database, Shared Schema** dan kolom isolasi mutlak `tenant_id`.

---

## 🌟 Fitur Utama Berdasarkan Role

1. **📱 Customer (Pelanggan via HP / PWA)**:
   - Deteksi radius GPS ke UMKM terdekat di Kota Bandar Lampung (Kedaton, Way Halim, Teluk Betung, Sukarame, Tanjung Karang, dll.).
   - Perhitungan Ongkir Dinamis otomatis menggunakan **Rumus Haversine**.
   - Kustomisasi Menu & Add-ons (`product_addons`: Level Pedas, Ekstra Sambal Seruit, Keju Melt, Cuko Hitam Ekstra).
   - Checkout dengan rincian biaya, pilihan alamat pengantaran, dan catatan khusus dapur.
   - Integrasi Pembayaran QRIS Nasional (simulasi QRIS EMVCo & Webhook instan) serta Tunai (COD).
   - **Real-Time Live Order Tracking**: Timeline status pesanan ala ShopeeFood (`pending` ➔ `confirmed` ➔ `cooking` ➔ `ready_for_pickup` ➔ `on_delivery` ➔ `completed`).

2. **🏪 Tenant Admin & Staff (UMKM Kuliner)**:
   - Dashboard analitik: Omzet harian, pesanan aktif, saldo kas, dan alert stok menipis.
   - **Kitchen Kanban Live**: Menerima pesanan masuk, memajukan status ke `cooking` (Dapur) hingga `ready_for_pickup`.
   - **Manajemen Inventori Otomatis**: Stok berkurang secara atomik saat checkout pesanan.
   - **Buku Kas Mini (Transactions Ledger)**: Pencatatan arus kas otomatis saat pesanan selesai serta pencatatan pengeluaran operasional (bahan baku, gas LPG, packaging).

3. **🛵 Kurir Delivery (Bandar Lampung)**:
   - Melihat daftar pesanan berstatus `ready_for_pickup` dari seluruh resto UMKM di Bandar Lampung.
   - Mengambil pesanan (`claimOrder`) mengubah status menjadi `on_delivery`.
   - Navigasi alamat resto ke titik pengantaran customer.
   - Menyelesaikan pengantaran (`completed`) yang secara otomatis membukukan pendapatan ke buku kas UMKM.

4. **👑 Super Admin**:
   - Monitoring seluruh mitra UMKM di Kota Bandar Lampung.
   - Manajemen paket dan status lisensi langganan (`trial`, `active`, `suspended`, `expired`).
   - Master data referensi kecamatan & kelurahan Kota Bandar Lampung.

---

## 🗄️ Struktur Database (9+ Tabel Utama)

Aplikasi mengimplementasikan skema relasional terpusat:
- `tenants`: Profil UMKM, slug, kontak, dan status langganan.
- `users`: Multi-role user management dengan indeks `tenant_id` dan `role`.
- `districts`: Referensi kecamatan & kelurahan Kota Bandar Lampung.
- `merchant_locations`: Koordinat GPS latitude & longitude cabang UMKM.
- `categories`: Kategori hidangan menu per tenant.
- `products`: Katalog makanan/minuman dengan harga desimal & status ketersediaan.
- `product_addons`: Kustomisasi menu per produk dengan tambahan harga.
- `orders`: Pusat data transaksi dengan status dan koordinat tujuan.
- `order_items`: Rincian item dalam pesanan beserta JSON addons terpilih.
- `inventories`: Pemantauan stok produk dan alert stok batas minimum.
- `transactions_ledger`: Pembukuan arus kas (income/expense) tenant.
- `payments`: Status pembayaran QRIS, Midtrans/Xendit, atau Cash.

File DDL siap pakai tersedia di:
- **PostgreSQL**: `database/schema.sql` (Supabase, Neon, Railway, Render)
- **MySQL**: `database/schema_mysql.sql` (PlanetScale, Aiven)

---

## 📍 Perhitungan Jarak & Tarif Ongkir Kota Bandar Lampung

Menggunakan formula matematika **Haversine**:
$$\Delta\text{lat} = \text{lat}_2 - \text{lat}_1, \quad \Delta\text{lon} = \text{lon}_2 - \text{lon}_1$$
$$a = \sin^2\left(\frac{\Delta\text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta\text{lon}}{2}\right)$$
$$d = 2R \cdot \text{atan2}(\sqrt{a}, \sqrt{1-a}) \quad (R = 6371\text{ km})$$

**Aturan Ongkir Bandar Lampung (`src/services/geo.service.js`)**:
- Tarif dasar (0 - 2.0 km): **Rp 8.000**
- Tambahan per kilometer berikutnya: **Rp 2.500 / km**
- Biaya layanan aplikasi: **Rp 2.000 flat**
- Radius jangkauan pengantaran: **Maksimum 25 km**

---

## 🚀 Panduan Menjalankan di Lokal (Development)

Proyek ini telah dilengkapi dual database adapter: berjalan dengan SQLite secara instan tanpa perlu instalasi server database lokal, atau otomatis beralih ke PostgreSQL jika `DATABASE_URL` diisi.

1. **Clone & Masuk Direktori**:
   ```bash
   cd "c:\tugas inunn\projekk"
   ```

2. **Install Dependensi**:
   ```bash
   npm install
   ```

3. **Jalankan Migrasi & Seeding Data**:
   ```bash
   npm run migrate
   ```

4. **Jalankan Aplikasi Web**:
   ```bash
   npm start
   ```
   Akses di browser / HP Anda: `http://localhost:3000`

---

## 👥 Akun Uji Coba Demo (Tersedia Role Switcher Instan di Header)

| Role | Email | Password | Keterangan |
| :--- | :--- | :--- | :--- |
| **Customer** | `budi@gmail.com` | `password123` | Pelanggan di Kedaton BDL |
| **Tenant Admin** | `admin@pempek123.com` | `password123` | Pemilik Resto Pempek 123 (Tenant ID: 1) |
| **Kurir** | `kurir.wayan@lampungfood.id` | `password123` | Kurir Area Way Halim & Kedaton |
| **Super Admin** | `superadmin@lampungfood.id` | `password123` | Pengelola Pusat Kota Bandar Lampung |

---

## ☁️ Panduan Deployment Cepat & 100% Gratis

Aplikasi ini dapat langsung dipublikasikan ke internet secara gratis menggunakan kombinasi layanan cloud modern:

### Langkah 1: Buat Database PostgreSQL Gratis (Supabase / Neon)
1. Buka [Supabase.com](https://supabase.com) atau [Neon.tech](https://neon.tech), daftar secara gratis.
2. Buat Project Baru (pilih Region terdekat: **Singapore / ap-southeast-1**).
3. Salin **Connection String (URI)** yang disediakan:
   ```text
   postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require
   ```
4. Buka menu **SQL Editor** di dashboard Supabase/Neon, salin seluruh isi file `database/schema.sql`, lalu klik **Run**.
5. Salin juga isi file `database/seed.sql` lalu klik **Run** untuk menyuntikkan data wilayah Bandar Lampung.

### Langkah 2: Deploy Web App ke Render.com / Railway
1. Push repository ini ke akun GitHub Anda.
2. Buka [Render.com](https://render.com), buat akun gratis dan klik **New +** ➔ **Web Service**.
3. Hubungkan repository GitHub Anda.
4. Konfigurasikan pengaturan:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Tambahkan **Environment Variables**:
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = `kunci-rahasia-produksi-bdl-2026`
   - `DATABASE_URL` = *(Tempelkan URL koneksi PostgreSQL Supabase Anda dari Langkah 1)*
   - `DB_SSL` = `true`
6. Klik **Deploy Web Service**. Dalam 1-2 menit aplikasi akan live dengan URL publik HTTPS (contoh: `https://sim-umkm-bdl.onrender.com`).
7. Buka link tersebut langsung dari browser smartphone Anda untuk pengalaman aplikasi PWA mobile-first!
