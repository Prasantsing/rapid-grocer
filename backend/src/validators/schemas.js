const { z } = require('zod');
const { STATUSES } = require('../domain/orderState');
const { ALL_PERMISSIONS } = require('../config/permissions');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const phone = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');
const optionalPhone = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  phone.optional()
);
const password = z.string()
  .min(8, 'Use at least 8 characters')
  .max(72)
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/\d/, 'Password must include a number');
const tint = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a hex color like #1F7A4D');
const slug = z.string().trim().min(1).max(120);

const paging = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    phone: optionalPhone,
    password,
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1).max(72),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10).optional(),
  }).optional().default({}),
});

const updateMeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: optionalPhone,
  }),
});

const productQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(80).optional(),
    category: slug.optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'name']).default('newest'),
    includeInactive: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(60).default(24),
  }),
});

const slugParamsSchema = z.object({
  params: z.object({ slug }),
});

const productBody = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  categoryId: objectId,
  brand: z.string().trim().max(80).optional(),
  price: z.number().positive().max(100000),
  mrp: z.number().positive().max(100000),
  unit: z.string().trim().min(1).max(40),
  stock: z.number().int().min(0).max(100000),
  emoji: z.string().trim().min(1).max(8).optional(),
  tint: tint.optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).optional(),
  isActive: z.boolean().optional(),
});

const createProductSchema = z.object({ body: productBody });
const updateProductSchema = z.object({
  params: z.object({ id: objectId }),
  body: productBody.partial(),
});
const idParamsSchema = z.object({
  params: z.object({ id: objectId }),
});

const categoryBody = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  emoji: z.string().trim().min(1).max(8).optional(),
  tint: tint.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

const createCategorySchema = z.object({ body: categoryBody });
const updateCategorySchema = z.object({
  params: z.object({ id: objectId }),
  body: categoryBody.partial(),
});

const cartItemSchema = z.object({
  body: z.object({
    productId: objectId,
    quantity: z.number().int().min(1).max(20).default(1),
  }),
});

const updateCartItemSchema = z.object({
  params: z.object({ productId: objectId }),
  body: z.object({ quantity: z.number().int().min(0).max(20) }),
});

const productIdParamsSchema = z.object({
  params: z.object({ productId: objectId }),
});

const couponCodeSchema = z.object({
  body: z.object({ code: z.string().trim().min(3).max(20) }),
});

const addressBody = z.object({
  label: z.enum(['Home', 'Work', 'Other']).optional(),
  fullName: z.string().trim().min(2).max(80),
  phone,
  line1: z.string().trim().min(4).max(160),
  line2: z.string().trim().max(160).optional(),
  landmark: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a 6-digit pincode'),
  isDefault: z.boolean().optional(),
});

const createAddressSchema = z.object({ body: addressBody });
const updateAddressSchema = z.object({
  params: z.object({ id: objectId }),
  body: addressBody.partial(),
});

const placeOrderSchema = z.object({
  body: z.object({
    addressId: objectId,
    paymentMethod: z.enum(['cod', 'razorpay']),
    notes: z.string().trim().max(240).optional(),
  }),
});

const orderListSchema = z.object({
  query: z.object({
    ...paging,
    status: z.enum(STATUSES).optional(),
    scope: z.enum(['available', 'active', 'history']).optional(),
    search: z.string().trim().max(40).optional(),
  }),
});

const statusSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    status: z.enum(STATUSES),
    note: z.string().trim().max(200).optional(),
  }),
});

const assignSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({ deliveryPartnerId: objectId }),
});

const cancelSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({ note: z.string().trim().max(200).optional() }).optional().default({}),
});

const paymentOrderSchema = z.object({
  body: z.object({ orderId: objectId }),
});

const verifyPaymentSchema = z.object({
  body: z.object({
    orderId: objectId,
    razorpayOrderId: z.string().min(3),
    razorpayPaymentId: z.string().min(3),
    razorpaySignature: z.string().optional(),
  }),
});

const notificationListSchema = z.object({
  query: z.object(paging),
});

const userListSchema = z.object({
  query: z.object({
    ...paging,
    role: z.enum(['admin', 'customer', 'delivery']).optional(),
    search: z.string().trim().max(80).optional(),
    activeOnly: z.enum(['true', 'false']).optional(),
  }),
});

const createUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    phone: optionalPhone,
    password,
    role: z.enum(['admin', 'customer', 'delivery']),
    isActive: z.boolean().optional(),
  }),
});

const updateUserSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: optionalPhone,
    role: z.enum(['admin', 'customer', 'delivery']).optional(),
    isActive: z.boolean().optional(),
    permissionGrants: z.array(z.enum(ALL_PERMISSIONS)).max(30).optional(),
    permissionRevokes: z.array(z.enum(ALL_PERMISSIONS)).max(30).optional(),
  }),
});

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date');

const couponBody = z.object({
  code: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9]+$/, 'Use letters and numbers only'),
  description: z.string().trim().max(200).optional(),
  type: z.enum(['percent', 'flat']),
  value: z.number().positive(),
  minOrder: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  expiresAt: isoDate.nullable().optional(),
  usageLimit: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const createCouponSchema = z.object({ body: couponBody });
const updateCouponSchema = z.object({
  params: z.object({ id: objectId }),
  body: couponBody.partial(),
});

const reportQuerySchema = z.object({
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateMeSchema,
  productQuerySchema,
  slugParamsSchema,
  createProductSchema,
  updateProductSchema,
  idParamsSchema,
  createCategorySchema,
  updateCategorySchema,
  cartItemSchema,
  updateCartItemSchema,
  productIdParamsSchema,
  couponCodeSchema,
  createAddressSchema,
  updateAddressSchema,
  placeOrderSchema,
  orderListSchema,
  statusSchema,
  assignSchema,
  cancelSchema,
  paymentOrderSchema,
  verifyPaymentSchema,
  notificationListSchema,
  userListSchema,
  createUserSchema,
  updateUserSchema,
  createCouponSchema,
  updateCouponSchema,
  reportQuerySchema,
};
