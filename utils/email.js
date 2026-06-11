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
        console.warn('⚠️  SMTP not configured. Skipping email to:', to)
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

/**
 * Build a professional HTML email for assignment deadline reminders.
 *
 * @param {Object} options
 * @param {string} options.studentName   - e.g. "Manoj"
 * @param {string} options.assignmentTitle - e.g. "Calculus Quiz 1"
 * @param {string} options.subjectName   - e.g. "Mathematics"
 * @param {string} options.deadline      - ISO date string
 * @param {string} options.reminderType  - '7d' | '3d' | '1d' | '6h'
 * @param {string} options.portalUrl     - link to the student portal
 * @returns {{ subject: string, html: string, text: string }}
 */
const buildReminderEmail = ({ studentName, assignmentTitle, subjectName, deadline, reminderType, portalUrl }) => {
    const deadlineDate = new Date(deadline)
    const formattedDeadline = deadlineDate.toLocaleString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    })

    const countdownMap = {
        '7d': '7 days',
        '3d': '3 days',
        '1d': '24 hours',
        '6h': '6 hours',
    }
    const countdownText = countdownMap[reminderType] || 'soon'

    const urgencyColors = {
        '7d': { bg: '#E0ECFC', text: '#1A6FCC', accent: '#1A6FCC' },
        '3d': { bg: '#FFF3D4', text: '#B56E00', accent: '#D97706' },
        '1d': { bg: '#FFE0E4', text: '#E0224A', accent: '#FF385C' },
        '6h': { bg: '#FFE0E4', text: '#C91E42', accent: '#E0224A' },
    }
    const colors = urgencyColors[reminderType] || urgencyColors['7d']

    const subject = `⏰ ${countdownText} left — "${assignmentTitle}" deadline`

    const text = `Hi ${studentName},\n\nThis is a reminder that your assignment "${assignmentTitle}" for ${subjectName} is due in ${countdownText}.\n\nDeadline: ${formattedDeadline}\n\nView your assignments: ${portalUrl}\n\n— EduTrack`

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f5f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f7; padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #FF385C 0%, #E0224A 100%); padding:32px 40px; text-align:center;">
                            <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:-0.3px;">
                                📚 EduTrack
                            </h1>
                            <p style="margin:8px 0 0; color:rgba(255,255,255,0.85); font-size:13px; font-weight:500;">
                                Assignment Deadline Reminder
                            </p>
                        </td>
                    </tr>

                    <!-- Urgency Badge -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <span style="display:inline-block; background-color:${colors.bg}; color:${colors.text}; font-size:14px; font-weight:700; padding:8px 20px; border-radius:24px; letter-spacing:0.3px;">
                                            ⏰ Due in ${countdownText}
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:24px 40px;">
                            <p style="margin:0 0 20px; color:#222222; font-size:15px; line-height:1.6;">
                                Hi <strong>${studentName}</strong>,
                            </p>
                            <p style="margin:0 0 24px; color:#484848; font-size:15px; line-height:1.6;">
                                This is a friendly reminder that your assignment is due ${countdownText === 'soon' ? 'soon' : 'in <strong>' + countdownText + '</strong>'}. Please make sure to submit it before the deadline.
                            </p>

                            <!-- Assignment Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa; border:1px solid #eeeeee; border-radius:12px; overflow:hidden;">
                                <tr>
                                    <td style="border-left:4px solid ${colors.accent}; padding:20px 24px;">
                                        <p style="margin:0 0 4px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:1px; color:#717171;">
                                            ${subjectName}
                                        </p>
                                        <h2 style="margin:0 0 12px; color:#222222; font-size:18px; font-weight:700;">
                                            ${assignmentTitle}
                                        </h2>
                                        <table cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="padding-right:8px;">
                                                    <span style="color:#717171; font-size:13px;">📅</span>
                                                </td>
                                                <td>
                                                    <span style="color:#484848; font-size:14px; font-weight:600;">
                                                        ${formattedDeadline}
                                                    </span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CTA Button -->
                    <tr>
                        <td style="padding:8px 40px 32px;" align="center">
                            <a href="${portalUrl}" target="_blank" style="display:inline-block; background:linear-gradient(135deg, #FF385C 0%, #E0224A 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:14px 36px; border-radius:12px; letter-spacing:0.2px;">
                                View My Assignments →
                            </a>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#fafafa; border-top:1px solid #eeeeee; padding:20px 40px; text-align:center;">
                            <p style="margin:0; color:#aeaeb2; font-size:12px; line-height:1.5;">
                                You're receiving this because you're enrolled in <strong>${subjectName}</strong>.<br>
                                This is an automated reminder from EduTrack.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`

    return { subject, html, text }
}

module.exports = { sendEmail, buildReminderEmail }
