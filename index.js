require('dotenv').config() // Reload trigger comment - updated credentials

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const connectDB = require('./config/db')
const errorHandler = require('./middleware/errorHandler')
const { startReminderScheduler } = require('./utils/reminders')
const seedAdmin = require('./utils/seedAdmin')

const app = express()

// Trust the reverse proxy on Render/Heroku so express-rate-limit reads real client IPs
app.set('trust proxy', 1)

app.use(helmet())
const allowedOrigins = (process.env.CLIENT_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (mobile apps, Postman, server-to-server)
            if (!origin) return callback(null, true)
            if (
                allowedOrigins.length === 0 ||
                allowedOrigins.includes(origin)
            ) {
                return callback(null, true)
            }
            callback(new Error('Not allowed by CORS'))
        },
        credentials: true,
    })
)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'))
}

app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100000, // High capacity to support 1000+ simultaneous students on campus Wi-Fi
        keyGenerator: (req) => {
            // Rate-limit per user token when authenticated so 1000 students sharing campus Wi-Fi IP don't block each other
            const authHeader = req.headers.authorization
            if (authHeader && authHeader.startsWith('Bearer ')) {
                return authHeader.slice(7)
            }
            return req.ip
        },
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: 'Too many requests, please try again later.' },
    })
)
app.get("/", (req, res) => {
    res.status(200).json({
        message: "EduTrack API Running Successfully"
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'EduTrack API' })
})

app.use('/api/auth', require('./routes/authRoutes'))
app.use('/api/departments', require('./routes/departmentRoutes'))
app.use('/api/subjects', require('./routes/subjectRoutes'))
app.use('/api/assignments', require('./routes/assignmentRoutes'))
app.use('/api/materials', require('./routes/materialRoutes'))
app.use('/api/notices', require('./routes/noticeRoutes'))
app.use('/api/essays', require('./routes/essayRoutes'))
app.use('/api/reminders', require('./routes/reminderRoutes'))
app.use('/api/notifications', require('./routes/notificationRoutes'))
app.use('/api/admin', require('./routes/adminRoutes'))
app.use('/api/teacher', require('./routes/teacherRoutes'))
app.use('/api/student', require('./routes/studentRoutes'))
app.use('/api/search', require('./routes/searchRoutes'))

app.use(errorHandler)

const port = process.env.PORT || 5000

const start = async () => {
    try {
        await connectDB()
        await seedAdmin()
        startReminderScheduler()
        app.listen(port, () => {
            console.log(`EduTrack server running on port ${port}`)
        })
    } catch (err) {
        console.error('Failed to start server:', err.message)
        process.exit(1)
    }
}

start()
