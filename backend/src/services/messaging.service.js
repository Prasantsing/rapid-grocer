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

    return this.sendSms({
      phone,
      messageBody,
      orderId: null,
      orderNumber: 'TEST-ALERT',
      eventType: 'manual_test',
      config,
    });
  },

  async getRecentLogs(limit = 30) {
    return MessageLog.find().sort({ createdAt: -1 }).limit(limit).lean();
  },
};

module.exports = messagingService;
