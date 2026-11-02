import { Router } from 'express';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware.js';
import { enforceTenantIsolation } from '../middlewares/tenant.middleware.js';

import authController from '../controllers/auth.controller.js';
import tenantController from '../controllers/tenant.controller.js';
import orderController from '../controllers/order.controller.js';
import merchantController from '../controllers/merchant.controller.js';
import courierController from '../controllers/courier.controller.js';
import adminController from '../controllers/admin.controller.js';

const router = Router();

// ==========================================
// 1. PUBLIC & AUTHENTICATION ENDPOINTS
// ==========================================
router.post('/auth/register', authController.registerCustomer);
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticateToken, authController.getMe);

// Master Data Wilayah Kota Bandar Lampung
router.get('/districts', adminController.getDistricts);

// Pencarian & Katalog UMKM Terdekat (ShopeeFood Customer)
router.get('/tenants', tenantController.getNearbyMerchants);
router.get('/tenants/:idOrSlug', tenantController.getMerchantDetail);

// ==========================================
// 2. CUSTOMER ORDERING & TRACKING ENDPOINTS
// ==========================================
router.post('/orders', authenticateToken, requireRoles('customer'), orderController.createOrder);
router.get('/orders/my-orders', authenticateToken, requireRoles('customer'), orderController.getMyOrders);
router.get('/orders/:id/track', orderController.trackOrder);
router.post('/orders/:id/pay', orderController.simulatePaymentSuccess);

// ==========================================
// 3. TENANT ADMIN & STAFF (UMKM DASHBOARD)
// Wajib melewati middleware enforceTenantIsolation
// ==========================================
router.get(
  '/merchant/dashboard',
  authenticateToken,
  requireRoles('tenant_admin', 'staff'),
  enforceTenantIsolation,
  merchantController.getDashboardOverview
);

router.get(
  '/merchant/orders',
  authenticateToken,
  requireRoles('tenant_admin', 'staff'),
  enforceTenantIsolation,
  merchantController.getOrders
);

router.patch(
  '/merchant/orders/:id/status',
  authenticateToken,
  requireRoles('tenant_admin', 'staff'),
  enforceTenantIsolation,
  merchantController.updateOrderStatus
);

router.get(
  '/merchant/products',
  authenticateToken,
  requireRoles('tenant_admin', 'staff'),
  enforceTenantIsolation,
  merchantController.getProducts
);

router.post(
  '/merchant/products',
  authenticateToken,
  requireRoles('tenant_admin', 'staff'),
  enforceTenantIsolation,
  merchantController.createProduct
);

router.patch(
  '/merchant/inventory/:productId',
  authenticateToken,
  requireRoles('tenant_admin', 'staff'),
  enforceTenantIsolation,
  merchantController.updateStock
);

router.get(
  '/merchant/ledger',
  authenticateToken,
  requireRoles('tenant_admin', 'staff'),
  enforceTenantIsolation,
  merchantController.getLedger
);

router.post(
  '/merchant/ledger/expense',
  authenticateToken,
  requireRoles('tenant_admin', 'staff'),
  enforceTenantIsolation,
  merchantController.addExpense
);

// ==========================================
// 4. COURIER (KURIR PENGANTAR BANDAR LAMPUNG)
// ==========================================
router.get(
  '/courier/available-orders',
  authenticateToken,
  requireRoles('courier'),
  courierController.getAvailableOrders
);

router.post(
  '/courier/orders/:id/claim',
  authenticateToken,
  requireRoles('courier'),
  courierController.claimOrder
);

router.post(
  '/courier/orders/:id/complete',
  authenticateToken,
  requireRoles('courier'),
  courierController.completeDelivery
);

router.get(
  '/courier/my-deliveries',
  authenticateToken,
  requireRoles('courier'),
  courierController.getMyDeliveries
);

// ==========================================
// 5. SUPER ADMIN (PENGELOLA APLIKASI UTAMA)
// ==========================================
router.get(
  '/admin/tenants',
  authenticateToken,
  requireRoles('super_admin'),
  adminController.getAllTenants
);

router.patch(
  '/admin/tenants/:id/subscription',
  authenticateToken,
  requireRoles('super_admin'),
  adminController.updateSubscription
);

export default router;
