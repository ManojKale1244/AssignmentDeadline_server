const mongoose = require('mongoose')

const NotificationSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true },
        type: {
            type: String,
            enum: ['assignment', 'material', 'notice', 'reminder', 'general'],
            default: 'general',
        },
        read: { type: Boolean, default: false },
        relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
        relatedModel: { type: String, default: '' },
    },
    { timestamps: true }
)

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 })

module.exports = mongoose.model('Notification', NotificationSchema)
