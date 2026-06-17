const mongoose = require('mongoose')

const AttachmentSchema = new mongoose.Schema(
    {
        url: { type: String, default: '' },
        publicId: { type: String, default: '' },
        fileType: { type: String, default: '' },
    },
    { _id: false }
)

const ReminderSetSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['7d', '3d', '1d', '6h'],
            required: true,
        },
        sent: { type: Boolean, default: false },
    },
    { _id: false }
)

const AssignmentSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
        class: {
            type: String,
            enum: ['SY', 'TY', 'LY'],
            required: true,
        },
        division: {
            type: String,
            enum: ['A', 'B'],
            required: true,
        },
        deadline: { type: Date, required: true },
        attachment: { type: AttachmentSchema, default: () => ({}) },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        remindersSet: { type: [ReminderSetSchema], default: [] },
    },
    { timestamps: true }
)

AssignmentSchema.index({ class: 1, division: 1, deadline: 1 })
AssignmentSchema.index({ createdBy: 1, deadline: -1 })
AssignmentSchema.index({ subjectId: 1, deadline: -1 })

module.exports = mongoose.model('Assignment', AssignmentSchema)
