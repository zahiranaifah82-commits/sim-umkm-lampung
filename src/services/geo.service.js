/**
 * Service Geolocation & Perhitungan Ongkir Khusus Wilayah Kota Bandar Lampung
 */

// Titik Koordinat Pusat Kota Bandar Lampung (Tugu Adipura / Bundaran Gajah Enggal)
export const BANDAR_LAMPUNG_CENTER = {
  latitude: -5.397140,
  longitude: 105.266792,
  name: 'Tugu Adipura Enggal, Bandar Lampung'
};

// Aturan Tarif Ongkir Pengiriman Makanan Wilayah Bandar Lampung
export const SHIPPING_RULES = {
  BASE_DISTANCE_KM: 2.0,      // Jarak minimum dasar
  BASE_FEE_RUPIAH: 8000,       // Tarif dasar 0 - 2 km (Rp 8.000)
  PER_KM_FEE_RUPIAH: 2500,     // Tambahan per km di atas 2 km (Rp 2.500/km)
  SERVICE_FEE_RUPIAH: 2000,    // Biaya layanan aplikasi (Rp 2.000)
  MAX_DELIVERY_RADIUS_KM: 25.0 // Radius maksimum pengantaran seluruh Kota Bandar Lampung
};

/**
 * Rumus Haversine: Menghitung jarak garis lurus antara dua koordinat GPS di bumi (KM)
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const EARTH_RADIUS_KM = 6371; // Radius rata-rata bumi

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 100) / 100; // Pembulatan 2 desimal
}

/**
 * Menghitung Ongkir Realistis dan Estimasi Waktu Pengantaran
 */
export function calculateDeliveryCost(distanceKm) {
  const { BASE_DISTANCE_KM, BASE_FEE_RUPIAH, PER_KM_FEE_RUPIAH, SERVICE_FEE_RUPIAH, MAX_DELIVERY_RADIUS_KM } = SHIPPING_RULES;

  if (distanceKm > MAX_DELIVERY_RADIUS_KM) {
    return {
      isDeliverable: false,
      distanceKm,
      deliveryFee: 0,
      serviceFee: SERVICE_FEE_RUPIAH,
      totalShipping: 0,
      estimatedMinutes: null,
      message: `Jarak pengantaran (${distanceKm} km) melebihi batas jangkauan maksimal pengantaran Kota Bandar Lampung (${MAX_DELIVERY_RADIUS_KM} km).`
    };
  }

  let deliveryFee = BASE_FEE_RUPIAH;
  if (distanceKm > BASE_DISTANCE_KM) {
    const extraKm = distanceKm - BASE_DISTANCE_KM;
    deliveryFee += Math.ceil(extraKm * PER_KM_FEE_RUPIAH);
  }

  // Estimasi waktu masak (15 menit) + waktu perjalanan kurir (rata-rata 3.5 menit per km)
  const travelMinutes = Math.ceil(distanceKm * 3.5);
  const estimatedMin = 15 + travelMinutes;
  const estimatedMax = estimatedMin + 10;

  return {
    isDeliverable: true,
    distanceKm,
    deliveryFee,
    serviceFee: SERVICE_FEE_RUPIAH,
    totalShipping: deliveryFee + SERVICE_FEE_RUPIAH,
    estimatedTimeText: `${estimatedMin}-${estimatedMax} menit`,
    message: 'Jangkauan pengantaran tersedia.'
  };
}
