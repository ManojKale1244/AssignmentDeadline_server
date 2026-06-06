const User = require('../models/User')
const Notification = require('../models/Notification')
const { sendPush, isPushReady } = require('../utils/push')

const saveSubscription = async (req, res, next) => {
    try {
        const { subscription } = req.body
        if (!subscription?.endpoint) {
            return res.status(400).json({ message: 'Subscription required' })
        }

        const user = await User.findById(req.user.id)
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        const exists = user.pushSubscriptions.some(
            (sub) => sub.endpoint === subscription.endpoint
        )

        if (!exists) {
            user.pushSubscriptions.push(subscription)
            await user.save()
        }

        res.json({ message: 'Subscription saved' })
    } catch (error) {
        next(error)
    }
}

const sendTestNotification = async (req, res, next) => {
    try {
        if (!isPushReady()) {
            return res.status(400).json({ message: 'Push not configured' })
        }

        const user = await User.findById(req.user.id)
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        const payload = {
            title: 'EduTrack Reminder',
            body: 'Push notifications are working.',
            url: process.env.CLIENT_URL || '',
        }

        await Promise.all(
            (user.pushSubscriptions || []).map((sub) => sendPush(sub, payload))
        )

        res.json({ message: 'Notification sent' })
    } catch (error) {
        next(error)
    }
}

const getNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50)

        res.json({ notifications })
    } catch (error) {
        next(error)
    }
}

const markAsRead = async (req, res, next) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            userId: req.user.id,
        })

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' })
        }

        notification.read = true
        await notification.save()

        res.json({ message: 'Notification marked as read' })
    } catch (error) {
        next(error)
    }
}

module.exports = {
    saveSubscription,
    sendTestNotification,
    getNotifications,
    markAsRead,
}
