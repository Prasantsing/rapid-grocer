const PERMISSIONS = {
  CART_MANAGE: 'cart:manage',
  WISHLIST_MANAGE: 'wishlist:manage',
  ADDRESSES_MANAGE: 'addresses:manage',
  ORDERS_CREATE: 'orders:create',
  ORDERS_READ_OWN: 'orders:read_own',
  ORDERS_CANCEL_OWN: 'orders:cancel_own',
  ORDERS_READ_ALL: 'orders:read_all',
  ORDERS_MANAGE: 'orders:manage',
  ORDERS_READ_ASSIGNED: 'orders:read_assigned',
  ORDERS_ACCEPT: 'orders:accept',
  ORDERS_DELIVER: 'orders:deliver',
  PRODUCTS_WRITE: 'products:write',
  CATEGORIES_WRITE: 'categories:write',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  COUPONS_WRITE: 'coupons:write',
  COUPONS_APPLY: 'coupons:apply',
  REPORTS_READ: 'reports:read',
  NOTIFICATIONS_READ: 'notifications:read',
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

const ROLE_PERMISSIONS = {
  admin: [...ALL_PERMISSIONS],
  customer: [
    PERMISSIONS.CART_MANAGE,
    PERMISSIONS.WISHLIST_MANAGE,
    PERMISSIONS.ADDRESSES_MANAGE,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_READ_OWN,
    PERMISSIONS.ORDERS_CANCEL_OWN,
    PERMISSIONS.COUPONS_APPLY,
    PERMISSIONS.NOTIFICATIONS_READ,
  ],
  delivery: [
    PERMISSIONS.ORDERS_READ_ASSIGNED,
    PERMISSIONS.ORDERS_ACCEPT,
    PERMISSIONS.ORDERS_DELIVER,
    PERMISSIONS.NOTIFICATIONS_READ,
  ],
};

function resolvePermissions(user) {
  const role = user?.role;
  const base = new Set(ROLE_PERMISSIONS[role] || []);
  for (const grant of user?.permissionGrants || []) {
    if (ALL_PERMISSIONS.includes(grant)) base.add(grant);
  }
  for (const revoke of user?.permissionRevokes || []) {
    base.delete(revoke);
  }
  return [...base].sort();
}

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  resolvePermissions,
};
