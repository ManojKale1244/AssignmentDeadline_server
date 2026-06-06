const mongoose = require('mongoose')

const ActivityLogSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        action: { type: String, required: true, trim: true },
        targetModel: { type: String, required: true, trim: true },
        targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
)

module.exports = mongoose.model('ActivityLog', ActivityLogSchema)
