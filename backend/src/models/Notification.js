const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 400 },
    type: { type: String, enum: ['order', 'promo', 'system'], default: 'system' },
    read: { type: Boolean, default: false, index: true },
    link: { type: String, default: '' },
  },
  { timestamps: true }
);

notificationSchema.set('toJSON', { virtuals: true, versionKey: false });

module.exports = mongoose.model('Notification', notificationSchema);
