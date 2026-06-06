const nodemailer = require('nodemailer')

const getTransporter = () => {
    if (!process.env.SMTP_HOST) {
        return null
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            }
            : undefined,
    })
}

const sendEmail = async ({ to, subject, html, text }) => {
    const transporter = getTransporter()
    if (!transporter) {
        console.warn('SMTP not configured. Skipping email send.')
        return { skipped: true }
    }

    const from = process.env.SMTP_FROM || 'EduTrack <no-reply@edutrack.local>'

    return transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
    })
}

module.exports = { sendEmail }
