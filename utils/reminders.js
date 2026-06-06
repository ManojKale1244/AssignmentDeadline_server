const cron = require('node-cron')
const Reminder = require('../models/Reminder')
const Assignment = require('../models/Assignment')
const User = require('../models/User')
const { sendEmail } = require('./email')
const { sendPush, isPushReady } = require('./push')

const REMINDER_TYPES = ['7d', '3d', '1d', '6h']

const OFFSET_MS = {
    '7d': 7 * 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
}

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

const queueAssignmentReminders = async (assignment, user) => {
    if (!assignment?.deadline || !user) return []

    const schedule = buildReminderSchedule(assignment.deadline)
    if (schedule.length === 0) return []

    const reminders = schedule.map(({ type, scheduledAt }) => ({
        assignmentId: assignment._id,
        userId: user._id,
        scheduledAt,
        type,
        sent: false,
    }))

    return Reminder.insertMany(reminders, { ordered: false }).catch(() => [])
}

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

const dispatchReminder = async (reminder) => {
    const assignment = await Assignment.findById(reminder.assignmentId).populate('subjectId')
    const user = await User.findById(reminder.userId)

    if (!assignment || !user) {
        reminder.sent = true
        await reminder.save()
        return
    }

    const subject = `Reminder: ${assignment.title} due ${new Date(
        assignment.deadline
    ).toLocaleString()}`

    const message = {
        title: 'Assignment due soon',
        body: `${assignment.title} is due on ${new Date(
            assignment.deadline
        ).toLocaleString()}.`,
        url: process.env.CLIENT_URL || '',
    }

    try {
        await sendEmail({
            to: user.email,
            subject,
            text: message.body,
            html: `<p>${message.body}</p>`,
        })

        if (isPushReady()) {
            const payload = {
                title: message.title,
                body: message.body,
                url: message.url,
            }
            const subscriptions = user.pushSubscriptions || []
            await Promise.all(
                subscriptions.map((sub) => sendPush(sub, payload).catch(() => null))
            )
        }

        reminder.sent = true
        await reminder.save()
        await markAssignmentReminderSent(assignment._id, reminder.type)
    } catch {
        // retry on next cron tick while sent remains false
    }
}

const startReminderScheduler = () => {
    if (process.env.ENABLE_REMINDERS === 'false') return

    cron.schedule('*/1 * * * *', async () => {
        const due = await Reminder.find({
            sent: false,
            scheduledAt: { $lte: new Date() },
        })
            .sort({ scheduledAt: 1 })
            .limit(50)

        for (const reminder of due) {
            await dispatchReminder(reminder)
        }
    })
}

module.exports = {
    REMINDER_TYPES,
    buildReminderSchedule,
    queueAssignmentReminders,
    startReminderScheduler,
}
