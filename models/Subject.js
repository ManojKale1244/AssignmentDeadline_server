const mongoose = require('mongoose')

const SubjectSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        code: { type: String, required: true, trim: true },
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        class: {
            type: String,
            enum: ['SY', 'TY', 'LY'],
            required: true,
        },
        division: {
            type: String,
            enum: ['A', 'B', 'C'],
            required: true,
        },
        department: { type: String, required: true, trim: true },
    },
    { timestamps: true }
)

SubjectSchema.index({ code: 1, class: 1, division: 1 }, { unique: true })

module.exports = mongoose.model('Subject', SubjectSchema)
