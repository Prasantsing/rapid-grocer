const mongoose = require('mongoose');
const { STATUSES } = require('../domain/orderState');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    slug: String,
    emoji: String,
    tint: String,
    unit: String,
    price: Number,
    mrp: Number,
    quantity: Number,
    isReturnable: { type: Boolean, default: false },
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    address: {
      label: String,
      fullName: String,
      phone: String,
      line1: String,
      line2: String,
      landmark: String,
      city: String,
      state: String,
      pincode: String,
    },
    couponCode: { type: String, default: '' },
    subtotal: { type: Number, required: true },
    discount: { type: Number, required: true, default: 0 },
    deliveryFee: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['cod', 'razorpay', 'upi'], required: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cod'],
      default: 'pending',
    },
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    upiId: { type: String, default: '9101516662@ybl' },
    upiTransactionId: { type: String, default: '' },
    upiApp: { type: String, default: '' },
    gatewayVerification: {
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date, default: null },
      gatewayTransactionId: { type: String, default: '' },
      gatewayStatus: { type: String, default: 'PENDING' },
      utr: { type: String, default: '' },
      source: { type: String, default: '' },
    },
    receiptVerification: {
      receiptImageUrl: { type: String, default: '' },
      uploadedAt: { type: Date, default: null },
      extractedOrderId: { type: String, default: '' },
      extractedAmount: { type: Number, default: null },
      extractedUtr: { type: String, default: '' },
      extractedPayeeVpa: { type: String, default: '' },
      extractedPayeeName: { type: String, default: '' },
      extractedTimestamp: { type: String, default: '' },
      extractedStatus: { type: String, default: '' },
      appName: { type: String, default: '' },
      isMatched: { type: Boolean, default: false },
      matchReason: { type: String, default: '' },
      matchDetails: {
        amountMatched: { type: Boolean, default: false },
        orderIdMatched: { type: Boolean, default: false },
        vpaMatched: { type: Boolean, default: false },
        utrFound: { type: Boolean, default: false },
      },
      verificationStatus: {
        type: String,
        enum: [
          'not_uploaded',
          'scanning',
          'verified',
          'mismatched',
          'manual_utr_submitted',
          'admin_approved',
          'admin_rejected',
        ],
        default: 'not_uploaded',
      },
      manualUtr: { type: String, default: '' },
      adminReviewNote: { type: String, default: '' },
      reviewedAt: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    status: { type: String, enum: STATUSES, default: 'placed', index: true },
    deliveryPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    notes: { type: String, default: '', maxlength: 240 },
    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true }
);

orderSchema.set('toJSON', { virtuals: true, versionKey: false });

module.exports = mongoose.model('Order', orderSchema);
