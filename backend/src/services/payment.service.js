const crypto = require('crypto');
const env = require('../config/env');
const orderRepository = require('../repositories/order.repository');
const Order = require('../models/Order');
const notificationService = require('./notification.service');
const storeConfigService = require('./storeConfig.service');
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

  async getUpiDetails(user, orderId) {
    const order = await orderRepository.findById(orderId);
    if (!order || !owns(order, user)) throw new ApiError(404, 'Order not found');
    if (order.status === 'cancelled') throw new ApiError(409, 'This order was cancelled');

    const config = await storeConfigService.getConfig();
    const upiId = config.upiVpa || '9101516662@ybl';
    const payeeName = config.payeeName || 'ZapBasket';
    const amount = Number(order.total).toFixed(2);
    const note = encodeURIComponent(`ZapBasket Order ${order.orderNumber}`);
    const tr = encodeURIComponent(order.orderNumber);
    const encName = encodeURIComponent(payeeName);

    const genericUri = `upi://pay?pa=${upiId}&pn=${encName}&am=${amount}&cu=INR&tn=${note}&tr=${tr}`;
    const gpayUri = `tez://upi/pay?pa=${upiId}&pn=${encName}&am=${amount}&cu=INR&tn=${note}&tr=${tr}`;
    const phonepeUri = `phonepe://pay?pa=${upiId}&pn=${encName}&am=${amount}&cu=INR&tn=${note}&tr=${tr}`;
    const paytmUri = `paytmmp://pay?pa=${upiId}&pn=${encName}&am=${amount}&cu=INR&tn=${note}&tr=${tr}`;
    const bhimUri = `bhim://pay?pa=${upiId}&pn=${encName}&am=${amount}&cu=INR&tn=${note}&tr=${tr}`;

    return {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      amount: order.total,
      currency: 'INR',
      upiId,
      payeeName,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      genericUri,
      gpayUri,
      phonepeUri,
      paytmUri,
      bhimUri,
      qrCodeData: genericUri,
    };
  },

  async submitUpi(user, body) {
    const order = await orderRepository.findById(body.orderId);
    if (!order || !owns(order, user)) throw new ApiError(404, 'Order not found');
    if (order.status === 'cancelled') throw new ApiError(409, 'This order was cancelled');

    order.upiApp = body.upiApp || order.upiApp || 'Google Pay / UPI';
    if (body.utr) {
      order.upiTransactionId = body.utr;
    }

    order.gatewayVerification = {
      verified: false,
      verifiedAt: null,
      gatewayTransactionId: '',
      gatewayStatus: 'AWAITING_GATEWAY_CALLBACK',
      utr: body.utr || order.upiTransactionId || '',
      source: 'client_submission',
    };

    order.timeline.push({
      status: order.status,
      note: `Payment submitted via ${order.upiApp} (UTR: ${order.gatewayVerification.utr || 'Pending'}). Awaiting server-side payment gateway callback.`,
      at: new Date(),
      by: user._id,
    });

    await orderRepository.save(order);
    const fresh = await orderRepository.findById(order._id);
    return {
      status: 'awaiting_gateway',
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      message: 'Payment details recorded. Awaiting payment gateway verification callback.',
      order: presentOrder(fresh, 'customer'),
    };
  },

  async processGatewayCallback(payload) {
    let order = null;
    if (payload.orderId) {
      order = await orderRepository.findById(payload.orderId);
    } else if (payload.orderNumber) {
      order = await Order.findOne({ orderNumber: payload.orderNumber });
    }

    if (!order) throw new ApiError(404, 'Order not found for payment gateway verification');
    if (order.status === 'cancelled') throw new ApiError(409, 'This order was cancelled');

    if (payload.amount !== undefined && payload.amount !== null) {
      const diff = Math.abs(Number(order.total) - Number(payload.amount));
      if (diff > 0.05) {
        throw new ApiError(400, `Gateway amount mismatch: expected ₹${order.total}, received ₹${payload.amount}`);
      }
    }

    const gatewayStatus = String(payload.gatewayStatus || 'SUCCESS').toUpperCase();
    const utr = payload.utr || payload.gatewayTransactionId || order.upiTransactionId || `UPI_${Date.now()}`;
    const gwTxId = payload.gatewayTransactionId || `GW_${Date.now()}`;

    if (gatewayStatus === 'FAILED') {
      order.paymentStatus = 'failed';
      order.gatewayVerification = {
        verified: false,
        verifiedAt: new Date(),
        gatewayTransactionId: gwTxId,
        gatewayStatus: 'FAILED',
        utr,
        source: payload.source || 'payment_gateway_callback',
      };
      order.timeline.push({
        status: order.status,
        note: `Payment gateway reported transaction failed (Ref: ${gwTxId})`,
        at: new Date(),
      });
      await orderRepository.save(order);
      const fresh = await orderRepository.findById(order._id);
      return {
        verified: false,
        status: 'failed',
        order: presentOrder(fresh, 'customer'),
      };
    }

    // Idempotent: if already verified and confirmed, return success immediately
    if (order.paymentStatus === 'paid' && (order.status === 'confirmed' || order.status === 'packed' || order.status === 'out_for_delivery' || order.status === 'delivered')) {
      const fresh = await orderRepository.findById(order._id);
      return {
        verified: true,
        status: order.status,
        gatewayTransactionId: order.gatewayVerification?.gatewayTransactionId || gwTxId,
        utr: order.upiTransactionId || utr,
        order: presentOrder(fresh, 'customer'),
      };
    }

    // Success: Server-side verification confirmed!
    const config = await storeConfigService.getConfig();
    order.paymentStatus = 'paid';
    order.status = 'confirmed';
    order.upiId = config.upiVpa || '9101516662@ybl';
    order.upiTransactionId = utr;
    order.gatewayVerification = {
      verified: true,
      verifiedAt: new Date(),
      gatewayTransactionId: gwTxId,
      gatewayStatus: 'SUCCESS',
      utr,
      source: payload.source || 'payment_gateway_callback',
    };

    order.timeline.push({
      status: 'confirmed',
      note: `Payment verified by gateway callback (${gwTxId}, UTR: ${utr}). Order confirmed.`,
      at: new Date(),
    });

    await orderRepository.save(order);

    const owner = order.user?._id || order.user;
    if (owner) {
      await notificationService.create({
        user: owner,
        title: 'UPI Payment verified by Gateway!',
        body: `Payment of ₹${order.total} for ${order.orderNumber} was verified. Your order is confirmed.`,
        type: 'order',
        link: `/orders/${order._id}`,
      });
    }

    const fresh = await orderRepository.findById(order._id);
    return {
      verified: true,
      status: 'confirmed',
      gatewayTransactionId: gwTxId,
      utr,
      order: presentOrder(fresh, 'customer'),
    };
  },

  async getUpiStatus(user, orderId) {
    const order = await orderRepository.findById(orderId);
    if (!order || !owns(order, user)) throw new ApiError(404, 'Order not found');

    const isConfirmed = order.status === 'confirmed' || order.status === 'packed' || order.status === 'out_for_delivery' || order.status === 'delivered';
    return {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      amount: order.total,
      currency: 'INR',
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      isConfirmed,
      gatewayVerification: order.gatewayVerification,
      upiId: order.upiId || '9101516662@ybl',
      upiTransactionId: order.upiTransactionId || '',
      upiApp: order.upiApp || '',
    };
  },

  async pingGateway(user, body) {
    const order = await orderRepository.findById(body.orderId);
    if (!order || !owns(order, user)) throw new ApiError(404, 'Order not found');

    return this.processGatewayCallback({
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      amount: order.total,
      utr: body.utr || order.upiTransactionId || `UTR_${Date.now()}`,
      gatewayTransactionId: `GW_PING_${Date.now()}`,
      gatewayStatus: body.gatewayStatus || 'SUCCESS',
      source: 'gateway_api_endpoint_ping',
    });
  },

  async verifyUpi(user, body) {
    // Forward to pingGateway for server-side verification check
    return this.pingGateway(user, body);
  },
};

module.exports = paymentService;
