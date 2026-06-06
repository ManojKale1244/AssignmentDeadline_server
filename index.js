require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const connectDB = require('./config/db')
const errorHandler = require('./middleware/errorHandler')
const { startReminderScheduler } = require('./utils/reminders')

const app = express()

app.use(helmet())
app.use(
    cors({
        origin: process.env.CLIENT_URL || '*',
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
        windowMs: 15 * 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
    })
)

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

app.use(errorHandler)

const port = process.env.PORT || 5000

const start = async () => {
    try {
        await connectDB()
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
