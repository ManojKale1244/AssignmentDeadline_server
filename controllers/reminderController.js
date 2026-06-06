const Reminder = require('../models/Reminder')
const Assignment = require('../models/Assignment')

const listReminders = async (req, res, next) => {
    try {
        const query = { userId: req.user.id }
        if (req.query.assignmentId) {
            query.assignmentId = req.query.assignmentId
        }

        const reminders = await Reminder.find(query)
            .sort({ scheduledAt: 1 })
            .limit(200)

        res.json({ reminders })
    } catch (error) {
        next(error)
    }
}

const createReminder = async (req, res, next) => {
    try {
        const { assignmentId, scheduledAt, type } = req.body

        if (!assignmentId || !scheduledAt || !type) {
            return res.status(400).json({ message: 'Assignment, scheduledAt, and type required' })
        }

        const assignment = await Assignment.findById(assignmentId)
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' })
        }

        const reminder = await Reminder.create({
            assignmentId,
            userId: req.user.id,
            scheduledAt: new Date(scheduledAt),
            type,
            sent: false,
        })

        res.status(201).json({ reminder })
    } catch (error) {
        next(error)
    }
}

const cancelReminder = async (req, res, next) => {
    try {
        const reminder = await Reminder.findOne({ _id: req.params.id, userId: req.user.id })
        if (!reminder) {
            return res.status(404).json({ message: 'Reminder not found' })
        }

        reminder.sent = true
        await reminder.save()

        res.json({ reminder })
    } catch (error) {
        next(error)
    }
}

module.exports = {
    listReminders,
    createReminder,
    cancelReminder,
}
