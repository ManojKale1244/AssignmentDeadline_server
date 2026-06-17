const User = require('../models/User')

/**
 * Middleware that loads the full user document and attaches it to req.fullUser.
 * Eliminates repeated User.findById(req.user.id) calls in every controller method.
 * Uses .lean() for read-only performance since controllers only read user fields.
 */
const attachUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).lean()
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }
        req.fullUser = user
        next()
    } catch (error) {
        next(error)
    }
}

module.exports = attachUser
