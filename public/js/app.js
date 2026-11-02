/**
 * SIM UMKM MULTITENANT KOTA BANDAR LAMPUNG (SHOPEEFOOD CONCEPT)
 * Frontend Interactive Logic (Mobile-First Web App / PWA)
 */

// State Global Aplikasi
const state = {
  currentRole: 'customer',
  currentUser: null,
  token: null,
  currentLocation: {
    latitude: -5.3789000,
    longitude: 105.2571000,
    name: 'Kedaton, Bandar Lampung (Pasar Koga)'
  },
  merchants: [],
  activeMerchant: null,
  cart: {
    tenantId: null,
    tenantName: '',
    items: []
  },
  activeAddonProduct: null,
  addonQty: 1,
  activeOrderId: null,
  trackingInterval: null
};

// Akun Demo Bawaan untuk Pengujian Instan Setiap Role
const DEMO_ACCOUNTS = {
  customer: { email: 'budi@gmail.com', password: 'password123' },
  tenant_admin: { email: 'admin@pempek123.com', password: 'password123' },
  courier: { email: 'kurir.wayan@lampungfood.id', password: 'password123' },
  super_admin: { email: 'superadmin@lampungfood.id', password: 'password123' }
};

// Inisialisasi saat Halaman Dimuat
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Aplikasi SIM UMKM Bandar Lampung Dimuat');
  await loginDemoUser('customer');
  await loadNearbyMerchants();
});

// Format Rupiah Indonesia
function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num);
}

// =========================================================================
// 1. MANAJEMEN ROLE & OTENTIKASI
// =========================================================================

async function switchRole(role) {
  state.currentRole = role;
  await loginDemoUser(role);

  // Update Nav & Tampilan
  document.querySelectorAll('main > section').forEach((el) => el.classList.add('hidden'));

  const navHome = document.getElementById('nav-btn-home');
  const navTenant = document.getElementById('nav-btn-tenant');
  const navCourier = document.getElementById('nav-btn-courier');
  const customerHeader = document.getElementById('customer-header');

  if (role === 'customer') {
    document.getElementById('view-customer').classList.remove('hidden');
    customerHeader.classList.remove('hidden');
    highlightNav('nav-btn-home');
    await loadNearbyMerchants();
  } else if (role === 'tenant_admin') {
    document.getElementById('view-tenant').classList.remove('hidden');
    customerHeader.classList.add('hidden');
    highlightNav('nav-btn-tenant');
    await loadTenantDashboard();
  } else if (role === 'courier') {
    document.getElementById('view-courier').classList.remove('hidden');
    customerHeader.classList.add('hidden');
    highlightNav('nav-btn-courier');
    await loadCourierOrders();
  } else if (role === 'super_admin') {
    document.getElementById('view-admin').classList.remove('hidden');
    customerHeader.classList.add('hidden');
    await loadAdminTenants();
  }
}

async function loginDemoUser(role) {
  try {
    const creds = DEMO_ACCOUNTS[role];
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds)
    });

    const data = await res.json();
    if (data.success) {
      state.token = data.data.token;
      state.currentUser = data.data.user;
      console.log(`🔑 Login aktif sebagai [${role}]: ${state.currentUser.name}`);
    }
  } catch (err) {
    console.error('Gagal login demo user:', err);
  }
}

function highlightNav(activeId) {
  const btnIds = ['nav-btn-home', 'nav-btn-history', 'nav-btn-tenant', 'nav-btn-courier'];
  btnIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (id === activeId) {
        el.className = 'flex flex-col items-center justify-center text-brand font-bold';
      } else {
        el.className = 'flex flex-col items-center justify-center text-gray-400 font-medium';
      }
    }
  });
}

function navGo(target) {
  const roleSelect = document.getElementById('role-selector');
  if (target === 'customer') {
    roleSelect.value = 'customer';
    switchRole('customer');
  } else if (target === 'history') {
    document.querySelectorAll('main > section').forEach((el) => el.classList.add('hidden'));
    document.getElementById('view-history').classList.remove('hidden');
    highlightNav('nav-btn-history');
    loadCustomerOrderHistory();
  } else if (target === 'tenant') {
    roleSelect.value = 'tenant_admin';
    switchRole('tenant_admin');
  } else if (target === 'courier') {
    roleSelect.value = 'courier';
    switchRole('courier');
  }
}

// =========================================================================
// 2. GEOLOKASI GPS BANDAR LAMPUNG & DAFTAR UMKM
// =========================================================================

async function loadNearbyMerchants(searchQuery = '') {
  try {
    const listEl = document.getElementById('merchants-list');
    const countEl = document.getElementById('merchant-count');
    listEl.innerHTML = '<div class="text-center py-8 text-xs text-gray-400">Mencari UMKM terdekat...</div>';

    let url = `/api/tenants?lat=${state.currentLocation.latitude}&lng=${state.currentLocation.longitude}`;
    if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.success || data.data.merchants.length === 0) {
      listEl.innerHTML = '<div class="text-center py-8 text-xs text-gray-400">Tidak ada UMKM terdekat ditemukan.</div>';
      countEl.textContent = '0 UMKM';
      return;
    }

    state.merchants = data.data.merchants;
    countEl.textContent = `${state.merchants.length} UMKM Buka`;

    listEl.innerHTML = state.merchants
      .map(
        (m) => `
        <div class="bg-white border border-gray-100 rounded-2xl p-3 shadow-xs hover:shadow-md transition cursor-pointer" onclick="openMerchantDetail(${m.id})">
          <div class="flex gap-3 items-start">
            <div class="w-20 h-20 rounded-2xl bg-orange-100 flex items-center justify-center text-3xl shrink-0 overflow-hidden relative">
              <span class="text-2xl">${m.name.includes('Kopi') ? '☕' : m.name.includes('Pempek') ? '🐟' : m.name.includes('Bebek') ? '🍗' : '🌶️'}</span>
              <span class="absolute bottom-1 right-1 text-[9px] bg-black/60 text-white px-1 rounded font-bold">${m.distance_km} km</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-[9px] bg-red-100 text-brand px-1.5 py-0.2 rounded font-bold">UMKM BDL</span>
                <span class="text-[10px] text-gray-500 font-medium truncate">${m.district_name}</span>
              </div>
              <h4 class="font-extrabold text-sm text-gray-900 truncate mt-0.5">${m.name}</h4>
              <p class="text-[11px] text-gray-500 truncate mt-0.5">${m.address_detail}</p>
              
              <div class="flex items-center gap-2 mt-2 text-[11px] font-semibold text-gray-700">
                <span class="flex items-center gap-0.5 text-amber-500">
                  <i class="ph-fill ph-star"></i> ${m.rating} (${m.rating_count})
                </span>
                <span>•</span>
                <span class="text-gray-500">${m.estimated_time}</span>
                <span>•</span>
                <span class="text-emerald-700">Ongkir ${formatRupiah(m.delivery_fee)}</span>
              </div>
            </div>
          </div>
        </div>
      `
      )
      .join('');
  } catch (err) {
    console.error('Error load nearby merchants:', err);
  }
}

function handleSearch(val) {
  loadNearbyMerchants(val);
}

function filterCategory(cat) {
  document.querySelectorAll('.category-pill').forEach((btn) => {
    btn.className = 'category-pill px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-white border border-gray-200 text-gray-700';
  });
  event.target.className = 'category-pill active px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-brand text-white shadow-xs';
  loadNearbyMerchants(cat);
}

// Modal Lokasi Presets Kota Bandar Lampung
function openLocationModal() {
  document.getElementById('location-modal').classList.remove('hidden');
}

function closeLocationModal() {
  document.getElementById('location-modal').classList.add('hidden');
}

function setLocationPreset(lat, lng, name) {
  state.currentLocation = { latitude: lat, longitude: lng, name };
  document.getElementById('current-location-text').textContent = name;
  closeLocationModal();
  loadNearbyMerchants();
}

function detectCurrentGps() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.currentLocation.latitude = pos.coords.latitude;
        state.currentLocation.longitude = pos.coords.longitude;
        state.currentLocation.name = 'GPS Akurat (Posisi Anda)';
        document.getElementById('current-location-text').textContent = 'GPS Akurat (Bandar Lampung)';
        loadNearbyMerchants();
      },
      () => {
        alert('Gagal mendeteksi GPS. Menggunakan lokasi default Kedaton, Bandar Lampung.');
      }
    );
  }
}

// =========================================================================
// 3. DETAIL RESTO, KATALOG MENU, & PRODUCT ADDONS
// =========================================================================

async function openMerchantDetail(merchantId) {
  try {
    const res = await fetch(
      `/api/tenants/${merchantId}?lat=${state.currentLocation.latitude}&lng=${state.currentLocation.longitude}`
    );
    const data = await res.json();

    if (!data.success) {
      alert(data.message);
      return;
    }

    const { merchant, categories, products } = data.data;
    state.activeMerchant = merchant;

    // Tampilkan View Resto Menu di Modal / Replace Area
    const customerView = document.getElementById('view-customer');
    customerView.innerHTML = `
      <div class="space-y-4">
        <!-- Back Button -->
        <button onclick="restoreCustomerHome()" class="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-white px-3 py-1.5 rounded-xl border border-gray-200">
          <i class="ph-bold ph-arrow-left"></i> Kembali ke Daftar UMKM
        </button>

        <!-- Resto Banner Card -->
        <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
          <div class="flex items-start justify-between">
            <div>
              <span class="text-[10px] bg-red-100 text-brand px-2 py-0.5 rounded font-bold uppercase">Resto Pilihan Lampung</span>
              <h2 class="text-base font-extrabold text-gray-900 mt-1">${merchant.name}</h2>
              <p class="text-xs text-gray-500 mt-0.5">${merchant.address}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs">
            <span class="font-bold text-brand flex items-center gap-1">
              <i class="ph-bold ph-map-pin"></i> ${merchant.distance_km} km
            </span>
            <span class="text-gray-300">|</span>
            <span class="text-gray-600">${merchant.delivery_cost.estimatedTimeText || '20-30 mnt'}</span>
            <span class="text-gray-300">|</span>
            <span class="font-semibold text-emerald-700">Ongkir ${formatRupiah(merchant.delivery_cost.deliveryFee)}</span>
          </div>
        </div>

        <!-- Menu List -->
        <div>
          <h3 class="text-xs font-extrabold text-gray-900 mb-2 uppercase tracking-wider">Katalog Menu & Paket</h3>
          <div class="space-y-3">
            ${products
              .map(
                (p) => `
              <div class="bg-white border border-gray-100 rounded-2xl p-3 shadow-xs flex justify-between gap-3 items-center">
                <div class="flex-1">
                  <h4 class="font-bold text-sm text-gray-900">${p.name}</h4>
                  <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">${p.description}</p>
                  <div class="text-brand font-extrabold text-sm mt-1.5">${formatRupiah(p.price)}</div>
                  <div class="text-[10px] ${p.stock_quantity > 0 ? 'text-gray-400' : 'text-red-500 font-bold'} mt-0.5">
                    ${p.stock_quantity > 0 ? `Tersedia: ${p.stock_quantity} porsi` : 'Stok Habis'}
                  </div>
                </div>
                <div class="relative shrink-0 flex flex-col items-center">
                  <img src="${p.image_url}" class="w-20 h-20 rounded-2xl object-cover bg-gray-100 shadow-xs">
                  <button 
                    onclick="openAddonModal(${p.id})" 
                    ${p.stock_quantity <= 0 ? 'disabled' : ''}
                    class="mt-1.5 px-3 py-1 bg-brand hover:bg-brand-dark disabled:bg-gray-300 text-white rounded-xl text-xs font-bold shadow-xs transition">
                    + Tambah
                  </button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Error load merchant detail:', err);
  }
}

function restoreCustomerHome() {
  location.reload();
}

// =========================================================================
// 4. ADDON MODAL & KERANJANG BELANJA (CART)
// =========================================================================

function openAddonModal(productId) {
  // Ambil data produk
  const merchant = state.activeMerchant;
  fetch(`/api/tenants/${merchant.id}`)
    .then((r) => r.json())
    .then((res) => {
      const product = res.data.products.find((p) => p.id === productId);
      if (!product) return;

      state.activeAddonProduct = product;
      state.addonQty = 1;

      document.getElementById('addon-modal-name').textContent = product.name;
      document.getElementById('addon-modal-desc').textContent = product.description;
      document.getElementById('addon-modal-base-price').textContent = formatRupiah(product.price);
      document.getElementById('addon-modal-img').src = product.image_url;
      document.getElementById('addon-modal-qty').textContent = '1';
      document.getElementById('addon-modal-notes').value = '';

      // Render Addon Options (Checkboxes)
      const optionsContainer = document.getElementById('addon-modal-options');
      if (product.addons && product.addons.length > 0) {
        optionsContainer.innerHTML = product.addons
          .map(
            (a) => `
            <label class="flex justify-between items-center p-2.5 rounded-xl border border-gray-100 hover:bg-orange-50/50 cursor-pointer text-xs">
              <span class="flex items-center gap-2">
                <input type="checkbox" value="${a.id}" data-price="${a.price}" data-name="${a.name}" onchange="updateAddonModalTotal()" class="addon-checkbox rounded text-brand focus:ring-brand">
                <span class="font-medium text-gray-800">${a.name}</span>
              </span>
              <span class="font-bold text-gray-600">${a.price > 0 ? `+${formatRupiah(a.price)}` : 'Gratis'}</span>
            </label>
          `
          )
          .join('');
      } else {
        optionsContainer.innerHTML = '<div class="text-xs text-gray-400 py-1">Tidak ada kustomisasi tambahan untuk menu ini.</div>';
      }

      updateAddonModalTotal();
      document.getElementById('addon-modal').classList.remove('hidden');
    });
}

function closeAddonModal() {
  document.getElementById('addon-modal').classList.add('hidden');
}

function changeAddonQty(delta) {
  state.addonQty = Math.max(1, state.addonQty + delta);
  document.getElementById('addon-modal-qty').textContent = state.addonQty;
  updateAddonModalTotal();
}

function updateAddonModalTotal() {
  if (!state.activeAddonProduct) return;

  let unitPrice = state.activeAddonProduct.price;
  document.querySelectorAll('.addon-checkbox:checked').forEach((cb) => {
    unitPrice += parseFloat(cb.dataset.price);
  });

  const total = unitPrice * state.addonQty;
  document.getElementById('addon-modal-total-btn').textContent = formatRupiah(total);
}

function confirmAddToCart() {
  const product = state.activeAddonProduct;
  const merchant = state.activeMerchant;

  // Jika keranjang sebelumnya dari tenant lain, konfirmasi reset keranjang
  if (state.cart.tenantId && state.cart.tenantId !== merchant.id) {
    if (!confirm('Keranjang Anda berisi menu dari UMKM lain. Apakah Anda ingin mengosongkan keranjang sebelumnya?')) {
      return;
    }
    state.cart.items = [];
  }

  state.cart.tenantId = merchant.id;
  state.cart.tenantName = merchant.name;

  // Kumpulkan addons terpilih
  const selectedAddons = [];
  document.querySelectorAll('.addon-checkbox:checked').forEach((cb) => {
    selectedAddons.push({
      id: parseInt(cb.value, 10),
      name: cb.dataset.name,
      price: parseFloat(cb.dataset.price)
    });
  });

  const notes = document.getElementById('addon-modal-notes').value.trim();

  let unitPrice = product.price;
  selectedAddons.forEach((a) => (unitPrice += a.price));

  state.cart.items.push({
    product_id: product.id,
    name: product.name,
    unit_price: unitPrice,
    quantity: state.addonQty,
    subtotal: unitPrice * state.addonQty,
    selected_addons: selectedAddons,
    item_notes: notes
  });

  closeAddonModal();
  updateFloatingCart();
}

function updateFloatingCart() {
  const bar = document.getElementById('floating-cart-bar');
  const countEl = document.getElementById('cart-item-count');
  const totalEl = document.getElementById('cart-total-price');

  const totalItems = state.cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const totalPrice = state.cart.items.reduce((sum, it) => sum + it.subtotal, 0);

  if (totalItems > 0) {
    bar.classList.remove('hidden');
    countEl.textContent = totalItems;
    totalEl.textContent = formatRupiah(totalPrice);
  } else {
    bar.classList.add('hidden');
  }
}

// =========================================================================
// 5. CHECKOUT & SUBMIT ORDER DENGAN TRANSAKSI DATABASE
// =========================================================================

function openCheckoutModal() {
  const merchant = state.activeMerchant;
  if (!merchant || state.cart.items.length === 0) return;

  const itemsListEl = document.getElementById('checkout-items-list');
  itemsListEl.innerHTML = state.cart.items
    .map(
      (it) => `
      <div class="flex justify-between items-start text-xs">
        <div>
          <div class="font-bold text-gray-800">${it.quantity}x ${it.name}</div>
          ${it.selected_addons.length > 0 ? `<div class="text-[10px] text-gray-500">+ ${it.selected_addons.map((a) => a.name).join(', ')}</div>` : ''}
          ${it.item_notes ? `<div class="text-[10px] text-amber-600 italic">"${it.item_notes}"</div>` : ''}
        </div>
        <div class="font-bold text-gray-800">${formatRupiah(it.subtotal)}</div>
      </div>
    `
    )
    .join('');

  const subtotal = state.cart.items.reduce((sum, it) => sum + it.subtotal, 0);
  const deliveryFee = merchant.delivery_cost.deliveryFee || 8000;
  const serviceFee = 2000;
  const grandTotal = subtotal + deliveryFee + serviceFee;

  document.getElementById('checkout-distance-badge').textContent = `${merchant.distance_km} km`;
  document.getElementById('checkout-calc-km').textContent = `${merchant.distance_km} km`;
  document.getElementById('checkout-subtotal').textContent = formatRupiah(subtotal);
  document.getElementById('checkout-delivery-fee').textContent = formatRupiah(deliveryFee);
  document.getElementById('checkout-grand-total').textContent = formatRupiah(grandTotal);

  document.getElementById('checkout-modal').classList.remove('hidden');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.add('hidden');
}

async function submitOrderCheckout() {
  const btn = document.getElementById('btn-submit-order');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Memproses Pesanan...';

  try {
    const deliveryAddress = document.getElementById('checkout-address').value;
    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'qris';

    const payload = {
      tenant_id: state.cart.tenantId,
      delivery_address: deliveryAddress,
      delivery_latitude: state.currentLocation.latitude,
      delivery_longitude: state.currentLocation.longitude,
      payment_method: paymentMethod,
      order_notes: 'Mohon diantar segera',
      items: state.cart.items.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
        selected_addon_ids: it.selected_addons.map((a) => a.id),
        item_notes: it.item_notes
      }))
    };

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || 'Gagal membuat pesanan.');
      btn.disabled = false;
      btn.innerHTML = '<span>Pesan Sekarang</span><i class="ph-bold ph-arrow-right"></i>';
      return;
    }

    // Reset Keranjang
    state.cart.items = [];
    updateFloatingCart();
    closeCheckoutModal();

    state.activeOrderId = data.data.order_id;

    if (data.data.payment.paymentMethod === 'qris') {
      // Buka Modal QRIS
      document.getElementById('qris-image').src = data.data.payment.paymentUrl;
      document.getElementById('qris-order-number').textContent = data.data.order_number;
      document.getElementById('qris-amount').textContent = formatRupiah(data.data.total_amount);
      document.getElementById('qris-modal').classList.remove('hidden');
    } else {
      // Langsung buka tracking
      openTrackingModal(state.activeOrderId);
    }
  } catch (err) {
    console.error('Submit order error:', err);
    alert('Terjadi kesalahan jaringan.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Pesan Sekarang (Buat Pesanan)</span><i class="ph-bold ph-arrow-right"></i>';
  }
}

// =========================================================================
// 6. QRIS & SIMULASI PEMBAYARAN WEBHOOK
// =========================================================================

function closeQrisModal() {
  document.getElementById('qris-modal').classList.add('hidden');
  if (state.activeOrderId) {
    openTrackingModal(state.activeOrderId);
  }
}

async function simulatePaySuccess() {
  if (!state.activeOrderId) return;
  try {
    const res = await fetch(`/api/orders/${state.activeOrderId}/pay`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      closeQrisModal();
      openTrackingModal(state.activeOrderId);
    }
  } catch (err) {
    console.error('Error bayar QRIS:', err);
  }
}

// =========================================================================
// 7. REAL-TIME ORDER TRACKING (SHOPEEFOOD STATUS TIMELINE)
// =========================================================================

async function openTrackingModal(orderId) {
  state.activeOrderId = orderId;
  document.getElementById('tracking-modal').classList.remove('hidden');
  await refreshTrackingData(orderId);

  // Polling Real-time setiap 4 detik untuk update status otomatis
  if (state.trackingInterval) clearInterval(state.trackingInterval);
  state.trackingInterval = setInterval(() => {
    refreshTrackingData(orderId);
  }, 4000);
}

function closeTrackingModal() {
  document.getElementById('tracking-modal').classList.add('hidden');
  if (state.trackingInterval) {
    clearInterval(state.trackingInterval);
  }
}

async function refreshTrackingData(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}/track`);
    const data = await res.json();
    if (!data.success) return;

    const { order, items, timeline } = data.data;

    document.getElementById('tracking-order-num').textContent = `Pesanan #${order.order_number}`;

    // Update Status Banner
    const statusMap = {
      pending: { title: 'Menunggu Pembayaran', desc: 'Silakan selesaikan pembayaran.', icon: 'ph-credit-card' },
      confirmed: { title: 'Pesanan Dikonfirmasi Resto', desc: 'Resto menerima pesanan Anda.', icon: 'ph-check-circle' },
      cooking: { title: 'Makanan Sedang Dimasak', desc: 'Dapur UMKM sedang mengolah sajian Anda.', icon: 'ph-cooking-pot' },
      ready_for_pickup: { title: 'Makanan Siap Antar', desc: 'Menunggu penjemputan oleh kurir.', icon: 'ph-package' },
      on_delivery: { title: 'Kurir Sedang Mengantar', desc: 'Kurir sedang dalam perjalanan ke lokasi Anda.', icon: 'ph-moped' },
      completed: { title: 'Pesanan Selesai!', desc: 'Makanan telah sampai di tujuan. Selamat menikmati!', icon: 'ph-house' }
    };

    const currentMeta = statusMap[order.status] || statusMap['pending'];
    document.getElementById('tracking-banner-title').textContent = currentMeta.title;
    document.getElementById('tracking-banner-desc').textContent = currentMeta.desc;

    // Render Stepper Timeline
    const stepperContainer = document.getElementById('tracking-stepper-list');
    stepperContainer.innerHTML = timeline.stages
      .map((st, idx) => {
        const isDone = idx < timeline.current_stage_index;
        const isActive = idx === timeline.current_stage_index;

        let statusClass = 'text-gray-400';
        let circleClass = 'bg-gray-200 text-gray-500';

        if (isDone) {
          statusClass = 'text-emerald-700 font-semibold';
          circleClass = 'bg-emerald-600 text-white';
        } else if (isActive) {
          statusClass = 'text-brand font-bold';
          circleClass = 'bg-brand text-white pulse-primary';
        }

        return `
        <div class="tracking-step flex items-start gap-3 ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}">
          <div class="w-8 h-8 rounded-full ${circleClass} flex items-center justify-center shrink-0 z-10 text-sm">
            <i class="ph-bold ${isDone ? 'ph-check' : 'ph-' + st.icon}"></i>
          </div>
          <div>
            <div class="text-xs ${statusClass}">${st.title}</div>
            <div class="text-[10px] text-gray-400">${isActive ? 'Sedang berlangsung...' : isDone ? 'Selesai' : 'Tahap selanjutnya'}</div>
          </div>
        </div>
      `;
      })
      .join('');

    // Driver Card
    const courierCard = document.getElementById('tracking-courier-card');
    if (order.courier_name) {
      courierCard.classList.remove('hidden');
      document.getElementById('tracking-courier-name').textContent = order.courier_name;
      document.getElementById('tracking-courier-phone').textContent = order.courier_phone || 'Kurir BDL';
      document.getElementById('tracking-courier-call').href = `tel:${order.courier_phone}`;
    } else {
      courierCard.classList.add('hidden');
    }

    // Detail Items
    const itemsList = document.getElementById('tracking-items-list');
    itemsList.innerHTML = items
      .map(
        (it) => `
        <div class="flex justify-between">
          <span>${it.quantity}x ${it.product_name}</span>
          <span class="font-semibold text-gray-800">${formatRupiah(it.subtotal)}</span>
        </div>
      `
      )
      .join('');
  } catch (err) {
    console.error('Error tracking order:', err);
  }
}

// =========================================================================
// 8. RIWAYAT PESANAN SAYA (CUSTOMER)
// =========================================================================

async function loadCustomerOrderHistory() {
  try {
    const listEl = document.getElementById('customer-orders-history');
    listEl.innerHTML = '<div class="text-xs text-gray-400 text-center py-6">Memuat riwayat...</div>';

    const res = await fetch('/api/orders/my-orders', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      listEl.innerHTML = '<div class="text-xs text-gray-400 text-center py-6">Belum ada riwayat pesanan.</div>';
      return;
    }

    listEl.innerHTML = data.data
      .map(
        (ord) => `
        <div class="bg-white border border-gray-100 rounded-2xl p-3.5 shadow-xs flex justify-between items-center cursor-pointer hover:border-brand" onclick="openTrackingModal(${ord.id})">
          <div>
            <div class="text-xs font-bold text-gray-900">${ord.tenant_name}</div>
            <div class="text-[10px] text-gray-500 font-mono mt-0.5">${ord.order_number}</div>
            <div class="text-xs font-extrabold text-brand mt-1">${formatRupiah(ord.total_amount)}</div>
          </div>
          <div class="text-right">
            <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-orange-100 text-brand">
              ${ord.status}
            </span>
            <div class="text-[10px] text-gray-400 mt-1">${new Date(ord.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</div>
          </div>
        </div>
      `
      )
      .join('');
  } catch (err) {
    console.error('Error load order history:', err);
  }
}

// =========================================================================
// 9. TENANT ADMIN & KITCHEN DASHBOARD
// =========================================================================

function switchTenantTab(tab) {
  const tabs = ['orders', 'inventory', 'ledger'];
  tabs.forEach((t) => {
    document.getElementById(`tenant-tab-${t}`).classList.add('hidden');
    const btn = document.getElementById(`tab-btn-${t}`);
    btn.className = 'flex-1 py-2 text-xs font-bold text-gray-500 border-b-2 border-transparent';
  });

  document.getElementById(`tenant-tab-${tab}`).classList.remove('hidden');
  document.getElementById(`tab-btn-${tab}`).className = 'flex-1 py-2 text-xs font-bold text-brand border-b-2 border-brand';
}

async function loadTenantDashboard() {
  try {
    const res = await fetch('/api/merchant/dashboard', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    const stats = data.data;
    document.getElementById('merchant-dashboard-name').textContent = stats.tenant_name;
    document.getElementById('merchant-subscription-badge').textContent = stats.subscription_status;
    document.getElementById('stat-revenue').textContent = formatRupiah(stats.today_revenue);
    document.getElementById('stat-active-orders').textContent = stats.active_orders_count;
    document.getElementById('stat-balance').textContent = formatRupiah(stats.current_cash_balance);

    await loadTenantOrders();
    await loadTenantInventory();
    await loadTenantLedger();
  } catch (err) {
    console.error('Error tenant dashboard:', err);
  }
}

async function loadTenantOrders() {
  try {
    const listEl = document.getElementById('tenant-orders-list');
    const badgeEl = document.getElementById('tenant-order-badge');

    const res = await fetch('/api/merchant/orders', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    const orders = data.data;
    badgeEl.textContent = orders.length;

    if (orders.length === 0) {
      listEl.innerHTML = '<div class="text-xs text-gray-400 text-center py-6">Belum ada pesanan masuk.</div>';
      return;
    }

    listEl.innerHTML = orders
      .map((ord) => {
        let actionBtn = '';
        if (ord.status === 'confirmed' || ord.status === 'pending') {
          actionBtn = `<button onclick="updateOrderStatus(${ord.id}, 'cooking')" class="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold">🍳 Mulai Masak</button>`;
        } else if (ord.status === 'cooking') {
          actionBtn = `<button onclick="updateOrderStatus(${ord.id}, 'ready_for_pickup')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold">📦 Siap Dipickup Kurir</button>`;
        } else if (ord.status === 'ready_for_pickup') {
          actionBtn = `<span class="text-xs font-semibold text-blue-700">Menunggu Kurir Mengambil...</span>`;
        } else if (ord.status === 'on_delivery') {
          actionBtn = `<span class="text-xs font-semibold text-purple-700">Sedang Diantar Kurir</span>`;
        } else if (ord.status === 'completed') {
          actionBtn = `<span class="text-xs font-semibold text-emerald-700">✓ Selesai & Dibukukan</span>`;
        }

        return `
        <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-2">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-xs font-bold text-gray-900">${ord.customer_name} (${ord.customer_phone || '-'})</div>
              <div class="text-[10px] text-gray-400 font-mono">Order #${ord.order_number}</div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
              ${ord.status}
            </span>
          </div>

          <div class="bg-gray-50 rounded-xl p-2.5 text-xs space-y-1">
            ${ord.items
              .map(
                (it) => `
              <div class="flex justify-between">
                <span>${it.quantity}x ${it.product_name}</span>
                <span class="font-medium text-gray-700">${formatRupiah(it.subtotal)}</span>
              </div>
            `
              )
              .join('')}
          </div>

          <div class="flex justify-between items-center pt-1">
            <span class="text-xs font-extrabold text-brand">Total: ${formatRupiah(ord.total_amount)}</span>
            ${actionBtn}
          </div>
        </div>
      `;
      })
      .join('');
  } catch (err) {
    console.error('Error tenant orders:', err);
  }
}

async function updateOrderStatus(orderId, nextStatus) {
  try {
    const res = await fetch(`/api/merchant/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ status: nextStatus })
    });
    const data = await res.json();
    if (data.success) {
      loadTenantOrders();
    } else {
      alert(data.message);
    }
  } catch (err) {
    console.error('Error update order status:', err);
  }
}

async function loadTenantInventory() {
  try {
    const listEl = document.getElementById('inventory-list');
    const res = await fetch('/api/merchant/products', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    listEl.innerHTML = data.data
      .map(
        (p) => `
        <div class="bg-white border border-gray-100 rounded-xl p-3 flex justify-between items-center shadow-xs">
          <div>
            <div class="font-bold text-xs text-gray-900">${p.name}</div>
            <div class="text-[10px] text-gray-500">${formatRupiah(p.price)} • Alert Min: ${p.min_stock_alert}</div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-gray-800">Stok:</span>
            <input 
              type="number" 
              value="${p.stock_quantity}" 
              onchange="updateProductStock(${p.id}, this.value)"
              class="w-16 px-2 py-1 text-xs border border-gray-200 rounded-lg text-center font-bold outline-none focus:border-brand"
            >
          </div>
        </div>
      `
      )
      .join('');
  } catch (err) {
    console.error('Error inventory:', err);
  }
}

async function updateProductStock(productId, newQty) {
  try {
    await fetch(`/api/merchant/inventory/${productId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ stock_quantity: parseInt(newQty, 10) })
    });
  } catch (err) {
    console.error('Error update stock:', err);
  }
}

async function loadTenantLedger() {
  try {
    const listEl = document.getElementById('ledger-list');
    const res = await fetch('/api/merchant/ledger', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    listEl.innerHTML = data.data.entries
      .map(
        (e) => `
        <div class="bg-white border border-gray-100 rounded-xl p-2.5 flex justify-between items-center text-xs">
          <div>
            <div class="font-semibold text-gray-800">${e.description}</div>
            <div class="text-[10px] text-gray-400 font-mono">${new Date(e.created_at).toLocaleDateString('id-ID')}</div>
          </div>
          <span class="font-extrabold ${e.type === 'income' ? 'text-emerald-600' : 'text-red-500'}">
            ${e.type === 'income' ? '+' : '-'}${formatRupiah(e.amount)}
          </span>
        </div>
      `
      )
      .join('');
  } catch (err) {
    console.error('Error ledger:', err);
  }
}

function openAddExpenseModal() {
  document.getElementById('expense-modal').classList.remove('hidden');
}

function closeAddExpenseModal() {
  document.getElementById('expense-modal').classList.add('hidden');
}

async function submitExpenseForm(e) {
  e.preventDefault();
  const amount = document.getElementById('expense-amount').value;
  const description = document.getElementById('expense-desc').value;

  try {
    const res = await fetch('/api/merchant/ledger/expense', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ amount, description })
    });
    const data = await res.json();
    if (data.success) {
      closeAddExpenseModal();
      loadTenantLedger();
      loadTenantDashboard();
    }
  } catch (err) {
    console.error('Error submit expense:', err);
  }
}

// =========================================================================
// 10. COURIER VIEW (PENGANTARAN MAKANAN BANDAR LAMPUNG)
// =========================================================================

async function loadCourierOrders() {
  try {
    const availList = document.getElementById('courier-available-list');
    const activeList = document.getElementById('courier-active-list');

    // 1. Ambil pesanan ready_for_pickup
    const resAvail = await fetch('/api/courier/available-orders', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const dataAvail = await resAvail.json();

    if (dataAvail.data.length === 0) {
      availList.innerHTML = '<div class="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl">Tidak ada pesanan siap antar saat ini.</div>';
    } else {
      availList.innerHTML = dataAvail.data
        .map(
          (ord) => `
          <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-2">
            <div class="flex justify-between items-start">
              <span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">Siap Dipickup</span>
              <span class="text-xs font-bold text-emerald-600">Ongkir: ${formatRupiah(ord.delivery_fee)}</span>
            </div>
            <div>
              <div class="font-extrabold text-xs text-gray-900">${ord.tenant_name}</div>
              <div class="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                <i class="ph-bold ph-storefront"></i> ${ord.merchant_address}
              </div>
              <div class="text-[11px] text-gray-700 mt-1 font-medium flex items-center gap-1">
                <i class="ph-bold ph-map-pin text-brand"></i> ${ord.delivery_address} (${ord.distance_km} km)
              </div>
            </div>
            <button onclick="claimCourierOrder(${ord.id})" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs shadow-xs mt-2">
              🛵 Ambil Pengantaran Ini
            </button>
          </div>
        `
        )
        .join('');
    }

    // 2. Ambil pengantaran aktif kurir saat ini
    const resActive = await fetch('/api/courier/my-deliveries', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const dataActive = await resActive.json();

    const ongoing = dataActive.data.filter((d) => d.status === 'on_delivery');
    if (ongoing.length === 0) {
      activeList.innerHTML = '<div class="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl">Tidak ada pengantaran yang sedang berjalan.</div>';
    } else {
      activeList.innerHTML = ongoing
        .map(
          (ord) => `
          <div class="bg-white border-2 border-brand rounded-2xl p-4 shadow-md space-y-2">
            <div class="flex justify-between items-start">
              <span class="text-[10px] bg-brand text-white px-2 py-0.5 rounded font-bold">Sedang Diantar</span>
              <span class="text-xs font-bold text-gray-900">Total: ${formatRupiah(ord.total_amount)}</span>
            </div>
            <div>
              <div class="text-xs font-bold text-gray-900">Penerima: ${ord.customer_name} (${ord.customer_phone || '-'})</div>
              <div class="text-xs text-gray-600 mt-0.5">${ord.delivery_address}</div>
            </div>
            <button onclick="completeCourierDelivery(${ord.id})" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-xs mt-2 flex items-center justify-center gap-1.5">
              <i class="ph-bold ph-check"></i> Selesaikan Pengantaran (Pesanan Sampai)
            </button>
          </div>
        `
        )
        .join('');
    }
  } catch (err) {
    console.error('Error courier orders:', err);
  }
}

async function claimCourierOrder(orderId) {
  try {
    const res = await fetch(`/api/courier/orders/${orderId}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (data.success) {
      loadCourierOrders();
    } else {
      alert(data.message);
    }
  } catch (err) {
    console.error('Error claim order:', err);
  }
}

async function completeCourierDelivery(orderId) {
  try {
    const res = await fetch(`/api/courier/orders/${orderId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (data.success) {
      alert('Pengantaran berhasil diselesaikan! Pendapatan telah dibukukan otomatis ke UMKM.');
      loadCourierOrders();
    } else {
      alert(data.message);
    }
  } catch (err) {
    console.error('Error complete delivery:', err);
  }
}

// =========================================================================
// 11. SUPER ADMIN (MULTITENANT & SUBSCRIPTIONS)
// =========================================================================

async function loadAdminTenants() {
  try {
    const listEl = document.getElementById('admin-tenants-list');
    const res = await fetch('/api/admin/tenants', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    listEl.innerHTML = data.data
      .map(
        (t) => `
        <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-2">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-extrabold text-sm text-gray-900">${t.name}</h4>
              <p class="text-[11px] text-gray-500">${t.owner_name} • ${t.phone}</p>
            </div>
            <select 
              onchange="changeTenantSubscription(${t.id}, this.value)"
              class="text-xs font-bold rounded-lg px-2 py-1 border border-gray-300 outline-none ${
                t.subscription_status === 'active' ? 'bg-emerald-50 text-emerald-800' : t.subscription_status === 'suspended' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'
              }">
              <option value="active" ${t.subscription_status === 'active' ? 'selected' : ''}>Active</option>
              <option value="trial" ${t.subscription_status === 'trial' ? 'selected' : ''}>Trial</option>
              <option value="suspended" ${t.subscription_status === 'suspended' ? 'selected' : ''}>Suspended</option>
              <option value="expired" ${t.subscription_status === 'expired' ? 'selected' : ''}>Expired</option>
            </select>
          </div>
          <div class="text-[11px] text-gray-600 bg-gray-50 p-2 rounded-xl flex justify-between">
            <span>Katalog: ${t.total_products} Menu</span>
            <span>Total Transaksi: ${t.total_orders} Pesanan</span>
          </div>
        </div>
      `
      )
      .join('');
  } catch (err) {
    console.error('Error admin tenants:', err);
  }
}

async function changeTenantSubscription(tenantId, newStatus) {
  try {
    const res = await fetch(`/api/admin/tenants/${tenantId}/subscription`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ subscription_status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      loadAdminTenants();
    }
  } catch (err) {
    console.error('Error update subscription:', err);
  }
}
