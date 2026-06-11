/**
 * Test script to verify email reminder system works end-to-end.
 * 
 * Usage:  node test-email.js your-test-email@gmail.com
 * 
 * This will:
 * 1. Check if SMTP is configured
 * 2. Send a sample reminder email to the given address
 * 3. Report success or failure
 */

require('dotenv').config()

const { sendEmail, buildReminderEmail } = require('./utils/email')

const testEmail = async () => {
    const recipientEmail = process.argv[2]

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📧  EduTrack Email Reminder Test')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // Step 1: Check SMTP config
    console.log('1️⃣  Checking SMTP configuration...')
    
    if (!process.env.SMTP_HOST) {
        console.log('❌ SMTP_HOST is not set in .env')
        process.exit(1)
    }
    if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com') {
        console.log('❌ SMTP_USER is not configured! Still using placeholder.')
        console.log('')
        console.log('   👉 Open server/.env and replace:')
        console.log('      SMTP_USER=your-actual-email@gmail.com')
        console.log('      SMTP_PASS=your-16-char-app-password')
        console.log('      SMTP_FROM=EduTrack <your-actual-email@gmail.com>')
        console.log('')
        console.log('   To get a Gmail App Password:')
        console.log('   1. Go to https://myaccount.google.com/apppasswords')
        console.log('   2. Generate password for "Mail" → "Other (EduTrack)"')
        console.log('   3. Paste the 16-char password as SMTP_PASS')
        process.exit(1)
    }

    console.log(`   ✅ SMTP Host: ${process.env.SMTP_HOST}`)
    console.log(`   ✅ SMTP User: ${process.env.SMTP_USER}`)
    console.log(`   ✅ SMTP Port: ${process.env.SMTP_PORT || 587}`)

    if (!recipientEmail) {
        console.log('\n❌ No recipient email provided!')
        console.log('   Usage: node test-email.js student@example.com\n')
        process.exit(1)
    }

    // Step 2: Build a sample reminder email
    console.log('\n2️⃣  Building sample reminder email...')

    const sampleDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
    
    const emailContent = buildReminderEmail({
        studentName: 'Manoj',
        assignmentTitle: 'Data Structures Lab Assignment #5',
        subjectName: 'Data Structures & Algorithms',
        deadline: sampleDeadline.toISOString(),
        reminderType: '3d',
        portalUrl: (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim() + '/student/assignments',
    })

    console.log(`   ✅ Subject: ${emailContent.subject}`)
    console.log(`   ✅ HTML template generated (${emailContent.html.length} chars)`)

    // Step 3: Send the email
    console.log(`\n3️⃣  Sending test email to ${recipientEmail}...`)

    try {
        const result = await sendEmail({
            to: recipientEmail,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
        })

        if (result?.skipped) {
            console.log('⚠️  Email was skipped (SMTP transporter returned null)')
            console.log('   Check your SMTP_HOST, SMTP_USER, and SMTP_PASS in .env')
            process.exit(1)
        }

        console.log('\n✅ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('✅  EMAIL SENT SUCCESSFULLY!')
        console.log('✅ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`\n   📬 Check inbox of: ${recipientEmail}`)
        console.log('   (Also check spam/junk folder)\n')
        console.log(`   Message ID: ${result?.messageId || 'N/A'}`)

    } catch (err) {
        console.log('\n❌ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('❌  EMAIL FAILED TO SEND')
        console.log('❌ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`\n   Error: ${err.message}`)
        
        if (err.message.includes('Invalid login') || err.message.includes('auth')) {
            console.log('\n   💡 This usually means:')
            console.log('   - Your SMTP_PASS is wrong (use App Password, not Gmail password)')
            console.log('   - 2-Step Verification is not enabled on your Google account')
            console.log('   - Generate App Password at: https://myaccount.google.com/apppasswords')
        }
        
        if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
            console.log('\n   💡 This usually means:')
            console.log('   - Firewall is blocking port 587')
            console.log('   - SMTP_HOST or SMTP_PORT is incorrect')
        }
    }

    process.exit(0)
}

testEmail()
