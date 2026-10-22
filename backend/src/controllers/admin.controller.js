const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const productService = require('../services/product.service');
const categoryService = require('../services/category.service');
const userService = require('../services/user.service');
const couponService = require('../services/coupon.service');
const reportService = require('../services/report.service');
const aiService = require('../services/ai.service');
const inventoryService = require('../services/inventory.service');
const gstService = require('../services/gst.service');
const orderService = require('../services/order.service');
const receiptVerificationService = require('../services/receiptVerification.service');
const { ALL_PERMISSIONS, ROLE_PERMISSIONS } = require('../config/permissions');

const adminController = {
  permissions: asyncHandler(async (_req, res) => {
    send(res, { permissions: ALL_PERMISSIONS, roles: ROLE_PERMISSIONS });
  }),

  aiEnhanceProductImage: asyncHandler(async (req, res) => {
    send(res, await aiService.enhanceProductImage(req.body));
  }),

  aiExtractProductDetails: asyncHandler(async (req, res) => {
    send(res, await productService.extractDetailsFromImage(req.body.image));
  }),

  dashboard: asyncHandler(async (_req, res) => {
    send(res, await reportService.dashboard());
  }),

  report: asyncHandler(async (req, res) => {
    send(res, await reportService.report(req.query));
  }),

  products: asyncHandler(async (req, res) => {
    send(res, await productService.list({ ...req.query, includeInactive: 'true' }, { includeInactive: true }));
  }),

  createProduct: asyncHandler(async (req, res) => {
    send(res, await productService.create(req.body), 201);
  }),

  updateProduct: asyncHandler(async (req, res) => {
    send(res, await productService.update(req.params.id, req.body));
  }),

  archiveProduct: asyncHandler(async (req, res) => {
    send(res, await productService.archive(req.params.id));
  }),

  categories: asyncHandler(async (_req, res) => {
    send(res, await categoryService.list({ includeInactive: true }));
  }),

  createCategory: asyncHandler(async (req, res) => {
    send(res, await categoryService.create(req.body), 201);
  }),

  updateCategory: asyncHandler(async (req, res) => {
    send(res, await categoryService.update(req.params.id, req.body));
  }),

  archiveCategory: asyncHandler(async (req, res) => {
    send(res, await categoryService.archive(req.params.id));
  }),

  users: asyncHandler(async (req, res) => {
    send(res, await userService.list(req.query));
  }),

  createUser: asyncHandler(async (req, res) => {
    send(res, await userService.create(req.body), 201);
  }),

  updateUser: asyncHandler(async (req, res) => {
    send(res, await userService.update(req.user, req.params.id, req.body));
  }),

  coupons: asyncHandler(async (_req, res) => {
    send(res, await couponService.listAdmin());
  }),

  activeCoupons: asyncHandler(async (_req, res) => {
    send(res, await couponService.listActive());
  }),

  createCoupon: asyncHandler(async (req, res) => {
    send(res, await couponService.create(req.body), 201);
  }),

  updateCoupon: asyncHandler(async (req, res) => {
    send(res, await couponService.update(req.params.id, req.body));
  }),

  archiveCoupon: asyncHandler(async (req, res) => {
    send(res, await couponService.archive(req.params.id));
  }),

  inventory: asyncHandler(async (req, res) => {
    send(res, await inventoryService.getInventoryReview(req.query));
  }),

  restock: asyncHandler(async (req, res) => {
    send(res, await inventoryService.restockProduct(req.body));
  }),

  gstReport: asyncHandler(async (req, res) => {
    send(res, await gstService.getGstReport(req.query));
  }),

  gstInvoice: asyncHandler(async (req, res) => {
    send(res, await gstService.getOrderInvoice(req.params.orderId));
  }),

  reviewReceipt: asyncHandler(async (req, res) => {
    send(res, await receiptVerificationService.adminReviewReceipt(req.user, req.params.id, req.body.decision, req.body.note));
  }),
};

module.exports = adminController;
