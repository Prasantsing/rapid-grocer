const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '', maxlength: 300 },
    emoji: { type: String, default: '🛒' },
    tint: { type: String, default: '#E7F6EF' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

categorySchema.set('toJSON', { virtuals: true, versionKey: false });

module.exports = mongoose.model('Category', categorySchema);
