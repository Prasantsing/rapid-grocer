process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-value-123';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-value-123';
process.env.USE_MEMORY_MONGO = 'true';
process.env.SEED_ON_BOOT = 'false';

const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { connectDb, disconnectDb } = require('../src/config/db');
const { seed } = require('../src/seed/seed');
const app = require('../src/app');

async function login(email, password) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  assert.equal(response.status, 200);
  return {
    token: response.body.data.accessToken,
    refreshToken: response.body.data.refreshToken,
    user: response.body.data.user,
    cookie: response.headers['set-cookie'],
  };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

describe('ZapBasket API', () => {
  before(async () => {
    await connectDb();
    await seed();
  });

  after(async () => {
    await disconnectDb();
  });

  it('rejects a short password', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'New Shopper',
      email: 'new@zapbasket.dev',
      password: 'short',
    });
    assert.equal(response.status, 422);
    assert.equal(response.body.success, false);
  });

  it('checks out with a coupon, then a rider delivers the order', async () => {
    const customer = await login('aisha@zapbasket.dev', 'Customer@123');
    assert.equal(customer.user.role, 'customer');
    assert.ok(customer.user.permissions.includes('cart:manage'));

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', customer.cookie);
    assert.equal(refresh.status, 200);
    assert.ok(refresh.body.data.accessToken);

    const reused = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: customer.refreshToken });
    assert.equal(reused.status, 401);

    const products = await request(app).get('/api/v1/products?search=sourdough');
    assert.equal(products.status, 200);
    const bread = products.body.data.items[0];
    const juice = (await request(app).get('/api/v1/products?search=orange')).body.data.items[0];
    const shampoo = (await request(app).get('/api/v1/products?search=shampoo')).body.data.items[0];

    await request(app).delete('/api/v1/cart').set(auth(customer.token));
    for (const product of [bread, juice, shampoo]) {
      const added = await request(app)
        .post('/api/v1/cart/items')
        .set(auth(customer.token))
        .send({ productId: product.id, quantity: 1 });
      assert.equal(added.status, 200);
    }

    const coupon = await request(app)
      .post('/api/v1/cart/coupon')
      .set(auth(customer.token))
      .send({ code: 'welcome50' });
    assert.equal(coupon.status, 200);
    assert.equal(coupon.body.data.coupon.code, 'WELCOME50');
    assert.equal(coupon.body.data.discount, 50);

    const wished = await request(app)
      .post(`/api/v1/wishlist/${bread.id}`)
      .set(auth(customer.token));
    assert.equal(wished.status, 200);

    const addresses = await request(app).get('/api/v1/addresses').set(auth(customer.token));
    assert.equal(addresses.status, 200);
    const addressId = addresses.body.data[0].id;

    const forbidden = await request(app).get('/api/v1/admin/dashboard').set(auth(customer.token));
    assert.equal(forbidden.status, 403);

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set(auth(customer.token))
      .send({ addressId, paymentMethod: 'cod', notes: 'Leave it at the yellow gate' });
    assert.equal(orderResponse.status, 201);
    const order = orderResponse.body.data;
    assert.equal(order.status, 'placed');
    assert.equal(order.paymentStatus, 'cod');
    assert.ok(order.total < order.subtotal);

    const admin = await login('admin@zapbasket.dev', 'Admin@12345');
    const confirmed = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set(auth(admin.token))
      .send({ status: 'confirmed' });
    assert.equal(confirmed.status, 200);

    const partners = await request(app)
      .get('/api/v1/admin/users?role=delivery')
      .set(auth(admin.token));
    assert.equal(partners.status, 200);
    const partnerId = partners.body.data.items[0].id;

    const assigned = await request(app)
      .patch(`/api/v1/orders/${order.id}/assign`)
      .set(auth(admin.token))
      .send({ deliveryPartnerId: partnerId });
    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.data.deliveryPartner.id, partnerId);

    const rider = await login('ravi@zapbasket.dev', 'Delivery@123');
    const active = await request(app)
      .get('/api/v1/orders?scope=active')
      .set(auth(rider.token));
    assert.equal(active.status, 200);
    assert.ok(active.body.data.items.some((item) => item.id === order.id));

    const accepted = await request(app)
      .post(`/api/v1/orders/${order.id}/accept`)
      .set(auth(rider.token));
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.data.status, 'packed');

    const out = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set(auth(rider.token))
      .send({ status: 'out_for_delivery' });
    assert.equal(out.status, 200);

    const delivered = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set(auth(rider.token))
      .send({ status: 'delivered', note: 'Handed to Aisha' });
    assert.equal(delivered.status, 200);
    assert.equal(delivered.body.data.status, 'delivered');

    const history = await request(app).get('/api/v1/orders').set(auth(customer.token));
    assert.ok(history.body.data.items.some((item) => item.id === order.id && item.status === 'delivered'));

    const notes = await request(app).get('/api/v1/notifications').set(auth(customer.token));
    assert.equal(notes.status, 200);
    assert.ok(notes.body.data.unread >= 1);

    const dashboard = await request(app).get('/api/v1/admin/dashboard').set(auth(admin.token));
    assert.equal(dashboard.status, 200);
    assert.ok(dashboard.body.data.orders >= 1);
  });

  it('verifies a demo Razorpay payment', async () => {
    const customer = await login('aisha@zapbasket.dev', 'Customer@123');
    const milk = (await request(app).get('/api/v1/products?search=toned')).body.data.items[0];
    await request(app).delete('/api/v1/cart').set(auth(customer.token));
    await request(app).post('/api/v1/cart/items').set(auth(customer.token)).send({ productId: milk.id, quantity: 1 });
    const addressId = (await request(app).get('/api/v1/addresses').set(auth(customer.token))).body.data[0].id;
    const order = (await request(app)
      .post('/api/v1/orders')
      .set(auth(customer.token))
      .send({ addressId, paymentMethod: 'razorpay' })).body.data;

    const payment = await request(app)
      .post('/api/v1/payments/razorpay/order')
      .set(auth(customer.token))
      .send({ orderId: order.id });
    assert.equal(payment.status, 200);
    assert.equal(payment.body.data.mode, 'demo');

    const verified = await request(app)
      .post('/api/v1/payments/razorpay/verify')
      .set(auth(customer.token))
      .send({
        orderId: order.id,
        razorpayOrderId: payment.body.data.razorpayOrderId,
        razorpayPaymentId: `pay_demo_${order.orderNumber}`,
        razorpaySignature: 'demo',
      });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.data.paymentStatus, 'paid');
  });
});
