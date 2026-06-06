const mongoose = require('mongoose')

const ReminderSchema = new mongoose.Schema(
    {
        assignmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Assignment',
            required: true,
        },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        scheduledAt: { type: Date, required: true },
        type: {
            type: String,
            enum: ['7d', '3d', '1d', '6h'],
            required: true,
        },
        sent: { type: Boolean, default: false },
    },
    { timestamps: true }
)

ReminderSchema.index({ assignmentId: 1, userId: 1, type: 1 }, { unique: true })

module.exports = mongoose.model('Reminder', ReminderSchema)
