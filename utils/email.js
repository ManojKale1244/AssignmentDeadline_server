const https = require('https')

// Strip invisible/non-ASCII characters and trim whitespace from env values
const cleanEnv = (key) => {
    const val = process.env[key]
    if (!val) return ''
    return val.replace(/[^\x20-\x7E]/g, '').trim()
}

let _loggedConfig = false

/**
 * Send an email via Brevo (Sendinblue) Transactional HTTP API.
 * Uses Node's built-in `https` module — no extra dependencies needed.
 *
 * Requires env var: BREVO_API_KEY
 * Optional env var: BREVO_SENDER_EMAIL (defaults to edutrack.connect@gmail.com)
 * Optional env var: BREVO_SENDER_NAME  (defaults to EduTrack)
 */
const sendEmail = async ({ to, subject, html, text }) => {
    const apiKey = cleanEnv('BREVO_API_KEY')
    if (!apiKey) {
        console.warn('⚠️  BREVO_API_KEY not configured. Skipping email to:', to)
        return { skipped: true }
    }

    const senderEmail = cleanEnv('BREVO_SENDER_EMAIL') || 'edutrack.connect@gmail.com'
    const senderName = cleanEnv('BREVO_SENDER_NAME') || 'EduTrack'

    // Log config once
    if (!_loggedConfig) {
        console.log('📧 Brevo HTTP API configured:', {
            sender: `${senderName} <${senderEmail}>`,
            apiKeyLength: apiKey.length,
        })
        _loggedConfig = true
    }

    // Normalise `to` — accept a string or an array of strings
    const recipients = Array.isArray(to) ? to : [to]
    const toList = recipients.map((email) => ({ email: email.trim() }))

    const payload = JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: toList,
        subject,
        htmlContent: html || undefined,
        textContent: text || undefined,
    })

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.brevo.com',
            port: 443,
            path: '/v3/smtp/email',
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
            },
        }

        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', (chunk) => { data += chunk })
            res.on('end', () => {
                try {
                    const body = JSON.parse(data)
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        console.log(`✅ Email sent via Brevo to: ${recipients.join(', ')} (messageId: ${body.messageId || 'n/a'})`)
                        resolve(body)
                    } else {
                        console.error(`❌ Brevo API error (${res.statusCode}):`, body)
                        reject(new Error(`Brevo API ${res.statusCode}: ${body.message || JSON.stringify(body)}`))
                    }
                } catch (parseErr) {
                    console.error('❌ Failed to parse Brevo response:', data)
                    reject(parseErr)
                }
            })
        })

        req.on('error', (err) => {
            console.error('❌ Brevo HTTP request failed:', err.message)
            reject(err)
        })

        req.setTimeout(30000, () => {
            req.destroy(new Error('Brevo API request timed out after 30s'))
        })

        req.write(payload)
        req.end()
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
            © 2026 EduTrack Manoj Kale - All rights reserved
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

const buildOtpEmail = ({ userName, otp, expiresMinutes = 10 }) => {
    // Format OTP with spaces between digits (e.g. "1 9 9 2 8 1")
    const formattedOtp = String(otp).split('').join(' ')
    const subject = `Your EduTrack Verification Code: ${otp}`
    const text = `Hi ${userName},\n\nUse the verification code below to complete your account registration. This code is valid for ${expiresMinutes} minutes.\n\nVerification Code: ${formattedOtp}\n\nIf you didn't request this code, you can safely ignore this email.\n\nThis is an automated message from EduTrack.\n© 2026 EduTrack Manoj Kale - all rights reserved`

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
</head>
<body style="margin:0; padding:0; background-color:#F1F5F9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing:antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9; padding:40px 16px;">
        <tr>
            <td align="center">
                <!-- Main Card Container -->
                <table width="500" cellpadding="0" cellspacing="0" style="max-width:500px; width:100%; background-color:#FFFFFF; border-radius:18px; overflow:hidden; box-shadow:0 12px 36px rgba(99, 102, 241, 0.14), 0 2px 6px rgba(0,0,0,0.04); border:1px solid #E2E8F0;">
                    
                    <!-- Header with Purple/Indigo Gradient -->
                    <tr>
                        <td style="background:#6366F1; background-image:linear-gradient(135deg, #6366F1 0%, #7C3AED 55%, #8B5CF6 100%); padding:42px 32px 36px; text-align:center;">
                            <!-- App Badge -->
                            <table cellpadding="0" cellspacing="0" style="margin:0 auto 16px auto;">
                                <tr>
                                    <td align="center" style="background-color:rgba(255, 255, 255, 0.22); border:1px solid rgba(255, 255, 255, 0.35); color:#FFFFFF; font-weight:800; font-size:16px; width:48px; height:48px; border-radius:12px; text-align:center; vertical-align:middle;">
                                        ET
                                    </td>
                                </tr>
                            </table>

                            <!-- Title -->
                            <h1 style="margin:0 0 8px; color:#FFFFFF; font-size:26px; font-weight:800; letter-spacing:-0.4px;">
                                Verify Your Email
                            </h1>
                            <p style="margin:0; color:rgba(255, 255, 255, 0.9); font-size:14px; font-weight:400;">
                                Complete your EduTrack registration
                            </p>
                        </td>
                    </tr>

                    <!-- Card Body -->
                    <tr>
                        <td style="padding:36px 36px 30px; background-color:#FFFFFF;">
                            <!-- Greeting -->
                            <p style="margin:0 0 16px; color:#1E293B; font-size:16px; line-height:1.5;">
                                Hi <strong style="color:#0F172A; font-weight:700;">${userName}</strong>,
                            </p>

                            <!-- Instruction -->
                            <p style="margin:0 0 28px; color:#475569; font-size:14.5px; line-height:1.6;">
                                Use the verification code below to complete your account registration. This code is valid for <strong style="color:#0F172A; font-weight:700;">${expiresMinutes} minutes</strong>.
                            </p>

                            <!-- OTP Box with Dashed Border -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
                                <tr>
                                    <td align="center" style="background-color:#F5F3FF; border:2px dashed #818CF8; border-radius:16px; padding:24px 16px;">
                                        <div style="font-family:'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Courier New', monospace; font-size:36px; font-weight:800; letter-spacing:14px; color:#5B50EA; text-align:center; padding-left:14px;">
                                            ${otp}
                                        </div>
                                    </td>
                                </tr>
                            </table>

                            <!-- Subtext -->
                            <p style="margin:0; color:#64748B; font-size:13px; line-height:1.5; text-align:center;">
                                If you didn't request this code, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#FAFAFA; border-top:1px solid #F1F5F9; padding:22px 30px; text-align:center;">
                            <p style="margin:0 0 4px; color:#64748B; font-size:12px; line-height:1.5;">
                                This is an automated message from EduTrack.
                            </p>
                            <p style="margin:0; color:#475569; font-size:12px; line-height:1.5; font-weight:600;">
                                © 2026 EduTrack Manoj Kale - all rights reserved
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

module.exports = { sendEmail, buildReminderEmail, buildWelcomeEmail, buildOtpEmail }


