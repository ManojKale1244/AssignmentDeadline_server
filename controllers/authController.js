const bcrypt = require('bcryptjs')
const User = require('../models/User')
const { generateToken } = require('../utils/token')
const { logActivity } = require('../utils/activityLog')
const { uploadBuffer } = require('../utils/cloudinary')
const { sendEmail, buildWelcomeEmail } = require('../utils/email')

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
        }).then((result) => {
            if (!result?.skipped) {
                console.log(`✅ Welcome email sent to ${user.email}`)
            }
        }).catch(() => {})

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
        }).then((result) => {
            if (!result?.skipped) {
                console.log(`✅ Welcome email sent to ${user.email}`)
            }
        }).catch(() => {})

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
    login,
    me,
    updateProfile,
    uploadProfilePhoto,
}
