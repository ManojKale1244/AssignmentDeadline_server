const mongoose = require('mongoose')

const connectDB = async () => {
    const uri = process.env.MONGO_URI
    if (!uri) {
        throw new Error('MONGO_URI is not set')
    }

    await mongoose.connect(uri, {
        autoIndex: true,
        serverSelectionTimeoutMS: 15000,
    })

    mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err.message)
    })

    console.log('MongoDB connected')
}

module.exports = connectDB

