const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateCoupon, summarize, discountPercent } = require('../src/domain/pricing');
const { canActorTransition } = require('../src/domain/orderState');
const { resolvePermissions, PERMISSIONS } = require('../src/config/permissions');

describe('pricing', () => {
  const coupon = {
    code: 'FRESH10',
    isActive: true,
    type: 'percent',
    value: 10,
    minOrder: 249,
    maxDiscount: 80,
    usageLimit: 10,
    usedCount: 0,
    expiresAt: new Date(Date.now() + 86400000),
  };

  it('rejects a basket under the minimum', () => {
    const result = evaluateCoupon(coupon, 100);
    assert.equal(result.ok, false);
  });

  it('caps percent discounts', () => {
    const result = evaluateCoupon(coupon, 1000);
    assert.equal(result.ok, true);
    assert.equal(result.discount, 80);
  });

  it('waives delivery over the free threshold', () => {
    const summary = summarize([{ price: 150, quantity: 2 }], null);
    assert.equal(summary.subtotal, 300);
    assert.equal(summary.deliveryFee, 0);
    assert.equal(summary.total, 300);
  });

  it('charges delivery on a small basket', () => {
    const summary = summarize([{ price: 48, quantity: 1 }], null);
    assert.equal(summary.deliveryFee, 25);
    assert.equal(summary.total, 73);
  });

  it('computes a discount badge', () => {
    assert.equal(discountPercent(80, 100), 20);
    assert.equal(discountPercent(100, 100), 0);
  });
});

describe('order transitions', () => {
  it('lets an admin confirm a placed order', () => {
    assert.equal(canActorTransition('admin', 'placed', 'confirmed'), true);
  });

  it('blocks a rider from skipping to delivered', () => {
    assert.equal(canActorTransition('delivery', 'packed', 'delivered'), false);
    assert.equal(canActorTransition('delivery', 'out_for_delivery', 'delivered'), true);
  });

  it('lets a customer cancel only before packing', () => {
    assert.equal(canActorTransition('customer', 'confirmed', 'cancelled'), true);
    assert.equal(canActorTransition('customer', 'packed', 'cancelled'), false);
  });
});

describe('permissions', () => {
  it('grants and revokes on top of the role', () => {
    const permissions = resolvePermissions({
      role: 'delivery',
      permissionGrants: [PERMISSIONS.ORDERS_READ_ALL],
      permissionRevokes: [PERMISSIONS.ORDERS_ACCEPT],
    });
    assert.equal(permissions.includes(PERMISSIONS.ORDERS_READ_ALL), true);
    assert.equal(permissions.includes(PERMISSIONS.ORDERS_ACCEPT), false);
    assert.equal(permissions.includes(PERMISSIONS.ORDERS_DELIVER), true);
  });

  it('ignores unknown grants', () => {
    const permissions = resolvePermissions({
      role: 'customer',
      permissionGrants: ['not-a-permission'],
      permissionRevokes: [],
    });
    assert.equal(permissions.includes('not-a-permission'), false);
    assert.equal(permissions.includes(PERMISSIONS.CART_MANAGE), true);
  });
});
