const crypto = require('crypto');
const orderRepository = require('../repositories/order.repository');
const cartRepository = require('../repositories/cart.repository');
const productRepository = require('../repositories/product.repository');
const addressRepository = require('../repositories/address.repository');
const couponRepository = require('../repositories/coupon.repository');
const userRepository = require('../repositories/user.repository');
const couponService = require('./coupon.service');
const notificationService = require('./notification.service');
const storeConfigService = require('./storeConfig.service');
const messagingService = require('./messaging.service');
const aiService = require('./ai.service');
const { summarize } = require('../domain/pricing');
const { STATUS_NOTES, canActorTransition } = require('../domain/orderState');
const { PERMISSIONS, resolvePermissions } = require('../config/permissions');
const { presentOrder, snapshotAddress } = require('../utils/presenters');
const { pageMeta } = require('../utils/pagination');
const { escapeRegex } = require('../utils/slug');
const ApiError = require('../utils/ApiError');

function generateOrderNumber() {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `ZB${stamp}${crypto.randomInt(1000, 10000)}`;
}

function ownerId(order) {
  return String(order.user?._id || order.user);
}

function partnerId(order) {
  if (!order.deliveryPartner) return '';
  return String(order.deliveryPartner._id || order.deliveryPartner);
}

function paymentReady(order) {
  return order.paymentMethod === 'cod' || order.paymentStatus === 'paid';
}

function assertPaymentReady(order) {
  if (!paymentReady(order)) {
    throw new ApiError(409, 'Collect payment before moving this order forward');
  }
}

async function restoreStock(order) {
  for (const item of order.items) {
    if (item.product) await productRepository.restoreStock(item.product, item.quantity);
  }
}

async function notify(user, title, body, link) {
  const id = user?._id || user;
  if (!id) return;
  await notificationService.create({
    user: id,
    title,
    body,
    type: 'order',
    link,
  });
}

function canView(user, order) {
  const perms = resolvePermissions(user);
  if (perms.includes(PERMISSIONS.ORDERS_READ_ALL)) return true;
  if (ownerId(order) === String(user._id) && perms.includes(PERMISSIONS.ORDERS_READ_OWN)) return true;
  if (perms.includes(PERMISSIONS.ORDERS_READ_ASSIGNED)) {
    if (partnerId(order) === String(user._id)) return true;
    if (!partnerId(order) && ['confirmed', 'packed'].includes(order.status) && paymentReady(order)) return true;
  }
  return false;
}

const orderService = {
  async list(user, query) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const perms = resolvePermissions(user);
    const filter = {};

    if (user.role === 'admin' && perms.includes(PERMISSIONS.ORDERS_READ_ALL)) {
      if (query.status) filter.status = query.status;
      if (query.search) filter.orderNumber = new RegExp(escapeRegex(query.search), 'i');
    } else if (user.role === 'delivery' && perms.includes(PERMISSIONS.ORDERS_READ_ASSIGNED)) {
      const scope = query.scope || 'active';
      if (scope === 'available') {
        filter.deliveryPartner = null;
        filter.status = { $in: ['confirmed', 'packed'] };
        filter.$or = [{ paymentMethod: 'cod' }, { paymentStatus: 'paid' }];
      } else if (scope === 'history') {
        filter.deliveryPartner = user._id;
        filter.status = { $in: ['delivered', 'cancelled'] };
      } else {
        filter.deliveryPartner = user._id;
        filter.status = { $in: ['confirmed', 'packed', 'out_for_delivery'] };
      }
    } else {
      filter.user = user._id;
      if (query.status) filter.status = query.status;
    }

    const { items, total } = await orderRepository.search(filter, { page, limit });
    return {
      items: items.map((order) => presentOrder(order, user.role)),
      meta: pageMeta(page, limit, total),
    };
  },

  async getById(user, orderId) {
    const order = await orderRepository.findById(orderId);
    if (!order || !canView(user, order)) throw new ApiError(404, 'Order not found');
    return presentOrder(order, user.role);
  },

  async place(user, input) {
    const cart = await cartRepository.findByUser(user._id);
    if (!cart || cart.items.length === 0) throw new ApiError(400, 'Your cart is empty');

    const address = await addressRepository.findByIdForUser(input.addressId, user._id);
    if (!address) throw new ApiError(404, 'Address not found');

    // Dynamic store status & geofence validation
    await storeConfigService.validateDeliveryEligibility(address);

    const lines = [];
    for (const item of cart.items) {
      const product = await productRepository.findById(item.product);
      if (!product || !product.isActive) {
        throw new ApiError(409, 'A cart item is no longer available. Review your cart and try again.');
      }
      if (product.stock < item.quantity) {
        throw new ApiError(409, `Only ${product.stock} ${product.unit} of ${product.name} left`);
      }
      lines.push({
        product: product._id,
        name: product.name,
        slug: product.slug,
        emoji: product.emoji,
        tint: product.tint,
        unit: product.unit,
        price: product.price,
        mrp: product.mrp,
        quantity: item.quantity,
        isReturnable: Boolean(product.isReturnable),
      });
    }

    const priced = lines.map((line) => ({ price: line.price, quantity: line.quantity }));
    let couponDoc = null;
    const orderCount = await orderRepository.countByUser(user._id);
    if (cart.couponCode) {
      const result = await couponService.assertUsable(cart.couponCode, summarize(priced).subtotal, orderCount);
      couponDoc = result.coupon;
    }
    const summary = summarize(priced, couponDoc, new Date(), orderCount);

    const decremented = [];
    let consumedCode = '';
    try {
      for (const line of lines) {
        const updated = await productRepository.decrementStock(line.product, line.quantity);
        if (!updated) throw new ApiError(409, `${line.name} just sold out. Review your cart.`);
        decremented.push(line);
      }

      if (couponDoc) {
        const consumed = await couponService.consume(couponDoc.code, summary.subtotal, orderCount);
        consumedCode = consumed.coupon.code;
      }

      const paymentStatus = input.paymentMethod === 'cod' || summary.total === 0 ? (input.paymentMethod === 'cod' ? 'cod' : 'paid') : 'pending';

      let order;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          order = await orderRepository.create({
            orderNumber: generateOrderNumber(),
            user: user._id,
            items: lines,
            address: snapshotAddress(address),
            couponCode: consumedCode,
            subtotal: summary.subtotal,
            discount: summary.discount,
            deliveryFee: summary.deliveryFee,
            total: summary.total,
            paymentMethod: input.paymentMethod,
            paymentStatus,
            status: 'placed',
            notes: input.notes || '',
            timeline: [{
              status: 'placed',
              note: STATUS_NOTES.placed,
              at: new Date(),
              by: user._id,
            }],
          });
          break;
        } catch (error) {
          if (error.code === 11000 && attempt < 2) continue;
          throw error;
        }
      }

      await cartRepository.clear(user._id);
      await notify(
        user._id,
        'Order placed',
        `${order.orderNumber} is in. We will confirm it shortly.`,
        `/orders/${order._id}`
      );
      void messagingService.dispatchOrderNotification('order_placed', order);

      const fresh = await orderRepository.findById(order._id);
      return presentOrder(fresh, user.role);
    } catch (error) {
      for (const line of decremented) {
        await productRepository.restoreStock(line.product, line.quantity);
      }
      if (consumedCode) await couponRepository.release(consumedCode);
      throw error;
    }
  },

  async cancel(user, orderId, note) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const isOwner = ownerId(order) === String(user._id);
    if (user.role === 'customer') {
      if (!isOwner) throw new ApiError(403, 'You can only cancel your own orders');

      const config = await storeConfigService.getConfig();
      if (!config.allowCustomerCancellation) {
        throw new ApiError(
          403,
          'Order self-cancellation is currently disabled by store management. Please contact our support desk at ' +
            (config.supportPhone || '+91 9101516662') +
            ' for assistance.'
        );
      }

      const minutesElapsed = (Date.now() - new Date(order.createdAt).getTime()) / (60 * 1000);
      const allowedMinutes = config.cancellationWindowMinutes || 3;
      if (minutesElapsed > allowedMinutes) {
        throw new ApiError(
          400,
          `The ${allowedMinutes}-minute cancellation window has closed. Your order is already being packed for rapid delivery.`
        );
      }
    } else if (user.role !== 'admin') {
      throw new ApiError(403, 'You do not have permission to cancel this order');
    }

    if (!canActorTransition(user.role === 'customer' ? 'customer' : 'admin', order.status, 'cancelled')) {
      throw new ApiError(409, 'This order can no longer be cancelled');
    }

    await restoreStock(order);
    if (order.couponCode) await couponRepository.release(order.couponCode);
    order.status = 'cancelled';
    order.timeline.push({
      status: 'cancelled',
      note: note || STATUS_NOTES.cancelled,
      at: new Date(),
      by: user._id,
    });
    await orderRepository.save(order);
    await notify(ownerId(order), 'Order cancelled', `${order.orderNumber} has been cancelled.`, `/orders/${order._id}`);
    void messagingService.dispatchOrderNotification('order_cancelled', order);
    const fresh = await orderRepository.findById(order._id);
    return presentOrder(fresh, user.role);
  },

  async cancelAndRestoreCart(user, orderId, note) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const isOwner = ownerId(order) === String(user._id);
    if (user.role === 'customer' && !isOwner) {
      throw new ApiError(403, 'You can only cancel your own orders');
    }

    if (order.status === 'cancelled') {
      const fresh = await orderRepository.findById(order._id);
      return { cancelled: true, order: presentOrder(fresh, user.role) };
    }

    if (order.paymentStatus === 'paid') {
      throw new ApiError(400, 'Cannot cancel and restore an already paid order');
    }

    await restoreStock(order);
    if (order.couponCode) await couponRepository.release(order.couponCode);

    order.status = 'cancelled';
    order.timeline.push({
      status: 'cancelled',
      note: note || 'Cancelled by customer during UPI payment - cart restored',
      at: new Date(),
      by: user._id,
    });
    await orderRepository.save(order);

    // Restore items to user cart so the customer doesn't lose their selected items
    const cartItems = order.items.map((item) => ({
      product: item.product?._id || item.product,
      quantity: item.quantity,
    }));
    await cartRepository.setItems(user._id, cartItems, order.couponCode || '');

    await notify(
      ownerId(order),
      'Order cancelled',
      `${order.orderNumber} was cancelled and your cart was restored.`,
      `/cart`
    );

    const fresh = await orderRepository.findById(order._id);
    return {
      cancelled: true,
      restoredItemsCount: cartItems.length,
      order: presentOrder(fresh, user.role),
    };
  },

  async switchToCod(user, orderId) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const isOwner = ownerId(order) === String(user._id);
    if (user.role === 'customer' && !isOwner) {
      throw new ApiError(403, 'You can only modify your own orders');
    }

    if (order.paymentStatus === 'paid') {
      throw new ApiError(400, 'Order is already paid');
    }
    if (order.status === 'cancelled') {
      throw new ApiError(409, 'This order was cancelled');
    }

    order.paymentMethod = 'cod';
    order.paymentStatus = 'cod';
    order.timeline.push({
      status: order.status,
      note: 'Payment method switched from UPI to Cash on Delivery (COD)',
      at: new Date(),
      by: user._id,
    });
    await orderRepository.save(order);

    await notify(
      ownerId(order),
      'Switched to Cash on Delivery',
      `Order ${order.orderNumber} will be delivered with Cash on Delivery (₹${order.total}).`,
      `/orders/${order._id}`
    );

    const fresh = await orderRepository.findById(order._id);
    return presentOrder(fresh, user.role);
  },

  async updateStatus(user, orderId, status, note) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');
    if (!canActorTransition(user.role, order.status, status)) {
      throw new ApiError(409, `Cannot move an order from ${order.status} to ${status}`);
    }
    if (user.role === 'delivery' && partnerId(order) !== String(user._id)) {
      throw new ApiError(403, 'This order is not assigned to you');
    }
    if (status !== 'cancelled') assertPaymentReady(order);
    if (status === 'cancelled') {
      await restoreStock(order);
      if (order.couponCode) await couponRepository.release(order.couponCode);
    }

    order.status = status;
    order.timeline.push({
      status,
      note: note || STATUS_NOTES[status],
      at: new Date(),
      by: user._id,
    });
    await orderRepository.save(order);

    await notify(
      ownerId(order),
      `Order ${status.replaceAll('_', ' ')}`,
      `${order.orderNumber}: ${note || STATUS_NOTES[status]}`,
      `/orders/${order._id}`
    );

    const eventMap = {
      confirmed: 'order_confirmed',
      packed: 'order_packed',
      out_for_delivery: 'out_for_delivery',
      delivered: 'delivered',
      cancelled: 'order_cancelled',
    };
    if (eventMap[status]) {
      void messagingService.dispatchOrderNotification(eventMap[status], order);
    }

    const fresh = await orderRepository.findById(order._id);
    return presentOrder(fresh, user.role);
  },

  async accept(partner, orderId) {
    const existing = await orderRepository.findById(orderId);
    if (!existing) throw new ApiError(404, 'Order not found');
    if (!['confirmed', 'packed'].includes(existing.status)) {
      throw new ApiError(409, 'This order is not ready for pickup');
    }
    assertPaymentReady(existing);
    const currentPartner = partnerId(existing);
    if (currentPartner && currentPartner !== String(partner._id)) {
      throw new ApiError(409, 'Another partner already accepted this order');
    }
    if (currentPartner === String(partner._id) && existing.status === 'packed') {
      return presentOrder(existing, 'delivery');
    }

    const order = await orderRepository.claim(orderId, partner);
    if (!order) throw new ApiError(409, 'This order was just taken by another partner');

    await notify(
      ownerId(order),
      'Partner assigned',
      `${partner.name} is handling ${order.orderNumber}.`,
      `/orders/${order._id}`
    );
    return presentOrder(order, 'delivery');
  },

  async assign(admin, orderId, deliveryPartnerId) {
    const partner = await userRepository.findById(deliveryPartnerId);
    if (!partner || partner.role !== 'delivery' || !partner.isActive) {
      throw new ApiError(400, 'Choose an active delivery partner');
    }
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');
    if (['delivered', 'cancelled'].includes(order.status)) {
      throw new ApiError(409, 'This order can no longer be assigned');
    }
    assertPaymentReady(order);

    order.deliveryPartner = partner._id;
    if (order.status === 'placed') {
      order.status = 'confirmed';
      order.timeline.push({
        status: 'confirmed',
        note: STATUS_NOTES.confirmed,
        at: new Date(),
        by: admin._id,
      });
    }
    order.timeline.push({
      status: order.status,
      note: `Assigned to ${partner.name}`,
      at: new Date(),
      by: admin._id,
    });
    await orderRepository.save(order);
    await notify(partner._id, 'Delivery assigned', `${order.orderNumber} is ready for you.`, '/delivery');
    await notify(ownerId(order), 'Rider assigned', `${partner.name} will deliver ${order.orderNumber}.`, `/orders/${order._id}`);
    void messagingService.dispatchOrderNotification('out_for_delivery', order, {
      riderName: partner.name,
      riderPhone: partner.phone,
    });
    const fresh = await orderRepository.findById(order._id);
    return presentOrder(fresh, 'admin');
  },

  async verifyReceipt(user, orderId, image) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const isOwner = ownerId(order) === String(user._id);
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'You do not have permission to verify this order receipt');
    }

    if (order.status === 'cancelled') {
      throw new ApiError(409, 'Cannot verify receipt for a cancelled order');
    }

    const expectedOrderId = order.orderNumber;
    const expectedAmount = order.total;
    const expectedVpa = order.upiId || '9101516662@ybl';

    const result = await aiService.parsePaymentReceipt({
      image,
      expectedOrderId,
      expectedAmount,
      expectedVpa,
    });

    if (!order.receiptVerification) {
      order.receiptVerification = {};
    }

    order.receiptVerification.receiptImageUrl = image;
    order.receiptVerification.uploadedAt = new Date();
    order.receiptVerification.extractedAmount = result.extracted.amount;
    order.receiptVerification.extractedOrderId = result.extracted.orderId;
    order.receiptVerification.extractedUtr = result.extracted.utr;
    order.receiptVerification.extractedPayeeVpa = result.extracted.payeeVpa;
    order.receiptVerification.extractedPayeeName = result.extracted.payeeName;
    order.receiptVerification.extractedStatus = result.extracted.paymentStatus;
    order.receiptVerification.appName = result.extracted.appName;
    order.receiptVerification.isMatched = result.isMatched;
    order.receiptVerification.matchReason = result.matchReason;
    order.receiptVerification.matchDetails = result.matchDetails;

    if (result.isMatched) {
      order.receiptVerification.verificationStatus = 'verified';
      order.paymentStatus = 'paid';
      if (result.extracted.utr) {
        order.upiTransactionId = result.extracted.utr;
      }
      if (result.extracted.appName) {
        order.upiApp = result.extracted.appName;
      }

      order.timeline.push({
        status: order.status,
        note: `Receipt verified by AI (Matched Order #${expectedOrderId}, ₹${expectedAmount}, UTR: ${result.extracted.utr || 'Extracted'}). Pending admin review.`,
        at: new Date(),
        by: user._id,
      });

      await notify(
        ownerId(order),
        'Payment Receipt Verified',
        `Your receipt for ${order.orderNumber} (₹${order.total}) has been verified. Order is pending admin review for dispatch.`,
        `/orders/${order._id}`
      );
    } else {
      order.receiptVerification.verificationStatus = 'mismatched';
      order.timeline.push({
        status: order.status,
        note: `Receipt upload mismatch: ${result.matchReason}`,
        at: new Date(),
        by: user._id,
      });
    }

    await orderRepository.save(order);
    const fresh = await orderRepository.findById(order._id);
    return {
      success: true,
      isMatched: result.isMatched,
      matchReason: result.matchReason,
      extracted: result.extracted,
      matchDetails: result.matchDetails,
      order: presentOrder(fresh, user.role),
    };
  },

  async submitManualUtr(user, orderId, utr, note = '') {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const isOwner = ownerId(order) === String(user._id);
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'You do not have permission to update this order');
    }

    if (!order.receiptVerification) {
      order.receiptVerification = {};
    }

    order.receiptVerification.manualUtr = utr;
    order.receiptVerification.verificationStatus = 'manual_utr_submitted';
    order.upiTransactionId = utr;

    order.timeline.push({
      status: order.status,
      note: `Customer submitted manual UTR reference: ${utr}${note ? ` (${note})` : ''}. Pending admin review.`,
      at: new Date(),
      by: user._id,
    });

    await orderRepository.save(order);
    const fresh = await orderRepository.findById(order._id);
    return {
      success: true,
      message: 'Manual UTR reference submitted for admin verification.',
      order: presentOrder(fresh, user.role),
    };
  },

  async adminReviewReceipt(adminUser, orderId, decision, note = '') {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    if (!order.receiptVerification) {
      order.receiptVerification = {};
    }

    order.receiptVerification.reviewedAt = new Date();
    order.receiptVerification.reviewedBy = adminUser._id;
    order.receiptVerification.adminReviewNote = note;

    if (decision === 'approve') {
      order.receiptVerification.verificationStatus = 'admin_approved';
      order.paymentStatus = 'paid';

      if (order.status === 'placed') {
        order.status = 'confirmed';
        order.timeline.push({
          status: 'confirmed',
          note: note || 'Payment receipt approved by store manager. Order confirmed.',
          at: new Date(),
          by: adminUser._id,
        });
      } else {
        order.timeline.push({
          status: order.status,
          note: note || 'Payment receipt approved by store manager.',
          at: new Date(),
          by: adminUser._id,
        });
      }

      await notify(
        ownerId(order),
        'Payment Approved & Order Confirmed',
        `Store manager approved your payment for ${order.orderNumber}. Order is being prepared!`,
        `/orders/${order._id}`
      );
    } else {
      order.receiptVerification.verificationStatus = 'admin_rejected';
      order.timeline.push({
        status: order.status,
        note: `Receipt rejected: ${note || 'Invalid payment proof'}. Please re-upload.`,
        at: new Date(),
        by: adminUser._id,
      });

      await notify(
        ownerId(order),
        'Receipt Verification Update',
        `Your receipt for ${order.orderNumber} requires attention: ${note || 'Please re-upload a clear screenshot'}.`,
        `/orders/${order._id}`
      );
    }

    await orderRepository.save(order);
    const fresh = await orderRepository.findById(order._id);
    return presentOrder(fresh, 'admin');
  },

  async submitFeedback(user, orderId, { storeRating, riderRating, deliveryTags, comments }) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');
    if (ownerId(order) !== String(user._id) && user.role !== 'admin') {
      throw new ApiError(403, 'You can only review your own orders');
    }
    if (order.status !== 'delivered') {
      throw new ApiError(400, 'Feedback can only be submitted for delivered orders');
    }

    order.feedback = {
      storeRating,
      riderRating: riderRating || null,
      deliveryTags: deliveryTags || [],
      comments: comments || '',
      submittedAt: new Date(),
    };

    await orderRepository.save(order);

    if (riderRating && order.deliveryPartner) {
      await notify(
        partnerId(order),
        '⭐ Customer Rated Your Delivery',
        `Customer gave you ${riderRating} stars for order #${order.orderNumber}!`,
        `/rider`
      );
    }

    const fresh = await orderRepository.findById(orderId);
    return presentOrder(fresh, user.role);
  },

  async submitTip(user, orderId, { amount, upiTransactionId }) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');
    if (ownerId(order) !== String(user._id) && user.role !== 'admin') {
      throw new ApiError(403, 'You can only tip for your own orders');
    }
    if (order.status !== 'delivered') {
      throw new ApiError(400, 'Tips can only be added for delivered orders');
    }

    order.tip = {
      amount,
      status: 'paid',
      upiTransactionId: upiTransactionId || `TIP-${Date.now()}`,
      paidAt: new Date(),
    };

    await orderRepository.save(order);

    if (order.deliveryPartner) {
      await notify(
        partnerId(order),
        '💰 Customer Sent You a Tip!',
        `You received a ₹${amount} tip for order #${order.orderNumber}. Thank you for your fast delivery!`,
        `/rider`
      );
    }

    const fresh = await orderRepository.findById(orderId);
    return presentOrder(fresh, user.role);
  },

  async getFeedbackSummary() {
    const OrderModel = require('../models/Order');
    let ordersWithFeedback = [];
    let ordersWithTip = [];
    try {
      ordersWithFeedback = await OrderModel.find({ 'feedback.storeRating': { $exists: true, $ne: null } })
        .populate([
          { path: 'user', select: 'name email phone' },
          { path: 'deliveryPartner', select: 'name phone' },
        ])
        .sort({ 'feedback.submittedAt': -1 })
        .limit(50);

      ordersWithTip = await OrderModel.find({ 'tip.status': 'paid' });
    } catch (_) {
      // fallback
    }

    const totalRatings = ordersWithFeedback.length;
    const storeRatingSum = ordersWithFeedback.reduce((acc, o) => acc + (o.feedback?.storeRating || 0), 0);
    const avgStoreRating = totalRatings > 0 ? Number((storeRatingSum / totalRatings).toFixed(1)) : 5.0;

    const riderRatings = ordersWithFeedback.filter((o) => o.feedback?.riderRating);
    const riderRatingSum = riderRatings.reduce((acc, o) => acc + (o.feedback?.riderRating || 0), 0);
    const avgRiderRating = riderRatings.length > 0 ? Number((riderRatingSum / riderRatings.length).toFixed(1)) : 5.0;

    const totalTips = ordersWithTip.reduce((acc, o) => acc + (o.tip?.amount || 0), 0);

    const recentFeedback = ordersWithFeedback.slice(0, 20).map((o) => ({
      orderId: o._id,
      orderNumber: o.orderNumber,
      customerName: o.user?.name || 'Customer',
      storeRating: o.feedback.storeRating,
      riderRating: o.feedback.riderRating,
      deliveryTags: o.feedback.deliveryTags || [],
      comments: o.feedback.comments || '',
      submittedAt: o.feedback.submittedAt,
      tipAmount: o.tip?.amount || 0,
      riderName: o.deliveryPartner?.name || 'Unassigned',
    }));

    return {
      summary: {
        totalRatings,
        avgStoreRating,
        avgRiderRating,
        totalTipsCollected: totalTips,
        tipsCount: ordersWithTip.length,
      },
      recentFeedback,
    };
  },
};

module.exports = orderService;
