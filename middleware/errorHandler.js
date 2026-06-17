const errorHandler = (err, req, res, next) => {
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
