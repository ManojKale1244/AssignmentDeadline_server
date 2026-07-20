const nodemailer = require('nodemailer')

// Strip invisible/non-ASCII characters and trim whitespace from env values
const cleanEnv = (key) => {
    const val = process.env[key]
    if (!val) return ''
    // Remove any non-printable-ASCII characters (zero-width spaces, BOM, etc.)
    return val.replace(/[^\x20-\x7E]/g, '').trim()
}

let _loggedConfig = false
let _transporter = null       // Cached singleton

const getTransporter = () => {
    // Return cached transporter if already created
    if (_transporter) return _transporter

    const host = cleanEnv('SMTP_HOST')
    if (!host) {
        return null
    }

    const port = Number(cleanEnv('SMTP_PORT') || '587')
    const secure = cleanEnv('SMTP_SECURE') === 'true'
    const user = cleanEnv('SMTP_USER')
    const pass = cleanEnv('SMTP_PASS')

    // Log SMTP config once on first use (hide password)
    if (!_loggedConfig) {
        console.log('📧 SMTP Config:', {
            host,
            port,
            secure,
            user: user || '(not set)',
            passLength: pass ? pass.length : 0,
        })
        _loggedConfig = true
    }

    // Use Gmail service shorthand for better compatibility,
    // fall back to manual host/port for non-Gmail servers
    const isGmail = host.includes('gmail')

    const transportConfig = {
        ...(isGmail
            ? { service: 'gmail' }
            : { host, port, secure }),
        auth: user
            ? { user, pass }
            : undefined,
        // Connection pool for better throughput
        pool: true,
        maxConnections: 3,
        maxMessages: 50,
        // Tight timeouts so failures are fast (default is 5+ minutes)
        connectionTimeout: 10000,   // 10s to establish TCP connection
        greetingTimeout: 10000,     // 10s for SMTP greeting
        socketTimeout: 15000,       // 15s for socket inactivity
        tls: {
            rejectUnauthorized: false,
        },
    }

    _transporter = nodemailer.createTransport(transportConfig)
    return _transporter
}

const sendViaBrevo = async (apiKey, { to, subject, html, text, from }) => {
    const senderEmail = from.match(/<([^>]+)>/)?.[1] || from
    const senderName = from.split('<')[0]?.trim() || 'EduTrack'

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email: to }],
            subject: subject,
            htmlContent: html,
            textContent: text
        })
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Brevo API returned status ${response.status}`)
    }
    return response.json()
}

const sendViaResend = async (apiKey, { to, subject, html, text, from }) => {
    const sender = from || 'EduTrack <onboarding@resend.dev>'

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: sender,
            to: [to],
            subject: subject,
            html: html,
            text: text
        })
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Resend API returned status ${response.status}`)
    }
    return response.json()
}

const sendViaSendGrid = async (apiKey, { to, subject, html, text, from }) => {
    const senderEmail = from.match(/<([^>]+)>/)?.[1] || from
    const senderName = from.split('<')[0]?.trim() || 'EduTrack'

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { name: senderName, email: senderEmail },
            subject: subject,
            content: [
                { type: 'text/plain', value: text },
                { type: 'text/html', value: html }
            ]
        })
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `SendGrid API returned status ${response.status}`)
    }
    return { success: true }
}

const sendEmail = async ({ to, subject, html, text }) => {
    const from = cleanEnv('SMTP_FROM') || 'EduTrack <no-reply@edutrack.local>'
    
    // Check for HTTP API keys first (safe for Render Free Tier)
    const brevoKey = cleanEnv('BREVO_API_KEY')
    const resendKey = cleanEnv('RESEND_API_KEY')
    const sendgridKey = cleanEnv('SENDGRID_API_KEY')

    try {
        if (brevoKey) {
            console.log(`📧 Sending email via Brevo HTTP API to ${to}...`)
            return await sendViaBrevo(brevoKey, { to, subject, html, text, from })
        }

        if (resendKey) {
            console.log(`📧 Sending email via Resend HTTP API to ${to}...`)
            return await sendViaResend(resendKey, { to, subject, html, text, from })
        }

        if (sendgridKey) {
            console.log(`📧 Sending email via SendGrid HTTP API to ${to}...`)
            return await sendViaSendGrid(sendgridKey, { to, subject, html, text, from })
        }

        // Fall back to standard SMTP if no API keys are configured
        const transporter = getTransporter()
        if (!transporter) {
            console.warn('⚠️  SMTP/API not configured. Skipping email to:', to)
            return { skipped: true }
        }

        console.log(`📧 Sending email via SMTP to ${to}...`)
        const result = await transporter.sendMail({
            from,
            replyTo: from,
            to,
            subject,
            html,
            text,
            headers: {
                'X-Priority': '3'
            }
        })
        return result
    } catch (err) {
        console.warn(`⚠️  Email to ${to} failed (${err.code || err.message}).`)
        throw err
    }
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

    const subject = `EduTrack: "${assignmentTitle}" is due in ${countdownText}`

    const text = `Hi ${studentName},\n\nThis is a reminder that your assignment "${assignmentTitle}" for ${subjectName} is due in ${countdownText}.\n\nDeadline: ${formattedDeadline}\n\nView your assignments: ${portalUrl}\n\n— EduTrack`

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 20px; background-color: #f9f9f9;">
    <div style="max-width: 600px; margin: 0 auto; border: 1px solid #dddddd; padding: 30px; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #E0224A; margin-top: 0; border-bottom: 2px solid #E0224A; padding-bottom: 10px;">EduTrack Assignment Reminder</h2>
        <p>Hello <strong>${studentName}</strong>,</p>
        <p>This is a reminder that you have an assignment due in <strong>${countdownText}</strong>.</p>
        
        <div style="background-color: #fafafa; border-left: 4px solid #E0224A; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #777777; text-transform: uppercase;">Subject: ${subjectName}</p>
            <h3 style="margin: 0 0 10px 0; color: #333333;">${assignmentTitle}</h3>
            <p style="margin: 0; font-weight: bold; color: #E0224A;">Deadline: ${formattedDeadline}</p>
        </div>

        <p>Please make sure to submit your work before the deadline. You can view your assignments and submit them on the portal:</p>
        <p><a href="${portalUrl}" style="display: inline-block; padding: 10px 20px; background-color: #E0224A; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">View Assignment</a></p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 30px 0;">
        <p style="font-size: 12px; color: #777777; text-align: center;">
            You're receiving this because you are enrolled in ${subjectName}.<br>
            © 2026 EduTrack Manoj Kale - all right resrved
        </p>
    </div>
</body>
</html>`

    return { subject, html, text }
}

/**
 * Build a professional HTML welcome email sent on login.
 *
 * @param {Object} options
 * @param {string} options.userName   - e.g. "Manoj"
 * @param {string} options.userEmail  - e.g. "manoj@coep.sveri.ac.in"
 * @param {string} options.role       - 'student' | 'teacher'
 * @param {string} options.portalUrl  - link to the portal dashboard
 * @returns {{ subject: string, html: string, text: string }}
 */
const buildWelcomeEmail = ({ userName, userEmail, role, portalUrl }) => {
    const isTeacher = role === 'teacher'
    const roleLabel = isTeacher ? 'Teacher' : 'Student'

    const subject = `Welcome to EduTrack, ${userName}`

    const welcomeMessage = `Your <strong>${roleLabel}</strong> account on <strong>EduTrack</strong> has been successfully created. We are glad to have you in our academic community.`

    const featuresList = isTeacher
        ? `
        <div style="margin-top: 24px;">
            <p style="margin: 0 0 12px 0; color: #FFFFFF; font-size: 14px; font-weight: 600;">Here is what you can do:</p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom: 10px; width: 100%;">
                <tr>
                    <td style="color: #8B5CF6; font-weight: bold; font-size: 16px; padding-right: 12px; vertical-align: top; width: 20px;">✓</td>
                    <td style="color: #D4D4D8; font-size: 14px; line-height: 1.5;">Create and manage assignments for your classes</td>
                </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-bottom: 10px; width: 100%;">
                <tr>
                    <td style="color: #8B5CF6; font-weight: bold; font-size: 16px; padding-right: 12px; vertical-align: top; width: 20px;">✓</td>
                    <td style="color: #D4D4D8; font-size: 14px; line-height: 1.5;">Share study materials and resources with your students</td>
                </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-bottom: 10px; width: 100%;">
                <tr>
                    <td style="color: #8B5CF6; font-weight: bold; font-size: 16px; padding-right: 12px; vertical-align: top; width: 20px;">✓</td>
                    <td style="color: #D4D4D8; font-size: 14px; line-height: 1.5;">Send timely deadline reminders automatically</td>
                </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-bottom: 10px; width: 100%;">
                <tr>
                    <td style="color: #8B5CF6; font-weight: bold; font-size: 16px; padding-right: 12px; vertical-align: top; width: 20px;">✓</td>
                    <td style="color: #D4D4D8; font-size: 14px; line-height: 1.5;">Coordinate schedules with the built-in calendar</td>
                </tr>
            </table>
        </div>`
        : `
        <div style="margin-top: 24px;">
            <p style="margin: 0 0 12px 0; color: #FFFFFF; font-size: 14px; font-weight: 600;">Here is what you can do:</p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom: 10px; width: 100%;">
                <tr>
                    <td style="color: #8B5CF6; font-weight: bold; font-size: 16px; padding-right: 12px; vertical-align: top; width: 20px;">✓</td>
                    <td style="color: #D4D4D8; font-size: 14px; line-height: 1.5;">View upcoming assignments and deadlines</td>
                </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-bottom: 10px; width: 100%;">
                <tr>
                    <td style="color: #8B5CF6; font-weight: bold; font-size: 16px; padding-right: 12px; vertical-align: top; width: 20px;">✓</td>
                    <td style="color: #D4D4D8; font-size: 14px; line-height: 1.5;">Access study materials from your teachers</td>
                </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-bottom: 10px; width: 100%;">
                <tr>
                    <td style="color: #8B5CF6; font-weight: bold; font-size: 16px; padding-right: 12px; vertical-align: top; width: 20px;">✓</td>
                    <td style="color: #D4D4D8; font-size: 14px; line-height: 1.5;">Get timely deadline reminders via email</td>
                </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-bottom: 10px; width: 100%;">
                <tr>
                    <td style="color: #8B5CF6; font-weight: bold; font-size: 16px; padding-right: 12px; vertical-align: top; width: 20px;">✓</td>
                    <td style="color: #D4D4D8; font-size: 14px; line-height: 1.5;">Plan your work with the built-in calendar</td>
                </tr>
            </table>
        </div>`

    const text = `Hi ${userName},\n\nWelcome to your EduTrack ${roleLabel} account.\n\nEmail: ${userEmail}\nRole: ${roleLabel}\n\nVisit your dashboard: ${portalUrl}\n\n— EduTrack\n\n© 2026 EduTrack Manoj Kale - all right resrved`

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#121214; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#121214; padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#18181B; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.4); border: 1px solid #27272A;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #7C3AED; padding:36px 40px; text-align:center;">
                            <h1 style="margin:0; color:#ffffff; font-size:26px; font-weight:700; letter-spacing:-0.5px;">
                                EduTrack
                            </h1>
                            <p style="margin:6px 0 0; color:rgba(255,255,255,0.8); font-size:13px; font-weight:500;">
                                Your Smart Academic Companion
                            </p>
                        </td>
                    </tr>

                    <!-- Welcome Badge -->
                    <tr>
                        <td style="padding:28px 40px 0;" align="center">
                            <span style="display:inline-block; background-color:#064E3B; color:#34D399; font-size:13px; font-weight:600; padding:6px 18px; border-radius:20px; letter-spacing:0.3px;">
                                Welcome to EduTrack
                            </span>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:24px 40px;">
                            <p style="margin:0 0 16px; color:#FFFFFF; font-size:16px; line-height:1.6; font-weight:600;">
                                Hi ${userName},
                            </p>
                            <p style="margin:0 0 24px; color:#A1A1AA; font-size:14px; line-height:1.6;">
                                ${welcomeMessage}
                            </p>

                            <!-- Account Details Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1E1E24; border:1px solid #27272A; border-radius:12px; overflow:hidden;">
                                <tr>
                                    <td style="padding:20px 24px;">
                                        <p style="margin:0 12px 12px 0; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#71717A;">
                                            ACCOUNT DETAILS
                                        </p>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td width="80" style="padding-bottom:8px; font-size:13px; color:#71717A; border: none;">Email</td>
                                                <td style="padding-bottom:8px; font-size:13px; color:#FFFFFF; font-weight:500; border: none;">${userEmail}</td>
                                            </tr>
                                            <tr>
                                                <td width="80" style="font-size:13px; color:#71717A; border: none;">Role</td>
                                                <td style="font-size:13px; color:#FFFFFF; font-weight:500; border: none;">${roleLabel}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Features List -->
                            ${featuresList}
                        </td>
                    </tr>

                    <!-- CTA Button -->
                    <tr>
                        <td style="padding:8px 40px 32px;" align="center">
                            <a href="${portalUrl}" target="_blank" style="display:inline-block; background-color:#7C3AED; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:12px 36px; border-radius:8px; letter-spacing:0.2px;">
                                Get Started
                            </a>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#121214; border-top:1px solid #27272A; padding:24px 40px; text-align:center;">
                            <p style="margin:0 0 4px; color:#71717A; font-size:13px; font-weight:600;">
                                EduTrack
                            </p>
                            <p style="margin:0 0 4px; color:#52525B; font-size:11px; line-height:1.5;">
                                This is an automated message from EduTrack.
                            </p>
                            <p style="margin:0 0 8px; color:#52525B; font-size:11px; line-height:1.5;">
                                You are receiving this because an account was created with this email address.
                            </p>
                            <p style="margin:0; color:#52525B; font-size:11px; line-height:1.5; font-weight: 500;">
                                © 2026 EduTrack Manoj Kale - all right resrved
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

module.exports = { sendEmail, buildReminderEmail, buildWelcomeEmail }
