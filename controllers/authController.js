const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const User = require('../models/User')
const { generateToken } = require('../utils/token')
const { logActivity } = require('../utils/activityLog')
const { uploadBuffer } = require('../utils/cloudinary')
const { sendEmail, buildWelcomeEmail, buildOtpEmail } = require('../utils/email')

// In-memory temporary store for pending registrations
// Map: email -> { otp, hashedPassword, name, email, role, class, division, department, attempts, expiresAt }
const pendingRegistrations = new Map()

// Cleanup expired registrations periodically (every 5 minutes)
setInterval(() => {
    const now = Date.now()
    for (const [email, data] of pendingRegistrations.entries()) {
        if (data.expiresAt < now) {
            pendingRegistrations.delete(email)
        }
    }
}, 5 * 60 * 1000)

const toUserResponse = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    class: user.class,
    division: user.division,
    department: user.department,
    profilePic: user.profilePic,
    isActive: user.isActive,
    createdAt: user.createdAt,
})

// Step 1: Validate registration info, generate OTP, send email
const sendRegistrationOtp = async (req, res, next) => {
    try {
        const { name, email, password, role, class: userClass, division, department } = req.body

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password required' })
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' })
        }

        // Only student role allowed through public registration
        const effectiveRole = role || 'student'
        if (effectiveRole !== 'student') {
            return res.status(403).json({ message: 'Only student accounts can be registered here.' })
        }

        // Student email must end with @coep.sveri.ac.in
        const normalizedEmail = email.trim().toLowerCase()
        if (!normalizedEmail.endsWith('@coep.sveri.ac.in')) {
            return res.status(400).json({ message: 'Only SVERI COEP student email IDs are allowed.' })
        }

        // Check if email already registered
        const existing = await User.findOne({ email: normalizedEmail })
        if (existing) {
            return res.status(409).json({ message: 'Email already registered' })
        }

        // Pre-hash password before saving in memory so plaintext password is NEVER stored
        const hashedPassword = await bcrypt.hash(password, 10)

        // Cryptographically secure 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString()
        const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes

        pendingRegistrations.set(normalizedEmail, {
            otp,
            hashedPassword,
            name: name.trim(),
            email: normalizedEmail,
            role: 'student',
            class: userClass || '',
            division: division || '',
            department: department || '',
            attempts: 0,
            expiresAt,
        })

        // Build and send OTP email
        const otpEmail = buildOtpEmail({
            userName: name.trim(),
            otp,
            expiresMinutes: 10,
        })

        await sendEmail({
            to: normalizedEmail,
            subject: otpEmail.subject,
            html: otpEmail.html,
            text: otpEmail.text,
        })

        res.json({ message: 'Verification code sent to your email.' })
    } catch (error) {
        console.error('Error sending registration OTP:', error)
        next(error)
    }
}

// Step 2: Verify OTP and create user
const verifyRegistrationOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' })
        }

        const normalizedEmail = email.trim().toLowerCase()
        const pending = pendingRegistrations.get(normalizedEmail)

        if (!pending) {
            return res.status(400).json({ message: 'Verification code expired or not found. Please click Create Account again.' })
        }

        if (pending.expiresAt < Date.now()) {
            pendingRegistrations.delete(normalizedEmail)
            return res.status(400).json({ message: 'Verification code expired. Please request a new one.' })
        }

        // Brute-force protection: max 5 attempts
        if (pending.attempts >= 5) {
            pendingRegistrations.delete(normalizedEmail)
            return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new code.' })
        }

        if (pending.otp !== String(otp).trim()) {
            pending.attempts += 1
            const remaining = 5 - pending.attempts
            return res.status(400).json({
                message: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            })
        }

        // Double-check if user was created in the meantime
        const existing = await User.findOne({ email: normalizedEmail })
        if (existing) {
            pendingRegistrations.delete(normalizedEmail)
            return res.status(409).json({ message: 'Email already registered' })
        }

        // Create user in database
        const user = await User.create({
            name: pending.name,
            email: pending.email,
            password: pending.hashedPassword,
            role: 'student',
            class: pending.class,
            division: pending.division,
            department: pending.department,
        })

        // Clean up pending store
        pendingRegistrations.delete(normalizedEmail)

        await logActivity(user._id, 'register', 'User', user._id)

        const token = generateToken(user)

        // Send welcome email asynchronously
        const portalUrl = process.env.CLIENT_URL?.split(',')[0] || 'http://localhost:5173'
        const welcomeEmail = buildWelcomeEmail({
            userName: user.name,
            userEmail: user.email,
            role: user.role,
            portalUrl,
        })
        sendEmail({
            to: user.email,
            subject: welcomeEmail.subject,
            html: welcomeEmail.html,
            text: welcomeEmail.text,
        }).catch((err) => {
            console.error(`❌ Failed to send welcome email to ${user.email}:`, err.message)
        })

        res.status(201).json({ token, user: toUserResponse(user) })
    } catch (error) {
        console.error('Error verifying registration OTP:', error)
        next(error)
    }
}

const register = async (req, res, next) => {
    try {
        const { name, email, password, role, class: userClass, division, department } = req.body

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password required' })
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' })
        }

        // Only allow SVERI COEP student email IDs for student registration
        const effectiveRole = role || 'student'
        if (effectiveRole === 'student' && !email.endsWith('@coep.sveri.ac.in')) {
            return res.status(400).json({ message: 'Only SVERI COEP student email IDs are allowed.' })
        }

        const existing = await User.findOne({ email })
        if (existing) {
            return res.status(409).json({ message: 'Email already registered' })
        }

        const hashed = await bcrypt.hash(password, 10)
        const user = await User.create({
            name,
            email,
            password: hashed,
            role: role || 'student',
            class: userClass,
            division,
            department: department || '',
        })

        await logActivity(user._id, 'register', 'User', user._id)

        const token = generateToken(user)

        // Send welcome email asynchronously (non-blocking)
        const portalUrl = process.env.CLIENT_URL?.split(',')[0] || 'http://localhost:5173'
        const welcomeEmail = buildWelcomeEmail({
            userName: user.name,
            userEmail: user.email,
            role: user.role,
            portalUrl,
        })
        sendEmail({
            to: user.email,
            subject: welcomeEmail.subject,
            html: welcomeEmail.html,
            text: welcomeEmail.text,
        }).then(() => {
            console.log(`✅ Welcome email sent to ${user.email}`)
        }).catch((err) => {
            console.error(`❌ Failed to send welcome email to ${user.email}:`, err.message)
        })

        res.status(201).json({ token, user: toUserResponse(user) })
    } catch (error) {
        next(error)
    }
}

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password required' })
        }

        const user = await User.findOne({ email, isActive: true }).select('+password')
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' })
        }

        const match = await bcrypt.compare(password, user.password)
        if (!match) {
            return res.status(401).json({ message: 'Invalid credentials' })
        }

        const token = generateToken(user)

        res.json({ token, user: toUserResponse(user) })
    } catch (error) {
        next(error)
    }
}

const me = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        res.json({ user: toUserResponse(user) })
    } catch (error) {
        next(error)
    }
}

const updateProfile = async (req, res, next) => {
    try {
        const { class: userClass, division, profilePic } = req.body

        const user = await User.findById(req.user.id)
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        // Department is admin-managed only — not editable via profile
        if (userClass !== undefined) user.class = userClass
        if (division !== undefined) user.division = division
        if (profilePic !== undefined) user.profilePic = profilePic

        await user.save()
        await logActivity(user._id, 'update_profile', 'User', user._id)

        res.json({ user: toUserResponse(user) })
    } catch (error) {
        next(error)
    }
}

const uploadProfilePhoto = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Profile image required' })
        }

        if (!req.file.mimetype?.startsWith('image/')) {
            return res.status(400).json({ message: 'Only image files are allowed' })
        }

        const user = await User.findById(req.user.id)
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        const result = await uploadBuffer(req.file.buffer, {
            folder: 'edutrack/avatars',
            resource_type: 'image',
            transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
        })

        user.profilePic = result.secure_url
        await user.save()
        await logActivity(user._id, 'update_profile_photo', 'User', user._id)

        res.json({ user: toUserResponse(user), profilePic: result.secure_url })
    } catch (error) {
        next(error)
    }
}

module.exports = {
    register,
    sendRegistrationOtp,
    verifyRegistrationOtp,
    login,
    me,
    updateProfile,
    uploadProfilePhoto,
}
