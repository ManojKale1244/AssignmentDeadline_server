const mongoose = require('mongoose')

const PushSubscriptionSchema = new mongoose.Schema(
    {
        endpoint: { type: String, required: true },
        expirationTime: { type: Number, default: null },
        keys: {
            p256dh: { type: String, default: '' },
            auth: { type: String, default: '' },
        },
    },
    { _id: false }
)

const UserSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: { type: String, required: true, select: false },
        role: {
            type: String,
            enum: ['admin', 'teacher', 'student'],
            default: 'student',
        },
        class: {
            type: String,
            enum: ['SY', 'TY', 'LY'],
        },
        division: {
            type: String,
            enum: ['A', 'B'],
        },
        department: { type: String, default: '' },
        profilePic: { type: String, default: '' },
        isActive: { type: Boolean, default: true },
        pushSubscriptions: { type: [PushSubscriptionSchema], default: [] },
    },
    { timestamps: true }
)

module.exports = mongoose.model('User', UserSchema)
