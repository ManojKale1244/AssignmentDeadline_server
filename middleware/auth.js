const jwt = require('jsonwebtoken')

const auth = (req, res, next) => {
    const header = req.headers.authorization || ''
    let token = header.startsWith('Bearer ') ? header.slice(7) : null

    // Fallback: accept token from query string (for file view in new tab)
    if (!token && req.query.token) {
        token = req.query.token
    }

    if (!token) {
        return res.status(401).json({ message: 'Missing auth token' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
        return next()
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' })
    }
}

module.exports = auth
