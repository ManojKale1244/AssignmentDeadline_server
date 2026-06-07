const mongoose = require('mongoose')

const MaterialSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        category: {
            type: String,
            enum: [
                'notes',
                'lab_manual',
                'question_bank',
                'ppt',
                'previous_papers',
                // Web Development extra categories
                'html_notes',
                'css_notes',
                'js_notes',
                'react_notes',
                'mini_projects',
            ],
            required: true,
        },
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
        fileUrl: { type: String, default: '' },
        publicId: { type: String, default: '' },
        fileType: { type: String, default: '' },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        class: {
            type: String,
            enum: ['SY', 'TY', 'LY', 'ALL'],
            required: true,
        },
        division: {
            type: String,
            enum: ['A', 'B'],
            required: true,
        },
    },
    { timestamps: true }
)

module.exports = mongoose.model('Material', MaterialSchema)
