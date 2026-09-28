const crypto = require('crypto');
const env = require('../config/env');
const orderRepository = require('../repositories/order.repository');
const notificationService = require('./notification.service');
const { presentOrder } = require('../utils/presenters');
const ApiError = require('../utils/ApiError');

function razorpayClient() {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) return null;
  const Razorpay = require('razorpay');
  return new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
}

function signaturesMatch(razorpayOrderId, razorpayPaymentId, signature) {
  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  const left = Buffer.from(expected);
  const right = Buffer.from(String(signature || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function owns(order, user) {
  return String(order.user?._id || order.user) === String(user._id);
}

const paymentService = {
  async createRazorpayOrder(user, orderId) {
    const order = await orderRepository.findById(orderId);
    if (!order || !owns(order, user)) throw new ApiError(404, 'Order not found');
    if (order.paymentMethod !== 'razorpay') throw new ApiError(400, 'This order is cash on delivery');
    if (order.status === 'cancelled') throw new ApiError(409, 'This order was cancelled');
    if (order.paymentStatus === 'paid') throw new ApiError(409, 'Payment is already complete');

    const amount = Math.round(order.total * 100);
    if (amount <= 0) {
      order.paymentStatus = 'paid';
      order.timeline.push({ status: order.status, note: 'No payment due', at: new Date(), by: user._id });
      await orderRepository.save(order);
      return { mode: 'free', amount: 0, currency: 'INR', orderId: String(order._id), order: presentOrder(order, 'customer') };
    }

    const client = razorpayClient();
    if (!client) {
      order.razorpayOrderId = `order_demo_${order.orderNumber}`;
      await orderRepository.save(order);
      return {
        mode: 'demo',
        keyId: null,
        razorpayOrderId: order.razorpayOrderId,
        amount,
        currency: 'INR',
        orderId: String(order._id),
        orderNumber: order.orderNumber,
      };
    }

    const created = await client.orders.create({
      amount,
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { orderId: String(order._id) },
    });
    order.razorpayOrderId = created.id;
    await orderRepository.save(order);
    return {
      mode: 'live',
      keyId: env.razorpay.keyId,
      razorpayOrderId: created.id,
      amount,
      currency: 'INR',
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      customer: { name: user.name, email: user.email, phone: user.phone || '' },
    };
  },

  async verify(user, body) {
    const order = await orderRepository.findById(body.orderId);
    if (!order || !owns(order, user)) throw new ApiError(404, 'Order not found');
    if (order.paymentMethod !== 'razorpay') throw new ApiError(400, 'This order is cash on delivery');
    if (order.paymentStatus === 'paid') return presentOrder(order, 'customer');
    if (!order.razorpayOrderId || order.razorpayOrderId !== body.razorpayOrderId) {
      throw new ApiError(400, 'Payment does not match this order');
    }

    const demoMode = !env.razorpay.keyId || !env.razorpay.keySecret;
    const valid = demoMode
      ? body.razorpayOrderId.startsWith('order_demo_') && String(body.razorpayPaymentId || '').startsWith('pay_demo_')
      : signaturesMatch(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature);

    if (!valid) {
      order.paymentStatus = 'failed';
      await orderRepository.save(order);
      throw new ApiError(400, 'Payment verification failed');
    }

    order.paymentStatus = 'paid';
    order.razorpayPaymentId = body.razorpayPaymentId;
    order.timeline.push({ status: order.status, note: 'Payment received', at: new Date(), by: user._id });
    await orderRepository.save(order);
    await notificationService.create({
      user: user._id,
      title: 'Payment received',
      body: `We received ₹${order.total} for ${order.orderNumber}.`,
      type: 'order',
      link: `/orders/${order._id}`,
    });
    const fresh = await orderRepository.findById(order._id);
    return presentOrder(fresh, 'customer');
  },
};

module.exports = paymentService;
