const cron = require('node-cron')
const Reminder = require('../models/Reminder')
const Assignment = require('../models/Assignment')
const User = require('../models/User')
const { sendEmail, buildReminderEmail } = require('./email')
const { sendPush, isPushReady } = require('./push')

const REMINDER_TYPES = ['7d', '3d', '1d', '6h']

const OFFSET_MS = {
    '7d': 7 * 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
}

/**
 * Calculate which reminder slots are still in the future for a given deadline.
 */
const buildReminderSchedule = (deadline, types = REMINDER_TYPES) => {
    if (!deadline) return []
    const due = new Date(deadline)
    return types
        .map((type) => ({
            type,
            scheduledAt: new Date(due.getTime() - OFFSET_MS[type]),
        }))
        .filter(({ scheduledAt }) => scheduledAt.getTime() > Date.now())
}

// ─── QUEUE REMINDERS FOR ALL STUDENTS IN AN ASSIGNMENT'S CLASS/DIVISION ───────

/**
 * Queue reminders for ALL students in the assignment's class + division.
 * Creates reminder records at 7d, 3d, 1d, and 6h before deadline.
 * Skips slots that are already in the past.
 *
 * @param {Object} assignment - The assignment document (must have _id, deadline, class, division)
 */
const queueRemindersForAssignment = async (assignment) => {
    if (!assignment?.deadline) {
        console.log('⚠️  No deadline on assignment, skipping reminder queue')
        return []
    }

    const schedule = buildReminderSchedule(assignment.deadline)
    if (schedule.length === 0) {
        console.log(`⚠️  All reminder slots are in the past for "${assignment.title}", skipping`)
        return []
    }

    // Find all active students in this class + division
    const students = await User.find({
        role: 'student',
        isActive: true,
        class: assignment.class,
        division: assignment.division,
    }).select('_id name email')

    if (students.length === 0) {
        console.log(`⚠️  No students found for ${assignment.class}-${assignment.division}, skipping reminders`)
        return []
    }

    // Build bulk reminder documents: every student × every applicable time slot
    const reminders = []
    for (const student of students) {
        for (const { type, scheduledAt } of schedule) {
            reminders.push({
                assignmentId: assignment._id,
                userId: student._id,
                scheduledAt,
                type,
                sent: false,
            })
        }
    }

    try {
        // insertMany with ordered:false — the unique index (assignmentId+userId+type)
        // will silently skip duplicates if reminders were already queued
        const result = await Reminder.insertMany(reminders, { ordered: false })
        console.log(`✅ Queued ${result.length} reminders for "${assignment.title}" → ${students.length} students × ${schedule.length} slots`)
        return result
    } catch (err) {
        // BulkWriteError with duplicates is expected — log the successful count
        if (err.insertedDocs) {
            console.log(`✅ Queued ${err.insertedDocs.length} reminders (some duplicates skipped)`)
            return err.insertedDocs
        }
        console.error('❌ Failed to queue reminders:', err.message)
        return []
    }
}

/**
 * Delete all pending (unsent) reminders for an assignment.
 * Called when an assignment is deleted.
 */
const deleteRemindersForAssignment = async (assignmentId) => {
    try {
        const result = await Reminder.deleteMany({ assignmentId, sent: false })
        console.log(`🗑️  Deleted ${result.deletedCount} pending reminders for assignment ${assignmentId}`)
        return result
    } catch (err) {
        console.error('❌ Failed to delete reminders:', err.message)
    }
}

/**
 * Re-queue reminders when an assignment's deadline is updated.
 * Deletes old pending reminders and creates new ones.
 */
const requeueRemindersForAssignment = async (assignment) => {
    await deleteRemindersForAssignment(assignment._id)
    return queueRemindersForAssignment(assignment)
}

// ─── REMINDER DISPATCH (CALLED BY CRON) ──────────────────────────────────────

const markAssignmentReminderSent = async (assignmentId, type) => {
    await Assignment.updateOne(
        { _id: assignmentId, 'remindersSet.type': type },
        { $set: { 'remindersSet.$.sent': true } }
    ).catch(() =>
        Assignment.updateOne(
            { _id: assignmentId },
            { $push: { remindersSet: { type, sent: true } } }
        )
    )
}

/**
 * Dispatch a single reminder — send email + optional push notification.
 */
const dispatchReminder = async (reminder) => {
    const assignment = await Assignment.findById(reminder.assignmentId).populate('subjectId')
    const user = await User.findById(reminder.userId)

    if (!assignment || !user) {
        // Assignment or user was deleted — mark as sent so we don't retry
        reminder.sent = true
        await reminder.save()
        console.log(`⚠️  Skipped reminder (missing assignment/user) — marked as sent`)
        return
    }

    const portalUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim()
    const studentPortalUrl = `${portalUrl}/student/assignments`

    // Build professional email
    const emailContent = buildReminderEmail({
        studentName: user.name?.split(' ')[0] || 'Student',
        assignmentTitle: assignment.title,
        subjectName: assignment.subjectId?.name || 'Your Subject',
        deadline: assignment.deadline,
        reminderType: reminder.type,
        portalUrl: studentPortalUrl,
    })

    try {
        // Send email
        const emailResult = await sendEmail({
            to: user.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
        })

        if (emailResult?.skipped) {
            console.log(`⚠️  Email skipped (SMTP not configured) for ${user.email}`)
        } else {
            console.log(`📧 Reminder email sent → ${user.email} | "${assignment.title}" | ${reminder.type}`)
        }

        // Send push notification if available
        if (isPushReady()) {
            const payload = {
                title: `⏰ Assignment due ${reminder.type === '6h' ? 'in 6 hours!' : 'soon'}`,
                body: `"${assignment.title}" deadline: ${new Date(assignment.deadline).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
                })}`,
                url: studentPortalUrl,
            }
            const subscriptions = user.pushSubscriptions || []
            await Promise.all(
                subscriptions.map((sub) => sendPush(sub, payload).catch(() => null))
            )
        }

        // Mark as sent
        reminder.sent = true
        await reminder.save()
        await markAssignmentReminderSent(assignment._id, reminder.type)
    } catch (err) {
        console.error(`❌ Failed to dispatch reminder for ${user.email}:`, err.message)
        // Don't mark as sent — will retry on next cron tick
    }
}

// ─── CRON SCHEDULER ──────────────────────────────────────────────────────────

const startReminderScheduler = () => {
    if (process.env.ENABLE_REMINDERS === 'false') {
        console.log('⚠️  Reminders are disabled (ENABLE_REMINDERS=false)')
        return
    }

    console.log('🔔 Reminder scheduler started — checking every 5 minutes for due reminders')

    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            const dueReminders = await Reminder.find({
                sent: false,
                scheduledAt: { $lte: new Date() },
            })
                .sort({ scheduledAt: 1 })
                .limit(50)

            if (dueReminders.length > 0) {
                console.log(`🔔 Processing ${dueReminders.length} due reminder(s)...`)
            }

            for (const reminder of dueReminders) {
                await dispatchReminder(reminder)
            }
        } catch (err) {
            console.error('❌ Reminder cron error:', err.message)
        }
    })
}

module.exports = {
    REMINDER_TYPES,
    buildReminderSchedule,
    queueRemindersForAssignment,
    deleteRemindersForAssignment,
    requeueRemindersForAssignment,
    startReminderScheduler,
}
