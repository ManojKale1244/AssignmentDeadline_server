const mongoose = require('mongoose')

const NoticeSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        type: {
            type: String,
            enum: ['unit_test', 'viva', 'practical_exam', 'holiday', 'general'],
            default: 'general',
        },
        targetClass: { type: [String], default: [] },
        targetDivision: { type: [String], default: [] },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
)

module.exports = mongoose.model('Notice', NoticeSchema)
