const mongoose = require('mongoose')

const EssaySchema = new mongoose.Schema(
    {
        topic: { type: String, required: true, trim: true },
        instructions: { type: String, default: '' },
        wordLimit: { type: Number, required: true, min: 1 },
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
        deadline: { type: Date, required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
    },
    { timestamps: true }
)

module.exports = mongoose.model('Essay', EssaySchema)
