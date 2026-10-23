const mongoose = require('mongoose');

const messageLogSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    orderNumber: {
      type: String,
      default: '',
      index: true,
    },
    channel: {
      type: String,
      enum: ['sms', 'whatsapp'],
      required: true,
      index: true,
    },
    recipientPhone: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      enum: ['order_placed', 'order_confirmed', 'order_packed', 'out_for_delivery', 'delivered', 'order_cancelled', 'manual_test'],
      required: true,
    },
    messageBody: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['sent', 'simulated', 'failed'],
      default: 'simulated',
      index: true,
    },
    provider: {
      type: String,
      default: 'system',
    },
    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    error: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

messageLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MessageLog', messageLogSchema);
