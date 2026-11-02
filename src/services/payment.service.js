/**
 * Service Pembayaran: QRIS, Midtrans/Xendit Mock, dan Tunai (COD)
 */

export const paymentService = {
  /**
   * Membuat transaksi pembayaran baru
   */
  async createPayment({ orderId, tenantId, amount, paymentMethod }) {
    const transactionId = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let paymentUrl = null;
    let qrString = null;
    let paymentStatus = 'pending';

    switch (paymentMethod) {
      case 'qris':
        // Simulasi string standar QRIS Standar Nasional Indonesia (NMID / EMVCo)
        qrString = `00020101021226600016ID.CO.QRIS.WWW011893600998000001021251440014ID.LINKAJA.WWW0215000000000000000520458125303360540${Math.round(
          amount
        )}5802ID5914UMKM_BANDAR_LAMPUNG6014BANDAR_LAMPUNG61053514162270123${orderId}6304ABCD`;
        paymentUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
          qrString
        )}`;
        break;

      case 'midtrans':
      case 'xendit':
        // Simulasi URL Redirect Payment Gateway
        paymentUrl = `https://simulator.sandbox.midtrans.com/snap/v2/vtweb/${transactionId}`;
        break;

      case 'cash':
        // Pembayaran Tunai saat pesanan diantar kurir (COD)
        paymentStatus = 'pending';
        paymentUrl = null;
        break;

      default:
        paymentMethod = 'qris';
        break;
    }

    return {
      transactionId,
      paymentMethod,
      paymentStatus,
      paymentUrl,
      qrString,
      amount
    };
  }
};

export default paymentService;
