const bcrypt = require('bcryptjs')
const User = require('../models/User')

const seedAdmin = async () => {
    const email = process.env.ADMIN_EMAIL
    const password = process.env.ADMIN_PASSWORD

    if (!email || !password) {
        console.log('ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping admin seed')
        return
    }

    try {
        const existing = await User.findOne({ email }).select('+password')

        if (existing) {
            // Update password if it changed in env
            const isSame = await bcrypt.compare(password, existing.password)
            if (!isSame) {
                existing.password = await bcrypt.hash(password, 10)
                existing.role = 'admin'
                existing.isActive = true
                await existing.save()
                console.log('Admin password updated from env')
            }
        } else {
            const hashed = await bcrypt.hash(password, 10)
            await User.create({
                name: 'Admin',
                email,
                password: hashed,
                role: 'admin',
                isActive: true,
            })
            console.log('Admin user created:', email)
        }
    } catch (error) {
        console.error('Failed to seed admin:', error.message)
    }
}

module.exports = seedAdmin
