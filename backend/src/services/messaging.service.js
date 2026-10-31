const MessageLog = require('../models/MessageLog');
const storeConfigService = require('./storeConfig.service');

function normalizePhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

const messagingService = {
  buildMessage(eventType, { customerName, orderNumber, total, riderName, riderPhone, supportPhone, orderId }) {
    const trackingLink = orderId ? `https://zapbasket.store/orders/${orderId}` : '';
    switch (eventType) {
      case 'order_placed':
        return `ZapBasket: Hi ${customerName}, your order #${orderNumber} of ₹${total} is placed! Prepping your dark store bag now.`;
      case 'order_confirmed':
        return `ZapBasket: Order #${orderNumber} is confirmed! Our store team is packing fresh groceries for rapid delivery.`;
      case 'order_packed':
        return `ZapBasket: Order #${orderNumber} is packed and assigned for rider pickup.`;
      case 'out_for_delivery':
        return `ZapBasket: Order #${orderNumber} is OUT FOR DELIVERY! 🛵 Rider: ${riderName}${riderPhone ? ` (${riderPhone})` : ''}. Track live: ${trackingLink || '/orders'}`;
      case 'delivered':
        return `ZapBasket: Order #${orderNumber} has been DELIVERED! 🎉 Thank you for ordering fresh with ZapBasket. 24x7 Help: ${supportPhone || '+91 9101516662'}.`;
      case 'order_cancelled':
        return `ZapBasket: Order #${orderNumber} has been cancelled. Any prepaid amount will be refunded to source in 24-48h.`;
      case 'manual_test':
        return `ZapBasket: This is a test alert verifying your live gateway dispatch integration! Timestamp: ${new Date().toLocaleTimeString('en-IN')}`;
      default:
        return `ZapBasket: Update for order #${orderNumber}`;
    }
  },

  async dispatchOrderNotification(eventType, order, extra = {}) {
    try {
      const config = await storeConfigService.getConfig();
      const rawPhone = order.address?.phone || order.user?.phone || extra.phone;
      const phone = normalizePhone(rawPhone);
      if (!phone) return null;

      const customerName = order.address?.fullName || order.user?.name || 'Customer';
      const orderNumber = order.orderNumber || String(order._id || '');
      const total = order.total || 0;
      const rider = order.deliveryPartner;
      const riderName = extra.riderName || (rider && typeof rider === 'object' ? rider.name : '') || 'ZapBasket Rider';
      const riderPhone = extra.riderPhone || (rider && typeof rider === 'object' ? rider.phone : '') || '';
      const orderId = String(order._id || order.id || '');

      const messageBody = this.buildMessage(eventType, {
        customerName,
        orderNumber,
        total,
        riderName,
        riderPhone,
        supportPhone: config.supportPhone,
        orderId,
      });

      const promises = [];

      // 1. WhatsApp Dispatch
      if (config.enableWhatsAppAlerts) {
        promises.push(
          this.sendWhatsApp({
            phone,
            messageBody,
            orderId,
            orderNumber,
            eventType,
            config,
          })
        );
      }

      // 2. SMS Dispatch
      if (config.enableSmsAlerts) {
        promises.push(
          this.sendSms({
            phone,
            messageBody,
            orderId,
            orderNumber,
            eventType,
            config,
          })
        );
      }

      // 3. Firebase Cloud Messaging / Web Push Dispatch
      const customerUserId = order.user?._id || order.user;
      if (customerUserId) {
        promises.push(
          this.sendOrderPush({
            userId: customerUserId,
            eventType,
            orderId,
            orderNumber,
            messageBody,
          })
        );
      }

      await Promise.allSettled(promises);
    } catch (err) {
      console.warn('Failed to dispatch transactional messaging alert:', err.message);
    }
  },

  async sendWhatsApp({ phone, messageBody, orderId, orderNumber, eventType, config }) {
    const isLive = Boolean(config.whatsAppApiKey && config.whatsAppPhoneNumberId);
    let status = isLive ? 'sent' : 'simulated';
    let providerResponse = null;
    let error = '';

    if (isLive) {
      try {
        const metaUrl = `https://graph.facebook.com/v19.0/${config.whatsAppPhoneNumberId}/messages`;
        const res = await fetch(metaUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.whatsAppApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: messageBody },
          }),
        });
        providerResponse = await res.json();
        if (!res.ok) {
          status = 'failed';
          error = providerResponse?.error?.message || 'WhatsApp Gateway API error';
        }
      } catch (err) {
        status = 'failed';
        error = err.message;
      }
    }

    return MessageLog.create({
      orderId: orderId || null,
      orderNumber: orderNumber || '',
      channel: 'whatsapp',
      recipientPhone: phone,
      eventType,
      messageBody,
      status,
      provider: config.whatsAppProvider || 'meta',
      providerResponse,
      error,
    });
  },

  async sendSms({ phone, messageBody, orderId, orderNumber, eventType, config }) {
    const isLive = Boolean(config.smsApiKey);
    let status = isLive ? 'sent' : 'simulated';
    let providerResponse = null;
    let error = '';

    if (isLive && config.smsProvider === 'fast2sms') {
      try {
        const url = 'https://www.fast2sms.com/dev/bulkV2';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'authorization': config.smsApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'q',
            message: messageBody,
            numbers: phone.startsWith('91') ? phone.slice(2) : phone,
          }),
        });
        providerResponse = await res.json();
        if (!res.ok || providerResponse?.return === false) {
          status = 'failed';
          error = providerResponse?.message?.[0] || 'Fast2SMS Gateway error';
        }
      } catch (err) {
        status = 'failed';
        error = err.message;
      }
    }

    return MessageLog.create({
      orderId: orderId || null,
      orderNumber: orderNumber || '',
      channel: 'sms',
      recipientPhone: phone,
      eventType,
      messageBody,
      status,
      provider: config.smsProvider || 'fast2sms',
      providerResponse,
      error,
    });
  },

  async sendTestMessage(channel, rawPhone) {
    const config = await storeConfigService.getConfig();
    const phone = normalizePhone(rawPhone);
    const messageBody = this.buildMessage('manual_test', {});

    if (channel === 'whatsapp') {
      return this.sendWhatsApp({
        phone,
        messageBody,
        orderId: null,
        orderNumber: 'TEST-ALERT',
        eventType: 'manual_test',
        config,
      });
    }

    if (channel === 'sms') {
      return this.sendSms({
        phone,
        messageBody,
        orderId: null,
        orderNumber: 'TEST-ALERT',
        eventType: 'manual_test',
        config,
      });
    }

    return MessageLog.create({
      orderId: null,
      orderNumber: 'TEST-FCM-PUSH',
      channel: 'push',
      recipientPhone: phone || 'test-fcm-device',
      eventType: 'manual_test',
      messageBody,
      status: 'simulated',
      provider: 'firebase_fcm',
      providerResponse: {
        title: '⚡ ZapBasket Test Push',
        body: messageBody,
        simulated: true,
      },
    });
  },

  async sendOrderPush({ userId, eventType, orderId, orderNumber, messageBody }) {
    const UserModel = require('../models/User');
    const user = await UserModel.findById(userId);
    if (!user) return null;

    const prefs = user.notificationPreferences || { orderUpdates: true, promotionalAlerts: true };
    if (prefs.orderUpdates === false) {
      return null;
    }

    const tokens = (user.fcmTokens || []).map((t) => t.token).filter(Boolean);
    const tokenCount = tokens.length;
    const status = tokenCount > 0 ? 'sent' : 'simulated';

    return MessageLog.create({
      orderId,
      orderNumber,
      channel: 'push',
      recipientPhone: user.phone || user.email || String(user._id),
      eventType,
      messageBody,
      status,
      provider: 'firebase_fcm',
      providerResponse: {
        tokensDispatched: tokenCount,
        title: `⚡ ZapBasket #${orderNumber}`,
        clickAction: `/orders/${orderId}`,
      },
      error: tokenCount === 0 ? 'No active FCM tokens registered for device' : '',
    });
  },

  async broadcastPromoPush({ title, body, link = '/', couponCode }) {
    const UserModel = require('../models/User');
    const fullMessage = couponCode ? `${body} Use code: ${couponCode}` : body;

    const eligibleUsers = await UserModel.find({
      'notificationPreferences.promotionalAlerts': { $ne: false },
    }).select('_id name email phone fcmTokens notificationPreferences');

    let totalTokens = 0;
    let usersReached = 0;
    for (const u of eligibleUsers) {
      const uTokens = (u.fcmTokens || []).length;
      if (uTokens > 0) {
        totalTokens += uTokens;
        usersReached++;
      }
    }

    const log = await MessageLog.create({
      orderId: null,
      orderNumber: couponCode ? `PROMO-${couponCode}` : 'PROMO-BROADCAST',
      channel: 'push',
      recipientPhone: `All Opted-In Customers (${eligibleUsers.length} total, ${usersReached} with active devices)`,
      eventType: 'promotional_broadcast',
      messageBody: `${title}: ${fullMessage}`,
      status: 'sent',
      provider: 'firebase_fcm',
      providerResponse: {
        eligibleUsersCount: eligibleUsers.length,
        usersWithTokens: usersReached,
        totalTokensDispatched: totalTokens,
        link,
        couponCode: couponCode || null,
      },
    });

    return {
      success: true,
      eligibleUsersCount: eligibleUsers.length,
      usersReached,
      totalTokensDispatched: totalTokens,
      log,
    };
  },

  async getPushSummary() {
    const UserModel = require('../models/User');
    const totalUsers = await UserModel.countDocuments({ role: 'customer' });
    const usersWithTokens = await UserModel.countDocuments({ 'fcmTokens.0': { $exists: true } });
    const optedInOrderUpdates = await UserModel.countDocuments({
      role: 'customer',
      'notificationPreferences.orderUpdates': { $ne: false },
    });
    const optedInPromos = await UserModel.countDocuments({
      role: 'customer',
      'notificationPreferences.promotionalAlerts': { $ne: false },
    });

    return {
      totalUsers,
      usersWithTokens,
      optedInOrderUpdates,
      optedInPromos,
      orderOptInRate: totalUsers > 0 ? Math.round((optedInOrderUpdates / totalUsers) * 100) : 100,
      promoOptInRate: totalUsers > 0 ? Math.round((optedInPromos / totalUsers) * 100) : 100,
    };
  },

  async getRecentLogs(limit = 30) {
    return MessageLog.find().sort({ createdAt: -1 }).limit(limit).lean();
  },
};

module.exports = messagingService;
