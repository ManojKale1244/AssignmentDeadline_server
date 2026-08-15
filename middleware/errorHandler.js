const multer = require('multer')

const errorHandler = (err, req, res, next) => {
    // Handle multer-specific errors (file size, file filter)
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large. Maximum size limit exceeded.' })
        }
        return res.status(400).json({ message: err.message })
    }

    // Handle file filter rejection (e.g. disallowed file types)
    if (err.message && err.message.startsWith('Only ')) {
        return res.status(400).json({ message: err.message })
    }

    console.error(err)
    const status = err.statusCode || 500
    const isProduction = process.env.NODE_ENV === 'production'

    // In production, hide internal error messages from clients
    const message =
        status < 500 || !isProduction
            ? err.message || 'Server error'
            : 'Internal server error'

    res.status(status).json({ message })
}

module.exports = errorHandler
