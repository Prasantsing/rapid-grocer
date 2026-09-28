const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ZapBasket API',
    version: '1.0.0',
    description: 'Grocery delivery API for customers, store admins, and delivery partners. Authenticate with an access token. Refresh tokens rotate on each use and are also set as an httpOnly cookie.',
  },
  servers: [{ url: '/api/v1', description: 'Current host' }],
  tags: [
    { name: 'Auth' },
    { name: 'Catalog' },
    { name: 'Cart' },
    { name: 'Wishlist' },
    { name: 'Addresses' },
    { name: 'Orders' },
    { name: 'Payments' },
    { name: 'Notifications' },
    { name: 'Admin' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: { path: { type: 'string' }, message: { type: 'string' } },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: { tags: ['Auth'], summary: 'Health check', responses: { 200: { description: 'Service is up' } } },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a customer',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, password: { type: 'string' } } } } } },
        responses: { 201: { description: 'Account created' }, 409: { description: 'Email already used' }, 422: { description: 'Validation failed' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } } } },
        responses: { 200: { description: 'Access token, refresh token, and user' }, 401: { description: 'Invalid credentials' } },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate refresh token',
        description: 'Send the refresh token cookie or `{ "refreshToken": "..." }`. The previous token is revoked.',
        responses: { 200: { description: 'New token pair' }, 401: { description: 'Refresh token invalid' } },
      },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Revoke refresh token', responses: { 200: { description: 'Logged out' } } },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Current user and effective permissions', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Profile' } } },
      patch: { tags: ['Auth'], summary: 'Update name or phone', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Updated profile' } } },
    },
    '/categories': { get: { tags: ['Catalog'], summary: 'List active categories', responses: { 200: { description: 'Categories' } } } },
    '/categories/{slug}': { get: { tags: ['Catalog'], summary: 'Category by slug', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Category' } } } },
    '/products': {
      get: {
        tags: ['Catalog'],
        summary: 'Search and browse products',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Category slug' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'price_asc', 'price_desc', 'name'] } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Paged products' } },
      },
    },
    '/products/{slug}': { get: { tags: ['Catalog'], summary: 'Product details', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Product' } } } },
    '/cart': {
      get: { tags: ['Cart'], summary: 'Get priced cart', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Cart with server-side prices' } } },
      delete: { tags: ['Cart'], summary: 'Clear cart', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Empty cart' } } },
    },
    '/cart/items': {
      post: { tags: ['Cart'], summary: 'Add item', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['productId'], properties: { productId: { type: 'string' }, quantity: { type: 'integer' } } } } } }, responses: { 200: { description: 'Updated cart' } } },
    },
    '/cart/items/{productId}': {
      patch: { tags: ['Cart'], summary: 'Set quantity (0 removes)', security: [{ bearerAuth: [] }], parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated cart' } } },
      delete: { tags: ['Cart'], summary: 'Remove item', security: [{ bearerAuth: [] }], parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated cart' } } },
    },
    '/cart/coupon': {
      post: { tags: ['Cart'], summary: 'Apply coupon', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Cart with discount' } } },
      delete: { tags: ['Cart'], summary: 'Remove coupon', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Cart' } } },
    },
    '/wishlist': { get: { tags: ['Wishlist'], summary: 'List wishlist', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Wishlist' } } } },
    '/wishlist/{productId}': {
      post: { tags: ['Wishlist'], summary: 'Save product', security: [{ bearerAuth: [] }], parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Wishlist' } } },
      delete: { tags: ['Wishlist'], summary: 'Remove product', security: [{ bearerAuth: [] }], parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Wishlist' } } },
    },
    '/addresses': {
      get: { tags: ['Addresses'], summary: 'List addresses', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Addresses' } } },
      post: { tags: ['Addresses'], summary: 'Create address', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Address created' } } },
    },
    '/addresses/{id}': {
      patch: { tags: ['Addresses'], summary: 'Update address', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Addresses'], summary: 'Delete address', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Deleted' } } },
    },
    '/coupons/active': { get: { tags: ['Cart'], summary: 'Coupons a customer can try', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Active coupons' } } } },
    '/orders': {
      get: {
        tags: ['Orders'],
        summary: 'List orders for the current role',
        description: 'Customers see their orders. Admins see every order. Delivery partners use scope=available|active|history.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'scope', in: 'query', schema: { type: 'string', enum: ['available', 'active', 'history'] } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Paged orders' } },
      },
      post: {
        tags: ['Orders'],
        summary: 'Place an order from the current cart',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['addressId', 'paymentMethod'], properties: { addressId: { type: 'string' }, paymentMethod: { type: 'string', enum: ['cod', 'razorpay'] }, notes: { type: 'string' } } } } } },
        responses: { 201: { description: 'Order placed and stock reserved' } },
      },
    },
    '/orders/{id}': { get: { tags: ['Orders'], summary: 'Order details', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Order' } } } },
    '/orders/{id}/cancel': { post: { tags: ['Orders'], summary: 'Cancel a placed or confirmed order', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Cancelled and stock restored' } } } },
    '/orders/{id}/accept': { post: { tags: ['Orders'], summary: 'Delivery partner accepts an order', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Accepted' } } } },
    '/orders/{id}/status': { patch: { tags: ['Orders'], summary: 'Advance delivery status', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Status updated' } } } },
    '/orders/{id}/assign': { patch: { tags: ['Orders'], summary: 'Admin assigns a delivery partner', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Assigned' } } } },
    '/payments/razorpay/order': {
      post: {
        tags: ['Payments'],
        summary: 'Create a Razorpay order, or a demo order when keys are not configured',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Payment payload. mode is live, demo, or free.' } },
      },
    },
    '/payments/razorpay/verify': {
      post: {
        tags: ['Payments'],
        summary: 'Verify Razorpay signature',
        description: 'In demo mode send razorpayPaymentId starting with pay_demo_.',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Order marked paid' }, 400: { description: 'Verification failed' } },
      },
    },
    '/notifications': { get: { tags: ['Notifications'], summary: 'List notifications', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Notifications and unread count' } } } },
    '/notifications/read-all': { post: { tags: ['Notifications'], summary: 'Mark all read', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Updated' } } } },
    '/notifications/{id}/read': { patch: { tags: ['Notifications'], summary: 'Mark one read', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } } },
    '/admin/dashboard': { get: { tags: ['Admin'], summary: 'Operations dashboard', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Revenue, status mix, low stock, recent orders' } } } },
    '/admin/reports': { get: { tags: ['Admin'], summary: 'Sales report', security: [{ bearerAuth: [] }], parameters: [{ name: 'from', in: 'query', schema: { type: 'string' } }, { name: 'to', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Report' } } } },
    '/admin/permissions': { get: { tags: ['Admin'], summary: 'Permission catalog and role defaults', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Permissions' } } } },
    '/admin/products': {
      get: { tags: ['Admin'], summary: 'All products, including archived', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Products' } } },
      post: { tags: ['Admin'], summary: 'Create product', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
    },
    '/admin/products/{id}': {
      patch: { tags: ['Admin'], summary: 'Update product', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Admin'], summary: 'Archive product', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Archived' } } },
    },
    '/admin/categories': {
      get: { tags: ['Admin'], summary: 'All categories', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Categories' } } },
      post: { tags: ['Admin'], summary: 'Create category', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
    },
    '/admin/categories/{id}': {
      patch: { tags: ['Admin'], summary: 'Update category', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Admin'], summary: 'Archive category', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Archived' } } },
    },
    '/admin/users': {
      get: { tags: ['Admin'], summary: 'List users', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Users' } } },
      post: { tags: ['Admin'], summary: 'Create admin, customer, or delivery partner', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
    },
    '/admin/users/{id}': { patch: { tags: ['Admin'], summary: 'Update role, status, or permission overrides', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } } },
    '/admin/coupons': {
      get: { tags: ['Admin'], summary: 'List coupons', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Coupons' } } },
      post: { tags: ['Admin'], summary: 'Create coupon', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
    },
    '/admin/coupons/{id}': {
      patch: { tags: ['Admin'], summary: 'Update coupon', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Admin'], summary: 'Deactivate coupon', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Deactivated' } } },
    },
  },
};

module.exports = { swaggerSpec };
