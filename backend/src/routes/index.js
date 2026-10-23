const express = require('express');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { authorize, authorizeAny } = require('../middleware/authorize');
const { PERMISSIONS: P } = require('../config/permissions');
const schemas = require('../validators/schemas');

const authController = require('../controllers/auth.controller');
const catalogController = require('../controllers/catalog.controller');
const cartController = require('../controllers/cart.controller');
const wishlistController = require('../controllers/wishlist.controller');
const addressController = require('../controllers/address.controller');
const orderController = require('../controllers/order.controller');
const paymentController = require('../controllers/payment.controller');
const notificationController = require('../controllers/notification.controller');
const adminController = require('../controllers/admin.controller');
const storeConfigController = require('../controllers/storeConfig.controller');
const messagingController = require('../controllers/messaging.controller');

const router = express.Router();

const mongoose = require('mongoose');

const authLimiter = env.isTest
  ? (_req, _res, next) => next()
  : rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts. Try again in a few minutes.' },
  });

router.get('/health', (_req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  const isRemote = Boolean(env.mongoUri && env.mongoUri.includes('mongodb.net'));
  res.json({
    success: true,
    data: {
      status: isConnected ? 'ok' : 'degraded',
      service: 'zapbasket-api',
      database: {
        status: isConnected ? 'connected' : 'disconnected',
        provider: isRemote ? 'MongoDB Atlas (prasant.kfrkp3c.mongodb.net)' : 'Embedded MongoDB Engine',
      },
      time: new Date().toISOString(),
    },
  });
});

router.post('/auth/register', authLimiter, validate(schemas.registerSchema), authController.register);
router.post('/auth/login', authLimiter, validate(schemas.loginSchema), authController.login);
router.post('/auth/refresh', validate(schemas.refreshSchema), authController.refresh);
router.post('/auth/logout', validate(schemas.refreshSchema), authController.logout);
router.get('/auth/me', authenticate, authController.me);
router.patch('/auth/me', authenticate, validate(schemas.updateMeSchema), authController.updateMe);

router.get('/categories', catalogController.categories);
router.get('/categories/:slug', validate(schemas.slugParamsSchema), catalogController.category);
router.get('/products', validate(schemas.productQuerySchema), catalogController.products);
router.get('/products/:slug', validate(schemas.slugParamsSchema), catalogController.product);

router.get('/coupons/active', authenticate, authorize(P.COUPONS_APPLY), adminController.activeCoupons);

const cart = express.Router();
cart.use(authenticate, authorize(P.CART_MANAGE));
cart.get('/', cartController.get);
cart.post('/items', validate(schemas.cartItemSchema), cartController.addItem);
cart.patch('/items/:productId', validate(schemas.updateCartItemSchema), cartController.updateItem);
cart.delete('/items/:productId', validate(schemas.productIdParamsSchema), cartController.removeItem);
cart.delete('/', cartController.clear);
cart.post('/coupon', validate(schemas.couponCodeSchema), cartController.applyCoupon);
cart.delete('/coupon', cartController.removeCoupon);
router.use('/cart', cart);

const wishlist = express.Router();
wishlist.use(authenticate, authorize(P.WISHLIST_MANAGE));
wishlist.get('/', wishlistController.get);
wishlist.post('/:productId', validate(schemas.productIdParamsSchema), wishlistController.add);
wishlist.delete('/:productId', validate(schemas.productIdParamsSchema), wishlistController.remove);
router.use('/wishlist', wishlist);

const addresses = express.Router();
addresses.use(authenticate, authorize(P.ADDRESSES_MANAGE));
addresses.get('/reverse-geocode', validate(schemas.reverseGeocodeSchema), addressController.reverseGeocode);
addresses.get('/', addressController.list);
addresses.post('/', validate(schemas.createAddressSchema), addressController.create);
addresses.patch('/:id', validate(schemas.updateAddressSchema), addressController.update);
addresses.delete('/:id', validate(schemas.idParamsSchema), addressController.remove);
router.use('/addresses', addresses);

router.get(
  '/orders',
  authenticate,
  authorizeAny(P.ORDERS_READ_OWN, P.ORDERS_READ_ALL, P.ORDERS_READ_ASSIGNED),
  validate(schemas.orderListSchema),
  orderController.list
);
router.post('/orders', authenticate, authorize(P.ORDERS_CREATE), validate(schemas.placeOrderSchema), orderController.place);
router.get(
  '/orders/:id',
  authenticate,
  authorizeAny(P.ORDERS_READ_OWN, P.ORDERS_READ_ALL, P.ORDERS_READ_ASSIGNED),
  validate(schemas.idParamsSchema),
  orderController.get
);
router.post(
  '/orders/:id/cancel',
  authenticate,
  authorizeAny(P.ORDERS_CANCEL_OWN, P.ORDERS_MANAGE),
  validate(schemas.cancelSchema),
  orderController.cancel
);
router.post(
  '/orders/:id/cancel-restore',
  authenticate,
  authorizeAny(P.ORDERS_CANCEL_OWN, P.ORDERS_MANAGE),
  validate(schemas.idParamsSchema),
  orderController.cancelAndRestore
);
router.post(
  '/orders/:id/switch-to-cod',
  authenticate,
  authorizeAny(P.ORDERS_CREATE, P.ORDERS_MANAGE),
  validate(schemas.idParamsSchema),
  orderController.switchToCod
);
router.post(
  '/orders/:id/accept',
  authenticate,
  authorize(P.ORDERS_ACCEPT),
  validate(schemas.idParamsSchema),
  orderController.accept
);
router.patch(
  '/orders/:id/status',
  authenticate,
  authorizeAny(P.ORDERS_MANAGE, P.ORDERS_DELIVER),
  validate(schemas.statusSchema),
  orderController.updateStatus
);
router.patch(
  '/orders/:id/assign',
  authenticate,
  authorize(P.ORDERS_MANAGE),
  validate(schemas.assignSchema),
  orderController.assign
);
router.post(
  '/orders/:id/verify-receipt',
  authenticate,
  authorizeAny(P.ORDERS_READ_OWN, P.ORDERS_MANAGE),
  validate(schemas.verifyReceiptSchema),
  orderController.verifyReceipt
);
router.post(
  '/orders/:id/manual-utr',
  authenticate,
  authorizeAny(P.ORDERS_READ_OWN, P.ORDERS_MANAGE),
  validate(schemas.manualUtrSchema),
  orderController.submitManualUtr
);
router.get(
  '/orders/:id/invoice',
  authenticate,
  authorizeAny(P.ORDERS_READ_OWN, P.ORDERS_READ_ALL, P.ORDERS_READ_ASSIGNED, P.ORDERS_MANAGE),
  validate(schemas.idParamsSchema),
  orderController.invoice
);

router.get('/store/config', storeConfigController.getPublicConfig);
router.get('/store/coverage', validate(schemas.coverageQuerySchema), storeConfigController.checkAddressCoverage);

router.post('/payments/webhook', validate(schemas.upiGatewayCallbackSchema), paymentController.gatewayCallback);
router.post('/payments/razorpay/order', authenticate, authorize(P.ORDERS_CREATE), validate(schemas.paymentOrderSchema), paymentController.create);
router.post('/payments/razorpay/verify', authenticate, authorize(P.ORDERS_CREATE), validate(schemas.verifyPaymentSchema), paymentController.verify);
router.get('/payments/upi/:id', authenticate, authorize(P.ORDERS_CREATE), validate(schemas.idParamsSchema), paymentController.upiDetails);
router.get('/payments/upi/:id/status', authenticate, authorize(P.ORDERS_CREATE), validate(schemas.idParamsSchema), paymentController.upiStatus);
router.post('/payments/upi/submit', authenticate, authorize(P.ORDERS_CREATE), validate(schemas.verifyUpiPaymentSchema), paymentController.submitUpi);
router.post('/payments/upi/ping-gateway', authenticate, authorize(P.ORDERS_CREATE), validate(schemas.pingUpiGatewaySchema), paymentController.pingGateway);
router.post('/payments/upi/callback', validate(schemas.upiGatewayCallbackSchema), paymentController.gatewayCallback);
router.post('/payments/upi/webhook', validate(schemas.upiGatewayCallbackSchema), paymentController.gatewayCallback);
router.post('/payments/upi/verify', authenticate, authorize(P.ORDERS_CREATE), validate(schemas.verifyUpiPaymentSchema), paymentController.verifyUpi);

router.get('/notifications', authenticate, authorize(P.NOTIFICATIONS_READ), validate(schemas.notificationListSchema), notificationController.list);
router.post('/notifications/read-all', authenticate, authorize(P.NOTIFICATIONS_READ), notificationController.markAllRead);
router.patch('/notifications/:id/read', authenticate, authorize(P.NOTIFICATIONS_READ), validate(schemas.idParamsSchema), notificationController.markRead);

const admin = express.Router();
admin.use(authenticate);
admin.get('/permissions', authorize(P.USERS_READ), adminController.permissions);
admin.get('/dashboard', authorize(P.REPORTS_READ), adminController.dashboard);
admin.get('/reports', authorize(P.REPORTS_READ), validate(schemas.reportQuerySchema), adminController.report);

admin.get('/products', authorize(P.PRODUCTS_WRITE), validate(schemas.productQuerySchema), adminController.products);
admin.post('/products', authorize(P.PRODUCTS_WRITE), validate(schemas.createProductSchema), adminController.createProduct);
admin.post('/products/ai-enhance-image', authorize(P.PRODUCTS_WRITE), validate(schemas.aiEnhanceImageSchema), adminController.aiEnhanceProductImage);
admin.post('/products/ai-extract-details', authorize(P.PRODUCTS_WRITE), validate(schemas.aiExtractProductSchema), adminController.aiExtractProductDetails);
admin.patch('/products/:id', authorize(P.PRODUCTS_WRITE), validate(schemas.updateProductSchema), adminController.updateProduct);
admin.delete('/products/:id', authorize(P.PRODUCTS_WRITE), validate(schemas.idParamsSchema), adminController.archiveProduct);

admin.get('/inventory', authorize(P.PRODUCTS_WRITE), validate(schemas.inventoryQuerySchema), adminController.inventory);
admin.post('/inventory/restock', authorize(P.PRODUCTS_WRITE), validate(schemas.restockSchema), adminController.restock);

admin.get('/gst/report', authorize(P.REPORTS_READ), validate(schemas.gstQuerySchema), adminController.gstReport);
admin.get('/gst/invoice/:orderId', authorize(P.REPORTS_READ), validate(schemas.orderIdParamsSchema), adminController.gstInvoice);

admin.get('/categories', authorize(P.CATEGORIES_WRITE), adminController.categories);
admin.post('/categories', authorize(P.CATEGORIES_WRITE), validate(schemas.createCategorySchema), adminController.createCategory);
admin.patch('/categories/:id', authorize(P.CATEGORIES_WRITE), validate(schemas.updateCategorySchema), adminController.updateCategory);
admin.delete('/categories/:id', authorize(P.CATEGORIES_WRITE), validate(schemas.idParamsSchema), adminController.archiveCategory);

admin.get('/users', authorize(P.USERS_READ), validate(schemas.userListSchema), adminController.users);
admin.post('/users', authorize(P.USERS_WRITE), validate(schemas.createUserSchema), adminController.createUser);
admin.patch('/users/:id', authorize(P.USERS_WRITE), validate(schemas.updateUserSchema), adminController.updateUser);

admin.get('/coupons', authorize(P.COUPONS_WRITE), adminController.coupons);
admin.post('/coupons', authorize(P.COUPONS_WRITE), validate(schemas.createCouponSchema), adminController.createCoupon);
admin.patch('/coupons/:id', authorize(P.COUPONS_WRITE), validate(schemas.updateCouponSchema), adminController.updateCoupon);
admin.delete('/coupons/:id', authorize(P.COUPONS_WRITE), validate(schemas.idParamsSchema), adminController.archiveCoupon);

admin.post('/orders/:id/review-receipt', authorize(P.ORDERS_MANAGE), validate(schemas.reviewReceiptSchema), adminController.reviewReceipt);

admin.get('/store/config', authorize(P.USERS_READ), storeConfigController.getAdminConfig);
admin.put('/store/config', authorize(P.USERS_WRITE), validate(schemas.updateStoreConfigSchema), storeConfigController.updateConfig);

admin.post('/messaging/test', authorize(P.USERS_WRITE), validate(schemas.sendTestMessageSchema), messagingController.sendTestMessage);
admin.get('/messaging/logs', authorize(P.USERS_READ), messagingController.getLogs);

router.use('/admin', admin);

module.exports = router;
